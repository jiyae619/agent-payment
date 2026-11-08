import { createHash } from "node:crypto";
import { ApprovalError, openApproval, seal } from "@/lib/approval.ts";
import { checkProduct } from "@/lib/check-product.ts";
import { decide, type Proposal } from "@/lib/enforce.ts";
import { captureHold, placeHold, releaseHold } from "@/lib/hold.ts";
import { PayPalError } from "@/lib/paypal.ts";
import { pick } from "@/lib/pick.ts";
import { totalLine } from "@/lib/pick-core.ts";
import { searchProducts } from "@/lib/search.ts";
import { isNamedItem, searchQuery, shortlist } from "@/lib/shortlist.ts";

// POST { approval } → what it found, what it picked and why, and what happened to the money.
//
// search (code) → shortlist (code) → check each listing (AI quotes, code verifies) → pick (AI)
// → PayPal holds the real total → enforcement (code) decides: charge, release, or ask the shopper.
export async function POST(request: Request) {
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

  // 1. Search and shortlist: plain code.
  const search = await searchProducts(searchQuery(m), { maxPrice: max, limit: 8 });
  const { funnel, candidates } = shortlist(m, search.products);
  const base = { funnel, search_source: search.source };
  if (candidates.length === 0) {
    return Response.json({ ...base, outcome: "nothing_found", message: "Nothing matched your limits, so nothing was held or bought." });
  }

  // 2. Check each shortlisted listing (AI, with every quote verified by code), then pick (AI).
  const reqs = [...m.ext.must_haves, ...m.ext.conditions_of_sale];
  let checked;
  try {
    checked = await Promise.all(candidates.map(async (product) => ({ product, ...(await checkProduct(product, reqs)) })));
  } catch {
    return Response.json({ ...base, error: "The AI couldn't check the products right now. Nothing was held or bought." }, { status: 502 });
  }
  const quantity = m.checkout.line_items[0]?.quantity ?? 1;
  let chosen;
  try {
    chosen = await pick(m.source_text, checked, quantity);
  } catch {
    // The pick is a convenience: if the AI is unavailable, the code's top-ranked option is used.
    chosen = { product: checked[0].product, reason: "It ranked first on what you asked for.", by: "code" as const };
  }
  if (!chosen) return Response.json({ ...base, outcome: "nothing_found", message: "Nothing matched your limits." });
  const c = checked.find((x) => x.product.id === chosen.product.id)!;

  const proposal: Proposal = {
    product: c.product,
    quantity,
    total: Math.round(c.product.price * quantity * 100) / 100,
    checks: c.checks,
    is_substitute: !isNamedItem(m, c.product),
    final_sale: c.final_sale,
  };
  const shown = {
    ...base,
    pick: { product: c.product, reason: chosen.reason, by: chosen.by, quantity, total: proposal.total, total_line: totalLine(c.product.price, quantity) },
    checks: c.checks,
    policy: c.policy,
    shortlist: checked.map((x) => ({ id: x.product.id, title: x.product.title, price: x.product.price, store: x.product.store })),
  };

  // 3. PayPal holds the real total on the saved account; enforcement decides what happens to it.
  const key = createHash("sha256").update(`${body.approval}|${c.product.id}`).digest("hex").slice(0, 32);
  try {
    const hold = await placeHold(vaultId, c.product.title, proposal.total, key);
    const decision = decide(m, proposal, { now: new Date(), held: hold.amount });
    const paypal = { orderId: hold.orderId, authorizationId: hold.authorizationId, held: hold.amount };

    if (decision.action === "capture") {
      const capture = await captureHold(hold.authorizationId, decision.amount, max);
      return Response.json({ ...shown, outcome: "bought", decision, paypal: { ...paypal, ...capture } });
    }
    if (decision.action === "void") {
      const released = await releaseHold(hold.authorizationId);
      return Response.json({ ...shown, outcome: "released", decision, paypal: { ...paypal, status: released.status } });
    }
    // Ask: the hold stays open while the shopper decides. The answer route only accepts this sealed record.
    const pending = seal({ authorizationId: hold.authorizationId, amount: proposal.total, limit: max, title: c.product.title });
    return Response.json({ ...shown, outcome: "ask", decision, paypal, pending });
  } catch (err) {
    if (err instanceof PayPalError) {
      const declined = JSON.stringify(err.body ?? "").includes("INSTRUMENT_DECLINED");
      return Response.json(
        { ...shown, error: declined ? "PayPal declined the saved account. Nothing was charged." : `PayPal didn't answer (${err.status}). Nothing was charged.` },
        { status: 502 },
      );
    }
    return Response.json({ ...shown, error: (err as Error).message }, { status: 500 });
  }
}
