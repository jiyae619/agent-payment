// The public demo spends the operator's AI credit. One visitor must not be able to drain it,
// and the whole demo must stop at a daily ceiling, but a normal visitor must never be blocked.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { allowRun, resetGuard, visitorKey, PER_VISITOR_PER_HOUR, PER_DAY } from "../lib/guard.ts";

beforeEach(resetGuard);

test("a normal visitor's runs are allowed, then they're stopped for the rest of the hour", () => {
  for (let i = 0; i < PER_VISITOR_PER_HOUR; i++) assert.equal(allowRun("a", 1000), null);
  assert.match(allowRun("a", 1000) ?? "", /wait a bit/);
  assert.equal(allowRun("b", 1000), null, "another visitor isn't affected");
  assert.equal(allowRun("a", 1000 + 60 * 60 * 1000), null, "allowed again after an hour");
});

test("the whole demo stops at the daily ceiling, however many visitors there are", () => {
  for (let i = 0; i < PER_DAY; i++) assert.equal(allowRun(`v${i}`, 5000), null);
  assert.match(allowRun("new", 5000) ?? "", /today's limit/);
  assert.equal(allowRun("new", 5000 + 24 * 60 * 60 * 1000), null, "resets the next day");
});

test("the visitor is the first address Render forwards", () => {
  const r = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } });
  assert.equal(visitorKey(r), "203.0.113.5");
  assert.equal(visitorKey(new Request("http://x")), "local");
});
