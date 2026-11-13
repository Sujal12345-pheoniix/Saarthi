import type { PrismaClient } from "@prisma/client";

/** Returns the analysis only if it belongs to `userId`. Missing and foreign ids are indistinguishable. */
export async function findOwnedAnalysis(db: PrismaClient, userId: string, analysisId: string) {
  return db.analysis.findFirst({
    where: { id: analysisId, userId },
    include: {
      skinReport: { include: { asset: true } },
      physicalReport: { include: { asset: true } },
      mentalReport: true,
      combinedReport: true,
    },
  });
}

export async function listOwnedAnalyses(db: PrismaClient, userId: string, take = 50) {
  return db.analysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      domain: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
  });
}
