// What Claude returns when it drafts instructions, and how the app turns that into a Mandate.
// The draft is deliberately flat and simple (no defaults, no unions) for structured output;
// the app, not the model, sets the expiry time, safe default check-ins and the payment account.

import { z } from "zod";
import { DEFAULT_CHECKINS, Mandate, type Checkin } from "./mandate.ts";

const Phrase = z.string().nullable().describe("Exact words copied from the request, or null if none");

export const Draft = z.object({
  line_items: z.array(
    z.object({
      description: z.string().describe("What to buy, short, e.g. 'trail running shoes'"),
      quantity: z.number().int(),
      source_phrase: Phrase,
    }),
  ),
  stores: z.array(
    z.object({ domain: z.string().describe("Store website, e.g. 'rei.com'"), source_phrase: Phrase }),
  ),
  any_store_ok_phrase: Phrase.describe("Words saying any store is fine, e.g. 'any store is fine'"),
  max_total: z.object({
    amount: z.number().nullable().describe("Most the shopper will pay in USD; null if they gave no number"),
    source_phrase: Phrase,
  }),
  budget_total: z.number().nullable().describe("Total limit across repeat purchases, only if stated"),
  recurrence: z.enum(["one_time", "monthly", "weekly"]),
  valid_for_hours: z.object({
    hours: z.number().nullable().describe("How long the shopper wants it to keep looking; null if not said"),
    source_phrase: Phrase,
  }),
  exact_item_only: z.object({ value: z.boolean(), source_phrase: Phrase }),
  ship_to: z.object({ note: z.string(), source_phrase: Phrase }).nullable(),
  must_haves: z.array(
    z.object({
      attr: z.string().describe("Lowercase feature name, e.g. 'size', 'waterproof', 'scent'"),
      value: z.string().describe("e.g. '8', 'yes', 'unscented'"),
      source_phrase: Phrase,
    }),
  ),
  conditions_of_sale: z.array(
    z.object({
      attr: z.string().describe("e.g. 'free returns', 'condition'"),
      value: z.string().describe("e.g. 'yes', 'new'"),
      source_phrase: Phrase,
    }),
  ),
  deliver_by: z.object({ when: z.string(), source_phrase: Phrase }).nullable(),
  checkins: z.array(
    z.object({
      type: z.enum(["over_amount", "substitute", "new_store"]),
      amount: z.number().nullable().describe("For over_amount only; 0 means 'show me before you pay anything'"),
      source_phrase: Phrase,
    }),
  ),
  unmapped: z.array(
    z.object({
      phrase: z.string().describe("Exact words from the request"),
      reason: z.string().describe("Why it can't be a rule, in plain words for a non-technical person"),
    }),
  ),
});

export type Draft = z.infer<typeof Draft>;

const HOUR = 3600 * 1000;

// Turn Claude's draft into a validated Mandate. Safe defaults are added here, in code.
export function normalizeDraft(draft: Draft, sourceText: string, now = new Date()): Mandate {
  const checkins: Checkin[] = draft.checkins.map((c) =>
    c.type === "over_amount"
      ? { type: "over_amount", value: Math.max(0, c.amount ?? 0), source_phrase: c.source_phrase }
      : { type: c.type, source_phrase: c.source_phrase },
  );

  // Default: ask before a substitute, unless the shopper already said so or wants only the exact item.
  if (!checkins.some((c) => c.type === "substitute")) checkins.push(DEFAULT_CHECKINS[0]);
  // Default: ask before a store the shopper didn't name, unless they said any store is fine.
  if (!draft.any_store_ok_phrase && !checkins.some((c) => c.type === "new_store")) checkins.push(DEFAULT_CHECKINS[1]);

  const recurring = draft.recurrence !== "one_time";
  const hours = draft.valid_for_hours.hours ?? (recurring ? 24 * 30 : 24);

  return Mandate.parse({
    source_text: sourceText,
    checkout: {
      line_items: draft.line_items.map((li) => ({ ...li, quantity: Math.max(1, li.quantity) })),
      allowed_merchants: draft.stores.map((s) => ({ domain: s.domain.toLowerCase(), source_phrase: s.source_phrase })),
    },
    payment: {
      amount_range: {
        max: draft.max_total.amount && draft.max_total.amount > 0 ? draft.max_total.amount : null,
        currency: "USD",
        source_phrase: draft.max_total.source_phrase,
      },
      budget: draft.budget_total && draft.budget_total > 0 ? draft.budget_total : null,
      recurrence: draft.recurrence,
      vault_id: null,
    },
    exp: { at: new Date(now.getTime() + hours * HOUR).toISOString(), source_phrase: draft.valid_for_hours.source_phrase },
    match_mode: draft.exact_item_only.value ? "exact" : "minimum",
    ship_to: draft.ship_to,
    ext: {
      must_haves: draft.must_haves,
      conditions_of_sale: draft.conditions_of_sale,
      deliver_by: draft.deliver_by ? { date: draft.deliver_by.when, source_phrase: draft.deliver_by.source_phrase } : null,
      checkins,
      unmapped: draft.unmapped,
    },
  });
}
