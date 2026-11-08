"use client";

// The shopper-facing flow: say it in your own words → see exactly what the assistant will do.
// Everything on the readback is built from fixed templates (lib/readback.ts); no AI-written text.

import { useMemo, useState } from "react";
import type { Mandate } from "@/lib/mandate.ts";
import { LABEL_TEXT, readbackRows, type Label } from "@/lib/readback.ts";
import { applyFix, findWarnings, type Warning } from "@/lib/warnings.ts";
import AttackDemo from "./attack-demo";
import Shopping from "./shopping";

const STARTERS = [
  { label: "Buy running shoes", text: "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $100." },
  { label: "Restock something", text: "Please buy one bottle of unscented dish soap. I don't want to spend more than $15 including shipping." },
];

const LABEL_STYLE: Record<Label, { icon: string; className: string }> = {
  locked: { icon: "🔒", className: "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800" },
  checked: { icon: "✓", className: "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-800" },
  asks: { icon: "✋", className: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800" },
  cant_promise: { icon: "–", className: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700" },
};

export default function Assistant() {
  const [text, setText] = useState("");
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Sealed by the server once the shopper approves; the shopping step will send it back.
  const [approval, setApproval] = useState<{ token: string; payer: string } | null>(null);

  async function readBack() {
    setLoading(true);
    setError(null);
    setMandate(null);
    setDismissed([]);
    setApproval(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setMandate(data.mandate);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-[17px] leading-relaxed">
      <h1 className="text-3xl font-semibold tracking-tight">Shopping Assistant</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Tell it what to buy, in your own words. It shows you exactly what it will do, and nothing is charged until it checks everything.
      </p>

      <section className="mt-8">
        <label htmlFor="request" className="block font-medium">What should it buy?</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setText(s.text)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-base hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {s.label}
            </button>
          ))}
        </div>
        <textarea
          id="request"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="For example: running shoes, size 8, under $120, ask me if it's over $100"
          className="mt-3 w-full rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={readBack}
          disabled={loading || !text.trim()}
          className="mt-3 w-full rounded-xl bg-zinc-900 px-5 py-4 text-lg font-medium text-white disabled:opacity-40 sm:w-auto dark:bg-white dark:text-zinc-900"
        >
          {loading ? "Reading your request…" : "Show me what it will do"}
        </button>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">
            {error}
          </p>
        )}
      </section>

      {mandate && (
        <Readback
          mandate={mandate}
          dismissed={dismissed}
          onFix={(w) => {
            if (w.fix) setMandate(applyFix(mandate, w.fix.action));
          }}
          onKeep={(w) => setDismissed((d) => [...d, w.id + w.message])}
          approval={approval}
          onApproved={(token, payer, approved) => {
            setMandate(approved);
            setApproval({ token, payer });
          }}
        />
      )}
      {mandate && approval && <Shopping key={approval.token} approval={approval.token} />}
      <AttackDemo />
    </main>
  );
}

function Readback(props: {
  mandate: Mandate;
  dismissed: string[];
  onFix: (w: Warning) => void;
  onKeep: (w: Warning) => void;
  approval: { token: string; payer: string } | null;
  onApproved: (token: string, payer: string, mandate: Mandate) => void;
}) {
  const { mandate, approval } = props;
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const rows = useMemo(() => readbackRows(mandate), [mandate]);
  const warnings = useMemo(
    () => findWarnings(mandate).filter((w) => !props.dismissed.includes(w.id + w.message)),
    [mandate, props.dismissed],
  );
  const max = mandate.payment.amount_range.max;
  // Once approved, the instructions are sealed: no more one-tap changes.
  const current = approval ? undefined : warnings[0];

  async function approve() {
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "PayPal approval didn't go through. Please try again.");
      props.onApproved(data.approval, data.payer, data.mandate);
    } catch (err) {
      setApproveError((err as Error).message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <section className="mt-10" aria-live="polite">
      <h2 className="text-2xl font-semibold">Here&apos;s what your shopping assistant will do</h2>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">Nothing is charged until it checks everything below.</p>

      {current && (
        <div className="mt-6 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950">
          <p className="text-sm font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Please double-check{warnings.length > 1 ? ` (1 of ${warnings.length})` : ""}
          </p>
          <p className="mt-1 text-lg">{current.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {current.fix && (
              <button type="button" onClick={() => props.onFix(current)} className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-black hover:bg-amber-400">
                {current.fix.label}
              </button>
            )}
            <button type="button" onClick={() => props.onKeep(current)} className="rounded-lg border border-amber-500 px-4 py-2">
              Keep it this way
            </button>
          </div>
        </div>
      )}

      <ul className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">{r.willDo}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {r.said ? <>You said: &ldquo;{r.said}&rdquo;</> : "Added to keep you safe"}
              </p>
            </div>
            <Badge label={r.label} />
          </li>
        ))}
      </ul>

      {mandate.ext.unmapped.length > 0 && (
        <div className="mt-6 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
          <h3 className="font-semibold">Things it can&apos;t promise</h3>
          <ul className="mt-2 space-y-2">
            {mandate.ext.unmapped.map((u, i) => (
              <li key={i}>
                <span className="font-medium">&ldquo;{u.phrase}&rdquo;</span>
                <span className="text-zinc-600 dark:text-zinc-400"> — {u.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer font-medium">See exact limits</summary>
        <pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify(mandate, null, 2)}</pre>
      </details>

      <div className="mt-8">
        {approval ? (
          <div role="status" className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950">
            <p className="text-lg font-semibold">✓ Approved with PayPal</p>
            <p className="mt-1">
              It can now shop within these limits, paying with <span className="font-medium">{approval.payer}</span>. Nothing is charged
              yet: PayPal holds the money only once it finds the item, and you&apos;re only charged if everything checks out.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={approve}
              disabled={approving || max === null}
              className="w-full rounded-xl bg-[#0070ba] px-5 py-4 text-lg font-medium text-white hover:bg-[#005ea6] disabled:opacity-50 sm:w-auto"
            >
              {approving ? "Connecting to PayPal…" : max !== null ? `Approve up to $${max} with PayPal` : "Approve with PayPal"}
            </button>
            <p className="mt-2 text-sm text-zinc-500">
              {max === null
                ? "Say how much it can spend first, for example \"under $50\"."
                : "You're only charged if everything checks out. Otherwise PayPal releases the money."}
            </p>
            {approveError && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">
                {approveError}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Badge({ label }: { label: Label }) {
  const s = LABEL_STYLE[label];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 self-start rounded-full px-3 py-1 text-sm font-medium ring-1 ${s.className}`}>
      <span aria-hidden>{s.icon}</span>
      {LABEL_TEXT[label]}
    </span>
  );
}
