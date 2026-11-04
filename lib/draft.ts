// Claude turns the shopper's words into a draft of instructions. This is the only AI step
// before approval: the readback screen, warnings and enforcement are all plain code.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Draft, normalizeDraft } from "./draft-schema.ts";
import type { Mandate } from "./mandate.ts";

const MODEL = "claude-opus-5-5";

const SYSTEM = `You turn a shopper's request into structured purchase instructions for a shopping assistant.
The shopper is often not technical. Their instructions will be shown back to them and enforced by code, so be literal and honest.

Rules:
- source_phrase must be words copied exactly from the request (a substring), or null. Never paraphrase it.
- Never invent a number. If the shopper gave no price, max_total.amount is null.
- A stated limit like "under 120", "no more than $90" or "$100ish" is max_total. "Ask me if it's over 100" is an over_amount check-in, not the max.
- "Show me before you pay" or "double-check the price with me" is an over_amount check-in with amount 0.
- "Don't switch brands", "exactly this or nothing", "ask if you want a different brand" mean a substitute check-in; "exactly ... or nothing" also sets exact_item_only true.
- Stores become website domains (REI -> rei.com, Zappos -> zappos.com, Target -> target.com). Only list stores the shopper named.
- Product features (size, waterproof, scent, unscented, width) are must_haves. Return policy, condition (new/used) and seller rating are conditions_of_sale.
- A person or place to ship to goes in ship_to.
- Anything that can't become one of these fields goes in unmapped, with its exact words and a short reason a non-technical person understands. Examples: vague taste ("not too expensive", "decent", "comfortable"), memory ("same as last time", "the usual"), privacy ("don't share my email"), ads ("no sponsored picks"), packaging requests.
- Keep descriptions short and plain.`;

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
    system: SYSTEM,
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
