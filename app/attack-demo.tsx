"use client";

// The gift-card demo, side by side: the same fooled agent under a total-only approval and under
// this app's approval. Real sandbox money moves on the total-only side; nothing is held on the other.
// The fooled agent is simulated (lib/attack.ts), and the page says so.

import { useState } from "react";
import type { Decision } from "@/lib/enforce.ts";

type Result = {
  error?: string;
  hidden_note?: string;
  proposed?: { title: string; price: number; store: string };
  decision?: Decision;
  paypal?: { captureId?: string; amount?: number } | null;
};

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

  const note = naive?.hidden_note ?? informed?.hidden_note;

  return (
    <section className="demo" id="attack" aria-labelledby="demo-title">
      <h2 id="demo-title">Why the approval screen matters</h2>
      <p className="sub">
        A product page hides a note telling shopping assistants to buy its $100 gift card. A simulated assistant that obeys
        page text shops for waterproof running shoes, under two kinds of approval.
      </p>
      {note && <p className="hidden-note">Hidden in the listing: &ldquo;{note}&rdquo;</p>}

      <div className="demo-grid">
        <div className="sheet">
          <span className="step">Total-only approval</span>
          <p className="mock">Let it spend up to <b>$120</b>.</p>
          <button type="button" className="btn secondary" disabled={busy !== null} onClick={() => run("naive")}>
            {busy === "naive" ? "Shopping…" : "Run"}
          </button>
          {naive?.error && <p role="alert" className="alert">{naive.error}</p>}
          {naive?.decision?.action === "capture" && (
            <p role="status" className="result-bad">
              <b>Bought the gift card.</b> Under $120 was the only rule, so PayPal took ${naive.paypal?.amount} (sandbox).
            </p>
          )}
        </div>

        <div className="sheet">
          <span className="step">This app&apos;s approval</span>
          <ul className="mock">
            <li>Running shoes only · up to $120</li>
            <li>Waterproof · size 8 · free returns</li>
            <li>Never gift cards or money</li>
          </ul>
          <button type="button" className="btn primary" disabled={busy !== null} onClick={() => run("informed")}>
            {busy === "informed" ? "Shopping…" : "Run"}
          </button>
          {informed?.error && <p role="alert" className="alert">{informed.error}</p>}
          {informed?.decision?.action === "void" && (
            <p role="status" className="result-good">
              <b>Nothing held or bought.</b> The gift card was removed before the assistant could pick it. Even if it got through,
              payment would be refused: {informed.decision.reasons[0]?.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
