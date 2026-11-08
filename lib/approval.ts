// The shopper's approval, sealed by the server. After approving, the instructions travel with the
// browser until the shopping step, so the server signs them (HMAC-SHA256): if anything changes,
// such as a raised limit, a new store or a different saved account, the seal no longer matches
// and the approval is refused. Plain code, no AI.

import { createHmac, timingSafeEqual } from "node:crypto";
import { Mandate } from "./mandate.ts";

export class ApprovalError extends Error {}

export type Approval = { mandate: Mandate; approved_at: string };

function secret(): string {
  const s = process.env.APPROVAL_SECRET;
  if (!s || s.length < 32) throw new ApprovalError("APPROVAL_SECRET is missing or shorter than 32 characters (.env.local).");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

// A seal over readable text (the proof record), and its check.
export const signText = (text: string): string => sign(text);
export function verifyText(text: string, mac: string): boolean {
  const expected = Buffer.from(sign(text));
  const given = Buffer.from(String(mac));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Any server-made data the browser carries between steps (the approval, a purchase waiting for the
// shopper's answer) is sealed the same way.
export function seal(data: unknown): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function unseal(token: string): unknown {
  const [payload, mac] = String(token).split(".");
  if (!payload || !mac) throw new ApprovalError("This approval is not valid.");
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new ApprovalError("This approval was changed after you approved it, so it can't be used.");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

export const sealApproval = (approval: Approval): string => seal(approval);

export function openApproval(token: string): Approval {
  const data = unseal(token) as { mandate: unknown; approved_at: unknown };
  return { mandate: Mandate.parse(data.mandate), approved_at: String(data.approved_at) };
}
