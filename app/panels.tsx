"use client";

// The two panels beside the shopper's screen: PayPal on the left (where the money is, and the real
// API calls this run made) and the store on the right (what it was checked against, and what it
// receives). Both are drawn only from data the run already returned, never from example data.

import { levelName, type Level } from "@/lib/guesses.ts";
import type { Mandate } from "@/lib/mandate.ts";
import { readbackRows } from "@/lib/readback.ts";

export type RunSnapshot = {
  running: boolean;
  found: number; // listings the search returned
  kept: number; // left after your limits
  checked: number; // listings the AI read for proof
  options?: { store: string; title: string; total: number; wont: boolean; quotes: string[] }[];
  outcome?: string;
  pick?: { title: string; store: string; total: number; image?: string | null; url?: string | null };
  paypal?: { orderId?: string; authorizationId?: string; held?: number; captureId?: string; amount?: number; status?: string; readBack?: { order: string } | null };
  decision?: { action: string; messages: string[] };
  proof?: unknown;
  proofSeal?: string;
  proofId?: string;
};

export type TrapSnapshot = { mode: "naive" | "informed"; charged: number | null; orderId?: string; captureId?: string; reason?: string };

type Props = { mandate: Mandate | null; approved: boolean; payer: string | null; level: Level; run: RunSnapshot | null; trap: TrapSnapshot[] };

const money = (n: number) => `$${n.toFixed(2)}`;
const short = (id?: string) => (id ? `${id.slice(0, 6)}…${id.slice(-4)}` : "");

type Money = "none" | "saved" | "held" | "charged" | "released";
const MONEY: { id: Money; label: string }[] = [
  { id: "none", label: "Nothing" },
  { id: "saved", label: "Approved" },
  { id: "held", label: "Held" },
  { id: "charged", label: "Charged" },
  { id: "released", label: "Released" },
];

function moneyState(p: Props): Money {
  const r = p.run;
  if (r?.outcome === "bought") return "charged";
  if (r?.outcome === "released") return "released";
  if (r?.outcome === "ask") return "held";
  if (p.approved) return "saved";
  return "none";
}

export function PayPalPanel(p: Props) {
  const r = p.run;
  const state = p.trap.length ? null : moneyState(p);
  const calls: { api: string; what: string }[] = [];
  if (p.approved) {
    calls.push(p.payer?.startsWith("your PayPal")
      ? { api: "Vault v3", what: "Your PayPal saved for this purchase (setup token → payment token)" }
      : { api: "Vault v3", what: "Saved sandbox test account confirmed" });
  }
  if (r?.paypal?.orderId) {
    calls.push({ api: "Orders v2", what: `Hold ${money(r.paypal.held ?? 0)} · intent AUTHORIZE · order ${short(r.paypal.orderId)}${r.proofId ? ` · custom_id ${short(r.proofId)}` : ""}` });
  }
  if (r?.paypal?.captureId) calls.push({ api: "Payments v2", what: `Capture ${money(r.paypal.amount ?? 0)} · ${short(r.paypal.captureId)}` });
  if (r?.outcome === "released" && r.paypal?.authorizationId) calls.push({ api: "Payments v2", what: `Void the hold · ${short(r.paypal.authorizationId)}` });
  if (r?.paypal?.readBack) calls.push({ api: "Orders v2", what: `Read back: order ${r.paypal.readBack.order.toLowerCase()}` });
  for (const t of p.trap) {
    if (t.mode === "naive") {
      calls.push({ api: "Orders v2", what: `Total-only approval: hold and capture ${money(t.charged ?? 0)} for the gift card · order ${short(t.orderId)}` });
    } else {
      calls.push({ api: "None", what: "This app's approval: no PayPal call. The gift card never reached the agent." });
    }
  }

  return (
    <aside className="panel paypal" aria-label="PayPal">
      <span className="panel-kicker">PayPal</span>
      <p className="panel-sub">Approval, hold, charge, refund. Sandbox only.</p>
      {state && (
        <ol className="money-strip" aria-label="Where the money is">
          {MONEY.filter((m) => m.id !== (state === "released" ? "charged" : "released")).map((m) => (
            <li key={m.id} className={m.id === state ? "now" : ""}>{m.label}</li>
          ))}
        </ol>
      )}
      {state === "held" && <p className="panel-note">PayPal is holding {money(r?.paypal?.held ?? 0)}. Nothing is charged until you answer.</p>}
      {state === "charged" && <p className="panel-note">PayPal charged {money(r?.paypal?.amount ?? 0)}, no more than the hold or your limit.</p>}
      {state === "released" && <p className="panel-note">The hold was voided. Nothing was charged.</p>}
      {p.approved && !r?.paypal?.orderId && !p.trap.length && (
        <p className="panel-note">{r?.running ? "No PayPal calls while it shops. Nothing is held yet." : "Nothing is held until you choose an option."}</p>
      )}
      <span className="panel-label">Calls this run</span>
      {calls.length ? (
        <ul className="calls">
          {calls.map((c, i) => (
            <li key={i}><span className="api">{c.api}</span>{c.what}</li>
          ))}
        </ul>
      ) : (
        <p className="panel-note">None yet. PayPal hears nothing until you approve.</p>
      )}
    </aside>
  );
}

