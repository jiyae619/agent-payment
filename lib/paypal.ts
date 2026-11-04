// Minimal PayPal REST client (sandbox). Money-moving calls live here, never in agent tools.
// The Agent Toolkit's create_order always uses intent CAPTURE, so holds go through REST directly.

// PayPal responses are untyped JSON in this spike; typed models come with the enforcement service.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;

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
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new PayPalError("oauth2/token", res.status, data);

  // Refresh a minute early; sandbox tokens last 3–8 hours.
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cached.token;
}

export class PayPalError extends Error {
  constructor(public path: string, public status: number, public body: unknown) {
    super(`PayPal ${path} failed with ${status}`);
  }
}

export async function paypal<T = Json>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // Idempotency: a retried capture or void must not run twice.
      ...(method === "POST" ? { "PayPal-Request-Id": crypto.randomUUID() } : {}),
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
export function vaultedHoldOrderBody(vaultId: string, itemName: string, total: number) {
  return {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        description: itemName.slice(0, 127),
        amount: { ...money(total), breakdown: { item_total: money(total) } },
        items: [{ name: itemName.slice(0, 127), quantity: "1", unit_amount: money(total), category: "PHYSICAL_GOODS" }],
      },
    ],
    payment_source: { paypal: { vault_id: vaultId } },
  };
}

export function setupTokenBody(returnUrl: string, cancelUrl: string) {
  return {
    payment_source: {
      paypal: {
        description: "Let your shopping assistant buy within limits you approve",
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

export function authorizationFrom(order: Json) {
  return order?.purchase_units?.[0]?.payments?.authorizations?.[0];
}

export { money };
