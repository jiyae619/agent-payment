// Checks live search and the snapshot backup. Run: npm run check-search
import { searchProducts } from "../lib/search.ts";

const show = (label: string, r: Awaited<ReturnType<typeof searchProducts>>) => {
  const ids = r.products.map((p) => `${p.title}|${p.store}|${p.price}`);
  console.log(`${label}: source=${r.source}${r.fallback_reason ? ` (${r.fallback_reason})` : ""}, ${r.products.length} products,`,
    `gift card included=${r.products.some((p) => p.id === "demo-gift-card-100")}, duplicates=${ids.length - new Set(ids).size}`);
};

show("live shoes", await searchProducts("waterproof running shoes", { maxPrice: 120 }));

process.env.CHANNEL3_FORCE_SNAPSHOT = "1";
show("snapshot shoes", await searchProducts("waterproof running shoes", { maxPrice: 120 }));
show("snapshot soap", await searchProducts("dish soap"));
delete process.env.CHANNEL3_FORCE_SNAPSHOT;

const realKey = process.env.CHANNEL3_API_KEY;
process.env.CHANNEL3_API_KEY = "invalid-key";
show("bad key → snapshot", await searchProducts("dish soap"));
process.env.CHANNEL3_API_KEY = realKey;
