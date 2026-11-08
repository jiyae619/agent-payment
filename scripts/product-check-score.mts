// Scores an evidence checker's answers against data/fixtures/product-checks.json.
// How bad a mistake is depends on how far the result lands from what the shopper expects:
// a requirement the shopper stated (or a blocked category) is non-negotiable, while a soft
// preference ("citrus scent if they have it") never blocks the buy, so its mistakes score one level lower.
//
//   mistake                                               required   preference
//   says Checked, listing says no or doesn't say          critical   major
//   Didn't match <-> Couldn't check                       major      minor
//   says no or doesn't say, listing proves it             major      minor
//   Checked with no quote, or one the store never wrote   critical   major
//   Checked with a real quote that isn't the proof        major      minor   (flagged "check by hand")
//   any other quote the store never wrote                 major      major
//
// A model passes the gate only with zero critical mistakes; survivors rank by major, then minor.

import type { Verdict } from "../lib/enforce.ts"; // one definition, shared with the enforcement service

export type Severity = "critical" | "major" | "minor";
export type Answer = { verdict: Verdict; quote: string | null };

export type Listing = {
  title: string;
  description: string | null;
  key_features: string[];
  attributes: Record<string, string>;
  sizes: string[];
  condition: string | null;
};
export type Case = {
  id: string;
  requirement: { kind: string };
  listing: Listing;
  expect: { verdict: Verdict; quote: string | null };
};
export type Finding = { id: string; severity: Severity; problem: string };

// The text the checker may quote from: what the store says about the item.
// The labelled lines ("waterproof-level: Waterproof", "Sizes: 7, 8") are what the app's checker is shown
// (lib/check-product.ts listingText), so a quote copied from them is still the store's own words.
export const listingText = (l: Listing) =>
  [
    l.title, l.description ?? "", ...l.key_features, ...Object.values(l.attributes), ...l.sizes, l.condition ?? "",
    ...Object.entries(l.attributes).map(([k, v]) => `${k}: ${v}`),
    l.sizes.length ? `Sizes: ${l.sizes.join(", ")}` : "", l.condition ? `Condition: ${l.condition}` : "",
  ].join("\n");

const lower = (s: string) => s.toLowerCase();

export function scoreCheck(c: Case, a: Answer): Finding | null {
  const required = c.requirement.kind !== "preference";
  const level = (ifRequired: Severity, ifPreference: Severity) => (required ? ifRequired : ifPreference);
  const want = c.expect.verdict;
  const found = (severity: Severity, problem: string): Finding => ({ id: c.id, severity, problem });

  if (a.verdict === "checked" && want !== "checked") return found(level("critical", "major"), `said Checked, but the answer is ${want}`);
  if (want === "checked" && a.verdict !== "checked") return found(level("major", "minor"), `said ${a.verdict}, but the listing proves it`);
  if (a.verdict !== want) return found(level("major", "minor"), `said ${a.verdict}, but the answer is ${want}`);

  // Right verdict: now the evidence. A quote must be the store's own words, and for Checked it must be the words that prove it.
  const inListing = a.quote !== null && listingText(c.listing).includes(a.quote);
  if (a.verdict === "checked") {
    if (!inListing) return found(level("critical", "major"), `said Checked with quote ${JSON.stringify(a.quote)}, which the store never wrote`);
    // The label is the shortest wording that proves it. A real quote without it may be another valid proof, so a person looks.
    if (!lower(a.quote!).includes(lower(c.expect.quote!)))
      return found(level("major", "minor"), `check by hand: quote ${JSON.stringify(a.quote)} doesn't contain the labelled proof ${JSON.stringify(c.expect.quote)}`);
  } else if (a.quote !== null && !inListing) {
    return found("major", `quote ${JSON.stringify(a.quote)} is not in the listing`);
  }
  return null;
}

export type Summary = {
  findings: Finding[];
  critical: number;
  major: number;
  minor: number;
  passesGate: boolean;
  falseChecked: { count: number; of: number }; // said Checked when the answer was no or unknown
  overCaution: { count: number; of: number }; // said no or unknown when the listing proved it
};

export function summarize(cases: Case[], answers: Map<string, Answer>): Summary {
  const findings: Finding[] = [];
  let falseChecked = 0, overCaution = 0;
  for (const c of cases) {
    const a = answers.get(c.id);
    if (!a) throw new Error(`no answer for ${c.id}`); // a missing answer is a broken run, not a score
    if (a.verdict === "checked" && c.expect.verdict !== "checked") falseChecked++;
    if (a.verdict !== "checked" && c.expect.verdict === "checked") overCaution++;
    const f = scoreCheck(c, a);
    if (f) findings.push(f);
  }
  const count = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const checkedCases = cases.filter((c) => c.expect.verdict === "checked").length;
  return {
    findings,
    critical: count("critical"),
    major: count("major"),
    minor: count("minor"),
    passesGate: count("critical") === 0,
    falseChecked: { count: falseChecked, of: cases.length - checkedCases },
    overCaution: { count: overCaution, of: checkedCases },
  };
}

// Sort order for models: gate first, then fewer major, then fewer minor. Cost and speed break ties in the runner.
export function compareModels(a: Summary, b: Summary): number {
  if (a.passesGate !== b.passesGate) return a.passesGate ? -1 : 1;
  return a.major - b.major || a.minor - b.minor || a.critical - b.critical;
}
