import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import PromotionsList from "../components/PromotionsList";
import { readDiscountSummaries } from "../models/promotion-summary.server";
import { listDrafts } from "../models/promotion-draft.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const drafts = await listDrafts(session.shop);
  const usage = await readDiscountSummaries(
    admin.graphql,
    drafts.flatMap((draft) =>
      draft.shopifyDiscountId ? [draft.shopifyDiscountId] : [],
    ),
  );
  return {
    promotions: drafts.map((draft) => ({
      ...draft,
      discountStatus: draft.shopifyDiscountId
        ? (usage.get(draft.shopifyDiscountId)?.status ?? "UNKNOWN")
        : null,
      usageCount: draft.shopifyDiscountId
        ? (usage.get(draft.shopifyDiscountId)?.usageCount ?? null)
        : draft.activationToken
          ? null
          : 0,
    })),
  };
};

export default function Promotions() {
  const { promotions } = useLoaderData<typeof loader>();
  return <PromotionsList promotions={promotions} />;
}
export const headers: HeadersFunction = (args) => boundary.headers(args);
