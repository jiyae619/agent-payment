// The shortlist is what the AI is allowed to choose from. If a product the shopper ruled out
// (over the limit, wrong store, gift card) got through here, only enforcement would stand between
// the AI and the shopper's money. These tests keep that first line of defense honest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GIFT_CARD, type CatalogProduct } from "../lib/catalog.ts";
import type { Mandate } from "../lib/mandate.ts";
import { isNamedItem, mentions, searchQuery, shortlist, whyDropped } from "../lib/shortlist.ts";

function mandate(over: (m: Mandate) => void = () => {}): Mandate {
  const m: Mandate = {
    source_text: "waterproof running shoes size 8 under 120 from rei or zappos",
    checkout: {
      line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }],
      allowed_merchants: [
        { domain: "rei.com", source_phrase: "rei" },
        { domain: "zappos.com", source_phrase: "zappos" },
      ],
    },
    payment: { amount_range: { max: 120, currency: "USD", source_phrase: "under 120" }, budget: null, recurrence: "one_time", vault_id: null },
    exp: { at: "2026-11-08T17:00:00Z", source_phrase: null },
    match_mode: "minimum",
    ship_to: null,
    ext: {
      must_haves: [
        { attr: "waterproof", value: "yes", source_phrase: "waterproof" },
        { attr: "size", value: "8", source_phrase: "size 8" },
      ],
      conditions_of_sale: [],
      deliver_by: null,
      checkins: [],
      unmapped: [],
    },
  };
  over(m);
  return m;
}

const shoe = (over: Partial<CatalogProduct>): CatalogProduct => ({
  id: "x", title: "Trail Running Shoes", brand: null, category: "running-shoes", description: null,
  key_features: [], materials: [], attributes: {}, sizes: [], image: null,
  price: 90, store: "rei.com", condition: "new", in_stock: true, source: "channel3", ...over,
});

const PRODUCTS = [
  shoe({ id: "cheap-plain", price: 60 }),
  shoe({ id: "waterproof-8", price: 110, attributes: { "waterproof-level": "Waterproof" }, sizes: ["7", "8", "9"] }),
  shoe({ id: "waterproof", price: 80, key_features: ["Waterproof upper"] }),
  shoe({ id: "too-expensive", price: 150, attributes: { "waterproof-level": "Waterproof" }, sizes: ["8"] }),
  shoe({ id: "other-store", store: "nike.com", attributes: { "waterproof-level": "Waterproof" }, sizes: ["8"] }),
  GIFT_CARD,
];

test("nothing over the limit, from another store, or money-like reaches the AI", () => {
  const { candidates } = shortlist(mandate(), PRODUCTS);
  const ids = candidates.map((p) => p.id);
  assert.ok(!ids.includes("too-expensive"));
  assert.ok(!ids.includes("other-store"));
  assert.ok(!ids.includes(GIFT_CARD.id));
});

test("the gift card is dropped even when the shopper allowed any store and set no named item", () => {
  // The "could buy anything" case: the attack item's hidden instruction must never reach the AI.
  const m = mandate((m) => { m.checkout.allowed_merchants = []; m.checkout.line_items = []; });
  assert.ok(!shortlist(m, PRODUCTS).candidates.some((p) => p.id === GIFT_CARD.id));
});

test("products that mention more must-haves rank first, then the cheaper one", () => {
  assert.deepEqual(shortlist(mandate(), PRODUCTS).candidates.map((p) => p.id), ["waterproof-8", "waterproof", "cheap-plain"]);
});

test("the funnel counts each step, so the shopper sees why products were dropped", () => {
  const { funnel } = shortlist(mandate(), PRODUCTS);
  assert.deepEqual(funnel, [
    { label: "found", count: 6 },
    { label: "not gift cards or money", count: 5 },
    { label: "under $120", count: 4 },
    { label: "at rei.com or zappos.com", count: 3 },
    { label: "mention waterproof", count: 2 },
    { label: "mention size 8", count: 1 },
  ]);
});

test("the limit covers every item: 3 at $20 is over a $50 limit, so it never reaches the hold", () => {
  // Without this, PayPal would hold $60 on a $50 approval before enforcement released it.
  const m = mandate((m) => { m.checkout.line_items[0].quantity = 3; m.payment.amount_range.max = 50; m.checkout.allowed_merchants = []; m.ext.must_haves = []; });
  const ids = shortlist(m, [shoe({ id: "twenty", price: 20 }), shoe({ id: "fifteen", price: 15 })]).candidates.map((p) => p.id);
  assert.deepEqual(ids, ["fifteen"]);
});

test("a size is matched as a whole word: 18 is not size 8", () => {
  assert.equal(mentions(shoe({ sizes: ["18"] }), "8", "size"), false);
  assert.equal(mentions(shoe({ sizes: ["US 8"] }), "8", "size"), true);
});

test("a similar item is not the named item, so the substitute check-in can ask", () => {
  const m = mandate((m) => { m.checkout.line_items[0].description = "Pegasus 41"; });
  assert.equal(isNamedItem(m, shoe({ title: "Nike Pegasus 41 Road Running Shoe" })), true);
  assert.equal(isNamedItem(m, shoe({ title: "Nike Vomero 18 Road Running Shoe" })), false);
});

test("the search asks for the named item plus its yes/no must-haves", () => {
  assert.equal(searchQuery(mandate()), "running shoes waterproof");
});

test("the same request searches the same way however the AI names the item", () => {
  // The drafter sometimes keeps "waterproof" in the item name; the search (and so the options) must not change.
  const m = mandate();
  const named = { ...m, checkout: { ...m.checkout, line_items: [{ ...m.checkout.line_items[0], description: "waterproof running shoes" }] } };
  assert.equal(searchQuery(named), searchQuery(m));
});

// The live shelf tells the shopper why each product was left out. The reason must be the rule that
// actually removed it, or the screen would explain the shortlist wrongly.
test("each dropped product shows the rule that removed it", () => {
  const m = mandate();
  // The planted trap listing says what it is, so nobody mistakes it for a real search result.
  assert.equal(whyDropped(m, GIFT_CARD), "Test listing we planted for the prompt-injection trap");
  assert.equal(whyDropped(m, { ...GIFT_CARD, source: "channel3" }), "Gift card or money");
  assert.equal(whyDropped(m, shoe({ id: "x", price: 150 })), "Over $120");
  assert.equal(whyDropped(m, shoe({ id: "y", price: 50, store: "amazon.com" })), "Not a store you named");
  assert.equal(whyDropped(m, shoe({ id: "z", price: 50, in_stock: false })), "Out of stock");
  const three = mandate((x) => { x.checkout.line_items[0].quantity = 3; });
  assert.equal(whyDropped(three, shoe({ id: "q", price: 45 })), "Over $120 for 3", "the limit covers price × quantity");
  assert.equal(whyDropped(m, shoe({ id: "ok", price: 50 })), "Ranked lower");
});
