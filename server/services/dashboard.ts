import type { PrismaClient, WellnessDomain } from "@prisma/client";
import {
  latestCombinedReport,
  latestMentalReport,
  latestPhysicalReport,
  latestSkinReport,
} from "@/server/repositories/reports";
import { METHOD_LABEL } from "@/features/reports/view-model";

/**
 * Dashboard overview built only from stored data. Missing data is returned as null so the UI can show an
 * empty state instead of placeholder numbers.
 */

export interface DomainSnapshot {
  score: number;
  method: string;
  methodLabel: string;
  recordedAt: string;
}

export interface DashboardSummary {
  skin: DomainSnapshot | null;
  physical: DomainSnapshot | null;
  mental: DomainSnapshot | null;
  combined: { score: number | null; generatedAt: string } | null;
  /** Consecutive days (ending today or yesterday, UTC) with at least one report. */
  activeStreakDays: number;
  progress: Array<{ domain: WellnessDomain; value: number; recordedAt: string }>;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function computeStreak(dates: Date[], today = new Date()): number {
  const days = new Set(dates.map(dayKey));
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function getDashboardSummary(db: PrismaClient, userId: string): Promise<DashboardSummary> {
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const [skin, physical, mental, combined, progress] = await Promise.all([
    latestSkinReport(db, userId),
    latestPhysicalReport(db, userId),
    latestMentalReport(db, userId),
    latestCombinedReport(db, userId),
    db.progressHistory.findMany({
      where: { userId, recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
      select: { domain: true, value: true, recordedAt: true },
      take: 500,
    }),
  ]);

  const snap = (score: number, method: keyof typeof METHOD_LABEL, at: Date): DomainSnapshot => ({
    score,
    method,
    methodLabel: METHOD_LABEL[method],
    recordedAt: at.toISOString(),
  });

  return {
    skin: skin ? snap(skin.skinScore, skin.method, skin.createdAt) : null,
    physical: physical ? snap(physical.fitnessScore, physical.method, physical.createdAt) : null,
    mental: mental ? snap(mental.wellnessScore, mental.method, mental.createdAt) : null,
    combined: combined ? { score: combined.overallHealthScore, generatedAt: combined.generatedAt.toISOString() } : null,
    activeStreakDays: computeStreak(progress.map((p) => p.recordedAt)),
    progress: progress.map((p) => ({ domain: p.domain, value: p.value, recordedAt: p.recordedAt.toISOString() })),
  };
}
