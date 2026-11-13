import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { deleteAsset } from "@/server/services/assets";

export const runtime = "nodejs";

/** DELETE /api/assets/{id} — removes the stored image. Reports keep their numbers; the image is gone. */
export const DELETE = withAuth<{ id: string }>({ rateLimit: RATE_LIMITS.upload }, async ({ params, user, requestId }) =>
  deleteAsset(getPrisma(), { userId: user.id, assetId: params.id, requestId }),
);
