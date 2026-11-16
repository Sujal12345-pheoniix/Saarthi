"use client";

import { motion } from "framer-motion";
import {
  Camera,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Eye,
  FileText,
  Info,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import type { ReportView } from "@/features/reports/view-model";
import { ScoreRing } from "@/components/ui/score-ring";
import { ease } from "./primitives";

const METHOD_META = {
  COMPUTER_VISION: { icon: Camera, short: "Measured from your photo" },
  QUESTIONNAIRE_RULES: { icon: ClipboardList, short: "Estimated from your answers" },
  LLM_SYNTHESIS: { icon: Sparkles, short: "AI synthesis" },
  LEGACY_UNVERIFIED: { icon: CircleAlert, short: "Unverified legacy report" },
} as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Section({ icon: Icon, title, children, delay = 0 }: { icon: typeof Eye; title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease }}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-ink-3" /> {title}
      </h3>
      <div className="mt-3">{children}</div>
    </motion.div>
  );
}

export function ReportDisplay({ report, accent }: { report: ReportView; accent: string }) {
  const meta = METHOD_META[report.method];
  const detail = report.detail;
  const observations = detail?.observations.length ? detail.observations : report.findings;

  return (
    <motion.article
      key={report.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease }}
      className="card overflow-hidden p-0"
    >
      {/* Header */}
      <div className="relative border-b border-line p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: `radial-gradient(60% 120% at 100% 0%, color-mix(in oklab, ${accent} 10%, transparent), transparent)` }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          {report.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.imageUrl}
              alt="Photo analysed for this report"
              className="h-28 w-28 shrink-0 rounded-2xl border border-line object-cover shadow-soft"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: `color-mix(in oklab, ${accent} 12%, transparent)`, color: accent }}
              >
                <meta.icon className="h-3.5 w-3.5" /> {meta.short}
              </span>
              {detail?.imageQuality && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" /> Photo quality {detail.imageQuality.score}/100
                </span>
              )}
            </div>
            <h2 className="font-display mt-3 text-3xl leading-tight text-ink sm:text-4xl">{report.title}</h2>
            <p className="mt-1 text-sm text-ink-3">
              {formatDate(report.createdAt)} · {report.confidenceLabel}
            </p>
          </div>
          <ScoreRing value={report.score} size={120} color={accent} label="Score" />
        </div>
        <p className="relative mt-6 max-w-3xl text-[1.02rem] leading-7 text-ink-2">{report.summary}</p>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 border-b border-line lg:grid-cols-4">
        {report.metrics.map((m, i) => (
          <div
            key={m.label}
            className={`p-5 sm:p-6 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${i >= 1 ? "lg:border-l" : ""}`}
          >
            <p className="text-xs font-medium text-ink-3">{m.label}</p>
            <p className={`mt-2 font-display text-3xl ${m.value === "Not measured" ? "text-lg text-ink-3" : "text-ink"}`}>{m.value}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-3">{m.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-10">
          {detail && detail.measurements.length > 0 && (
            <Section icon={Eye} title="What was measured">
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {detail.measurements.map((m) => (
                  <details key={m.key} className="group bg-surface open:bg-bg-elevated">
                    <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1 text-sm text-ink">{m.label}</span>
                      {m.unit === "index_0_100" && m.raw !== null && (
                        <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-3 sm:block">
                          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, m.raw)}%`, background: accent }} />
                        </span>
                      )}
                      <span
                        className={`shrink-0 whitespace-nowrap text-right text-sm ${m.raw === null ? "text-xs text-ink-3" : "w-20 font-mono text-ink"}`}
                      >
                        {m.value}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-ink-3 transition group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 px-4 pb-4 text-sm leading-6 text-ink-2">
                      <p>{m.explanation}</p>
                      <p className="text-xs text-ink-3">
                        <span className="font-medium text-ink-2">Method:</span> {m.method}
                      </p>
                      {m.limitations.length > 0 && (
                        <ul className="space-y-1 text-xs text-ink-3">
                          {m.limitations.map((l) => (
                            <li key={l}>• {l}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                ))}
              </div>
              {detail.compositeFormula && (
                <p className="mt-3 text-xs leading-5 text-ink-3">
                  <span className="font-medium text-ink-2">How the score is calculated:</span> {detail.compositeFormula}
                </p>
              )}
            </Section>
          )}

          {observations.length > 0 && (
            <Section icon={Info} title="What stood out" delay={0.05}>
              <ul className="space-y-2.5">
                {observations.map((o) => (
                  <li key={o} className="flex gap-3 text-[0.95rem] leading-7 text-ink-2">
                    <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
                    {o}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {detail && detail.interpretations.length > 0 && (
            <Section icon={Lightbulb} title="What it might mean" delay={0.1}>
              <div className="space-y-3">
                {detail.interpretations.map((it) => (
                  <div key={it.text} className="rounded-2xl border border-line bg-bg-elevated p-4">
                    <p className="text-[0.95rem] leading-7 text-ink">{it.text}</p>
                    {it.caveat && <p className="mt-1.5 text-xs leading-5 text-ink-3">{it.caveat}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-10">
          {report.recommendations.length > 0 && (
            <Section icon={CircleCheck} title="Your plan" delay={0.1}>
              <ol className="space-y-3">
                {report.recommendations.map((r, i) => (
                  <li key={r} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
                      style={{ background: accent }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm leading-6 text-ink-2">{r}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {report.activities.length > 0 && (
            <Section icon={Sun} title="Small daily habits" delay={0.15}>
              <div className="space-y-2">
                {report.activities.map((a) => (
                  <p key={a} className="rounded-2xl bg-surface-2 px-4 py-3 text-sm leading-6 text-ink-2">
                    {a}
                  </p>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Limitations + caution */}
      <div className="space-y-4 border-t border-line bg-bg-elevated p-6 sm:p-8">
        {detail && detail.limitations.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              <FileText className="h-4 w-4 text-ink-3" /> What this analysis can&apos;t tell you
              <ChevronDown className="h-4 w-4 text-ink-3 transition group-open:rotate-180" />
            </summary>
            <ul className="mt-3 space-y-1.5 text-sm leading-6 text-ink-2">
              {detail.limitations.map((l) => (
                <li key={l}>• {l}</li>
              ))}
            </ul>
          </details>
        )}
        <p className="flex gap-2.5 text-sm leading-6 text-ink-2">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          {report.caution}
        </p>
      </div>
    </motion.article>
  );
}

export function ReportSkeleton() {
  return (
    <div className="card p-8" aria-busy="true" aria-label="Loading report">
      <div className="flex items-center gap-6">
        <div className="skeleton h-28 w-28 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-9 w-64 max-w-full" />
          <div className="skeleton h-4 w-52" />
        </div>
        <div className="skeleton hidden h-28 w-28 rounded-full sm:block" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
    </div>
  );
}
