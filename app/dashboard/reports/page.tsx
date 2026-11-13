"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, FileText, HeartPulse, Brain, Activity, Sparkles, Loader2, AlertTriangle, CheckSquare } from "lucide-react";
import type { CombinedReportView, ReportView } from "@/features/reports/view-model";
import { apiRequest, newIdempotencyKey, pollAnalysis } from "@/lib/api/client";

type ReportSummary = Pick<ReportView, "title" | "score" | "summary" | "methodLabel">;
type CombinedReport = CombinedReportView;

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
  const [combined, setCombined] = useState<CombinedReport | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState("");

  const [compileError, setCompileError] = useState("");

  const fetchLatestData = () => {
    Promise.all([
      apiRequest<{ report: ReportSummary | null }>("/api/reports/skin"),
      apiRequest<{ report: ReportSummary | null }>("/api/reports/physical"),
      apiRequest<{ report: ReportSummary | null }>("/api/reports/mental"),
      apiRequest<{ report: CombinedReport | null }>("/api/report/latest"),
    ])
      .then(([skinData, physicalData, mentalData, latestCombined]) => {
        setSkin(skinData.report);
        setPhysical(physicalData.report);
        setMental(mentalData.report);
        setCombined(latestCombined.report);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    fetchLatestData();
  }, []);

  const STATUS_TEXT: Record<string, string> = {
    QUEUED: "Waiting in queue...",
    PROCESSING: "AI is writing your synthesis...",
  };

  const handleCompileReport = async () => {
    setIsCompiling(true);
    setCompileError("");
    setCompileStatus("Queuing synthesis...");
    try {
      const queued = await apiRequest<{ analysisId: string; status: string }>("/api/report/generate", {
        method: "POST",
        json: { idempotencyKey: newIdempotencyKey() },
      });
      const report = await pollAnalysis<CombinedReport>(queued.analysisId, (status) => setCompileStatus(STATUS_TEXT[status] ?? status), {
        intervalMs: 2000,
      });
      setCombined(report);
    } catch (e) {
      setCompileError(e instanceof Error ? e.message : "Failed to compile report.");
    } finally {
      setIsCompiling(false);
    }
  };

  const getArray = (val: unknown): string[] => (Array.isArray(val) ? val.filter((v): v is string => typeof v === "string") : []);

  const parsedRisks = getArray(combined?.risks);
  const parsedActionPlan = getArray(combined?.actionPlan);
  const summaries = [
    { label: "Skin", data: skin },
    { label: "Physical", data: physical },
    { label: "Mental", data: mental },
  ];

  return (
    <div className="min-h-screen px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="glass rounded-[2rem] border border-white/25 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:bg-white/10 dark:text-slate-300">
            <FileText className="h-3.5 w-3.5" /> Reports hub
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 dark:text-white">All wellness reports in one place.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Switch between the skin, physical, and mental reports, or compile a comprehensive holistic wellness overview.
          </p>
        </motion.div>

        {/* Comprehensive Wellness Report Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass overflow-hidden rounded-[2.5rem] border border-white/30 bg-gradient-to-br from-white/90 to-white/40 p-8 shadow-[0_32px_96px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:from-slate-950/80 dark:to-slate-950/20"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-4.5 w-4.5 animate-pulse" /> Comprehensive AI Synthesis
              </div>
              <h2 className="text-3xl font-black text-slate-950 dark:text-white">Holistic Wellness Report</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Correlates data from all modules to generate target recommendations and risk alerts.
              </p>
            </div>
            
            <button
              onClick={handleCompileReport}
              disabled={isCompiling}
              className="relative inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-slate-950"
            >
              {isCompiling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{compileStatus}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span>Compile AI Report</span>
                </>
              )}
            </button>
          </div>

          {compileError && (
            <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
              {compileError}
            </div>
          )}

          <AnimatePresence mode="wait">
            {combined ? (
              <motion.div
                key="report-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.8fr]"
              >
                {/* Left metrics column */}
                <div className="space-y-6">
                  <div className="rounded-3xl bg-slate-100/50 p-6 text-center dark:bg-slate-900/30">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overall Health Score</span>
                    <div className="mt-3 text-7xl font-black tracking-tighter text-emerald-500">{combined.overallHealthScore ?? "--"}{combined.overallHealthScore !== null ? "%" : ""}</div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{combined.scoreExplanation}</p>
                  </div>

                  {/* Risks list */}
                  {parsedRisks.length > 0 && (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6 space-y-3">
                      <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                        <AlertTriangle className="h-4 w-4" /> Detected Risk Signals
                      </div>
                      <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        {parsedRisks.map((risk, index) => (
                          <li key={index} className="flex gap-2">
                            <span>•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Right detailed content column */}
                <div className="space-y-8">
                  {/* AI Insights text */}
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 dark:text-white">AI Holistic Insights</h3>
                    <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {combined.aiInsights}
                    </p>
                  </div>

                  {/* Action Plan */}
                  {parsedActionPlan.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-slate-950 dark:text-white flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-emerald-500" /> Daily Focus Action Plan
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {parsedActionPlan.map((action, index) => (
                          <div 
                            key={index} 
                            className="flex items-start gap-3 rounded-2xl bg-slate-100/50 p-4 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50"
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-300">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="no-report"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-12 text-center py-10"
              >
                <FileText className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">No Comprehensive Report Generated Yet</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Click the button above to run our holistic analysis engine and generate a wellness summary across all categories.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Modules Grid */}
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

        {/* Individual Summary Scores */}
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
              <div className="mt-4 text-4xl font-black text-slate-950 dark:text-white">{item.data ? `${item.data.score}%` : "--"}</div>
              {item.data && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.data.methodLabel}</p>}
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
