import { ApprovalError, unseal } from "@/lib/approval.ts";
import { captureHold, releaseHold } from "@/lib/hold.ts";
import { PayPalError } from "@/lib/paypal.ts";

// POST { pending, answer: "pay" | "dont" } → the shopper's answer to "It asks you first".
// `pending` is the sealed record from /api/shop, so the amount and hold can't be swapped.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  let p: { authorizationId: string; amount: number; limit: number };
  try {
    p = unseal(String(body.pending ?? "")) as typeof p;
  } catch (err) {
    return Response.json({ error: err instanceof ApprovalError ? err.message : "This purchase couldn't be read." }, { status: 400 });
  }

  try {
    if (body.answer === "pay") {
      const capture = await captureHold(p.authorizationId, p.amount, p.limit);
      return Response.json({ outcome: "bought", paypal: { authorizationId: p.authorizationId, ...capture } });
    }
    if (body.answer === "dont") {
      const released = await releaseHold(p.authorizationId);
      return Response.json({ outcome: "released", paypal: { authorizationId: p.authorizationId, status: released.status } });
    }
    return Response.json({ error: "Answer must be pay or dont." }, { status: 400 });
  } catch (err) {
    if (err instanceof PayPalError) return Response.json({ error: `PayPal didn't answer (${err.status}). Nothing changed.` }, { status: 502 });
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
