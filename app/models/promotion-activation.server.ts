import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import { randomUUID, createHash } from "node:crypto";
import prisma from "../db.server";
import { getDraft } from "./promotion-draft.server";
import { isDevelopmentApp } from "../lib/environment";
import { parsePromotionConfig } from "../../shared/promotion-config";
import type { DiscountAutomaticAppInput } from "../types/admin.types";

export const CREATE_DISCOUNT = `#graphql
  mutation ActivateMagicpromo($input: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $input) {
      automaticAppDiscount { discountId }
      userErrors { field message }
    }
  }
`;
export const UPDATE_DISCOUNT = `#graphql
  mutation UpdateMagicpromo($id: ID!, $input: DiscountAutomaticAppInput!) {
    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {
      automaticAppDiscount { discountId }
      userErrors { field message }
    }
  }
`;
export const READ_DISCOUNT = `#graphql
  query MagicpromoDiscount($id: ID!) {
    automaticDiscountNode: discountNode(id: $id) {
      metafield(namespace: "$app:magicpromo", key: "configuration") { id }
      automaticDiscount: discount { ... on DiscountAutomaticApp { status asyncUsageCount } }
    }
  }
`;
export const CHECK_ACCESS = `#graphql
  query MagicpromoActivationAccess($ids: [ID!]!) {
    currentAppInstallation { accessScopes { handle } }
    nodes(ids: $ids) { ... on Product { id } ... on Collection { id } }
  }
`;

type SavedDraft = NonNullable<Awaited<ReturnType<typeof getDraft>>>;
export function configuration(draft: SavedDraft) {
  return {
    version: 1,
    productIds: draft.products.map((p) => p.productId).sort(),
    ...(draft.collectionId ? { collectionIds: [draft.collectionId] } : {}),
    ...(draft.storefrontSettings && draft.storefrontSettings !== "{}"
      ? { storefront: JSON.parse(draft.storefrontSettings) } : {}),
    discountPercent: draft.discountPercent,
    minimumProducts: draft.minimumProducts,
    qualificationMode: draft.qualificationMode,
  };
}
function combinesWith(draft: SavedDraft) {
  return {
    productDiscounts: draft.combineProductDiscounts,
    orderDiscounts: draft.combineOrderDiscounts,
    shippingDiscounts: draft.combineShippingDiscounts,
  };
}
export function draftFingerprint(draft: SavedDraft) {
  // Keep existing fingerprints valid when all combinations remain disabled.
  const combinations = combinesWith(draft);
  return createHash("sha256")
    .update(
      JSON.stringify({
        name: draft.name,
        ...configuration(draft),
        ...(Object.values(combinations).some(Boolean)
          ? { combinesWith: combinations }
          : {}),
      }),
    )
    .digest("hex");
}

type DiscountSnapshot = {
  metafield: { id: string } | null;
  automaticDiscount: { status?: string; asyncUsageCount?: number };
};

export async function readDiscount(
  graphql: AdminGraphqlClient,
  id: string,
): Promise<DiscountSnapshot | null> {
  const response = await graphql(READ_DISCOUNT, { variables: { id } });
  const { data } = await response.json();
  if (!data) throw new Error("Unable to read Shopify discount");
  const node = data.automaticDiscountNode;
  if (!node) return null;
  // Only DiscountAutomaticApp has these fields; other discount types come back as {}.
  const discount = node.automaticDiscount;
  return {
    metafield: node.metafield ?? null,
    automaticDiscount: "status" in discount ? discount : {},
  };
}

/** Create and update are separate mutations with different payload keys. */
async function saveAutomaticDiscount(
  graphql: AdminGraphqlClient,
  input: DiscountAutomaticAppInput,
  existingId: string | null,
) {
  if (existingId) {
    const response = await graphql(UPDATE_DISCOUNT, {
      variables: { id: existingId, input },
    });
    return (await response.json()).data?.discountAutomaticAppUpdate;
  }
  const response = await graphql(CREATE_DISCOUNT, { variables: { input } });
  return (await response.json()).data?.discountAutomaticAppCreate;
}

