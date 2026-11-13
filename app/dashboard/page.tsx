"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Flame, Activity, Brain, HeartPulse, ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { apiRequest } from "@/lib/api/client";
import type { DashboardSummary } from "@/server/services/dashboard";

const DOMAIN_COLORS = { SKIN: "#f43f5e", PHYSICAL: "#0ea5e9", MENTAL: "#6366f1" } as const;
const DOMAIN_LABEL = { SKIN: "Skin", PHYSICAL: "Physical", MENTAL: "Mental" } as const;

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardOverview() {
  const { user } = useUser();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    apiRequest<DashboardSummary>("/api/dashboard/summary")
      .then(setSummary)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load your dashboard."));
  }, []);

  const metrics = [
    {
      title: "Overall Wellness",
      value: summary?.combined?.score != null ? `${summary.combined.score}%` : "--",
      icon: Activity,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      title: "Skin",
      value: summary?.skin ? `${summary.skin.score}%` : "--",
      icon: HeartPulse,
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-500/10",
    },
    {
      title: "Mental",
      value: summary?.mental ? `${summary.mental.score}%` : "--",
      icon: Brain,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-500/10",
    },
    {
      title: "Active Streak",
      value: summary ? `${summary.activeStreakDays} ${summary.activeStreakDays === 1 ? "Day" : "Days"}` : "--",
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-500/10",
    },
  ];

  // One row per day; each domain's latest value that day.
  const chartData = useMemo(() => {
    const byDay = new Map<string, Record<string, number | string>>();
    for (const p of summary?.progress ?? []) {
      const day = p.recordedAt.slice(0, 10);
      const row = byDay.get(day) ?? { day };
      row[p.domain] = Math.round(p.value);
      byDay.set(day, row);
    }
    return [...byDay.values()];
  }, [summary]);

  const domainsWithData = (["SKIN", "PHYSICAL", "MENTAL"] as const).filter((d) =>
    summary?.progress.some((p) => p.domain === d),
  );
  const hasAnyReport = Boolean(summary?.skin || summary?.physical || summary?.mental);

  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {greeting()}, {user?.firstName || "Explorer"}! 👋
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Here is your wellness summary, built only from the reports you have created.
        </p>
        {loadError && <p className="mt-3 text-sm text-rose-600">{loadError}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {metrics.map((metric, idx) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass p-6 rounded-3xl flex items-center gap-4"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${metric.bg}`}>
              <metric.icon className={`w-7 h-7 ${metric.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{metric.title}</p>
              <h3 className="text-2xl font-bold text-foreground">{metric.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass p-8 rounded-3xl"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-foreground">Wellness Progress</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">Last 90 days</span>
          </div>
          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
                <p className="font-medium">No progress data yet.</p>
                <p className="mt-1 text-sm">Create a skin, physical or mental report to start your trend line.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} dy={10} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} dx={-10} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend />
                  {domainsWithData.map((d) => (
                    <Line
                      key={d}
                      type="monotone"
                      dataKey={d}
                      name={DOMAIN_LABEL[d]}
                      stroke={DOMAIN_COLORS[d]}
                      strokeWidth={3}
                      connectNulls
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="glass p-8 rounded-3xl flex flex-col"
        >
          <h2 className="text-xl font-bold text-foreground mb-6">Next step</h2>
          <div className="bg-gradient-to-br from-primary-500 to-teal-400 p-6 rounded-2xl text-white flex-1 flex flex-col justify-between">
            <div>
              <FileText className="w-8 h-8 mb-4 opacity-80" />
              <p className="text-lg font-medium leading-relaxed mb-6">
                {hasAnyReport
                  ? "Compile a combined report to see how your skin, physical and mental results relate."
                  : "Start with a quick check-in — a mental wellness check takes under a minute."}
              </p>
            </div>
            <Link
              href={hasAnyReport ? "/dashboard/reports" : "/dashboard/mental"}
              className="inline-flex items-center text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              {hasAnyReport ? "Open reports" : "Start a check-in"} <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
