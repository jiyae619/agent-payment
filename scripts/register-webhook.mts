// Registers the demo's webhook with the PayPal sandbox app and prints its id.
// This changes your PayPal app's settings, so run it once, on purpose:
//   DEMO_URL=https://shopping-assistant-z5u2.onrender.com npm run register-webhook
// Then set PAYPAL_WEBHOOK_ID in Render (and .env.local to test locally).
import { paypal } from "../lib/paypal.ts";
import { WEBHOOK_EVENTS } from "../lib/webhook.ts";

const base = (process.env.DEMO_URL ?? "").replace(/\/$/, "");
if (!base.startsWith("https://")) {
  console.error("Set DEMO_URL to the public https address of the demo. PayPal can't reach localhost.");
  process.exit(1);
}
const url = `${base}/api/paypal/webhook`;

const existing = await paypal<{ webhooks: { id: string; url: string }[] }>("GET", "/v1/notifications/webhooks");
const found = existing.webhooks.find((w) => w.url === url);
if (found) {
  console.log(`Already registered for ${url}\nPAYPAL_WEBHOOK_ID=${found.id}`);
  process.exit(0);
}

const created = await paypal<{ id: string }>("POST", "/v1/notifications/webhooks", { url, event_types: WEBHOOK_EVENTS.map((name) => ({ name })) });
console.log(`Registered ${WEBHOOK_EVENTS.length} events for ${url}\nPAYPAL_WEBHOOK_ID=${created.id}`);
