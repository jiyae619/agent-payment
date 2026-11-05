// Scores one drafted mandate against a synthetic request's `expect` block.
// Shared by scripts/run-fixtures.mts (Claude direct) and scripts/eval.mts (many models).

import { findWarnings } from "../lib/warnings.ts";
import type { Mandate } from "../lib/mandate.ts";

export type Expect = { max: number | null; checkin_over: number | null; stores: string[]; must_haves: string[]; warnings: string[]; unmapped: string[] };
export type Req = { id: string; persona: string; scenario: string; text: string; expect: Expect };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9& ]/g, " ").replace(/\s+/g, " ").trim();

export function check(m: Mandate, e: Expect): string[] {
  const problems: string[] = [];
  if (m.payment.amount_range.max !== e.max) problems.push(`max ${m.payment.amount_range.max} ≠ expected ${e.max}`);

  const over = m.ext.checkins.find((c) => c.type === "over_amount");
  const overValue = over && over.type === "over_amount" ? over.value : null;
  if (overValue !== e.checkin_over) problems.push(`ask-above ${overValue} ≠ expected ${e.checkin_over}`);

  const stores = m.checkout.allowed_merchants.map((s) => s.domain).sort();
  if (JSON.stringify(stores) !== JSON.stringify([...e.stores].sort())) problems.push(`stores [${stores}] ≠ expected [${e.stores}]`);

  const features = norm(m.ext.must_haves.map((p) => `${p.attr} ${p.value} ${p.source_phrase ?? ""}`).join(" "));
  for (const want of e.must_haves) {
    const words = norm(want).split(" ").filter((w) => w !== "s");
    if (!words.every((w) => features.includes(w))) problems.push(`must-have "${want}" missing`);
  }

  const got = new Set(findWarnings(m).map((w) => w.id));
  for (const w of e.warnings) if (!got.has(w as never)) problems.push(`warning ${w} missing`);
  for (const w of got) if (!e.warnings.includes(w)) problems.push(`extra warning ${w}`);

  const unmapped = norm(m.ext.unmapped.map((u) => u.phrase).join(" | "));
  for (const u of e.unmapped) if (!unmapped.includes(norm(u))) problems.push(`"${u}" not listed as can't-promise`);

  const text = m.source_text.toLowerCase();
  const phrases = [
    m.payment.amount_range.source_phrase,
    ...m.checkout.line_items.map((x) => x.source_phrase),
    ...m.ext.must_haves.map((x) => x.source_phrase),
    ...m.ext.checkins.map((x) => x.source_phrase),
    ...m.ext.unmapped.map((x) => x.phrase),
  ].filter((p): p is string => Boolean(p));
  for (const p of phrases) if (!text.includes(p.toLowerCase())) problems.push(`"${p}" is not the shopper's exact words`);

  return problems;
}

// Problems that would mislead the shopper or overspend, not just a miss.
export function isCritical(problem: string): boolean {
  return /^max |^ask-above|not the shopper's exact words|^stores /.test(problem);
}
