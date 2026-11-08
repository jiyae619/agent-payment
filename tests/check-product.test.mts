// The AI's product check only counts when the store's own words back it. These tests cover the
// plain-code guard around the AI: an invented or missing quote can never become "checked".

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogProduct } from "../lib/catalog.ts";
import { isFinalSale, listingText, verify } from "../lib/check-product.ts";
import type { Pref } from "../lib/mandate.ts";

const SHOE: CatalogProduct = {
  id: "s", title: "Trail Runner GTX", brand: null, category: null, description: "Responsive energy return foam.",
  key_features: ["GORE-TEX waterproof membrane"], materials: [], attributes: { "waterproof-level": "Waterproof" },
  sizes: ["7", "8"], image: null, price: 95, store: "rei.com", condition: "new", in_stock: true, source: "channel3",
};
const WATERPROOF: Pref = { attr: "waterproof", value: "yes", source_phrase: "waterproof" };
const RETURNS: Pref = { attr: "free returns", value: "yes", source_phrase: "free returns" };
const text = listingText(SHOE);

test("a checked answer quoting the listing word for word stands", () => {
  const [r] = verify([WATERPROOF], { results: [{ attr: "waterproof", value: "yes", verdict: "checked", quote: "GORE-TEX waterproof membrane" }] }, text);
  assert.equal(r.verdict, "checked");
});

test("a checked answer with a quote the store never wrote becomes couldn't check", () => {
  // The AI paraphrased ("fully waterproof"): the listing never says that, so it proves nothing.
  const [r] = verify([WATERPROOF], { results: [{ attr: "waterproof", value: "yes", verdict: "checked", quote: "fully waterproof" }] }, text);
  assert.deepEqual(r, { attr: "waterproof", value: "yes", verdict: "couldnt_check", quote: null });
});

test("a checked answer with no quote becomes couldn't check", () => {
  const [r] = verify([RETURNS], { results: [{ attr: "free returns", value: "yes", verdict: "checked", quote: null }] }, text);
  assert.equal(r.verdict, "couldnt_check");
});

test("a requirement the AI skipped counts as couldn't check, never as passed", () => {
  const out = verify([WATERPROOF, RETURNS], { results: [{ attr: "waterproof", value: "yes", verdict: "checked", quote: "Waterproof" }] }, text);
  assert.equal(out[1].verdict, "couldnt_check");
});

test("the store saying final sale triggers the check-in without relying on the AI", () => {
  assert.equal(isFinalSale({ ...SHOE, description: "Final sale: this item is non-returnable." }, null), true);
  assert.equal(isFinalSale(SHOE, null), false);
});
