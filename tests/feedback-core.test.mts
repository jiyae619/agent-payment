// Loop 2 reads real server logs. It must turn the right lines into review items, ignore everything
// else in the log (and garbled lines) without crashing, and never invent an expected answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../scripts/feedback-core.mts";

const LOG = [
  " GET / 200 in 44ms",
  `[feedback] {"at":"2026-11-08T19:00:00Z","kind":"request_edit","before":"running shoes under 120","after":"running shoes, size 8, under $120"}`,
  `[feedback] {"at":"2026-11-08T19:01:00Z","kind":"request_edit","before":"Running shoes under 120","after":"duplicate wording"}`,
  `[feedback] {"at":"2026-11-08T19:02:00Z","kind":"dont_buy_reason","value":"wrong_store","store":"shop.example.com","outcome":"refused","asked_because":["new_store"]}`,
  `[feedback] {"at":"2026-11-08T19:03:00Z","kind":"rating","value":"wrong_item","store":"shop.example.com","outcome":"bought","asked_because":["new_store"]}`,
  `[feedback] {"at":"2026-11-08T19:04:00Z","kind":"rating","value":"right","store":"good.example.com","outcome":"bought","asked_because":[]}`,
  `[outcome] {"at":"2026-11-08T19:05:00Z","outcome":"released","store":"mountainwarehouse.com","rules":["couldnt_check"],"unchecked":[{"attr":"free returns","verdict":"couldnt_check"}]}`,
  `[outcome] {"at":"2026-11-08T19:06:00Z","outcome":"released","store":"mountainwarehouse.com","rules":["couldnt_check"],"unchecked":[{"attr":"free returns","verdict":"couldnt_check"},{"attr":"size","verdict":"couldnt_check"}]}`,
  `[outcome] {"at":"2026-11-08T19:07:00Z","outcome":"released","store":"once.example.com","rules":["couldnt_check"],"unchecked":[{"attr":"free returns","verdict":"couldnt_check"}]}`,
  `[feedback] {"broken json`,
];

const r = buildReport(LOG, 2);

test("an opt-in request edit becomes one draft case, with no expected answer invented", () => {
  assert.equal(r.drafter_cases.length, 1, "same first wording counted once");
  assert.deepEqual(r.drafter_cases[0], {
    id: "real-edit-01", persona: "real-shopper", scenario: "from-feedback",
    text: "running shoes under 120", shopper_rewrote_as: "running shoes, size 8, under $120", expect: null, needs_review: true,
  });
});

test("a store whose free returns keep failing gets a policy to-do; a single miss doesn't", () => {
  assert.deepEqual(r.policy_todo.map((p) => [p.store, p.times]), [["mountainwarehouse.com", 2]]);
});

test("complaints are counted per store", () => {
  assert.deepEqual(r.store_flags, [{ store: "shop.example.com", wrong_store: 1, wrong_item: 1, not_delivered: 0 }]);
});

test("each 'asks you first' question shows how often shoppers refused it", () => {
  assert.deepEqual(r.questions, [{ asked_because: "new_store", times: 2, refused: 1 }]);
});

test("other unsettled requirements are listed for labelling; the rest of the log and garbled lines are ignored", () => {
  assert.deepEqual(r.checker_review, [{ store: "mountainwarehouse.com", attr: "size", verdict: "couldnt_check", times: 1 }]);
  assert.deepEqual(r.counts, { feedback: 5, released: 3, skipped: 1 });
});
