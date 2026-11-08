// Product-checker eval: runs the app's own checker (lib/check-product.ts, with its quote guard) on
// every case in data/fixtures/product-checks.json, k times per model, scored by product-check-score.mts.
// Run: npm run eval-checker -- claude-sonnet-5:high claude-haiku-4-5 --runs=3 [case-id ...]
// Calls the Anthropic API directly (ANTHROPIC_API_KEY), or, inside `ast project start`, every model
// through the Astropods AI Gateway (models and runs from eval/config.json "checker"), with the same
// prompt, message and quote guard (lib/check-core.ts). Synthetic and snapshot data, not user research.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import type { CatalogProduct } from "../lib/catalog.ts";
import { checkMessage, quoteSources, verify } from "../lib/check-core.ts";
import { CHECK_SYSTEM, CheckAnswer } from "../lib/check-prompt.ts";
import type { CheckResult } from "../lib/enforce.ts";
import type { Pref } from "../lib/mandate.ts";
import { findPolicy } from "../lib/policy.ts";
import { passK } from "./pass-k.mts";
import { scoreCheck, type Case } from "./product-check-score.mts";

type FixtureCase = Case & { requirement: { kind: string; attr: string; value: string; source_phrase: string | null }; listing: Case["listing"] & { id: string; brand?: string | null; store: string; price: number } };

type CheckModel = { model: string; effort?: "low" | "medium" | "high" };
const gateway = Boolean(process.env.ASTRO_GATEWAY_URL);
const config = gateway ? JSON.parse(await readFile(new URL("../eval/config.json", import.meta.url), "utf8")).checker : null;

const args = process.argv.slice(2);
const runs = gateway ? Number(config.runs ?? 3) : Number(args.find((a) => a.startsWith("--runs="))?.slice(7) ?? 3);
const modelArgs: string[] = gateway ? config.models : args.filter((a) => !a.startsWith("--") && a.includes("claude"));
let models: CheckModel[] = modelArgs.map((a) => {
  const [model, effort] = a.split(":");
  return { model, effort: effort as CheckModel["effort"] };
});
const only: string[] = gateway ? (config.cases ?? []) : args.filter((a) => !a.startsWith("--") && !a.includes("claude"));
if (models.length === 0) throw new Error("Name at least one model, e.g. claude-sonnet-5:high");

// One check, the app's way: the same system prompt, message and quote guard on either route.
async function runCheck(m: CheckModel, p: CatalogProduct, req: Pref): Promise<{ check: CheckResult; in: number; out: number }> {
  const policy = findPolicy(p.store, "returns");
  if (!gateway) {
    const { checkProduct } = await import("../lib/check-product.ts"); // Anthropic SDK: not in the container
    const res = await checkProduct(p, [req], m);
    return { check: res.checks[0], in: res.usage?.input_tokens ?? 0, out: res.usage?.output_tokens ?? 0 };
  }
  const { chatJSON } = await import("../lib/llm-gateway.ts");
  const r = await chatJSON({ model: m.model, system: CHECK_SYSTEM, user: checkMessage(p, [req], policy), schema: CheckAnswer, schemaName: "product_check", maxTokens: 4000 });
  if (!r.data) throw new Error(r.error ?? "no answer");
  return { check: verify([req], r.data, quoteSources(p, policy))[0], in: r.usage.input, out: r.usage.output };
}

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

// On the gateway, probe each model with one case first and skip any it doesn't serve.
if (gateway) {
  const probe = cases[0];
  const ok: CheckModel[] = [];
  for (const m of models) {
    try {
      await runCheck(m, product(probe.listing), { attr: probe.requirement.attr, value: probe.requirement.value, source_phrase: null });
      ok.push(m);
    } catch (err) {
      console.log(`Skipping ${label(m)}: ${(err as Error).message.slice(0, 200)}`);
    }
  }
  models = ok;
}

const jobs = models.flatMap((m) => cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ({ m, c, run }))));

await Promise.all(
  Array.from({ length: 5 }, async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      const { m, c, run } = j;
      const req = { attr: c.requirement.attr, value: c.requirement.value, source_phrase: c.requirement.source_phrase };
      const t0 = Date.now();
      try {
        const res = await runCheck(m, product(c.listing), req);
        const a = res.check;
        const f = scoreCheck(c, { verdict: a.verdict, quote: a.quote });
        rows.push({ model: label(m), caseId: c.id, run, ok: f === null || f.severity === "minor", severity: f?.severity ?? null, problem: f?.problem ?? null, verdict: a.verdict, quote: a.quote, ms: Date.now() - t0, in: res.in, out: res.out });
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
