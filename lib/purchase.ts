// The money step, after the shopper picks one of the options: PayPal holds the real total on the
// saved account, then enforcement (plain code) decides to charge, release, or ask the shopper first.
// The options come back from the browser inside a sealed choice, so the products, their checks and
// the approval can't be swapped; the shopper only says which one.

import { createHash } from "node:crypto";
import { openApproval, seal } from "./approval.ts";
import { levelName } from "./guesses.ts";
import type { CatalogProduct } from "./catalog.ts";
import { decide, type CheckResult, type Decision, type Proposal } from "./enforce.ts";
import { captureHold, placeHold, readOrder, releaseHold } from "./hold.ts";
import { ANSWER_MINUTES, trackPending } from "./pending.ts";
import { PayPalError } from "./paypal.ts";
import { totalLine } from "./pick-core.ts";
import type { Returns } from "./check-core.ts";
import type { Policy } from "./policy.ts";
import { buildProof, sealProof, type PayPalRecord, type ProofEvent } from "./proof.ts";
import { isNamedItem, type FunnelStep } from "./shortlist.ts";

export type Candidate = { product: CatalogProduct; checks: CheckResult[]; policy: Policy | null; final_sale: boolean; returns: Returns };
export type Choice = {
  approval: string; // the sealed approval this run was made under
  quantity: number;
  search_source: string;
  funnel: FunnelStep[];
  shortlist: { id: string; title: string; price: number; store: string }[];
  candidates: Candidate[];
  recommended: { id: string; reason: string; by: "ai" | "code" };
};

const round = (n: number) => Math.round(n * 100) / 100;

// What the choose screen shows for one option: the product, its checks and its total, in code.
export function optionView(c: Candidate, quantity: number) {
  return { product: c.product, checks: c.checks, policy: c.policy, returns: c.returns, total: round(c.product.price * quantity), total_line: totalLine(c.product.price, quantity) };
}

