// Product-checker eval: runs the app's own checker (lib/check-product.ts, with its quote guard) on
// every case in data/fixtures/product-checks.json, k times per model, scored by product-check-score.mts.
// Run: npm run eval-checker -- claude-sonnet-5:high claude-haiku-4-5 --runs=3 [case-id ...]
// Calls the Anthropic API directly (ANTHROPIC_API_KEY). Synthetic and snapshot data, not user research.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import type { CatalogProduct } from "../lib/catalog.ts";
import { checkProduct, type CheckModel } from "../lib/check-product.ts";
import { passK } from "./pass-k.mts";
import { scoreCheck, type Case } from "./product-check-score.mts";

type FixtureCase = Case & { requirement: { kind: string; attr: string; value: string; source_phrase: string | null }; listing: Case["listing"] & { id: string; brand?: string | null; store: string; price: number } };

const args = process.argv.slice(2);
const runs = Number(args.find((a) => a.startsWith("--runs="))?.slice(7) ?? 3);
const models: CheckModel[] = args
  .filter((a) => !a.startsWith("--") && a.includes("claude"))
  .map((a) => {
    const [model, effort] = a.split(":");
    return { model, effort: effort as CheckModel["effort"] };
  });
const only = args.filter((a) => !a.startsWith("--") && !a.includes("claude"));
if (models.length === 0) throw new Error("Name at least one model, e.g. claude-sonnet-5:high");

const fixtures = JSON.parse(await readFile(new URL("../data/fixtures/product-checks.json", import.meta.url), "utf8"));
const cases: FixtureCase[] = fixtures.cases.filter((c: FixtureCase) => only.length === 0 || only.includes(c.id));

const product = (l: FixtureCase["listing"]): CatalogProduct => ({
  id: l.id, title: l.title, brand: l.brand ?? null, category: null, description: l.description, key_features: l.key_features,
  materials: [], attributes: l.attributes, sizes: l.sizes, image: null, price: l.price, store: l.store, condition: l.condition,
  in_stock: true, source: "channel3",
});

type Row = { model: string; caseId: string; run: number; ok: boolean; severity: string | null; problem: string | null; verdict: string; quote: string | null; ms: number; in: number; out: number; error?: string };
const rows: Row[] = [];
const label = (m: CheckModel) => (m.effort ? `${m.model}:${m.effort}` : m.model);
const jobs = models.flatMap((m) => cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ({ m, c, run }))));

await Promise.all(
  Array.from({ length: 5 }, async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      const { m, c, run } = j;
      const req = { attr: c.requirement.attr, value: c.requirement.value, source_phrase: c.requirement.source_phrase };
      const t0 = Date.now();
      try {
        const res = await checkProduct(product(c.listing), [req], m);
        const a = res.checks[0];
        const f = scoreCheck(c, { verdict: a.verdict, quote: a.quote });
        rows.push({ model: label(m), caseId: c.id, run, ok: f === null || f.severity === "minor", severity: f?.severity ?? null, problem: f?.problem ?? null, verdict: a.verdict, quote: a.quote, ms: Date.now() - t0, in: res.usage?.input_tokens ?? 0, out: res.usage?.output_tokens ?? 0 });
      } catch (err) {
        rows.push({ model: label(m), caseId: c.id, run, ok: false, severity: "critical", problem: "error", verdict: "error", quote: null, ms: Date.now() - t0, in: 0, out: 0, error: (err as Error).message });
      }
    }
  }),
);

for (const m of models.map(label)) {
  const mine = rows.filter((r) => r.model === m);
  const k = passK(mine.map((r) => ({ caseId: r.caseId, ok: r.ok, critical: r.severity === "critical" ? [r.problem ?? ""] : [] })));
  const count = (s: string) => new Set(mine.filter((r) => r.severity === s).map((r) => r.caseId)).size;
  const avg = mine.reduce((s, r) => s + r.ms, 0) / mine.length / 1000;
  const tokIn = mine.reduce((s, r) => s + r.in, 0), tokOut = mine.reduce((s, r) => s + r.out, 0);
  console.log(`\n${m}: pass^${k.k} ${k.passAll}/${k.cases} (no critical or major in any run), cases with critical ${count("critical")}, major ${count("major")}, minor ${count("minor")}, avg ${avg.toFixed(1)}s, tokens ${tokIn} in / ${tokOut} out over ${mine.length} calls`);
  console.log(`  flaky: ${k.flaky.join(", ") || "none"}`);
  const bad = mine.filter((r) => r.severity === "critical" || r.severity === "major");
  for (const r of bad.sort((a, b) => a.caseId.localeCompare(b.caseId) || a.run - b.run)) {
    console.log(`  ${r.severity!.toUpperCase()} ${r.caseId} #${r.run + 1}: ${r.error ?? r.problem}`);
  }
}

await mkdir(new URL("../data/eval/", import.meta.url), { recursive: true });
const out = new URL(`../data/eval/checker-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
await writeFile(out, JSON.stringify({ models: models.map(label), runs, rows }, null, 2) + "\n");
console.log(`\nSaved ${out.pathname}`);
