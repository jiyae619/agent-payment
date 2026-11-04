import { searchProducts } from "@/lib/search";

// POST { query, maxPrice? } → { products, source: "live" | "snapshot", fallback_reason? }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const query = String(body.query ?? "").trim();
  if (!query) return Response.json({ error: "query is required" }, { status: 400 });

  const maxPrice = body.maxPrice === undefined ? undefined : Number(body.maxPrice);
  return Response.json(await searchProducts(query, { maxPrice }));
}
