import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  generateMentalReport,
  generatePhysicalReport,
  generateSkinReport,
  type WellnessDomain,
} from "@/lib/wellness-report";

export const runtime = "nodejs";

type ReportResponse =
  | ReturnType<typeof generateSkinReport>
  | ReturnType<typeof generatePhysicalReport>
  | ReturnType<typeof generateMentalReport>;

type SkinAnalysisRecord = {
  acneScore: number;
  confidence: number;
  drynessScore: number;
  oilinessScore: number;
  pigmentationScore: number;
  aiSummary: string | null;
  recommendations: unknown;
  imageUrl: string | null;
};

type PhysicalAnalysisRecord = {
  fitnessScore: number;
  bmi: number | null;
  hydration: number;
  sleepHours: number;
  activityLevel: string | null;
  aiSummary: string | null;
  recommendations: unknown;
};

type MentalAnalysisRecord = {
  moodScore: number;
  stressLevel: number;
  anxietyLevel: number;
  burnoutRisk: number;
  sleepScore: number;
  aiSummary: string | null;
  recommendations: unknown;
};

type DatabaseUser = {
  id: string;
  clerkId: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toStringArray(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return fallback;
}

function buildSkinReport(record: SkinAnalysisRecord): ReturnType<typeof generateSkinReport> {
  const score = toNumber(record?.acneScore, 0);
  const confidence = toNumber(record?.confidence, 0);
  const drynessScore = toNumber(record?.drynessScore, 0);
  const oilinessScore = toNumber(record?.oilinessScore, 0);
  const pigmentationScore = toNumber(record?.pigmentationScore, 0);
  const recommendations = toStringArray(record?.recommendations);

  return {
    domain: "skin",
    title: "Dermatology-style Skin Report",
    subtitle: "Latest skin scan and barrier snapshot",
    score,
    confidence,
    summary: record?.aiSummary || "No skin summary saved yet.",
    findings: [
      `Skin score: ${score}%`,
      `Dryness score: ${drynessScore}%`,
      `Oiliness score: ${oilinessScore}%`,
      `Pigmentation score: ${pigmentationScore}%`,
    ],
    recommendations: recommendations.length
      ? recommendations
      : ["Keep your cleanser gentle, maintain daily SPF, and support hydration consistently."],
    activities: [
      "Apply a gentle cleanser, moisturizer, and SPF in the morning.",
      "Track any irritation for the next 7 days to spot triggers.",
      "Drink one extra glass of water before your first meal.",
    ],
    metrics: [
      { label: "Skin score", value: `${score}%`, detail: "Higher means a calmer barrier" },
      { label: "Confidence", value: `${confidence}%`, detail: "How certain the latest scan is" },
      { label: "Dryness", value: `${drynessScore}%`, detail: "Lower usually means better hydration" },
      { label: "Oiliness", value: `${oilinessScore}%`, detail: "Balance matters more than zero" },
    ],
    caution:
      "This report is supportive guidance, not a diagnosis. If you have persistent rash, acne flare-ups, pain, or pigment changes, a board-certified dermatologist should assess it.",
    imageUrl: record?.imageUrl ?? null,
  };
}

function buildPhysicalReport(record: PhysicalAnalysisRecord): ReturnType<typeof generatePhysicalReport> {
  const score = toNumber(record?.fitnessScore, 0);
  const bmi = record?.bmi != null ? toNumber(record?.bmi, 0) : undefined;
  const hydration = toNumber(record?.hydration, 0);
  const sleepHours = toNumber(record?.sleepHours, 0);
  const confidence = bmi != null ? Math.min(98, 72 + score / 2) : Math.min(95, 70 + score / 3);
  const recommendations = toStringArray(record?.recommendations);

  return {
    domain: "physical",
    title: "Physical Performance Report",
    subtitle: "Latest recovery, training, and nutrition snapshot",
    score,
    confidence,
    summary: record?.aiSummary || "No physical summary saved yet.",
    findings: [
      bmi != null ? `BMI estimate: ${bmi.toFixed(1)}.` : "BMI was not saved for this entry.",
      `Hydration: ${hydration}%.`,
      `Sleep: ${sleepHours.toFixed(1)} hours.`,
      `Activity level: ${record?.activityLevel || "not recorded"}.`,
    ],
    recommendations: recommendations.length
      ? recommendations
      : ["Keep protein steady, train consistently, and protect recovery sleep."],
    activities: [
      "Do a 10-minute warm-up before training.",
      "Take a short walk after your largest meal.",
      "Finish the day with a gentle stretch or mobility reset.",
    ],
    metrics: [
      { label: "Physical score", value: `${score}%`, detail: "Higher reflects stronger habits" },
      { label: "Hydration", value: `${hydration}`, detail: "Track this daily for consistency" },
      { label: "Sleep", value: `${sleepHours.toFixed(1)}h`, detail: "Recovery is a main performance driver" },
      { label: "BMI", value: bmi != null ? bmi.toFixed(1) : "--", detail: "Optional and useful for context" },
    ],
    caution:
      "This is a wellness plan, not medical advice. If you have pain, dizziness, extreme fatigue, or rapid weight changes, get a licensed clinician involved.",
    imageUrl: null,
  };
}

function buildMentalReport(record: MentalAnalysisRecord): ReturnType<typeof generateMentalReport> {
  const score = toNumber(record?.moodScore, 0);
  const stressLevel = toNumber(record?.stressLevel, 0);
  const anxietyLevel = toNumber(record?.anxietyLevel, 0);
  const burnoutRisk = toNumber(record?.burnoutRisk, 0);
  const sleepHours = toNumber(record?.sleepScore, 0) > 0 ? toNumber(record?.sleepScore, 0) / 12 : 0;
  const recommendations = toStringArray(record?.recommendations);

  return {
    domain: "mental",
    title: "Psychology-style Mental Health Report",
    subtitle: "Latest mood, stress, and recovery snapshot",
    score,
    confidence: Math.min(98, 72 + score / 2),
    summary: record?.aiSummary || "No mental summary saved yet.",
    findings: [
      `Mood score: ${score}%`,
      `Stress level: ${stressLevel}%`,
      `Anxiety level: ${anxietyLevel}%`,
      `Burnout risk: ${burnoutRisk}%`,
    ],
    recommendations: recommendations.length
      ? recommendations
      : ["Protect sleep, reduce stimulation, and keep your day structured."],
    activities: [
      "Take a five-minute breathing break before switching tasks.",
      "Write one sentence about what you can control right now.",
      "Step away from screens for a short walk or stretch pause.",
    ],
    metrics: [
      { label: "Mood", value: `${score}%`, detail: "Higher means more steady regulation" },
      { label: "Stress", value: `${stressLevel}%`, detail: "Lower through structure and breaks" },
      { label: "Anxiety", value: `${anxietyLevel}%`, detail: "Use grounding when this climbs" },
      { label: "Sleep", value: `${sleepHours.toFixed(1)}h`, detail: "Sleep strongly affects regulation" },
    ],
    caution:
      "This is supportive coaching, not a diagnosis. If you feel unsafe or think about self-harm, contact local emergency services or a crisis hotline immediately.",
  };
}

async function ensureDatabaseUser(): Promise<DatabaseUser> {
  // Local dev helper: allow anonymous access when explicitly enabled.
  if (process.env.DEV_ALLOW_ANON === "true") {
    // Return a lightweight in-memory user object for local testing so we
    // don't touch the database or construct Prisma at all.
    return {
      id: "dev_local_id",
      clerkId: "dev_local_user",
      email: process.env.DEV_EMAIL ?? "dev@localhost",
      name: "Dev Local",
      imageUrl: null,
    };
  }

  const { userId } = await auth();

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

async function loadLatestReport(domain: WellnessDomain, userId: string): Promise<ReportResponse | null> {
  if (domain === "skin") {
    const record = await prisma.skinAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return record ? buildSkinReport(record) : null;
  }

  if (domain === "physical") {
    const record = await prisma.physicalHealthAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return record ? buildPhysicalReport(record) : null;
  }

  const record = await prisma.mentalHealthAnalysis.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return record ? buildMentalReport(record) : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;

  if (!domainIsValid(domain)) {
    return Response.json({ error: "Unknown report domain." }, { status: 400 });
  }

  try {
    const user = await ensureDatabaseUser();

    const report = await loadLatestReport(domain, user.id);

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

    // In local dev smoke-test mode, skip database persistence so the
    // report can be generated without a working Prisma client.
    if (process.env.DEV_ALLOW_ANON === "true") {
      return Response.json({ report, saved: null });
    }

    const saved =
      domain === "skin"
        ? await prisma.skinAnalysis.create({
            data: {
              userId: user.id,
              imageUrl: report.imageUrl ?? null,
              acneScore: report.score,
              drynessScore: Math.max(0, 100 - Number(body.hydration ?? 50)),
              oilinessScore: Math.max(0, Math.min(100, Number(body.sunExposure ?? 0) * 10)),
              pigmentationScore: Math.max(0, Math.min(100, (Array.isArray(body.concerns) ? body.concerns.length : 0) * 15)),
              confidence: report.confidence,
              aiSummary: report.summary,
              recommendations: report.recommendations,
            },
          })
        : domain === "physical"
          ? await prisma.physicalHealthAnalysis.create({
              data: {
                userId: user.id,
                bmi: body.heightCm && body.weightKg ? Number(body.weightKg) / Math.pow(Number(body.heightCm) / 100, 2) : null,
                hydration: Math.round(Number(body.waterLiters ?? 0) * 40),
                fitnessScore: report.score,
                activityLevel: String(body.goal ?? body.activityLevel ?? "moderate"),
                sleepHours: Number(body.sleepHours ?? 0),
                aiSummary: report.summary,
                recommendations: report.recommendations,
              },
            })
          : await prisma.mentalHealthAnalysis.create({
              data: {
                userId: user.id,
                stressLevel: Number(body.stress ?? 0),
                anxietyLevel: Math.max(0, Math.min(100, Number(body.stress ?? 0) + (5 - Number(body.mood ?? 3)) * 10)),
                moodScore: report.score,
                sleepScore: Math.max(0, Math.min(100, Math.round(Number(body.sleepHours ?? 0) * 12))),
                burnoutRisk: Math.max(0, Math.min(100, Number(body.stress ?? 0) + (Number(body.energy ?? 3) <= 2 ? 15 : 0))),
                aiSummary: report.summary,
                recommendations: report.recommendations,
              },
            })

    return Response.json({ report, saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save report.";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
