import { withAuth } from "@/lib/api/handler";
import { getEnv } from "@/lib/config/env";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/** GET /api/me — display profile of the signed-in user (name, avatar). Never includes other users' data. */
export const GET = withAuth({ rateLimit: RATE_LIMITS.read }, async ({ user }) => {
  const row = await getPrisma().user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, imageUrl: true, createdAt: true },
  });
  return {
    name: row.name,
    email: row.email,
    imageUrl: row.imageUrl,
    memberSince: row.createdAt.toISOString(),
    localMode: getEnv().devAuthBypass,
    features: {
      /** Combined AI synthesis needs a language-model provider configured on the server. */
      aiSynthesis: getEnv().llm.provider !== "none",
    },
  };
});
