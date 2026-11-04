// Dollar amounts the shopper actually typed, found by plain pattern matching (no AI).
// Used to catch a draft whose limits don't match the shopper's own words.
//
// A number counts as money when it has a "$", is followed by "dollars"/"bucks"/"usd",
// or comes right after a money word ("under 120", "over 100", "max 25").
// "size 8", "3 bottles" and "30 pods" are not money.

const MONEY_WORDS = new Set([
  "under", "over", "below", "above", "max", "maximum", "than", "around", "about",
  "budget", "spend", "limit", "upto", "to", "cap", "within", "each",
]);

export function amountsSaid(text: string): number[] {
  const found: number[] = [];
  const re = /(\$\s?)?(\d+(?:[.,]\d{1,2})?)(\s*(?:dollars?|bucks|usd)\b)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = Number(m[2].replace(",", "."));
    const hasDollar = Boolean(m[1]);
    const hasUnit = Boolean(m[3]);
    const before = text.slice(0, m.index).toLowerCase().match(/([a-z]+)\W*$/);
    const afterMoneyWord = before ? MONEY_WORDS.has(before[1]) : false;
    if (hasDollar || hasUnit || afterMoneyWord) found.push(value);
  }
  return found;
}
