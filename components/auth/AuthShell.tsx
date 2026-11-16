import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/button";
import { CLERK_ENABLED } from "@/lib/auth/clerk-config";

/** Split-screen frame for the Clerk sign-in / sign-up widgets. */
export function AuthShell({ title, subtitle, children }: { title: ReactNode; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0f0d16] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-32 top-1/4 h-[480px] w-[480px] animate-aurora rounded-full bg-[#7c6cf6]/35 blur-[110px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-[380px] w-[380px] rounded-full bg-[#e14f7a]/25 blur-[110px]" />
        <Link href="/" className="relative [--ink:#fff]">
          <Logo size={30} />
        </Link>
        <div className="relative mt-auto max-w-md">
          <h1 className="font-display text-5xl leading-[1.05]">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-white/60">{subtitle}</p>
          <div className="mt-10 flex gap-6 text-sm text-white/50">
            <span>Private photos</span>
            <span>No diagnoses</span>
            <span>Delete anytime</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-5 py-12">
        <Link href="/" className="mb-10 lg:hidden">
          <Logo size={30} />
        </Link>
        {CLERK_ENABLED ? (
          children
        ) : (
          <div className="card max-w-sm p-8 text-center">
            <p className="font-display text-3xl text-ink">Sign-in isn&apos;t configured</p>
            <p className="mt-3 text-sm leading-6 text-ink-2">
              This server has no authentication provider keys. In local development, the dashboard opens directly in
              development mode.
            </p>
            <ButtonLink href="/dashboard" className="mt-6">
              Open dashboard
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
