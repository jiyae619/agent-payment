import { connection } from "next/server";
import { PayPalError, browserClientToken } from "@/lib/paypal.ts";

// GET → { clientToken }: the short-lived, browser-safe token the official PayPal button (JS SDK v6)
// needs to save a PayPal account. The client secret never reaches the browser.
export async function GET() {
  // Per request only: never fetched or cached at build time.
  await connection();
  try {
    return Response.json({ clientToken: await browserClientToken() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(`[paypal] client token: ${(err as Error).message}`);
    return Response.json({ error: "PayPal isn't available right now." }, { status: err instanceof PayPalError ? 502 : 500 });
  }
}
