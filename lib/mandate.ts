// The shopper's instructions, as structured data. Frozen Nov 5.
//
// Hard limits use AP2 / Verifiable Intent field names (checkout, payment, exp, match_mode).
// Everything beyond those protocols lives in `ext`, so the protocol fields stay clean:
// this is a reference consent screen, not a new protocol.
//
// Every limit records the phrase it came from (`source_phrase`), so the readback screen can
// show "You said → What it will do". `source_phrase: null` means the app chose a safe default.

import { z } from "zod";

const SourcePhrase = z.string().nullable();

export const LineItem = z.object({
  description: z.string(), // what to buy, e.g. "trail running shoes"
  quantity: z.number().int().positive().default(1),
  source_phrase: SourcePhrase,
});

export const Merchant = z.object({
  domain: z.string(), // e.g. "rei.com"
  source_phrase: SourcePhrase,
});

export const Pref = z.object({
  attr: z.string(), // e.g. "waterproof", "size", "free returns"
  value: z.string(), // e.g. "yes", "8", "yes"
  source_phrase: SourcePhrase,
});

export const Checkin = z.discriminatedUnion("type", [
  // value 0 = "show me before you pay for anything"
  z.object({ type: z.literal("over_amount"), value: z.number().nonnegative(), source_phrase: SourcePhrase }),
  z.object({ type: z.literal("substitute"), source_phrase: SourcePhrase }),
  z.object({ type: z.literal("new_store"), source_phrase: SourcePhrase }),
]);

export const Unmapped = z.object({
  phrase: z.string(), // verbatim from the shopper
  reason: z.string(), // plain words, e.g. "Stores don't share this information"
});

export const Mandate = z.object({
  source_text: z.string(), // the shopper's exact words

  checkout: z.object({
    line_items: z.array(LineItem), // empty = ANY product → warning
    allowed_merchants: z.array(Merchant), // empty = ANY store → warning
    // Stores the shopper chose to leave out, from a "From your past purchases" suggestion. Only the
    // shopper adds these (one tap); the model never does. Absent = none.
    avoid_merchants: z.array(Merchant).optional(),
  }),

  payment: z.object({
    amount_range: z.object({
      max: z.number().positive().nullable(), // the most PayPal may take; the demo holds the listed item price (shipping isn't known); null = no amount → warning
      currency: z.literal("USD"),
      source_phrase: SourcePhrase,
    }),
    budget: z.number().positive().nullable(), // total across repeat buys
    recurrence: z.enum(["one_time", "monthly", "weekly"]).default("one_time"),
    vault_id: z.string().nullable().default(null), // saved PayPal account; set by the app, never by the model
  }),

  exp: z.object({
    at: z.string(), // ISO time
    source_phrase: SourcePhrase,
  }),

  match_mode: z.enum(["exact", "minimum"]), // exact = only the item named; minimum = similar items OK
  ship_to: z.object({ note: z.string(), source_phrase: SourcePhrase }).nullable(),

  ext: z.object({
    must_haves: z.array(Pref),
    conditions_of_sale: z.array(Pref), // e.g. free returns, new condition
    deliver_by: z.object({ date: z.string(), source_phrase: SourcePhrase }).nullable(),
    checkins: z.array(Checkin),
    unmapped: z.array(Unmapped),
  }),
});

export type Mandate = z.infer<typeof Mandate>;
export type Pref = z.infer<typeof Pref>;
export type Checkin = z.infer<typeof Checkin>;

// Safe default for people who never set rules: ask before a substitute. Asking before a new store
// is only added when the shopper says so.
export const DEFAULT_CHECKINS: Checkin[] = [
  { type: "substitute", source_phrase: null },
];
