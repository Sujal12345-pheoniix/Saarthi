"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  CircleAlert,
  CircleCheck,
  Clock,
  Flame,
  LoaderCircle,
  PersonStanding,
  ScanFace,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ease } from "@/components/analysis/primitives";
import { firstName, useViewer } from "@/components/dashboard/viewer";
import { ButtonLink } from "@/components/ui/button";
import { ScoreRing } from "@/components/ui/score-ring";
import { apiRequest, isAbortError } from "@/lib/api/client";
import type { DashboardSummary, DomainSnapshot } from "@/server/services/dashboard";

interface HistoryItem {
  id: string;
  domain: "SKIN" | "PHYSICAL" | "MENTAL" | "COMBINED";
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  errorMessage: string | null;
  createdAt: string;
}

const DOMAINS = [
  { key: "skin", series: "SKIN", label: "Skin", icon: ScanFace, color: "var(--skin)", hex: "#e14f7a", href: "/dashboard/skin", cta: "Scan your skin" },
  { key: "physical", series: "PHYSICAL", label: "Posture", icon: PersonStanding, color: "var(--body)", hex: "#2f7cf6", href: "/dashboard/physical", cta: "Check your posture" },
  { key: "mental", series: "MENTAL", label: "Mind", icon: Brain, color: "var(--mind)", hex: "#8b5cf6", href: "/dashboard/mental", cta: "Check in" },
] as const;

const DOMAIN_NAME: Record<HistoryItem["domain"], string> = {
  SKIN: "Skin analysis",
  PHYSICAL: "Posture analysis",
  MENTAL: "Mind check-in",
  COMBINED: "Combined report",
};

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function relative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString();
}

