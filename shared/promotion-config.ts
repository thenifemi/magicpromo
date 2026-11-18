// Shared by the admin app and the discount Function. Keep it dependency-free:
// the Function runs as WebAssembly with tight size and instruction limits.

export const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;
export const COLLECTION_GID = /^gid:\/\/shopify\/Collection\/\d+$/;
export const MAX_PRODUCTS = 100;

export const QUALIFICATION_MODES = ["distinct_products", "total_quantity"] as const;
export type QualificationMode = (typeof QUALIFICATION_MODES)[number];

export type PromotionConfig = {
  version: 1;
  productIds: string[];
  collectionIds?: [string];
  discountPercent: number;
  minimumProducts: number;
  qualificationMode: QualificationMode;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const isIntInRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

const isGidList = (v: unknown, pattern: RegExp): v is string[] =>
  Array.isArray(v) && v.every((id) => typeof id === "string" && pattern.test(id));

/** Validates untrusted input (metafield JSON, form data) into a typed config. */
export function parsePromotionConfig(input: unknown): ParseResult<PromotionConfig> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { ok: false, errors: ["config must be an object"] };

  const raw = input as Record<string, unknown>;
  const errors: string[] = [];

  if (raw.version !== 1) errors.push("unsupported version");

  const { productIds, collectionIds } = raw;
  if (!isGidList(productIds, PRODUCT_GID) || productIds.length > MAX_PRODUCTS)
    errors.push(`productIds must be up to ${MAX_PRODUCTS} product GIDs`);

  const hasCollection = collectionIds !== undefined;
  if (hasCollection && (!isGidList(collectionIds, COLLECTION_GID) || collectionIds.length !== 1))
    errors.push("collectionIds must contain exactly one collection GID");

  if (!hasCollection && Array.isArray(productIds) && productIds.length === 0)
    errors.push("select at least one product or a collection");

  if (!isIntInRange(raw.discountPercent, 1, 100))
    errors.push("discountPercent must be an integer from 1 to 100");

  if (!isIntInRange(raw.minimumProducts, 1, MAX_PRODUCTS))
    errors.push(`minimumProducts must be an integer from 1 to ${MAX_PRODUCTS}`);

  if (!QUALIFICATION_MODES.includes(raw.qualificationMode as QualificationMode))
    errors.push("unknown qualificationMode");

  if (errors.length) return { ok: false, errors };

  // Build a fresh object so unknown keys (e.g. storefront settings) never leak through.
  return {
    ok: true,
    value: {
      version: 1,
      productIds: productIds as string[],
      ...(hasCollection ? { collectionIds: collectionIds as [string] } : {}),
      discountPercent: raw.discountPercent as number,
      minimumProducts: raw.minimumProducts as number,
      qualificationMode: raw.qualificationMode as QualificationMode,
    },
  };
}
