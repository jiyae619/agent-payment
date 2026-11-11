// Run: npm test
// A webhook is only worth showing if PayPal really sent it. These tests stub fetch (no network):
// a missing or failed signature must never be trusted, a retried delivery must count once, and
// events must land on the order they belong to, so /verify can't show another shopper's charge.

import { test } from "node:test";
import assert from "node:assert/strict";
import { eventsFor, recordEvent, resetEvents, toEvent, verifyWebhook } from "../lib/webhook.ts";

process.env.PAYPAL_CLIENT_ID = "test-id";
process.env.PAYPAL_CLIENT_SECRET = "test-secret";

const SIGNED = new Headers({
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
  "paypal-transmission-id": "tx-1",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-11-10T12:00:00Z",
});

const capture = (id: string, orderId: string, proofId: string) => ({
  id, event_type: "PAYMENT.CAPTURE.COMPLETED", create_time: "2026-11-10T12:00:00Z",
  resource: { id: "CAP-1", status: "COMPLETED", amount: { value: "54.99" }, custom_id: proofId, supplementary_data: { related_ids: { order_id: orderId } } },
});

function stubVerify(status: string): { calls: number } {
  const seen = { calls: 0 };
  globalThis.fetch = (async (url: string) => {
    if (String(url).endsWith("/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
    seen.calls += 1;
    return new Response(JSON.stringify({ verification_status: status }));
  }) as typeof fetch;
  return seen;
}

test("an event PayPal didn't sign is rejected, so a forged POST can't make a purchase look paid", async () => {
  stubVerify("FAILURE");
  assert.equal(await verifyWebhook(SIGNED, capture("WH-1", "ORDER-1", "okp_1"), "HOOK-1"), false);
});

test("an event with no signature headers is rejected without asking PayPal", async () => {
  const seen = stubVerify("SUCCESS");
  assert.equal(await verifyWebhook(new Headers(), capture("WH-1", "ORDER-1", "okp_1"), "HOOK-1"), false);
  assert.equal(seen.calls, 0);
});

test("a signed event is accepted", async () => {
  stubVerify("SUCCESS");
  assert.equal(await verifyWebhook(SIGNED, capture("WH-1", "ORDER-1", "okp_1"), "HOOK-1"), true);
});

test("PayPal's retried delivery of the same event counts once", () => {
  resetEvents();
  const e = toEvent(capture("WH-2", "ORDER-2", "okp_2"));
  assert.equal(recordEvent(e), true);
  assert.equal(recordEvent(e), false);
  assert.equal(eventsFor("ORDER-2", null).length, 1);
});

test("events attach to their own order and proof only", () => {
  resetEvents();
  recordEvent(toEvent(capture("WH-3", "ORDER-3", "okp_3")));
  recordEvent(toEvent(capture("WH-4", "ORDER-4", "okp_4")));
  assert.deepEqual(eventsFor("ORDER-3", null).map((e) => e.id), ["WH-3"]);
  assert.deepEqual(eventsFor(null, "okp_4").map((e) => e.id), ["WH-4"]);
  assert.equal(eventsFor("ORDER-9", "okp_9").length, 0);
  const e = eventsFor("ORDER-3", null)[0];
  assert.equal(e.amount, 54.99);
  assert.equal(e.status, "COMPLETED");
});
