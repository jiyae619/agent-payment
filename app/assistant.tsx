"use client";

// Step 1 of the Checkout Sheet: what you asked → what it will do. The shopper's words appear once;
// every line below is a fixed template (lib/readback.ts), never AI-written text.

import { useMemo, useState } from "react";
import type { Mandate } from "@/lib/mandate.ts";
import { readbackRows, type Label } from "@/lib/readback.ts";
import { applyFix, findWarnings, type Warning } from "@/lib/warnings.ts";
import AttackDemo from "./attack-demo";
import Shopping from "./shopping";

const STARTERS = [
  { label: "Running shoes", text: "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $100." },
  { label: "Dish soap", text: "3 bottles of dish soap, under $50 for all of them. Any store is fine." },
];

export const MARK: Record<Label, { cls: string; sym: string; name: string }> = {
  locked: { cls: "lock", sym: "$", name: "Locked by PayPal" },
  checked: { cls: "ok", sym: "✓", name: "Checked before paying" },
  asks: { cls: "ask", sym: "!", name: "Asks you first" },
  never: { cls: "no", sym: "✕", name: "Never bought" },
  cant_promise: { cls: "ask", sym: "–", name: "Can't promise" },
};

export default function Assistant() {
  const [text, setText] = useState("");
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [editing, setEditing] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Sealed by the server once the shopper approves; shopping sends it back.
  const [approval, setApproval] = useState<string | null>(null);

  async function readBack() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setMandate(data.mandate);
      setDismissed([]);
      setApproval(null);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function edit() {
    if (mandate) setText(mandate.source_text);
    setApproval(null);
    setEditing(true);
  }

  return (
    <main className="page">
      <div className="brand">
        <h1>Shopping Assistant</h1>
        <span>Sandbox demo</span>
      </div>

      {editing || !mandate ? (
        <section className="sheet" aria-labelledby="ask-title">
          <span className="step" id="ask-title">1 · What should it buy?</span>
          <label htmlFor="request" className="sr-only">Your request</label>
          <textarea
            id="request"
            className="request"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Running shoes, size 8, under $120. Ask me if it's over $100."
          />
          <div className="starters">
            {STARTERS.map((s) => (
              <button key={s.label} type="button" className="starter" onClick={() => setText(s.text)}>{s.label}</button>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={readBack} disabled={loading || !text.trim()}>
            {loading ? "Reading your request…" : "Show me what it will do"}
          </button>
          {mandate && (
            <button type="button" className="link" onClick={() => setEditing(false)}>Cancel</button>
          )}
          {error && <p role="alert" className="alert">{error}</p>}
        </section>
      ) : (
        <Readback
          mandate={mandate}
          dismissed={dismissed}
          approved={approval !== null}
          onEdit={edit}
          onFix={(w) => w.fix && setMandate(applyFix(mandate, w.fix.action))}
          onKeep={(w) => setDismissed((d) => [...d, w.id + w.message])}
          onApproved={(token, approved) => {
            setMandate(approved);
            setApproval(token);
          }}
        />
      )}

      {mandate && approval && !editing && <Shopping key={approval} approval={approval} onEdit={edit} />}
      <AttackDemo />
    </main>
  );
}

function Readback(props: {
  mandate: Mandate;
  dismissed: string[];
  approved: boolean;
  onEdit: () => void;
  onFix: (w: Warning) => void;
  onKeep: (w: Warning) => void;
  onApproved: (token: string, mandate: Mandate) => void;
}) {
  const { mandate, approved } = props;
  const rows = useMemo(() => readbackRows(mandate), [mandate]);
  const list = rows.filter((r) => r.kind !== "expiry");
  const ends = rows.find((r) => r.kind === "expiry")?.willDo;
  const warnings = useMemo(() => findWarnings(mandate).filter((w) => !props.dismissed.includes(w.id + w.message)), [mandate, props.dismissed]);
  const current = approved ? undefined : warnings[0];
  const max = mandate.payment.amount_range.max;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mandate }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Approval didn't go through. Please try again.");
      props.onApproved(data.approval, data.mandate);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sheet" aria-labelledby="asked-title">
      <span className="step" id="asked-title">1 · You asked</span>
      <div className="quote">&ldquo;{mandate.source_text}&rdquo;</div>
      {!approved && <button type="button" className="link" onClick={props.onEdit}>Edit request</button>}

      <ul className="list" aria-label="What it will do">
        {list.map((r, i) => (
          <li key={i} className="li">
            <span className={`mark ${MARK[r.label].cls}`} role="img" aria-label={MARK[r.label].name}>{MARK[r.label].sym}</span>
            <span className="what">{r.willDo}</span>
          </li>
        ))}
      </ul>

      {mandate.ext.unmapped.length > 0 && (
        <div>
          <p className="sub">Can&apos;t promise</p>
          <ul className="list">
            {mandate.ext.unmapped.map((u, i) => (
              <li key={i} className="li">
                <span className="mark ask small" role="img" aria-label="Can't promise">–</span>
                <span className="what">&ldquo;{u.phrase}&rdquo;<span className="note">{u.reason}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {current && (
        <div className="flag" role="status">
          <span className="mark ask" aria-hidden>!</span>
          <span>{current.message}</span>
          {current.fix ? (
            <button type="button" className="link" onClick={() => props.onFix(current)}>{current.fix.label}</button>
          ) : (
            <button type="button" className="link" onClick={() => props.onKeep(current)}>OK</button>
          )}
        </div>
      )}
      {current?.fix && (
        <button type="button" className="link" onClick={() => props.onKeep(current)}>Keep it this way</button>
      )}

      {approved ? (
        <p className="sub">✓ Approved{ends ? ` · ${ends}` : ""}</p>
      ) : (
        <>
          <button type="button" className="btn primary" onClick={approve} disabled={busy || max === null}>
            {busy ? "Approving…" : max === null ? "Add a price limit first" : `Approve up to $${max}`}
          </button>
          <p className="assure">Paid with PayPal (sandbox demo account). Nothing is charged without your OK.{ends ? ` ${ends}.` : ""}</p>
          {error && <p role="alert" className="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
