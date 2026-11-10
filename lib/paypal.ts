// Minimal PayPal REST client (sandbox). Money-moving calls live here, never in agent tools.
// The Agent Toolkit's create_order always uses intent CAPTURE, so holds go through REST directly.

// PayPal responses are untyped JSON in this spike; typed models come with the enforcement service.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

let cached: { token: string; expiresAt: number } | null = null;

async function oauth(form: string): Promise<Json> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in .env.local");
  }
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new PayPalError("oauth2/token", res.status, data);
  return data;
}

async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const data = await oauth("grant_type=client_credentials");
  // Refresh a minute early; sandbox tokens last 3–8 hours.
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cached.token;
}

// The browser-safe token the official PayPal button (JS SDK v6) needs to save a PayPal account.
// It is scoped to the SDK and short-lived; the client secret never leaves the server.
export async function browserClientToken(): Promise<string> {
  const data = await oauth("grant_type=client_credentials&response_type=client_token");
  return String(data.access_token);
}

export class PayPalError extends Error {
  path: string;
  status: number;
  body: unknown;
  constructor(path: string, status: number, body: unknown) {
    // debug_id is what PayPal support asks for, so it goes in every error message (and the logs).
    const debugId = (body as { debug_id?: string } | null)?.debug_id;
    super(`PayPal ${path} failed with ${status}${debugId ? ` (debug_id ${debugId})` : ""}`);
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

// One id per step on one PayPal resource (e.g. "capture" on an authorization). PayPal answers a
// repeated request id with the first result instead of acting again, so a retried charge or
// release can never run twice. A fresh id per call would defeat this.
export function stepRequestId(resourceId: string, step: string): string {
  return `${step}-${resourceId}`;
}

export async function paypal<T = Json>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  opts: { requestId?: string } = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // Idempotency: money-moving steps pass a stable id (stepRequestId). Creating a new
      // order or token has no stable key yet, so it gets a fresh one.
      ...(method === "POST" ? { "PayPal-Request-Id": opts.requestId ?? crypto.randomUUID() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new PayPalError(path, res.status, data);
  return data as T;
}

export function approveLink(resource: { links?: { rel: string; href: string }[] }): string | undefined {
  return resource.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
}

const money = (value: number) => ({ currency_code: "USD", value: value.toFixed(2) });

// A hold for up to `cap` dollars. The item text carries the shopper's instructions so
// PayPal's own approval screen says what was approved, not just a total.
export function holdOrderBody(cap: number, description: string, returnUrl: string, cancelUrl: string) {
  return {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        description: description.slice(0, 127),
        amount: { ...money(cap), breakdown: { item_total: money(cap) } },
        items: [{ name: description.slice(0, 127), quantity: "1", unit_amount: money(cap), category: "PHYSICAL_GOODS" }],
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Shopping Assistant (sandbox)",
          user_action: "CONTINUE",
          shipping_preference: "NO_SHIPPING",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  };
}

// A hold for the real item, charged to a saved (vaulted) PayPal account. No shopper login needed.
// proofId goes in custom_id, so the merchant and PayPal can tie the order to the shopper's proof
// record; note (the returns label and anything not confirmed) goes in the item description.
export function vaultedHoldOrderBody(vaultId: string, itemName: string, total: number, extra: { proofId?: string; note?: string } = {}) {
  return {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        description: itemName.slice(0, 127),
        ...(extra.proofId ? { custom_id: extra.proofId.slice(0, 127) } : {}),
        amount: { ...money(total), breakdown: { item_total: money(total) } },
        items: [{ name: itemName.slice(0, 127), ...(extra.note ? { description: extra.note.slice(0, 127) } : {}), quantity: "1", unit_amount: money(total), category: "PHYSICAL_GOODS" }],
      },
    ],
    payment_source: { paypal: { vault_id: vaultId } },
  };
}

export function setupTokenBody(returnUrl: string, cancelUrl: string) {
  return {
    payment_source: {
      paypal: {
        description: "Shopping Assistant holds a payment for each purchase you approve and charges only within your rules",
        usage_type: "MERCHANT",
        customer_type: "CONSUMER",
        usage_pattern: "IMMEDIATE",
        experience_context: {
          brand_name: "Shopping Assistant (sandbox)",
          shipping_preference: "NO_SHIPPING",
          vault_instruction: "ON_PAYER_APPROVAL",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  };
}

// After the shopper approves on PayPal's own screen, turn the setup token into a saved account.
// The vault id stays on the server (inside the encrypted approval); the browser gets the email only.
export async function savedAccountFrom(setupTokenId: string): Promise<{ vaultId: string; email: string | null }> {
  const token: Json = await paypal(
    "POST",
    "/v3/vault/payment-tokens",
    { payment_source: { token: { id: setupTokenId, type: "SETUP_TOKEN" } } },
    { requestId: stepRequestId(setupTokenId, "vault-token") },
  );
  return { vaultId: String(token.id), email: token.payment_source?.paypal?.email_address ?? null };
}

export function authorizationFrom(order: Json) {
  return order?.purchase_units?.[0]?.payments?.authorizations?.[0];
}

export { money };
