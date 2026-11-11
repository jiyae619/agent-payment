// PayPal webhooks: PayPal tells us itself when a hold is created, voided, captured or refunded.
// Every event is checked with PayPal's own verify-webhook-signature call before it is trusted,
// so a forged POST can't make a purchase look paid.
//
// The demo keeps no database, so events live in memory: enough to show on /verify that PayPal
// confirmed a charge, and lost when the server restarts or sleeps. A real deployment would store them.

import { paypal, type Json } from "./paypal.ts";

export const WEBHOOK_EVENTS = [
  "PAYMENT.AUTHORIZATION.CREATED",
  "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.REFUNDED",
] as const;

export type WebhookEvent = { id: string; type: string; at: string; order_id: string | null; custom_id: string | null; status: string | null; amount: number | null };

const MAX_EVENTS = 500;
const events: WebhookEvent[] = [];

// The headers PayPal signs each delivery with.
const SIGNATURE_HEADERS = {
  auth_algo: "paypal-auth-algo",
  cert_url: "paypal-cert-url",
  transmission_id: "paypal-transmission-id",
  transmission_sig: "paypal-transmission-sig",
  transmission_time: "paypal-transmission-time",
} as const;

export async function verifyWebhook(headers: Headers, event: Json, webhookId: string): Promise<boolean> {
  const fields = Object.fromEntries(Object.entries(SIGNATURE_HEADERS).map(([k, h]) => [k, headers.get(h)]));
  if (Object.values(fields).some((v) => !v)) return false;
  const res = await paypal<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", { ...fields, webhook_id: webhookId, webhook_event: event });
  return res.verification_status === "SUCCESS";
}

// Pull the order and proof ids out of an authorization, capture or refund resource.
export function toEvent(event: Json): WebhookEvent {
  const r = event?.resource ?? {};
  const amount = r.amount?.value ?? r.seller_payable_breakdown?.total_refunded_amount?.value;
  return {
    id: String(event?.id ?? ""),
    type: String(event?.event_type ?? ""),
    at: String(event?.create_time ?? new Date().toISOString()),
    order_id: r.supplementary_data?.related_ids?.order_id ?? null,
    custom_id: r.custom_id ?? null,
    status: r.status ?? null,
    amount: amount !== undefined ? Number(amount) : null,
  };
}

export function recordEvent(e: WebhookEvent): boolean {
  if (events.some((x) => x.id === e.id)) return false; // PayPal retries deliveries; keep each once
  events.push(e);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  return true;
}

export function eventsFor(orderId: string | null, proofId: string | null): WebhookEvent[] {
  return events.filter((e) => (orderId && e.order_id === orderId) || (proofId && e.custom_id === proofId));
}

export function resetEvents() { events.length = 0; }
