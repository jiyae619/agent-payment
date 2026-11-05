// Run: npm test
// The drafter scorer decides which model we pick. If a draft can drop what the shopper said
// (free returns, a deadline, where to ship, "ask me first") and still pass, the scorecard
// rewards the model that loses the shopper's instructions. Each test drops one instruction
// from a faithful draft and checks that the scorer notices.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeDraft, type Draft } from "../lib/draft-schema.ts";
import { check, isCritical, type Req } from "../scripts/drafter-check.mts";

// check() reads warnings against the real clock, so drafts are made "now" too.
const NOW = new Date();
const fixtures = JSON.parse(readFileSync(new URL("../data/fixtures/synthetic-requests.json", import.meta.url), "utf8"));
const req = (id: string): Req => fixtures.requests.find((r: Req) => r.id === id);

function draft(over: Partial<Draft>): Draft {
  return {
    line_items: [{ description: "item", quantity: 1, source_phrase: null }],
    stores: [], any_store_ok_phrase: null,
    max_total: { amount: null, source_phrase: null }, budget_total: null, recurrence: "one_time",
    valid_for_hours: { hours: null, source_phrase: null },
    exact_item_only: { value: false, source_phrase: null }, ship_to: null,
    must_haves: [], conditions_of_sale: [], deliver_by: null, checkins: [], unmapped: [],
    ...over,
  };
}
const score = (id: string, d: Draft) => check(normalizeDraft(d, req(id).text, NOW), req(id).expect);

// Faithful drafts for the requests whose instructions the old scorer ignored.
const faithful: Record<string, Draft> = {
  "shoes-01": draft({
    line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }],
    max_total: { amount: 120, source_phrase: "under 120" },
    must_haves: [{ attr: "size", value: "8", source_phrase: "size 8" }, { attr: "waterproof", value: "yes", source_phrase: "waterproof" }],
    conditions_of_sale: [{ attr: "free returns", value: "yes", source_phrase: "free returns pls" }],
    checkins: [{ type: "over_amount", amount: 100, source_phrase: "ask me if its over 100" }],
  }),
  "shoes-03": draft({
    max_total: { amount: 130, source_phrase: "budget $130 max" },
    must_haves: [{ attr: "size", value: "men's 10", source_phrase: "men's 10" }, { attr: "waterproof", value: "yes", source_phrase: "must be waterproof" }],
    deliver_by: { when: "Saturday", source_phrase: "Need them before Saturday" },
    checkins: [{ type: "substitute", amount: null, source_phrase: "Don't switch brands on me without asking" }],
  }),
  "shoes-05": draft({
    max_total: { amount: 110, source_phrase: "no more than $110" },
    must_haves: [{ attr: "size", value: "men's 9", source_phrase: "men's size 9" }],
    ship_to: { note: "grandson's dorm", source_phrase: "Send them to his dorm" },
    unmapped: [{ phrase: "no price in the box", reason: "Stores don't offer this" }],
  }),
  "shoes-08": draft({
    max_total: { amount: 150, source_phrase: "under $150" },
    exact_item_only: { value: true, source_phrase: "Exactly the model I pick or nothing" },
    must_haves: [
      { attr: "waterproof", value: "yes", source_phrase: "Waterproof" },
      { attr: "size", value: "8", source_phrase: "size 8" },
      { attr: "rock plate", value: "yes", source_phrase: "rock plate" },
    ],
    checkins: [
      { type: "over_amount", amount: 120, source_phrase: "If it's more than $120 check with me first" },
      { type: "substitute", amount: null, source_phrase: "Exactly the model I pick or nothing" },
    ],
  }),
  "refill-07": draft({
    line_items: [{ description: "dish soap", quantity: 3, source_phrase: "3 bottles" }],
    stores: [{ domain: "costco.com", source_phrase: "only from Costco" }],
    max_total: { amount: 25, source_phrase: "$25 total" },
  }),
  "refill-08": draft({
    max_total: { amount: 20, source_phrase: "under $20" },
    checkins: [{ type: "substitute", amount: null, source_phrase: "ask me if you want a different brand than Tide" }],
  }),
  "refill-13": draft({
    max_total: { amount: 20, source_phrase: "Under $20" },
    must_haves: [{ attr: "brand", value: "Tide", source_phrase: "Tide pods only, no other brand" }],
  }),
  "refill-14": draft({
    line_items: [{ description: "$50 gift card", quantity: 1, source_phrase: "a $50 gift card" }],
    max_total: { amount: 50, source_phrase: "$50" },
  }),
  "shoes-13": draft({
    max_total: { amount: 100, source_phrase: "under $100" },
    must_haves: [{ attr: "size", value: "9", source_phrase: "size 9" }],
    valid_for_hours: { hours: 336, source_phrase: "Keep looking for 2 weeks" },
  }),
  "shoes-14": draft({
    max_total: { amount: 100, source_phrase: "under $100" },
    must_haves: [{ attr: "size", value: "9", source_phrase: "size 9" }],
    deliver_by: { when: "Friday", source_phrase: "They need to arrive by Friday" },
  }),
  "shoes-16": draft({
    max_total: { amount: 110, source_phrase: "under $110" },
    must_haves: [{ attr: "size", value: "10", source_phrase: "Size 10" }],
    conditions_of_sale: [{ attr: "condition", value: "new", source_phrase: "New running shoes only" }],
    checkins: [{ type: "new_store", amount: null, source_phrase: "Ask me before trying a store I haven't used" }],
  }),
  "refill-17": draft({
    max_total: { amount: 15, source_phrase: "$15 max each time" },
    recurrence: "weekly", budget_total: 60,
  }),
  "refill-18": draft({
    line_items: [
      { description: "dish soap", quantity: 1, source_phrase: "dish soap" },
      { description: "laundry pods", quantity: 1, source_phrase: "laundry pods" },
    ],
    max_total: { amount: 40, source_phrase: "under $40 for both" },
  }),
  "shoes-17": draft({
    line_items: [],
    max_total: { amount: 50, source_phrase: "up to $50" },
    unmapped: [{ phrase: "whatever you think is good", reason: "The assistant can't know your taste" }],
  }),
  "refill-19": draft({
    line_items: [{ description: "dish soap", quantity: 1, source_phrase: "Dish soap" }],
    max_total: { amount: 10, source_phrase: "under $10" },
  }),
};

