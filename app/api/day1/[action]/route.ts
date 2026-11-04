// Day 1 spike: prove the hold → capture / void loop works in the PayPal sandbox,
// both with a shopper-approved hold (path B) and with a saved PayPal account (path A, Vault).

import {
  type Json,
  PayPalError,
  approveLink,
  authorizationFrom,
  holdOrderBody,
  money,
  paypal,
  setupTokenBody,
  vaultedHoldOrderBody,
} from "@/lib/paypal";

type Body = Record<string, Json>;

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const body: Body = await request.json().catch(() => ({}));
  const origin = new URL(request.url).origin;

  try {
    return Response.json(await handle(action, body, origin));
  } catch (err) {
    if (err instanceof PayPalError) {
      return Response.json({ error: err.message, paypal: err.body }, { status: err.status });
    }
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

async function handle(action: string, body: Body, origin: string) {
  switch (action) {
    // Path B: the shopper approves a hold of up to `cap` on PayPal's page.
    case "hold": {
      const cap = Number(body.cap);
      if (!(cap > 0)) throw new Error("cap must be a positive number");
      const order = await paypal(
        "POST",
        "/v2/checkout/orders",
        holdOrderBody(cap, String(body.description ?? "Agent purchase"), `${origin}/day1?step=order-return`, `${origin}/day1?step=cancel`),
      );
      return { orderId: order.id, status: order.status, approveUrl: approveLink(order) };
    }

    // After the shopper approves, place the hold.
    case "authorize": {
      const order = await paypal("POST", `/v2/checkout/orders/${body.orderId}/authorize`, {});
      return { orderId: order.id, status: order.status, authorization: authorizationFrom(order) };
    }

    // Take the real amount. Our code enforces the cap: PayPal itself would allow up to +15% on reauth.
    case "capture": {
      const amount = Number(body.amount);
      const auth = await paypal("GET", `/v2/payments/authorizations/${body.authorizationId}`);
      const held = Number(auth.amount.value);
      if (!(amount > 0) || amount > held) {
        throw new Error(`Refused: capture $${amount} is not within the $${held.toFixed(2)} the shopper approved`);
      }
      const capture = await paypal("POST", `/v2/payments/authorizations/${body.authorizationId}/capture`, {
        amount: money(amount),
        final_capture: true,
      });
      return { capture, released: (held - amount).toFixed(2) };
    }

    // Release the hold; nothing is charged.
    case "void": {
      await paypal("POST", `/v2/payments/authorizations/${body.authorizationId}/void`, {});
      return { authorization: await paypal("GET", `/v2/payments/authorizations/${body.authorizationId}`) };
    }

    case "status": {
      return { authorization: await paypal("GET", `/v2/payments/authorizations/${body.authorizationId}`) };
    }

    // Path A: save the shopper's PayPal account once.
    case "vault-setup": {
      const setup = await paypal(
        "POST",
        "/v3/vault/setup-tokens",
        setupTokenBody(`${origin}/day1?step=vault-return`, `${origin}/day1?step=cancel`),
      );
      return { setupTokenId: setup.id, status: setup.status, approveUrl: approveLink(setup) };
    }

    case "vault-token": {
      const token = await paypal("POST", "/v3/vault/payment-tokens", {
        payment_source: { token: { id: body.setupTokenId, type: "SETUP_TOKEN" } },
      });
      return { vaultId: token.id, customerId: token.customer?.id };
    }

    // A hold for the real item on the saved account. No shopper login.
    case "vault-hold": {
      const total = Number(body.total);
      if (!(total > 0)) throw new Error("total must be a positive number");
      const order = await paypal(
        "POST",
        "/v2/checkout/orders",
        vaultedHoldOrderBody(String(body.vaultId), String(body.itemName ?? "Item"), total),
      );
      return { orderId: order.id, status: order.status, authorization: authorizationFrom(order) };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
