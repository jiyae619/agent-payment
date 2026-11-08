// Suggestions turn the shopper's own history into one-tap changes. They must never apply
// themselves, must say where they came from, must put tightening first, and must never loosen a
// limit past what the shopper already allows. A store they chose to leave out must stay out.

import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../lib/enforce.ts";
import type { HistoryEntry } from "../lib/history.ts";
import type { Mandate } from "../lib/mandate.ts";
import { shortlist } from "../lib/shortlist.ts";
import { suggest } from "../lib/suggest.ts";
import { applyFix } from "../lib/warnings.ts";

function mandate(over: (m: Mandate) => void = () => {}): Mandate {
  const m: Mandate = {
    source_text: "running shoes under $150, ask me if it's over $100",
    checkout: { line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }], allowed_merchants: [] },
    payment: { amount_range: { max: 150, currency: "USD", source_phrase: "under $150" }, budget: null, recurrence: "one_time", vault_id: null },
    exp: { at: "2026-11-09T00:00:00Z", source_phrase: null },
    match_mode: "minimum", ship_to: null,
    ext: { must_haves: [], conditions_of_sale: [], deliver_by: null, checkins: [{ type: "over_amount", value: 100, source_phrase: null }], unmapped: [] },
  };
  over(m);
  return m;
}
const past = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: Math.random().toString(36), at: "2026-11-08T18:00:00Z", request: "", item: "waterproof running shoes", product: "Trail Runner",
  store: "shop.example.com", amount: 110, outcome: "bought", ...over,
});

test("no history, no suggestions", () => {
  assert.deepEqual(suggest(mandate(), []), []);
});

test("a store with a wrong item is suggested for leaving out, with where it came from", () => {
  const [s] = suggest(mandate(), [past({ store: "bad.example.com", rating: "wrong_item", product: "Beyondfeel Shoe" })]);
  assert.equal(s.kind, "tighten");
  assert.match(s.message, /wrong item from bad\.example\.com\. Leave it out\?/);
  assert.match(s.source, /Beyondfeel Shoe, bad\.example\.com/);
  assert.deepEqual(s.fix, { type: "avoid_store", domain: "bad.example.com" });
});

test("a suggestion is only a proposal: the mandate is unchanged until the shopper taps it", () => {
  const m = mandate();
  suggest(m, [past({ rating: "wrong_item" })]);
  assert.equal(m.checkout.avoid_merchants, undefined);
});

test("once left out, that store is dropped before shopping and refused at payment", () => {
  const m = applyFix(mandate(), { type: "avoid_store", domain: "bad.example.com" });
  const shoe = { id: "x", title: "Running Shoes", brand: null, category: null, description: null, key_features: [], materials: [], attributes: {}, sizes: [], image: null, price: 90, store: "bad.example.com", condition: null, in_stock: true, source: "channel3" as const };
  assert.equal(shortlist(m, [shoe]).candidates.length, 0);
  const d = decide(m, { product: shoe, quantity: 1, total: 90, checks: [], is_substitute: false }, { now: new Date("2026-11-08T20:00:00Z"), held: 90 });
  assert.ok(d.action === "void" && d.reasons.some((r) => r.rule === "store_avoided"));
  assert.deepEqual(suggest(m, [past({ store: "bad.example.com", rating: "wrong_item" })]), [], "not suggested again");
});

test("too expensive before: suggest a lower limit below that price", () => {
  const [s] = suggest(mandate(), [past({ outcome: "refused", reason: "too_expensive", amount: 99 })]);
  assert.deepEqual(s.fix, { type: "set_max", value: 95 });
  assert.equal(s.kind, "tighten");
});

test("saying yes above the ask-first twice suggests raising it, but never past the spending limit", () => {
  const yes = [past({ asked_because: ["over_amount"], amount: 112 }), past({ asked_because: ["over_amount"], amount: 118 })];
  const [s] = suggest(mandate(), yes);
  assert.equal(s.kind, "loosen");
  assert.deepEqual(s.fix, { type: "set_checkin_amount", value: 120 });
  assert.deepEqual(suggest(mandate((m) => { m.payment.amount_range.max = 115; }), yes), [], "120 would pass the $115 limit");
  assert.deepEqual(suggest(mandate(), yes.slice(0, 1)), [], "once is not a pattern");
});

test("tightening suggestions come before loosening ones", () => {
  const list = suggest(mandate(), [
    past({ asked_because: ["over_amount"], amount: 112 }), past({ asked_because: ["over_amount"], amount: 118 }),
    past({ store: "bad.example.com", rating: "not_delivered" }),
  ]);
  assert.deepEqual(list.map((s) => s.kind), ["tighten", "loosen"]);
});

test("a past purchase of something unrelated doesn't change limits for this one", () => {
  const soap = [past({ item: "dish soap", asked_because: ["over_amount"], amount: 112 }), past({ item: "dish soap", asked_because: ["over_amount"], amount: 118 })];
  assert.deepEqual(suggest(mandate(), soap), []);
});
