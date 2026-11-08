import Anthropic from "@anthropic-ai/sdk";
import { DraftError, draftMandate } from "@/lib/draft.ts";
import { allowRun, visitorKey } from "@/lib/guard.ts";

// POST { text } → { mandate }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  if (!text) return Response.json({ error: "Tell the assistant what to buy." }, { status: 400 });
  if (text.length > 1000) return Response.json({ error: "Please keep it under 1,000 characters." }, { status: 400 });
  const limited = allowRun(visitorKey(request));
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    return Response.json({ mandate: await draftMandate(text) });
  } catch (err) {
    if (err instanceof DraftError) return Response.json({ error: err.message }, { status: 422 });
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The AI isn't set up yet (missing or invalid ANTHROPIC_API_KEY)." }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "The AI is busy. Try again in a moment." }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `The AI request failed (${err.status}).` }, { status: 502 });
    }
    throw err;
  }
}
