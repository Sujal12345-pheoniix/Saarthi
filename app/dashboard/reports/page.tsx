"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, FileText, HeartPulse, Brain, Activity, Sparkles } from "lucide-react";

type ReportSummary = {
  title: string;
  score: number;
  summary: string;
};

const reportCards = [
  {
    title: "Skin report",
    href: "/dashboard/skin",
    icon: HeartPulse,
    accent: "from-emerald-500 to-cyan-400",
    description: "Dermatologist-style scan with hydration, barrier, and UV guidance.",
  },
  {
    title: "Physical report",
    href: "/dashboard/physical",
    icon: Activity,
    accent: "from-sky-500 to-emerald-400",
    description: "Diet analysis, workout schedule, recovery, and image tracking.",
  },
  {
    title: "Mental report",
    href: "/dashboard/mental",
    icon: Brain,
    accent: "from-indigo-500 to-sky-400",
    description: "Psychology-style mood support, stress relief, and grounding.",
  },
];

export default function ReportsPage() {
  const [skin, setSkin] = useState<ReportSummary | null>(null);
  const [physical, setPhysical] = useState<ReportSummary | null>(null);
  const [mental, setMental] = useState<ReportSummary | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/skin").then((response) => response.json()),
      fetch("/api/reports/physical").then((response) => response.json()),
      fetch("/api/reports/mental").then((response) => response.json()),
    ])
      .then(([skinData, physicalData, mentalData]) => {
        setSkin(skinData?.report ?? null);
        setPhysical(physicalData?.report ?? null);
        setMental(mentalData?.report ?? null);
      })
      .catch(() => undefined);
  }, []);

  const summaries = [
    { label: "Skin", data: skin },
    { label: "Physical", data: physical },
    { label: "Mental", data: mental },
  ];

  return (
    <div className="min-h-screen px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[2rem] border border-white/25 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:bg-white/10 dark:text-slate-300">
            <FileText className="h-3.5 w-3.5" /> Reports hub
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 dark:text-white">All wellness reports in one place.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Switch between the skin, physical, and mental reports, or open each module to generate a new scan and save it to Neon.
          </p>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-3">
          {reportCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="group rounded-[2rem] border border-white/25 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-slate-950/40"
              >
                <div className={`inline-flex rounded-2xl bg-gradient-to-br ${card.accent} p-4 text-white shadow-lg shadow-slate-950/10`}>
                  <Icon className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-slate-950 dark:text-white">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.description}</p>
                <Link href={card.href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition group-hover:gap-3 dark:text-white">
                  Open module <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {summaries.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.06 }}
              className="rounded-[2rem] border border-white/25 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:bg-slate-950/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">{item.label}</h3>
                <Sparkles className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="mt-4 text-4xl font-black text-slate-950 dark:text-white">{item.data?.score ?? "--"}%</div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {item.data?.summary ?? "No report saved yet. Open the module and generate one."}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
