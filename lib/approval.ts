// The shopper's approval, sealed by the server. After approving, the instructions travel with the
// browser until the shopping step, so the server seals them: if anything changes, such as a raised
// limit, a new store or a different saved account, the seal no longer opens and the approval is
// refused. The seal is also encrypted (AES-256-GCM), so the browser can't read what's inside, like
// the saved PayPal account's id, which PayPal says to keep on the server. Plain code, no AI.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
// shopper's answer, a charge that can be refunded) is sealed the same way: encrypted and
// authenticated with a key derived from APPROVAL_SECRET. GCM's tag fails on any change.
const key = () => createHash("sha256").update(`seal-key:${secret()}`).digest();

export function seal(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return [iv, body, cipher.getAuthTag()].map((b) => b.toString("base64url")).join(".");
}

export function unseal(token: string): unknown {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new ApprovalError("This approval is not valid.");
  const [iv, body, tag] = parts.map((x) => Buffer.from(x, "base64url"));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"));
  } catch {
    throw new ApprovalError("This approval was changed after you approved it, so it can't be used.");
  }
}

export const sealApproval = (approval: Approval): string => seal(approval);

export function openApproval(token: string): Approval {
  const data = unseal(token) as { mandate: unknown; approved_at: unknown };
  return { mandate: Mandate.parse(data.mandate), approved_at: String(data.approved_at) };
}
