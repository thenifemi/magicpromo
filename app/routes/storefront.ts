import { publishedOffers } from "../models/published-offers.server";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.public.appProxy(request);
  const headers = { "Cache-Control": "no-store" };
  if (!admin || !session)
    return Response.json({ offers: [] }, { status: 401, headers });
  const raw = new URL(request.url).searchParams.get("products") || "";
  const ids = [...new Set(raw.split(",").filter(Boolean))];
  if (
    raw.length > 2500 ||
    ids.length > 100 ||
    ids.some((id) => !/^\d{1,20}$/.test(id))
  )
    return Response.json({ offers: [] }, { status: 400, headers });
  try {
    const offers = await publishedOffers(session.shop, admin.graphql, ids);
    return Response.json({ offers }, { headers });
  } catch {
    return Response.json({ offers: [] }, { status: 503, headers });
  }
}
