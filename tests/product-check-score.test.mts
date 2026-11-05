// Run: npm test
// The product-check scorer decides which evidence checker is safe to ship. These tests pin the rubric:
// how bad a mistake is depends on how far the result lands from what the shopper expects.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreCheck, summarize, compareModels, type Answer, type Case } from "../scripts/product-check-score.mts";

const cases: Case[] = JSON.parse(readFileSync(new URL("../data/fixtures/product-checks.json", import.meta.url), "utf8")).cases;
const byId = (id: string) => {
  const c = cases.find((x) => x.id === id);
  assert.ok(c, `case ${id} is missing from the set`);
  return c;
};
const severity = (id: string, a: Answer) => scoreCheck(byId(id), a)?.severity ?? null;
const answers = (f: (c: Case) => Answer) => new Map(cases.map((c) => [c.id, f(c)]));
const gold = answers((c) => ({ verdict: c.expect.verdict, quote: c.expect.quote }));

test("the answer key scores perfectly against itself, or every model would be scored wrong", () => {
  const s = summarize(cases, gold);
  assert.deepEqual(s.findings, []);
  assert.equal(s.passesGate, true);
});

test("a false Checked is critical on a requirement, because the shopper pays for something they ruled out", () => {
  assert.equal(severity("waterproof-negation-01", { verdict: "checked", quote: "waterproof" }), "critical");
  assert.equal(severity("blocked-category-gift-card-01", { verdict: "checked", quote: "Digital Gift Card" }), "critical");
});

test("a false Checked on a soft preference is major, not critical, because the buy would have gone ahead anyway", () => {
  // The brand name "Citrus Grove" is in the listing, but it isn't a scent.
  assert.equal(severity("pref-scent-brand-name-01", { verdict: "checked", quote: "Citrus" }), "major");
});

test("mixing up Didn't match and Couldn't check is major on a requirement and minor on a preference", () => {
  assert.equal(severity("waterproof-contradiction-01", { verdict: "didnt_match", quote: null }), "major");
  assert.equal(severity("pref-scent-brand-name-01", { verdict: "didnt_match", quote: null }), "minor");
});

test("blocking an item the listing proves is major on a requirement and minor on a preference, because it cancels a buy the shopper wanted", () => {
  assert.equal(severity("returns-free-pass-01", { verdict: "couldnt_check", quote: null }), "major");
  assert.equal(severity("pref-scent-pass-01", { verdict: "couldnt_check", quote: null }), "minor");
});

test("Checked with no quote or a made-up quote is critical, because the receipt would show proof the store never wrote", () => {
  assert.equal(severity("size-pass-momentum-01", { verdict: "checked", quote: null }), "critical");
  assert.equal(severity("size-pass-momentum-01", { verdict: "checked", quote: "Available in size 8" }), "critical");
  assert.equal(severity("pref-scent-pass-01", { verdict: "checked", quote: "Citrus scent" }), "major");
});

test("Checked with a real quote that isn't the labelled proof goes to a person, not to a pass or a critical", () => {
  const f = scoreCheck(byId("waterproof-title-only-01"), { verdict: "checked", quote: "Trail Running Shoes" });
  assert.equal(f?.severity, "major");
  assert.match(f!.problem, /check by hand/);
  // A longer quote around the proof is still the proof.
  assert.equal(severity("waterproof-title-only-01", { verdict: "checked", quote: "Ridgeline Ascent Waterproof Trail Running Shoes" }), null);
});

test("a right 'no' with a quote the store never wrote is still major, because the receipt would misquote the store", () => {
  assert.equal(severity("returns-final-sale-01", { verdict: "didnt_match", quote: "No returns accepted" }), "major");
});

test("a checker that always says Checked fails the gate, and one that always says Couldn't check passes but ranks below a good one", () => {
  const yes = summarize(cases, answers((c) => ({ verdict: "checked", quote: c.listing.title })));
  const unsure = summarize(cases, answers(() => ({ verdict: "couldnt_check", quote: null })));
  const good = summarize(cases, gold);
  assert.equal(yes.passesGate, false);
  assert.equal(yes.falseChecked.count, yes.falseChecked.of);
  assert.equal(unsure.passesGate, true);
  assert.equal(unsure.overCaution.count, unsure.overCaution.of);
  assert.ok(unsure.major > 0);
  assert.deepEqual([yes, unsure, good].sort(compareModels), [good, unsure, yes]);
});

test("a missing answer stops the run instead of quietly scoring as a pass", () => {
  const partial = new Map(gold);
  partial.delete(cases[0].id);
  assert.throws(() => summarize(cases, partial), /no answer/);
});
