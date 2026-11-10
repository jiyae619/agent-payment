// "Save as proof": one record of a purchase the shopper can keep and show to PayPal or the store
// if something goes wrong. It holds their own words, what the screen read back, when they approved,
// what was considered and picked, every check with the store's quote, the return policy text as it
// stood at purchase (with a fingerprint), and the PayPal IDs. The server seals it so a later edit shows.

import { createHash } from "node:crypto";
import { signText, verifyText } from "./approval.ts";
import type { CatalogProduct } from "./catalog.ts";
import type { CheckResult, Decision } from "./enforce.ts";
import { levelName, type Level } from "./guesses.ts";
import type { Mandate } from "./mandate.ts";
import type { Policy } from "./policy.ts";
import { LABEL_TEXT, readbackRows } from "./readback.ts";
import type { FunnelStep } from "./shortlist.ts";

export type ProofEvent = { at: string; what: string };
export type PayPalRecord = { order_id: string; authorization_id: string; held: number; capture_id?: string; captured?: number; refund_id?: string; refunded?: number; status?: string };

export type Proof = {
  record: "shopping-assistant-proof/v1";
  id: string; // also on the PayPal order as purchase_units.custom_id
  sandbox: true;
  shopper_words: string;
  approved_at: string;
  level: string; // how much the shopper let it guess, e.g. "Allow guesses"
  read_back: { you_said: string | null; it_will: string; how_sure: string }[];
  cant_promise: { phrase: string; reason: string }[];
  instructions: Mandate;
  search: { source: string; funnel: FunnelStep[]; shortlist: { id: string; title: string; price: number; store: string }[] };
  picked: { id: string; title: string; store: string; price_each: number; quantity: number; total: number; reason: string; reason_written_by: "ai" | "code" | "shopper" };
  checks: CheckResult[];
  return_policy: { store: string; url: string; read_on: string; text: string; sha256: string } | null;
  decision: Decision;
  paypal: PayPalRecord;
  who_covers: string[];
  events: ProofEvent[];
};

export function buildProof(args: {
  id: string;
  mandate: Mandate;
  approved_at: string;
  level?: Level;
  search: Proof["search"];
  product: CatalogProduct;
  quantity: number;
  total: number;
  reason: string;
  by: "ai" | "code" | "shopper";
  checks: CheckResult[];
  policy: Policy | null;
  decision: Decision;
  paypal: PayPalRecord;
  events: ProofEvent[];
}): Proof {
  const m = args.mandate;
  return {
    record: "shopping-assistant-proof/v1",
    id: args.id,
    sandbox: true,
    shopper_words: m.source_text,
    approved_at: args.approved_at,
    level: levelName(args.level ?? "allow"),
    read_back: readbackRows(m).map((r) => ({ you_said: r.said, it_will: r.willDo, how_sure: LABEL_TEXT[r.label] })),
    cant_promise: m.ext.unmapped,
    // The saved PayPal account's id is left out: this file is meant to be shared with a store or PayPal.
    instructions: { ...m, payment: { ...m.payment, vault_id: m.payment.vault_id ? "saved PayPal account (id withheld)" : null } },
    search: args.search,
    picked: {
      id: args.product.id, title: args.product.title, store: args.product.store, price_each: args.product.price,
      quantity: args.quantity, total: args.total, reason: args.reason, reason_written_by: args.by,
    },
    checks: args.checks,
    return_policy: args.policy
      ? { store: args.policy.store, url: args.policy.url, read_on: args.policy.retrieved, text: args.policy.text, sha256: createHash("sha256").update(args.policy.text).digest("hex") }
      : null,
    decision: args.decision,
    paypal: args.paypal,
    who_covers: whoCovers(args.paypal.captured !== undefined, args.policy !== null),
    events: args.events,
  };
}

// Plain words on who can help if it goes wrong. Purchase Protection covers an item that never
// arrives or is significantly not as described; it doesn't cover an item that matches its listing
// but wasn't wanted, which is exactly the mistake a shopping assistant can make.
export function whoCovers(charged: boolean, policyKnown: boolean): string[] {
  if (!charged) return ["Nothing was charged, so there is nothing to claim."];
  return [
    "If it never arrives, or arrives significantly different from its listing, PayPal Purchase Protection may cover it. Open a dispute in PayPal and attach this record.",
    "If it matches its listing but isn't what you wanted, Purchase Protection doesn't cover it. " +
      (policyKnown ? "Use the store's return policy shown here." : "Ask the store about returns; its policy wasn't on file."),
    "This record shows what you approved and what was checked, so you can show the purchase stayed within your instructions.",
  ];
}

const canonical = (p: Proof) => JSON.stringify(p);
export const sealProof = (p: Proof) => signText(canonical(p));
export const proofIsIntact = (p: Proof, seal: string) => verifyText(canonical(p), seal);
