// Product search for the agent: live Channel3 first, the saved snapshot as backup.
// The gift card is always in the results, so the consent demo works either way.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { GIFT_CARD, searchChannel3, toCatalogProduct, type CatalogProduct } from "./catalog.ts";

export type SearchResult = {
  products: CatalogProduct[];
  source: "live" | "snapshot";
  fallback_reason?: string; // why live search wasn't used
};

// Channel3 answers in 1–9 s (slowest the first time a query is seen).
const LIVE_TIMEOUT_MS = 15000;

// Repeat searches during a demo are instant and don't spend credits.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; products: CatalogProduct[] }>();

export async function searchProducts(
  query: string,
  opts: { maxPrice?: number; limit?: number } = {},
): Promise<SearchResult> {
  const limit = opts.limit ?? 8;
  const apiKey = process.env.CHANNEL3_API_KEY;

  let fallback_reason: string;
  if (process.env.CHANNEL3_FORCE_SNAPSHOT === "1") {
    fallback_reason = "CHANNEL3_FORCE_SNAPSHOT is set";
  } else if (!apiKey) {
    fallback_reason = "no CHANNEL3_API_KEY";
  } else {
    const key = `${query.toLowerCase()}|${opts.maxPrice ?? ""}|${limit}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return { products: [...hit.products, GIFT_CARD], source: "live" };
    try {
      const filters = opts.maxPrice ? { price: { max_price: opts.maxPrice } } : {};
      const raw = await withTimeout(searchChannel3(apiKey, query, filters, limit * 2), LIVE_TIMEOUT_MS);
      const products = dedupe(raw.map(toCatalogProduct).filter((p): p is CatalogProduct => p !== null)).slice(0, limit);
      if (products.length > 0) {
        cache.set(key, { at: Date.now(), products });
        return { products: [...products, GIFT_CARD], source: "live" };
      }
      fallback_reason = "live search returned no in-stock USD products";
    } catch (err) {
      fallback_reason = (err as Error).message;
    }
  }

  return { products: [...(await searchSnapshot(query, opts.maxPrice, limit)), GIFT_CARD], source: "snapshot", fallback_reason };
}

async function searchSnapshot(query: string, maxPrice: number | undefined, limit: number): Promise<CatalogProduct[]> {
  let catalog: CatalogProduct[];
  try {
    catalog = JSON.parse(await readFile(path.join(process.cwd(), "data", "catalog.json"), "utf8"));
  } catch {
    return []; // no snapshot yet: run `npm run catalog`
  }

  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  return catalog
    .filter((p) => p.source === "channel3" && (maxPrice === undefined || p.price <= maxPrice))
    .map((p) => {
      const text = `${p.title} ${p.category ?? ""} ${p.key_features.join(" ")}`.toLowerCase();
      return { p, score: words.filter((w) => text.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

// Channel3 sometimes returns the same listing under two ids.
function dedupe(products: CatalogProduct[]): CatalogProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const key = `${p.title}|${p.store}|${p.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Channel3 took longer than ${ms / 1000}s`)), ms)),
  ]);
}
