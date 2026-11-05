// Claude turns the shopper's words into a draft of instructions. This is the only AI step
// before approval: the readback screen, warnings and enforcement are all plain code.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Draft, normalizeDraft } from "./draft-schema.ts";
import { DRAFT_SYSTEM } from "./draft-prompt.ts";
import type { Mandate } from "./mandate.ts";

const MODEL = "claude-opus-5-5";

export class DraftError extends Error {}

export async function draftMandate(text: string, now = new Date()): Promise<Mandate> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new DraftError("The AI isn't set up yet (add ANTHROPIC_API_KEY to .env.local).");
  }
  const client = new Anthropic();

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Draft) },
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
