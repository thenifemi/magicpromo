ALTER TABLE "PromotionDraft" ADD COLUMN "combineProductDiscounts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PromotionDraft" ADD COLUMN "combineOrderDiscounts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PromotionDraft" ADD COLUMN "combineShippingDiscounts" BOOLEAN NOT NULL DEFAULT false;
