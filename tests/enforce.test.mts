// Run: npm test
// The enforcement service is the only thing that decides whether PayPal takes the held money.
// One test per rule, each saying what would go wrong for the shopper without it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, type Context, type Decision, type Proposal } from "../lib/enforce.ts";
import { GIFT_CARD, type CatalogProduct } from "../lib/catalog.ts";
import type { Mandate } from "../lib/mandate.ts";

const NOW = new Date("2026-11-07T17:00:00Z");

// "running shoes size 8 waterproof under 120 from rei. ask me if its over 100"
function mandate(over: (m: Mandate) => void = () => {}): Mandate {
  const m: Mandate = {
    source_text: "running shoes size 8 waterproof under 120 from rei. ask me if its over 100",
    checkout: {
      line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }],
      allowed_merchants: [{ domain: "rei.com", source_phrase: "from rei" }],
    },
    payment: { amount_range: { max: 120, currency: "USD", source_phrase: "under 120" }, budget: null, recurrence: "one_time", vault_id: null },
    exp: { at: "2026-11-08T17:00:00Z", source_phrase: null },
    match_mode: "minimum",
    ship_to: null,
    ext: {
      must_haves: [
        { attr: "size", value: "8", source_phrase: "size 8" },
        { attr: "waterproof", value: "yes", source_phrase: "waterproof" },
      ],
      conditions_of_sale: [],
      deliver_by: null,
      checkins: [
        { type: "over_amount", value: 100, source_phrase: "ask me if its over 100" },
        { type: "substitute", source_phrase: null },
        { type: "new_store", source_phrase: null },
      ],
      unmapped: [],
    },
  };
  over(m);
  return m;
}

const SHOE: CatalogProduct = {
  id: "shoe-1", title: "Trail Runner GTX", brand: "Acme", category: "trail-running-shoes", description: null,
  key_features: [], materials: [], attributes: { "waterproof-level": "Waterproof" }, sizes: ["8"], image: null,
  price: 95, store: "rei.com", condition: "new", in_stock: true, source: "channel3",
};

function proposal(over: Partial<Proposal> = {}): Proposal {
  return {
    product: SHOE,
    quantity: 1,
    total: 95,
    checks: [
      { attr: "size", value: "8", verdict: "checked", quote: "8" },
      { attr: "waterproof", value: "yes", verdict: "checked", quote: "Waterproof" },
    ],
    is_substitute: false,
    ...over,
  };
}
const ctx = (over: Partial<Context> = {}): Context => ({ now: NOW, held: 95, ...over });

const voidRules = (d: Decision) => (d.action === "void" ? d.reasons.map((r) => r.rule) : []);
const askRules = (d: Decision) => (d.action === "ask" ? d.checkins.map((c) => c.rule) : []);

test("an item that passes every rule is captured for exactly its price", () => {
  // The happy path must work, or the shopper's approved purchase never goes through.
  assert.deepEqual(decide(mandate(), proposal(), ctx()), { action: "capture", amount: 95 });
});

test("a total over the shopper's limit releases the hold, even by one cent", () => {
  // The limit is the promise on the readback screen: "never more than $120".
  const d = decide(mandate(), proposal({ total: 120.01 }), ctx({ held: 130 }));
  assert.deepEqual(voidRules(d), ["over_limit"]);
  assert.equal(decide(mandate(), proposal({ total: 120 }), ctx({ held: 120 })).action, "ask"); // exactly $120 is allowed (then asks: over $100)
});

test("a total over what PayPal is holding is never captured", () => {
  // The hold is the second copy of the limit; taking more than was held would break both.
  assert.deepEqual(voidRules(decide(mandate(), proposal({ total: 99 }), ctx({ held: 95 }))), ["over_hold"]);
});

test("no spending limit means nothing is charged", () => {
  // Without a number the shopper agreed to, code can't show the charge was allowed.
  const d = decide(mandate((m) => { m.payment.amount_range.max = null; }), proposal(), ctx());
  assert.deepEqual(voidRules(d), ["no_limit"]);
});

