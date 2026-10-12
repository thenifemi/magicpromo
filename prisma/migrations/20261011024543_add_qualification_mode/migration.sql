-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PromotionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "qualificationMode" TEXT NOT NULL DEFAULT 'distinct_products',
    "discountPercent" INTEGER NOT NULL DEFAULT 15,
    "minimumProducts" INTEGER NOT NULL DEFAULT 3
);
INSERT INTO "new_PromotionDraft" ("createdAt", "discountPercent", "id", "minimumProducts", "name", "shop", "updatedAt") SELECT "createdAt", "discountPercent", "id", "minimumProducts", "name", "shop", "updatedAt" FROM "PromotionDraft";
DROP TABLE "PromotionDraft";
ALTER TABLE "new_PromotionDraft" RENAME TO "PromotionDraft";
CREATE INDEX "PromotionDraft_shop_idx" ON "PromotionDraft"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
