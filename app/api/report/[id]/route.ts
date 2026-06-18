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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await checkAuth();
    const { id } = await params;

    const analysis = await prisma.analysis.findUnique({
      where: { id },
    });

    if (!analysis) {
      return Response.json({ success: false, error: "Analysis job not found" }, { status: 404 });
    }

    if (analysis.userId !== userId) {
      return Response.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    if (analysis.status === "FAILED") {
      return Response.json({
        success: true,
        status: "FAILED",
        error: analysis.error || "Analysis failed during processing.",
      });
    }

    if (analysis.status === "COMPLETED") {
      if (!analysis.resultId) {
        return Response.json({
          success: true,
          status: "PROCESSING",
          message: "Compiling report...",
        });
      }

      if (analysis.type === "skin") {
        const report = await prisma.skinReport.findUnique({
          where: { id: analysis.resultId },
        });
        return Response.json({
          success: true,
          status: "COMPLETED",
          type: "skin",
          report,
        });
      } else if (analysis.type === "fitness") {
        const report = await prisma.fitnessReport.findUnique({
          where: { id: analysis.resultId },
        });
        return Response.json({
          success: true,
          status: "COMPLETED",
          type: "fitness",
          report,
        });
      }
    }

    return Response.json({
      success: true,
      status: analysis.status,
      message: "Analysis is in progress.",
    });
  } catch (error: any) {
    console.error("Error in GET /api/report/[id]:", error);
    const message = error.message || "Internal Server Error";
    return Response.json({ success: false, error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
