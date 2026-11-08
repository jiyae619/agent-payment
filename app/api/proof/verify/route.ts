import { proofIsIntact, type Proof } from "@/lib/proof.ts";

// POST { proof, seal } → { intact }: is this saved proof exactly what the server issued?
// Anyone holding the file (the shopper, a store, a PayPal dispute agent) can check it here.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.proof || typeof body.seal !== "string") return Response.json({ error: "Send the saved file's proof and seal." }, { status: 400 });
  try {
    return Response.json({ intact: proofIsIntact(body.proof as Proof, body.seal) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
