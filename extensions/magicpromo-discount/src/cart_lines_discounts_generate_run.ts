import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  type CartInput,
  type CartLinesDiscountsGenerateRunResult,
} from "../generated/api";

import { parsePromotionConfig } from "../../../shared/promotion-config";

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  const noDiscount = { operations: [] };
  if (!input.discount.discountClasses.includes(DiscountClass.Product))
    return noDiscount;

  // Metafield JSON is external input, even though our app normally writes it.
  const parsed = parsePromotionConfig(input.discount.metafield?.jsonValue);
  if (!parsed.ok) return noDiscount;
  const config = parsed.value;

  const selectedProducts = new Set(config.productIds);
  const distinctProducts = new Set<string>();
  let quantity = 0;
  const targets: { cartLine: { id: string } }[] = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;
    const productId = line.merchandise.product.id;
    const eligible = config.collectionIds?.length
      ? line.merchandise.product.inAnyCollection === true
      : selectedProducts.has(productId);
    if (!eligible) continue;
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1)
      return noDiscount;

    distinctProducts.add(productId);
    quantity += line.quantity;
    // Omitting target quantity applies the percentage to every unit on this line.
    targets.push({ cartLine: { id: line.id } });
  }

  const count =
    config.qualificationMode === "distinct_products"
      ? distinctProducts.size
      : quantity;
  if (!targets.length || count < config.minimumProducts) return noDiscount;

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `${config.discountPercent}% off eligible products`,
              targets,
              value: { percentage: { value: String(config.discountPercent) } },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}