export async function purchase(choice: Choice, productId: string): Promise<{ status: number; body: object }> {
  const approved = openApproval(choice.approval);
  const m = approved.mandate;
  const max = m.payment.amount_range.max;
  const vaultId = m.payment.vault_id;
  if (max === null || !vaultId) return { status: 400, body: { error: "This approval has no spending limit or PayPal account." } };
  const c = choice.candidates.find((x) => x.product.id === productId);
  if (!c) return { status: 400, body: { error: "That option isn't one it checked. Please choose again." } };

  const { quantity, funnel, shortlist } = choice;
  const recommended = choice.recommended.id === productId;
  const reason = recommended ? choice.recommended.reason : "You chose this one instead of its recommendation.";
  const by = recommended ? choice.recommended.by : "shopper";
  const proposal: Proposal = {
    product: c.product,
    quantity,
    total: round(c.product.price * quantity),
    checks: c.checks,
    is_substitute: !isNamedItem(m, c.product),
    final_sale: c.final_sale,
    returns: c.returns.evidence,
  };
  const shown = {
    funnel,
    search_source: choice.search_source,
    pick: { product: c.product, reason, by, quantity, total: proposal.total, total_line: totalLine(c.product.price, quantity) },
    checks: c.checks,
    policy: c.policy,
    shortlist,
  };

  const key = createHash("sha256").update(`${choice.approval}|${c.product.id}`).digest("hex").slice(0, 32);
  // The proof record's id, also put on the PayPal order (custom_id) so the two can be matched.
  const proofId = `sa_${key}`;
  const unconfirmed = c.checks.filter((x) => x.verdict !== "checked").map((x) => x.attr);
  const note = [c.returns.label, unconfirmed.length ? `Not confirmed: ${unconfirmed.join(", ")}` : ""].filter(Boolean).join(" · ");
  const events: ProofEvent[] = [
    { at: approved.approved_at, what: `You approved these instructions with PayPal (${levelName(approved.level ?? "allow")}).` },
    { at: new Date().toISOString(), what: `You chose "${c.product.title}" from ${choice.candidates.length} checked options.` },
  ];
  const log = (what: string) => events.push({ at: new Date().toISOString(), what });
  const record = (decision: Decision, paypal: PayPalRecord) =>
    buildProof({
      id: proofId, mandate: m, approved_at: approved.approved_at, level: approved.level, search: { source: choice.search_source, funnel, shortlist },
      product: c.product, quantity, total: proposal.total, reason, by, checks: c.checks, policy: c.policy,
      decision, paypal, events,
    });

  try {
    const hold = await placeHold(vaultId, c.product.title, proposal.total, key, { proofId, note });
    log(`PayPal held $${hold.amount.toFixed(2)} for "${c.product.title}".`);
    const decision = decide(m, proposal, { now: new Date(), held: hold.amount });
    const paypal = { orderId: hold.orderId, authorizationId: hold.authorizationId, held: hold.amount };
    const ids: PayPalRecord = { order_id: hold.orderId, authorization_id: hold.authorizationId, held: hold.amount };

    if (decision.action === "capture") {
      const capture = await captureHold(hold.authorizationId, decision.amount, max);
      log(`Every check passed, so PayPal took $${capture.amount.toFixed(2)}.`);
      const status = await readOrder(hold.orderId);
      const proof = record(decision, { ...ids, capture_id: capture.captureId, captured: capture.amount, status: status.authorization ?? status.order });
      // The receipt can refund exactly this charge, and nothing else (sealed, like the approval).
      const refund = seal({ captureId: capture.captureId, orderId: hold.orderId, amount: capture.amount, proof });
      return { status: 200, body: { ...shown, outcome: "bought", decision, paypal: { ...paypal, ...capture, readBack: status }, proof, proof_seal: sealProof(proof), refund } };
    }
    if (decision.action === "void") {
      const released = await releaseHold(hold.authorizationId);
      log(`PayPal released the hold: ${decision.reasons.map((r) => r.message).join(" ")}`);
      // Loop 2 (anonymous): which rules released it, at which store, and which requirement couldn't be checked.
      console.info(`[outcome] ${JSON.stringify({
        at: new Date().toISOString(), outcome: "released", store: c.product.store,
        rules: decision.reasons.map((r) => r.rule),
        unchecked: c.checks.filter((x) => x.verdict !== "checked").map((x) => ({ attr: x.attr, verdict: x.verdict })),
      })}`);
      const status = await readOrder(hold.orderId);
      const proof = record(decision, { ...ids, status: status.authorization ?? released.status });
      return { status: 200, body: { ...shown, outcome: "released", decision, paypal: { ...paypal, status: released.status, readBack: status }, proof, proof_seal: sealProof(proof) } };
    }
    // Ask: the hold stays open while the shopper decides, for ANSWER_MINUTES at most. The answer route
    // only accepts this sealed record, which also carries the proof so far.
    log(`It asked you first: ${decision.checkins.map((x) => x.message).join(" ")}`);
    const proof = record(decision, { ...ids, status: hold.status });
    const expires = trackPending(hold.authorizationId);
    const pending = seal({ authorizationId: hold.authorizationId, orderId: hold.orderId, amount: proposal.total, limit: max, title: c.product.title, proof, expires_at: expires });
    return { status: 200, body: { ...shown, outcome: "ask", decision, paypal, pending, answer_minutes: ANSWER_MINUTES } };
  } catch (err) {
    if (err instanceof PayPalError) {
      console.error(`[purchase] ${err.message}`);
      const declined = JSON.stringify(err.body ?? "").includes("INSTRUMENT_DECLINED");
      return { status: 502, body: { ...shown, error: declined ? "PayPal declined the saved account. Nothing was charged." : `PayPal didn't answer (${err.status}). Nothing was charged.` } };
    }
    return { status: 500, body: { ...shown, error: (err as Error).message } };
  }
}
