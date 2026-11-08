// What happens to the PayPal hold. Plain code, no AI, no network: the AI only proposes a purchase,
// this function decides whether the held money is taken (capture), released (void), or whether the
// shopper is asked first (ask). Pure, so every decision can be replayed and tested.
//
// Order follows the plan: hard limits, then the product checker's results, then check-ins.
// Any hard-limit or product-check failure releases the hold; check-ins run only when nothing failed.

import type { CatalogProduct } from "./catalog.ts";
import type { Mandate } from "./mandate.ts";

// The product checker's answer for one must-have or condition of sale (same words as the eval set).
export type Verdict = "checked" | "didnt_match" | "couldnt_check";
export type CheckResult = { attr: string; value: string; verdict: Verdict; quote: string | null };

export type Proposal = {
  product: CatalogProduct;
  quantity: number;
  total: number; // USD, what would be captured: listed price × quantity (shipping isn't known in the demo)
  checks: CheckResult[]; // from the product checker; a must-have with no result counts as "couldn't check"
  is_substitute: boolean; // true when this is not the item the shopper named (set by the pick step)
  final_sale?: boolean; // the listing says final sale / non-returnable; unset = the listing doesn't say
  price_at_approval?: number; // unit price the shopper saw when approving; unset = no earlier price to compare
};

export type Context = {
  now: Date;
  held: number; // USD amount PayPal is holding
  recent_purchases?: { product_id: string; at: string }[]; // the shopper's earlier captures, ISO times
};

export type VoidRule =
  | "no_limit" | "over_limit" | "over_hold" | "bad_total" | "store_not_allowed" | "expired"
  | "over_quantity" | "blocked_category" | "not_exact_item" | "didnt_match" | "couldnt_check";
export type CheckinRule = "over_amount" | "substitute" | "new_store" | "price_changed" | "final_sale" | "bought_recently";

export type Decision =
  | { action: "capture"; amount: number }
  | { action: "void"; reasons: { rule: VoidRule; message: string }[] }
  | { action: "ask"; checkins: { rule: CheckinRule; message: string }[] };

// Blocked by default: money-like items an agent can be tricked into buying and that can't be undone.
const BLOCKED = /gift[\s-]?cards?|prepaid|crypto|bitcoin|money[\s-]?(transfer|order)|wire[\s-]?transfer/i;
const DAY = 24 * 3600 * 1000;

const cents = (n: number) => Math.round(n * 100);
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const domain = (d: string) => d.trim().toLowerCase().replace(/^www\./, "");

export function isBlockedCategory(p: CatalogProduct): boolean {
  return BLOCKED.test(p.category ?? "") || BLOCKED.test(p.title);
}

export function decide(m: Mandate, p: Proposal, ctx: Context): Decision {
  const fails: { rule: VoidRule; message: string }[] = [];
  const fail = (rule: VoidRule, message: string) => fails.push({ rule, message });

  // 1. Hard limits.
  const max = m.payment.amount_range.max;
  const totalOk = Number.isFinite(p.total) && p.total > 0;
  if (!totalOk) fail("bad_total", "The price couldn't be read, so nothing was charged.");
  if (max === null) fail("no_limit", "You didn't approve a spending limit, so nothing was charged.");
  else if (totalOk && cents(p.total) > cents(max)) fail("over_limit", `It costs ${money(p.total)}, more than your ${money(max)} limit.`);
  if (totalOk && !(cents(p.total) <= cents(ctx.held))) fail("over_hold", `It costs ${money(p.total)}, more than the ${money(ctx.held)} PayPal is holding.`);

  const allowed = m.checkout.allowed_merchants.map((s) => domain(s.domain));
  if (allowed.length > 0 && !allowed.includes(domain(p.product.store))) {
    fail("store_not_allowed", `${p.product.store} isn't one of the stores you allowed.`);
  }

  const exp = new Date(m.exp.at).getTime();
  if (!(ctx.now.getTime() < exp)) fail("expired", "Your instructions ran out before a purchase was ready, so nothing was bought.");

  const maxQty = m.checkout.line_items.length ? Math.max(...m.checkout.line_items.map((l) => l.quantity)) : 1;
  if (!Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > maxQty) {
    fail("over_quantity", `It would buy ${p.quantity}, but you approved ${maxQty}.`);
  }

  if (isBlockedCategory(p.product)) fail("blocked_category", `"${p.product.title}" is a gift card, prepaid card, crypto or money transfer. These are never bought for you.`);

  if (p.is_substitute && m.match_mode === "exact") fail("not_exact_item", "This isn't the exact item you named.");

  // 2. Product checks. Every must-have and condition of sale needs a "checked" result.
  for (const pref of [...m.ext.must_haves, ...m.ext.conditions_of_sale]) {
    const r = p.checks.find((c) => c.attr === pref.attr && c.value === pref.value);
    if (!r || r.verdict === "couldnt_check") fail("couldnt_check", `Couldn't check "${pref.attr}: ${pref.value}" from the store's listing.`);
    else if (r.verdict === "didnt_match") fail("didnt_match", `The listing doesn't match "${pref.attr}: ${pref.value}".`);
  }

  if (fails.length) return { action: "void", reasons: fails };

  // 3. Check-ins: the shopper decides.
  const asks: { rule: CheckinRule; message: string }[] = [];
  const has = (type: string) => m.ext.checkins.some((c) => c.type === type);
  for (const c of m.ext.checkins) {
    if (c.type === "over_amount" && cents(p.total) > cents(c.value)) {
      asks.push({ rule: "over_amount", message: `It costs ${money(p.total)}, over the ${money(c.value)} you wanted to see first.` });
    }
  }
  if (p.is_substitute && has("substitute")) asks.push({ rule: "substitute", message: "This is a similar item, not the one you named." });
  if (has("new_store") && !allowed.includes(domain(p.product.store))) asks.push({ rule: "new_store", message: `${p.product.store} is a store you didn't name.` });
  if (p.price_at_approval !== undefined && cents(p.price_at_approval) !== cents(p.product.price)) {
    asks.push({ rule: "price_changed", message: `The price changed from ${money(p.price_at_approval)} to ${money(p.product.price)} since you approved.` });
  }
  if (p.final_sale) asks.push({ rule: "final_sale", message: "The store says this is final sale: it can't be returned." });
  const recent = (ctx.recent_purchases ?? []).some((r) => {
    const at = new Date(r.at).getTime();
    return r.product_id === p.product.id && !(ctx.now.getTime() - at >= DAY); // unreadable time counts as recent
  });
  if (recent) asks.push({ rule: "bought_recently", message: "You bought this same item in the last 24 hours." });

  if (asks.length) return { action: "ask", checkins: asks };

  return { action: "capture", amount: p.total };
}
