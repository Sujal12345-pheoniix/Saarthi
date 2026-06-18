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
        type: "skin",
        status: "QUEUED",
        imageUrl,
      },
    });

    // 2. Enqueue BullMQ job
    await enqueueAnalysis("skin", {
      userId: user.id,
      analysisId: analysis.id,
      imageUrl,
      questionnaire,
    });

    return Response.json({
      success: true,
      analysisId: analysis.id,
      status: analysis.status,
      message: "Skin analysis successfully queued",
    });
  } catch (error: any) {
    console.error("Error in /api/analyze-skin:", error);
    const message = error.message || "Internal Server Error";
    return Response.json({ success: false, error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
