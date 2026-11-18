import { createHash, randomBytes } from "node:crypto";
import prisma from "../db.server";
const hash = (key: string) => createHash("sha256").update(key).digest("hex");

export async function createHydrogenKey(
  shop: string,
  appId: string,
  label: string,
  replaceId?: string,
) {
  if (!appId || !label.trim() || label.length > 60)
    throw new Error("Enter a name of 1–60 characters.");
  const secret = `mp_${randomBytes(32).toString("hex")}`;
  await prisma.$transaction(async (tx) => {
    if (replaceId) {
      const replaced = await tx.hydrogenKey.updateMany({
        where: { id: replaceId, shop, appId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (replaced.count !== 1)
        throw new Error("This key has changed. Refresh and try again.");
    }
    const count = await tx.hydrogenKey.count({
      where: { shop, appId, revokedAt: null },
    });
    if (count >= 5)
      throw new Error(
        "Revoke an unused key before creating another. You can have five active keys.",
      );
    await tx.hydrogenKey.create({
      data: {
        shop,
        appId,
        label: label.trim(),
        keyHash: hash(secret),
        prefix: secret.slice(0, 11),
      },
    });
  });
  return secret;
}
export async function revokeHydrogenKey(
  shop: string,
  appId: string,
  id: string,
) {
  return prisma.hydrogenKey.updateMany({
    where: { id, shop, appId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
export async function authenticateHydrogenKey(
  authorization: string | null,
  appId: string,
) {
  if (
    !appId ||
    !authorization ||
    !/^Bearer mp_[a-f0-9]{64}$/.test(authorization)
  )
    return null;
  const key = await prisma.hydrogenKey.findUnique({
    where: { keyHash: hash(authorization.slice(7)) },
  });
  if (!key || key.revokedAt || key.appId !== appId) return null;
  return key;
}
