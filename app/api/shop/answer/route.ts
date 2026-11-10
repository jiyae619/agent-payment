import { ApprovalError, seal, unseal } from "@/lib/approval.ts";
import { captureHold, readOrder, releaseExpiredHolds, releaseHold } from "@/lib/hold.ts";
import { settlePending } from "@/lib/pending.ts";
import { PayPalError } from "@/lib/paypal.ts";
import { sealProof, whoCovers, type Proof } from "@/lib/proof.ts";

// POST { pending, answer: "pay" | "dont" } → the shopper's answer to "It asks you first".
// `pending` is the sealed record from /api/shop, so the amount, the hold and the proof so far can't be swapped.
export async function POST(request: Request) {
  await releaseExpiredHolds();
  const body = await request.json().catch(() => ({}));
  let p: { authorizationId: string; orderId: string; amount: number; limit: number; proof: Proof; expires_at?: number };
  try {
    p = unseal(String(body.pending ?? "")) as typeof p;
  } catch (err) {
    return Response.json({ error: err instanceof ApprovalError ? err.message : "This purchase couldn't be read." }, { status: 400 });
  }
  const now = () => new Date().toISOString();
  settlePending(p.authorizationId);
  // A late "Pay" can't charge: once the answer window ends, the hold is released instead.
  const late = p.expires_at !== undefined && Date.now() > p.expires_at;

  try {
    if (body.answer === "pay" && !late) {
      const capture = await captureHold(p.authorizationId, p.amount, p.limit);
      const status = await readOrder(p.orderId);
      const proof: Proof = {
        ...p.proof,
        paypal: { ...p.proof.paypal, capture_id: capture.captureId, captured: capture.amount, status: status.authorization ?? status.order },
        outcome: { status: "charged", amount: capture.amount },
        who_covers: whoCovers(true, p.proof.return_policy !== null),
        events: [...p.proof.events, { at: now(), what: `You said pay, so PayPal took $${capture.amount.toFixed(2)}.` }],
      };
      const refund = seal({ captureId: capture.captureId, orderId: p.orderId, amount: capture.amount, proof });
      return Response.json({ outcome: "bought", paypal: { authorizationId: p.authorizationId, ...capture, readBack: status }, proof, proof_seal: sealProof(proof), refund });
    }
    if (body.answer === "dont" || late) {
      // The sweep may already have released it; then this reads back what PayPal says now.
      const released = await releaseHold(p.authorizationId).catch(async () => ({ status: (await readOrder(p.orderId)).authorization ?? "VOIDED" }));
      const status = await readOrder(p.orderId);
      const proof: Proof = {
        ...p.proof,
        paypal: { ...p.proof.paypal, status: status.authorization ?? released.status },
        outcome: { status: "released", amount: 0 },
        who_covers: whoCovers(false, p.proof.return_policy !== null),
        events: [...p.proof.events, { at: now(), what: late ? "The question went unanswered, so PayPal released the hold." : "You said don't buy, so PayPal released the hold." }],
      };
      return Response.json({ outcome: "released", ...(late ? { message: "This question expired, so PayPal released the hold. Nothing was charged." } : {}), paypal: { authorizationId: p.authorizationId, status: released.status, readBack: status }, proof, proof_seal: sealProof(proof) });
    }
    return Response.json({ error: "Answer must be pay or dont." }, { status: 400 });
  } catch (err) {
    if (err instanceof PayPalError) return Response.json({ error: `PayPal didn't answer (${err.status}). Nothing changed.` }, { status: 502 });
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
