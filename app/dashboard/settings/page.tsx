"use client";

import { motion } from "framer-motion";
import { Database, Download, ImageIcon, ShieldCheck, CloudCog } from "lucide-react";

const settings = [
  {
    title: "Your data",
    icon: Database,
    description: "Reports are stored in a PostgreSQL database and are only ever queried for your own account.",
  },
  {
    title: "Photos",
    icon: ImageIcon,
    description:
      "Photos are verified on upload and stored privately. They are only viewable through short-lived signed links.",
  },
  {
    title: "Security",
    icon: ShieldCheck,
    description:
      "Every page and API request is authenticated with your Clerk session. Other users can never see your data.",
  },
  {
    title: "How results are produced",
    icon: CloudCog,
    description:
      "Each report states its method: computer vision on your photo, a rule-based estimate from your answers, or an AI-written synthesis.",
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-[2rem] border border-white/25 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
        >
          <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">Settings and privacy.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            How Saarthi stores and protects your information.
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
            <Download className="h-5 w-5 text-emerald-500" /> Download your data
          </div>
          <p className="mt-2">Export everything Saarthi stores about you as a JSON file.</p>
          <a
            href="/api/account/export"
            download="saarthi-export.json"
            className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            Export my data
          </a>
        </div>
      </div>
    </div>
  );
}
