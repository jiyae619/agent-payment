"use client";

// Day 1 test bench: a developer page, not shopper-facing. Each button is one PayPal step.

import { useEffect, useState } from "react";
import type { Json } from "@/lib/paypal";

type State = {
  orderId?: string;
  setupTokenId?: string;
  vaultId?: string;
  authorizationId?: string;
  heldAmount?: string;
};

type LogEntry = { at: string; step: string; ok: boolean; data: unknown };

const KEY = "day1-state";

function load(): State {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function save(s: State) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

async function call(action: string, body: object = {}) {
  const res = await fetch(`/api/day1/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json() };
}

export default function Day1() {
  const [state, setState] = useState<State>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState("120.00");
  const [description, setDescription] = useState("Up to $120: running shoes, waterproof, size 8, by Fri");
  const [captureAmount, setCaptureAmount] = useState("94.00");
  const [itemName, setItemName] = useState("Trail running shoes, waterproof, size 8");
  const [itemTotal, setItemTotal] = useState("94.00");

  const update = (patch: State) =>
    setState((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });

  const record = (step: string, ok: boolean, data: unknown) =>
    setLog((l) => [{ at: new Date().toLocaleTimeString(), step, ok, data }, ...l]);

  async function run(step: string, action: string, body: object, onOk?: (data: Json) => void) {
    setBusy(true);
    try {
      const { ok, data } = await call(action, body);
      record(step, ok, data);
      if (ok) onOk?.(data);
    } finally {
      setBusy(false);
    }
  }

  // Handle the return from PayPal's approval page.
  useEffect(() => {
    const saved = load();
    // Restoring state after PayPal redirects back is a one-time sync with sessionStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(saved);
    const params = new URLSearchParams(window.location.search);
    const step = params.get("step");
    window.history.replaceState(null, "", "/day1");

    if (step === "order-return") {
      const orderId = params.get("token") ?? saved.orderId;
      run("Place hold after approval", "authorize", { orderId }, (d) =>
        update({ authorizationId: d.authorization?.id, heldAmount: d.authorization?.amount?.value }),
      );
    } else if (step === "vault-return") {
      run("Save PayPal account", "vault-token", { setupTokenId: saved.setupTokenId }, (d) =>
        update({ vaultId: d.vaultId }),
      );
    } else if (step === "cancel") {
      record("Shopper cancelled on PayPal", false, {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToPayPal = (url?: string) => {
    if (url) window.location.href = url;
  };

  const auth = state.authorizationId;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 font-sans">
      <h1 className="text-2xl font-semibold">Day 1: PayPal hold → charge / release</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Developer test bench (sandbox). Approve on PayPal with your <strong>sandbox personal</strong> account.
      </p>

      <section className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">A. Save the shopper&apos;s PayPal account (Vault)</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Approve once; then each purchase gets its own hold for the real item, with no login.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() =>
            run("Start saving PayPal account", "vault-setup", {}, (d) => {
              update({ setupTokenId: d.setupTokenId });
              goToPayPal(d.approveUrl);
            })}>
            1. Save PayPal account
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label="Item" value={itemName} onChange={setItemName} />
          <Field label="Total ($)" value={itemTotal} onChange={setItemTotal} />
        </div>
        <div className="mt-3">
          <Button disabled={busy || !state.vaultId} onClick={() =>
            run("Hold real item on saved account", "vault-hold", { vaultId: state.vaultId, itemName, total: itemTotal }, (d) =>
              update({ authorizationId: d.authorization?.id, heldAmount: d.authorization?.amount?.value }),
            )}>
            2. Hold for this item (no login)
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">B. Fallback: shopper approves a hold up to a cap</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label="Cap ($)" value={cap} onChange={setCap} />
          <Field label="What PayPal's screen shows" value={description} onChange={setDescription} />
        </div>
        <div className="mt-3">
          <Button disabled={busy} onClick={() =>
            run("Create hold order", "hold", { cap, description }, (d) => {
              update({ orderId: d.orderId });
              goToPayPal(d.approveUrl);
            })}>
            Approve hold on PayPal
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">Then: charge or release</h2>
        <p className="text-sm">
          Current hold: {auth ? <code>{auth}</code> : "none"} {state.heldAmount && <>(${state.heldAmount} held)</>}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label="Charge amount ($)" value={captureAmount} onChange={setCaptureAmount} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy || !auth} onClick={() => run("Charge", "capture", { authorizationId: auth, amount: captureAmount })}>
            Charge ${captureAmount}
          </Button>
          <Button disabled={busy || !auth} onClick={() => run("Try to charge over the cap", "capture", { authorizationId: auth, amount: (Number(state.heldAmount ?? 0) + 10).toFixed(2) })}>
            Try charging $10 over (should refuse)
          </Button>
          <Button disabled={busy || !auth} onClick={() => run("Release hold", "void", { authorizationId: auth })}>
            Release hold
          </Button>
          <Button disabled={busy || !auth} onClick={() => run("Check status", "status", { authorizationId: auth })}>
            Check status
          </Button>
          <Button disabled={busy} onClick={() => { save({}); setState({}); setLog([]); }}>
            Reset
          </Button>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Log</h2>
        <ol className="mt-2 space-y-2">
          {log.map((e, i) => (
            <li key={i} className="rounded border border-zinc-200 p-2 text-xs dark:border-zinc-800">
              <div className={e.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                {e.at} · {e.step} · {e.ok ? "OK" : "FAILED"}
              </div>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(e.data, null, 2)}</pre>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Button(props: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {props.children}
    </button>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col text-sm">
      {props.label}
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
