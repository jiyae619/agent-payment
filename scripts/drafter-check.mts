// Scores one drafted mandate against a synthetic request's `expect` block.
// Shared by scripts/run-fixtures.mts (Claude direct) and scripts/eval.mts (many models).

import { findWarnings } from "../lib/warnings.ts";
import type { Mandate } from "../lib/mandate.ts";

export type Expect = {
  max: number | null; checkin_over: number | null; stores: string[]; must_haves: string[]; warnings: string[]; unmapped: string[];
  // Optional: left out of a request where its wording is ambiguous, and then not scored.
  not_must_haves?: string[]; // words that must not become a hard feature (a soft preference like "ask me if you want a different brand than Tide")
  quantity?: number; // how many items, across line items
  conditions_of_sale?: string[]; // store terms to keep, e.g. "free return"
  deliver_by?: string | null; // words of the deadline; null = none said, so none may be invented
  ship_to?: string | null; // a word of the destination; null = ships to the shopper
  exact_item?: boolean; // only the item named (match_mode "exact")
  substitute_asked?: boolean; // the shopper's own words ask before a substitute (not just the app's default)
  items?: string[]; // words that must appear in what to buy, e.g. "gift card", so code can see it
  search_window?: string | null; // words of how long to keep looking; null = not said (a deadline is not a search window)
  new_store_asked?: boolean; // the shopper's own words ask before a new store
  recurrence?: "one_time" | "weekly" | "monthly";
  budget?: number | null; // total across repeat buys
};
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

  const has = (text: string, want: string) => norm(want).split(" ").filter((w) => w !== "s").every((w) => text.includes(w));
  const prefText = (ps: { attr: string; value: string; source_phrase: string | null }[]) =>
    norm(ps.map((p) => `${p.attr} ${p.value} ${p.source_phrase ?? ""}`).join(" "));

  const features = prefText(m.ext.must_haves);
  for (const want of e.must_haves) if (!has(features, want)) problems.push(`must-have "${want}" missing`);
  for (const not of e.not_must_haves ?? []) if (has(features, not)) problems.push(`"${not}" made a hard must-have, but the shopper only asked to be asked`);

  if (e.quantity !== undefined) {
    const qty = m.checkout.line_items.reduce((s, li) => s + li.quantity, 0);
    if (qty !== e.quantity) problems.push(`quantity ${qty} ≠ expected ${e.quantity}`);
  }

  const terms = prefText(m.ext.conditions_of_sale);
  for (const want of e.conditions_of_sale ?? []) if (!has(terms, want)) problems.push(`condition of sale "${want}" missing`);

  if (e.deliver_by !== undefined) {
    const d = m.ext.deliver_by;
    if (e.deliver_by === null && d) problems.push(`deadline "${d.date}" invented`);
    if (e.deliver_by !== null && !(d && has(norm(`${d.date} ${d.source_phrase ?? ""}`), e.deliver_by))) problems.push(`deadline "${e.deliver_by}" missing`);
  }

  if (e.ship_to !== undefined) {
    const t = m.ship_to;
    if (e.ship_to === null && t) problems.push(`ship-to "${t.note}" invented`);
    if (e.ship_to !== null && !(t && has(norm(`${t.note} ${t.source_phrase ?? ""}`), e.ship_to))) problems.push(`ship-to "${e.ship_to}" missing`);
  }

  if (e.exact_item !== undefined && (m.match_mode === "exact") !== e.exact_item)
    problems.push(`exact item only ${m.match_mode === "exact"} ≠ expected ${e.exact_item}`);

  const itemText = norm(m.checkout.line_items.map((li) => `${li.description} ${li.source_phrase ?? ""}`).join(" | "));
  for (const want of e.items ?? []) if (!has(itemText, want)) problems.push(`item "${want}" missing from what to buy`);

  if (e.search_window !== undefined) {
    const w = m.exp.source_phrase;
    if (e.search_window === null && w) problems.push(`search window "${w}" invented`);
    if (e.search_window !== null && !(w && has(norm(w), e.search_window))) problems.push(`search window "${e.search_window}" missing`);
  }

  if (e.new_store_asked !== undefined) {
    const asked = m.ext.checkins.some((c) => c.type === "new_store" && c.source_phrase !== null);
    if (asked !== e.new_store_asked) problems.push(`ask-before-new-store from the shopper's words ${asked} ≠ expected ${e.new_store_asked}`);
  }

  if (e.recurrence !== undefined && m.payment.recurrence !== e.recurrence) problems.push(`recurrence ${m.payment.recurrence} ≠ expected ${e.recurrence}`);
  if (e.budget !== undefined && m.payment.budget !== e.budget) problems.push(`budget ${m.payment.budget} ≠ expected ${e.budget}`);

  if (e.substitute_asked !== undefined) {
    const asked = m.ext.checkins.some((c) => c.type === "substitute" && c.source_phrase !== null);
    if (asked !== e.substitute_asked) problems.push(`ask-before-substitute from the shopper's words ${asked} ≠ expected ${e.substitute_asked}`);
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
    ...m.ext.conditions_of_sale.map((x) => x.source_phrase),
    m.ext.deliver_by?.source_phrase,
    m.ship_to?.source_phrase,
    m.exp.source_phrase,
    ...m.ext.checkins.map((x) => x.source_phrase),
    ...m.ext.unmapped.map((x) => x.phrase),
  ].filter((p): p is string => Boolean(p));
  for (const p of phrases) if (!text.includes(p.toLowerCase())) problems.push(`"${p}" is not the shopper's exact words`);

  return problems;
}

// Problems that would mislead the shopper or overspend, not just a miss.
export function isCritical(problem: string): boolean {
  return /^max |^ask-above|not the shopper's exact words|^stores |^quantity |^budget |^item "gift card"/.test(problem);
}
