// The readback table: "You said → What it will do → How sure you can be".
// Built from fixed templates only. No AI writes these sentences; the model's draft
// only fills in values. Wording follows the word list in build-plan.md section 0.8.

import type { Mandate } from "./mandate.ts";

export type Label = "locked" | "checked" | "asks" | "cant_promise";

export const LABEL_TEXT: Record<Label, string> = {
  locked: "Locked by PayPal",
  checked: "Checked before paying",
  asks: "Asks you first",
  cant_promise: "Can't promise",
};

export type Row = {
  said: string | null; // the shopper's words; null = a safe default the app added
  willDo: string;
  label: Label;
};

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function untilText(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function readbackRows(m: Mandate): Row[] {
  const rows: Row[] = [];

  for (const li of m.checkout.line_items) {
    rows.push({
      said: li.source_phrase,
      willDo: li.quantity > 1 ? `Buy ${li.quantity} × ${li.description}, nothing else` : `Buy ${li.description}, nothing else`,
      label: "checked",
    });
  }

  const max = m.payment.amount_range;
  if (max.max !== null) {
    rows.push({ said: max.source_phrase, willDo: `Spend no more than ${money(max.max)}, shipping and tax included`, label: "locked" });
  }
  if (m.payment.recurrence !== "one_time") {
    rows.push({ said: null, willDo: `Buy again ${m.payment.recurrence === "monthly" ? "every month" : "every week"}`, label: "checked" });
  }
  if (m.payment.budget !== null) {
    rows.push({ said: null, willDo: `Stop once ${money(m.payment.budget)} has been spent in total`, label: "checked" });
  }

  if (m.checkout.allowed_merchants.length > 0) {
    const stores = m.checkout.allowed_merchants.map((s) => s.domain).join(" or ");
    rows.push({ said: m.checkout.allowed_merchants[0].source_phrase, willDo: `Only buy from ${stores}`, label: "checked" });
  }

  for (const p of m.ext.must_haves) {
    rows.push({ said: p.source_phrase, willDo: `Only pick one listed as ${describe(p.attr, p.value)}`, label: "checked" });
  }
  for (const p of m.ext.conditions_of_sale) {
    rows.push({ said: p.source_phrase, willDo: `Only buy if the store offers ${describe(p.attr, p.value)}`, label: "checked" });
  }
  if (m.ext.deliver_by) {
    rows.push({ said: m.ext.deliver_by.source_phrase, willDo: `Only buy if it can arrive by ${m.ext.deliver_by.date}`, label: "checked" });
  }

  for (const c of m.ext.checkins) {
    if (c.type === "over_amount") {
      rows.push({
        said: c.source_phrase,
        willDo: c.value === 0 ? "Show you the item and price before paying anything" : `Ask you before paying more than ${money(c.value)}`,
        label: "asks",
      });
    } else if (c.type === "substitute") {
      rows.push({
        said: c.source_phrase,
        willDo: m.match_mode === "exact" ? "Ask you before choosing anything but the exact item" : "Ask you before choosing a different brand or model",
        label: "asks",
      });
    } else {
      rows.push({
        said: c.source_phrase,
        willDo: m.checkout.allowed_merchants.length ? "Ask you before buying from any other store" : "Ask you before buying from a store you didn't name",
        label: "asks",
      });
    }
  }

  if (m.ship_to) {
    rows.push({ said: m.ship_to.source_phrase, willDo: `Ship to: ${m.ship_to.note}. You'll confirm the address with PayPal.`, label: "asks" });
  }

  rows.push({ said: m.exp.source_phrase, willDo: `Stop looking after ${untilText(m.exp.at)}`, label: "checked" });
  return rows;
}

function describe(attr: string, value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "true") return attr;
  if (attr.toLowerCase() === "size") return `size ${value}`;
  return `${attr}: ${value}`;
}
