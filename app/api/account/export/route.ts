import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { exportAccountData } from "@/server/services/account";

export const runtime = "nodejs";

/** GET /api/account/export — everything Saarthi stores about the caller, as JSON. */
export const GET = withAuth({ rateLimit: RATE_LIMITS.accountExport }, async ({ user, requestId }) =>
  exportAccountData(getPrisma(), user.id, requestId),
);
