import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/**
 * Next.js 16 "proxy" (formerly middleware).
 *
 * - Dashboard pages require a signed-in user (redirects to sign-in).
 * - API routes are NOT redirected here: each handler authenticates itself via `withAuth`
 *   (lib/api/handler.ts) and returns a JSON 401. Clerk still runs on API routes so `auth()` works.
 * - Without Clerk keys, only local development with DEV_ALLOW_ANON may open the dashboard; everywhere else the
 *   dashboard redirects to /sign-in, which explains that sign-in is unavailable.
 */
const isProtectedPage = createRouteMatcher(["/dashboard(.*)"]);

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
const localDevBypass =
  process.env.NODE_ENV === "development" &&
  (process.env.APP_ENV ?? "development") === "development" &&
  process.env.DEV_ALLOW_ANON === "true";

const withClerk = clerkMiddleware(async (auth, req) => {
  if (isProtectedPage(req)) {
    await auth.protect();
  }
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (clerkConfigured) return withClerk(req, event);
  if (isProtectedPage(req) && !localDevBypass) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
