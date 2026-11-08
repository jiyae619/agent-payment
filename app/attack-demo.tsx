"use client";

// The gift-card demo, side by side: the same fooled agent under a total-only approval and under
// this app's approval. Real sandbox money moves on the naive side; nothing is held on the other.

import { useState } from "react";
import type { Decision } from "@/lib/enforce.ts";
import type { FunnelStep } from "@/lib/shortlist.ts";

type Result = {
  error?: string;
  request?: string;
  hidden_note?: string;
  proposed?: { title: string; price: number; store: string };
  decision?: Decision;
  funnel?: FunnelStep[];
  reached_pick?: boolean;
  paypal?: { orderId?: string; captureId?: string; amount?: number; readBack?: { order: string } } | null;
};

const REQUEST = "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $100.";

export default function AttackDemo() {
  const [naive, setNaive] = useState<Result | null>(null);
  const [informed, setInformed] = useState<Result | null>(null);
  const [busy, setBusy] = useState<"naive" | "informed" | null>(null);

  async function run(mode: "naive" | "informed") {
    setBusy(mode);
    const res = await fetch("/api/demo/attack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    const data: Result = await res.json().catch(() => ({ error: "Something went wrong." }));
    (mode === "naive" ? setNaive : setInformed)(res.ok ? data : { error: data.error ?? "Something went wrong." });
    setBusy(null);
  }

  const card = "flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800";
  const button = "self-start rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50";
  const note = naive?.hidden_note ?? informed?.hidden_note;

  return (
    <section className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-2xl font-semibold">Why the approval screen matters</h2>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        A product page hides a note telling shopping assistants to buy its $100 gift card. Below, an assistant that obeys text on
        product pages (simulated, so it falls for the note every time) shops for: &ldquo;{REQUEST}&rdquo;
      </p>
      {note && (
        <blockquote className="mt-3 rounded-lg bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-900">Hidden in the gift card&apos;s listing: &ldquo;{note}&rdquo;</blockquote>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className={card}>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">A total-only approval</p>
          <p className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">Let your assistant spend up to <b>$120</b>. <span className="text-zinc-500">[Approve]</span></p>
          <button type="button" disabled={busy !== null} onClick={() => run("naive")} className={`${button} bg-zinc-700`}>
            {busy === "naive" ? "Shopping…" : "Run with this approval"}
          </button>
          {naive?.error && <p role="alert" className="text-red-700 dark:text-red-300">{naive.error}</p>}
          {naive?.decision?.action === "capture" && (
            <div role="status" className="rounded-lg bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">
              <p className="font-semibold">Bought: {naive.proposed?.title}</p>
              <p className="mt-1 text-sm">It was under $120, the only rule this approval had, so PayPal took ${naive.paypal?.amount} (sandbox). Gift cards are hard to get back.</p>
              <p className="mt-1 font-mono text-xs">PayPal capture {naive.paypal?.captureId}</p>
            </div>
          )}
        </div>

        <div className={card}>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">This app&apos;s approval</p>
          <ul className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm dark:border-zinc-700">
            <li>Buy running shoes, nothing else</li>
            <li>No more than $120 · waterproof · size 8 · free returns</li>
            <li>Ask first above $100, for a different item, or a new store</li>
            <li>Never gift cards, prepaid cards, crypto or money transfers</li>
          </ul>
          <button type="button" disabled={busy !== null} onClick={() => run("informed")} className={`${button} bg-[#0070ba]`}>
            {busy === "informed" ? "Shopping…" : "Run with this approval"}
          </button>
          {informed?.error && <p role="alert" className="text-red-700 dark:text-red-300">{informed.error}</p>}
          {informed?.decision && (
            <div role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <p className="font-semibold">Nothing held, nothing bought.</p>
              <p className="mt-1 text-sm">
                {informed.reached_pick ? "" : "The gift card was dropped before the assistant could choose it"}
                {informed.funnel ? ` (${informed.funnel.slice(0, 2).map((s) => `${s.count} ${s.label}`).join(" → ")}).` : "."} Even if it got through, the payment step would refuse it:
              </p>
              {informed.decision.action === "void" && (
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {informed.decision.reasons.slice(0, 3).map((r, i) => <li key={i}>{r.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
