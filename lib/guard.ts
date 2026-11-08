// Spend guard for the public demo. Every draft and shopping run calls paid AI models on the
// operator's key, so a visitor (or a script) can't run them without limit.
// In memory: it resets when the server restarts, which is fine for one small demo instance.

export const PER_VISITOR_PER_HOUR = 12;
export const PER_DAY = 300;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Counter = { start: number; n: number };
const visitors = new Map<string, Counter>();
let today: Counter = { start: 0, n: 0 };

export function visitorKey(request: Request): string {
  // Render puts the visitor's address first in x-forwarded-for.
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

// Counts one AI run. Returns the message to show when the run isn't allowed, or null.
export function allowRun(key: string, now = Date.now()): string | null {
  if (now - today.start >= DAY) today = { start: now, n: 0 };
  if (today.n >= PER_DAY) return "The demo has reached today's limit. Please try again tomorrow.";

  let v = visitors.get(key);
  if (!v || now - v.start >= HOUR) v = { start: now, n: 0 };
  if (v.n >= PER_VISITOR_PER_HOUR) return "You've tried this a lot in the last hour. Please wait a bit and try again.";

  v.n++;
  today.n++;
  visitors.set(key, v);
  return null;
}

export function resetGuard() {
  visitors.clear();
  today = { start: 0, n: 0 };
}
