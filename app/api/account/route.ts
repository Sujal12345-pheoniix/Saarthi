import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { readJson } from "@/lib/api/body";
import { withAuth } from "@/lib/api/handler";
import { getEnv } from "@/lib/config/env";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { deleteAccountData } from "@/server/services/account";

export const runtime = "nodejs";

const confirmSchema = z.object({ confirm: z.literal("DELETE MY ACCOUNT") }).strict();

/**
 * DELETE /api/account  { confirm: "DELETE MY ACCOUNT" }
 * Deletes stored images, all Saarthi data, then the Clerk identity.
 */
export const DELETE = withAuth({ rateLimit: RATE_LIMITS.accountDelete }, async ({ req, user, requestId, log }) => {
  await readJson(req, confirmSchema);
  const result = await deleteAccountData(getPrisma(), user.id, requestId, log);

  let identityDeleted = false;
  if (!getEnv().devAuthBypass) {
    try {
      const client = await clerkClient();
      await client.users.deleteUser(user.clerkId);
      identityDeleted = true;
    } catch (error) {
      // Data is already gone; report honestly that the sign-in identity still exists.
      log.error("account.delete.identity_failed", { error });
    }
  }
  return { ...result, identityDeleted };
});
