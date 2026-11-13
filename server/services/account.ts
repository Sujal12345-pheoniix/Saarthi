import type { PrismaClient } from "@prisma/client";
import type { Logger } from "@/lib/logging/logger";
import { getStorage } from "@/lib/storage/storage";
import { audit } from "./audit";

/**
 * Data subject operations. Both act only on the server-resolved user id.
 */

export async function exportAccountData(db: PrismaClient, userId: string, requestId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      profile: true,
      preferences: true,
      consents: true,
      assets: {
        select: {
          id: true,
          purpose: true,
          mimeType: true,
          width: true,
          height: true,
          sizeBytes: true,
          status: true,
          createdAt: true,
          deletedAt: true,
        },
      },
      analyses: {
        select: {
          id: true,
          domain: true,
          status: true,
          errorCode: true,
          createdAt: true,
          completedAt: true,
          input: { select: { questionnaire: true } },
        },
      },
      skinReports: true,
      physicalReports: true,
      mentalReports: true,
      wellnessReports: true,
      progressHistory: true,
      achievements: true,
      dailyHabits: true,
      journalEntries: true,
      recommendations: true,
      conversations: {
        select: {
          id: true,
          title: true,
          createdAt: true,
          messages: { select: { role: true, content: true, createdAt: true } },
        },
      },
      notifications: true,
    },
  });
  await audit(db, {
    actorUserId: userId,
    action: "account.export",
    resourceType: "User",
    resourceId: userId,
    requestId,
  });
  return { exportedAt: new Date().toISOString(), formatVersion: 1, user };
}

/**
 * Deletes every stored file, then all database rows (cascade). Audit entries are kept with the actor cleared.
 * The Clerk identity is deleted by the route after this succeeds.
 */
export async function deleteAccountData(db: PrismaClient, userId: string, requestId: string, log: Logger) {
  const storage = getStorage();
  const assets = await db.uploadedAsset.findMany({ where: { userId, status: "ACTIVE" } });
  const failed: string[] = [];
  if (assets.length && !storage) {
    throw new Error("Storage is not configured; refusing to delete account rows while files would be orphaned.");
  }
  for (const asset of assets) {
    try {
      await storage!.remove(asset);
    } catch (error) {
      failed.push(asset.id);
      log.error("account.delete.asset_failed", { assetId: asset.id, error });
    }
  }
  if (failed.length) {
    // Keep the account so the user (or support) can retry; nothing has been deleted from the database yet.
    throw new Error(`Failed to delete ${failed.length} stored file(s)`);
  }
  await audit(db, {
    actorUserId: userId,
    action: "account.delete",
    resourceType: "User",
    resourceId: userId,
    requestId,
    metadata: { assetsDeleted: assets.length },
  });
  await db.user.delete({ where: { id: userId } });
  return { deleted: true, assetsDeleted: assets.length };
}
