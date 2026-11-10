// Run: npm test
// The options screen's order. The shopper sees the best-proven option first, so a cheap listing
// that can't back up what they asked for must never outrank one the store's own words prove.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogProduct } from "../lib/catalog.ts";
import type { CheckResult, Verdict } from "../lib/enforce.ts";
import { rankChecked } from "../lib/pick-core.ts";

const product = (id: string, price: number) =>
  ({ id, title: id, price, store: "example.com", in_stock: true, key_features: [], attributes: {}, sizes: [] }) as unknown as CatalogProduct;
const checks = (...v: Verdict[]): CheckResult[] => v.map((verdict, i) => ({ attr: `r${i}`, value: "yes", verdict, quote: verdict === "couldnt_check" ? null : "q" }));
const ids = (xs: { product: CatalogProduct }[]) => xs.map((x) => x.product.id);

test("more requirements proven ranks first, even when it costs more", () => {
  const cheapUnproven = { product: product("cheap", 40), checks: checks("checked", "couldnt_check") };
  const proven = { product: product("proven", 90), checks: checks("checked", "checked") };
  assert.deepEqual(ids(rankChecked([cheapUnproven, proven])), ["proven", "cheap"]);
});

test("a listing that contradicts a requirement ranks below one that only couldn't be checked", () => {
  const contradicts = { product: product("no", 30), checks: checks("checked", "didnt_match") };
  const unknown = { product: product("maybe", 50), checks: checks("checked", "couldnt_check") };
  assert.deepEqual(ids(rankChecked([contradicts, unknown])), ["maybe", "no"]);
});

test("equally proven options: the cheapest wins", () => {
  const a = { product: product("a", 60), checks: checks("checked") };
  const b = { product: product("b", 45), checks: checks("checked") };
  assert.deepEqual(ids(rankChecked([a, b])), ["b", "a"]);
});
