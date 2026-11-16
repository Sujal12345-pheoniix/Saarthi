/**
 * Whether Clerk is configured for this build. NEXT_PUBLIC_* values are inlined at build time, so this is a
 * constant on both server and client. When false, the app renders without Clerk: local development uses the
 * DEV_ALLOW_ANON bypass, and any other environment answers 401 on every API route (fail closed).
 */
export const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
