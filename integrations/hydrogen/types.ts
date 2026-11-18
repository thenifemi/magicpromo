export type Offer = {
  id: string;
  percent: number;
  minimum: number;
  mode: string;
  eligibleProductIds: string[];
  settings: {
    announcement: boolean;
    product: boolean;
    cart: boolean;
    message: string;
    linkText: string;
    destination: string;
    background: string;
    foreground: string;
    position: "top" | "bottom";
    priority: number;
  };
};
export type CartItem = { productId: string; quantity: number };
export type Placement = "announcement" | "product" | "cart";
export const productId = (id: string) => id.split("/").pop() || "";
export function selectOffer(
  offers: Offer[],
  placement: Placement,
  items: CartItem[] = [],
  currentProduct?: string,
) {
  const candidates = offers.filter(
    (offer) =>
      offer.settings[placement] &&
      (placement !== "product" ||
        offer.eligibleProductIds.includes(productId(currentProduct || ""))),
  );
  return (
    (placement === "cart"
      ? candidates.find((offer) =>
          items.some(
            (item) =>
              item.quantity > 0 &&
              offer.eligibleProductIds.includes(productId(item.productId)),
          ),
        )
      : undefined) || candidates[0]
  );
}
export function cartProgress(offer: Offer, items: CartItem[]) {
  const eligible = items.filter(
    (item) =>
      item.quantity > 0 &&
      offer.eligibleProductIds.includes(productId(item.productId)),
  );
  const count =
    offer.mode === "distinct_products"
      ? new Set(eligible.map((item) => productId(item.productId))).size
      : eligible.reduce((sum, item) => sum + item.quantity, 0);
  return {
    count,
    remaining: Math.max(0, offer.minimum - count),
    qualified: count >= offer.minimum,
  };
}
export function offerMessage(offer: Offer) {
  const values: Record<string, string | number> = {
    percent: offer.percent,
    minimum: offer.minimum,
    items:
      offer.mode === "distinct_products"
        ? "different eligible products"
        : "eligible items",
  };
  return offer.settings.message.replace(/\{(\w+)\}/g, (match, key) =>
    String(values[key] ?? match),
  );
}
