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

    const history = await prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      success: true,
      history,
    });
  } catch (error: any) {
    console.error("Error in GET /api/history:", error);
    const message = error.message || "Internal Server Error";
    return Response.json({ success: false, error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