function DomainCard({ d, snap, i }: { d: (typeof DOMAINS)[number]; snap: DomainSnapshot | null; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.06, duration: 0.6, ease }}>
      <Link
        href={d.href}
        className="card group flex h-full flex-col p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-float"
      >
        <div className="flex items-center justify-between">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in oklab, ${d.color} 13%, transparent)`, color: d.color }}
          >
            <d.icon className="h-[18px] w-[18px]" />
          </span>
          <ArrowUpRight className="h-4 w-4 text-ink-3 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
        <p className="mt-5 text-sm text-ink-2">{d.label}</p>
        {snap ? (
          <>
            <p className="font-display mt-1 text-5xl leading-none text-ink">{snap.score}</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className="h-full rounded-full"
                style={{ background: d.color }}
                initial={{ width: 0 }}
                animate={{ width: `${snap.score}%` }}
                transition={{ delay: 0.3 + i * 0.08, duration: 1, ease }}
              />
            </div>
            <p className="mt-3 truncate text-xs text-ink-3">
              {relative(snap.recordedAt)} · {snap.method === "COMPUTER_VISION" ? "measured" : snap.method === "QUESTIONNAIRE_RULES" ? "from answers" : "legacy"}
            </p>
          </>
        ) : (
          <>
            <p className="font-display mt-1 text-5xl leading-none text-ink-3/60">—</p>
            <p className="mt-auto pt-6 text-sm font-medium" style={{ color: d.color }}>
              {d.cta} →
            </p>
          </>
        )}
      </Link>
    </motion.div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-float">
      <p className="mb-1 font-medium text-ink">{label ? new Date(label).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} /> {p.name}: <span className="font-mono text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardOverview() {
  const viewer = useViewer();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    apiRequest<DashboardSummary>("/api/dashboard/summary", { signal: ctrl.signal })
      .then(setSummary)
      .catch((e) => !isAbortError(e) && setError(e instanceof Error ? e.message : "Could not load your dashboard."));
    apiRequest<{ history: HistoryItem[] }>("/api/history", { signal: ctrl.signal })
      .then((d) => setHistory(d.history.slice(0, 6)))
      .catch((e) => !isAbortError(e) && setHistory([]));
    return () => ctrl.abort();
  }, []);

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

  const snaps = summary ? [summary.skin, summary.physical, summary.mental].filter((s): s is DomainSnapshot => s !== null) : [];
  const average = snaps.length ? Math.round(snaps.reduce((a, s) => a + s.score, 0) / snaps.length) : null;
  const seriesWithData = DOMAINS.filter((d) => summary?.progress.some((p) => p.domain === d.series));
  const name = viewer?.localMode ? null : firstName(viewer);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
        <p className="eyebrow">{today}</p>
        <h1 className="font-display mt-3 text-4xl leading-tight text-ink sm:text-5xl">
          {greeting()}
          {name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-3 max-w-xl text-ink-2">Here&apos;s where you stand — built only from reports you&apos;ve created.</p>
      </motion.header>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[color-mix(in_oklab,var(--danger)_6%,transparent)] p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Score row */}
      <div className="mt-10 grid gap-5 sm:grid-cols-3 lg:grid-cols-[1.15fr_1fr_1fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="relative overflow-hidden rounded-[24px] bg-[#0f0d16] p-6 text-white shadow-float sm:col-span-3 lg:col-span-1"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#7c6cf6]/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-[#e14f7a]/25 blur-3xl" />
          <div className="relative flex items-center gap-5 lg:flex-col lg:items-start">
            <div className="rounded-full bg-white/5 p-1.5 [--surface-3:rgba(255,255,255,0.1)] [--ink:#fff] [--ink-3:rgba(255,255,255,0.55)]">
              {summary ? <ScoreRing value={average} size={112} stroke={9} gradient label="Balance" /> : <div className="skeleton h-[112px] w-[112px] rounded-full opacity-20" />}
            </div>
            <div>
              <p className="text-sm font-medium">Your balance</p>
              <p className="mt-1 text-xs leading-5 text-white/55">
                {average === null
                  ? "Create a report in any area to see your balance."
                  : `Average of your latest ${snaps.length === 1 ? "score" : `${snaps.length} scores`}, calculated by Saarthi.`}
              </p>
            </div>
          </div>
        </motion.div>
        {DOMAINS.map((d, i) =>
          summary ? (
            <DomainCard key={d.key} d={d} snap={summary[d.key]} i={i} />
          ) : (
            <div key={d.key} className="skeleton h-[196px] rounded-[24px]" />
          ),
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.9fr_1fr]">
        {/* Trend */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease }}
          className="card p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Progress</h2>
              <p className="text-xs text-ink-3">Last 90 days</p>
            </div>
            <div className="flex gap-3">
              {seriesWithData.map((d) => (
                <span key={d.key} className="flex items-center gap-1.5 text-xs text-ink-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.label}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-6 h-64">
            {!summary ? (
              <div className="skeleton h-full" />
            ) : chartData.length === 0 ? (
              <div className="dot-grid flex h-full flex-col items-center justify-center rounded-2xl text-center">
                <p className="font-medium text-ink">Your trend line starts with your first report</p>
                <p className="mt-1 text-sm text-ink-3">Every scan or check-in adds a point here.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    {DOMAINS.map((d) => (
                      <linearGradient key={d.key} id={`fill-${d.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={d.hex} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={d.hex} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--ink-3)", fontSize: 11 }}
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    dy={8}
                  />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--ink-3)", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--line-strong)" }} />
                  {seriesWithData.map((d) => (
                    <Area
                      key={d.key}
                      type="monotone"
                      dataKey={d.series}
                      name={d.label}
                      stroke={d.hex}
                      strokeWidth={2.5}
                      fill={`url(#fill-${d.key})`}
                      connectNulls
                      dot={{ r: 3, strokeWidth: 0, fill: d.hex }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.section>

        <div className="space-y-5">
          {/* Streak */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.6, ease }}
            className="card flex items-center gap-4 p-5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--amber)_15%,transparent)] text-amber">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-3xl leading-none text-ink">
                {summary ? summary.activeStreakDays : "–"}
                <span className="ml-1.5 font-sans text-sm text-ink-3">{summary?.activeStreakDays === 1 ? "day" : "days"}</span>
              </p>
              <p className="mt-1 text-xs text-ink-3">Active streak — days in a row with a report</p>
            </div>
          </motion.section>

          {/* Recent activity */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.6, ease }}
            className="card p-5"
          >
            <h2 className="font-semibold text-ink">Recent activity</h2>
            <div className="mt-4 space-y-1">
              {history === null ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton mb-2 h-10" />)
              ) : history.length === 0 ? (
                <p className="py-4 text-sm text-ink-3">Photo analyses and combined reports will be listed here.</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                    {h.status === "COMPLETED" ? (
                      <CircleCheck className="h-4 w-4 shrink-0 text-success" />
                    ) : h.status === "FAILED" || h.status === "CANCELLED" ? (
                      <CircleAlert className="h-4 w-4 shrink-0 text-danger" />
                    ) : (
                      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-brand" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{DOMAIN_NAME[h.domain]}</p>
                      <p className="truncate text-xs text-ink-3">
                        {h.status === "FAILED" && h.errorMessage ? h.errorMessage : h.status.toLowerCase()}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
                      <Clock className="h-3 w-3" /> {relative(h.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.section>
        </div>
      </div>

      {/* Next step */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.6, ease }}
        className="relative mt-5 overflow-hidden rounded-[24px] border border-line bg-surface p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-aurora opacity-15 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-aurora text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-2xl text-ink">
                {snaps.length >= 2 ? "See how it all connects" : snaps.length === 1 ? "Add a second lens" : "Start with a one-minute check-in"}
              </p>
              <p className="mt-1 max-w-lg text-sm leading-6 text-ink-2">
                {snaps.length >= 2
                  ? "Compile a combined report that reads your skin, posture and mind results together."
                  : snaps.length === 1
                    ? "Two or more areas let Saarthi show you how they relate."
                    : "No photo needed. Tell Saarthi how you feel and get a gentle read on your day."}
              </p>
            </div>
          </div>
          <ButtonLink href={snaps.length >= 2 ? "/dashboard/reports" : snaps.length === 1 ? (summary?.skin ? "/dashboard/physical" : "/dashboard/skin") : "/dashboard/mental"} className="group">
            {snaps.length >= 2 ? "Open reports" : "Let's go"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </ButtonLink>
        </div>
      </motion.section>
    </div>
  );
}
