// Calls any model on the Astropods AI Gateway (OpenAI-compatible API) and returns JSON
// validated against a Zod schema. Used by the model eval, where many vendors are compared
// with one key. Not every model supports enforced JSON output, so the reply is always
// validated in code, with one retry that shows the model its error.

import { z } from "zod";

export type ChatResult<T> = {
  data: T | null;
  error: string | null;
  attempts: number;
  ms: number;
  usage: { input: number; output: number };
  enforcedJson: boolean; // true if the gateway accepted response_format: json_schema
};

type Message = { role: "system" | "user" | "assistant"; content: string };

const unsupportedFormat = new Set<string>(); // models that rejected response_format

export async function chatJSON<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
}): Promise<ChatResult<T>> {
  const url = process.env.ASTRO_GATEWAY_URL;
  const key = process.env.ASTRO_GATEWAY_API_KEY;
  if (!url || !key) throw new Error("ASTRO_GATEWAY_URL / ASTRO_GATEWAY_API_KEY not set (run inside `ast project start`)");

  const jsonSchema = z.toJSONSchema(opts.schema);
  const system = `${opts.system}\n\nReply with only a JSON object matching this JSON schema, no other text:\n${JSON.stringify(jsonSchema)}`;
  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: opts.user },
  ];
  const usage = { input: 0, output: 0 };
  const t0 = Date.now();
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const enforce = !unsupportedFormat.has(opts.model);
    const body: Record<string, unknown> = { model: opts.model, messages, max_tokens: opts.maxTokens ?? 8000 };
    if (enforce) body.response_format = { type: "json_schema", json_schema: { name: opts.schemaName, schema: jsonSchema } };

    const res = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();

    if (!res.ok) {
      if (enforce && res.status === 400 && /response_format|json_schema/i.test(text)) {
        unsupportedFormat.add(opts.model); // retry this attempt without enforced JSON
        attempt--;
        continue;
      }
      lastError = `HTTP ${res.status}: ${text.slice(0, 300)}`;
      if (res.status >= 500 || res.status === 429) continue;
      break;
    }

    const data = JSON.parse(text);
    usage.input += data.usage?.prompt_tokens ?? 0;
    usage.output += data.usage?.completion_tokens ?? 0;
    const content: string = data.choices?.[0]?.message?.content ?? "";

    const parsed = parseJson(content);
    const checked = parsed === undefined ? null : opts.schema.safeParse(parsed);
    if (checked?.success) {
      return { data: checked.data, error: null, attempts: attempt, ms: Date.now() - t0, usage, enforcedJson: enforce };
    }
    lastError = checked ? `schema: ${checked.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` : "reply was not JSON";
    messages.push({ role: "assistant", content }, { role: "user", content: `That reply was invalid (${lastError}). Reply again with only the corrected JSON object.` });
  }

  return { data: null, error: lastError, attempts: 2, ms: Date.now() - t0, usage, enforcedJson: !unsupportedFormat.has(opts.model) };
}

// Accept a bare object or one wrapped in a ```json fence.
function parseJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : content).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
