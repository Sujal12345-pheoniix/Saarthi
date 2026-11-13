import { readJson } from "@/lib/api/body";
import { Errors } from "@/lib/api/errors";
import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { mentalReportView, physicalReportView, skinReportView } from "@/features/reports/view-model";
import {
  mentalQuestionnaireSchema,
  physicalQuestionnaireSchema,
  skinQuestionnaireSchema,
} from "@/features/wellness/schemas";
import { latestMentalReport, latestPhysicalReport, latestSkinReport } from "@/server/repositories/reports";
import { signedImageUrl } from "@/server/services/analysis-service";
import {
  createMentalQuestionnaireReport,
  createPhysicalQuestionnaireReport,
  createSkinQuestionnaireReport,
} from "@/server/services/questionnaire-reports";

export const runtime = "nodejs";

type Domain = "skin" | "physical" | "mental";
const isDomain = (v: string): v is Domain => v === "skin" || v === "physical" || v === "mental";

/** GET /api/reports/{skin|physical|mental} — latest report of either method (questionnaire or computer vision). */
export const GET = withAuth<{ domain: string }>({ rateLimit: RATE_LIMITS.read }, async ({ params, user }) => {
  if (!isDomain(params.domain)) throw Errors.notFound("Report domain");
  const db = getPrisma();
  if (params.domain === "skin") {
    const r = await latestSkinReport(db, user.id);
    return { report: r ? skinReportView(r, signedImageUrl(r.asset)) : null };
  }
  if (params.domain === "physical") {
    const r = await latestPhysicalReport(db, user.id);
    return { report: r ? physicalReportView(r, signedImageUrl(r.asset)) : null };
  }
  const r = await latestMentalReport(db, user.id);
  return { report: r ? mentalReportView(r) : null };
});

/** POST /api/reports/{domain} — create a questionnaire (rule-based) report. */
export const POST = withAuth<{ domain: string }>(
  { rateLimit: RATE_LIMITS.questionnaire },
  async ({ req, params, user, requestId }) => {
    if (!isDomain(params.domain)) throw Errors.notFound("Report domain");
    const db = getPrisma();
    const ctx = { userId: user.id, requestId };
    if (params.domain === "skin") {
      return { report: await createSkinQuestionnaireReport(db, await readJson(req, skinQuestionnaireSchema), ctx) };
    }
    if (params.domain === "physical") {
      return {
        report: await createPhysicalQuestionnaireReport(db, await readJson(req, physicalQuestionnaireSchema), ctx),
      };
    }
    return { report: await createMentalQuestionnaireReport(db, await readJson(req, mentalQuestionnaireSchema), ctx) };
  },
);