test("a store the shopper didn't allow releases the hold", () => {
  // "Only from REI" means a cheaper copy on an unknown site is not what they agreed to.
  const d = decide(mandate(), proposal({ product: { ...SHOE, store: "cheap-shoes.example" } }), ctx());
  assert.deepEqual(voidRules(d), ["store_not_allowed"]);
  assert.equal(decide(mandate(), proposal({ product: { ...SHOE, store: "www.REI.com" } }), ctx()).action, "capture");
});

test("an expired mandate does nothing and tells the shopper", () => {
  // At expiry the shopper said "do nothing", not "buy the best thing found".
  const d = decide(mandate(), proposal(), ctx({ now: new Date("2026-11-08T17:00:00Z") }));
  assert.equal(d.action, "void");
  assert.deepEqual(voidRules(d), ["expired"]);
  assert.match(d.action === "void" ? d.reasons[0].message : "", /nothing was bought/);
});

test("more items than approved releases the hold, even under the limit", () => {
  // 10 × $9 is under a $100 cap, but the shopper asked for one.
  const d = decide(mandate(), proposal({ quantity: 10, total: 90, product: { ...SHOE, price: 9 } }), ctx({ held: 90 }));
  assert.deepEqual(voidRules(d), ["over_quantity"]);
});

test("a gift card is never bought, even when everything else allows it", () => {
  // Gift cards are the classic attack: a hidden note tells the agent to buy one, and it can't be undone.
  const m = mandate((x) => { x.checkout.allowed_merchants = []; x.ext.must_haves = []; x.ext.checkins = []; });
  const d = decide(m, proposal({ product: GIFT_CARD, total: 100, checks: [] }), ctx({ held: 100 }));
  assert.deepEqual(voidRules(d), ["blocked_category"]);
  for (const category of ["prepaid-cards", "cryptocurrency", "money-transfer"]) {
    assert.ok(voidRules(decide(m, proposal({ product: { ...SHOE, category }, checks: [] }), ctx())).includes("blocked_category"), category);
  }
});

test("'only this item' means a substitute is released, not asked about", () => {
  // The shopper chose exact match on the readback screen; a lookalike breaks that.
  const d = decide(mandate((m) => { m.match_mode = "exact"; }), proposal({ is_substitute: true }), ctx());
  assert.deepEqual(voidRules(d), ["not_exact_item"]);
});

test("a must-have the listing contradicts releases the hold", () => {
  // Shoes that aren't waterproof are the wrong shoes, however cheap.
  const checks = proposal().checks.map((c) => (c.attr === "waterproof" ? { ...c, verdict: "didnt_match" as const } : c));
  assert.deepEqual(voidRules(decide(mandate(), proposal({ checks }), ctx())), ["didnt_match"]);
});

test("a must-have nobody could check releases the hold, and a missing result counts as couldn't check", () => {
  // "Couldn't check" is not "probably fine": the shopper only pays for what the listing proves.
  const checks = proposal().checks.map((c) => (c.attr === "size" ? { ...c, verdict: "couldnt_check" as const, quote: null } : c));
  assert.deepEqual(voidRules(decide(mandate(), proposal({ checks }), ctx())), ["couldnt_check"]);
  assert.deepEqual(voidRules(decide(mandate(), proposal({ checks: checks.filter((c) => c.attr !== "size") }), ctx())), ["couldnt_check"]);
});

test("a condition of sale like free returns must be checked too", () => {
  // No store shares return terms, so "free returns" is couldn't check: the hold is released, not gambled.
  const m = mandate((x) => { x.ext.conditions_of_sale = [{ attr: "free returns", value: "yes", source_phrase: "free returns pls" }]; });
  assert.deepEqual(voidRules(decide(m, proposal(), ctx())), ["couldnt_check"]);
});

test("over the shopper's check-in amount asks first", () => {
  // "Ask me if it's over $100" means they want to see a $110 pair before paying.
  const d = decide(mandate(), proposal({ total: 110 }), ctx({ held: 110 }));
  assert.deepEqual(askRules(d), ["over_amount"]);
});

