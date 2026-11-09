import { ApprovalError, openApproval, seal } from "@/lib/approval.ts";
import { checkProduct } from "@/lib/check-product.ts";
import { releaseExpiredHolds } from "@/lib/hold.ts";
import { allowRun, visitorKey } from "@/lib/guard.ts";
import { pick } from "@/lib/pick.ts";
import { optionView, type Choice } from "@/lib/purchase.ts";
import { searchProducts } from "@/lib/search.ts";
import { searchQuery, shortlist, whyDropped } from "@/lib/shortlist.ts";

// POST { approval } → a stream of lines (NDJSON), so the shopper watches the assistant work:
//   { type: "step", step, text, count? }   one per stage, as it happens
//   { type: "result", status, ...body }    the outcome, last
//
// search (code) → shortlist (code) → check each listing (AI quotes, code verifies) → recommend (AI)
// → the shopper chooses among up to 3 checked options. Nothing is held here: PayPal holds only after
// they choose (/api/shop/buy, lib/purchase.ts), and enforcement (code) then decides.
//
// Stop: the shopper can stop at any point here; nothing has been held.
export async function POST(request: Request) {
  await releaseExpiredHolds();
  const body = await request.json().catch(() => ({}));
  let approved;
  try {
    approved = openApproval(String(body.approval ?? ""));
  } catch (err) {
    if (err instanceof ApprovalError) return Response.json({ error: err.message }, { status: 400 });
    return Response.json({ error: "This approval couldn't be read. Please approve again." }, { status: 400 });
  }
  const m = approved.mandate;
  const max = m.payment.amount_range.max;
  const vaultId = m.payment.vault_id;
  if (max === null || !vaultId) return Response.json({ error: "This approval has no spending limit or PayPal account." }, { status: 400 });
  const limited = allowRun(visitorKey(request));
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // the shopper left; nothing to tell
        }
      };
      const step = (step: string, text: string, count?: number, extra: object = {}) => send({ type: "step", step, text, count, ...extra });
      const finish = (status: number, result: object) => {
        send({ type: "result", status, ...result });
        controller.close();
      };
      const stopped = () => {
        if (!request.signal.aborted) return false;
        console.info("[shop] shopper pressed Stop; ending before any PayPal hold");
        return true;
      };

      // 1. Search and shortlist: plain code.
      const search = await searchProducts(searchQuery(m), { maxPrice: max, limit: 8 });
      const { funnel, candidates } = shortlist(m, search.products);
      // The live shelf: what it found, then what each of your rules removed.
      const items = search.products.map((p) => ({ id: p.id, title: p.title, price: p.price, store: p.store, image: p.image }));
      step("search", "Searched stores", funnel[0]?.count, { items });
      const kept = candidates.map((p) => p.id);
      const dropped = Object.fromEntries(search.products.filter((p) => !kept.includes(p.id)).map((p) => [p.id, whyDropped(m, p)]));
      step("filter", `Kept what fits your limits`, candidates.length, { kept, dropped });
      const base = { funnel, search_source: search.source };
      if (stopped()) return finish(499, { ...base, outcome: "stopped" });
      if (candidates.length === 0) return finish(200, { ...base, outcome: "nothing_found", message: "Nothing matched your limits, so nothing was held or bought." });

      // 2. Check each shortlisted listing (AI, with every quote verified by code), then pick (AI).
      step("check", `Checking ${candidates.length} ${candidates.length === 1 ? "listing" : "listings"}`);
      const reqs = [...m.ext.must_haves, ...m.ext.conditions_of_sale];
      let checked;
      try {
        checked = await Promise.all(candidates.map(async (product) => {
          const r = await checkProduct(product, reqs);
          const ok = r.checks.filter((x) => x.verdict === "checked").length;
          send({ type: "item", id: product.id, ok, of: r.checks.length });
          return { product, ...r };
        }));
      } catch {
        return finish(502, { ...base, error: "The AI couldn't check the products right now. Nothing was held or bought." });
      }
      if (stopped()) return finish(499, { ...base, outcome: "stopped" });
      const quantity = m.checkout.line_items[0]?.quantity ?? 1;
      let chosen;
      try {
        chosen = await pick(m.source_text, checked, quantity);
      } catch {
        // The pick is a convenience: if the AI is unavailable, the code's top-ranked option is used.
        chosen = { product: checked[0].product, reason: "It ranked first on what you asked for.", by: "code" as const };
      }
      if (!chosen) return finish(200, { ...base, outcome: "nothing_found", message: "Nothing matched your limits." });
      const c = checked.find((x) => x.product.id === chosen.product.id)!;
      step("pick", "Picked one", undefined, { id: c.product.id });

      // 3. Stop here and let the shopper choose: the recommendation first, then up to two runner-ups
      // that were checked the same way. Nothing is held until they tap one (/api/shop/buy).
      const ordered = [c, ...checked.filter((x) => x.product.id !== c.product.id)].slice(0, 3);
      const choice: Choice = {
        approval: String(body.approval),
        quantity,
        search_source: search.source,
        funnel,
        shortlist: checked.map((x) => ({ id: x.product.id, title: x.product.title, price: x.product.price, store: x.product.store })),
        candidates: ordered.map((x) => ({ product: x.product, checks: x.checks, policy: x.policy, final_sale: x.final_sale })),
        recommended: { id: c.product.id, reason: chosen.reason, by: chosen.by },
      };
      return finish(200, {
        ...base,
        outcome: "choose",
        recommended: choice.recommended,
        options: choice.candidates.map((x) => optionView(x, quantity)),
        choice: seal(choice),
      });
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
