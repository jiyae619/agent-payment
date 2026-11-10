// Run: npm test
// "Can it be undone?" decides whether the shopper is asked before paying. A wrong "returnable"
// label would let money move on something nobody can send back, so silence must mean "no".

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogProduct } from "../lib/catalog.ts";
import { returnsFor } from "../lib/check-core.ts";
import type { Policy } from "../lib/policy.ts";

const product = (over: Partial<CatalogProduct> = {}) =>
  ({ id: "p", title: "Trail running shoes", price: 80, store: "shop.example.com", in_stock: true, description: "", key_features: [], attributes: {}, sizes: [], ...over }) as CatalogProduct;
const policy: Policy = { store: "shop.example.com", topic: "returns", text: "Return unworn items within 30 days.", url: "https://shop.example.com/returns", retrieved: "2026-11-01" };

test("no return terms in the listing and no policy page counts as can't be undone", () => {
  assert.equal(returnsFor(product(), null).evidence, "not_found");
  assert.match(returnsFor(product(), null).label, /treated as final sale/);
});

test("returns stated in the listing, or a store policy page, count as returnable, and the label says which", () => {
  assert.equal(returnsFor(product({ key_features: ["Free 60-day returns"] }), null).evidence, "listing");
  assert.equal(returnsFor(product(), policy).evidence, "policy");
});

test("personalized, perishable, tickets and digital codes can't be undone even with a policy", () => {
  for (const title of ["Personalized name necklace", "Concert tickets x2", "Engraved water bottle", "Digital download: photo pack"]) {
    assert.equal(returnsFor(product({ title }), policy).evidence, "kind", title);
  }
});

test("final sale wins over everything else", () => {
  assert.equal(returnsFor(product({ description: "Final sale. Free returns on other items." }), policy).evidence, "final_sale");
});

test("a store that says it doesn't accept returns makes every item final sale (ATTITUDE's policy page)", async () => {
  const { findPolicy } = await import("../lib/policy.ts");
  const attitude = findPolicy("us-shop.attitudeliving.com", "returns");
  assert.ok(attitude, "ATTITUDE's policy is on file");
  assert.equal(returnsFor(product({ store: "us-shop.attitudeliving.com" }), attitude).evidence, "final_sale");
  // A store with ordinary return terms on file counts as returnable without asking.
  assert.equal(returnsFor(product({ store: "chewy.com" }), findPolicy("chewy.com", "returns")).evidence, "policy");
});

test("no policy excerpt mentions final sale, so one exception can't mark a whole store final sale", async () => {
  const data = (await import("../data/policies.json", { with: { type: "json" } })).default as { policies: { store: string; text: string }[] };
  for (const p of data.policies) assert.doesNotMatch(p.text, /final sale/i, p.store);
});
