-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionDraft" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopifyDiscountId" TEXT,
    "publishedFingerprint" TEXT,
    "activationToken" TEXT,
    "qualificationMode" TEXT NOT NULL DEFAULT 'distinct_products',
    "discountPercent" INTEGER NOT NULL DEFAULT 15,
    "minimumProducts" INTEGER NOT NULL DEFAULT 3,
    "combineProductDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "combineOrderDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "combineShippingDiscounts" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PromotionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionDraftProduct" (
    "draftId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "PromotionDraftProduct_pkey" PRIMARY KEY ("draftId","productId")
);

-- CreateIndex
CREATE INDEX "PromotionDraft_shop_idx" ON "PromotionDraft"("shop");

-- AddForeignKey
ALTER TABLE "PromotionDraftProduct" ADD CONSTRAINT "PromotionDraftProduct_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PromotionDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
