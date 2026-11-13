import type { PrismaClient, ReportMethod } from "@prisma/client";

/**
 * Report queries. Every function requires the internal userId and filters by it — ownership is enforced
 * in the query itself, so a caller cannot accidentally read another user's rows.
 */

export async function latestSkinReport(db: PrismaClient, userId: string) {
  return db.skinReport.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { asset: true } });
}

export async function latestPhysicalReport(db: PrismaClient, userId: string) {
  return db.physicalReport.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { asset: true } });
}

export async function latestMentalReport(db: PrismaClient, userId: string) {
  return db.mentalWellnessReport.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function latestCombinedReport(db: PrismaClient, userId: string) {
  return db.combinedWellnessReport.findFirst({ where: { userId }, orderBy: { generatedAt: "desc" } });
}

/** Methods whose numbers were computed by Saarthi and can feed derived scores. */
export const VERIFIED_METHODS: ReportMethod[] = ["COMPUTER_VISION", "QUESTIONNAIRE_RULES"];

export async function latestVerifiedScores(db: PrismaClient, userId: string) {
  const [skin, physical, mental] = await Promise.all([
    db.skinReport.findFirst({ where: { userId, method: { in: VERIFIED_METHODS } }, orderBy: { createdAt: "desc" } }),
    db.physicalReport.findFirst({
      where: { userId, method: { in: VERIFIED_METHODS } },
      orderBy: { createdAt: "desc" },
    }),
    db.mentalWellnessReport.findFirst({
      where: { userId, method: { in: VERIFIED_METHODS } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { skin, physical, mental };
}
