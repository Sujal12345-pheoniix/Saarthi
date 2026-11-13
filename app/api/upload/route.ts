import type { AssetPurpose } from "@prisma/client";
import { Errors } from "@/lib/api/errors";
import { readBodyWithLimit } from "@/lib/api/body";
import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { UPLOAD_IMAGE_LIMITS } from "@/lib/security/image-validation";
import { uploadAsset } from "@/server/services/assets";

export const runtime = "nodejs";

/** Multipart overhead allowance on top of the image limit. */
const MAX_REQUEST_BYTES = UPLOAD_IMAGE_LIMITS.maxBytes + 64 * 1024;

/** `purpose` is the supported field; `folder` values sent by pre-Phase-1 clients are mapped, never used as paths. */
const PURPOSES: Record<string, AssetPurpose> = {
  skin: "SKIN_SCAN",
  physical: "PHYSICAL_SCAN",
  "saarthi/skin": "SKIN_SCAN",
  "saarthi/physical": "PHYSICAL_SCAN",
};

/**
 * POST /api/upload  (multipart/form-data: file, purpose = "skin" | "physical")
 * Verifies the image server-side, stores it privately and returns an asset id owned by the caller.
 */
export const POST = withAuth({ rateLimit: RATE_LIMITS.upload }, async ({ req, user, requestId, log }) => {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw Errors.unsupportedMediaType("Upload must be multipart/form-data.");
  }
  if (req.headers.get("content-length") === null) throw Errors.lengthRequired();

  const raw = await readBodyWithLimit(req, MAX_REQUEST_BYTES);
  let form: FormData;
  try {
    form = await new Response(Buffer.from(raw), { headers: { "content-type": contentType } }).formData();
  } catch {
    throw Errors.badRequest("Malformed multipart body.");
  }

  const purposeField = String(form.get("purpose") ?? form.get("folder") ?? "");
  const purpose = PURPOSES[purposeField];
  if (!purpose) throw Errors.badRequest('Field "purpose" must be "skin" or "physical".');

  const file = form.get("file");
  if (!(file instanceof Blob)) throw Errors.badRequest('Field "file" is required.');
  const bytes = new Uint8Array(await file.arrayBuffer());

  return uploadAsset(getPrisma(), { userId: user.id, purpose, bytes, requestId, log });
});
