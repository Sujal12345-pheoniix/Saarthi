"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Brain,
  FileText,
  LayoutDashboard,
  Menu,
  PersonStanding,
  ScanFace,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOut } from "@/components/auth/SignOut";
import { Logo } from "@/components/brand/Logo";
import { useViewer } from "./viewer";

const groups = [
  {
    label: "Overview",
    items: [{ name: "Home", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Analyses",
    items: [
      { name: "Skin", href: "/dashboard/skin", icon: ScanFace, color: "var(--skin)" },
      { name: "Posture & body", href: "/dashboard/physical", icon: PersonStanding, color: "var(--body)" },
      { name: "Mind check-in", href: "/dashboard/mental", icon: Brain, color: "var(--mind)" },
    ],
  },
  {
    label: "Insights",
    items: [
      { name: "Reports", href: "/dashboard/reports", icon: FileText },
      { name: "Companion", href: "/dashboard/ai", icon: Bot, badge: "Soon" },
    ],
  },
];

function Avatar() {
  const viewer = useViewer();
  const initial = (viewer?.name ?? "U").trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-aurora text-sm font-semibold text-white">
        {viewer?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewer.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{viewer?.name ?? (viewer ? "Your account" : "…")}</p>
        <p className="truncate text-xs text-ink-3">
          {viewer?.localMode ? "Local development mode" : (viewer?.email ?? "Signed in")}
        </p>
      </div>
    </div>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center px-6">
        <Link href="/" onClick={onNavigate} aria-label="Saarthi home">
          <Logo size={28} />
        </Link>
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-2">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-3">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
                const color = "color" in item ? item.color : undefined;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active ? "bg-surface font-medium text-ink shadow-soft" : "text-ink-2 hover:bg-surface/60 hover:text-ink"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-ink"
                        style={color ? { background: color } : undefined}
                      />
                    )}
                    <item.icon
                      className="h-[18px] w-[18px] transition"
                      style={active && color ? { color } : undefined}
                    />
                    <span className="flex-1">{item.name}</span>
                    {"badge" in item && item.badge && (
                      <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[0.65rem] font-medium text-ink-3">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1 px-4 pb-5 pt-3">
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
            pathname.startsWith("/dashboard/settings") ? "bg-surface font-medium text-ink shadow-soft" : "text-ink-2 hover:bg-surface/60 hover:text-ink"
          }`}
        >
          <Settings className="h-[18px] w-[18px]" />
          Settings &amp; privacy
        </Link>
        <SignOut />
        <div className="pt-3">
          <Avatar />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line bg-bg-elevated lg:block">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" aria-label="Dashboard home">
          <Logo size={26} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full p-2 text-ink hover:bg-surface-2"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key={`drawer-${pathname}`}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 w-[284px] border-r border-line bg-bg-elevated shadow-float lg:hidden"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-6 rounded-full p-2 text-ink-2 hover:bg-surface-2"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
              <NavContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
