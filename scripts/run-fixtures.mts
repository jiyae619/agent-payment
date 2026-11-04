// Drafts every synthetic request with Claude and checks the result against its `expect` block.
// Run: npm run fixtures            (all 24; calls the Claude API, ~24 requests)
//      npm run fixtures -- shoes-01 (one request)
// Writes data/fixtures/last-run.json. Synthetic data: for testing the drafter, not user research.

import { readFile, writeFile } from "node:fs/promises";
import { draftMandate } from "../lib/draft.ts";
import { findWarnings } from "../lib/warnings.ts";
import type { Mandate } from "../lib/mandate.ts";

type Expect = { max: number | null; checkin_over: number | null; stores: string[]; must_haves: string[]; warnings: string[]; unmapped: string[] };
type Req = { id: string; persona: string; scenario: string; text: string; expect: Expect };

const fixtures = JSON.parse(await readFile(new URL("../data/fixtures/synthetic-requests.json", import.meta.url), "utf8"));
const only = process.argv.slice(2);
const requests: Req[] = fixtures.requests.filter((r: Req) => only.length === 0 || only.includes(r.id));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9& ]/g, " ").replace(/\s+/g, " ").trim();

function check(m: Mandate, e: Expect): string[] {
  const problems: string[] = [];
  if (m.payment.amount_range.max !== e.max) problems.push(`max ${m.payment.amount_range.max} ≠ expected ${e.max}`);

  const over = m.ext.checkins.find((c) => c.type === "over_amount");
  const overValue = over && over.type === "over_amount" ? over.value : null;
  if (overValue !== e.checkin_over) problems.push(`ask-above ${overValue} ≠ expected ${e.checkin_over}`);

  const stores = m.checkout.allowed_merchants.map((s) => s.domain).sort();
  if (JSON.stringify(stores) !== JSON.stringify([...e.stores].sort())) problems.push(`stores [${stores}] ≠ expected [${e.stores}]`);

  const features = norm(m.ext.must_haves.map((p) => `${p.attr} ${p.value} ${p.source_phrase ?? ""}`).join(" "));
  for (const want of e.must_haves) {
    const words = norm(want).split(" ").filter((w) => w !== "s");
    if (!words.every((w) => features.includes(w))) problems.push(`must-have "${want}" missing`);
  }

  const got = new Set(findWarnings(m).map((w) => w.id));
  for (const w of e.warnings) if (!got.has(w as never)) problems.push(`warning ${w} missing`);
  for (const w of got) if (!e.warnings.includes(w)) problems.push(`extra warning ${w}`);

  const unmapped = norm(m.ext.unmapped.map((u) => u.phrase).join(" | "));
  for (const u of e.unmapped) if (!unmapped.includes(norm(u))) problems.push(`"${u}" not listed as can't-promise`);

  const text = m.source_text.toLowerCase();
  const phrases = [
    m.payment.amount_range.source_phrase,
    ...m.checkout.line_items.map((x) => x.source_phrase),
    ...m.ext.must_haves.map((x) => x.source_phrase),
    ...m.ext.checkins.map((x) => x.source_phrase),
    ...m.ext.unmapped.map((x) => x.phrase),
  ].filter((p): p is string => Boolean(p));
  for (const p of phrases) if (!text.includes(p.toLowerCase())) problems.push(`"${p}" is not the shopper's exact words`);

  return problems;
}

const results: { id: string; ok: boolean; problems: string[]; mandate?: Mandate; error?: string; ms: number }[] = [];
const queue = [...requests];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const t0 = Date.now();
      try {
        const mandate = await draftMandate(r.text);
        const problems = check(mandate, r.expect);
        results.push({ id: r.id, ok: problems.length === 0, problems, mandate, ms: Date.now() - t0 });
      } catch (err) {
        results.push({ id: r.id, ok: false, problems: [], error: (err as Error).message, ms: Date.now() - t0 });
      }
    }
  }),
);

results.sort((a, b) => a.id.localeCompare(b.id));
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id} (${(r.ms / 1000).toFixed(1)}s)${r.error ? ` error: ${r.error}` : ""}`);
  for (const p of r.problems) console.log(`     - ${p}`);
}
const passed = results.filter((r) => r.ok).length;
const avg = results.reduce((s, r) => s + r.ms, 0) / Math.max(1, results.length) / 1000;
console.log(`\n${passed}/${results.length} passed, average ${avg.toFixed(1)}s per draft`);
await writeFile(new URL("../data/fixtures/last-run.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
