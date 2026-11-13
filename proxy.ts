import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Next.js 16 "proxy" (formerly middleware).
 *
 * - Dashboard pages require a signed-in user (redirects to sign-in).
 * - API routes are NOT redirected here: each handler authenticates itself via `withAuth`
 *   (lib/api/handler.ts) and returns a JSON 401. Clerk still runs on API routes so `auth()` works.
 */
const isProtectedPage = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedPage(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
