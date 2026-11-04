// Prints a sample Mandate (the shoes request with a deliberately wrong $150 limit) for
// checking the readback screen without calling Claude. Run: node scripts/sample-mandate.mts
import { normalizeDraft } from "../lib/draft-schema.ts";

const text = "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $100. No sponsored picks.";
const mandate = normalizeDraft(
  {
    line_items: [{ description: "running shoes", quantity: 1, source_phrase: "running shoes" }],
    stores: [],
    any_store_ok_phrase: null,
    max_total: { amount: 150, source_phrase: "under $120" },
    budget_total: null,
    recurrence: "one_time",
    valid_for_hours: { hours: null, source_phrase: null },
    exact_item_only: { value: false, source_phrase: null },
    ship_to: null,
    must_haves: [
      { attr: "waterproof", value: "yes", source_phrase: "Waterproof" },
      { attr: "size", value: "8", source_phrase: "size 8" },
    ],
    conditions_of_sale: [{ attr: "free returns", value: "yes", source_phrase: "Free returns please" }],
    deliver_by: null,
    checkins: [{ type: "over_amount", amount: 100, source_phrase: "Ask me if it's over $100" }],
    unmapped: [{ phrase: "No sponsored picks", reason: "Stores don't say which products are promoted, so this can't be checked." }],
  },
  text,
);
console.log(JSON.stringify(mandate));
