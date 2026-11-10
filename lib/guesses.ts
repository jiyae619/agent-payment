// Guesses: rules the AI had to interpret, where the shopper's words don't literally say the value
// ("nothing too flashy" → color: black, grey or navy). Found by plain code, not by the model, so the
// drafter and its evals don't change. The approval screen shows each guess as a chip the shopper
// can change; the level they picked decides whether they must confirm each one first.

import type { Mandate } from "./mandate.ts";

export type Level = "check" | "allow" | "auto";

export const LEVELS: { id: Level; name: string; note: string }[] = [
  { id: "check", name: "Check each guess", note: "Confirm each one before you approve" },
  { id: "allow", name: "Allow guesses", note: "The default. Tap one to change it" },
  { id: "auto", name: "Use best guesses", note: "No chips. You still choose what to buy" },
];

export const levelName = (l: Level) => LEVELS.find((x) => x.id === l)!.name;
export const isLevel = (x: unknown): x is Level => x === "check" || x === "allow" || x === "auto";

export type Guess = { list: "must_haves" | "conditions_of_sale"; index: number; attr: string; value: string; phrase: string | null };

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9.\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => w.replace(/s$/, ""));
const STOP = new Set(["a", "an", "the", "or", "and", "of", "for", "to", "yes", "please"]);

// A rule is the shopper's own words when every word of its value (or of its name, for yes/no
// rules) appears in the phrase it came from. Anything else, or no phrase at all, is a guess.
export function isGuess(attr: string, value: string, phrase: string | null): boolean {
  if (!phrase) return true;
  const said = new Set(words(phrase));
  const v = value.trim().toLowerCase();
  const need = words(v === "yes" || v === "true" ? attr : value);
  return need.length > 0 && !need.every((w) => said.has(w));
}

export function guesses(m: Mandate): Guess[] {
  const out: Guess[] = [];
  for (const list of ["must_haves", "conditions_of_sale"] as const) {
    m.ext[list].forEach((p, index) => {
      if (isGuess(p.attr, p.value, p.source_phrase)) out.push({ list, index, attr: p.attr, value: p.value, phrase: p.source_phrase });
    });
  }
  return out;
}

export const guessKey = (g: Pick<Guess, "list" | "index">) => `${g.list}:${g.index}`;

// The shopper changed a guess: the new value becomes theirs.
export function setGuess(m: Mandate, g: Pick<Guess, "list" | "index">, value: string): Mandate {
  const list = m.ext[g.list].map((p, i) => (i === g.index ? { ...p, value: value.trim(), source_phrase: value.trim() } : p));
  return { ...m, ext: { ...m.ext, [g.list]: list } };
}
