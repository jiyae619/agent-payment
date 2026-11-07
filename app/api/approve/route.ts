import { ApprovalError, sealApproval } from "@/lib/approval.ts";
import { Mandate } from "@/lib/mandate.ts";
import { PayPalError, paypal } from "@/lib/paypal.ts";

// POST { mandate } → { approval, mandate, payer }
// The shopper approves the instructions they just checked. Public demo (option A): purchases go on a
// sandbox PayPal account saved once by the owner (PAYPAL_DEMO_VAULT_ID), so visitors need no login.
// No money is held yet: the hold is placed later, for the real item at its real price.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = Mandate.safeParse(body.mandate);
  if (!parsed.success) return Response.json({ error: "These instructions couldn't be read. Please start again." }, { status: 400 });
  const mandate = parsed.data;

  // Enforcement releases any hold without a limit, so approving one would only fail later.
  if (mandate.payment.amount_range.max === null) {
    return Response.json({ error: "Say how much it can spend first, for example \"under $50\"." }, { status: 400 });
  }
  if (new Date(mandate.exp.at).getTime() <= Date.now()) {
    return Response.json({ error: "These instructions have expired. Please start again." }, { status: 400 });
  }

  const vaultId = process.env.PAYPAL_DEMO_VAULT_ID;
  if (!vaultId) {
    return Response.json(
      { error: "The demo PayPal account isn't connected yet (save one on /day1, then set PAYPAL_DEMO_VAULT_ID)." },
      { status: 503 },
    );
  }

  try {
    // Confirm the saved account still exists before telling the shopper it's connected.
    await paypal("GET", `/v3/vault/payment-tokens/${encodeURIComponent(vaultId)}`);
    const approved = { ...mandate, payment: { ...mandate.payment, vault_id: vaultId } };
    const approval = sealApproval({ mandate: approved, approved_at: new Date().toISOString() });
    return Response.json({ approval, mandate: approved, payer: "Demo shopper (sandbox)" });
  } catch (err) {
    if (err instanceof ApprovalError) return Response.json({ error: err.message }, { status: 500 });
    if (err instanceof PayPalError) {
      const gone = err.status === 404;
      return Response.json(
        { error: gone ? "The saved PayPal account was removed. Connect it again on /day1." : `PayPal didn't answer (${err.status}). Try again.` },
        { status: gone ? 503 : 502 },
      );
    }
    throw err;
  }
}
