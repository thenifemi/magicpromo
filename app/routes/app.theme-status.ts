import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { themePlacements } from "../models/theme-placement.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const themeId = new URL(request.url).searchParams.get("theme") || "";
  try {
    return Response.json(
      {
        themeId,
        placements: await themePlacements(admin.graphql, themeId),
        error: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { themeId, placements: null, error: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
