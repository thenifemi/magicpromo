ALTER TABLE "PromotionDraft" ADD COLUMN "collectionId" TEXT;
ALTER TABLE "PromotionDraft" ADD COLUMN "collectionTitle" TEXT;
ALTER TABLE "PromotionDraft" ADD COLUMN "storefrontSettings" TEXT NOT NULL DEFAULT '{}';
