"use client";

// The shopper's order list, kept in their own browser (lib/history.ts). Refunds live here, after
// the purchase, not on the confirmation screen. Each refund sends the sealed token the server made
// for that one charge, so this page can't refund anything else.

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearHistory, loadHistory, updateEntry, type HistoryEntry } from "@/lib/history.ts";
import { saveProof } from "../shopping";

const money = (n: number) => `$${n.toFixed(2)}`;

// Hand the proof to /verify in a new tab, the way a store would open the saved file.
export const VERIFY_KEY = "shopping-assistant:verify";
function checkProof(proof: unknown, seal: string) {
  try {
    localStorage.setItem(VERIFY_KEY, JSON.stringify({ proof, seal }));
  } catch {
    // storage blocked: /verify still accepts the saved file
  }
  window.open("/verify", "_blank");
}
const STATUS: Record<HistoryEntry["outcome"], string> = { bought: "Charged", released: "Released, nothing charged", refused: "You said don't buy" };

export default function Purchases() {
  // Read after mount: the list lives in this browser only.
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mount; reading it during render would mismatch the server HTML
  useEffect(() => setList(loadHistory()), []);

  if (list === null) return null;
  if (list.length === 0) {
    return (
      <section className="sheet">
        <p className="title">Nothing yet</p>
        <p className="sub">Purchases you make here show up in this list, on this device only.</p>
        <Link className="btn primary" href="/">Start shopping</Link>
      </section>
    );
  }
  return (
    <section className="sheet" aria-label="Your purchases">
      <ul className="orders">
        {list.map((e) => <Order key={e.id} entry={e} onChange={setList} />)}
      </ul>
      <p className="note">Kept on this device only.</p>
      <button type="button" className="link muted small" onClick={() => { clearHistory(); setList([]); }}>Clear this list</button>
    </section>
  );
}

function Order({ entry: e, onChange }: { entry: HistoryEntry; onChange: (l: HistoryEntry[]) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRefund = e.outcome === "bought" && !e.refunded && Boolean(e.refund);

  async function refund() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refund: e.refund }) });
      const r = await res.json().catch(() => ({ error: "Something went wrong. Nothing changed." }));
      if (!res.ok) throw new Error(r.error ?? "The refund didn't go through. Nothing changed.");
      onChange(updateEntry(e.id, { refunded: true, refund: undefined, proof: r.proof, proof_seal: r.proof_seal }));
      setConfirming(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="order">
      <div className="order-head">
        <span className="p-title">{e.product}</span>
        <span className="money small">{money(e.amount)}</span>
      </div>
      <span className="sub">{e.store} · {new Date(e.at).toLocaleString()} · {e.refunded ? "Refunded" : STATUS[e.outcome]}</span>
      <span className="note">You asked: &ldquo;{e.request}&rdquo;</span>
      {canRefund && (confirming ? (
        <div className="btns">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void refund()}>{busy ? "Refunding…" : `Refund ${money(e.amount)}`}</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep it</button>
        </div>
      ) : (
        <button type="button" className="link" onClick={() => setConfirming(true)}>Refund this purchase</button>
      ))}
      {e.refunded && <span className="sub">✓ PayPal returned {money(e.amount)} to the PayPal account that paid.</span>}
      {Boolean(e.proof) && e.proof_seal && (
        <span className="order-actions">
          <button type="button" className="link" onClick={() => saveProof(e.proof, e.proof_seal!, e.id)}>Save as proof</button>
          <button type="button" className="link" onClick={() => checkProof(e.proof, e.proof_seal!)}>See what a store sees</button>
        </span>
      )}
      {error && <p role="alert" className="alert">{error}</p>}
    </li>
  );
}
