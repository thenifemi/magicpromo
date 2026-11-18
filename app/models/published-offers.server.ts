import prisma from "../db.server";
import { arrangePromotions } from "./display-order.server";
import { storefrontOffers } from "./storefront.server";
import type { Graphql } from "./collection.server";
export async function publishedOffers(
  shop: string,
  graphql: Graphql,
  ids: string[],
) {
  const drafts = await prisma.promotionDraft.findMany({
    where: {
      shop: shop,
      shopifyDiscountId: { not: null },
      activationToken: null,
    },
    select: { id: true, storefrontSettings: true, shopifyDiscountId: true },
  });
  const order = await prisma.storefrontDisplayOrder.findUnique({
    where: { shop: shop },
  });
  const sortedDrafts = arrangePromotions(
    drafts,
    JSON.parse(order?.promotionIds || "[]"),
  );
  const offers = await storefrontOffers(
    graphql,
    drafts.map((p) => p.shopifyDiscountId!),
    ids.map((id) => `gid://shopify/Product/${id}`),
  );
  if (order) {
    const ranks = new Map(
      sortedDrafts.map((draft, index) => [draft.shopifyDiscountId, index]),
    );
    offers.sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!);
  }
  return offers;
}
