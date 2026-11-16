"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ClipboardList, PersonStanding } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { PhotoDropzone } from "@/components/analysis/PhotoDropzone";
import { ChipGroup, NumberField, PageHeader, Panel, Segmented, SliderField } from "@/components/analysis/primitives";
import { ReportDisplay, ReportSkeleton } from "@/components/analysis/ReportDisplay";
import { useAnalysisFlow } from "@/components/analysis/useAnalysisFlow";
import { Button } from "@/components/ui/button";
import { FITNESS_GOALS, type PhysicalQuestionnaire } from "@/features/wellness/schemas";

const ACCENT = "var(--body)";

function BodyGuide() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
      <rect x="22" y="4" width="76" height="112" rx="18" fill="none" stroke="var(--line-strong)" strokeDasharray="5 5" />
      <g stroke="var(--body)" strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="60" cy="22" r="8" />
        <path d="M60 30v34M44 40h32M44 40l-5 24M76 40l5 24M50 64h20M50 64l-2 40M70 64l2 40" />
      </g>
      <line x1="60" y1="8" x2="60" y2="112" stroke="var(--body)" strokeOpacity=".35" strokeDasharray="3 4" />
    </svg>
  );
}

const guide = {
  title: "For a measurable photo",
  tips: [
    "Whole body visible, head to feet",
    "Camera at chest height, 2–3 m away",
    "Stand naturally, facing or side-on",
    "Fitted clothing, plain background",
  ],
  illustration: <BodyGuide />,
};

const ACTIVITY = [
  { value: "1", label: "Rest" },
  { value: "2", label: "Light" },
  { value: "3", label: "Moderate" },
  { value: "4", label: "Active" },
  { value: "5", label: "Athlete" },
] as const;

type Mode = "photo" | "answers";
type ActivityValue = (typeof ACTIVITY)[number]["value"];

export default function PhysicalReportView() {
  const flow = useAnalysisFlow<PhysicalQuestionnaire>("physical");
  const [mode, setMode] = useState<Mode>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [heightCm, setHeightCm] = useState<number | "">("");
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [form, setForm] = useState<Omit<PhysicalQuestionnaire, "heightCm" | "weightKg">>({
    waterLiters: 2,
    workoutMinutes: 30,
    sleepHours: 7,
    activityLevel: 3,
    goal: "General fitness",
  });
  const resultRef = useRef<HTMLDivElement>(null);

  const bodyValid =
    (heightCm === "" || (heightCm >= 50 && heightCm <= 272)) && (weightKg === "" || (weightKg >= 20 && weightKg <= 400));
  const bmi = useMemo(
    () => (typeof heightCm === "number" && typeof weightKg === "number" && bodyValid ? weightKg / (heightCm / 100) ** 2 : null),
    [heightCm, weightKg, bodyValid],
  );

  const canRun = !flow.running && bodyValid && (mode === "answers" || file !== null);

  async function generate() {
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const questionnaire: PhysicalQuestionnaire = {
      ...form,
      ...(typeof heightCm === "number" ? { heightCm } : {}),
      ...(typeof weightKg === "number" ? { weightKg } : {}),
    };
    const result = await flow.run(mode === "photo" ? file : null, questionnaire);
    if (result) setFile(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader
        eyebrow="Posture & body"
        accent={ACCENT}
        title={
          <>
            Stand tall, <span className="italic text-ink-2">measurably.</span>
          </>
        }
        description="A full-body photo gives real alignment angles — shoulder and hip tilt, head position, trunk lean. Your habits shape the plan around them."
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
                  A rule-based estimate from your habits. Posture angles need a photo — add one any time.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        <Panel className="flex flex-col p-6 sm:p-7" delay={0.06}>
          <h2 className="text-lg font-semibold text-ink">
            <span className="mr-2 font-mono text-sm text-ink-3">02</span>Your routine
          </h2>
          <div className="mt-6 space-y-7">
            <div>
              <p className="mb-3 text-sm font-medium text-ink">Goal</p>
              <ChipGroup
                options={FITNESS_GOALS}
                selected={[form.goal]}
                onToggle={(v) => setForm((f) => ({ ...f, goal: v }))}
                color={ACCENT}
              />
            </div>
            <div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Height" unit="cm" value={heightCm} onChange={setHeightCm} min={50} max={272} placeholder="Optional" />
                <NumberField label="Weight" unit="kg" value={weightKg} onChange={setWeightKg} min={20} max={400} step={0.1} placeholder="Optional" />
              </div>
              <p className={`mt-2 text-xs ${bodyValid ? "text-ink-3" : "text-danger"}`}>
                {!bodyValid
                  ? "Height must be 50–272 cm and weight 20–400 kg."
                  : bmi !== null
                    ? `BMI ${bmi.toFixed(1)} — calculated from what you entered.`
                    : "Add both to include a calculated BMI. Leave empty to skip."}
              </p>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-ink">Activity level</p>
              <Segmented<ActivityValue>
                value={String(form.activityLevel) as ActivityValue}
                onChange={(v) => setForm((f) => ({ ...f, activityLevel: Number(v) }))}
                options={ACTIVITY}
              />
            </div>
            <SliderField
              label="Exercise today"
              value={form.workoutMinutes}
              min={0}
              max={180}
              step={5}
              onChange={(v) => setForm((f) => ({ ...f, workoutMinutes: v }))}
              format={(v) => `${v} min`}
              color={ACCENT}
            />
            <SliderField
              label="Water today"
              value={form.waterLiters}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => setForm((f) => ({ ...f, waterLiters: Math.round(v * 10) / 10 }))}
              format={(v) => `${v.toFixed(1)} L`}
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
              <PersonStanding className="h-5 w-5" />
              {flow.running ? "Analysing…" : mode === "photo" ? "Analyse my posture" : "Create estimate"}
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
              <PersonStanding className="h-8 w-8 text-ink-3" />
              <p className="font-display mt-4 text-2xl text-ink">Your first posture report will appear here</p>
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
