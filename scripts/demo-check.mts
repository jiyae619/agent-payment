// Is the public demo ready for judges? Checks every outside service the demo needs, without
// printing any secret. Run before submitting and again before judging starts (Dec 1):
//   npm run demo-check                 # uses .env.local
//   DEMO_URL=https://... npm run demo-check
// Spends nothing: PayPal and Anthropic are read-only calls, Channel3 is one search.
import { paypal } from "../lib/paypal.ts";
import { searchProducts } from "../lib/search.ts";

const DEMO_URL = process.env.DEMO_URL ?? "https://shopping-assistant-z5u2.onrender.com/";
type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const check = async (name: string, run: () => Promise<string>) => {
  try { results.push({ name, ok: true, detail: await run() }); }
  catch (err) { results.push({ name, ok: false, detail: (err as Error).message.slice(0, 160) }); }
};
const need = (key: string) => { if (!process.env[key]) throw new Error(`${key} is not set`); return process.env[key] as string; };

await check("Environment", async () => {
  const keys = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_DEMO_VAULT_ID", "CHANNEL3_API_KEY", "ANTHROPIC_API_KEY", "APPROVAL_SECRET"];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
  return `${keys.length} keys set (values not shown)`;
});

await check("PayPal sandbox login", async () => {
  need("PAYPAL_CLIENT_ID");
  await paypal("GET", "/v1/notifications/webhooks-event-types");
  return "client id and secret work";
});

// The demo account button depends on this saved account still existing.
await check("Demo PayPal account", async () => {
  const id = need("PAYPAL_DEMO_VAULT_ID");
  const token = await paypal<{ id: string }>("GET", `/v3/vault/payment-tokens/${encodeURIComponent(id)}`);
  return `saved account ${token.id.slice(0, 4)}… still valid`;
});

await check("Channel3 search", async () => {
  need("CHANNEL3_API_KEY");
  const r = await searchProducts("waterproof running shoes", { maxPrice: 120 });
  if (r.source !== "live") throw new Error(`fell back to the snapshot: ${r.fallback_reason ?? "unknown reason"}`);
  return `${r.products.length - 1} live listings (plus the trap gift card)`;
});

await check("Anthropic key", async () => {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": need("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return "key accepted";
});

await check("Webhook id (optional)", async () => {
  if (!process.env.PAYPAL_WEBHOOK_ID) return "not set: webhooks are off, the app still reads orders back";
  const hooks = await paypal<{ webhooks: { id: string; url: string }[] }>("GET", "/v1/notifications/webhooks");
  const hook = hooks.webhooks.find((h) => h.id === process.env.PAYPAL_WEBHOOK_ID);
  if (!hook) throw new Error("PAYPAL_WEBHOOK_ID isn't registered on this PayPal app");
  return `registered for ${hook.url}`;
});

await check("Live demo", async () => {
  const started = Date.now();
  const res = await fetch(DEMO_URL, { signal: AbortSignal.timeout(90_000) });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`HTTP ${res.status} after ${secs}s`);
  return `HTTP ${res.status} in ${secs}s${Number(secs) > 10 ? " (slow: it was probably asleep)" : ""}`;
});

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(22)} ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed. Fix these before judges arrive.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
