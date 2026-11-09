import { PayPalError, paypal, setupTokenBody } from "@/lib/paypal.ts";

// POST → { id }: a vault setup token for the PayPal button. The shopper approves it on PayPal's own
// screen, which says this app may hold and charge their PayPal for purchases they approve.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const setup = await paypal("POST", "/v3/vault/setup-tokens", setupTokenBody(`${origin}/`, `${origin}/`));
    return Response.json({ id: setup.id });
  } catch (err) {
    console.error(`[paypal] setup token: ${(err as Error).message}`);
    return Response.json({ error: "PayPal isn't available right now." }, { status: err instanceof PayPalError ? 502 : 500 });
  }
}
