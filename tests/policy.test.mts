// The product checker trusts what findPolicy returns as the store's own promise. These tests make
// sure it never answers with the wrong store's terms, and never invents terms it doesn't have.

import assert from "node:assert/strict";
import { test } from "node:test";
import { findPolicy } from "../lib/policy.ts";

test("a known store's return policy comes back with its source page and date", () => {
  const p = findPolicy("nike.com", "returns");
  assert.ok(p);
  assert.match(p.text, /60 days/);
  assert.match(p.url, /^https:\/\/www\.nike\.com\//);
  assert.match(p.retrieved, /^\d{4}-\d{2}-\d{2}$/);
});

test("www. and subdomains of the store find the same policy", () => {
  assert.equal(findPolicy("www.nike.com", "returns")?.store, "nike.com");
  assert.equal(findPolicy("store.nike.com", "returns")?.store, "nike.com");
  assert.equal(findPolicy("WWW.Grove.co", "returns")?.store, "grove.co");
});

test("a lookalike domain never gets another store's terms", () => {
  // "notnike.com" promising Nike's 60-day returns would be a false "Checked".
  assert.equal(findPolicy("notnike.com", "returns"), null);
  assert.equal(findPolicy("nike.com.evil.example", "returns"), null);
});

test("an unknown store has no policy, so the checker must say it couldn't check", () => {
  assert.equal(findPolicy("mountainwarehouse.com", "returns"), null);
});

test("every stored policy is the store's own page, with words to quote", async () => {
  const { default: data } = await import("../data/policies.json", { with: { type: "json" } });
  for (const p of data.policies) {
    assert.ok(p.text.length > 20, `${p.store}: text too short to quote`);
    const host = new URL(p.url).hostname.replace(/^www\./, "");
    assert.ok(host === p.store || host.endsWith(`.${p.store}`), `${p.store}: source ${p.url} is not the store's own site`);
  }
});