test("a check-in at $0 asks before paying anything", () => {
  // The "show me the price before paying" fix sets $0; any price must pause.
  const m = mandate((x) => { x.ext.checkins = [{ type: "over_amount", value: 0, source_phrase: null }]; });
  assert.deepEqual(askRules(decide(m, proposal(), ctx())), ["over_amount"]);
});

test("a substitute asks first when similar items are allowed", () => {
  // Similar can still be wrong (colour, fit); the shopper decides.
  assert.deepEqual(askRules(decide(mandate(), proposal({ is_substitute: true }), ctx())), ["substitute"]);
});

test("with no store named, any store asks first", () => {
  // Search anywhere, pay only where the shopper said yes.
  const m = mandate((x) => { x.checkout.allowed_merchants = []; });
  assert.deepEqual(askRules(decide(m, proposal(), ctx())), ["new_store"]);
});

test("a price change since approval asks again", () => {
  // The shopper approved $90; even a small rise is a new decision.
  assert.deepEqual(askRules(decide(mandate(), proposal({ price_at_approval: 90 }), ctx())), ["price_changed"]);
  assert.equal(decide(mandate(), proposal({ price_at_approval: 95 }), ctx()).action, "capture");
});

test("a final-sale item asks first", () => {
  // Final sale means a wrong pick can't be returned, so the shopper should see it.
  assert.deepEqual(askRules(decide(mandate(), proposal({ final_sale: true }), ctx())), ["final_sale"]);
});

test("it asks before anything that can't be undone: a no-return kind of item, or no return policy found", () => {
  // A purchase nobody can return is the one mistake a refund can't fix, so the shopper decides.
  assert.deepEqual(askRules(decide(mandate(), proposal({ returns: "kind" }), ctx())), ["cant_undo"]);
  assert.deepEqual(askRules(decide(mandate(), proposal({ returns: "not_found" }), ctx())), ["cant_undo"]);
  assert.equal(decide(mandate(), proposal({ returns: "listing" }), ctx()).action, "capture");
  assert.equal(decide(mandate(), proposal({ returns: "policy" }), ctx()).action, "capture");
});

test("the same item within 24 hours asks first, after that it doesn't", () => {
  // A retry or loop shouldn't buy the same shoes twice.
  const recent = [{ product_id: "shoe-1", at: "2026-11-07T01:00:00Z" }];
  assert.deepEqual(askRules(decide(mandate(), proposal(), ctx({ recent_purchases: recent }))), ["bought_recently"]);
  const old = [{ product_id: "shoe-1", at: "2026-11-06T16:59:59Z" }];
  assert.equal(decide(mandate(), proposal(), ctx({ recent_purchases: old })).action, "capture");
});

test("a failed hard limit releases the hold even when a check-in would also fire", () => {
  // Asking the shopper about a purchase that breaks their own limit would invite them to override it.
  const d = decide(mandate(), proposal({ total: 130, is_substitute: true }), ctx({ held: 130 }));
  assert.equal(d.action, "void");
});

test("an unconfirmed must-have the shopper chose anyway becomes a question, never a charge on its own", () => {
  // The shopper saw "won't pass" and chose it: they decide, so it asks again before PayPal charges.
  const unsure = proposal({ checks: [{ attr: "size", value: "8", verdict: "checked", quote: "8" }, { attr: "waterproof", value: "yes", verdict: "couldnt_check", quote: null }] });
  assert.equal(decide(mandate(), unsure, ctx()).action, "void");
  const d = decide(mandate(), { ...unsure, chosen_anyway: true }, ctx());
  assert.equal(d.action, "ask");
  assert.ok(askRules(d).includes("not_confirmed"));
});

test("choosing anyway never gets past a hard limit: over the limit or a store you didn't allow still releases", () => {
  const unsure = { checks: [{ attr: "size", value: "8", verdict: "checked" as const, quote: "8" }, { attr: "waterproof", value: "yes", verdict: "didnt_match" as const, quote: "Water-resistant" }], chosen_anyway: true };
  assert.equal(decide(mandate(), proposal({ ...unsure, total: 130 }), ctx({ held: 130 })).action, "void");
  assert.equal(decide(mandate(), proposal({ ...unsure, product: { ...SHOE, store: "other.com" } }), ctx()).action, "void");
});
