// Run: npm test
// An option that enforcement would release must be caught before PayPal holds anything, so a
// shopper is never offered a purchase the rules already rule out.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogProduct } from "../lib/catalog.ts";
import type { Mandate } from "../lib/mandate.ts";
import { wontPass, type Candidate } from "../lib/purchase.ts";

const mandate: Mandate = {
  source_text: "Waterproof running shoes, size 8, under $120. Free returns please.",
  checkout: { line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }], allowed_merchants: [] },
  payment: { amount_range: { max: 120, currency: "USD", source_phrase: "under $120" }, budget: null, recurrence: "one_time", vault_id: "v" },
  exp: { at: "2099-01-01T00:00:00Z", source_phrase: null },
  match_mode: "minimum", ship_to: null,
  ext: { must_haves: [], conditions_of_sale: [{ attr: "free returns", value: "yes", source_phrase: "Free returns please" }], deliver_by: null, checkins: [], unmapped: [] },
};
const product = { id: "p", title: "Trail running shoes", price: 92.81, store: "zappos.com", in_stock: true, key_features: [], attributes: {}, sizes: [] } as unknown as CatalogProduct;
const option = (verdict: "checked" | "couldnt_check"): Candidate => ({
  product, checks: [{ attr: "free returns", value: "yes", verdict, quote: verdict === "checked" ? "free returns" : null }],
  policy: null, final_sale: false, returns: { evidence: "policy", label: "Returns: found on the store's policy page" },
});

test("an option whose must-have can't be confirmed won't pass, and says why, before any hold", () => {
  const why = wontPass(mandate, option("couldnt_check"), 1);
  assert.equal(why.length, 1);
  assert.match(why[0], /free returns/);
});

test("an option that proves every rule passes the pre-check", () => {
  assert.deepEqual(wontPass(mandate, option("checked"), 1), []);
});
