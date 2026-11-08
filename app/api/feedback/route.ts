// POST { kind, value, store, outcome, asked_because? } → { ok }
// Loop 2 of the feedback plan (build-plan.md): one anonymous log line per shopper answer, so the
// operator can see which stores keep failing checks and which questions shoppers refuse. No request
// text, product title, amount or PayPal id is logged: only the answer and the store's domain.

const KINDS: Record<string, string[]> = {
  dont_buy_reason: ["too_expensive", "wrong_store", "not_what_i_meant"],
  rating: ["right", "wrong_item", "not_delivered"],
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind ?? "");
  const value = String(body.value ?? "");
  if (!KINDS[kind]?.includes(value)) return Response.json({ error: "Unknown feedback." }, { status: 400 });

  const store = String(body.store ?? "").toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 100);
  const outcome = ["bought", "released", "refused"].includes(body.outcome) ? body.outcome : "unknown";
  const asked = Array.isArray(body.asked_because) ? body.asked_because.map(String).filter((r: string) => /^[a-z_]{1,30}$/.test(r)).slice(0, 6) : [];
  console.info(`[feedback] ${JSON.stringify({ at: new Date().toISOString(), kind, value, store, outcome, asked_because: asked })}`);
  return Response.json({ ok: true });
}
