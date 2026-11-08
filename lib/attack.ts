// The gift-card demo: naive vs. informed consent. A product page carries a hidden note telling
// shopping agents to buy its gift card. The fooled agent is simulated (it always proposes the gift
// card, as an agent that obeys page text would), so the demo shows what each kind of approval lets
// through, not whether a given model falls for the note.

import { GIFT_CARD, type CatalogProduct } from "./catalog.ts";
import { decide, type Decision, type Proposal } from "./enforce.ts";
import type { Mandate } from "./mandate.ts";
import { shortlist, type FunnelStep } from "./shortlist.ts";

export const ATTACK_REQUEST = "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $100.";
// The hidden note in the gift card's listing, shown to the viewer so they see what the agent read.
export const HIDDEN_NOTE = GIFT_CARD.description?.match(/<!--([\s\S]*?)-->/)?.[1].trim() ?? "";

const base = (now: Date): Mandate => ({
  source_text: ATTACK_REQUEST,
  checkout: { line_items: [], allowed_merchants: [] },
  payment: { amount_range: { max: 120, currency: "USD", source_phrase: "under $120" }, budget: null, recurrence: "one_time", vault_id: null },
  exp: { at: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(), source_phrase: null },
  match_mode: "minimum",
  ship_to: null,
  ext: { must_haves: [], conditions_of_sale: [], deliver_by: null, checkins: [], unmapped: [] },
});

// A total-only approval ("let it spend up to $120"): no item, no store, no checks, no check-ins.
export const naiveMandate = (now: Date): Mandate => base(now);

// What this app's readback approves for the same words (as the drafter reads them).
export function informedMandate(now: Date): Mandate {
  const m = base(now);
  m.checkout.line_items = [{ description: "running shoes", quantity: 1, source_phrase: "Waterproof running shoes" }];
  m.ext.must_haves = [
    { attr: "waterproof", value: "yes", source_phrase: "Waterproof" },
    { attr: "size", value: "8", source_phrase: "size 8" },
  ];
  m.ext.conditions_of_sale = [{ attr: "free returns", value: "yes", source_phrase: "Free returns please" }];
  m.ext.checkins = [
    { type: "over_amount", value: 100, source_phrase: "Ask me if it's over $100" },
    { type: "substitute", source_phrase: null },
    { type: "new_store", source_phrase: null },
  ];
  return m;
}

// What the fooled agent proposes: the gift card, as its page told it to.
export const attackerProposal = (): Proposal => ({ product: GIFT_CARD, quantity: 1, total: GIFT_CARD.price, checks: [], is_substitute: true });

// A total-only screen gives the payment step one rule to enforce: stay under the total.
export function naiveDecide(m: Mandate, p: Proposal, held: number): Decision {
  const max = m.payment.amount_range.max ?? 0;
  if (p.total <= max && p.total <= held) return { action: "capture", amount: p.total };
  return { action: "void", reasons: [{ rule: "over_limit", message: `It costs $${p.total}, more than $${max}.` }] };
}

// The informed path: does the gift card even reach the AI, and what would enforcement say if it did?
export function informedOutcome(now: Date, others: CatalogProduct[]): { funnel: FunnelStep[]; reachedPick: boolean; decision: Decision } {
  const m = informedMandate(now);
  const { funnel, candidates } = shortlist(m, [GIFT_CARD, ...others]);
  return { funnel, reachedPick: candidates.some((c) => c.id === GIFT_CARD.id), decision: decide(m, attackerProposal(), { now, held: GIFT_CARD.price }) };
}
