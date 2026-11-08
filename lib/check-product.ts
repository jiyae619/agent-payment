// The product checker: AI reads one listing (and the store's return policy, if known) and says,
// for each requirement, Checked / Didn't match / Couldn't check, quoting the store's own words.
// Plain code then verifies every quote: a "checked" whose quote the store never wrote becomes
// "couldn't check", so an invented proof can't spend the shopper's money.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { CatalogProduct } from "./catalog.ts";
import { CHECK_SYSTEM, CheckAnswer } from "./check-prompt.ts";
import type { CheckResult } from "./enforce.ts";
import type { Pref } from "./mandate.ts";
import { findPolicy, type Policy } from "./policy.ts";

// Not yet chosen by an eval: Sonnet 5 at high effort, like the drafter, until the product-check
// comparison picks a model for this job (eval/LOG.md).
const MODEL = "claude-sonnet-5";
const EFFORT = "high";

export class CheckError extends Error {}

// Everything the store says about the item: the only text a quote may come from.
export function listingText(p: CatalogProduct): string {
  const attrs = Object.entries(p.attributes).map(([k, v]) => `${k}: ${v}`);
  return [p.title, p.description ?? "", ...p.key_features, ...attrs, p.sizes.length ? `Sizes: ${p.sizes.join(", ")}` : "", p.condition ? `Condition: ${p.condition}` : ""]
    .filter(Boolean)
    .join("\n");
}

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

export async function checkProduct(
  product: CatalogProduct,
  reqs: Pref[],
): Promise<{ checks: CheckResult[]; policy: Policy | null; final_sale: boolean }> {
  const policy = findPolicy(product.store, "returns");
  const final_sale = isFinalSale(product, policy);
  if (reqs.length === 0) return { checks: [], policy, final_sale };

  const listing = listingText(product);
  const policyBlock = policy ? `Store return policy (${product.store}, from ${policy.url}):\n${policy.text}` : `Store return policy: not known for ${product.store}.`;
  const reqLines = reqs.map((r) => `- attr: ${JSON.stringify(r.attr)}, value: ${JSON.stringify(r.value)}`).join("\n");

  const response = await new Anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: EFFORT, format: zodOutputFormat(CheckAnswer) },
    system: CHECK_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Requirements:\n${reqLines}\n\n<listing store="${product.store}">\n${listing}\n</listing>\n\n<policy>\n${policyBlock}\n</policy>`,
      },
    ],
  });
  if (!response.parsed_output) throw new CheckError(`The product check could not be read (stop reason: ${response.stop_reason}).`);
  return { checks: verify(reqs, response.parsed_output, `${listing}\n${policy?.text ?? ""}`), policy, final_sale };
}
