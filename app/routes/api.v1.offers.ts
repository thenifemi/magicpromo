import type { LoaderFunctionArgs } from "react-router";
import { authenticateHydrogenKey } from "../models/hydrogen-key.server";
import { publishedOffers } from "../models/published-offers.server";
import { unauthenticated } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = { "Cache-Control": "no-store" };
  const key = await authenticateHydrogenKey(
    request.headers.get("Authorization"),
    process.env.SHOPIFY_API_KEY || "",
  );
  if (!key)
    return Response.json(
      { error: "Invalid or revoked API key" },
      { status: 401, headers },
    );
  const raw = new URL(request.url).searchParams.get("products") || "";
  const ids = [...new Set(raw.split(",").filter(Boolean))];
  if (
    raw.length > 6000 ||
    ids.length > 100 ||
    ids.some((id) => !/^(?:gid:\/\/shopify\/Product\/)?\d{1,20}$/.test(id))
  )
    return Response.json(
      { error: "Provide up to 100 product IDs" },
      { status: 400, headers },
    );
  try {
    const { admin } = await unauthenticated.admin(key.shop);
    const offers = await publishedOffers(
      key.shop,
      admin.graphql,
      ids.map((id) => id.split("/").pop()!),
    );
    await prisma.hydrogenKey.updateMany({
      where: { id: key.id, revokedAt: null },
      data: { lastUsedAt: new Date() },
    });
    return Response.json({ version: 1, offers }, { headers });
  } catch {
    return Response.json(
      { error: "Offers temporarily unavailable", offers: [] },
      { status: 503, headers },
    );
  }
}
