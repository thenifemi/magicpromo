// The public offer contract and the rules every storefront renderer shares.
// Pure and dependency-free: runs in the theme script, Hydrogen, and the app.

/** Bumped only for breaking changes to the offers response. */
export const OFFERS_API_VERSION = 1;

export type Placement = "announcement" | "product" | "cart";
export type QualificationMode = "distinct_products" | "total_quantity";

/** Merchant-authored messaging, published alongside the discount. */
export type OfferSettings = Record<Placement, boolean> & {
  message: string;
  linkText: string;
  destination: string;
  background: string;
  foreground: string;
  position: "top" | "bottom";
  priority: number;
};

export type Offer = {
  /** Shopify discount GID. */
  id: string;
  percent: number;
  minimum: number;
  mode: QualificationMode;
  /** Numeric product IDs (not GIDs) the offer applies to. */
  eligibleProductIds: string[];
  settings: OfferSettings;
};

export type OffersResponse = { version: typeof OFFERS_API_VERSION; offers: Offer[] };

export type CartItem = { productId: string; quantity: number };

export type CartProgress = { count: number; remaining: number; qualified: boolean };

/** Labels for `{items}` in messages; themes pass translated strings. */
export type ItemLabels = { items: string; distinct: string };

export const defaultItemLabels: ItemLabels = {
  items: "eligible items",
  distinct: "different eligible products",
};

/** Accepts `123`, `"123"` or `"gid://shopify/Product/123"`; returns `"123"`. */
export const toProductId = (id: string | number) =>
  String(id).split("/").pop() ?? "";

const isEligible = (offer: Offer, productId: string | number) =>
  offer.eligibleProductIds.includes(toProductId(productId));

/**
 * Picks the one offer to show in a placement. `offers` must already be in
 * display order. Product banners need an eligible product; cart banners
 * prefer an offer that matches the cart, then fall back to display order.
 */
export function selectOffer(
  offers: Offer[],
  placement: Placement,
  context: { items?: CartItem[]; productId?: string } = {},
): Offer | undefined {
  const { items = [], productId } = context;
  const candidates = offers.filter(
    (offer) =>
      offer.settings[placement] &&
      (placement !== "product" || (productId != null && isEligible(offer, productId))),
  );
  if (placement === "cart") {
    const relevant = candidates.find((offer) =>
      items.some((item) => item.quantity > 0 && isEligible(offer, item.productId)),
    );
    if (relevant) return relevant;
  }
  return candidates[0];
}

/** Distinct mode counts each product once across variants; quantity mode sums units. */
export function cartProgress(offer: Offer, items: CartItem[]): CartProgress {
  const eligible = items.filter(
    (item) => item.quantity > 0 && isEligible(offer, item.productId),
  );
  const count =
    offer.mode === "distinct_products"
      ? new Set(eligible.map((item) => toProductId(item.productId))).size
      : eligible.reduce((sum, item) => sum + item.quantity, 0);
  return {
    count,
    remaining: Math.max(0, offer.minimum - count),
    qualified: count >= offer.minimum,
  };
}

/** Replaces `{key}` placeholders; unknown keys are left as-is. */
export function formatTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export const itemLabel = (offer: Offer, labels: ItemLabels = defaultItemLabels) =>
  offer.mode === "distinct_products" ? labels.distinct : labels.items;

/** The merchant's message with `{minimum}`, `{percent}` and `{items}` filled in. */
export function offerMessage(offer: Offer, labels: ItemLabels = defaultItemLabels) {
  return formatTemplate(offer.settings.message, {
    minimum: offer.minimum,
    percent: offer.percent,
    items: itemLabel(offer, labels),
  });
}
