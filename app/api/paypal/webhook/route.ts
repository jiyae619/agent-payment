import { PayPalError } from "@/lib/paypal.ts";
import { recordEvent, toEvent, verifyWebhook, WEBHOOK_EVENTS } from "@/lib/webhook.ts";

// POST from PayPal → 200 once the event is verified and recorded.
// Set PAYPAL_WEBHOOK_ID (from `npm run register-webhook`) to turn this on.
export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return Response.json({ error: "Webhooks aren't set up (no PAYPAL_WEBHOOK_ID)." }, { status: 503 });

  const event = await request.json().catch(() => null);
  if (!event?.id || !event?.event_type) return Response.json({ error: "Not a PayPal event." }, { status: 400 });

  try {
    if (!(await verifyWebhook(request.headers, event, webhookId))) {
      console.error(`[webhook] signature check failed for ${event.id}`);
      return Response.json({ error: "Signature didn't verify." }, { status: 400 });
    }
  } catch (err) {
    // PayPal will retry a delivery that doesn't get a 2xx, so a verify outage loses nothing.
    console.error(`[webhook] couldn't verify ${event.id}: ${err instanceof PayPalError ? err.status : (err as Error).message}`);
    return Response.json({ error: "Couldn't verify right now." }, { status: 502 });
  }

  if (!(WEBHOOK_EVENTS as readonly string[]).includes(event.event_type)) return Response.json({ ok: true, ignored: event.event_type });
  const e = toEvent(event);
  const fresh = recordEvent(e);
  console.log(`[webhook] ${e.type} order=${e.order_id ?? "-"} proof=${e.custom_id ?? "-"} status=${e.status ?? "-"}${fresh ? "" : " (repeat)"}`);
  return Response.json({ ok: true });
}
