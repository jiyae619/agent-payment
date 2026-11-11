"use client";

// Step 1 of the Checkout Sheet: what you asked → what it will do. The shopper's words appear once;
// every line below is a fixed template (lib/readback.ts), never AI-written text.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Mandate } from "@/lib/mandate.ts";
import { describe, readbackRows, type Label } from "@/lib/readback.ts";
import { guesses, guessKey, LEVELS, setGuess, type Guess, type Level } from "@/lib/guesses.ts";
import { clearHistory, loadHistory } from "@/lib/history.ts";
import { suggest, type Suggestion } from "@/lib/suggest.ts";
import { applyFix, findWarnings, type Fix, type Warning } from "@/lib/warnings.ts";
import AttackDemo from "./attack-demo";
import PayPalApprove from "./paypal-approve";
import { PayPalPanel, StorePanel, type RunSnapshot, type TrapSnapshot } from "./panels";
import Shopping, { type ShopStage } from "./shopping";
import ThemeToggle from "./theme-toggle";

// One purchase per run, real data each time: pick a run, pick how much it may guess, then go.
type RunId = "buys" | "asks" | "stops" | "trap";
const ICON: Record<RunId, string> = {
  buys: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="15" stroke-dasharray="2 3"/><path d="M23 33l6 6 12-14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  asks: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M10 14h44v28H30l-10 9v-9H10z"/><path d="M27 24a5 5 0 1 1 7 4.5c-1.5.8-2 1.6-2 3.5" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="37" r="1.4" fill="currentColor"/></svg>',
  stops: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M32 8l20 8v14c0 13-9 22-20 26-11-4-20-13-20-26V16z"/><path d="M32 16v26" stroke-dasharray="2 3"/><path d="M24 30h16" stroke-width="2" stroke-linecap="round"/></svg>',
  trap: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="10" y="22" width="44" height="28" rx="3"/><path d="M10 30h44M26 22v28"/><path d="M26 22c-6-8 6-11 6-3M26 22c6-8 14-5 8 0"/><path d="M14 12l36 44" stroke-width="2" stroke-linecap="round"/></svg>',
};
const TONE: Record<RunId, string> = { buys: "buy", asks: "ask", stops: "stop", trap: "trap" };

const RUNS: { id: RunId; name: string; watch: string; foot: string; text: string | null }[] = [
  { id: "buys", name: "Buys it", watch: "3 bottles of dish soap. Every rule checks out, so PayPal charges.", foot: "3 × dish soap · under $50 for all", text: "3 bottles of dish soap, under $50 for all of them. Any store is fine." },
  { id: "asks", name: "Asks you first", watch: "Running shoes over your ask-first amount. PayPal holds and waits for you.", foot: "Running shoes · asks above $80", text: "Waterproof running shoes, size 8, under $120. Free returns please. Ask me if it's over $80." },
  { id: "stops", name: "Stops itself", watch: "Waterproof shoes under $60 with free returns. No store proves it, so nothing is held unless you choose one anyway.", foot: "Waterproof · under $60 · free returns", text: "Waterproof running shoes, size 8, under $60. Free returns please." },
  { id: "trap", name: "Prompt-injection trap", watch: "A web page hides orders for the agent.", foot: "A store page hides orders for the agent", text: null },
];

export const MARK: Record<Label, { cls: string; sym: string; name: string }> = {
  locked: { cls: "lock", sym: "$", name: "Locked by PayPal" },
  checked: { cls: "ok", sym: "✓", name: "Checked before paying" },
  asks: { cls: "ask", sym: "!", name: "Asks you first" },
  never: { cls: "no", sym: "✕", name: "Never bought" },
  cant_promise: { cls: "ask", sym: "–", name: "Can't promise" },
};

// The flow as the shopper walks it, one screen at a time.
const STEPS = ["Ask", "Approve", "Shop", "Choose", "Pay"];

