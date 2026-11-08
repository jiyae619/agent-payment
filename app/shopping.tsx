"use client";

// After approval: the assistant shops, and the shopper sees how it narrowed the choice, what it
// picked and why, what the store's own words proved, and what happened to the money.
// The "why" sentence is the only AI-written text; it's labelled as such.

import { useState } from "react";
import type { CatalogProduct } from "@/lib/catalog.ts";
import type { CheckResult, Decision } from "@/lib/enforce.ts";
import type { Policy } from "@/lib/policy.ts";
import type { FunnelStep } from "@/lib/shortlist.ts";

type ShopResult = {
  outcome?: "bought" | "released" | "ask" | "nothing_found";
  message?: string;
  error?: string;
  funnel?: FunnelStep[];
  pick?: { product: CatalogProduct; reason: string; by: "ai" | "code"; quantity?: number; total?: number; total_line?: string | null };
  checks?: CheckResult[];
  policy?: Policy | null;
  decision?: Decision;
  paypal?: { orderId?: string; authorizationId?: string; held?: number; captureId?: string; amount?: number; status?: string };
  pending?: string;
};

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const VERDICT: Record<CheckResult["verdict"], { text: string; className: string }> = {
  checked: { text: "✓ Checked", className: "text-emerald-700 dark:text-emerald-300" },
  didnt_match: { text: "✗ Didn't match", className: "text-red-700 dark:text-red-300" },
  couldnt_check: { text: "? Couldn't check", className: "text-amber-700 dark:text-amber-300" },
};

export default function Shopping({ approval }: { approval: string }) {
  const [result, setResult] = useState<ShopResult | null>(null);
  const [busy, setBusy] = useState<"shop" | "pay" | "dont" | null>(null);

  async function post(url: string, body: unknown): Promise<ShopResult> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { ...data, error: data.error ?? "Something went wrong. Nothing was charged." };
  }

  async function shop() {
    setBusy("shop");
    setResult(await post("/api/shop", { approval }));
    setBusy(null);
  }

  async function answer(a: "pay" | "dont") {
    if (!result?.pending) return;
    setBusy(a);
    const r = await post("/api/shop/answer", { pending: result.pending, answer: a });
    setResult({ ...result, ...r, pending: r.error ? result.pending : undefined, outcome: r.outcome ?? result.outcome });
    setBusy(null);
  }

  if (!result) {
    return (
      <section className="mt-8">
        <button
          type="button"
          onClick={shop}
          disabled={busy !== null}
          className="w-full rounded-xl bg-zinc-900 px-5 py-4 text-lg font-medium text-white disabled:opacity-50 sm:w-auto dark:bg-white dark:text-zinc-900"
        >
          {busy ? "Shopping… (searching stores and checking listings)" : "Start shopping"}
        </button>
      </section>
    );
  }

  const p = result.pick?.product;
  return (
    <section className="mt-10 space-y-6" aria-live="polite">
      <h2 className="text-2xl font-semibold">What it found</h2>

      {result.funnel && (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-700 dark:text-zinc-300">
          {result.funnel.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>→</span>}
              <span>
                <span className="font-semibold">{s.count}</span> {s.label}
              </span>
            </li>
          ))}
        </ol>
      )}

      {p && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-lg font-semibold">{p.title}</p>
          <p className="text-zinc-600 dark:text-zinc-400">
            {money(p.price)} each at {p.store}
          </p>
          {result.pick?.total_line && (
            <p className="mt-1 font-medium tabular-nums">Total for {result.pick.quantity}: {result.pick.total_line}</p>
          )}
          <p className="mt-3">
            <span className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Why this one{result.pick?.by === "ai" ? " (written by the AI)" : ""}:
            </span>{" "}
            {result.pick?.reason}
          </p>

          {result.checks && result.checks.length > 0 && (
            <ul className="mt-4 space-y-2">
              {result.checks.map((c, i) => (
                <li key={i}>
                  <span className={`font-medium ${VERDICT[c.verdict].className}`}>{VERDICT[c.verdict].text}</span>{" "}
                  {c.value === "yes" ? c.attr : `${c.attr}: ${c.value}`}
                  {c.quote && <span className="block text-sm text-zinc-500">The store says: &ldquo;{c.quote}&rdquo;</span>}
                </li>
              ))}
            </ul>
          )}
          {result.policy && (
            <p className="mt-3 text-sm text-zinc-500">
              Return policy read from{" "}
              <a className="underline" href={result.policy.url} target="_blank" rel="noreferrer">
                {p.store}
              </a>{" "}
              on {result.policy.retrieved}.
            </p>
          )}
        </div>
      )}

      <Outcome result={result} busy={busy} onAnswer={answer} />
    </section>
  );
}

function Outcome({ result, busy, onAnswer }: { result: ShopResult; busy: string | null; onAnswer: (a: "pay" | "dont") => void }) {
  const box = "rounded-xl border-2 p-4";
  if (result.error) {
    return <p role="alert" className={`${box} border-red-400 bg-red-50 dark:bg-red-950`}>{result.error}</p>;
  }
  if (result.outcome === "nothing_found") {
    return <p className={`${box} border-zinc-300`}>{result.message}</p>;
  }
  if (result.outcome === "bought") {
    return (
      <div role="status" className={`${box} border-emerald-500 bg-emerald-50 dark:bg-emerald-950`}>
        <p className="text-lg font-semibold">✓ Bought for {money(result.paypal?.amount ?? 0)}</p>
        <p className="mt-1">
          {result.decision?.action === "ask" ? "You said yes, so PayPal took the held money." : "Everything checked out, so PayPal took the held money."} PayPal capture:{" "}
          {result.paypal?.captureId}
        </p>
      </div>
    );
  }
  if (result.outcome === "released") {
    const reasons = result.decision?.action === "void" ? result.decision.reasons : [];
    return (
      <div role="status" className={`${box} border-amber-500 bg-amber-50 dark:bg-amber-950`}>
        <p className="text-lg font-semibold">Nothing was charged. PayPal released the hold.</p>
        {reasons.length > 0 && (
          <ul className="mt-2 list-disc pl-5">
            {reasons.map((r, i) => <li key={i}>{r.message}</li>)}
          </ul>
        )}
        {reasons.length === 0 && <p className="mt-1">You chose not to buy it.</p>}
      </div>
    );
  }
  if (result.outcome === "ask" && result.decision?.action === "ask") {
    return (
      <div className={`${box} border-sky-500 bg-sky-50 dark:bg-sky-950`}>
        <p className="text-lg font-semibold">✋ It asks you first</p>
        <ul className="mt-2 list-disc pl-5">
          {result.decision.checkins.map((c, i) => <li key={i}>{c.message}</li>)}
        </ul>
        <p className="mt-2">PayPal is holding {money(result.paypal?.held ?? 0)}. Nothing is charged unless you say so.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy !== null} onClick={() => onAnswer("pay")} className="rounded-lg bg-[#0070ba] px-4 py-2 font-medium text-white disabled:opacity-50">
            {busy === "pay" ? "Paying…" : `Pay ${money(result.paypal?.held ?? 0)}`}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => onAnswer("dont")} className="rounded-lg border border-sky-600 px-4 py-2 disabled:opacity-50">
            {busy === "dont" ? "Releasing…" : "Don't buy"}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