export async function activatePromotion(
  graphql: AdminGraphqlClient,
  shop: string,
  id: string,
  expectedVersion: string,
) {
  const draft = await getDraft(shop, id);
  if (!draft) return { error: "Promotion not found." };
  if (draft.activationToken)
    return {
      error:
        "Activation is pending or needs review. Check Shopify Discounts before retrying; this prevents duplicate discounts.",
    };
  if (draft.updatedAt.toISOString() !== expectedVersion)
    return {
      error:
        "This promotion changed. Refresh and review the saved rules before activating.",
    };
  const config = configuration(draft);
  const parsed = parsePromotionConfig(config);
  // Business rule on top of shape validation: the minimum must be reachable.
  const unreachable =
    parsed.ok &&
    !parsed.value.collectionIds &&
    parsed.value.qualificationMode === "distinct_products" &&
    new Set(parsed.value.productIds).size < parsed.value.minimumProducts;
  if (!draft.name.trim() || !parsed.ok || unreachable) {
    return {
      error: "Save valid rules and enough eligible products before activating.",
    };
  }

  // Complete read-only checks before acquiring the durable activation lock.
  let metafieldId: string | undefined;
  try {
    const response = await graphql(CHECK_ACCESS, {
      variables: { ids: draft.collectionId ? [draft.collectionId] : config.productIds },
    });
    const { data } = await response.json();
    if (!data) throw new Error("Preflight failed");
    if (
      !data.currentAppInstallation.accessScopes.some(
        (scope) => scope.handle === "write_discounts",
      )
    ) {
      return {
        error: "Approve the app's discount permission, then try again.",
      };
    }
    const existing = new Set(
      data.nodes.map((node) => (node && "id" in node ? node.id : undefined)),
    );
    if ((draft.collectionId ? [draft.collectionId] : config.productIds).some((id) => !existing.has(id)))
      return {
        error:
          "Some selected products or collections no longer exist. Update the draft before activating.",
      };
    if (draft.shopifyDiscountId) {
      const remote = await readDiscount(graphql, draft.shopifyDiscountId);
      if (!remote?.automaticDiscount.status)
        return {
          error:
            "The linked Shopify discount is missing or isn't an app discount. Check Shopify Discounts before continuing.",
        };
      metafieldId = remote.metafield?.id;
    }
  } catch (error) {
    console.error("[magicpromo] Activation preflight failed", error);
    return {
      error:
        "Could not verify Shopify access and products. No activation was sent. Please try again.",
    };
  }

  const token = randomUUID();
  const locked = await prisma.promotionDraft.updateMany({
    where: { id, shop, updatedAt: draft.updatedAt, activationToken: null },
    data: { activationToken: token },
  });
  if (!locked.count)
    return {
      error:
        "This promotion changed or is already being activated. Refresh before continuing.",
    };

  const input: DiscountAutomaticAppInput = {
    title: isDevelopmentApp(process.env.SHOPIFY_API_KEY) && !draft.name.startsWith("[DEV] ")
      ? `[DEV] ${draft.name}`
      : draft.name,
    ...(!draft.shopifyDiscountId
      ? { functionHandle: "magicpromo-discount" }
      : {}),
    discountClasses: ["PRODUCT"],
    startsAt: new Date().toISOString(),
    endsAt: null,
    combinesWith: combinesWith(draft),
    metafields: [
      {
        ...(metafieldId
          ? { id: metafieldId }
          : { namespace: "$app:magicpromo", key: "configuration" }),
        type: "json",
        value: JSON.stringify(config),
      },
    ],
  };
  try {
    // Network and GraphQL errors throw and land in the catch below.
    const payload = await saveAutomaticDiscount(
      graphql,
      input,
      draft.shopifyDiscountId,
    );
    if (!payload) throw new Error("Uncertain Shopify response");
    if (payload.userErrors?.length && !payload.automaticAppDiscount) {
      await prisma.promotionDraft.updateMany({
        where: { id, shop, activationToken: token },
        data: { activationToken: null },
      });
      return {
        error: payload.userErrors.map((error) => error.message).join(" "),
      };
    }
    const discountId = payload.automaticAppDiscount?.discountId;
    if (!discountId || payload.userErrors?.length)
      throw new Error("Uncertain discount result");
    const saved = await prisma.promotionDraft.updateMany({
      where: { id, shop, activationToken: token },
      data: {
        shopifyDiscountId: discountId,
        publishedFingerprint: draftFingerprint(draft),
        activationToken: null,
      },
    });
    if (!saved.count)
      throw new Error("Could not persist Shopify discount link");
    return { success: true };
  } catch (error) {
    // Do not retry a possibly successful create: Shopify and SQLite aren't one transaction.
    console.error("[magicpromo] Activation needs reconciliation", {
      shop,
      id,
      error,
    });
    return {
      error:
        "Shopify may have received the activation, but we couldn't confirm it. Check Shopify Discounts before retrying. Activation is locked to prevent a duplicate.",
    };
  }
}

