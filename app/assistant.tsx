"use client";

// Step 1 of the Checkout Sheet: what you asked → what it will do. The shopper's words appear once;
// every line below is a fixed template (lib/readback.ts), never AI-written text.

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Mandate } from "@/lib/mandate.ts";
import { readbackRows, type Label } from "@/lib/readback.ts";
import { clearHistory, loadHistory } from "@/lib/history.ts";
import { suggest, type Suggestion } from "@/lib/suggest.ts";
import { applyFix, findWarnings, type Fix, type Warning } from "@/lib/warnings.ts";
import AttackDemo from "./attack-demo";
import PayPalApprove from "./paypal-approve";
import Shopping from "./shopping";

const STARTERS = [
  { label: "Running shoes", watch: "Strict rules: size, free returns, asks above $100", text: "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $100." },
  { label: "Dish soap", watch: "Buys 3; your limit covers the total", text: "3 bottles of dish soap, under $50 for all of them. Any store is fine." },
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
  // Whose PayPal pays: "your PayPal (email)" after the PayPal button, or the demo account.
  const [payer, setPayer] = useState<string | null>(null);
  // Opt-in, off by default: share "before → after" when the shopper rewrites their request.
  const [shareEdit, setShareEdit] = useState(false);

  async function readBack() {
    setLoading(true);
    setError(null);
    const before = mandate?.source_text;
    if (before && shareEdit && before.trim() !== text.trim()) {
      void fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "request_edit", before, after: text }) }).catch(() => {});
    }
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
      <header className="brand">
        <h1>Shopping Assistant</h1>
        <nav className="brand-nav">
          <Link href="/how-it-works">How it works</Link>
          <span className="chip-sandbox">Sandbox</span>
        </nav>
      </header>

      {!mandate && (
        <section className="hero" aria-labelledby="hero-title">
          <h2 id="hero-title">An AI shops for you. PayPal pays only if your rules hold.</h2>
          <ol className="hero-steps">
            <li><span><b>Say it</b> in your own words</span></li>
            <li><span><b>Approve</b> the exact rules, not just a total</span></li>
            <li><span><b>It shops.</b> PayPal holds the money until every rule checks out</span></li>
          </ol>
        </section>
      )}

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
          <div className="try" role="group" aria-label="Try one">
            {STARTERS.map((s) => (
              <button key={s.label} type="button" className="try-card" aria-pressed={text === s.text} onClick={() => setText(s.text)}>
                <b>{s.label}</b>
                <span>{s.watch}</span>
              </button>
            ))}
            <a className="try-card" href="#attack">
              <b>Gift-card trap</b>
              <span>A web page tells the agent to buy a gift card</span>
            </a>
          </div>
          <button type="button" className="btn primary" onClick={readBack} disabled={loading || !text.trim()}>
            {loading ? "Reading your request…" : "Show me what it will do"}
          </button>
          {mandate && (
            <>
              <label className="consent">
                <input type="checkbox" checked={shareEdit} onChange={(e) => setShareEdit(e.target.checked)} />
                <span>Share this correction to help improve the assistant<span className="note">Only your before and after words. No PayPal details.</span></span>
              </label>
              <button type="button" className="link" onClick={() => setEditing(false)}>Cancel</button>
            </>
          )}
          {error && <p role="alert" className="alert">{error}</p>}
        </section>
      ) : (
        <Readback
          mandate={mandate}
          dismissed={dismissed}
          approved={approval !== null}
          payer={payer}
          onEdit={edit}
          onFix={(w) => w.fix && setMandate(applyFix(mandate, w.fix.action))}
          onApply={(fix) => setMandate(applyFix(mandate, fix))}
          onKeep={(w) => setDismissed((d) => [...d, w.id + w.message])}
          onApproved={(token, approved, who) => {
            setPayer(who);
            setMandate(approved);
            setApproval(token);
          }}
        />
      )}

      {mandate && approval && !editing && (
        <Shopping key={approval} approval={approval} request={mandate.source_text} item={mandate.checkout.line_items[0]?.description ?? "anything"} onEdit={edit} />
      )}
      <AttackDemo />
    </main>
  );
}

// "From your past purchases": one-tap suggestions from the shopper's history on this device.
// Nothing changes unless they tap Apply; each one says which purchase it came from.
function PastPurchases({ mandate, onApply }: { mandate: Mandate; onApply: (fix: Fix) => void }) {
  const [history, setHistory] = useState(loadHistory);
  const [hidden, setHidden] = useState<string[]>([]);
  const list = useMemo(() => suggest(mandate, history).filter((s) => !hidden.includes(s.id)), [mandate, history, hidden]);
  if (list.length === 0) return null;
  const take = (s: Suggestion) => {
    onApply(s.fix);
    setHidden((h) => [...h, s.id]);
  };
  return (
    <div className="past" aria-label="From your past purchases">
      <p className="sub">From your past purchases</p>
      {list.map((s) => (
        <div key={s.id} className={`suggestion ${s.kind}`}>
          <span>{s.message}<span className="note">From: {s.source}</span></span>
          <span className="suggestion-actions">
            <button type="button" className="link" onClick={() => take(s)}>Apply</button>
            <button type="button" className="link muted" onClick={() => setHidden((h) => [...h, s.id])}>No thanks</button>
          </span>
        </div>
      ))}
      <button type="button" className="link muted small" onClick={() => { clearHistory(); setHistory([]); }}>Clear my history on this device</button>
    </div>
  );
}

function Readback(props: {
  mandate: Mandate;
  dismissed: string[];
  approved: boolean;
  payer: string | null;
  onEdit: () => void;
  onFix: (w: Warning) => void;
  onKeep: (w: Warning) => void;
  onApply: (fix: Fix) => void;
  onApproved: (token: string, mandate: Mandate, payer: string) => void;
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

  // vaultSetupToken: from the PayPal button (the shopper's own PayPal). Without it: the demo account.
  async function approve(vaultSetupToken?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mandate, vaultSetupToken }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Approval didn't go through. Please try again.");
      props.onApproved(data.approval, data.mandate, data.payer);
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

      {!approved && <PastPurchases mandate={mandate} onApply={props.onApply} />}

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
        <p className="sub">✓ Approved with {props.payer ?? "PayPal"}{ends ? ` · ${ends}` : ""}</p>
      ) : max === null ? (
        <button type="button" className="btn primary" disabled>Add a price limit first</button>
      ) : (
        <div className="approve">
          <p className="approve-title">Approve up to ${max} with PayPal</p>
          <p className="sub">
            PayPal asks you to let Shopping Assistant hold a payment for each purchase. It only charges when every rule above
            checks out, or when you say yes.
          </p>
          <PayPalApprove disabled={busy} onSaved={(token) => void approve(token)} />
          <button type="button" className="link" onClick={() => void approve()} disabled={busy}>
            {busy ? "Approving…" : "No PayPal sandbox login? Use the demo account"}
          </button>
          <p className="assure">PayPal sandbox: no real money moves. This demo store stands in for the real shop.{ends ? ` ${ends}.` : ""}</p>
          {error && <p role="alert" className="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}
