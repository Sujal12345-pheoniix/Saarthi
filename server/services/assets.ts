import type { AssetPurpose, PrismaClient } from "@prisma/client";
import { Errors } from "@/lib/api/errors";
import type { Logger } from "@/lib/logging/logger";
import { verifyImage } from "@/lib/security/image-validation";
import { getStorage } from "@/lib/storage/storage";
import { findOwnedActiveAsset } from "@/server/repositories/assets";
import { audit } from "./audit";
import { signedImageUrl } from "./analysis-service";

export interface UploadedAssetView {
  assetId: string;
  purpose: AssetPurpose;
  width: number;
  height: number;
  previewUrl: string | null;
}

export async function uploadAsset(
  db: PrismaClient,
  args: { userId: string; purpose: AssetPurpose; bytes: Uint8Array; requestId: string; log: Logger },
): Promise<UploadedAssetView> {
  const image = verifyImage(args.bytes);
  const storage = getStorage();
  if (!storage) throw Errors.notConfigured("Image storage");

  // Same bytes already uploaded by this user for this purpose: reuse instead of storing a duplicate.
  const duplicate = await db.uploadedAsset.findFirst({
    where: { userId: args.userId, sha256: image.sha256, purpose: args.purpose, status: "ACTIVE" },
  });
  if (duplicate) {
    return {
      assetId: duplicate.id,
      purpose: duplicate.purpose,
      width: duplicate.width,
      height: duplicate.height,
      previewUrl: signedImageUrl(duplicate),
    };
  }

  const stored = await storage.upload({
    bytes: args.bytes,
    userId: args.userId,
    purpose: args.purpose,
    format: image.format,
  });
  try {
    const asset = await db.uploadedAsset.create({
      data: {
        userId: args.userId,
        provider: "CLOUDINARY",
        storageKey: stored.storageKey,
        deliveryType: stored.deliveryType,
        purpose: args.purpose,
        mimeType: image.mimeType,
        format: image.format,
        sizeBytes: image.sizeBytes,
        width: image.width,
        height: image.height,
        sha256: image.sha256,
      },
    });
    await audit(db, {
      actorUserId: args.userId,
      action: "asset.upload",
      resourceType: "UploadedAsset",
      resourceId: asset.id,
      requestId: args.requestId,
      metadata: { purpose: args.purpose, sizeBytes: image.sizeBytes },
    });
    return {
      assetId: asset.id,
      purpose: asset.purpose,
      width: asset.width,
      height: asset.height,
      previewUrl: signedImageUrl(asset),
    };
  } catch (error) {
    // Do not leave an orphaned object in storage if the metadata write fails.
    await storage.remove(stored).catch((e) => args.log.error("asset.orphan_cleanup_failed", { error: e }));
    throw error;
  }
}

export async function deleteAsset(db: PrismaClient, args: { userId: string; assetId: string; requestId: string }) {
  const asset = await findOwnedActiveAsset(db, args.userId, args.assetId);
  if (!asset) throw Errors.notFound("Uploaded image");
  const storage = getStorage();
  if (!storage) throw Errors.notConfigured("Image storage");
  await storage.remove(asset);
  await db.uploadedAsset.update({ where: { id: asset.id }, data: { status: "DELETED", deletedAt: new Date() } });
  await audit(db, {
    actorUserId: args.userId,
    action: "asset.delete",
    resourceType: "UploadedAsset",
    resourceId: asset.id,
    requestId: args.requestId,
  });
  return { assetId: asset.id, deleted: true };
}
