// Model comparison on the synthetic request fixtures, through the Astropods AI Gateway.
// Runs inside `ast project start` (the gateway key is only injected there); see eval/README.md.
// Reads eval/config.json, writes data/eval/<timestamp>.json, prints a scorecard.
// Synthetic data: for choosing a model, not user research.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Draft, normalizeDraft } from "../lib/draft-schema.ts";
import { DRAFT_SYSTEM } from "../lib/draft-prompt.ts";
import { chatJSON } from "../lib/llm-gateway.ts";
import { check, isCritical, type Req } from "./drafter-check.mts";
import { passK } from "./pass-k.mts";

type Config = { models: string[]; cases?: string[]; runs?: number; concurrency?: number };
type Row = {
  model: string; caseId: string; run: number; ok: boolean; critical: string[]; problems: string[];
  validJson: boolean; enforcedJson: boolean; attempts: number; ms: number; input: number; output: number; error: string | null;
  mandate?: unknown; // what the model drafted, for reading side by side
};

const config: Config = JSON.parse(await readFile(new URL("../eval/config.json", import.meta.url), "utf8"));
const fixtures = JSON.parse(await readFile(new URL("../data/fixtures/synthetic-requests.json", import.meta.url), "utf8"));
const cases: Req[] = fixtures.requests.filter((r: Req) => !config.cases?.length || config.cases.includes(r.id));
const runs = config.runs ?? 3; // pass^k needs repeats: a case counts only if every run passes

const jobs = config.models.flatMap((model) => cases.flatMap((c) => Array.from({ length: runs }, (_, i) => ({ model, c, run: i + 1 }))));
console.log(`Eval: ${config.models.length} model(s) × ${cases.length} case(s) × ${runs} run(s) = ${jobs.length} calls`);

const rows: Row[] = [];
await Promise.all(
  Array.from({ length: config.concurrency ?? 3 }, async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const { model, c, run } = job;
      let row: Row;
      try {
        const r = await chatJSON({ model, system: DRAFT_SYSTEM, user: c.text, schema: Draft, schemaName: "draft" });
        const mandate = r.data ? normalizeDraft(r.data, c.text) : undefined;
        const problems = mandate ? check(mandate, c.expect) : [`no valid draft: ${r.error}`];
        row = {
          mandate,
          model, caseId: c.id, run, ok: problems.length === 0, problems, critical: problems.filter(isCritical),
          validJson: r.data !== null, enforcedJson: r.enforcedJson, attempts: r.attempts, ms: r.ms,
          input: r.usage.input, output: r.usage.output, error: r.error,
        };
      } catch (err) {
        row = { model, caseId: c.id, run, ok: false, problems: [], critical: [], validJson: false, enforcedJson: false, attempts: 0, ms: 0, input: 0, output: 0, error: (err as Error).message };
      }
      rows.push(row);
      console.log(`${row.ok ? "PASS" : "FAIL"} ${model} ${c.id}#${run} ${(row.ms / 1000).toFixed(1)}s${row.error ? ` (${row.error.slice(0, 120)})` : ""}`);
    }
  }),
);

// Scorecard: one line per model. pass^k counts cases right on every run; critical counts cases with a critical mistake on any run.
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "-");
const summary: Record<string, ReturnType<typeof passK>> = {};
console.log("\nmodel".padEnd(26) + `pass^${runs}`.padEnd(9) + "pass@1  critical  validJSON  enforced  avg s   tokens in/out");
for (const model of config.models) {
  const r = rows.filter((x) => x.model === model);
  const s = (summary[model] = passK(r));
  const avg = r.reduce((s, x) => s + x.ms, 0) / Math.max(1, r.length) / 1000;
  console.log(
    model.padEnd(25) +
      `${s.passAll}/${s.cases}`.padEnd(9) +
      pct(r.filter((x) => x.ok).length, r.length).padEnd(8) +
      String(s.critical).padEnd(10) +
      pct(r.filter((x) => x.validJson).length, r.length).padEnd(11) +
      (r.some((x) => x.enforcedJson) ? "yes" : "no").padEnd(10) +
      avg.toFixed(1).padEnd(8) +
      `${r.reduce((s, x) => s + x.input, 0)}/${r.reduce((s, x) => s + x.output, 0)}`,
  );
}
for (const model of config.models)
  if (summary[model].flaky.length) console.log(`Flaky on ${model} (passed some runs, failed others; read these first): ${summary[model].flaky.join(", ")}`);
if (runs === 1) console.log(`One run per case can't show flaky cases. Set "runs": 3 in eval/config.json.`);
console.log("\nCritical = a wrong price limit, ask-above amount, quantity or total budget, a hidden gift card, a store the shopper didn't name, or words that aren't the shopper's own.");
console.log("Real cost per model: run `ast billing models` on your Mac.");

await mkdir(new URL("../data/eval/", import.meta.url), { recursive: true });
const out = new URL(`../data/eval/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
await writeFile(out, JSON.stringify({ config, summary, rows }, null, 2) + "\n");
console.log(`Saved ${out.pathname}`);
