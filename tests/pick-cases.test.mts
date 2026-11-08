// Run: npm test
// The pick eval set is the answer key for lib/pick.ts. A malformed or impossible case would score
// every model wrong, so these tests keep the key consistent with what the pick step really sees.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";

const Check = z.object({
  attr: z.string(),
  value: z.string(),
  verdict: z.enum(["checked", "didnt_match", "couldnt_check"]),
  quote: z.string().min(1).nullable(),
});
const Option = z.object({ id: z.string(), title: z.string(), price: z.number().positive(), store: z.string(), checks: z.array(Check) });
const Case = z.object({
  id: z.string(),
  trap: z.string().nullable(),
  shopper_words: z.string().min(1),
  options: z.array(Option).min(2),
  expect: z.object({ pick: z.array(z.string()).min(1), reason_must_not: z.array(z.string()), why: z.string().min(1) }),
});

const raw = JSON.parse(readFileSync(new URL("../data/fixtures/pick-cases.json", import.meta.url), "utf8"));
const cases = z.array(Case).parse(raw.cases);
// Same rule as lib/pick.ts: only options whose every check is "checked" reach the AI.
const proven = (c: z.infer<typeof Case>) => c.options.filter((o) => o.checks.every((r) => r.verdict === "checked"));

test("every case parses, so none silently drops out of a model's score", () => {
  assert.equal(cases.length, raw.cases.length);
  assert.ok(cases.length >= 15 && cases.length <= 20, `expected 15-20 cases, got ${cases.length}`);
});

test("case ids and option ids are unique, so answers line up", () => {
  const ids = cases.map((c) => c.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  for (const c of cases) {
    const o = c.options.map((x) => x.id);
    assert.equal(new Set(o).size, o.length, c.id);
  }
});

test("every expected pick is a fully checked option, because enforcement would never let anything else through", () => {
  for (const c of cases) {
    const ok = new Set(proven(c).map((o) => o.id));
    for (const id of c.expect.pick) assert.ok(ok.has(id), `${c.id}: ${id} is not a fully checked option`);
  }
});

test("only code-path cases have a single fully checked option, so every other case really tests the model", () => {
  for (const c of cases) {
    if (c.trap === "code-path") {
      assert.equal(proven(c).length, 1, c.id);
      assert.deepEqual(c.expect.pick, [proven(c)[0].id], `${c.id}: code picks the only proven option`);
    } else {
      assert.ok(proven(c).length >= 2, `${c.id}: needs 2+ fully checked options or the AI is never asked`);
    }
  }
});

test("a tie only accepts options at the same price, so 'either is fine' is never a hidden price difference", () => {
  for (const c of cases.filter((x) => x.trap === "price-tie")) {
    const prices = new Set(c.expect.pick.map((id) => c.options.find((o) => o.id === id)!.price));
    assert.equal(prices.size, 1, c.id);
    assert.ok(c.expect.pick.length >= 2, c.id);
  }
});

test("every option fits the shopper's price limit, because the shortlist drops anything over it", () => {
  for (const c of cases) {
    const limit = c.shopper_words.match(/under \$(\d+(?:\.\d+)?)/i);
    if (!limit) continue;
    // "3 bottles ... under $50 for all of them": the limit covers every unit.
    const qty = /for all/i.test(c.shopper_words) ? Number(c.shopper_words.match(/^(\d+) /)?.[1] ?? 1) : 1;
    for (const o of c.options) assert.ok(o.price * qty <= Number(limit[1]), `${c.id}: ${o.id} costs more than the shopper allows`);
  }
});

test("a listing that talks to the AI is never the expected pick on its instruction alone", () => {
  const hidden = cases.filter((c) => c.trap === "hidden-instruction");
  assert.ok(hidden.length >= 1);
  for (const c of hidden) {
    const injected = c.options.filter((o) => /\bAI\b/.test(o.title));
    assert.equal(injected.length, 1, `${c.id} should carry one instruction to the AI`);
    // It may be acceptable only in a genuine tie, where nothing else separates the options.
    if (c.expect.pick.includes(injected[0].id)) assert.ok(c.expect.pick.length >= 2, c.id);
  }
});

test("forbidden phrases are lowercase, so the scorer's case-insensitive match finds them", () => {
  for (const c of cases) for (const p of c.expect.reason_must_not) assert.equal(p, p.toLowerCase(), `${c.id}: "${p}"`);
});
