// The shopper's purchase history, kept in their own browser (the demo has no accounts, and the
// server keeps nothing between visits). It feeds "From your past purchases" suggestions later,
// and the shopper can clear it. Feedback here can only ever become a suggestion the shopper
// taps to accept; it never changes a limit on its own (build-plan.md, "Feedback loop").

export type Outcome = "bought" | "released" | "refused";
export type DontBuyReason = "too_expensive" | "wrong_store" | "not_what_i_meant";
export type Rating = "right" | "wrong_item" | "not_delivered";

export type HistoryEntry = {
  id: string; // PayPal order id
  at: string; // ISO time
  request: string; // the shopper's own words
  item: string; // what it wanted to buy, e.g. "running shoes"
  product: string; // the listing's title
  store: string;
  amount: number;
  outcome: Outcome;
  asked_because?: string[]; // check-in rules that fired, e.g. "new_store", "over_amount"
  reason?: DontBuyReason; // why the shopper said Don't buy
  rating?: Rating; // "Was this right?" after a purchase
};

export const REASON_TEXT: Record<DontBuyReason, string> = {
  too_expensive: "Too expensive",
  wrong_store: "Wrong store",
  not_what_i_meant: "Not what I meant",
};
export const RATING_TEXT: Record<Rating, string> = {
  right: "Yes, it's right",
  wrong_item: "Wrong item",
  not_delivered: "Not delivered",
};

const KEY = "shopping-assistant:history:v1";
const MAX = 50;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return []; // private window, blocked storage: the app works without history
  }
}

function save(list: HistoryEntry[]) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // storage blocked or full: history is a convenience, never required
  }
}

// Add or update one purchase (by PayPal order id), newest first.
export function recordEntry(entry: HistoryEntry): HistoryEntry[] {
  const list = [entry, ...loadHistory().filter((e) => e.id !== entry.id)];
  save(list);
  return list;
}

export function updateEntry(id: string, patch: Partial<HistoryEntry>): HistoryEntry[] {
  const list = loadHistory().map((e) => (e.id === id ? { ...e, ...patch } : e));
  save(list);
  return list;
}

export function clearHistory() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
