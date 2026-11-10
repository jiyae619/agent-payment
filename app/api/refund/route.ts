import { ApprovalError, unseal } from "@/lib/approval.ts";
import { readOrder, refundCapture } from "@/lib/hold.ts";
import { PayPalError } from "@/lib/paypal.ts";
import { sealProof, type Proof } from "@/lib/proof.ts";

// POST { refund } → a full refund of one charge, through PayPal's refund API.
// `refund` is the sealed receipt from /api/shop or /api/shop/answer, so it can only refund the charge
// it was issued for. The proof record gets the refund added and is sealed again.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  let r: { captureId: string; orderId: string; amount: number; proof: Proof };
  try {
    r = unseal(String(body.refund ?? "")) as typeof r;
  } catch (err) {
    return Response.json({ error: err instanceof ApprovalError ? err.message : "This receipt couldn't be read." }, { status: 400 });
  }

  try {
    const refund = await refundCapture(r.captureId);
    const status = await readOrder(r.orderId);
    const proof: Proof = {
      ...r.proof,
      outcome: { status: "refunded", amount: 0 },
      paypal: { ...r.proof.paypal, refund_id: refund.refundId, refunded: refund.amount, status: status.capture?.status ?? r.proof.paypal.status },
      events: [...r.proof.events, { at: new Date().toISOString(), what: `You asked for a refund, so PayPal returned $${refund.amount.toFixed(2)}.` }],
    };
    return Response.json({ outcome: "refunded", refund, paypal: { readBack: status }, proof, proof_seal: sealProof(proof) });
  } catch (err) {
    if (err instanceof PayPalError) {
      console.error(`[refund] ${err.message}`);
      return Response.json({ error: `PayPal didn't refund it (${err.status}). Nothing changed.` }, { status: 502 });
    }
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
