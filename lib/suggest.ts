// "From your past purchases": suggestions on the readback, built from the shopper's own history
// (lib/history.ts). Plain code, no AI. The rule (build-plan.md, "Feedback loop"): a suggestion is
// only applied when the shopper taps it, it names the purchase it came from, and suggestions that
// tighten a limit come before, and read stronger than, ones that loosen it.

import type { HistoryEntry } from "./history.ts";
import type { Mandate } from "./mandate.ts";
import type { Fix } from "./warnings.ts";

export type Suggestion = {
  id: string;
  kind: "tighten" | "loosen";
  message: string;
  source: string; // which past purchase it came from, in plain words
  fix: Fix;
};

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).map((w) => w.replace(/s$/, "")));
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const sourceOf = (e: HistoryEntry) => `${e.product}, ${e.store}, ${day(e.at)}`;

// Is a past purchase about the same kind of thing? ("waterproof running shoes" vs "running shoes")
function similar(e: HistoryEntry, m: Mandate): boolean {
  const now = words(m.checkout.line_items.map((l) => l.description).join(" ") || m.source_text);
  return [...words(e.item)].some((w) => now.has(w));
}

export function suggest(m: Mandate, history: HistoryEntry[], limit = 3): Suggestion[] {
  const out: Suggestion[] = [];
  const avoided = new Set((m.checkout.avoid_merchants ?? []).map((s) => s.domain));
  const allowed = new Set(m.checkout.allowed_merchants.map((s) => s.domain));
  const seen = new Set<string>();

  // 1. Tighten: a store the shopper had a bad experience with, whatever they're buying now.
  for (const e of history) {
    if (avoided.has(e.store) || seen.has(e.store)) continue;
    const why =
      e.rating === "wrong_item" ? `You reported a wrong item from ${e.store}.` :
      e.rating === "not_delivered" ? `Your order from ${e.store} didn't arrive.` :
      e.reason === "wrong_store" ? `You said ${e.store} was the wrong store.` : null;
    if (!why) continue;
    seen.add(e.store);
    out.push({ id: `avoid:${e.store}`, kind: "tighten", message: `${why} Leave it out?`, source: sourceOf(e), fix: { type: "avoid_store", domain: e.store } });
  }

  // 2. Tighten: a similar item the shopper turned down as too expensive.
  const max = m.payment.amount_range.max;
  const pricey = history.find((e) => e.reason === "too_expensive" && similar(e, m));
  if (pricey && max !== null) {
    const lower = Math.floor((pricey.amount - 0.01) / 5) * 5;
    if (lower >= 5 && lower < max) {
      out.push({ id: `max:${lower}`, kind: "tighten", message: `You turned down ${money(pricey.amount)} as too expensive. Lower your limit to ${money(lower)}?`, source: sourceOf(pricey), fix: { type: "set_max", value: lower } });
    }
  }

  // 3. Loosen: the shopper keeps saying yes above their ask-first amount for this kind of item.
  const ask = m.ext.checkins.find((c): c is Extract<typeof c, { type: "over_amount" }> => c.type === "over_amount");
  if (ask && ask.value > 0) {
    const yes = history.filter((e) => e.outcome === "bought" && e.asked_because?.includes("over_amount") && e.amount > ask.value && similar(e, m) && e.rating !== "wrong_item");
    if (yes.length >= 2) {
      const raised = Math.ceil(Math.max(...yes.map((e) => e.amount)) / 10) * 10;
      if (raised > ask.value && (max === null || raised <= max)) {
        out.push({
          id: `ask:${raised}`, kind: "loosen",
          message: `You said yes above ${money(ask.value)} ${yes.length} times for this. Ask you above ${money(raised)} instead?`,
          source: sourceOf(yes[0]), fix: { type: "set_checkin_amount", value: raised },
        });
      }
    }
  }

  // 4. Loosen: a store the shopper bought this kind of item from, when this request names stores.
  if (allowed.size > 0) {
    const good = history.find((e) => e.outcome === "bought" && !e.rating?.match(/wrong_item|not_delivered/) && similar(e, m) && !allowed.has(e.store) && !avoided.has(e.store) && !seen.has(e.store));
    if (good) {
      out.push({ id: `add:${good.store}`, kind: "loosen", message: `You bought this from ${good.store} before. Add it to your stores?`, source: sourceOf(good), fix: { type: "add_store", domain: good.store } });
    }
  }

  return out.slice(0, limit);
}
