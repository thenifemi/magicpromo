import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import { parseStorefrontSettings } from "../lib/storefront-settings";
import { collectionProductIds } from "./collection.server";
import { parsePromotionConfig } from "../../shared/promotion-config";
export const STOREFRONT_DISCOUNTS = `#graphql
  query MagicpromoStorefront($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on DiscountAutomaticNode {
        metafield(namespace: "$app:magicpromo", key: "configuration") { jsonValue }
        automaticDiscount { ... on DiscountAutomaticApp { status } }
      }
      ... on DiscountNode {
        metafield(namespace: "$app:magicpromo", key: "configuration") { jsonValue }
        discount { ... on DiscountAutomaticApp { status } }
      }
    }
  }
`;
export type PublicOffer = {
  id: string;
  percent: number;
  minimum: number;
  mode: string;
  eligibleProductIds: string[];
  settings: NonNullable<ReturnType<typeof parseStorefrontSettings>>;
};
export async function storefrontOffers(
  graphql: AdminGraphqlClient,
  discountIds: string[],
  productIds: string[],
): Promise<PublicOffer[]> {
  const offers: PublicOffer[] = [];
  for (let offset = 0; offset < discountIds.length; offset += 100) {
    const ids = discountIds.slice(offset, offset + 100);
    const response = await graphql(STOREFRONT_DISCOUNTS, {
      variables: { ids },
    });
    const { data } = await response.json();
    if (!data) throw new Error("Could not verify published offers");
    for (const [index, node] of data.nodes.entries()) {
      if (!node || !("metafield" in node)) continue;
      const discount =
        "automaticDiscount" in node ? node.automaticDiscount : node.discount;
      if (discount?.status !== "ACTIVE") continue;
      const raw = node.metafield?.jsonValue;
      const settings = parseStorefrontSettings(raw?.storefront);
      const parsed = parsePromotionConfig(raw);
      if (
        !settings ||
        !(settings.announcement || settings.product || settings.cart) ||
        !parsed.ok
      )
        continue;
      const config = parsed.value;
      const eligible = config.collectionIds
        ? await collectionProductIds(graphql, productIds, config.collectionIds[0])
        : productIds.filter((id) => config.productIds.includes(id));
      offers.push({
        id: ids[index],
        percent: config.discountPercent,
        minimum: config.minimumProducts,
        mode: config.qualificationMode,
        eligibleProductIds: eligible.map((id) => id.split("/").pop()!),
        settings,
      });
    }
  }
  return offers.sort(
    (a, b) =>
      b.settings.priority - a.settings.priority || a.id.localeCompare(b.id),
  );
}
