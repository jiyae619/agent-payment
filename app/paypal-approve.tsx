"use client";

// The official PayPal button (JS SDK v6, the "save PayPal" flow from PayPal's own v6 sample).
// The shopper logs in to their PayPal on PayPal's screen and agrees to let this app hold and charge
// it for purchases they approve. We get a setup token back; the server turns it into a saved account
// (the id never reaches the browser). Nothing is held or charged here.

import { useEffect, useRef, useState } from "react";

// Sandbox only: this demo never touches live PayPal.
const SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";

type Session = { start: (opts: { presentationMode: string }, p: Promise<{ vaultSetupToken: string }>) => Promise<void> };
type SdkInstance = {
  findEligibleMethods: (o: { currencyCode: string; paymentFlow: string }) => Promise<{ isEligible: (m: string) => boolean }>;
  createPayPalSavePaymentSession: (o: {
    onApprove: (d: { vaultSetupToken: string }) => void;
    onCancel: () => void;
    onError: (e: unknown) => void;
  }) => Session;
};
type PayPalV6 = { createInstance: (o: { clientToken: string; components: string[]; pageType: string }) => Promise<SdkInstance> };

let sdkLoad: Promise<PayPalV6> | null = null;
function loadSdk(): Promise<PayPalV6> {
  sdkLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve((window as unknown as { paypal: PayPalV6 }).paypal);
    s.onerror = () => {
      sdkLoad = null;
      reject(new Error("PayPal didn't load."));
    };
    document.head.appendChild(s);
  });
  return sdkLoad;
}

async function createSetupToken(): Promise<{ vaultSetupToken: string }> {
  const res = await fetch("/api/paypal/setup-token", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(data.error ?? "PayPal isn't available right now.");
  return { vaultSetupToken: data.id };
}

export default function PayPalApprove({ disabled, onSaved }: { disabled: boolean; onSaved: (vaultSetupToken: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [note, setNote] = useState<string | null>(null);
  const saved = useRef(onSaved);
  useEffect(() => {
    saved.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    let gone = false;
    let button: HTMLElement | null = null;
    (async () => {
      try {
        const res = await fetch("/api/paypal/client-token");
        const { clientToken } = await res.json();
        if (!res.ok || !clientToken) throw new Error("no client token");
        const paypal = await loadSdk();
        const sdk = await paypal.createInstance({ clientToken, components: ["paypal-payments"], pageType: "checkout" });
        const methods = await sdk.findEligibleMethods({ currencyCode: "USD", paymentFlow: "VAULT_WITHOUT_PAYMENT" });
        if (gone) return;
        if (!methods.isEligible("paypal")) {
          setState("unavailable");
          return;
        }
        const session = sdk.createPayPalSavePaymentSession({
          onApprove: (d) => {
            setNote(null);
            saved.current(d.vaultSetupToken);
          },
          onCancel: () => setNote("You closed PayPal. Nothing was saved or charged."),
          onError: () => setNote("PayPal had a problem. Nothing was charged. Try again, or use the demo account."),
        });
        // Same element and style as PayPal's v6 save-payment sample.
        button = document.createElement("paypal-button");
        button.className = "paypal-gold";
        button.addEventListener("click", () => {
          setNote(null);
          // Pass the promise itself, not awaited: PayPal opens its window in the same click.
          session.start({ presentationMode: "auto" }, createSetupToken()).catch(() => {
            setNote("PayPal had a problem. Nothing was charged. Try again, or use the demo account.");
          });
        });
        slot.current?.appendChild(button);
        setState("ready");
      } catch {
        if (!gone) setState("unavailable");
      }
    })();
    return () => {
      gone = true;
      button?.remove();
    };
  }, []);

  return (
    <div className="paypal-approve">
      <div ref={slot} className={disabled ? "paypal-slot off" : "paypal-slot"} aria-busy={state === "loading"} />
      {state === "loading" && <p className="sub">Loading PayPal…</p>}
      {state === "unavailable" && <p className="sub">The PayPal button isn&apos;t available right now. You can use the demo account below.</p>}
      {note && <p role="status" className="sub">{note}</p>}
    </div>
  );
}
