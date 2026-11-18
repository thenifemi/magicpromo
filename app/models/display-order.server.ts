import prisma from "../db.server";
import { storefrontSettingsFromJson } from "../lib/storefront-settings";

export function arrangePromotions<
  T extends {
    id: string;
    storefrontSettings: string;
    shopifyDiscountId: string | null;
  },
>(promotions: T[], savedIds: string[]): T[] {
  const ranks = new Map(savedIds.map((id, index) => [id, index]));
  return [...promotions].sort((a, b) => {
    const rank = (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity);
    if (rank && !Number.isNaN(rank)) return rank;
    return (
      storefrontSettingsFromJson(b.storefrontSettings).priority -
        storefrontSettingsFromJson(a.storefrontSettings).priority ||
      (a.shopifyDiscountId || a.id).localeCompare(b.shopifyDiscountId || b.id)
    );
  });
}
export async function saveDisplayOrder(
  shop: string,
  ids: unknown,
  revision: number,
) {
  if (
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== "string") ||
    new Set(ids).size !== ids.length ||
    !Number.isInteger(revision) ||
    revision < 0
  )
    return false;
  try {
    return await prisma.$transaction(async (tx) => {
      const promotions = await tx.promotionDraft.findMany({
        where: { shop },
        select: { id: true },
      });
      const allowed = new Set(promotions.map((p) => p.id));
      if (ids.length !== allowed.size || ids.some((id) => !allowed.has(id)))
        return false;
      if (revision === 0) {
        await tx.storefrontDisplayOrder.create({
          data: { shop, promotionIds: JSON.stringify(ids), revision: 1 },
        });
        return true;
      }
      const saved = await tx.storefrontDisplayOrder.updateMany({
        where: { shop, revision },
        data: { promotionIds: JSON.stringify(ids), revision: { increment: 1 } },
      });
      return saved.count === 1;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      return false;
    throw error;
  }
}
