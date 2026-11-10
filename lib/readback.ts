// The readback: what the assistant will do, one short line per rule, each tied to the shopper's
// own words. Built from fixed templates only. No AI writes these sentences; the model's draft
// only fills in values. Wording follows the word list in build-plan.md section 0.8: short,
// plain, no repetition (the shopper's full request is shown once, above the list).

import type { Mandate } from "./mandate.ts";

export type Label = "locked" | "checked" | "asks" | "cant_promise" | "never";

export const LABEL_TEXT: Record<Label, string> = {
  locked: "Locked by PayPal",
  checked: "Checked before paying",
  asks: "Asks you first",
  cant_promise: "Can't promise",
  never: "Never bought",
};

export type Row = {
  said: string | null; // the shopper's words; null = a safe default the app added
  willDo: string;
  label: Label;
  kind?: "expiry"; // shown apart from the list, as "Ends …"
};

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function untilText(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function readbackRows(m: Mandate): Row[] {
  const rows: Row[] = [];

  const max = m.payment.amount_range;
  if (max.max !== null) {
    // The demo holds the listed item price; shipping and tax aren't known, so the screen doesn't claim them.
    const qty = m.checkout.line_items[0]?.quantity ?? 1;
    rows.push({ said: max.source_phrase, willDo: `Up to ${money(max.max)} ${qty > 1 ? `in total for all ${qty}` : "in total"} · shipping not checked`, label: "locked" });
  }
  for (const li of m.checkout.line_items) {
    rows.push({ said: li.source_phrase, willDo: li.quantity > 1 ? `${li.quantity} × ${li.description} only` : `${cap(li.description)} only`, label: "checked" });
  }
  if (m.payment.recurrence !== "one_time") {
    rows.push({ said: null, willDo: `Buys again ${m.payment.recurrence === "monthly" ? "every month" : "every week"}`, label: "checked" });
  }
  if (m.payment.budget !== null) {
    rows.push({ said: null, willDo: `Stops after ${money(m.payment.budget)} in total`, label: "checked" });
  }

  if (m.checkout.allowed_merchants.length > 0) {
    const stores = m.checkout.allowed_merchants.map((s) => s.domain).join(" or ");
    rows.push({ said: m.checkout.allowed_merchants[0].source_phrase, willDo: `Only from ${stores}`, label: "checked" });
  }

  if ((m.checkout.avoid_merchants ?? []).length > 0) {
    rows.push({ said: null, willDo: `Not from ${m.checkout.avoid_merchants!.map((s) => s.domain).join(" or ")}`, label: "checked" });
  }

  for (const p of m.ext.must_haves) {
    rows.push({ said: p.source_phrase, willDo: `Must be ${describe(p.attr, p.value)}`, label: "checked" });
  }
  for (const p of m.ext.conditions_of_sale) {
    rows.push({ said: p.source_phrase, willDo: `Store must offer ${describe(p.attr, p.value)}`, label: "checked" });
  }
  if (m.ext.deliver_by) {
    rows.push({ said: m.ext.deliver_by.source_phrase, willDo: `Must arrive by ${m.ext.deliver_by.date}`, label: "checked" });
  }

  for (const c of m.ext.checkins) {
    if (c.type === "over_amount") {
      rows.push({ said: c.source_phrase, willDo: c.value === 0 ? "Shows you the item before paying" : `Asks you above ${money(c.value)}`, label: "asks" });
    } else if (c.type === "substitute") {
      rows.push({ said: c.source_phrase, willDo: m.match_mode === "exact" ? "Asks you before anything but the exact item" : "Asks you before a different brand or model", label: "asks" });
    } else {
      rows.push({ said: c.source_phrase, willDo: m.checkout.allowed_merchants.length ? "Asks you before any other store" : "Asks you before a store you didn't name", label: "asks" });
    }
  }

  if (m.ship_to) {
    rows.push({ said: m.ship_to.source_phrase, willDo: `Ships to ${m.ship_to.note} · you confirm the address with PayPal`, label: "asks" });
  }

  // Always enforced in code (lib/enforce.ts), whatever the shopper said.
  rows.push({ said: null, willDo: "Never gift cards, prepaid cards, crypto or money transfers", label: "never" });
  rows.push({ said: m.exp.source_phrase, willDo: `Ends ${untilText(m.exp.at)}`, label: "checked", kind: "expiry" });
  return rows;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function describe(attr: string, value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "true") return attr;
  if (attr.toLowerCase() === "size") return `size ${value}`;
  return `${attr}: ${value}`;
}
