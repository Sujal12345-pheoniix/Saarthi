"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Brain,
  CircleAlert,
  ListChecks,
  LoaderCircle,
  PersonStanding,
  ScanFace,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader, ease } from "@/components/analysis/primitives";
import { useViewer } from "@/components/dashboard/viewer";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ui/score-ring";
import { useToast } from "@/components/ui/toast";
import type { CombinedReportView, ReportView } from "@/features/reports/view-model";
import { apiRequest, isAbortError, newIdempotencyKey, pollAnalysis } from "@/lib/api/client";

const DOMAINS = [
  { key: "skin", title: "Skin", icon: ScanFace, color: "var(--skin)", href: "/dashboard/skin" },
  { key: "physical", title: "Posture & body", icon: PersonStanding, color: "var(--body)", href: "/dashboard/physical" },
  { key: "mental", title: "Mind", icon: Brain, color: "var(--mind)", href: "/dashboard/mental" },
] as const;

type DomainKey = (typeof DOMAINS)[number]["key"];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function ReportsPage() {
  const toast = useToast();
  const viewer = useViewer();
  const [latest, setLatest] = useState<Record<DomainKey, ReportView | null> | null>(null);
  const [combined, setCombined] = useState<CombinedReportView | null | undefined>(undefined);
  const [compiling, setCompiling] = useState(false);
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    const domain = (key: DomainKey) => apiRequest<{ report: ReportView | null }>(`/api/reports/${key}`, { signal });
    Promise.all([
      domain("skin"),
      domain("physical"),
      domain("mental"),
      apiRequest<{ report: CombinedReportView | null }>("/api/report/latest", { signal }),
    ])
      .then(([s, p, m, c]) => {
        setLatest({ skin: s.report, physical: p.report, mental: m.report });
        setCombined(c.report);
      })
      .catch((e) => {
        if (isAbortError(e)) return;
        setLatest({ skin: null, physical: null, mental: null });
        setCombined(null);
        toast.error("Couldn't load your reports", e instanceof Error ? e.message : undefined);
      });
  }, [toast]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => {
      ctrl.abort();
      abortRef.current?.abort();
    };
  }, [load]);

  const available = latest ? DOMAINS.filter((d) => latest[d.key]).length : 0;
  const aiReady = viewer?.features.aiSynthesis ?? true;

  async function compile() {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setCompiling(true);
    setStatus("Queuing synthesis…");
    try {
      const queued = await apiRequest<{ analysisId: string }>("/api/report/generate", {
        method: "POST",
        json: { idempotencyKey: newIdempotencyKey() },
        signal: ctrl.signal,
      });
      const report = await pollAnalysis<CombinedReportView>(
        queued.analysisId,
        (s) => setStatus(s === "PROCESSING" ? "Reading your reports…" : "Waiting in queue…"),
        { intervalMs: 2000, signal: ctrl.signal },
      );
      setCombined(report);
      toast.success("Combined report ready");
    } catch (e) {
      if (!isAbortError(e)) toast.error("Couldn't compile the combined report", e instanceof Error ? e.message : undefined);
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader
        eyebrow="Reports"
        title={
          <>
            Everything, <span className="italic text-ink-2">in one place.</span>
          </>
        }
        description="Your latest report in each area, and a combined reading of how they relate."
      />

      {/* Domain reports */}
      <div className="grid gap-5 md:grid-cols-3">
        {DOMAINS.map((d, i) => {
          const r = latest?.[d.key];
          return (
            <motion.div key={d.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.6, ease }}>
              {latest === null ? (
                <div className="skeleton h-64 rounded-[24px]" />
              ) : (
                <Link href={d.href} className="card group flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-float">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ background: `color-mix(in oklab, ${d.color} 13%, transparent)`, color: d.color }}
                      >
                        <d.icon className="h-4 w-4" />
                      </span>
                      {d.title}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-ink-3 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                  </div>
                  {r ? (
                    <>
                      <div className="mt-6 flex items-center gap-4">
                        <ScoreRing value={r.score} size={76} stroke={7} color={d.color} />
                        <div className="min-w-0">
                          <p className="text-sm text-ink">{r.title}</p>
                          <p className="text-xs text-ink-3">{fmt(r.createdAt)}</p>
                        </div>
                      </div>
                      <p className="mt-5 line-clamp-3 text-sm leading-6 text-ink-2">{r.summary}</p>
                      <p className="mt-auto pt-5 text-xs text-ink-3">{r.methodLabel}</p>
                    </>
                  ) : (
                    <div className="mt-6 flex flex-1 flex-col">
                      <p className="font-display text-2xl text-ink-3">No report yet</p>
                      <p className="mt-2 text-sm text-ink-3">Create one to see it here.</p>
                      <p className="mt-auto pt-6 text-sm font-medium" style={{ color: d.color }}>
                        Start →
                      </p>
                    </div>
                  )}
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Combined synthesis */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, ease }}
        className="card overflow-hidden p-0"
      >
        <div className="relative flex flex-col gap-6 border-b border-line p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-aurora opacity-15 blur-3xl" />
          <div className="relative">
            <p className="eyebrow flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Combined report
            </p>
            <h2 className="font-display mt-3 text-3xl text-ink sm:text-4xl">How it all connects</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-2">
              An AI reads your latest reports together. The overall score is calculated by Saarthi — the AI only writes
              the narrative.
            </p>
          </div>
          <div className="relative shrink-0">
            <Button variant="aurora" onClick={compile} disabled={compiling || !aiReady || available === 0}>
              {compiling ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {compiling ? status : combined ? "Compile again" : "Compile report"}
            </Button>
          </div>
        </div>

        {!aiReady && (
          <div className="flex items-start gap-3 border-b border-line bg-bg-elevated px-6 py-4 text-sm text-ink-2 sm:px-8">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            AI synthesis isn&apos;t configured on this server yet (no language-model provider). Your skin, posture and mind
            reports work without it.
          </div>
        )}

        <AnimatePresence mode="wait">
          {combined === undefined ? (
            <div key="loading" className="p-8">
              <div className="skeleton h-40" />
            </div>
          ) : combined ? (
            <motion.div key={combined.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-10 p-6 sm:p-8 lg:grid-cols-[0.8fr_1.6fr]">
              <div className="space-y-6">
                <div className="flex flex-col items-center rounded-3xl bg-bg-elevated p-6 text-center">
                  <ScoreRing value={combined.overallHealthScore} size={140} gradient label="Overall" />
                  <p className="mt-4 text-xs leading-5 text-ink-3">{combined.scoreExplanation}</p>
                </div>
                {combined.risks.length > 0 && (
                  <div className="rounded-3xl border border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-[color-mix(in_oklab,var(--warning)_7%,transparent)] p-5">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <TriangleAlert className="h-4 w-4 text-warning" /> Worth keeping an eye on
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-2">
                      {combined.risks.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Insights</h3>
                  <p className="mt-3 whitespace-pre-line text-[1.02rem] leading-8 text-ink-2">{combined.aiInsights}</p>
                </div>
                {combined.actionPlan.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <ListChecks className="h-4 w-4 text-ink-3" /> Action plan
                    </h3>
                    <ol className="mt-3 grid gap-3 sm:grid-cols-2">
                      {combined.actionPlan.map((a, i) => (
                        <li key={a} className="flex gap-3 rounded-2xl border border-line p-4">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aurora font-mono text-xs text-white">
                            {i + 1}
                          </span>
                          <span className="text-sm leading-6 text-ink-2">{a}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="text-xs text-ink-3">
                  Generated {fmt(combined.generatedAt)}
                  {combined.model ? ` · ${combined.model}` : ""}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 py-14 text-center">
              <p className="font-display text-2xl text-ink">No combined report yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-2">
                {available === 0
                  ? "Create at least one skin, posture or mind report first."
                  : "Compile one to see how your areas relate and get a single action plan."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}
