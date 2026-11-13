import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/** GET /api/progress — the caller's score history grouped by domain. */
export const GET = withAuth({ rateLimit: RATE_LIMITS.read }, async ({ user }) => {
  const rows = await getPrisma().progressHistory.findMany({
    where: { userId: user.id },
    orderBy: { recordedAt: "asc" },
    select: { domain: true, metric: true, value: true, recordedAt: true, sourceReportId: true },
    take: 1000,
  });
  return {
    skin: rows.filter((r) => r.domain === "SKIN"),
    physical: rows.filter((r) => r.domain === "PHYSICAL"),
    mental: rows.filter((r) => r.domain === "MENTAL"),
  };
});
