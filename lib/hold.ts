// PayPal steps for one purchase: hold the money for the real item, then take it or release it.
// Only plain code calls these, after enforcement decides; the AI never reaches them.

import { authorizationFrom, money, paypal, stepRequestId, vaultedHoldOrderBody, type Json } from "./paypal.ts";

export type Hold = { orderId: string; authorizationId: string; amount: number; status: string };

// requestKey is stable for one approval + one product, so a retried request can't hold twice.
export async function placeHold(vaultId: string, itemName: string, total: number, requestKey: string): Promise<Hold> {
  const order: Json = await paypal("POST", "/v2/checkout/orders", vaultedHoldOrderBody(vaultId, itemName, total), {
    requestId: stepRequestId(requestKey, "hold"),
  });
  const auth = authorizationFrom(order);
  if (!auth?.id) throw new Error(`PayPal didn't place the hold (order status ${order.status}).`);
  return { orderId: order.id, authorizationId: auth.id, amount: Number(auth.amount.value), status: auth.status };
}

// Take the money. Refuses anything above what PayPal holds or the shopper's limit, and a hold
// that's already been charged or released (a repeated request id would replay the old result).
export async function captureHold(authorizationId: string, amount: number, limit: number) {
  const auth: Json = await paypal("GET", `/v2/payments/authorizations/${authorizationId}`);
  const held = Number(auth.amount.value);
  if (auth.status !== "CREATED") throw new Error(`Refused: this hold is ${auth.status}, so it can't be charged.`);
  if (!(amount > 0) || Math.round(amount * 100) > Math.round(Math.min(held, limit) * 100)) {
    throw new Error(`Refused: $${amount} is more than PayPal holds ($${held}) or your limit ($${limit}).`);
  }
  const capture: Json = await paypal(
    "POST",
    `/v2/payments/authorizations/${authorizationId}/capture`,
    { amount: money(amount), final_capture: true },
    { requestId: stepRequestId(authorizationId, "capture") },
  );
  return { captureId: String(capture.id), status: String(capture.status), amount };
}

export async function releaseHold(authorizationId: string) {
  await paypal("POST", `/v2/payments/authorizations/${authorizationId}/void`, {}, { requestId: stepRequestId(authorizationId, "void") });
  const auth: Json = await paypal("GET", `/v2/payments/authorizations/${authorizationId}`);
  return { status: String(auth.status) };
}
