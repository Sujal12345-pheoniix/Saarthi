"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  HeartPulse, 
  Brain, 
  Activity, 
  FileText, 
  Bot, 
  Settings,
  LogOut,
  Sparkles
} from "lucide-react";
import { SignOutButton, useUser } from "@clerk/nextjs";

const navItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Skin Analysis", href: "/dashboard/skin", icon: HeartPulse },
  { name: "Mental Health", href: "/dashboard/mental", icon: Brain },
  { name: "Physical Health", href: "/dashboard/physical", icon: Activity },
  { name: "Reports", href: "/dashboard/reports", icon: FileText },
  { name: "AI Recommendations", href: "/dashboard/ai", icon: Bot },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <aside className="w-64 h-screen border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col fixed left-0 top-0">
      <div className="h-20 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-teal-400 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Saarthi</span>
        </Link>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary-100 text-primary-600 font-bold">
                {user?.firstName?.charAt(0) || "U"}
              </div>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{user?.firstName || "User"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Wellness Explorer</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  isActive 
                    ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary-600 dark:text-primary-400" : ""}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-200 dark:border-slate-800">
        <SignOutButton>
          <button className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </SignOutButton>
      </div>
    </aside>
  );
}