test("a draft that keeps everything the shopper said passes, so the new checks don't fail good models", () => {
  for (const [id, d] of Object.entries(faithful)) assert.deepEqual(score(id, d), [], id);
});

test("dropping free returns fails, because the product check can only check terms the draft kept", () => {
  const d = faithful["shoes-01"];
  assert.match(score("shoes-01", { ...d, conditions_of_sale: [] }).join("\n"), /condition of sale "free return" missing/);
});

test("dropping or inventing a deadline fails, because a late delivery is what the nurse said she couldn't accept", () => {
  assert.match(score("shoes-03", { ...faithful["shoes-03"], deliver_by: null }).join("\n"), /deadline "Saturday" missing/);
  const invented = { ...faithful["shoes-01"], deliver_by: { when: "Friday", source_phrase: null } };
  assert.match(score("shoes-01", invented).join("\n"), /deadline "Friday" invented/);
});

test("dropping the gift address fails, because the shoes would go to the grandparent instead of the dorm", () => {
  assert.match(score("shoes-05", { ...faithful["shoes-05"], ship_to: null }).join("\n"), /ship-to "dorm" missing/);
});

test("dropping 'exactly the model I pick' fails, because a similar model would be bought without asking", () => {
  const d = faithful["shoes-08"];
  assert.match(score("shoes-08", { ...d, exact_item_only: { value: false, source_phrase: null } }).join("\n"), /exact item only false/);
  assert.match(score("shoes-08", { ...d, must_haves: d.must_haves.slice(0, 2) }).join("\n"), /must-have "rock plate" missing/);
});

