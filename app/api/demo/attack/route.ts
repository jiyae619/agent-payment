import { attackerProposal, HIDDEN_NOTE, informedOutcome, naiveDecide, naiveMandate, ATTACK_REQUEST } from "@/lib/attack.ts";
import { GIFT_CARD } from "@/lib/catalog.ts";
import { captureHold, placeHold, readOrder, releaseHold } from "@/lib/hold.ts";
import { PayPalError } from "@/lib/paypal.ts";

// POST { mode: "naive" | "informed" } → the gift-card demo (lib/attack.ts).
// naive: PayPal (sandbox) really holds and charges $100 for the gift card, because a total-only
// approval has no other rule. informed: the gift card is dropped before anything is held.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const now = new Date();
  const shared = { request: ATTACK_REQUEST, hidden_note: HIDDEN_NOTE, proposed: { title: GIFT_CARD.title, price: GIFT_CARD.price, store: GIFT_CARD.store } };

  if (body.mode === "informed") {
    const { funnel, reachedPick, decision } = informedOutcome(now, []);
    return Response.json({ ...shared, mode: "informed", funnel, reached_pick: reachedPick, decision, paypal: null });
  }
  if (body.mode !== "naive") return Response.json({ error: "mode must be naive or informed" }, { status: 400 });

  const vaultId = process.env.PAYPAL_DEMO_VAULT_ID;
  if (!vaultId) return Response.json({ error: "The demo PayPal account isn't connected yet (PAYPAL_DEMO_VAULT_ID)." }, { status: 503 });
  const m = naiveMandate(now);
  const proposal = attackerProposal();
  try {
    const hold = await placeHold(vaultId, GIFT_CARD.title, proposal.total, `attack-${crypto.randomUUID()}`);
    const decision = naiveDecide(m, proposal, hold.amount);
    if (decision.action === "capture") {
      const capture = await captureHold(hold.authorizationId, decision.amount, m.payment.amount_range.max!);
      return Response.json({ ...shared, mode: "naive", decision, paypal: { orderId: hold.orderId, captureId: capture.captureId, amount: capture.amount, readBack: await readOrder(hold.orderId) } });
    }
    await releaseHold(hold.authorizationId);
    return Response.json({ ...shared, mode: "naive", decision, paypal: { orderId: hold.orderId } });
  } catch (err) {
    if (err instanceof PayPalError) return Response.json({ error: `PayPal didn't answer (${err.status}).` }, { status: 502 });
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
