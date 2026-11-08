// Pick-step eval: runs the app's own pick() (lib/pick.ts) on every case in
// data/fixtures/pick-cases.json, k times per model, scored by scripts/pick-score.mts (pass^k).
// Run: npm run eval-pick -- claude-sonnet-5:low claude-haiku-5-5 --runs=3 [case-id ...]
// Calls the Anthropic API directly (ANTHROPIC_API_KEY), or, inside `ast project start`, every model
// through the Astropods AI Gateway (models and runs from eval/config.json "pick"), with the same
// prompt, message and answer handling (lib/pick-core.ts). Synthetic data, not user research.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { CatalogProduct } from "../lib/catalog.ts";
import { acceptPick, optionsForAI, PICK_SYSTEM, PickAnswer, pickMessage, type Candidate, type Pick } from "../lib/pick-core.ts";
import { passK } from "./pass-k.mts";
import { scorePick, type PickCase, type PickOption } from "./pick-score.mts";

type PickModel = { model: string; effort?: "low" | "medium" | "high" };
const gateway = Boolean(process.env.ASTRO_GATEWAY_URL);
const config = gateway ? JSON.parse(await readFile(new URL("../eval/config.json", import.meta.url), "utf8")).pick : null;

const args = process.argv.slice(2);
const runs = gateway ? Number(config.runs ?? 3) : Number(args.find((a) => a.startsWith("--runs="))?.slice(7) ?? 3);
const modelArgs: string[] = gateway ? config.models : args.filter((a) => !a.startsWith("--") && a.includes("claude"));
let models: PickModel[] = modelArgs.map((a) => {
  const [model, effort] = a.split(":");
  return { model, effort: effort as PickModel["effort"] };
});
const only: string[] = gateway ? (config.cases ?? []) : args.filter((a) => !a.startsWith("--") && !a.includes("claude"));

// One pick, the app's way, on either route.
async function runPick(m: PickModel, words: string, candidates: Candidate[], quantity: number): Promise<Pick> {
  if (!gateway) {
    const { pick } = await import("../lib/pick.ts"); // Anthropic SDK: not in the container
    const p = await pick(words, candidates, quantity, m);
    if (!p) throw new Error("no pick");
    return p;
  }
  const { options, codePick } = optionsForAI(candidates);
  if (codePick) return codePick;
  const { chatJSON } = await import("../lib/llm-gateway.ts");
  const r = await chatJSON({ model: m.model, system: PICK_SYSTEM, user: pickMessage(words, options, quantity), schema: PickAnswer, schemaName: "pick", maxTokens: 2000 });
  if (!r.data && r.error) throw new Error(r.error);
  return { ...acceptPick(options, r.data), usage: { input_tokens: r.usage.input, output_tokens: r.usage.output } };
}
if (models.length === 0) throw new Error("Name at least one model, e.g. claude-sonnet-5:low");

const fixtures = JSON.parse(await readFile(new URL("../data/fixtures/pick-cases.json", import.meta.url), "utf8"));
const cases: PickCase[] = fixtures.cases.filter((c: PickCase) => only.length === 0 || only.includes(c.id));

const product = (o: PickOption): CatalogProduct => ({
  id: o.id, title: o.title, brand: null, category: null, description: null, key_features: [], materials: [], attributes: {},
  sizes: [], image: null, price: o.price, store: o.store, condition: null, in_stock: true, source: "channel3",
});

type Row = { model: string; caseId: string; run: number; pickedId: string; reason: string; by: string; findings: { severity: string; problem: string }[]; ms: number; in: number; out: number; error?: string };
const rows: Row[] = [];
const label = (m: PickModel) => (m.effort ? `${m.model}:${m.effort}` : m.model);
const candidates = (c: PickCase): Candidate[] => c.options.map((o) => ({ product: product(o), checks: o.checks }));

// On the gateway, probe each model with one AI-path case first and skip any it doesn't serve.
if (gateway) {
  const probe = cases.find((c) => c.trap !== "code-path")!;
  const ok: PickModel[] = [];
  for (const m of models) {
    try {
      await runPick(m, probe.shopper_words, candidates(probe), probe.quantity ?? 1);
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
      const t0 = Date.now();
      try {
        const p = await runPick(m, c.shopper_words, candidates(c), c.quantity ?? 1);
        const a = { pickedId: p.product.id, reason: p.reason, by: p.by };
        rows.push({ model: label(m), caseId: c.id, run, ...a, findings: scorePick(c, a), ms: Date.now() - t0, in: p.usage?.input_tokens ?? 0, out: p.usage?.output_tokens ?? 0 });
      } catch (err) {
        rows.push({ model: label(m), caseId: c.id, run, pickedId: "", reason: "", by: "error", findings: [{ severity: "major", problem: "error" }], ms: Date.now() - t0, in: 0, out: 0, error: (err as Error).message });
      }
    }
  }),
);

const bad = (r: Row) => r.findings.some((f) => f.severity !== "minor");
for (const m of models.map(label)) {
  const mine = rows.filter((r) => r.model === m).sort((a, b) => a.caseId.localeCompare(b.caseId) || a.run - b.run);
  const k = passK(mine.map((r) => ({ caseId: r.caseId, ok: !bad(r), critical: r.findings.filter((f) => f.severity === "critical").map((f) => f.problem) })));
  const minor = new Set(mine.filter((r) => r.findings.some((f) => f.severity === "minor")).map((r) => r.caseId)).size;
  const avg = mine.reduce((s, r) => s + r.ms, 0) / Math.max(1, mine.length) / 1000;
  const tokIn = mine.reduce((s, r) => s + r.in, 0), tokOut = mine.reduce((s, r) => s + r.out, 0);
  console.log(`\n${m}: pass^${k.k} ${k.passAll}/${k.cases}, cases with critical ${k.critical}, cases with minor ${minor}, avg ${avg.toFixed(1)}s, tokens ${tokIn} in / ${tokOut} out over ${mine.length} calls`);
  console.log(`  flaky: ${k.flaky.join(", ") || "none"}`);
  for (const r of mine) {
    for (const f of r.findings) console.log(`  ${f.severity.toUpperCase()} ${r.caseId} #${r.run + 1}: ${r.error ?? f.problem}${f.severity !== "minor" && r.reason ? ` — "${r.reason}"` : ""}`);
  }
}

await mkdir(new URL("../data/eval/", import.meta.url), { recursive: true });
const out = new URL(`../data/eval/pick-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
await writeFile(out, JSON.stringify({ models: models.map(label), runs, rows }, null, 2) + "\n");
console.log(`\nSaved ${out.pathname}`);
