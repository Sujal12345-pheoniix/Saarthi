import type { PrismaClient } from "@prisma/client";

/** Active asset owned by `userId`, or null. */
export async function findOwnedActiveAsset(db: PrismaClient, userId: string, assetId: string) {
  return db.uploadedAsset.findFirst({ where: { id: assetId, userId, status: "ACTIVE" } });
}
