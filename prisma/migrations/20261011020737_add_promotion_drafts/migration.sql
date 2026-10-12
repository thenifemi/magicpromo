-- CreateTable
CREATE TABLE "PromotionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromotionDraftProduct" (
    "draftId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    PRIMARY KEY ("draftId", "productId"),
    CONSTRAINT "PromotionDraftProduct_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PromotionDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PromotionDraft_shop_idx" ON "PromotionDraft"("shop");
