// Loop 2 of the feedback plan: turn the app's feedback log lines into work for the
// operator. Plain code, no AI. Everything it produces is a draft for a person to review; nothing
// here changes the app, the prompts or the evals by itself.
//
// Input lines (from the server log): "[feedback] {...}" and "[outcome] {...}".

export type Feedback =
  | { kind: "request_edit"; at: string; before: string; after: string }
  | { kind: "dont_buy_reason" | "rating"; at: string; value: string; store: string; outcome: string; asked_because: string[] };
export type Released = { at: string; outcome: "released"; store: string; rules: string[]; unchecked: { attr: string; verdict: string }[] };

export type DraftCase = {
  id: string;
  persona: "real-shopper";
  scenario: "from-feedback";
  text: string; // what the shopper first typed: the request the drafter misread
  shopper_rewrote_as: string;
  expect: null; // a person writes this, in the format of data/fixtures/synthetic-requests.json
  needs_review: true;
};

export type Report = {
  drafter_cases: DraftCase[];
  policy_todo: { store: string; times: number; todo: string }[];
  store_flags: { store: string; wrong_store: number; wrong_item: number; not_delivered: number }[];
  questions: { asked_because: string; times: number; refused: number }[];
  checker_review: { store: string; attr: string; verdict: string; times: number }[];
  counts: { feedback: number; released: number; skipped: number };
};

export function parseLines(lines: string[]): { feedback: Feedback[]; released: Released[]; skipped: number } {
  const feedback: Feedback[] = [];
  const released: Released[] = [];
  let skipped = 0;
  for (const line of lines) {
    const m = line.match(/\[(feedback|outcome)\]\s+(.*?)\s*$/);
    if (!m) continue;
    try {
      const data = JSON.parse(m[2]);
      if (m[1] === "outcome" && data.outcome === "released") released.push(data);
      else if (m[1] === "feedback" && typeof data.kind === "string") feedback.push(data);
      else skipped++;
    } catch {
      skipped++; // a truncated or garbled log line
    }
  }
  return { feedback, released, skipped };
}

const bump = <K extends string>(map: Map<string, Record<K, number>>, key: string, field: K, init: Record<K, number>) => {
  const row = map.get(key) ?? { ...init };
  row[field]++;
  map.set(key, row);
};

export function buildReport(lines: string[], minPolicy = 2): Report {
  const { feedback, released, skipped } = parseLines(lines);

  // 1. Request edits → draft drafter eval cases (deduplicated by the first wording).
  const seen = new Set<string>();
  const drafter_cases: DraftCase[] = [];
  for (const f of feedback) {
    if (f.kind !== "request_edit" || seen.has(f.before.toLowerCase())) continue;
    seen.add(f.before.toLowerCase());
    drafter_cases.push({ id: `real-edit-${String(drafter_cases.length + 1).padStart(2, "0")}`, persona: "real-shopper", scenario: "from-feedback", text: f.before, shopper_rewrote_as: f.after, expect: null, needs_review: true });
  }

  // 2. Stores whose return terms keep coming back "couldn't check" → add their policy to findPolicy.
  const returns = new Map<string, number>();
  for (const r of released) {
    if (r.unchecked.some((u) => /return/i.test(u.attr) && u.verdict === "couldnt_check")) returns.set(r.store, (returns.get(r.store) ?? 0) + 1);
  }
  const policy_todo = [...returns.entries()]
    .filter(([, n]) => n >= minPolicy)
    .sort((a, b) => b[1] - a[1])
    .map(([store, times]) => ({ store, times, todo: `Add ${store}'s return policy to data/policies.json (free returns couldn't be checked ${times} times)` }));

  // 3. Stores shoppers complained about.
  const flags = new Map<string, { wrong_store: number; wrong_item: number; not_delivered: number }>();
  const zero = { wrong_store: 0, wrong_item: 0, not_delivered: 0 };
  for (const f of feedback) {
    if (f.kind === "request_edit") continue;
    if (f.value === "wrong_store" || f.value === "wrong_item" || f.value === "not_delivered") bump(flags, f.store, f.value, zero);
  }
  const store_flags = [...flags.entries()].map(([store, r]) => ({ store, ...r })).sort((a, b) => b.wrong_item + b.not_delivered + b.wrong_store - (a.wrong_item + a.not_delivered + a.wrong_store));

  // 4. Which "asks you first" questions shoppers refuse: a default that is always refused may be too loose.
  const q = new Map<string, { times: number; refused: number }>();
  for (const f of feedback) {
    if (f.kind === "request_edit") continue;
    for (const a of f.asked_because) {
      const row = q.get(a) ?? { times: 0, refused: 0 };
      row.times++;
      if (f.outcome === "refused") row.refused++;
      q.set(a, row);
    }
  }
  const questions = [...q.entries()].map(([asked_because, r]) => ({ asked_because, ...r })).sort((a, b) => b.times - a.times);

  // 5. Other requirements the checker couldn't settle, by store: listings to label as product-check cases.
  const cr = new Map<string, number>();
  for (const r of released) for (const u of r.unchecked) if (!/return/i.test(u.attr)) cr.set(`${r.store}|${u.attr}|${u.verdict}`, (cr.get(`${r.store}|${u.attr}|${u.verdict}`) ?? 0) + 1);
  const checker_review = [...cr.entries()].map(([k, times]) => {
    const [store, attr, verdict] = k.split("|");
    return { store, attr, verdict, times };
  }).sort((a, b) => b.times - a.times);

  return { drafter_cases, policy_todo, store_flags, questions, checker_review, counts: { feedback: feedback.length, released: released.length, skipped } };
}
