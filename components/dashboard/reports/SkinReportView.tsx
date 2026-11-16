"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ClipboardList, ScanFace } from "lucide-react";
import { useRef, useState } from "react";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { PhotoDropzone } from "@/components/analysis/PhotoDropzone";
import { ChipGroup, PageHeader, Panel, Segmented, SliderField } from "@/components/analysis/primitives";
import { ReportDisplay, ReportSkeleton } from "@/components/analysis/ReportDisplay";
import { useAnalysisFlow } from "@/components/analysis/useAnalysisFlow";
import { Button } from "@/components/ui/button";
import { SKIN_CONCERNS, SKIN_TYPES, type SkinQuestionnaire } from "@/features/wellness/schemas";

const ACCENT = "var(--skin)";

function FaceGuide() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
      <rect x="10" y="6" width="100" height="108" rx="26" fill="none" stroke="var(--line-strong)" strokeDasharray="5 5" />
      <ellipse cx="60" cy="58" rx="28" ry="36" fill="color-mix(in oklab, var(--skin) 8%, transparent)" stroke="var(--skin)" strokeWidth="1.6" />
      <circle cx="49" cy="52" r="2.4" fill="var(--skin)" />
      <circle cx="71" cy="52" r="2.4" fill="var(--skin)" />
      <path d="M52 74c5 4 11 4 16 0" stroke="var(--skin)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const guide = {
  title: "For the most accurate measurements",
  tips: [
    "Face the camera straight on, eyes level",
    "Soft daylight, no strong shadows or flash",
    "No makeup, filters or beauty mode",
    "Hair pulled back from forehead and cheeks",
  ],
  illustration: <FaceGuide />,
};

type Mode = "photo" | "answers";

export default function SkinReportView() {
  const flow = useAnalysisFlow<SkinQuestionnaire>("skin");
  const [mode, setMode] = useState<Mode>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<SkinQuestionnaire>({
    skinType: "Balanced",
    concerns: [],
    hydration: 60,
    sunExposure: 3,
    sleepHours: 7,
  });
  const resultRef = useRef<HTMLDivElement>(null);

  const canRun = !flow.running && (mode === "answers" || file !== null);

  async function generate() {
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const result = await flow.run(mode === "photo" ? file : null, form);
    if (result) setFile(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader
        eyebrow="Skin analysis"
        accent={ACCENT}
        title={
          <>
            Read your skin, <span className="italic text-ink-2">gently.</span>
          </>
        }
        description="A clear selfie becomes measurements across your forehead, cheeks and chin. No photo? Answer a few questions for a quick estimate instead."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-6 sm:p-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h2 className="text-lg font-semibold text-ink">
              <span className="mr-2 font-mono text-sm text-ink-3">01</span>Your photo
            </h2>
            <div className="w-full sm:w-64">
              <Segmented<Mode>
                value={mode}
                onChange={setMode}
                options={[
                  { value: "photo", label: "Photo" },
                  { value: "answers", label: "Answers only" },
                ]}
              />
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {mode === "photo" ? (
              <motion.div key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <PhotoDropzone
                  file={file}
                  onFile={setFile}
                  existingUrl={flow.report?.imageUrl}
                  guide={guide}
                  accent={ACCENT}
                  disabled={flow.running}
                />
              </motion.div>
            ) : (
              <motion.div
                key="answers"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center rounded-3xl border border-line bg-bg-elevated px-6 py-14 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <p className="mt-4 font-medium text-ink">Answers-only estimate</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-ink-2">
                  A rule-based estimate from what you tell us. It&apos;s clearly labelled as reported, not measured — add
                  a photo any time for real measurements.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        <Panel className="flex flex-col p-6 sm:p-7" delay={0.06}>
          <h2 className="text-lg font-semibold text-ink">
            <span className="mr-2 font-mono text-sm text-ink-3">02</span>A little context
          </h2>
          <div className="mt-6 space-y-7">
            <div>
              <p className="mb-3 text-sm font-medium text-ink">Skin type</p>
              <ChipGroup
                options={SKIN_TYPES}
                selected={[form.skinType]}
                onToggle={(v) => setForm((f) => ({ ...f, skinType: v }))}
                color={ACCENT}
              />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-ink">
                Concerns to track <span className="font-normal text-ink-3">(optional)</span>
              </p>
              <ChipGroup
                options={SKIN_CONCERNS}
                selected={form.concerns}
                onToggle={(v) =>
                  setForm((f) => ({
                    ...f,
                    concerns: f.concerns.includes(v) ? f.concerns.filter((c) => c !== v) : [...f.concerns, v],
                  }))
                }
                color={ACCENT}
              />
            </div>
            <SliderField
              label="How hydrated does your skin feel?"
              value={form.hydration}
              min={0}
              max={100}
              onChange={(v) => setForm((f) => ({ ...f, hydration: v }))}
              format={(v) => `${v}%`}
              color={ACCENT}
              hint="Your own sense of it — a photo can't measure hydration."
            />
            <SliderField
              label="Daily sun exposure"
              value={form.sunExposure}
              min={0}
              max={10}
              onChange={(v) => setForm((f) => ({ ...f, sunExposure: v }))}
              format={(v) => `${v}/10`}
              color={ACCENT}
            />
            <SliderField
              label="Sleep last night"
              value={form.sleepHours}
              min={3}
              max={11}
              step={0.5}
              onChange={(v) => setForm((f) => ({ ...f, sleepHours: v }))}
              format={(v) => `${v} h`}
              color={ACCENT}
            />
          </div>

          <div className="mt-auto pt-8">
            <Button variant="aurora" size="lg" className="group w-full" disabled={!canRun} onClick={generate}>
              <ScanFace className="h-5 w-5" />
              {flow.running ? "Analysing…" : mode === "photo" ? "Analyse my skin" : "Create estimate"}
              {!flow.running && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </Button>
            {mode === "photo" && !file && !flow.running && (
              <p className="mt-3 text-center text-xs text-ink-3">Add a photo to start, or switch to “Answers only”.</p>
            )}
          </div>
        </Panel>
      </div>

      <div ref={resultRef} className="scroll-mt-24">
        <AnimatePresence mode="wait">
          {flow.running ? (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AnalysisProgress stages={flow.stages} current={flow.stage} uploadPct={flow.uploadPct} accent={ACCENT} />
            </motion.div>
          ) : flow.loadingLatest ? (
            <ReportSkeleton key="skeleton" />
          ) : flow.report ? (
            <motion.div key={flow.report.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="eyebrow mb-4">Latest report</p>
              <ReportDisplay report={flow.report} accent={ACCENT} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card-quiet flex flex-col items-center px-6 py-16 text-center"
            >
              <ScanFace className="h-8 w-8 text-ink-3" />
              <p className="font-display mt-4 text-2xl text-ink">Your first skin report will appear here</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-2">
                {flow.lastError?.description ?? "It's saved privately to your history so you can track change over time."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
