// The one choice the AI makes while shopping: which of the shortlisted products fits the shopper's
// words best, and why, in one plain sentence. It only sees products that already passed every
// plain-code filter (lib/pick-core.ts), its answer must name one of them, and enforcement
// re-checks the pick anyway.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { acceptPick, optionsForAI, PICK_SYSTEM, PickAnswer, pickMessage, type Candidate, type Pick } from "./pick-core.ts";

export type { Candidate, Pick } from "./pick-core.ts";

// A low-stakes choice among already-safe options. Round 10 (eval/LOG.md): Haiku 5.5 at low effort
// matched Sonnet 5 on every pick and total at about 1/16 the cost and 0.3 s faster.
const MODEL = "claude-haiku-5-5";
const EFFORT = "low";

export type PickModel = { model: string; effort?: "low" | "medium" | "high" };

// `use` lets the model eval run this exact code with other models; the app always uses the default.
export async function pick(shopperWords: string, candidates: Candidate[], quantity = 1, use: PickModel = { model: MODEL, effort: EFFORT }): Promise<Pick | null> {
  if (candidates.length === 0) return null;
  const { options, codePick } = optionsForAI(candidates);
  if (codePick) return codePick;

  const response = await new Anthropic().messages.parse({
    model: use.model,
    max_tokens: 4000,
    output_config: { ...(use.effort ? { effort: use.effort } : {}), format: zodOutputFormat(PickAnswer) },
    system: PICK_SYSTEM,
    messages: [{ role: "user", content: pickMessage(shopperWords, options, quantity) }],
  });
  const usage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
  return { ...acceptPick(options, response.parsed_output ?? null), usage };
}