function Stepper({ current, stopped = false }: { current: number; stopped?: boolean }) {
  return (
    <ol className="stepper" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s} className={i < current ? "done" : i === current ? "now" : ""} aria-current={i === current ? "step" : undefined}>
          <span className="stepper-n" aria-hidden>{i < current ? "✓" : i + 1}</span>
          <span className="stepper-label">{stopped && i === STEPS.length - 1 ? "Stopped" : s}</span>
        </li>
      ))}
    </ol>
  );
}

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
  // How much it may guess, picked with each request (lib/guesses.ts).
  const [level, setLevel] = useState<Level>("allow");
  const [shopStage, setShopStage] = useState<ShopStage>(2);
  const [runId, setRunId] = useState<RunId | null>(null);
  // What this run has done, for the PayPal and store panels (real data only).
  const [snap, setSnap] = useState<RunSnapshot | null>(null);
  const [trap, setTrap] = useState<TrapSnapshot[]>([]);
  const onSnapshot = useCallback((s: RunSnapshot) => setSnap(s), []);
  const onStage = useCallback((s: ShopStage) => setShopStage(s), []);
  const stage = editing || !mandate ? 0 : !approval ? 1 : shopStage;
  // Each step is its own screen, so a new step starts at the top.
  useEffect(() => {
    if (stage < 2) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

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
    setSnap(null);
    setEditing(true);
  }

  // Starting a run resets the screen and both panels.
  function pickRun(id: RunId) {
    const r = RUNS.find((x) => x.id === id)!;
    setRunId(id);
    setText(r.text ?? "");
    setMandate(null);
    setApproval(null);
    setSnap(null);
    setTrap([]);
    setError(null);
    setEditing(true);
  }

  // Open what a store sees for this run's proof, the way a store would open the saved file.
  function checkProof() {
    if (!snap?.proof || !snap.proofSeal) return;
    try {
      localStorage.setItem("shopping-assistant:verify", JSON.stringify({ proof: snap.proof, seal: snap.proofSeal }));
    } catch {
      // storage blocked: /verify still accepts the saved file
    }
    window.open("/verify", "_blank");
  }

  return (
    <main className="page stage-page">
      <header className="brand">
        <h1>Okay-Pay</h1>
        <nav className="brand-nav">
          <Link href="/purchases">Your purchases</Link>
          <Link href="/how-it-works">How it works</Link>
          <ThemeToggle />
          <span className="chip-sandbox">Sandbox</span>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <h2 id="hero-title">An AI shops for you. PayPal pays only if your rules hold.</h2>
        <p className="sub">Watch one purchase from three sides: PayPal on the left, you in the middle, the store on the right. Pick a run.</p>
      </section>
      <div className="deck" role="group" aria-label="Pick a run">
        {RUNS.map((r, i) => {
          // Fanned like a hand of cards; the picked one lifts.
          const k = i - (RUNS.length - 1) / 2;
          const on = runId === r.id;
          return (
            <button key={r.id} type="button" className="dcard" data-t={TONE[r.id]} aria-pressed={on} title={r.watch} onClick={() => pickRun(r.id)}
              style={{ transform: `translate(${k * 150}px, ${k * k * 9 - (on ? 22 : 0)}px) rotate(${k * 6}deg)`, zIndex: on ? 5 : i }}>
              <b>{r.name}</b>
              <span className="ic" aria-hidden dangerouslySetInnerHTML={{ __html: ICON[r.id] }} />
              <span className="foot">{r.foot}</span>
            </button>
          );
        })}
      </div>

      <div className="stage">
      <PayPalPanel mandate={mandate} approved={approval !== null} payer={payer} level={level} run={snap} trap={trap} />
      <div className="shopper">
      <div className="ph-top">
        <b>Okay-Pay</b>
        <span className="chip-sandbox">{runId ? RUNS.find((r) => r.id === runId)!.name : "Sandbox"}</span>
      </div>
      {runId !== "trap" && <Stepper current={stage} stopped={snap?.outcome === "released"} />}

      {runId === "trap" ? (
        <AttackDemo onResult={(t) => setTrap((list) => [...list.filter((x) => x.mode !== t.mode), t])} />
      ) : editing || !mandate ? (
        <section className="sheet" aria-labelledby="ask-title">
          <span className="step" id="ask-title">What should it buy?</span>
          <label htmlFor="request" className="sr-only">Your request</label>
          <textarea
            id="request"
            className="request"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Running shoes, size 8, under $120. Ask me if it's over $100."
          />
          <fieldset className="levels">
            <legend className="sub">When it has to guess what you meant</legend>
            <div className="level-row">
              {LEVELS.map((l) => (
                <label key={l.id} className={level === l.id ? "level on" : "level"}>
                  <input type="radio" name="level" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} />
                  <b>{l.name}</b>
                  <span>{l.note}</span>
                </label>
              ))}
            </div>
            <p className="note">Every level asks before it buys anything that can&apos;t be undone.</p>
          </fieldset>
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
      ) : !approval ? (
        <Readback
          mandate={mandate}
          level={level}
          onLevel={setLevel}
          dismissed={dismissed}
          approved={approval !== null}
          payer={payer}
          onEdit={edit}
          onFix={(w) => w.fix && setMandate(applyFix(mandate, w.fix.action))}
          onApply={(fix) => setMandate(applyFix(mandate, fix))}
          onGuess={(g, value) => setMandate(setGuess(mandate, g, value))}
          onKeep={(w) => setDismissed((d) => [...d, w.id + w.message])}
          onApproved={(token, approved, who) => {
            setPayer(who);
            setMandate(approved);
            setShopStage(2);
            setApproval(token);
          }}
        />
      ) : (
        <>
          <p className="approved-line">✓ Approved with {payer ?? "PayPal"} · up to ${mandate.payment.amount_range.max}</p>
          <Shopping key={approval} approval={approval} request={mandate.source_text} item={mandate.checkout.line_items[0]?.description ?? "anything"} onEdit={edit} onStage={onStage} onSnapshot={onSnapshot} />
        </>
      )}
      </div>
      <StorePanel mandate={mandate} approved={approval !== null} payer={payer} level={level} run={snap} trap={trap} onCheck={checkProof} />
      </div>
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
  level: Level;
  onLevel: (l: Level) => void;
  onGuess: (g: Guess, value: string) => void;
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
  const found = useMemo(() => guesses(mandate), [mandate]);
  // Guesses the shopper looked at and kept. "Check guesses" needs every one; a changed guess is
  // their own words and stops being a guess.
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const unconfirmed = props.level === "check" ? found.filter((g) => !confirmed.includes(guessKey(g))).length : 0;
  const guessed = new Set(found.map((g) => (g.list === "must_haves" ? "Must be " : "Store must offer ") + describe(g.attr, g.value)));
  const tag = (r: (typeof list)[number]) => (r.label === "never" ? "always" : guessed.has(r.willDo) ? "my guess" : r.said ? "your words" : "safe default");
  const keep = (g: Guess, value: string) => {
    if (value.trim() && value.trim() !== g.value) props.onGuess(g, value);
    else setConfirmed((c) => [...c, guessKey(g)]);
    setOpen(null);
  };

  // vaultSetupToken: from the PayPal button (the shopper's own PayPal). Without it: the demo account.
  async function approve(vaultSetupToken?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mandate, level: props.level, vaultSetupToken }) });
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
      <span className="step" id="asked-title">I&apos;ll buy</span>
      <Summary mandate={mandate} found={found} level={props.level} confirmed={confirmed} open={open} onOpen={setOpen} onKeep={keep} />
      <p className="quote small">You said: &ldquo;{mandate.source_text}&rdquo;</p>
      {!approved && <button type="button" className="link" onClick={props.onEdit}>Edit request</button>}

      {found.length === 0 && (
        <p className="note">No guesses in this request, so {LEVELS.find((l) => l.id === props.level)!.name} changes nothing here.</p>
      )}
      {found.length > 0 && (
        <p className="guess-note" role="status">
          <span className="mark ask small" aria-hidden>!</span>
          {found.length === 1 ? "1 guess" : `${found.length} guesses`}: {found.map((g) => `"${g.phrase ?? g.attr}"`).join(", ")}.{" "}
          {props.level === "check" ? (unconfirmed ? `Tap each one to confirm it (${unconfirmed} left).` : "All confirmed.") : props.level === "auto" ? "Auto-shop uses its best guess." : "Tap one to change it."}
        </p>
      )}

      <details className="rules">
        <summary>See all {list.length + 1} rules</summary>
        <ul className="list" aria-label="What it will do">
          {list.map((r, i) => (
            <li key={i} className="li">
              <span className={`mark ${MARK[r.label].cls}`} role="img" aria-label={MARK[r.label].name}>{MARK[r.label].sym}</span>
              <span className="what">{r.willDo} <span className="note inline">· {tag(r)}</span></span>
            </li>
          ))}
          <li className="li">
            <span className="mark ask" role="img" aria-label="Asks you first">!</span>
            <span className="what">Asks you if it can&apos;t be undone, like a final-sale item <span className="note inline">· always</span></span>
          </li>
        </ul>
      </details>

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
            Sign in to a PayPal sandbox account and agree to let Okay-Pay hold a payment for each purchase. It only
            charges when every rule checks out, or when you say yes.
          </p>
          {unconfirmed > 0 && <p className="sub">Confirm {unconfirmed === 1 ? "the guess" : `the ${unconfirmed} guesses`} above to approve.</p>}
          <PayPalApprove disabled={busy || unconfirmed > 0} onSaved={(token) => void approve(token)} />
          <button type="button" className="link small" onClick={() => void approve()} disabled={busy || unconfirmed > 0}>
            {busy ? "Approving…" : "Can't sign in to the PayPal sandbox? Use the saved test account"}
          </button>
          <p className="assure">PayPal sandbox: no real money moves. This demo store stands in for the real shop.{ends ? ` ${ends}.` : ""}</p>
          {error && <p role="alert" className="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}

// The one-line "I'll buy" summary. Fixed template from the rules; guesses appear as chips the
// shopper can open to keep or change (plain text under Auto-shop, which uses its best guess).
function Summary(props: { mandate: Mandate; found: Guess[]; level: Level; confirmed: string[]; open: string | null; onOpen: (k: string | null) => void; onKeep: (g: Guess, value: string) => void }) {
  const { mandate: m, found } = props;
  const li = m.checkout.line_items[0];
  const item = li ? `${li.quantity > 1 ? `${li.quantity} × ` : ""}${li.description}` : "anything that fits";
  const guessAt = (list: Guess["list"], index: number) => found.find((g) => g.list === list && g.index === index);
  const parts: (string | Guess)[] = [];
  for (const list of ["must_haves", "conditions_of_sale"] as const) {
    m.ext[list].forEach((p, i) => parts.push(guessAt(list, i) ?? (list === "conditions_of_sale" ? `with ${describe(p.attr, p.value)}` : describe(p.attr, p.value))));
  }
  const max = m.payment.amount_range.max;
  const stores = m.checkout.allowed_merchants.map((s) => s.domain);
  const editing = found.find((g) => guessKey(g) === props.open);
  return (
    <>
      <p className="summary">
        {item.charAt(0).toUpperCase() + item.slice(1)}
        {parts.map((p, i) => (
          <span key={i}>
            {", "}
            {typeof p === "string" ? p : props.level === "auto" ? (
              <span className="guess-chip auto">{describe(p.attr, p.value)}</span>
            ) : (
              <button type="button" className={props.confirmed.includes(guessKey(p)) ? "guess-chip ok" : "guess-chip"} aria-expanded={props.open === guessKey(p)} onClick={() => props.onOpen(props.open === guessKey(p) ? null : guessKey(p))}>
                {describe(p.attr, p.value)} <span aria-hidden>▾</span>
              </button>
            )}
          </span>
        ))}
        {max !== null && `, under $${max}`}
        {stores.length > 0 && `, only from ${stores.join(" or ")}`}.
      </p>
      {editing && <GuessEditor key={guessKey(editing)} guess={editing} onKeep={props.onKeep} onCancel={() => props.onOpen(null)} />}
    </>
  );
}

function GuessEditor({ guess, onKeep, onCancel }: { guess: Guess; onKeep: (g: Guess, value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(guess.value);
  const same = value.trim() === guess.value;
  return (
    <div className="guess-edit">
      <p className="sub">You said &ldquo;{guess.phrase ?? guess.attr}&rdquo;. It read that as <b>{describe(guess.attr, guess.value)}</b>.</p>
      <label className="sr-only" htmlFor="guess-value">{guess.attr}</label>
      <input id="guess-value" className="guess-input" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="btns">
        <button type="button" className="btn primary" onClick={() => onKeep(guess, value)} disabled={!value.trim()}>{same ? "Keep this guess" : "Use my words"}</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Close</button>
      </div>
    </div>
  );
}
