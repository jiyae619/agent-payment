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

export function sealApproval(approval: Approval): string {
  const payload = Buffer.from(JSON.stringify(approval)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function openApproval(token: string): Approval {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) throw new ApprovalError("This approval is not valid.");
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new ApprovalError("This approval was changed after you approved it, so it can't be used.");
  }
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return { mandate: Mandate.parse(data.mandate), approved_at: String(data.approved_at) };
}
