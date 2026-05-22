import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  generateMentalReport,
  generatePhysicalReport,
  generateSkinReport,
  type WellnessDomain,
} from "@/lib/wellness-report";

export const runtime = "nodejs";

async function ensureDatabaseUser() {
  const { userId } = auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const profile = await currentUser();

  return prisma.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      email: profile?.emailAddresses[0]?.emailAddress ?? null,
      name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || null,
      imageUrl: profile?.imageUrl ?? null,
    },
    update: {
      email: profile?.emailAddresses[0]?.emailAddress ?? null,
      name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || null,
      imageUrl: profile?.imageUrl ?? null,
    },
  });
}

function domainIsValid(value: string): value is WellnessDomain {
  return value === "skin" || value === "physical" || value === "mental";
}

export async function GET(_request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;

  if (!domainIsValid(domain)) {
    return Response.json({ error: "Unknown report domain." }, { status: 400 });
  }

  try {
    const user = await ensureDatabaseUser();

    const report =
      domain === "skin"
        ? await prisma.skinReport.findUnique({ where: { userId: user.id } })
        : domain === "physical"
          ? await prisma.physicalReport.findUnique({ where: { userId: user.id } })
          : await prisma.mentalReport.findUnique({ where: { userId: user.id } });

    return Response.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load report.";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;

  if (!domainIsValid(domain)) {
    return Response.json({ error: "Unknown report domain." }, { status: 400 });
  }

  try {
    const user = await ensureDatabaseUser();
    const body = await request.json();

    const report =
      domain === "skin"
        ? generateSkinReport(body)
        : domain === "physical"
          ? generatePhysicalReport(body)
          : generateMentalReport(body);

    const saved =
      domain === "skin"
        ? await prisma.skinReport.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              imageUrl: report.imageUrl,
              score: report.score,
              confidence: report.confidence,
              summary: report.summary,
              findings: report.findings,
              recommendations: report.recommendations,
              activities: report.activities,
              metrics: report.metrics,
              caution: report.caution,
            },
            update: {
              imageUrl: report.imageUrl,
              score: report.score,
              confidence: report.confidence,
              summary: report.summary,
              findings: report.findings,
              recommendations: report.recommendations,
              activities: report.activities,
              metrics: report.metrics,
              caution: report.caution,
            },
          })
        : domain === "physical"
          ? await prisma.physicalReport.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                imageUrl: report.imageUrl,
                score: report.score,
                confidence: report.confidence,
                summary: report.summary,
                findings: report.findings,
                recommendations: report.recommendations,
                activities: report.activities,
                metrics: report.metrics,
                caution: report.caution,
              },
              update: {
                imageUrl: report.imageUrl,
                score: report.score,
                confidence: report.confidence,
                summary: report.summary,
                findings: report.findings,
                recommendations: report.recommendations,
                activities: report.activities,
                metrics: report.metrics,
                caution: report.caution,
              },
            })
          : await prisma.mentalReport.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                score: report.score,
                confidence: report.confidence,
                summary: report.summary,
                findings: report.findings,
                recommendations: report.recommendations,
                activities: report.activities,
                metrics: report.metrics,
                caution: report.caution,
              },
              update: {
                score: report.score,
                confidence: report.confidence,
                summary: report.summary,
                findings: report.findings,
                recommendations: report.recommendations,
                activities: report.activities,
                metrics: report.metrics,
                caution: report.caution,
              },
            });

    return Response.json({ report, saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save report.";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  generateMentalReport,
  generatePhysicalReport,
  generateSkinReport,
  type WellnessDomain,
} from "@/lib/wellness-report";

export const runtime = "nodejs";

async function ensureDatabaseUser() {
  const { userId } = auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const profile = await currentUser();

  return prisma.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      email: profile?.emailAddresses[0]?.emailAddress ?? null,
      name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || null,
      imageUrl: profile?.imageUrl ?? null,
    },
    update: {
      email: profile?.emailAddresses[0]?.emailAddress ?? null,
      name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || null,
      imageUrl: profile?.imageUrl ?? null,
    },
  });
}

function domainIsValid(value: string): value is WellnessDomain {
  return value === "skin" || value === "physical" || value === "mental";
}

export async function GET(_request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;

  if (!domainIsValid(domain)) {
    return Response.json({ error: "Unknown report domain." }, { status: 400 });
  }

  try {
    const user = await ensureDatabaseUser();

    const report =
      domain === "skin"
        ? await prisma.skinReport.findUnique({ where: { userId: user.id } })
        : domain === "physical"
          ? await prisma.physicalReport.findUnique({ where: { userId: user.id } })
          : await prisma.mentalReport.findUnique({ where: { userId: user.id } });

    return Response.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load report.";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;

  if (!domainIsValid(domain)) {
    return Response.json({ error: "Unknown report domain." }, { status: 400 });
  }

  try {
    const user = await ensureDatabaseUser();
    const body = await request.json();

    const report =
      domain === "skin"
        ? generateSkinReport(body)
        : domain === "physical"
          ? generatePhysicalReport(body)
          : generateMentalReport(body);

    const saved =
      domain === "skin"
        ? await prisma.skinReport.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              imageUrl: report.imageUrl,
              score: report.score,
              confidence: report.confidence,
              summary: report.summary,
              findings: report.findings,
              recommendations: report.recommendations,
              activities: report.activities,
              metrics: report.metrics,
              caution: report.caution,
            },
            update: {
              imageUrl: report.imageUrl,
              score: report.score,
              confidence: report.confidence,
              summary: report.summary,
              findings: report.findings,
              recommendations: report.recommendations,
              activities: report.activities,
              metrics: report.metrics,
              caution: report.caution,
            },
          })
        : domain === "physical"
          ? await prisma.physicalReport.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                imageUrl: report.imageUrl,
                score: report.score,
                confidence: report.confidence,
                summary: report.summary,
                findings: report.findings,
                recommendations: report.recommendations,
                activities: report.activities,
                metrics: report.metrics,
                caution: report.caution,
              },
              update: {
                imageUrl: report.imageUrl,
                score: report.score,
                confidence: report.confidence,
                summary: report.summary,
                findings: report.findings,
                recommendations: report.recommendations,
                activities: report.activities,
                metrics: report.metrics,
                caution: report.caution,
              },
            })
          : await prisma.mentalReport.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                score: report.score,
                confidence: report.confidence,
                summary: report.summary,
                findings: report.findings,
                recommendations: report.recommendations,
                activities: report.activities,
                metrics: report.metrics,
                caution: report.caution,
              },
              update: {
                score: report.score,
                confidence: report.confidence,
                summary: report.summary,
                findings: report.findings,
                recommendations: report.recommendations,
                activities: report.activities,
                metrics: report.metrics,
                caution: report.caution,
              },
            });

    return Response.json({ report, saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save report.";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
