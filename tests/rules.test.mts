// Run: npm test
// These rules are what stop a wrong or over-generous draft from reaching the shopper unnoticed.
// Each test states the shopper-facing reason the rule exists.

import { test } from "node:test";
import assert from "node:assert/strict";
import { amountsSaid } from "../lib/amounts.ts";
import { normalizeDraft, type Draft } from "../lib/draft-schema.ts";
import { applyFix, findWarnings } from "../lib/warnings.ts";
import { readbackRows } from "../lib/readback.ts";

const NOW = new Date("2026-11-06T17:00:00Z");

// A draft as Claude might return it for: "running shoes size 8 waterproof under 120. free returns pls. ask me if its over 100"
const shoesText = "running shoes size 8 waterproof under 120. free returns pls. ask me if its over 100";
function shoesDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }],
    stores: [],
    any_store_ok_phrase: null,
    max_total: { amount: 120, source_phrase: "under 120" },
    budget_total: null,
    recurrence: "one_time",
    valid_for_hours: { hours: null, source_phrase: null },
    exact_item_only: { value: false, source_phrase: null },
    ship_to: null,
    must_haves: [
      { attr: "size", value: "8", source_phrase: "size 8" },
      { attr: "waterproof", value: "yes", source_phrase: "waterproof" },
    ],
    conditions_of_sale: [{ attr: "free returns", value: "yes", source_phrase: "free returns pls" }],
    deliver_by: null,
    checkins: [{ type: "over_amount", amount: 100, source_phrase: "ask me if its over 100" }],
    unmapped: [],
    ...overrides,
  };
}
const ids = (text: string, d: Draft) => findWarnings(normalizeDraft(d, text, NOW), NOW).map((w) => w.id).sort();

test("amounts: sizes, counts and pack sizes are never mistaken for money", () => {
  assert.deepEqual(amountsSaid("running shoes size 8 waterproof under 120. ask me if its over 100"), [120, 100]);
  assert.deepEqual(amountsSaid("Dish soap for the shop, 3 bottles, only from Costco, $25 total."), [25]);
  assert.deepEqual(amountsSaid("Laundry Detergent Pods - 30 Pods"), []);
  assert.deepEqual(amountsSaid("runing shoes sz 8 womens, waterprof, $100ish"), [100]);
  assert.deepEqual(amountsSaid("cheapest decent running shoes size 11, like under 70 bucks"), [70]);
  assert.deepEqual(amountsSaid("around $100 but no more than $110"), [100, 110]);
});

test("a draft that matches the shopper's words raises only the store question", () => {
  assert.deepEqual(ids(shoesText, shoesDraft()), ["any_store"]);
});

test("a draft that allows more than the shopper said is caught, and the fix restores their number", () => {
  const m = normalizeDraft(shoesDraft({ max_total: { amount: 150, source_phrase: "under 120" } }), shoesText, NOW);
  const w = findWarnings(m, NOW).find((x) => x.id === "amount_mismatch");
  assert.ok(w, "a $150 limit on a request that said 120 must be flagged");
  assert.match(w.message, /You said \$120, but this allows \$150/);
  const fixed = applyFix(m, w.fix!.action);
  assert.equal(fixed.payment.amount_range.max, 120);
  assert.equal(findWarnings(fixed, NOW).some((x) => x.id === "amount_mismatch"), false);
});

test("a price limit the shopper never gave is flagged, so the AI can't invent one", () => {
  const text = "I need new shoes for running, not too expensive";
  const d = shoesDraft({ max_total: { amount: 80, source_phrase: null }, checkins: [], must_haves: [], conditions_of_sale: [] });
  assert.ok(ids(text, d).includes("amount_mismatch"));
});

test("no amount at all is flagged, and the fix makes it show the price before paying", () => {
  const text = "I ran out of dish soap";
  const m = normalizeDraft(shoesDraft({ max_total: { amount: null, source_phrase: null }, checkins: [] }), text, NOW);
  const w = findWarnings(m, NOW).find((x) => x.id === "no_amount");
  assert.ok(w);
  const fixed = applyFix(m, w.fix!.action);
  assert.ok(fixed.ext.checkins.some((c) => c.type === "over_amount" && c.value === 0));
});

test("a check-in amount the shopper didn't say is flagged", () => {
  assert.ok(ids(shoesText, shoesDraft({ checkins: [{ type: "over_amount", amount: 110, source_phrase: null }] })).includes("checkin_mismatch"));
});

test("an empty product list (the gift-card hole) is flagged", () => {
  assert.ok(ids(shoesText, shoesDraft({ line_items: [] })).includes("any_product"));
});

test("a one-time purchase that stays open for days is flagged, and the fix shortens it to 1 day", () => {
  const m = normalizeDraft(shoesDraft({ valid_for_hours: { hours: 24 * 30, source_phrase: null } }), shoesText, NOW);
  const w = findWarnings(m, NOW).find((x) => x.id === "long_expiry");
  assert.ok(w);
  assert.equal(findWarnings(applyFix(m, w.fix!.action)).some((x) => x.id === "long_expiry"), false);
});

test("repeat purchases with no total limit are flagged", () => {
  const text = "Buy the usual laundry pods for my dad every month, $25 each time.";
  const d = shoesDraft({ recurrence: "monthly", max_total: { amount: 25, source_phrase: "$25 each time" }, checkins: [] });
  const m = normalizeDraft(d, text, NOW);
  const w = findWarnings(m, NOW).find((x) => x.id === "recurring_no_budget");
  assert.ok(w);
  assert.equal(applyFix(m, w.fix!.action).payment.budget, 75);
});

test("a store the shopper never mentioned is flagged", () => {
  const d = shoesDraft({ stores: [{ domain: "rewards-hub.example", source_phrase: null }] });
  assert.ok(ids(shoesText, d).includes("store_not_named"));
  const named = shoesDraft({ stores: [{ domain: "rei.com", source_phrase: "REI" }] });
  assert.equal(ids("shoes from REI only, under 120", named).includes("store_not_named"), false);
});

test("safe defaults: it asks before substitutes and unnamed stores unless the shopper said otherwise", () => {
  const m = normalizeDraft(shoesDraft(), shoesText, NOW);
  assert.deepEqual(m.ext.checkins.map((c) => c.type).sort(), ["new_store", "over_amount", "substitute"]);
  const anyStore = normalizeDraft(shoesDraft({ any_store_ok_phrase: "any store is fine" }), shoesText, NOW);
  assert.equal(anyStore.ext.checkins.some((c) => c.type === "new_store"), false);
  assert.equal(findWarnings(anyStore, NOW).some((w) => w.id === "any_store"), false);
});

test("the model can never set the payment account; the app owns it", () => {
  assert.equal(normalizeDraft(shoesDraft(), shoesText, NOW).payment.vault_id, null);
});

test("readback: every limit shows the shopper's own words, and the price limit is the PayPal-locked one", () => {
  const rows = readbackRows(normalizeDraft(shoesDraft(), shoesText, NOW));
  const price = rows.find((r) => r.willDo.startsWith("Spend no more than $120"));
  assert.equal(price?.label, "locked");
  assert.equal(price?.said, "under 120");
  assert.ok(rows.some((r) => r.willDo === "Ask you before paying more than $100" && r.label === "asks"));
  assert.ok(rows.some((r) => r.willDo === "Only buy if the store offers free returns" && r.label === "checked"));
  assert.equal(rows.filter((r) => r.label === "locked").length, 1, "only the price is locked by PayPal; nothing else may claim that");
});
