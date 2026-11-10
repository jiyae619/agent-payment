// The proof record is what a shopper shows PayPal or a store after a bad purchase. It only helps if
// an edited copy can be told apart from the one the server issued, and if it says plainly who can help.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogProduct } from "../lib/catalog.ts";
import type { Mandate } from "../lib/mandate.ts";
import { buildProof, fingerprint, proofIsIntact, sealProof, whoCovers } from "../lib/proof.ts";

process.env.APPROVAL_SECRET = "test-secret-that-is-at-least-32-characters-long";

const mandate: Mandate = {
  source_text: "3 bottles of dish soap, under $50",
  checkout: { line_items: [{ description: "dish soap", quantity: 3, source_phrase: "3 bottles of dish soap" }], allowed_merchants: [] },
  payment: { amount_range: { max: 50, currency: "USD", source_phrase: "under $50" }, budget: null, recurrence: "one_time", vault_id: "v" },
  exp: { at: "2026-11-09T00:00:00Z", source_phrase: null },
  match_mode: "minimum", ship_to: null,
  ext: { must_haves: [], conditions_of_sale: [], deliver_by: null, checkins: [], unmapped: [] },
};
const product: CatalogProduct = {
  id: "soap", title: "Liquid Dish Soap", brand: null, category: null, description: null, key_features: [], materials: [], attributes: {},
  sizes: [], image: null, price: 4.55, store: "grove.co", condition: null, in_stock: true, source: "channel3",
};
const policy = { store: "grove.co", topic: "returns" as const, text: "Return any item within 30 days.", url: "https://www.grove.co/x", retrieved: "2026-11-07" };

const proof = buildProof({
  id: "sa_test", mandate, approved_at: "2026-11-08T14:00:00Z", search: { source: "live", funnel: [], shortlist: [] }, product, quantity: 3, total: 13.65,
  reason: "Cheapest.", by: "ai", checks: [], policy, decision: { action: "capture", amount: 13.65 },
  paypal: { order_id: "O", authorization_id: "A", held: 13.65, capture_id: "C", captured: 13.65 }, events: [],
});

test("an untouched proof checks out", () => {
  assert.equal(proofIsIntact(proof, sealProof(proof)), true);
});

test("a proof edited to show a bigger approval no longer checks out", () => {
  const seal = sealProof(proof);
  const edited = structuredClone(proof);
  edited.instructions.payment.amount_range.max = 500;
  assert.equal(proofIsIntact(edited, seal), false);
});

test("the saved PayPal account's id never goes into the shareable file", () => {
  assert.ok(!JSON.stringify(proof).includes('"vault_id":"v"'));
  assert.equal(proof.instructions.payment.vault_id, "saved PayPal account (id withheld)");
});

test("the return policy is kept word for word with a fingerprint, so a later change to it shows", () => {
  assert.equal(proof.return_policy?.text, policy.text);
  assert.match(proof.return_policy?.sha256 ?? "", /^[0-9a-f]{64}$/);
});

test("who covers it: a charged purchase names Purchase Protection and what it doesn't cover", () => {
  const lines = whoCovers(true, true).join(" ");
  assert.match(lines, /Purchase Protection may cover/);
  assert.match(lines, /isn't what you wanted, Purchase Protection doesn't cover it/);
  assert.deepEqual(whoCovers(false, true), ["Nothing was charged, so there is nothing to claim."]);
});

test("the shareable file never holds the shopper's own words, only a fingerprint of them", () => {
  // The file goes to stores and PayPal; the request is the shopper's, so only they can reveal it.
  const text = JSON.stringify(proof);
  assert.ok(!text.includes("3 bottles of dish soap"), "request or a phrase from it leaked");
  assert.ok(!text.includes("under $50"), "a source phrase leaked");
  assert.equal(proof.request_sha256, fingerprint(mandate.source_text));
  // The rules themselves are still there, so the store can see what was approved.
  assert.equal(proof.instructions.payment.amount_range.max, 50);
});

test("the outcome says where the money ended up, separate from what enforcement decided at the hold", () => {
  assert.deepEqual(proof.outcome, { status: "charged", amount: 13.65 });
});
