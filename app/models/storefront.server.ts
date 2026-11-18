import { parseStorefrontSettings } from "../lib/storefront-settings";
import { collectionProductIds, type Graphql } from "./collection.server";
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
  graphql: Graphql,
  discountIds: string[],
  productIds: string[],
): Promise<PublicOffer[]> {
  const offers: PublicOffer[] = [];
  for (let offset = 0; offset < discountIds.length; offset += 100) {
    const ids = discountIds.slice(offset, offset + 100);
    const response = await graphql(STOREFRONT_DISCOUNTS, {
      variables: { ids },
    });
    const result = await response.json();
    if (!response.ok || result.errors?.length || !result.data)
      throw new Error("Could not verify published offers");
    for (const [index, node] of result.data.nodes.entries()) {
      if ((node?.automaticDiscount ?? node?.discount)?.status !== "ACTIVE")
        continue;
      const config = node.metafield?.jsonValue;
      const settings = parseStorefrontSettings(config?.storefront);
      if (
        !settings ||
        !(settings.announcement || settings.product || settings.cart) ||
        config.version !== 1 ||
        !Number.isInteger(config.discountPercent) ||
        config.discountPercent < 1 ||
        config.discountPercent > 100 ||
        !Number.isInteger(config.minimumProducts) ||
        config.minimumProducts < 1 ||
        config.minimumProducts > 100 ||
        !["distinct_products", "total_quantity"].includes(
          config.qualificationMode,
        )
      )
        continue;
      let eligible: string[];
      if (config.collectionIds !== undefined) {
        if (
          !Array.isArray(config.collectionIds) ||
          config.collectionIds.length !== 1 ||
          !/^gid:\/\/shopify\/Collection\/\d+$/.test(config.collectionIds[0])
        )
          continue;
        eligible = await collectionProductIds(
          graphql,
          productIds,
          config.collectionIds[0],
        );
      } else {
        if (!Array.isArray(config.productIds)) continue;
        eligible = productIds.filter((id) => config.productIds.includes(id));
      }
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
