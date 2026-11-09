// Holds waiting for the shopper's answer ("It asks you first"). A hold nobody answers would sit on
// the shopper's money until PayPal expires it (up to 29 days), so unanswered holds are released
// after ANSWER_MINUTES. In memory: a restart forgets them, and PayPal's own expiry is the backstop.

export const ANSWER_MINUTES = 30;

const open = new Map<string, number>(); // authorization id → when the question expires (ms)

export function trackPending(authorizationId: string, now = Date.now()): number {
  const expires = now + ANSWER_MINUTES * 60 * 1000;
  open.set(authorizationId, expires);
  return expires;
}

export function settlePending(authorizationId: string) {
  open.delete(authorizationId);
}

// The holds whose question has expired; each is removed so it's released only once.
export function expiredPending(now = Date.now()): string[] {
  const due = [...open].filter(([, at]) => at <= now).map(([id]) => id);
  for (const id of due) open.delete(id);
  return due;
}
