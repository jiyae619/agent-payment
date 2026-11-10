// Run: npm test
// 10,000 random mandates × proposals × contexts, checked against the promises the shopper is shown.
// Example tests prove the rules we thought of; this proves no mix of inputs slips past them.
// Each invariant is worked out here from the raw inputs, not by asking decide() what it did.
//
// Reproduce a failure: SEED=<seed printed in the failure> npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, type CheckResult, type Context, type Decision, type Proposal, type Verdict } from "../lib/enforce.ts";
import type { CatalogProduct } from "../lib/catalog.ts";
import type { Checkin, Mandate, Pref } from "../lib/mandate.ts";

const CASES = 10_000;
const SEED = Number(process.env.SEED ?? 20261107);

// mulberry32: small, seeded, good enough to spread cases; same seed = same cases.
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STORES = ["rei.com", "zappos.com", "mountainwarehouse.com", "cheap-shoes.example"];
const SAFE_CATEGORIES = ["trail-running-shoes", "dish-soap", null];
const BLOCKED_CATEGORIES = ["gift-cards", "prepaid-cards", "cryptocurrency", "money-transfer"];
const PREFS: Pref[] = [
  { attr: "size", value: "8", source_phrase: "size 8" },
  { attr: "waterproof", value: "yes", source_phrase: "waterproof" },
  { attr: "free returns", value: "yes", source_phrase: "free returns" },
];
const VERDICTS: Verdict[] = ["checked", "didnt_match", "couldnt_check"];
const NOW = new Date("2026-11-07T17:00:00Z").getTime();
const HOUR = 3600 * 1000;

function makeCase(rand: () => number) {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const chance = (p: number) => rand() < p;
  const cents = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100) / 100;

  // Each risky input is wrong only some of the time (`bad`), so all three outcomes stay common.
  const bad = () => chance(0.12);
  const max = chance(0.04) ? null : pick([25, 100, 120, cents(1, 300)]);
  // Totals cluster around the limit, so off-by-a-cent mistakes get exercised.
  const near = max ?? 100;
  const total = bad() ? pick([near + 0.01, cents(near, near * 1.5), 0, -5, NaN]) : pick([near, near - 0.01, cents(1, near)]);
  const held = bad() ? pick([total - 0.01, cents(1, 300)]) : pick([total, total + 0.01, near]);

  const checkins: Checkin[] = [];
  if (chance(0.3)) checkins.push({ type: "over_amount", value: pick([0, 50, near - 0.01, near]), source_phrase: null });
  if (chance(0.6)) checkins.push({ type: "substitute", source_phrase: null });
  if (chance(0.4)) checkins.push({ type: "new_store", source_phrase: null });

  const mustHaves = PREFS.slice(0, 2).filter(() => chance(0.4));
  const conditions = PREFS.slice(2).filter(() => chance(0.3));
  const lineQty = pick([1, 1, 2, 3]);

  const mandate: Mandate = {
    source_text: "random case",
    checkout: {
      line_items: chance(0.1) ? [] : [{ description: "item", quantity: lineQty, source_phrase: null }],
      allowed_merchants: (chance(0.3) ? [] : STORES.slice(0, 3)).map((domain) => ({ domain, source_phrase: null })),
    },
    payment: { amount_range: { max, currency: "USD", source_phrase: null }, budget: null, recurrence: "one_time", vault_id: null },
    // Expiry lands before, exactly at, or after now.
    exp: { at: new Date(NOW + (bad() ? pick([-HOUR, 0]) : pick([1, HOUR, 24 * HOUR]))).toISOString(), source_phrase: null },
    match_mode: pick(["exact", "minimum"] as const),
    ship_to: null,
    ext: { must_haves: mustHaves, conditions_of_sale: conditions, deliver_by: null, checkins, unmapped: [] },
  };

  const blocked = bad();
  const price = cents(1, 200);
  const product: CatalogProduct = {
    id: pick(["p1", "p2", "p3"]),
    title: blocked && chance(0.5) ? "Digital Gift Card" : "Some product",
    brand: null,
    category: blocked ? pick(BLOCKED_CATEGORIES) : pick(SAFE_CATEGORIES),
    description: null, key_features: [], materials: [], attributes: {}, sizes: [], image: null,
    price,
    store: bad() ? STORES[3] : pick(STORES.slice(0, 3)),
    condition: "new", in_stock: true, source: "channel3",
  };

  // Results for some, all or none of the prefs, mostly "checked" so captures still happen.
  const checks: CheckResult[] = PREFS.filter(() => chance(0.95)).map((p) => ({
    attr: p.attr, value: p.value, verdict: chance(0.9) ? "checked" : pick(VERDICTS), quote: null,
  }));

  const proposal: Proposal = {
    product,
    quantity: bad() ? pick([2, 3, 10, 0, 1.5]) : 1,
    total,
    checks,
    is_substitute: chance(0.2),
    ...(chance(0.1) ? { final_sale: true } : {}),
    ...(chance(0.3) ? { returns: pick(["listing", "policy", "kind", "not_found"] as const) } : {}),
    ...(chance(0.3) ? { price_at_approval: pick([price, price, price + 1]) } : {}),
  };

  const context: Context = {
    now: new Date(NOW),
    held,
    ...(chance(0.2) ? { recent_purchases: [{ product_id: pick(["p1", "p2", "p3"]), at: new Date(NOW - pick([HOUR, 23 * HOUR, 25 * HOUR])).toISOString() }] } : {}),
  };

  return { mandate, proposal, context, blocked };
}

