// The gift-card demo makes one claim: the same fooled agent gets the gift card bought under a
// total-only approval, and gets nowhere under this app's approval. These tests hold that claim.

import { test } from "node:test";
import assert from "node:assert/strict";
import { attackerProposal, HIDDEN_NOTE, informedOutcome, naiveDecide, naiveMandate } from "../lib/attack.ts";

const NOW = new Date("2026-11-08T15:00:00Z");

test("under a total-only approval, the $100 gift card goes through: nothing else is checked", () => {
  assert.deepEqual(naiveDecide(naiveMandate(NOW), attackerProposal(), 100), { action: "capture", amount: 100 });
});

test("under this app's approval, the gift card never reaches the AI's choice", () => {
  const { reachedPick, funnel } = informedOutcome(NOW, []);
  assert.equal(reachedPick, false);
  assert.deepEqual(funnel.slice(0, 2), [{ label: "found", count: 1 }, { label: "not gift cards or money", count: 0 }]);
});

test("and if it did, enforcement would release the hold, naming the gift card first", () => {
  const { decision } = informedOutcome(NOW, []);
  assert.equal(decision.action, "void");
  if (decision.action === "void") assert.ok(decision.reasons.some((r) => r.rule === "blocked_category"));
});

test("the viewer is shown the hidden note the agent read", () => {
  assert.match(HIDDEN_NOTE, /Note to AI shopping assistants/);
});