export function StorePanel(p: Props & { onCheck: () => void }) {
  const r = p.run;
  const rules = p.mandate ? readbackRows(p.mandate).filter((x) => x.kind !== "expiry").length : 0;
  return (
    <aside className="panel store" aria-label="The store">
      <span className="panel-kicker">The store</span>
      <p className="panel-sub">What the merchant gets, and what it was held to.</p>

      {p.trap.length > 0 ? (
        p.trap.map((t, i) => (
          <div key={i} className="panel-block">
            <span className="panel-label">{t.mode === "naive" ? "Total-only approval" : "This app's approval"}</span>
            <p className="panel-note">
              {t.mode === "naive" ? `rewards-hub.example received an order for a ${money(t.charged ?? 0)} gift card.` : `No order. ${t.reason ?? "The gift card was blocked."}`}
            </p>
          </div>
        ))
      ) : !r ? (
        <p className="panel-note">Nothing yet. A store hears about a purchase only through PayPal, after you choose.</p>
      ) : (
        <>
          <div className="panel-block">
            <span className="panel-label">Listings checked</span>
            <p className="panel-note">{r.found} found · {r.kept} fit your limits · {r.checked} read for proof</p>
            {(r.options ?? []).map((o, i) => (
              <div key={i} className={o.wont ? "store-row off" : "store-row"}>
                <b>{o.store}</b> {money(o.total)} {o.wont ? "· won't pass" : ""}
                {o.quotes.slice(0, 2).map((q, j) => <span key={j} className="quote-chip">&ldquo;{q}&rdquo;</span>)}
              </div>
            ))}
          </div>
          {r.pick && r.paypal?.orderId && (
            <div className="panel-block">
              <span className="panel-label">Order</span>
              <p className="panel-note">
                <b>{r.pick.title}</b> · {r.pick.store} · {money(r.pick.total)} ·{" "}
                {r.outcome === "bought" ? "paid" : r.outcome === "released" ? "cancelled, nothing paid" : "waiting for the shopper"}
              </p>
            </div>
          )}
          {r.proofId && (
            <div className="panel-block">
              <span className="panel-label">Proof the shopper agreed</span>
              <p className="panel-note">
                The PayPal order carries proof id <code>{short(r.proofId)}</code>: {rules} rules, approved at {levelName(p.level)}. The shopper&apos;s own words are not included.
              </p>
              {r.proof !== undefined && r.proofSeal && (
                <button type="button" className="link" onClick={p.onCheck}>See what a store sees</button>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
