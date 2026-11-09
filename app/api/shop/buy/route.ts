import { ApprovalError, unseal } from "@/lib/approval.ts";
import { releaseExpiredHolds } from "@/lib/hold.ts";
import { purchase, type Choice } from "@/lib/purchase.ts";

// POST { choice, productId } → the shopper picked one of the checked options. Only now does PayPal
// hold money; enforcement then charges, releases, or asks first (lib/purchase.ts).
// `choice` is the sealed record from /api/shop, so the options and the approval can't be swapped.
export async function POST(request: Request) {
  await releaseExpiredHolds();
  const body = await request.json().catch(() => ({}));
  let choice: Choice;
  try {
    choice = unseal(String(body.choice ?? "")) as Choice;
  } catch (err) {
    return Response.json({ error: err instanceof ApprovalError ? err.message : "These options couldn't be read. Please shop again." }, { status: 400 });
  }
  try {
    const { status, body: result } = await purchase(choice, String(body.productId ?? ""));
    return Response.json(result, { status });
  } catch (err) {
    if (err instanceof ApprovalError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
