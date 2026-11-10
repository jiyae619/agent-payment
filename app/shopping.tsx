"use client";

// Steps 3 to 5 of the flow, one screen at a time: watch it shop (and stop it), choose one of up to
// three checked options, then PayPal holds and code decides (charge, release, or ask you). The
// "why" sentence is the only AI-written text on these screens, and it is tagged as such.

import { useEffect, useRef, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog.ts";
import type { CheckResult, Decision } from "@/lib/enforce.ts";
import type { Policy } from "@/lib/policy.ts";
import type { Returns } from "@/lib/check-core.ts";
import { RATING_TEXT, REASON_TEXT, recordEntry, updateEntry, type DontBuyReason, type Outcome, type Rating } from "@/lib/history.ts";
import type { FunnelStep } from "@/lib/shortlist.ts";

type Step = { step: string; text: string; count?: number };
// The live shelf: what the agent found, and what happened to each item as it shopped.
type ShelfItem = { id: string; title: string; price: number; store: string; image: string | null };
type Shelf = { items: ShelfItem[]; kept?: string[]; dropped?: Record<string, string>; checked: Record<string, { ok: number; of: number }>; picked?: string };
const NO_SHELF: Shelf = { items: [], checked: {} };
type Option = { product: CatalogProduct; checks: CheckResult[]; policy: Policy | null; returns?: Returns; total: number; total_line: string | null };
type ShopResult = {
  outcome?: "choose" | "bought" | "released" | "ask" | "nothing_found" | "stopped";
  options?: Option[];
  choice?: string; // sealed options; the server only lets the shopper pick one of these
  recommended?: { id: string; reason: string; by: "ai" | "code" };
  message?: string;
  error?: string;
  funnel?: FunnelStep[];
  pick?: { product: CatalogProduct; reason: string; by: "ai" | "code" | "shopper"; quantity?: number; total?: number; total_line?: string | null };
  checks?: CheckResult[];
  policy?: Policy | null;
  decision?: Decision;
  paypal?: {
    orderId?: string; authorizationId?: string; held?: number; captureId?: string; amount?: number; status?: string;
    readBack?: { order: string; authorization: string | null; capture: { id: string; status: string; amount: number } | null };
  };
  pending?: string;
  answer_minutes?: number;
  refund?: string; // sealed receipt that can refund exactly this charge
  refunded?: { refundId: string; status: string; amount: number };
  proof?: { events: { at: string; what: string }[]; paypal: { order_id: string } };
  proof_seal?: string;
};

const STAGES: Step[] = [
  { step: "search", text: "Search stores" },
  { step: "filter", text: "Keep what fits your limits" },
  { step: "check", text: "Check the listings" },
  { step: "pick", text: "Line up your options" },
];

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Save as proof: the sealed record as a file the shopper keeps.
function saveProof(proof: unknown, seal: string, orderId: string) {
  const blob = new Blob([JSON.stringify({ proof, seal, check_at: "/verify" }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `purchase-proof-${orderId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// The final outcome of a run, for the shopper's history: bought, released by the rules, or refused by them.
function outcomeOf(r: ShopResult): Outcome | null {
  if (r.outcome === "bought") return "bought";
  if (r.outcome === "released") return r.decision?.action === "ask" ? "refused" : "released";
  return null;
}

function sendFeedback(kind: "dont_buy_reason" | "rating", value: string, r: ShopResult, outcome: Outcome) {
  const asked = r.decision?.action === "ask" ? r.decision.checkins.map((c) => c.rule) : [];
  void fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, value, store: r.pick?.product.store, outcome, asked_because: asked }),
  }).catch(() => {});
}

// Which step of the flow this screen is: 2 shopping, 3 choosing, 4 paying (and the result).
export type ShopStage = 2 | 3 | 4;

export default function Shopping({ approval, request, item, onEdit, onStage }: { approval: string; request: string; item: string; onEdit: () => void; onStage: (s: ShopStage) => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [shelf, setShelf] = useState<Shelf>(NO_SHELF);
  const [result, setResult] = useState<ShopResult | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<"pay" | "dont" | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  // The options screen, kept so the shopper can go back and choose another after a release.
  const [options, setOptions] = useState<ShopResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  const started = useRef(false);

  async function run() {
    const ctrl = new AbortController();
    controller.current = ctrl;
    setSteps([]);
    setShelf(NO_SHELF);
    setResult(null);
    setRunning(true);
    try {
      const res = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approval }), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setResult({ error: data.error ?? "Something went wrong. Nothing was charged." });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        for (let i = buffer.indexOf("\n"); i >= 0; i = buffer.indexOf("\n")) {
          const line = buffer.slice(0, i);
          buffer = buffer.slice(i + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "step") {
            setSteps((s) => [...s, event]);
            if (event.items) setShelf((sh) => ({ ...sh, items: event.items }));
            if (event.kept) setShelf((sh) => ({ ...sh, kept: event.kept, dropped: event.dropped }));
            if (event.step === "pick") setShelf((sh) => ({ ...sh, picked: event.id }));
          } else if (event.type === "item") {
            setShelf((sh) => ({ ...sh, checked: { ...sh.checked, [event.id]: { ok: event.ok, of: event.of } } }));
          } else if (event.type === "result") {
            setResult(event);
          }
        }
      }
    } catch {
      // Nothing is ever held while shopping, so a dropped connection or Stop can't leave money held.
      setResult(ctrl.signal.aborted ? { outcome: "stopped" } : { error: "The connection dropped. Nothing was held or charged." });
    } finally {
      setRunning(false);
    }
  }

  // Approving starts the shopping. The ref keeps React's development double-run from shopping twice.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The shopper picked one option. Only now does PayPal hold money; code then decides.
  async function buy(productId: string) {
    if (!result?.choice) return;
    setBuying(productId);
    const res = await fetch("/api/shop/buy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice: result.choice, productId }) });
    const r = await res.json().catch(() => ({ error: "Something went wrong. Nothing was charged." }));
    setBuying(null);
    if (!res.ok && !r.pick) {
      setResult({ ...result, error: r.error ?? "Something went wrong. Nothing was charged." });
      return;
    }
    setOptions(result);
    setResult(r);
  }

  // Tell the page which step this is, for the stepper at the top.
  const stage: ShopStage = running || !result || result.outcome === "stopped" ? 2 : result.outcome === "choose" ? 3 : result.outcome === "nothing_found" ? 2 : 4;
  useEffect(() => {
    onStage(stage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage, onStage]);

  async function answer(a: "pay" | "dont") {
    if (!result?.pending) return;
    setBusy(a);
    const res = await fetch("/api/shop/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pending: result.pending, answer: a }) });
    const r = await res.json().catch(() => ({ error: "Something went wrong. Nothing changed." }));
    setResult({ ...result, ...r, paypal: { ...result.paypal, ...r.paypal }, pending: r.error ? result.pending : undefined, outcome: r.outcome ?? result.outcome });
    setBusy(null);
  }

  // Refund the whole charge through PayPal. The server only accepts the sealed receipt for this charge.
  async function refund() {
    if (!result?.refund) return;
    const res = await fetch("/api/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refund: result.refund }) });
    const r = await res.json().catch(() => ({ error: "Something went wrong. Nothing changed." }));
    if (!res.ok) {
      setResult({ ...result, error: r.error });
      return;
    }
    setResult({ ...result, error: undefined, refunded: r.refund, proof: r.proof, proof_seal: r.proof_seal });
    if (result.paypal?.orderId) updateEntry(result.paypal.orderId, { refunded: true });
  }

  // Save each finished purchase to the shopper's history (their browser only).
  const outcome = result ? outcomeOf(result) : null;
  const orderId = result?.paypal?.orderId;
  useEffect(() => {
    if (!result || !outcome || !orderId || !result.pick) return;
    recordEntry({
      id: orderId,
      at: new Date().toISOString(),
      request,
      item,
      product: result.pick.product.title,
      store: result.pick.product.store,
      amount: result.pick.total ?? result.pick.product.price,
      outcome,
      asked_because: result.decision?.action === "ask" ? result.decision.checkins.map((c) => c.rule) : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, outcome]);

  if (running || !result) {
    const got = new Map(steps.map((s) => [s.step, s]));
    const nowIndex = STAGES.findIndex((s) => !got.has(s.step));
    return (
      <section className="sheet" aria-live="polite" aria-labelledby="shop-title">
        <span className="step" id="shop-title">Shopping for you</span>
        <p className="quote small">&ldquo;{request}&rdquo;</p>
        <ol className="progress">
          {STAGES.map((s, i) => {
            const ev = got.get(s.step);
            return (
              <li key={s.step} className={ev ? "done" : i === nowIndex ? "now" : ""}>
                <span className="dot" aria-hidden />
                {ev?.text ?? s.text}
                {ev?.count !== undefined && <span className="n">{ev.count}</span>}
              </li>
            );
          })}
        </ol>
        {shelf.items.length > 0 && <ShelfView shelf={shelf} />}
        <p className="sub">Nothing is held yet. You choose before PayPal holds anything.</p>
        <button type="button" className="btn secondary" onClick={() => controller.current?.abort()}>Stop</button>
      </section>
    );
  }

  if (result.outcome === "stopped") {
    return (
      <section className="sheet" aria-live="polite">
        <span className="step">Stopped</span>
        <p className="title">Nothing was held or bought.</p>
        <div className="btns">
          <button type="button" className="btn primary" onClick={() => void run()}>Start again</button>
          <button type="button" className="btn secondary" onClick={onEdit}>Edit request</button>
        </div>
      </section>
    );
  }

  if (result.outcome === "choose" && result.options) {
    return <Choose result={result} buying={buying} onBuy={buy} onEdit={onEdit} />;
  }

  if (result.error && !result.pick) {
    return (
      <section className="sheet" aria-live="polite">
        <p role="alert" className="alert">{result.error}</p>
        <button type="button" className="link" onClick={onEdit}>Edit request</button>
      </section>
    );
  }

  if (result.outcome === "nothing_found" || !result.pick) {
    return (
      <section className="sheet" aria-live="polite">
        <span className="step">Nothing found</span>
        <p className="title">{result.message ?? "Nothing matched your limits."}</p>
        <button type="button" className="link" onClick={onEdit}>Edit request</button>
      </section>
    );
  }

  return (
    <>
      {result.outcome !== "bought" && (
        <Picked result={result} busy={busy} onAnswer={answer} onEdit={onEdit} onBack={options && (options.options?.length ?? 0) > 1 ? () => setResult(options) : undefined} />
      )}
      {outcome === "refused" && orderId && (
        <Ask<DontBuyReason>
          question="Why not? (optional)"
          options={REASON_TEXT}
          onPick={(v) => {
            updateEntry(orderId, { reason: v });
            sendFeedback("dont_buy_reason", v, result, "refused");
          }}
        />
      )}
      {result.outcome === "bought" && <Done result={result} onRefund={refund} />}
      {result.outcome === "bought" && orderId && (
        <Ask<Rating>
          question="Was this right?"
          options={RATING_TEXT}
          onPick={(v) => {
            updateEntry(orderId, { rating: v });
            sendFeedback("rating", v, result, "bought");
          }}
        />
      )}
    </>
  );
}

// One optional question with a few answers. Answers go to the shopper's history and become
// suggestions they can accept next time; they never change a limit by themselves.
function Ask<T extends string>({ question, options, onPick }: { question: string; options: Record<T, string>; onPick: (v: T) => void }) {
  const [picked, setPicked] = useState<T | null>(null);
  return (
    <section className="sheet" aria-live="polite">
      <span className="step">{question}</span>
      {picked ? (
        <p className="sub">Saved to your history on this device. Next time it can suggest a change, and you decide.</p>
      ) : (
        <div className="starters">
          {(Object.keys(options) as T[]).map((k) => (
            <button key={k} type="button" className="starter" onClick={() => { setPicked(k); onPick(k); }}>{options[k]}</button>
          ))}
        </div>
      )}
    </section>
  );
}

function Picked({ result, busy, onAnswer, onEdit, onBack }: { result: ShopResult; busy: string | null; onAnswer: (a: "pay" | "dont") => void; onEdit: () => void; onBack?: () => void }) {
  const pick = result.pick!;
  const p = pick.product;
  const checks = result.checks ?? [];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const label = (c: CheckResult) => cap(c.value === "yes" ? c.attr : c.attr === "size" ? `size ${c.value}` : `${c.attr}: ${c.value}`);
  // The store's words, once each. A very short quote ("8") gets its requirement's name so it reads on its own.
  const quotes = [...new Set(checks.filter((c) => c.quote).map((c) => (c.quote!.length <= 3 ? `${cap(c.attr)} ${c.quote}` : c.quote!)))];
  const asking = result.outcome === "ask" && result.decision?.action === "ask";
  const released = result.outcome === "released";
  const amount = pick.total ?? p.price;

  return (
    <section className="sheet" aria-live="polite" aria-labelledby="pick-title">
      <span className="step" id="pick-title">{result.outcome === "ask" ? "One question first" : "Your choice"}</span>
      <div className="product">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="photo" src={p.image} alt={p.title} />
        ) : (
          <div className="photo" aria-hidden />
        )}
        <div className="p-info">
          <div className="p-title">{p.title}</div>
          {p.url ? (
            <a className="p-link" href={p.url} target="_blank" rel="noreferrer">{p.store} ↗</a>
          ) : (
            <span className="sub">{p.store}</span>
          )}
          <div className="p-price">{pick.total_line ?? money(amount)}</div>
        </div>
      </div>

      {checks.length > 0 && (
        <div className="facts">
          <div className="fact-row">
            <span className="fact-label">Matches</span>
            <span className="chips">
              {checks.map((c, i) => (
                <span key={i} className={`chip ${c.verdict === "checked" ? "ok" : c.verdict === "didnt_match" ? "no" : "ask"}`}>
                  <span className={`mark small ${c.verdict === "checked" ? "ok" : c.verdict === "didnt_match" ? "no" : "ask"}`} aria-hidden>
                    {c.verdict === "checked" ? "✓" : c.verdict === "didnt_match" ? "✕" : "?"}
                  </span>
                  {label(c)}
                  {c.verdict !== "checked" && <span className="sr-only">{c.verdict === "didnt_match" ? " (doesn't match)" : " (couldn't check)"}</span>}
                </span>
              ))}
            </span>
          </div>
          <div className="fact-row">
            <span className="fact-label">Listing says</span>
            <span className="store-words">{quotes.length ? quotes.join(" · ") : "Nothing about these"}</span>
          </div>
        </div>
      )}

      <p className="why"><b>Why this one:</b> {pick.reason}{pick.by === "ai" && <span className="ai-tag">AI</span>}</p>

      {asking && result.decision?.action === "ask" && (
        <>
          {result.decision.checkins.map((c, i) => (
            <div key={i} className="flag"><span className="mark ask" aria-hidden>!</span><span>{c.message}</span></div>
          ))}
          <p className="sub">
            PayPal is holding {money(result.paypal?.held ?? amount)}. Not charged.
            {result.answer_minutes ? ` Answer within ${result.answer_minutes} minutes, or PayPal releases the hold.` : ""}
          </p>
          <div className="btns">
            <button type="button" className="btn primary" disabled={busy !== null} onClick={() => onAnswer("pay")}>{busy === "pay" ? "Paying…" : `Pay ${money(result.paypal?.held ?? amount)}`}</button>
            <button type="button" className="btn secondary" disabled={busy !== null} onClick={() => onAnswer("dont")}>{busy === "dont" ? "Releasing…" : "Don't buy"}</button>
          </div>
        </>
      )}

      {released && (
        <>
          <div className="flag bad" role="status">
            <span className="mark no" aria-hidden>✕</span>
            <span>
              Not bought. PayPal released the hold.
              {result.decision?.action === "void" && (
                <span className="note">{result.decision.reasons.map((r) => r.message).join(" ")}</span>
              )}
              {result.message && <span className="note">{result.message}</span>}
            </span>
          </div>
          {onBack && <button type="button" className="btn secondary" onClick={onBack}>Choose another option</button>}
          <button type="button" className="link" onClick={onEdit}>Edit request</button>
        </>
      )}

      {result.error && <p role="alert" className="alert">{result.error}</p>}

      {result.funnel && (
        <details className="more">
          <summary>How it chose</summary>
          <ol>{result.funnel.map((s, i) => <li key={i}>{s.count} {s.label}</li>)}</ol>
        </details>
      )}
    </section>
  );
}

function Done({ result, onRefund }: { result: ShopResult; onRefund: () => Promise<void> }) {
  const pp = result.paypal;
  const rb = pp?.readBack;
  const asked = result.decision?.action === "ask";
  const [confirming, setConfirming] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const charged = pp?.amount ?? 0;
  return (
    <section className="sheet" aria-labelledby="done-title" aria-live="polite">
      <span className="step" id="done-title">{result.refunded ? "Refunded" : "Done"}</span>
      {result.pick && (
        <div className="product">
          {result.pick.product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="photo" src={result.pick.product.image} alt={result.pick.product.title} />
          ) : (
            <div className="photo" aria-hidden />
          )}
          <div className="p-info">
            <div className="p-title">{result.pick.product.title}</div>
            <span className="sub">{result.pick.product.store}{result.pick.total_line ? ` · ${result.pick.total_line}` : ""}</span>
            <div className="money">{money(charged)}</div>
            <span className="sub">{result.refunded ? "Refunded" : "Charged to PayPal"}</span>
          </div>
        </div>
      )}
      {result.refunded && (
        <div className="flag good" role="status">
          <span className="mark ok" aria-hidden>✓</span>
          <span>PayPal returned {money(result.refunded.amount)} to the PayPal that paid.</span>
        </div>
      )}
      <ul className="list">
        <li className="li"><span className="mark ok" aria-hidden>✓</span><span className="what">{asked ? "You said yes when it asked" : "Within your limit"}</span></li>
        {(result.checks ?? []).filter((c) => c.verdict === "checked").length > 0 && (
          <li className="li"><span className="mark ok" aria-hidden>✓</span><span className="what">Every check passed</span></li>
        )}
      </ul>
      <p className="sub">Problem later? Not received or not as described: PayPal Purchase Protection may cover eligible purchases. Not what you wanted: the store&apos;s returns, or refund it here.</p>
      {result.refund && !result.refunded && (
        confirming ? (
          <div className="btns">
            <button type="button" className="btn primary" disabled={refunding} onClick={async () => { setRefunding(true); await onRefund(); setRefunding(false); setConfirming(false); }}>
              {refunding ? "Refunding…" : `Refund ${money(charged)}`}
            </button>
            <button type="button" className="btn secondary" disabled={refunding} onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        ) : (
          <button type="button" className="link" onClick={() => setConfirming(true)}>Refund this purchase</button>
        )
      )}
      {result.proof && result.proof_seal && (
        <button type="button" className="btn secondary" onClick={() => saveProof(result.proof, result.proof_seal!, result.proof!.paypal.order_id)}>
          Save as proof
        </button>
      )}
      {result.proof && result.proof_seal && (
        <p className="note">A store or PayPal can check the saved file at <a href="/verify" target="_blank" rel="noreferrer">/verify</a>. Your own words stay private.</p>
      )}
      <details className="more">
        <summary>Details</summary>
        <dl>
          <dt>PayPal order</dt><dd>{pp?.orderId}</dd>
          {pp?.captureId && (<><dt>Charge</dt><dd>{pp.captureId}</dd></>)}
          {result.refunded && (<><dt>Refund</dt><dd>{result.refunded.refundId}</dd></>)}
          {rb && (<><dt>PayPal says</dt><dd>{rb.order.toLowerCase()}{rb.capture ? `, ${money(rb.capture.amount)} ${rb.capture.status.toLowerCase()}` : ""}</dd></>)}
        </dl>
        {result.proof && (
          <ol>{result.proof.events.map((e, i) => <li key={i}>{new Date(e.at).toLocaleTimeString()} · {e.what}</li>)}</ol>
        )}
      </details>
    </section>
  );
}

// Watching it shop: every product it found, dimmed with the rule that removed it, then checked,
// then the one it picked. Plain data from the server; no AI text here.
function ShelfView({ shelf }: { shelf: Shelf }) {
  const order = (id: string) => (shelf.picked === id ? 0 : shelf.kept?.includes(id) ? 1 : shelf.dropped?.[id] ? 3 : 2);
  const items = [...shelf.items].sort((a, b) => order(a.id) - order(b.id));
  return (
    <ul className="shelf" aria-label="What it found">
      {items.map((p) => {
        const reason = shelf.dropped?.[p.id];
        const kept = shelf.kept?.includes(p.id);
        const check = shelf.checked[p.id];
        const picked = shelf.picked === p.id;
        const state = picked ? "picked" : reason ? "dropped" : kept ? "kept" : "found";
        return (
          <li key={p.id} className={`tile ${state}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image ? <img src={p.image} alt="" className="tile-img" loading="lazy" /> : <span className="tile-img" aria-hidden />}
            <span className="tile-title">{p.title}</span>
            <span className="tile-meta">{money(p.price)} · {p.store}</span>
            <span className="tile-status">
              {picked ? "Picked" : reason ? reason : check ? (check.of ? `${check.ok} of ${check.of} confirmed` : "Listing read") : kept ? "Reading listing…" : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Step 4: up to three options it checked the same way. The recommendation comes first with the
// AI's one-sentence reason; the others show their price and checks, written by code. Nothing is
// held until the shopper taps one, and enforcement still checks the one they choose.
function Choose({ result, buying, onBuy, onEdit }: { result: ShopResult; buying: string | null; onBuy: (id: string) => void; onEdit: () => void }) {
  const rec = result.recommended;
  const options = result.options ?? [];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <section className="sheet" aria-live="polite" aria-labelledby="choose-title">
      <span className="step" id="choose-title">Choose one</span>
      <p className="title">{options.length === 1 ? "It found one option that fits" : `It found ${options.length} options that fit your rules`}</p>
      <ul className="options">
        {options.map((o) => {
          const isRec = o.product.id === rec?.id;
          const checked = o.checks.filter((c) => c.verdict === "checked").length;
          return (
            <li key={o.product.id} className={isRec ? "option rec" : "option"}>
              {isRec && <span className="badge">Recommended</span>}
              <div className="product">
                {o.product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="photo" src={o.product.image} alt={o.product.title} />
                ) : (
                  <div className="photo" aria-hidden />
                )}
                <div className="p-info">
                  <div className="p-title">{o.product.title}</div>
                  {o.product.url ? (
                    <a className="p-link" href={o.product.url} target="_blank" rel="noreferrer">{o.product.store} ↗</a>
                  ) : (
                    <span className="sub">{o.product.store}</span>
                  )}
                  <div className="p-price">{o.total_line ?? money(o.total)}</div>
                </div>
              </div>
              {o.checks.length > 0 && (
                <span className="chips">
                  {o.checks.map((c, i) => (
                    <span key={i} className={`chip ${c.verdict === "checked" ? "ok" : c.verdict === "didnt_match" ? "no" : "ask"}`}>
                      <span className={`mark small ${c.verdict === "checked" ? "ok" : c.verdict === "didnt_match" ? "no" : "ask"}`} aria-hidden>
                        {c.verdict === "checked" ? "✓" : c.verdict === "didnt_match" ? "✕" : "?"}
                      </span>
                      {cap(c.value === "yes" ? c.attr : c.attr === "size" ? `size ${c.value}` : `${c.attr}: ${c.value}`)}
                      {c.verdict !== "checked" && <span className="sr-only">{c.verdict === "didnt_match" ? " (doesn't match)" : " (couldn't check)"}</span>}
                    </span>
                  ))}
                </span>
              )}
              {o.returns && (
                <p className={o.returns.evidence === "listing" || o.returns.evidence === "policy" ? "returns" : "returns ask"}>
                  {o.returns.label}
                  {o.returns.evidence !== "listing" && o.returns.evidence !== "policy" && ". It will ask you before paying."}
                </p>
              )}
              {isRec && rec && <p className="why"><b>Why this one:</b> {rec.reason}{rec.by === "ai" && <span className="ai-tag">AI</span>}</p>}
              {o.checks.length > 0 && checked < o.checks.length && (
                <p className="sub">{o.checks.length - checked} of your must-haves couldn&apos;t be confirmed, so it would likely be released.</p>
              )}
              <button type="button" className={isRec ? "btn primary" : "btn secondary"} disabled={buying !== null} onClick={() => onBuy(o.product.id)}>
                {buying === o.product.id ? "PayPal is holding…" : `Choose this · ${money(o.total)}`}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="sub">PayPal holds the money only after you choose, and charges only if every rule checks out.</p>
      {result.error && <p role="alert" className="alert">{result.error}</p>}
      <button type="button" className="link" onClick={onEdit}>None of these? Edit request</button>
    </section>
  );
}
