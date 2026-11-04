// Snapshot Channel3 products into data/catalog.json for the demo store.
// Run: node --env-file=.env.local scripts/build-catalog.mts
// A snapshot keeps the demo stable and saves Channel3 credits; re-run to refresh.

import { mkdir, writeFile } from "node:fs/promises";
import { GIFT_CARD, searchChannel3, toCatalogProduct, type CatalogProduct } from "../lib/catalog.ts";

// Two demo scenarios: running shoes (the hero) and a household refill.
const QUERIES: { query: string; filters?: Record<string, unknown>; take: number }[] = [
  { query: "waterproof trail running shoes", filters: { price: { max_price: 160 } }, take: 5 },
  { query: "road running shoes", filters: { price: { max_price: 160 } }, take: 4 },
  { query: "dish soap refill", take: 3 },
  { query: "laundry detergent pods", take: 3 },
];

const apiKey = process.env.CHANNEL3_API_KEY;
if (!apiKey) {
  console.error("Missing CHANNEL3_API_KEY in .env.local");
  process.exit(1);
}

const products: CatalogProduct[] = [];
for (const q of QUERIES) {
  const found = (await searchChannel3(apiKey, q.query, q.filters, 15))
    .map(toCatalogProduct)
    .filter((p): p is CatalogProduct => p !== null && !products.some((x) => x.id === p.id))
    .slice(0, q.take);
  console.log(`${q.query}: kept ${found.length}`);
  products.push(...found);
}
products.push(GIFT_CARD);

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/catalog.json", import.meta.url), JSON.stringify(products, null, 2) + "\n");
console.log(`Wrote ${products.length} products to data/catalog.json`);
