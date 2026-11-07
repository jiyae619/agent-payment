// The approval travels with the browser between approving and shopping. These tests check the one
// thing that makes that safe: any change after approval, above all a raised limit, is refused.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ApprovalError, openApproval, sealApproval } from "../lib/approval.ts";
import type { Mandate } from "../lib/mandate.ts";

process.env.APPROVAL_SECRET = "test-secret-that-is-at-least-32-characters-long";

const mandate: Mandate = {
  source_text: "Waterproof running shoes, size 8, under $120.",
  checkout: { line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }], allowed_merchants: [] },
  payment: {
    amount_range: { max: 120, currency: "USD", source_phrase: "under $120" },
    budget: null,
    recurrence: "one_time",
    vault_id: "demo-vault",
  },
  exp: { at: "2026-11-08T00:00:00.000Z", source_phrase: null },
  match_mode: "minimum",
  ship_to: null,
  ext: { must_haves: [], conditions_of_sale: [], deliver_by: null, checkins: [], unmapped: [] },
};

const approval = { mandate, approved_at: "2026-11-07T00:00:00.000Z" };

test("an untouched approval opens with the limits the shopper approved", () => {
  assert.deepEqual(openApproval(sealApproval(approval)), approval);
});

test("raising the limit after approval is refused", () => {
  // The browser holds the sealed approval, so a script on the page could try to raise $120 to $5,000.
  const [payload, mac] = sealApproval(approval).split(".");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  data.mandate.payment.amount_range.max = 5000;
  const forged = `${Buffer.from(JSON.stringify(data)).toString("base64url")}.${mac}`;
  assert.throws(() => openApproval(forged), ApprovalError);
});

test("an approval sealed with another secret is refused", () => {
  const token = sealApproval(approval);
  process.env.APPROVAL_SECRET = "a-different-secret-that-is-also-32-characters";
  try {
    assert.throws(() => openApproval(token), ApprovalError);
  } finally {
    process.env.APPROVAL_SECRET = "test-secret-that-is-at-least-32-characters-long";
  }
});

test("a missing or short secret fails loudly instead of sealing with a guessable key", () => {
  const saved = process.env.APPROVAL_SECRET;
  process.env.APPROVAL_SECRET = "short";
  try {
    assert.throws(() => sealApproval(approval), ApprovalError);
  } finally {
    process.env.APPROVAL_SECRET = saved;
  }
});
