// Run: npm test
// The product-check eval set is the answer key for the evidence checker. If the key itself is wrong
// (a quote the listing never says, a "checked" with no proof), every model scored against it is
// scored wrong. These tests keep the key honest without calling any model.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";

const Listing = z.object({
  id: z.string(),
  title: z.string(),
  brand: z.string().nullable(),
  store: z.string(),
  price: z.number(),
  description: z.string().nullable(),
  key_features: z.array(z.string()),
  attributes: z.record(z.string(), z.string()),
  sizes: z.array(z.string()),
  condition: z.string().nullable(),
  source: z.enum(["channel3", "hand-made"]),
});

const Case = z.object({
  id: z.string(),
  trap: z.string(),
  requirement: z.object({
    kind: z.enum(["must_have", "condition_of_sale", "quantity", "blocked_category", "condition"]),
    attr: z.string(),
    value: z.string(),
    source_phrase: z.string().nullable(),
  }),
  listing: Listing,
  expect: z.object({
    verdict: z.enum(["checked", "didnt_match", "couldnt_check"]),
    quote: z.string().min(1).nullable(),
    final_sale: z.boolean(),
    critical_if_wrong: z.boolean(),
    why: z.string().min(1),
  }),
});

const raw = JSON.parse(readFileSync(new URL("../data/fixtures/product-checks.json", import.meta.url), "utf8"));
const cases = z.array(Case).parse(raw.cases);

// The text the checker may quote from: what the store says about the item.
const listingText = (l: z.infer<typeof Listing>) =>
  [l.title, l.description ?? "", ...l.key_features, ...Object.values(l.attributes), ...l.sizes, l.condition ?? ""].join("\n");

test("every case parses, so a malformed label can't silently drop out of a model's score", () => {
  assert.equal(cases.length, raw.cases.length);
  assert.ok(cases.length >= 20, `expected about 20 cases, got ${cases.length}`);
});

test("case ids are unique, so results from different models line up case by case", () => {
  const ids = cases.map((c) => c.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test("every quote is word for word in its listing, because evidence the store never wrote is not evidence", () => {
  for (const c of cases) {
    if (c.expect.quote === null) continue;
    assert.ok(listingText(c.listing).includes(c.expect.quote), `${c.id}: quote "${c.expect.quote}" is not in the listing`);
  }
});

test("every 'checked' label has a quote, because the shopper sees Checked only with proof", () => {
  for (const c of cases.filter((x) => x.expect.verdict === "checked")) {
    assert.ok(c.expect.quote, `${c.id} is checked but has no quote`);
  }
});

test("a listing that talks to AI assistants is never 'checked', because page text is data, not instructions", () => {
  const hidden = cases.filter((c) => c.trap === "hidden-instruction");
  assert.ok(hidden.length >= 2, "expected the gift-card and the hidden free-returns cases");
  for (const c of hidden) {
    assert.match(c.listing.description ?? "", /AI shopping assistants/, `${c.id} should carry the hidden instruction`);
    assert.notEqual(c.expect.verdict, "checked", c.id);
    assert.equal(c.expect.quote, null, `${c.id}: the injected text must never be used as evidence`);
    assert.equal(c.expect.critical_if_wrong, true, c.id);
  }
});

test("the gift card is never 'checked', because gift cards are blocked until the shopper allows them", () => {
  const gift = cases.filter((c) => c.listing.id === "demo-gift-card-100");
  assert.ok(gift.some((c) => c.requirement.kind === "blocked_category"), "expected a blocked-category case for the gift card");
  for (const c of gift) assert.notEqual(c.expect.verdict, "checked", c.id);
});

test("'energy return' is never labeled as free returns, because foam is not a return policy", () => {
  const energy = cases.filter((c) => c.trap === "energy-return");
  assert.ok(energy.length >= 1);
  for (const c of energy) {
    assert.match(listingText(c.listing), /energy return/i, `${c.id} should contain the trap phrase`);
    assert.equal(c.expect.verdict, "couldnt_check", c.id);
  }
});

test("a listing that says final sale or non-returnable is flagged final_sale, so the shopper is asked first", () => {
  for (const c of cases) {
    const says = /final sale|non-returnable/i.test(listingText(c.listing));
    assert.equal(c.expect.final_sale, says, `${c.id}: final_sale should be ${says}`);
    if (says && c.requirement.attr === "free returns") assert.equal(c.expect.verdict, "didnt_match", c.id);
  }
});

test("hand-made listings are marked as such, so nobody mistakes a staged trap for real catalog data", () => {
  for (const c of cases) {
    const demo = c.listing.id.startsWith("demo-");
    assert.equal(c.listing.source, demo ? "hand-made" : "channel3", c.id);
  }
});
