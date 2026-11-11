// POST feedback → { ok }. Loop 2 of the feedback plan: one log line per shopper
// answer, read later by scripts/feedback-to-cases.mts to draft eval cases and a to-do list.
//
//   { kind: "dont_buy_reason" | "rating", value, store, outcome, asked_because? }
//     anonymous: only the answer, the store's domain, the outcome and which question fired.
//   { kind: "request_edit", before, after }
//     only sent when the shopper ticks "Share this correction": their two request texts, nothing else
//     (no PayPal details, no product, no amount). It's the drafter's best eval signal.

const ANSWERS: Record<string, string[]> = {
  dont_buy_reason: ["too_expensive", "wrong_store", "not_what_i_meant"],
  rating: ["right", "wrong_item", "not_delivered"],
};

const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind ?? "");
  const at = new Date().toISOString();

  if (kind === "request_edit") {
    const before = clean(body.before, 1000);
    const after = clean(body.after, 1000);
    if (!before || !after || before === after) return Response.json({ error: "Nothing changed." }, { status: 400 });
    console.info(`[feedback] ${JSON.stringify({ at, kind, before, after })}`);
    return Response.json({ ok: true });
  }

  const value = String(body.value ?? "");
  if (!ANSWERS[kind]?.includes(value)) return Response.json({ error: "Unknown feedback." }, { status: 400 });
  const store = String(body.store ?? "").toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 100);
  const outcome = ["bought", "released", "refused"].includes(body.outcome) ? body.outcome : "unknown";
  const asked = Array.isArray(body.asked_because) ? body.asked_because.map(String).filter((r: string) => /^[a-z_]{1,30}$/.test(r)).slice(0, 6) : [];
  console.info(`[feedback] ${JSON.stringify({ at, kind, value, store, outcome, asked_because: asked })}`);
  return Response.json({ ok: true });
}
