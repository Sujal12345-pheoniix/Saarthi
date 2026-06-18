import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function checkAuth() {
  if (process.env.DEV_ALLOW_ANON === "true") {
    return "dev_local_id";
  }
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });
  if (!user) {
    throw new Error("User not found");
  }
  return user.id;
}

export async function GET() {
  try {
    const userId = await checkAuth();

    const progress = await prisma.progressHistory.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    });

    // Group progress by type
    const skinProgress = progress.filter((p) => p.metricType === "skin");
    const fitnessProgress = progress.filter((p) => p.metricType === "fitness");

    return Response.json({
      success: true,
      skinProgress,
      fitnessProgress,
    });
  } catch (error: any) {
    console.error("Error in GET /api/progress:", error);
    const message = error.message || "Internal Server Error";
    return Response.json({ success: false, error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
