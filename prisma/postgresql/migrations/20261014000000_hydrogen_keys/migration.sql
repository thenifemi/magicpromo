CREATE TABLE "HydrogenKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "appId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "HydrogenKey_keyHash_key" ON "HydrogenKey"("keyHash");
CREATE INDEX "HydrogenKey_shop_appId_idx" ON "HydrogenKey"("shop", "appId");
