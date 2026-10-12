import { data, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import type { ProductSummary } from "../components/ProductPicker";
import {
  activatePromotion,
  deactivatePromotion,
  readDiscount,
  draftFingerprint,
} from "./promotion-activation.server";
import { getDraft, saveDraft } from "./promotion-draft.server";

export async function loadEditor(request: Request, id: string | null) {
  const { admin, session } = await authenticate.admin(request);
  const draft = id ? await getDraft(session.shop, id) : null;
  if (id && !draft) throw new Response("Promotion not found", { status: 404 });
  const response = await admin.graphql(`#graphql
    query MagicpromoProducts {
      products(first: 10) {
        nodes {
          id
          title
          status
          variants(first: 100) { nodes { id title price } pageInfo { hasNextPage } }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          featuredMedia {
            preview {
              image {
                url
                altText
              }
            }
          }
        }
      }
    }
  `);
  const result: {
    data?: { products: { nodes: ProductSummary[] } };
    errors?: { message: string }[];
  } = await response.json();

  if (result.errors?.length || !result.data) {
    throw new Response(
      "Unable to load products from Shopify. Please try again.",
      {
        status: 502,
      },
    );
  }

  let discountStatus: string | null = null;
  if (draft?.shopifyDiscountId) {
    try {
      const remote = await readDiscount(admin.graphql, draft.shopifyDiscountId);
      discountStatus = remote?.automaticDiscount.status ?? "MISSING";
    } catch {
      discountStatus = "UNKNOWN";
    }
  }
  return {
    products: result.data.products.nodes,
    draft,
    discountStatus,
    needsSync:
      !!draft?.shopifyDiscountId &&
      draft.publishedFingerprint !== draftFingerprint(draft),
  };
}

export const savePromotion = async (request: Request, id: string | null) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "activate" || intent === "deactivate") {
    if (!id)
      return data(
        { error: "Save the draft before activating." },
        { status: 400 },
      );
    try {
      const result = await (
        intent === "deactivate" ? deactivatePromotion : activatePromotion
      )(admin.graphql, session.shop, id, String(form.get("version") ?? ""));
      return "error" in result ? data(result, { status: 400 }) : result;
    } catch (error) {
      console.error("[magicpromo] Discount update failed", error);
      return data(
        {
          error:
            "The discount update could not be completed. Refresh to check its status before retrying.",
        },
        { status: 500 },
      );
    }
  }
  const combinationFields = [
    "combineProductDiscounts",
    "combineOrderDiscounts",
    "combineShippingDiscounts",
  ] as const;
  if (
    combinationFields.some(
      (field) => !["true", "false"].includes(String(form.get(field))),
    )
  ) {
    return data(
      { error: "Choose valid discount combination settings." },
      { status: 400 },
    );
  }
  const name = String(form.get("name") ?? "").trim();
  if (id && !(await getDraft(session.shop, id)))
    throw new Response("Promotion not found", { status: 404 });
  const qualificationMode = form.get("qualificationMode");
  if (
    qualificationMode !== "distinct_products" &&
    qualificationMode !== "total_quantity"
  )
    return data({ error: "Choose how the cart qualifies." }, { status: 400 });
  const discountPercent = Number(form.get("discountPercent"));
  const minimumProducts = Number(form.get("minimumProducts"));
  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < 1 ||
    discountPercent > 100 ||
    !Number.isInteger(minimumProducts) ||
    minimumProducts < 1 ||
    minimumProducts > 100
  )
    return data(
      {
        error:
          "Enter a whole-number discount from 1 to 100 and a minimum from 1 to 100 products.",
      },
      { status: 400 },
    );
  const productIds = [...new Set(form.getAll("productId").map(String))];
  if (!name || name.length > 100) {
    return data(
      { error: "Enter a promotion name between 1 and 100 characters." },
      { status: 400 },
    );
  }
  if (
    !productIds.length ||
    productIds.length > 100 ||
    productIds.some((id) => !/^gid:\/\/shopify\/Product\/\d+$/.test(id))
  ) {
    return data(
      { error: "Select between 1 and 100 products." },
      { status: 400 },
    );
  }
  // Confirm that every submitted product belongs to the authenticated store.
  const response = await admin.graphql(
    `#graphql
    query ValidatePromotionProducts($ids: [ID!]!) {
      nodes(ids: $ids) { ... on Product { id } }
    }
  `,
    { variables: { ids: productIds } },
  );
  const result: {
    data?: { nodes: ({ id?: string } | null)[] };
    errors?: { message: string }[];
  } = await response.json();
  if (result.errors?.length || !result.data) {
    return data(
      { error: "Could not verify products. Please try again." },
      { status: 502 },
    );
  }
  const validIds = new Set(
    result.data.nodes.map((node: { id?: string } | null) => node?.id),
  );
  if (productIds.some((id) => !validIds.has(id))) {
    return data(
      {
        error:
          "Some selected products are no longer available. Clear the selection and choose products again.",
      },
      { status: 400 },
    );
  }
  try {
    const draft = await saveDraft({
      shop: session.shop,
      id,
      name,
      productIds,
      discountPercent,
      minimumProducts,
      qualificationMode,
      combineProductDiscounts: form.get("combineProductDiscounts") === "true",
      combineOrderDiscounts: form.get("combineOrderDiscounts") === "true",
      combineShippingDiscounts: form.get("combineShippingDiscounts") === "true",
    });
    if (!draft)
      return data(
        { error: "Draft not found. Refresh the page and try again." },
        { status: 404 },
      );
    if (!id) return redirect(`/app/promotions/${draft.id}`);
    return { success: true };
  } catch (error) {
    console.error("[magicpromo] Failed to save promotion draft", error);
    return data(
      { error: "Your draft could not be saved. Please try again." },
      { status: 500 },
    );
  }
};
