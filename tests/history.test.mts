// The purchase history lives in the shopper's browser. It must never break the app when storage is
// blocked, must keep one entry per purchase, and must stay small.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clearHistory, loadHistory, recordEntry, updateEntry, type HistoryEntry } from "../lib/history.ts";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const entry = (id: string, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id, at: "2026-11-08T18:00:00Z", request: "running shoes under $120", item: "running shoes", product: "Trail Runner",
  store: "mountainwarehouse.com", amount: 54.99, outcome: "bought", ...over,
});

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true, writable: true });
});

test("a purchase is saved once, newest first, and its feedback updates it in place", () => {
  recordEntry(entry("A"));
  recordEntry(entry("B"));
  recordEntry(entry("A", { outcome: "refused" }));
  assert.deepEqual(loadHistory().map((e) => [e.id, e.outcome]), [["A", "refused"], ["B", "bought"]]);
  updateEntry("B", { rating: "wrong_item" });
  assert.equal(loadHistory().find((e) => e.id === "B")?.rating, "wrong_item");
});

test("history keeps at most 50 purchases", () => {
  for (let i = 0; i < 60; i++) recordEntry(entry(`id-${i}`));
  assert.equal(loadHistory().length, 50);
  assert.equal(loadHistory()[0].id, "id-59");
});

test("blocked storage never breaks shopping: reads come back empty, writes are skipped", () => {
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } },
    configurable: true, writable: true,
  });
  assert.deepEqual(loadHistory(), []);
  assert.doesNotThrow(() => recordEntry(entry("A")));
  assert.doesNotThrow(() => clearHistory());
});

test("clearing removes everything", () => {
  recordEntry(entry("A"));
  clearHistory();
  assert.deepEqual(loadHistory(), []);
});