type Case = ReturnType<typeof makeCase>;

// The invariants, each computed from the raw case. Returns the names of any broken ones.
function broken(c: Case, d: Decision): string[] {
  const { mandate: m, proposal: p, context: ctx } = c;
  const out: string[] = [];
  const captured = d.action === "capture";

  if (captured) {
    const max = m.payment.amount_range.max;
    if (max === null || !(d.amount <= max)) out.push("capture exceeds the approved limit");
    if (!(d.amount <= ctx.held)) out.push("capture exceeds the amount held");
  }

  const needed = [...m.ext.must_haves, ...m.ext.conditions_of_sale];
  const unproven = needed.some((pref) => p.checks.find((r) => r.attr === pref.attr && r.value === pref.value)?.verdict !== "checked");
  if (captured && unproven) out.push("captured with a must-have that didn't match or couldn't be checked");

  if (captured && c.blocked) out.push("captured a blocked category");

  if (captured && !(NOW < new Date(m.exp.at).getTime())) out.push("captured on an expired mandate");

  const has = (t: Checkin["type"]) => m.ext.checkins.some((x) => x.type === t);
  const allowed = m.checkout.allowed_merchants.map((s) => s.domain);
  const fired =
    m.ext.checkins.some((x) => x.type === "over_amount" && p.total > x.value) ||
    (p.is_substitute && has("substitute")) ||
    (has("new_store") && !allowed.includes(p.product.store)) ||
    (p.price_at_approval !== undefined && p.price_at_approval !== p.product.price) ||
    p.final_sale === true ||
    p.returns === "kind" || p.returns === "not_found" ||
    (ctx.recent_purchases ?? []).some((r) => r.product_id === p.product.id && NOW - new Date(r.at).getTime() < 24 * HOUR);
  if (captured && fired) out.push("captured although a check-in fired");

  return out;
}

test(`${CASES.toLocaleString("en-US")} random cases: no capture ever breaks a promise to the shopper (seed ${SEED})`, () => {
  const rand = prng(SEED);
  const counts = { capture: 0, void: 0, ask: 0 };
  for (let i = 0; i < CASES; i++) {
    const c = makeCase(rand);
    const d = decide(c.mandate, c.proposal, c.context);
    counts[d.action]++;
    const bad = broken(c, d);
    if (bad.length) {
      const replay = JSON.stringify({ ...c, context: { ...c.context, now: c.context.now.toISOString() } }, null, 2);
      assert.fail(`seed ${SEED}, case #${i}: ${bad.join("; ")}\ndecision: ${JSON.stringify(d)}\ncase: ${replay}`);
    }
  }
  // Guard against a test that passes because nothing is ever captured: every outcome must be common.
  for (const [action, n] of Object.entries(counts)) {
    assert.ok(n >= CASES * 0.02, `only ${n} ${action} decisions in ${CASES}: the generator isn't reaching that path (${JSON.stringify(counts)})`);
  }
  console.log(`seed ${SEED}: ${JSON.stringify(counts)}, 0 violations`);
});
