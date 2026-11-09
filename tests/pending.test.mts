// PayPal holds sit on the shopper's real money. A question the shopper never answers must not keep
// that money held for weeks: after ANSWER_MINUTES the hold is due for release, exactly once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWER_MINUTES, expiredPending, settlePending, trackPending } from "../lib/pending.ts";

const MIN = 60 * 1000;

test("an unanswered hold is due for release after the answer window, and only once", () => {
  trackPending("auth-1", 0);
  assert.deepEqual(expiredPending(ANSWER_MINUTES * MIN - 1), [], "not before the window ends");
  assert.deepEqual(expiredPending(ANSWER_MINUTES * MIN), ["auth-1"]);
  assert.deepEqual(expiredPending(ANSWER_MINUTES * MIN + 5 * MIN), [], "never released twice");
});

test("an answered hold is never released by the sweep", () => {
  trackPending("auth-2", 0);
  settlePending("auth-2");
  assert.deepEqual(expiredPending(ANSWER_MINUTES * MIN * 2), []);
});
