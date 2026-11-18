CREATE TABLE "HydrogenKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "appId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" DATETIME,
  "revokedAt" DATETIME
);
CREATE UNIQUE INDEX "HydrogenKey_keyHash_key" ON "HydrogenKey"("keyHash");
CREATE INDEX "HydrogenKey_shop_appId_idx" ON "HydrogenKey"("shop", "appId");
