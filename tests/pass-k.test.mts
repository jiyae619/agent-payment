// Run: npm test
// A shopper sees one run, so a model that is right only some of the time is not right.

import { test } from "node:test";
import assert from "node:assert/strict";
import { passK, type Run } from "../scripts/pass-k.mts";

const run = (caseId: string, ok: boolean, critical: string[] = []): Run => ({ caseId, ok, critical });

test("a case counts toward pass^k only if every run passed, because one bad run is one shopper's bad purchase", () => {
  const s = passK([run("a", true), run("a", true), run("a", true), run("b", true), run("b", false), run("b", true)]);
  assert.equal(s.k, 3);
  assert.equal(s.cases, 2);
  assert.equal(s.passAll, 1);
  assert.equal(s.passAny, 2);
  assert.equal(s.runPassRate, 5 / 6); // pass@1 looks fine at 83% while pass^3 is only 1 of 2
});

test("a critical mistake in any single run marks the case, because the gate allows none", () => {
  const s = passK([run("a", true), run("a", false, ["max 150 ≠ expected 120"]), run("a", true)]);
  assert.equal(s.critical, 1);
  assert.equal(s.passAll, 0);
});

test("cases that pass some runs and fail others are listed as flaky, so they get read first", () => {
  const s = passK([run("steady", true), run("steady", true), run("wobbly", true), run("wobbly", false), run("broken", false), run("broken", false)]);
  assert.deepEqual(s.flaky, ["wobbly"]);
});

test("k is the fewest runs any case got, so a case that lost a run can't inflate pass^k", () => {
  const s = passK([run("a", true), run("a", true), run("a", true), run("b", true)]);
  assert.equal(s.k, 1);
});
