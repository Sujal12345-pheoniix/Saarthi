"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/button";
import { CLERK_ENABLED } from "@/lib/auth/clerk-config";

const links = [
  { href: "#pillars", label: "What it does" },
  { href: "#honest", label: "How it measures" },
  { href: "#how", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const start = CLERK_ENABLED ? "/sign-up" : "/dashboard";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6">
      <div
        className={`mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full px-4 transition-all duration-300 sm:px-5 ${
          scrolled
            ? "border border-line bg-surface/75 shadow-[var(--shadow-md)] backdrop-blur-xl"
            : "border border-transparent"
        }`}
      >
        <Link href="/" aria-label="Saarthi home">
          <Logo size={30} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm text-ink-2 transition hover:bg-surface-2 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {CLERK_ENABLED && (
            <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm text-ink-2 transition hover:text-ink">
              Sign in
            </Link>
          )}
          <ButtonLink href={start} size="sm" className="px-4">
            {CLERK_ENABLED ? "Get started" : "Open dashboard"}
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-2 text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-2 max-w-6xl rounded-3xl border border-line bg-surface/95 p-3 shadow-[var(--shadow-lg)] backdrop-blur-xl md:hidden"
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-line p-2 pt-4">
              {CLERK_ENABLED && (
                <ButtonLink href="/sign-in" variant="secondary" className="flex-1">
                  Sign in
                </ButtonLink>
              )}
              <ButtonLink href={start} className="flex-1">
                {CLERK_ENABLED ? "Get started" : "Open dashboard"}
              </ButtonLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
