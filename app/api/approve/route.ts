import { ApprovalError, sealApproval } from "@/lib/approval.ts";
import { Mandate } from "@/lib/mandate.ts";
import { PayPalError, paypal, savedAccountFrom } from "@/lib/paypal.ts";

// POST { mandate, vaultSetupToken? } → { approval, mandate, payer }
// The shopper approves the instructions they just checked.
// - With the official PayPal button: they logged in to their own (sandbox) PayPal and agreed, on
//   PayPal's screen, to let this app hold and charge it. The setup token becomes their saved account.
// - Without it (the demo option): a sandbox account saved once by the owner (PAYPAL_DEMO_VAULT_ID).
// No money is held yet: the hold is placed later, for the real item at its real price. The saved
// account's id goes only into the encrypted approval; the browser never sees it.
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

  const setupToken = typeof body.vaultSetupToken === "string" ? body.vaultSetupToken : null;
  const demoVault = process.env.PAYPAL_DEMO_VAULT_ID;
  if (!setupToken && !demoVault) {
    return Response.json({ error: "Connect your PayPal with the PayPal button to approve." }, { status: 400 });
  }

  try {
    let vaultId: string;
    let payer: string;
    if (setupToken) {
      const saved = await savedAccountFrom(setupToken);
      vaultId = saved.vaultId;
      payer = saved.email ? `your PayPal (${saved.email})` : "your PayPal";
    } else {
      // Confirm the demo account still exists before telling the shopper it's connected.
      await paypal("GET", `/v3/vault/payment-tokens/${encodeURIComponent(demoVault!)}`);
      vaultId = demoVault!;
      payer = "the demo PayPal account (sandbox)";
    }
    const approved = { ...mandate, payment: { ...mandate.payment, vault_id: vaultId } };
    const approval = sealApproval({ mandate: approved, approved_at: new Date().toISOString() });
    // The browser gets the rules back without the saved account's id.
    return Response.json({ approval, mandate: { ...approved, payment: { ...approved.payment, vault_id: null } }, payer });
  } catch (err) {
    if (err instanceof ApprovalError) return Response.json({ error: err.message }, { status: 500 });
    if (err instanceof PayPalError) {
      console.error(`[approve] ${err.message}`);
      const gone = err.status === 404 && !setupToken;
      return Response.json(
        { error: gone ? "The demo PayPal account was removed. Connect your own PayPal instead." : setupToken ? "PayPal couldn't save your account. Please try the PayPal button again." : `PayPal didn't answer (${err.status}). Try again.` },
        { status: gone ? 503 : 502 },
      );
    }
    throw err;
  }
}
