import { auth, currentUser } from "@clerk/nextjs/server";
import type { UserRole } from "@prisma/client";
import { Errors } from "@/lib/api/errors";
import { getEnv } from "@/lib/config/env";
import { getPrisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging/logger";

/**
 * The only way route handlers obtain the current user.
 *
 * - Identity comes exclusively from Clerk's verified session (server-side). Client-supplied ids are ignored.
 * - The Clerk subject is mapped to the internal `User.id`, which is what every query is scoped by.
 * - The development bypass (DEV_ALLOW_ANON) is honoured only when NODE_ENV and APP_ENV are both
 *   "development"; configuration validation additionally refuses to start otherwise.
 */

export interface SessionUser {
  id: string;
  clerkId: string;
  role: UserRole;
}

export const DEV_CLERK_ID = "dev_local_user";

async function devUser(): Promise<SessionUser> {
  const user = await getPrisma().user.upsert({
    where: { clerkId: DEV_CLERK_ID },
    create: { clerkId: DEV_CLERK_ID, email: null, name: "Local Developer" },
    update: {},
    select: { id: true, clerkId: true, role: true },
  });
  return user;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const env = getEnv();
  if (env.devAuthBypass) {
    logger.warn("auth.dev_bypass_active");
    return devUser();
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, clerkId: true, role: true },
  });
  if (existing) return existing;

  // First request for this identity: fetch the profile once and create the internal user.
  // currentUser() calls Clerk's Backend API, so it is deliberately not called on every request.
  const profile = await currentUser();
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || null;
  return prisma.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      email: profile?.primaryEmailAddress?.emailAddress ?? profile?.emailAddresses?.[0]?.emailAddress ?? null,
      name,
      imageUrl: profile?.imageUrl ?? null,
    },
    update: {},
    select: { id: true, clerkId: true, role: true },
  });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw Errors.unauthenticated();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw Errors.forbidden();
  return user;
}
