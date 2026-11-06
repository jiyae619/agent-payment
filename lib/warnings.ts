// "Things to double-check" on the readback screen. Plain code, no AI: these rules exist to
// catch a draft that doesn't match what the shopper said, or that gives away more than they meant.
// Every warning comes with at most one fix the shopper can apply with one tap.

import { amountsSaid } from "./amounts.ts";
import type { Checkin, Mandate } from "./mandate.ts";

export type Fix =
  | { type: "set_max"; value: number }
  | { type: "ask_before_paying" } // check-in at $0: show me before paying anything
  | { type: "set_hours"; hours: number }
  | { type: "set_budget"; value: number }
  | { type: "remove_store"; domain: string }
  | { type: "any_store_ok" }
  | { type: "set_checkin_amount"; value: number };

export type Warning = {
  id: "no_amount" | "amount_mismatch" | "checkin_mismatch" | "any_product" | "long_expiry" | "recurring_no_budget" | "store_not_named" | "any_store";
  message: string; // plain words, shown as-is
  fix: { label: string; action: Fix } | null;
};

const HOUR = 3600 * 1000;
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function findWarnings(m: Mandate, now = new Date()): Warning[] {
  const warnings: Warning[] = [];
  const said = amountsSaid(m.source_text);
  const largest = said.length ? Math.max(...said) : null;
  const max = m.payment.amount_range.max;

  if (max === null) {
    warnings.push({
      id: "no_amount",
      message: "You didn't say how much to spend.",
      fix: { label: "Show me the price before paying", action: { type: "ask_before_paying" } },
    });
  } else if (largest === null) {
    warnings.push({
      id: "amount_mismatch",
      message: `You didn't mention a price, but this allows up to ${money(max)}.`,
      fix: { label: "Show me the price before paying", action: { type: "ask_before_paying" } },
    });
  } else if (!said.includes(max) || max > largest) {
    warnings.push({
      id: "amount_mismatch",
      message: `You said ${money(largest)}, but this allows ${money(max)}.`,
      fix: { label: `Change to ${money(largest)}`, action: { type: "set_max", value: largest } },
    });
  }

  for (const c of m.ext.checkins) {
    if (c.type === "over_amount" && c.value > 0 && !said.includes(c.value)) {
      const target = said.filter((a) => a < (max ?? Infinity)).sort((a, b) => b - a)[0];
      warnings.push({
        id: "checkin_mismatch",
        message: `This asks you first above ${money(c.value)}, but you didn't say ${money(c.value)}.`,
        fix: target !== undefined ? { label: `Ask me above ${money(target)}`, action: { type: "set_checkin_amount", value: target } } : null,
      });
    }
  }

  if (m.checkout.line_items.length === 0) {
    warnings.push({
      id: "any_product",
      message: "Right now it could buy anything at this store, even a gift card.",
      fix: { label: "Show me before paying", action: { type: "ask_before_paying" } },
    });
  }

  const hoursLeft = (new Date(m.exp.at).getTime() - now.getTime()) / HOUR;
  if (m.payment.recurrence === "one_time" && hoursLeft > 25) {
    warnings.push({
      id: "long_expiry",
      message: `This lasts ${Math.round(hoursLeft / 24)} days. For one purchase, 1 day is usually enough.`,
      fix: { label: "Make it 1 day", action: { type: "set_hours", hours: 24 } },
    });
  }

  if (m.payment.recurrence !== "one_time" && m.payment.budget === null) {
    const perTime = max ?? largest;
    warnings.push({
      id: "recurring_no_budget",
      message: "There's no total limit if it keeps buying.",
      fix: perTime ? { label: `Stop after 3 purchases (${money(perTime * 3)} total)`, action: { type: "set_budget", value: perTime * 3 } } : null,
    });
  }

  const text = m.source_text.toLowerCase();
  const words = text.match(/[a-z0-9]+/g) ?? [];
  for (const s of m.checkout.allowed_merchants) {
    const name = s.domain.replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/g, "");
    // A store counts as named if its site name appears, or the shopper used its brand:
    // "Brooks" names brooksrunning.com. Short words ("the") are too loose to count.
    const named = text.includes(name) || words.some((w) => w.length >= 4 && name.startsWith(w));
    if (!named) {
      warnings.push({
        id: "store_not_named",
        message: `You didn't mention ${s.domain}.`,
        fix: { label: `Remove ${s.domain}`, action: { type: "remove_store", domain: s.domain } },
      });
    }
  }

  if (m.checkout.allowed_merchants.length === 0 && m.ext.checkins.some((c) => c.type === "new_store")) {
    warnings.push({
      id: "any_store",
      message: "You didn't name a store, so it will ask you before buying from any store.",
      fix: { label: "Any store is fine", action: { type: "any_store_ok" } },
    });
  }

  return warnings;
}

export function applyFix(m: Mandate, fix: Fix): Mandate {
  const next: Mandate = structuredClone(m);
  const checkins = next.ext.checkins;
  const setOverAmount = (value: number) => {
    const existing = checkins.find((c): c is Extract<Checkin, { type: "over_amount" }> => c.type === "over_amount");
    if (existing) existing.value = value;
    else checkins.push({ type: "over_amount", value, source_phrase: null });
  };

  switch (fix.type) {
    case "set_max":
      next.payment.amount_range.max = fix.value;
      break;
    case "ask_before_paying":
      setOverAmount(0);
      break;
    case "set_checkin_amount":
      setOverAmount(fix.value);
      break;
    case "set_hours":
      next.exp.at = new Date(Date.now() + fix.hours * HOUR).toISOString();
      break;
    case "set_budget":
      next.payment.budget = fix.value;
      break;
    case "remove_store":
      next.checkout.allowed_merchants = next.checkout.allowed_merchants.filter((s) => s.domain !== fix.domain);
      break;
    case "any_store_ok":
      next.ext.checkins = checkins.filter((c) => c.type !== "new_store");
      break;
  }
  return next;
}
