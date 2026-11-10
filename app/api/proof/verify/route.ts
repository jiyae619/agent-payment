import { readOrder } from "@/lib/hold.ts";
import { proofIsIntact, type Proof } from "@/lib/proof.ts";

// POST { proof, seal } → { intact, paypal }: is this saved proof exactly what the server issued, and
// is it the record of that PayPal order? Anyone holding the file (the shopper, a store, a PayPal
// dispute agent) can check it here. The order's custom_id must equal the proof's id.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.proof || typeof body.seal !== "string") return Response.json({ error: "Send the saved file's proof and seal." }, { status: 400 });
  const proof = body.proof as Proof;
  let intact: boolean;
  try {
    intact = proofIsIntact(proof, body.seal);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
  // Only an intact proof is worth looking up at PayPal.
  let paypal: { order_status: string; custom_id: string | null; matches: boolean } | null = null;
  if (intact && proof.paypal?.order_id) {
    try {
      const order = await readOrder(proof.paypal.order_id);
      paypal = { order_status: order.order, custom_id: order.custom_id, matches: Boolean(proof.id) && order.custom_id === proof.id };
    } catch {
      paypal = null; // PayPal didn't answer; the seal check still stands
    }
  }
  return Response.json({ intact, paypal });
}
