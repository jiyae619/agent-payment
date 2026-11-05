// pass^k: a case counts only if every one of its k runs passed. A shopper sees one run, so a case that
// passes 2 times out of 3 is a case that fails one shopper in 3. (Yao et al., τ-bench, 2024.)

export type Run = { caseId: string; ok: boolean; critical: string[] };

export type PassK = {
  k: number; // fewest runs any case got; pass^k is only claimed for that many
  cases: number;
  passAll: number; // pass^k: every run passed
  passAny: number; // at least one run passed (pass@k)
  runPassRate: number; // share of single runs that passed (pass^1, averaged)
  critical: number; // cases with a critical mistake in any run: one is enough to fail the gate
  flaky: string[]; // passed some runs and failed others: the cases to read first
};

export function passK(runs: Run[]): PassK {
  const byCase = new Map<string, Run[]>();
  for (const r of runs) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r]);
  const groups = [...byCase.entries()];
  const okCount = (g: Run[]) => g.filter((r) => r.ok).length;
  return {
    k: groups.length ? Math.min(...groups.map(([, g]) => g.length)) : 0,
    cases: groups.length,
    passAll: groups.filter(([, g]) => okCount(g) === g.length).length,
    passAny: groups.filter(([, g]) => okCount(g) > 0).length,
    runPassRate: runs.length ? runs.filter((r) => r.ok).length / runs.length : 0,
    critical: groups.filter(([, g]) => g.some((r) => r.critical.length > 0)).length,
    flaky: groups.filter(([, g]) => okCount(g) > 0 && okCount(g) < g.length).map(([id]) => id).sort(),
  };
}
