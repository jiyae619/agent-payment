// The product checker: AI reads one listing (and the store's return policy, if known) and says,
// for each requirement, Checked / Didn't match / Couldn't check, quoting the store's own words.
// Plain code then verifies every quote (lib/check-core.ts): a "checked" whose quote the store never
// wrote becomes "couldn't check", so an invented proof can't spend the shopper's money.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { CatalogProduct } from "./catalog.ts";
import { checkMessage, isFinalSale, quoteSources, returnsFor, verify, type Returns } from "./check-core.ts";
import { CHECK_SYSTEM, CheckAnswer } from "./check-prompt.ts";
import type { CheckResult } from "./enforce.ts";
import type { Pref } from "./mandate.ts";
import { findPolicy, type Policy } from "./policy.ts";

export { isFinalSale, listingText, verify } from "./check-core.ts";

// Chosen by the product-check eval (eval/LOG.md, Round 7): zero critical mistakes and the most
// requirements proven. Haiku 5.5 was also safe and ~18x cheaper, but missed true "checked" results.
const MODEL = "claude-sonnet-5";
const EFFORT = "high";

export class CheckError extends Error {}

export type CheckModel = { model: string; effort?: "low" | "medium" | "high" };

// `use` lets the model eval run this exact code with other models; the app always uses the default.
export async function checkProduct(
  product: CatalogProduct,
  reqs: Pref[],
  use: CheckModel = { model: MODEL, effort: EFFORT },
): Promise<{ checks: CheckResult[]; policy: Policy | null; final_sale: boolean; returns: Returns; usage?: { input_tokens: number; output_tokens: number } }> {
  const policy = findPolicy(product.store, "returns");
  const final_sale = isFinalSale(product, policy);
  const returns = returnsFor(product, policy);
  if (reqs.length === 0) return { checks: [], policy, final_sale, returns };

  const response = await new Anthropic().messages.parse({
    model: use.model,
    max_tokens: 16000,
    output_config: { ...(use.effort ? { effort: use.effort } : {}), format: zodOutputFormat(CheckAnswer) },
    system: CHECK_SYSTEM,
    messages: [{ role: "user", content: checkMessage(product, reqs, policy) }],
  });
  if (!response.parsed_output) throw new CheckError(`The product check could not be read (stop reason: ${response.stop_reason}).`);
  const usage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
  return { checks: verify(reqs, response.parsed_output, quoteSources(product, policy)), policy, final_sale, returns, usage };
}
