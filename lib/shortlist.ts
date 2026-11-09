// Search results → the 2–3 products the AI may choose from. Plain code, no AI: every product the
// shopper's limits rule out is dropped here, and each step is counted for the decision funnel
// ("Found 9 → 7 not gift cards → 4 under $120 → …"). The AI's pick is re-checked by enforcement anyway.

import type { CatalogProduct } from "./catalog.ts";
import { isBlockedCategory } from "./enforce.ts";
import type { Mandate } from "./mandate.ts";

export type FunnelStep = { label: string; count: number };
export type Shortlist = { funnel: FunnelStep[]; candidates: CatalogProduct[] };

const domain = (d: string) => d.trim().toLowerCase().replace(/^www\./, "");
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

// Everything the store says about the item, for word matching.
export const productText = (p: CatalogProduct) =>
  [p.title, p.description ?? "", ...p.key_features, ...Object.values(p.attributes), ...p.sizes].join("\n").toLowerCase();

// Does the listing mention this must-have at all? Only for ranking: "not waterproof" also mentions
// waterproof, so the product checker still has to confirm it with a quote.
export function mentions(p: CatalogProduct, value: string, attr: string): boolean {
  const text = productText(p);
  const v = value.toLowerCase();
  if (v === "yes" || v === "true") return text.includes(attr.toLowerCase());
  if (/^\d+(\.\d+)?$/.test(v)) return p.sizes.some((s) => words(s).includes(v)) || words(text).includes(v);
  return text.includes(v);
}

// Is this the item the shopper named? Every word of what they named must appear in the title.
// Anything less counts as a similar item, so a "substitute" check-in asks the shopper first.
export function isNamedItem(m: Mandate, p: CatalogProduct): boolean {
  if (m.checkout.line_items.length === 0) return true; // nothing named: no substitute to ask about
  const title = new Set(words(p.title).map((w) => w.replace(/s$/, "")));
  return m.checkout.line_items.some((l) => words(l.description).every((w) => title.has(w.replace(/s$/, ""))));
}

export function searchQuery(m: Mandate): string {
  const named = m.checkout.line_items.map((l) => l.description).join(" ");
  if (!named) return m.source_text;
  const extras = m.ext.must_haves.map((h) => (h.value === "yes" ? h.attr : h.attr === "brand" ? h.value : "")).filter(Boolean);
  return [named, ...extras].join(" ");
}

export function shortlist(m: Mandate, products: CatalogProduct[], size = 3): Shortlist {
  const funnel: FunnelStep[] = [{ label: "found", count: products.length }];
  let left = products.filter((p) => p.in_stock);

  left = left.filter((p) => !isBlockedCategory(p));
  funnel.push({ label: "not gift cards or money", count: left.length });

  const max = m.payment.amount_range.max;
  if (max !== null) {
    // The limit covers the whole purchase: 3 bottles at $20 is $60, over a $50 limit.
    const qty = m.checkout.line_items[0]?.quantity ?? 1;
    left = left.filter((p) => Math.round(p.price * qty * 100) <= Math.round(max * 100));
    funnel.push({ label: `under ${money(max)}`, count: left.length });
  }

  const stores = m.checkout.allowed_merchants.map((s) => domain(s.domain));
  if (stores.length) {
    left = left.filter((p) => stores.includes(domain(p.store)));
    funnel.push({ label: `at ${m.checkout.allowed_merchants.map((s) => s.domain).join(" or ")}`, count: left.length });
  }
  const avoid = (m.checkout.avoid_merchants ?? []).map((s) => domain(s.domain));
  if (avoid.length) {
    left = left.filter((p) => !avoid.includes(domain(p.store)));
    funnel.push({ label: `not from ${m.checkout.avoid_merchants!.map((s) => s.domain).join(" or ")}`, count: left.length });
  }

  // Rank: most must-haves mentioned, then the named item before similar ones, then cheapest.
  const prefs = m.ext.must_haves;
  const score = (p: CatalogProduct) => prefs.filter((h) => mentions(p, h.value, h.attr)).length;
  for (const h of prefs) {
    funnel.push({ label: `mention ${h.value === "yes" ? h.attr : `${h.attr} ${h.value}`}`, count: left.filter((p) => mentions(p, h.value, h.attr)).length });
  }
  const ranked = [...left].sort(
    (a, b) => score(b) - score(a) || Number(isNamedItem(m, b)) - Number(isNamedItem(m, a)) || a.price - b.price,
  );
  return { funnel, candidates: ranked.slice(0, size) };
}

// Why a search result didn't make the shortlist, in the shopper's words (for the live shelf).
// Same rules, same order as shortlist() above, so the reason shown is the one that removed it.
export function whyDropped(m: Mandate, p: CatalogProduct): string {
  if (!p.in_stock) return "Out of stock";
  if (isBlockedCategory(p)) return "Gift card or money";
  const max = m.payment.amount_range.max;
  const qty = m.checkout.line_items[0]?.quantity ?? 1;
  if (max !== null && Math.round(p.price * qty * 100) > Math.round(max * 100)) return qty > 1 ? `Over ${money(max)} for ${qty}` : `Over ${money(max)}`;
  const stores = m.checkout.allowed_merchants.map((s) => domain(s.domain));
  if (stores.length && !stores.includes(domain(p.store))) return "Not a store you named";
  if ((m.checkout.avoid_merchants ?? []).some((s) => domain(s.domain) === domain(p.store))) return "A store you avoid";
  return "Ranked lower";
}
