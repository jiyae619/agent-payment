"use client";

// Steps 2 and 3 of the Checkout Sheet: watch it shop (and stop it), see what it picked with the
// store's own words, answer if it asks, and get the result. The "why" sentence is the only
// AI-written text on these screens, and it is tagged as such.

import { useEffect, useRef, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog.ts";
import type { CheckResult, Decision } from "@/lib/enforce.ts";
import type { Policy } from "@/lib/policy.ts";
import { RATING_TEXT, REASON_TEXT, recordEntry, updateEntry, type DontBuyReason, type Outcome, type Rating } from "@/lib/history.ts";
import type { FunnelStep } from "@/lib/shortlist.ts";

type Step = { step: string; text: string; count?: number };
type ShopResult = {
  outcome?: "bought" | "released" | "ask" | "nothing_found" | "stopped";
  message?: string;
  error?: string;
  funnel?: FunnelStep[];
  pick?: { product: CatalogProduct; reason: string; by: "ai" | "code"; quantity?: number; total?: number; total_line?: string | null };
  checks?: CheckResult[];
  policy?: Policy | null;
  decision?: Decision;
  paypal?: {
    orderId?: string; authorizationId?: string; held?: number; captureId?: string; amount?: number; status?: string;
    readBack?: { order: string; authorization: string | null; capture: { id: string; status: string; amount: number } | null };
  };
  pending?: string;
  proof?: { events: { at: string; what: string }[]; paypal: { order_id: string } };
  proof_seal?: string;
};

const STAGES: Step[] = [
  { step: "search", text: "Search stores" },
  { step: "filter", text: "Keep what fits your limits" },
  { step: "check", text: "Check the listings" },
  { step: "pick", text: "Pick one" },
  { step: "hold", text: "PayPal holds the money" },
];

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Save as proof: the sealed record as a file the shopper keeps.
function saveProof(proof: unknown, seal: string, orderId: string) {
  const blob = new Blob([JSON.stringify({ proof, seal, check_at: "/api/proof/verify" }, null, 2)], { type: "application/json" });
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

export default function Shopping({ approval, request, item, onEdit }: { approval: string; request: string; item: string; onEdit: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<ShopResult | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<"pay" | "dont" | null>(null);
  const controller = useRef<AbortController | null>(null);
  const started = useRef(false);

  async function run() {
    const ctrl = new AbortController();
    controller.current = ctrl;
    setSteps([]);
    setResult(null);
    setRunning(true);
    let held = false;
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
            if (event.step === "hold") held = true;
            setSteps((s) => [...s, event]);
          } else if (event.type === "result") {
            setResult(event);
          }
        }
      }
    } catch {
      setResult(ctrl.signal.aborted && !held ? { outcome: "stopped" } : { error: "The connection dropped. Check your PayPal activity before trying again." });
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

  async function answer(a: "pay" | "dont") {
    if (!result?.pending) return;
    setBusy(a);
    const res = await fetch("/api/shop/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pending: result.pending, answer: a }) });
    const r = await res.json().catch(() => ({ error: "Something went wrong. Nothing changed." }));
    setResult({ ...result, ...r, paypal: { ...result.paypal, ...r.paypal }, pending: r.error ? result.pending : undefined, outcome: r.outcome ?? result.outcome });
    setBusy(null);
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

  const held = steps.some((s) => s.step === "hold");

  if (running || !result) {
    const got = new Map(steps.map((s) => [s.step, s]));
    const nowIndex = STAGES.findIndex((s) => !got.has(s.step));
    return (
      <section className="sheet" aria-live="polite" aria-labelledby="shop-title">
        <span className="step" id="shop-title">Shopping…</span>
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
        <p className="sub">{held ? "PayPal is holding the money. Not charged yet." : "Nothing is held yet."}</p>
        {!held && (
          <button type="button" className="btn secondary" onClick={() => controller.current?.abort()}>Stop</button>
        )}
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
        <span className="step">2 · Nothing found</span>
        <p className="title">{result.message ?? "Nothing matched your limits."}</p>
        <button type="button" className="link" onClick={onEdit}>Edit request</button>
      </section>
    );
  }

  return (
    <>
      <Picked result={result} busy={busy} onAnswer={answer} onEdit={onEdit} />
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
      {result.outcome === "bought" && <Done result={result} />}
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

function Picked({ result, busy, onAnswer, onEdit }: { result: ShopResult; busy: string | null; onAnswer: (a: "pay" | "dont") => void; onEdit: () => void }) {
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
      <span className="step" id="pick-title">2 · It picked</span>
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
          <p className="sub">PayPal is holding {money(result.paypal?.held ?? amount)}. Not charged.</p>
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
            </span>
          </div>
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

function Done({ result }: { result: ShopResult }) {
  const pp = result.paypal;
  const rb = pp?.readBack;
  const asked = result.decision?.action === "ask";
  return (
    <section className="sheet" aria-labelledby="done-title">
      <span className="step" id="done-title">3 · Done</span>
      <div>
        <div className="money">{money(pp?.amount ?? 0)}</div>
        <p className="sub">Charged · {result.pick?.product.title}</p>
      </div>
      <ul className="list">
        <li className="li"><span className="mark ok" aria-hidden>✓</span><span className="what">{asked ? "You said yes when it asked" : "Within your limit"}</span></li>
        {(result.checks ?? []).filter((c) => c.verdict === "checked").length > 0 && (
          <li className="li"><span className="mark ok" aria-hidden>✓</span><span className="what">Every check passed</span></li>
        )}
      </ul>
      <p className="sub">Problem later? Not received or not as described: PayPal Purchase Protection. Not what you wanted: the store&apos;s returns.</p>
      {result.proof && result.proof_seal && (
        <button type="button" className="btn secondary" onClick={() => saveProof(result.proof, result.proof_seal!, result.proof!.paypal.order_id)}>
          Save as proof
        </button>
      )}
      <details className="more">
        <summary>Details</summary>
        <dl>
          <dt>PayPal order</dt><dd>{pp?.orderId}</dd>
          {pp?.captureId && (<><dt>Charge</dt><dd>{pp.captureId}</dd></>)}
          {rb && (<><dt>PayPal says</dt><dd>{rb.order.toLowerCase()}{rb.capture ? `, ${money(rb.capture.amount)} ${rb.capture.status.toLowerCase()}` : ""}</dd></>)}
        </dl>
        {result.proof && (
          <ol>{result.proof.events.map((e, i) => <li key={i}>{new Date(e.at).toLocaleTimeString()} · {e.what}</li>)}</ol>
        )}
      </details>
    </section>
  );
}