export const DEACTIVATE_DISCOUNT = `#graphql
  mutation DeactivateMagicpromo($id: ID!) {
    discountAutomaticDeactivate(id: $id) {
      automaticDiscountNode {
        id
        automaticDiscount { ... on DiscountAutomaticApp { status asyncUsageCount } }
      }
      userErrors { field message }
    }
  }
`;

export async function deactivatePromotion(
  graphql: AdminGraphqlClient,
  shop: string,
  id: string,
  expectedVersion: string,
) {
  const draft = await getDraft(shop, id);
  if (!draft) return { error: "Promotion not found." };
  if (!draft.shopifyDiscountId)
    return { error: "This promotion has no Shopify discount to deactivate." };
  if (draft.activationToken)
    return {
      error:
        "A Shopify update is pending or needs review. Check Shopify Discounts before continuing.",
    };
  if (draft.updatedAt.toISOString() !== expectedVersion)
    return { error: "This promotion changed. Refresh before deactivating." };
  const token = randomUUID();
  const locked = await prisma.promotionDraft.updateMany({
    where: { id, shop, updatedAt: draft.updatedAt, activationToken: null },
    data: { activationToken: token },
  });
  if (!locked.count)
    return {
      error:
        "This promotion changed or is already being updated. Refresh before continuing.",
    };
  try {
    const response = await graphql(DEACTIVATE_DISCOUNT, {
      variables: { id: draft.shopifyDiscountId },
    });
    const payload = (await response.json()).data?.discountAutomaticDeactivate;
    if (!payload) throw new Error("Uncertain Shopify response");
    if (payload.userErrors?.length && !payload.automaticDiscountNode) {
      await prisma.promotionDraft.updateMany({
        where: { id, shop, activationToken: token },
        data: { activationToken: null },
      });
      return {
        error: payload.userErrors.map((error) => error.message).join(" "),
      };
    }
    if (
      payload.userErrors?.length ||
      payload.automaticDiscountNode?.id !== draft.shopifyDiscountId ||
      payload.automaticDiscountNode?.automaticDiscount?.status !== "EXPIRED"
    )
      throw new Error("Deactivation was not confirmed");
    // Keep the Shopify ID and published rules so reactivation updates the same discount.
    const saved = await prisma.promotionDraft.updateMany({
      where: { id, shop, activationToken: token },
      data: { activationToken: null },
    });
    if (!saved.count) throw new Error("Could not persist deactivation result");
    return { success: true };
  } catch (error) {
    console.error("[magicpromo] Deactivation needs reconciliation", {
      shop,
      id,
      error,
    });
    return {
      error:
        "We couldn't confirm deactivation. Check Shopify Discounts and refresh to see its status. Further updates are locked until the uncertain result is resolved.",
    };
  }
}
