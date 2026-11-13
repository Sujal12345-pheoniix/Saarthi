import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { combinedReportView } from "@/features/reports/view-model";
import { latestCombinedReport } from "@/server/repositories/reports";

export const runtime = "nodejs";

/** GET /api/report/latest — the caller's most recent combined wellness report, or null. */
export const GET = withAuth({ rateLimit: RATE_LIMITS.read }, async ({ user }) => {
  const report = await latestCombinedReport(getPrisma(), user.id);
  return { report: report ? combinedReportView(report) : null };
});
