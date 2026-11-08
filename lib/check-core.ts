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
  return /final sale|non-?returnable|no returns|cannot be returned|can't be returned/i.test(text);
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
