// The product checker's plain-code parts, with no AI SDK import: what the model is shown, and the
// guard that keeps only answers backed by the store's own words. Shared by the app
// (lib/check-product.ts) and the model eval, including the Astropods container (zod only).

import type { CatalogProduct } from "./catalog.ts";
import type { CheckAnswer } from "./check-prompt.ts";
import type { CheckResult } from "./enforce.ts";
import type { Pref } from "./mandate.ts";
import type { Policy } from "./policy.ts";

// Everything the store says about the item: the only text a quote may come from.
export function listingText(p: CatalogProduct): string {
  const attrs = Object.entries(p.attributes).map(([k, v]) => `${k}: ${v}`);
  return [p.title, p.description ?? "", ...p.key_features, ...attrs, p.sizes.length ? `Sizes: ${p.sizes.join(", ")}` : "", p.condition ? `Condition: ${p.condition}` : ""]
    .filter(Boolean)
    .join("\n");
}

// The message the checker model gets: the requirements, the listing, and the store's policy if known.
export function checkMessage(product: CatalogProduct, reqs: Pref[], policy: Policy | null): string {
  const policyBlock = policy ? `Store return policy (${product.store}, from ${policy.url}):\n${policy.text}` : `Store return policy: not known for ${product.store}.`;
  const reqLines = reqs.map((r) => `- attr: ${JSON.stringify(r.attr)}, value: ${JSON.stringify(r.value)}`).join("\n");
  return `Requirements:\n${reqLines}\n\n<listing store="${product.store}">\n${listingText(product)}\n</listing>\n\n<policy>\n${policyBlock}\n</policy>`;
}

// The text a quote must come from: the listing plus the policy.
export const quoteSources = (product: CatalogProduct, policy: Policy | null) => `${listingText(product)}\n${policy?.text ?? ""}`;

// Words the store uses to say an item can't be returned. Plain code, so the final-sale check-in
// doesn't depend on the AI noticing it.
export function isFinalSale(p: CatalogProduct, policy: Policy | null): boolean {
  const text = `${listingText(p)}\n${policy?.text ?? ""}`;
  return /final sale|non-?returnable|no returns|cannot be returned|can't be returned|(do not|don't|cannot|can't) accept returns/i.test(text);
}

// Can this purchase be undone? Plain code, from the store's own words. The evidence label is what
// the shopper sees; "kind" and "not_found" make enforcement ask before paying (lib/enforce.ts).
export type ReturnsEvidence = "final_sale" | "kind" | "listing" | "policy" | "not_found";
export type Returns = { evidence: ReturnsEvidence; label: string };

// Items that usually can't be returned whatever the store's policy says.
const NO_RETURN_KIND = /personali[sz]ed|custom[- ]?(made|printed|engraved)|engraved|monogram|perishable|fresh (flowers|food)|\btickets?\b|digital (download|code)|e-?gift/i;

export function returnsFor(p: CatalogProduct, policy: Policy | null): Returns {
  if (isFinalSale(p, policy)) return { evidence: "final_sale", label: "Returns: final sale, can't be returned" };
  if (NO_RETURN_KIND.test(`${p.title}\n${p.category ?? ""}`)) return { evidence: "kind", label: "Returns: this kind of item usually can't be returned" };
  if (/\breturn(s|able|ed)?\b/i.test(listingText(p))) return { evidence: "listing", label: "Returns: stated in the listing" };
  if (policy) return { evidence: "policy", label: "Returns: found on the store's policy page" };
  return { evidence: "not_found", label: "Returns: not found, treated as final sale, please check" };
}

// Keep only answers the store's words support.
export function verify(reqs: Pref[], answer: CheckAnswer, sources: string): CheckResult[] {
  return reqs.map((r) => {
    const a = answer.results.find((x) => x.attr === r.attr && x.value === r.value);
    if (!a) return { attr: r.attr, value: r.value, verdict: "couldnt_check", quote: null };
    const quoted = a.quote !== null && a.quote.trim().length > 0 && sources.includes(a.quote);
    if (a.verdict === "couldnt_check") return { attr: r.attr, value: r.value, verdict: "couldnt_check", quote: null };
    // Checked or Didn't match both need the store's own words; without them we only know we couldn't check.
    if (!quoted) return { attr: r.attr, value: r.value, verdict: "couldnt_check", quote: null };
    return { attr: r.attr, value: r.value, verdict: a.verdict, quote: a.quote };
  });
}
