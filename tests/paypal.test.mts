// Run: npm test
// PayPal only refuses to repeat a request when it sees the same PayPal-Request-Id again.
// These tests stub fetch (no network) and check the id our client actually sends.

import { test } from "node:test";
import assert from "node:assert/strict";
import { paypal, stepRequestId } from "../lib/paypal.ts";

process.env.PAYPAL_CLIENT_ID = "test-id";
process.env.PAYPAL_CLIENT_SECRET = "test-secret";

// Records the PayPal-Request-Id of every non-token call.
function stubFetch(): string[] {
  const sent: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    if (String(url).endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
    }
    sent.push((init.headers as Record<string, string>)["PayPal-Request-Id"]);
    return new Response(JSON.stringify({ id: "CAPTURE-1", status: "COMPLETED" }));
  }) as typeof fetch;
  return sent;
}

test("retrying a charge sends the same request id, so PayPal can't charge the shopper twice", async () => {
  const sent = stubFetch();
  const capture = () =>
    paypal("POST", "/v2/payments/authorizations/AUTH-1/capture", { final_capture: true }, {
      requestId: stepRequestId("AUTH-1", "capture"),
    });

  await capture();
  await capture(); // e.g. our code retrying after a timeout

  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1]);
});

test("charging and releasing the same hold use different ids, so one never replays the other", async () => {
  const sent = stubFetch();
  await paypal("POST", "/v2/payments/authorizations/AUTH-1/capture", {}, { requestId: stepRequestId("AUTH-1", "capture") });
  await paypal("POST", "/v2/payments/authorizations/AUTH-1/void", {}, { requestId: stepRequestId("AUTH-1", "void") });
  await paypal("POST", "/v2/payments/authorizations/AUTH-2/capture", {}, { requestId: stepRequestId("AUTH-2", "capture") });

  assert.equal(new Set(sent).size, 3);
});

test("PayPal accepts the id: at most 108 characters", () => {
  // Authorization ids are ~17 characters; this leaves room for longer resource ids.
  assert.ok(stepRequestId("X".repeat(90), "vault-token").length <= 108);
});
