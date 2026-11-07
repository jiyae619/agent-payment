// Drafts every synthetic request with Claude and checks the result against its `expect` block.
// Run: npm run fixtures            (all 39; calls the Claude API, ~39 requests)
//      npm run fixtures -- shoes-01 (one request)
//      npm run fixtures -- --runs=3 (each request 3 times, scored pass^3 like the model eval)
// Writes data/fixtures/last-run.json. Synthetic data: for testing the drafter, not user research.

import { readFile, writeFile } from "node:fs/promises";
import { draftMandate } from "../lib/draft.ts";
import type { Mandate } from "../lib/mandate.ts";
import { check, isCritical, type Req } from "./drafter-check.mts";
import { passK } from "./pass-k.mts";

const fixtures = JSON.parse(await readFile(new URL("../data/fixtures/synthetic-requests.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
const runs = Number(args.find((a) => a.startsWith("--runs="))?.slice(7) ?? 1);
const only = args.filter((a) => !a.startsWith("--"));
const requests: Req[] = fixtures.requests.filter((r: Req) => only.length === 0 || only.includes(r.id));

const results: { id: string; run: number; ok: boolean; problems: string[]; mandate?: Mandate; error?: string; ms: number }[] = [];
const queue = requests.flatMap((r) => Array.from({ length: runs }, (_, run) => ({ ...r, run })));
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const t0 = Date.now();
      try {
        const mandate = await draftMandate(r.text);
        const problems = check(mandate, r.expect);
        results.push({ id: r.id, run: r.run, ok: problems.length === 0, problems, mandate, ms: Date.now() - t0 });
      } catch (err) {
        results.push({ id: r.id, run: r.run, ok: false, problems: [], error: (err as Error).message, ms: Date.now() - t0 });
      }
    }
  }),
);

results.sort((a, b) => a.id.localeCompare(b.id) || a.run - b.run);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id}${runs > 1 ? ` #${r.run + 1}` : ""} (${(r.ms / 1000).toFixed(1)}s)${r.error ? ` error: ${r.error}` : ""}`);
  for (const p of r.problems) console.log(`     - ${p}`);
}
const passed = results.filter((r) => r.ok).length;
const avg = results.reduce((s, r) => s + r.ms, 0) / Math.max(1, results.length) / 1000;
console.log(`\n${passed}/${results.length} passed, average ${avg.toFixed(1)}s per draft`);
if (runs > 1) {
  const k = passK(results.map((r) => ({ caseId: r.id, ok: r.ok, critical: r.problems.filter(isCritical) })));
  console.log(`pass^${k.k}: ${k.passAll}/${k.cases}, cases with a critical error: ${k.critical}, flaky: ${k.flaky.join(", ") || "none"}`);
}
await writeFile(new URL("../data/fixtures/last-run.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
