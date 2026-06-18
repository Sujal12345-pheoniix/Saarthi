import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { enqueueAnalysis } from "@/lib/queue/reportQueue";

export const runtime = "nodejs";

async function ensureDatabaseUser() {
  if (process.env.DEV_ALLOW_ANON === "true") {
    // Upsert the dev user to make sure they exist in the DB
    return await prisma.user.upsert({
      where: { clerkId: "dev_local_user" },
      create: {
        id: "dev_local_id",
        clerkId: "dev_local_user",
        email: "dev@localhost",
        name: "Dev Local",
      },
      update: {},
    });
  }

  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const profile = await currentUser();
  return await prisma.user.upsert({
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

export async function POST(request: Request) {
  try {
    const user = await ensureDatabaseUser();
    const body = await request.json();
    const { imageUrl, questionnaire } = body;

    if (!imageUrl) {
      return Response.json({ success: false, error: "Image URL is required" }, { status: 400 });
    }

    // 1. Create Analysis record in database
    const analysis = await prisma.analysis.create({
      data: {
        userId: user.id,
        type: "fitness",
        status: "QUEUED",
        imageUrl,
      },
    });

    try {
      // 2. Try to enqueue BullMQ job
      await enqueueAnalysis("fitness", {
        userId: user.id,
        analysisId: analysis.id,
        imageUrl,
        questionnaire,
      });

      return Response.json({
        success: true,
        analysisId: analysis.id,
        status: analysis.status,
        message: "Fitness analysis successfully queued",
      });
    } catch (queueError: any) {
      console.warn("[api/analyze-fitness] Redis queue is offline (ECONNREFUSED). Running direct analysis fallback.");
      
      // Update status to PROCESSING
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { status: "PROCESSING" },
      });

      // Execute direct sync analysis
      const { runDirectAnalysis } = await import("@/lib/ai/directAnalyzer");
      const reportId = await runDirectAnalysis("fitness", user.id, imageUrl, questionnaire);

      // Update status to COMPLETED
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          status: "COMPLETED",
          resultId: reportId,
        },
      });

      return Response.json({
        success: true,
        analysisId: analysis.id,
        status: "COMPLETED",
        message: "Fitness analysis completed synchronously",
      });
    }
  } catch (error: any) {
    console.error("Error in /api/analyze-fitness:", error);
    const message = error.message || "Internal Server Error";
    return Response.json({ success: false, error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