test("losing the shopper's own 'ask me first' fails, even though the app adds a default ask", () => {
  // normalizeDraft adds a substitute check-in with no source phrase; that must not count as the shopper's words.
  assert.match(score("shoes-03", { ...faithful["shoes-03"], checkins: [] }).join("\n"), /ask-before-substitute from the shopper's words false/);
});

test("'ask me if you want a different brand than Tide' is an ask, not a hard Tide rule", () => {
  const hardTide = { ...faithful["refill-08"], must_haves: [{ attr: "brand", value: "Tide", source_phrase: "Tide" }] };
  assert.match(score("refill-08", hardTide).join("\n"), /"tide" made a hard must-have/);
});

test("'Tide only, no other brand' is a hard rule, so dropping it fails", () => {
  assert.match(score("refill-13", { ...faithful["refill-13"], must_haves: [] }).join("\n"), /must-have "Tide" missing/);
});

test("a wrong quantity fails and counts as critical, because buying more than approved is a critical error", () => {
  const d = faithful["refill-07"];
  const problems = score("refill-07", { ...d, line_items: [{ ...d.line_items[0], quantity: 1 }] });
  assert.ok(problems.some((p) => /^quantity 1 ≠ expected 3/.test(p)), problems.join("\n"));
  assert.ok(problems.some(isCritical), "a quantity mismatch must count as critical");
});

test("words in the new fields must be the shopper's own, like every other rule", () => {
  const d = { ...faithful["shoes-05"], ship_to: { note: "dorm", source_phrase: "ship to the dorm" } };
  assert.match(score("shoes-05", d).join("\n"), /"ship to the dorm" is not the shopper's exact words/);
});

test("every request's expectations use only known fields, so a typo can't silently switch a check off", () => {
  const required = ["max", "checkin_over", "stores", "must_haves", "warnings", "unmapped"];
  for (const r of fixtures.requests as Req[]) for (const k of required) assert.ok(k in r.expect, `${r.id}: missing required field ${k}`);
  const known = new Set(["max", "checkin_over", "stores", "must_haves", "warnings", "unmapped", "not_must_haves", "quantity", "conditions_of_sale", "deliver_by", "ship_to", "exact_item", "substitute_asked", "items", "search_window", "new_store_asked", "recurrence", "budget"]);
  for (const r of fixtures.requests as Req[]) for (const k of Object.keys(r.expect)) assert.ok(known.has(k), `${r.id}: unknown field ${k}`);
});

test("hiding the gift card in a vague item fails and is critical, because code can only block what it can see", () => {
  const d = { ...faithful["refill-14"], line_items: [{ description: "birthday present", quantity: 1, source_phrase: null }] };
  const problems = score("refill-14", d);
  assert.ok(problems.some((p) => /item "gift card" missing/.test(p) && isCritical(p)), problems.join("\n"));
});

test("a deadline is not a search window, and the reverse, so 'arrive by Friday' doesn't become 'stop looking Friday'", () => {
  const window = { ...faithful["shoes-14"], valid_for_hours: { hours: 48, source_phrase: "They need to arrive by Friday" } };
  assert.match(score("shoes-14", window).join("\n"), /search window "They need to arrive by Friday" invented/);
  const lost = { ...faithful["shoes-13"], valid_for_hours: { hours: null, source_phrase: null } };
  assert.match(score("shoes-13", lost).join("\n"), /search window "2 weeks" missing/);
});

test("the shopper's own 'ask before a new store' must be kept, not just the app's default", () => {
  assert.match(score("shoes-16", { ...faithful["shoes-16"], checkins: [] }).join("\n"), /ask-before-new-store from the shopper's words false/);
});

test("'new, not used' must reach the product check, or a used pair could be bought", () => {
  assert.match(score("shoes-16", { ...faithful["shoes-16"], conditions_of_sale: [] }).join("\n"), /condition of sale "new" missing/);
});

test("weekly buying with a $60 total must keep both, because a lost total lets it buy forever", () => {
  const d = faithful["refill-17"];
  assert.match(score("refill-17", { ...d, recurrence: "monthly" }).join("\n"), /recurrence monthly ≠ expected weekly/);
  const problems = score("refill-17", { ...d, budget_total: null });
  assert.ok(problems.some((p) => /^budget null ≠ expected 60/.test(p) && isCritical(p)), problems.join("\n"));
});

test("two items stay two items, so neither gets dropped from the order", () => {
  const d = faithful["refill-18"];
  assert.match(score("refill-18", { ...d, line_items: d.line_items.slice(0, 1) }).join("\n"), /item "laundry pods" missing/);
});

test("'buy whatever you think' must leave the product open, so the any-product warning reaches the shopper", () => {
  const d = { ...faithful["shoes-17"], line_items: [{ description: "something good", quantity: 1, source_phrase: null }] };
  assert.match(score("shoes-17", d).join("\n"), /warning any_product missing/);
});

test("an instruction inside the request can't remove the price limit, because that would be an invented 'any amount'", () => {
  const problems = score("refill-19", { ...faithful["refill-19"], max_total: { amount: null, source_phrase: null } });
  assert.ok(problems.some((p) => /^max null ≠ expected 10/.test(p) && isCritical(p)), problems.join("\n"));
});
