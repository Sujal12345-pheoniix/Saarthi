"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { CLERK_ENABLED } from "@/lib/auth/clerk-config";

const cls =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-2 transition hover:bg-surface-2 hover:text-ink";

/** Clerk sign-out when Clerk is configured; nothing to sign out of in local development mode. */
export function SignOut() {
  if (!CLERK_ENABLED) return null;
  return (
    <SignOutButton redirectUrl="/">
      <button type="button" className={cls}>
        <LogOut className="h-[18px] w-[18px]" />
        Sign out
      </button>
    </SignOutButton>
  );
}
