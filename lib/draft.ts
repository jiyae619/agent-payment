// Claude turns the shopper's words into a draft of instructions. This is the only AI step
// before approval: the readback screen, warnings and enforcement are all plain code.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Draft, normalizeDraft } from "./draft-schema.ts";
import { DRAFT_SYSTEM } from "./draft-prompt.ts";
import type { Mandate } from "./mandate.ts";

// Chosen by the model eval (eval/LOG.md, Round 4): the only model with zero critical errors.
// High effort (Sonnet 5's default): at medium it wrote brooks.com for "Brooks" (eval/LOG.md, Round 6).
const MODEL = "claude-sonnet-5";
const EFFORT = "high";

export class DraftError extends Error {}

export async function draftMandate(text: string, now = new Date()): Promise<Mandate> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new DraftError("The AI isn't set up yet (add ANTHROPIC_API_KEY to .env.local).");
  }
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: EFFORT, format: zodOutputFormat(Draft) },
    system: DRAFT_SYSTEM,
    messages: [{ role: "user", content: text }],
  });

  if (response.stop_reason === "refusal") {
    throw new DraftError("Claude declined this request. Try rewording it.");
  }
  if (!response.parsed_output) {
    throw new DraftError(`Claude's answer could not be read (stop reason: ${response.stop_reason}).`);
  }
  return normalizeDraft(response.parsed_output, text, now);
}
