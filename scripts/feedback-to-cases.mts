// Turn exported server logs into draft eval cases and an operator to-do list (Loop 2).
// Run: npm run feedback -- <log file> [--min-policy=2]
//   The log file is the app's server output: the dev terminal locally, or Render's log export.
// Writes data/eval/feedback-<timestamp>.json (not committed: it can hold shoppers' own words).
// Nothing is applied: a person reviews the cases, writes their `expect`, and adds them to the fixtures.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildReport } from "./feedback-core.mts";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) throw new Error("Give the log file: npm run feedback -- server.log");
const minPolicy = Number(args.find((a) => a.startsWith("--min-policy="))?.split("=")[1] ?? 2);

const report = buildReport((await readFile(file, "utf8")).split(/\r?\n/), minPolicy);
const { counts } = report;
console.log(`Read ${counts.feedback} feedback lines and ${counts.released} released holds (${counts.skipped} unreadable lines skipped).\n`);

console.log(`Draft drafter cases (from opt-in request edits): ${report.drafter_cases.length}`);
for (const c of report.drafter_cases) console.log(`  ${c.id}: "${c.text}"\n      rewritten as: "${c.shopper_rewrote_as}"`);

console.log(`\nReturn policies to add (couldn't check free returns ${minPolicy}+ times): ${report.policy_todo.length}`);
for (const p of report.policy_todo) console.log(`  ${p.todo}`);

console.log(`\nStores shoppers flagged: ${report.store_flags.length}`);
for (const s of report.store_flags) console.log(`  ${s.store}: wrong store ${s.wrong_store}, wrong item ${s.wrong_item}, not delivered ${s.not_delivered}`);

console.log(`\n"Asks you first" questions and how often shoppers said no:`);
for (const q of report.questions) console.log(`  ${q.asked_because}: asked ${q.times}, refused ${q.refused}`);

console.log(`\nOther requirements the checker couldn't settle (listings to label): ${report.checker_review.length}`);
for (const r of report.checker_review) console.log(`  ${r.store} · ${r.attr}: ${r.verdict} ×${r.times}`);

await mkdir(new URL("../data/eval/", import.meta.url), { recursive: true });
const out = new URL(`../data/eval/feedback-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
await writeFile(out, JSON.stringify({ _note: "Drafts from real shopper feedback. Review every item before use; never commit (may contain shoppers' words).", ...report }, null, 2) + "\n");
console.log(`\nSaved ${out.pathname}`);
