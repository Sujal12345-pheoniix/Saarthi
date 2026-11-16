"use client";

import { motion } from "framer-motion";
import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

export type Stage = "upload" | "queue" | "analyze" | "report";

const LABELS: Record<Stage, { title: string; detail: string }> = {
  upload: { title: "Uploading securely", detail: "Your photo is checked and stored privately." },
  queue: { title: "In the queue", detail: "Waiting for an analysis worker." },
  analyze: { title: "Analysing", detail: "Quality checks, landmark detection, measurements." },
  report: { title: "Writing your report", detail: "Turning measurements into a plan." },
};

/** Live pipeline view: which stage is running, what is done, and how long it has taken. */
export function AnalysisProgress({
  stages,
  current,
  uploadPct,
  accent,
}: {
  stages: Stage[];
  current: Stage;
  uploadPct?: number;
  accent: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const currentIndex = stages.indexOf(current);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8" aria-live="polite">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="eyebrow">Analysis in progress</p>
          <p className="font-display mt-2 text-3xl text-ink">{LABELS[current].title}…</p>
        </div>
        <span className="font-mono text-sm text-ink-3">{elapsed}s</span>
      </div>

      <ol className="relative mt-8 space-y-1">
        {stages.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={s} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                    done ? "border-transparent text-white" : active ? "border-transparent bg-surface-2" : "border-line bg-surface"
                  }`}
                  style={done ? { background: accent } : undefined}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : active ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" style={{ color: accent }} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-3/50" />
                  )}
                </span>
                {i < stages.length - 1 && (
                  <span className="my-1 h-8 w-px" style={{ background: done ? accent : "var(--line-strong)" }} />
                )}
              </div>
              <div className="pb-4 pt-1">
                <p className={`text-sm font-medium ${active || done ? "text-ink" : "text-ink-3"}`}>{LABELS[s].title}</p>
                <p className="text-sm text-ink-3">{LABELS[s].detail}</p>
                {active && s === "upload" && typeof uploadPct === "number" && (
                  <div className="mt-3 h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-surface-3">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: accent }}
                      animate={{ width: `${uploadPct}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="relative mt-2 text-xs text-ink-3">
        You can leave this page — the analysis keeps running and the report will be waiting under Reports.
      </p>
    </div>
  );
}
