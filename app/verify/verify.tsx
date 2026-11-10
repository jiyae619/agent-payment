"use client";

// Read-only merchant view of a saved proof. Everything shown comes from the file; the server only
// says whether the seal holds and whether the PayPal order carries the same proof id. The shopper's
// request text (and the words each rule came from) is never shown here.

import { useEffect, useState } from "react";
import { OUTCOME_TEXT, type Proof } from "@/lib/proof.ts";

type Result = { intact: boolean; paypal: { order_status: string; custom_id: string | null; matches: boolean } | null };

const VERDICT = { checked: "✓ Checked", didnt_match: "✕ Didn't match", couldnt_check: "? Couldn't check" } as const;

export default function Verify() {
  const [proof, setProof] = useState<Proof | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);


  const open = async (file: File) => check(await file.text());

  async function check(text: string) {
    setError(null);
    setResult(null);
    setProof(null);
    setBusy(true);
    try {
      const saved = JSON.parse(text);
      if (!saved?.proof || typeof saved.seal !== "string") throw new Error("This isn't a saved proof file.");
      const res = await fetch("/api/proof/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proof: saved.proof, seal: saved.seal }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "It couldn't be checked.");
      setProof(saved.proof);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }


  // Opened from Your purchases: the proof is waiting in this browser, so check it straight away.
  useEffect(() => {
    let handed: string | null = null;
    try {
      handed = localStorage.getItem("shopping-assistant:verify");
      localStorage.removeItem("shopping-assistant:verify");
    } catch {
      // storage blocked: use the file button
    }
    if (handed) void check(handed);
  }, []);
  return (
    <section className="sheet" aria-live="polite">
      <label className="btn secondary file-pick">
        {busy ? "Checking…" : "Open a proof file"}
        <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && void open(e.target.files[0])} />
      </label>
      {error && <p role="alert" className="alert">{error}</p>}

      {proof && result && (
        <>
          <p className={result.intact ? "result-good" : "alert"}>
            {result.intact ? "✓ This record is exactly what Shopping Assistant issued." : "✕ This record was changed after it was issued. Don't rely on it."}
          </p>
          {result.intact && (
            <p className="sub">
              {result.paypal === null
                ? "PayPal couldn't be reached to compare the order."
                : result.paypal.matches
                  ? `✓ PayPal order ${proof.paypal.order_id} carries this proof's id (${proof.id}). Order status: ${result.paypal.order_status}.`
                  : `✕ PayPal order ${proof.paypal.order_id} doesn't carry this proof's id.`}
            </p>
          )}

          {result.intact && (
            <>
              <div>
                <span className="step">Bought</span>
                <p className="title">{proof.picked.title}</p>
                <p className="sub">
                  {proof.picked.store} · {proof.picked.quantity} × ${proof.picked.price_each} = ${proof.picked.total} ·{" "}
                  {proof.picked.reason_written_by === "shopper" ? "the shopper chose this over the recommendation" : "the recommended option"}
                </p>
                <p className="sub"><b>Outcome: {proof.outcome ? OUTCOME_TEXT[proof.outcome.status] : proof.decision.action}</b>{proof.outcome?.status === "charged" ? ` · $${proof.outcome.amount}` : ""}</p>
                <p className="sub">Guess level: {proof.level ?? "Allow guesses"} · approved {new Date(proof.approved_at).toLocaleString()}</p>
              </div>

              <div>
                <span className="step">Rules the shopper approved</span>
                <ul className="list">
                  {proof.read_back.map((r, i) => (
                    <li key={i} className="li"><span className="what">{r.it_will} <span className="note inline">· {r.how_sure}</span></span></li>
                  ))}
                </ul>
              </div>

              {proof.checks.length > 0 && (
                <div>
                  <span className="step">Checked against the store&apos;s own words</span>
                  <ul className="list">
                    {proof.checks.map((c, i) => (
                      <li key={i} className="li">
                        <span className="what">
                          {VERDICT[c.verdict]}: {c.attr} {c.value !== "yes" ? c.value : ""}
                          {c.quote && <span className="note">&ldquo;{c.quote}&rdquo;</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <span className="step">Timeline</span>
                <ol className="list">
                  {proof.events.map((e, i) => (
                    <li key={i} className="li"><span className="what">{e.what}<span className="note">{new Date(e.at).toLocaleString()}</span></span></li>
                  ))}
                </ol>
              </div>
              <p className="note">The shopper&apos;s own words aren&apos;t in this file. It holds only a fingerprint, so they can prove what they wrote if they choose to.</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
