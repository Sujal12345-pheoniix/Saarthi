"use client";

import { motion } from "framer-motion";
import { CheckCircle2, CloudCog, Database, ImageIcon, ShieldCheck } from "lucide-react";

const settings = [
  {
    title: "Database",
    icon: Database,
    description: "Neon + Prisma is now the primary store for user reports and summaries.",
  },
  {
    title: "Image storage",
    icon: ImageIcon,
    description: "Cloudinary handles progress photos and scan images through the upload route.",
  },
  {
    title: "Security",
    icon: ShieldCheck,
    description: "Clerk protects the dashboard and report APIs behind signed-in access.",
  },
  {
    title: "Automation",
    icon: CloudCog,
    description: "Reports are saved per user, so new scans update the latest analysis instead of fragmenting history.",
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[2rem] border border-white/25 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">Settings and integrations.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            The core integrations are now aligned with the requested stack: Prisma for Neon, Cloudinary for image uploads, and Clerk for access control.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2">
          {settings.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-[2rem] border border-white/25 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:bg-slate-950/40"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-950 p-3 text-white dark:bg-white dark:text-slate-950">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">{item.title}</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-6 text-sm leading-7 text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Quick checklist
          </div>
          <p className="mt-2">
            Confirm the Neon connection string in <span className="font-semibold">DATABASE_URL</span>, keep the Cloudinary credentials in .env, and run the Prisma migration before shipping this stack.
          </p>
        </div>
      </div>
    </div>
  );
}
