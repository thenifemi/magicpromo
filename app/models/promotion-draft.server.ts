import prisma from "../db.server";

export function listDrafts(shop: string) {
  return prisma.promotionDraft.findMany({
    where: { shop },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: { _count: { select: { products: true } } },
  });
}

export function getDraft(shop: string, id: string) {
  return prisma.promotionDraft.findFirst({
    where: { shop, id },
    include: { products: true },
  });
}

export async function saveDraft(input: {
  shop: string;
  id: string | null;
  name: string;
  productIds: string[];
  collectionId?: string | null;
  collectionTitle?: string | null;
  combineProductDiscounts: boolean;
  combineOrderDiscounts: boolean;
  combineShippingDiscounts: boolean;

  discountPercent: number;
  minimumProducts: number;
  qualificationMode: "distinct_products" | "total_quantity";
}) {
  return prisma.$transaction(async (tx) => {
    const data = {
      name: input.name,
      collectionId: input.collectionId ?? null,
      collectionTitle: input.collectionTitle ?? null,
      combineProductDiscounts: input.combineProductDiscounts,
      combineOrderDiscounts: input.combineOrderDiscounts,
      combineShippingDiscounts: input.combineShippingDiscounts,

      discountPercent: input.discountPercent,
      minimumProducts: input.minimumProducts,
      qualificationMode: input.qualificationMode,
      products: {
        create: input.productIds.map((productId) => ({ productId })),
      },
    };
    if (!input.id) {
      return tx.promotionDraft.create({ data: { shop: input.shop, ...data } });
    }
    const existing = await tx.promotionDraft.findFirst({
      where: { id: input.id, shop: input.shop },
    });
    if (!existing) return null;
    if (existing.activationToken)
      throw new Error("Activation is pending; saving is locked.");
    return tx.promotionDraft.update({
      where: { id: existing.id, shop: input.shop },
      data: { ...data, products: { deleteMany: {}, ...data.products } },
    });
  });
}
