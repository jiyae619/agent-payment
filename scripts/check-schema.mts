// Sanity check: a hand-built mandate for fixture shoes-01 parses, and bad ones are rejected.
// Run: node scripts/check-schema.mts
import { Mandate, DEFAULT_CHECKINS } from "../lib/mandate.ts";

const good = {
  source_text: "running shoes size 8 waterproof under 120. free returns pls. ask me if its over 100",
  checkout: { line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }], allowed_merchants: [] },
  payment: { amount_range: { max: 120, currency: "USD", source_phrase: "under 120" }, budget: null },
  exp: { at: new Date(Date.now() + 24 * 3600e3).toISOString(), source_phrase: null },
  match_mode: "minimum",
  ship_to: null,
  ext: {
    must_haves: [
      { attr: "size", value: "8", source_phrase: "size 8" },
      { attr: "waterproof", value: "yes", source_phrase: "waterproof" },
    ],
    conditions_of_sale: [{ attr: "free returns", value: "yes", source_phrase: "free returns pls" }],
    deliver_by: null,
    checkins: [{ type: "over_amount", value: 100, source_phrase: "ask me if its over 100" }, ...DEFAULT_CHECKINS],
    unmapped: [],
  },
};

const parsed = Mandate.parse(good);
console.log("good mandate parses:", parsed.payment.recurrence, parsed.payment.vault_id, parsed.ext.checkins.length, "check-ins");

const bad = [
  ["negative cap", { ...good, payment: { ...good.payment, amount_range: { ...good.payment.amount_range, max: -5 } } }],
  ["unknown check-in type", { ...good, ext: { ...good.ext, checkins: [{ type: "always_buy", source_phrase: null }] } }],
  ["non-USD", { ...good, payment: { ...good.payment, amount_range: { ...good.payment.amount_range, currency: "EUR" } } }],
] as const;
for (const [name, m] of bad) {
  console.log(`${name}: ${Mandate.safeParse(m).success ? "ACCEPTED (wrong)" : "rejected (right)"}`);
}
