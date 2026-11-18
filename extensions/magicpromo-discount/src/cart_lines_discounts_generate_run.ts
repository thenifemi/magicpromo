import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  type CartInput,
  type CartLinesDiscountsGenerateRunResult,
} from "../generated/api";

type Configuration = {
  version: 1;
  productIds: string[];
  collectionIds?: string[];
  discountPercent: number;
  minimumProducts: number;
  qualificationMode: "distinct_products" | "total_quantity";
};

// Metafield JSON is external input, even though our app will normally write it.
function readConfiguration(value: unknown): Configuration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  if (
    config.version !== 1 ||
    !Array.isArray(config.productIds) ||
    (config.productIds.length < 1 && (!Array.isArray(config.collectionIds) || !config.collectionIds.length)) ||
    (config.collectionIds !== undefined && (!Array.isArray(config.collectionIds) || config.collectionIds.length !== 1 || !config.collectionIds.every((id) => typeof id === "string" && /^gid:\/\/shopify\/Collection\/\d+$/.test(id)))) ||
    config.productIds.length > 100 ||
    !config.productIds.every(
      (id) =>
        typeof id === "string" && /^gid:\/\/shopify\/Product\/\d+$/.test(id),
    ) ||
    typeof config.discountPercent !== "number" ||
    !Number.isInteger(config.discountPercent) ||
    config.discountPercent < 1 ||
    config.discountPercent > 100 ||
    typeof config.minimumProducts !== "number" ||
    !Number.isInteger(config.minimumProducts) ||
    config.minimumProducts < 1 ||
    config.minimumProducts > 100 ||
    (config.qualificationMode !== "distinct_products" &&
      config.qualificationMode !== "total_quantity")
  )
    return null;
  return config as Configuration;
}

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  const noDiscount = { operations: [] };
  if (!input.discount.discountClasses.includes(DiscountClass.Product))
    return noDiscount;

  const config = readConfiguration(input.discount.metafield?.jsonValue);
  if (!config) return noDiscount;

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
