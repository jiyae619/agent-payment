// Re-scores a saved pick-eval run (data/eval/pick-*.json) with the current scorer, without calling
// any model. Run: node scripts/rescore-pick.mts data/eval/pick-<timestamp>.json

import { readFile } from "node:fs/promises";
import { passK } from "./pass-k.mts";
import { scorePick, type PickCase } from "./pick-score.mts";

const run = JSON.parse(await readFile(process.argv[2], "utf8"));
const cases: PickCase[] = JSON.parse(await readFile(new URL("../data/fixtures/pick-cases.json", import.meta.url), "utf8")).cases;
for (const m of run.models as string[]) {
  const rows = run.rows.filter((r: { model: string }) => r.model === m);
  const scored = rows.map((r: { caseId: string; pickedId: string; reason: string; by: "ai" | "code"; error?: string }) => {
    const findings = r.error ? [{ severity: "major", problem: r.error }] : scorePick(cases.find((c) => c.id === r.caseId)!, r);
    return { caseId: r.caseId, findings };
  });
  const k = passK(scored.map((s: { caseId: string; findings: { severity: string; problem: string }[] }) => ({
    caseId: s.caseId, ok: !s.findings.some((f) => f.severity !== "minor"), critical: s.findings.filter((f) => f.severity === "critical").map((f) => f.problem),
  })));
  console.log(`${m}: pass^${k.k} ${k.passAll}/${k.cases}, cases with critical ${k.critical}, flaky: ${k.flaky.join(", ") || "none"}`);
  for (const s of scored) for (const f of s.findings) console.log(`  ${f.severity.toUpperCase()} ${s.caseId}: ${f.problem}`);
}
