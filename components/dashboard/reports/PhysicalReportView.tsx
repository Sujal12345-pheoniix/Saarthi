"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ChefHat,
  Dumbbell,
  CheckCircle2,
  ImagePlus,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Trophy,
  UploadCloud,
  Waves,
} from "lucide-react";

type PhysicalReport = {
  title: string;
  subtitle: string;
  score: number;
  confidence: number;
  summary: string;
  findings: string[];
  recommendations: string[];
  activities: string[];
  metrics: { label: string; value: string; detail: string }[];
  caution: string;
  imageUrl?: string | null;
};

const defaultForm = {
  heightCm: 175,
  weightKg: 72,
  waterLiters: 2.2,
  workoutMinutes: 40,
  sleepHours: 7.5,
  activityLevel: 3,
  goal: "Fat loss + strength",
};

const goalOptions = ["Fat loss + strength", "Muscle gain", "Endurance", "General fitness"];

function formatBmi(heightCm: number, weightKg: number) {
  return weightKg / Math.pow(heightCm / 100, 2);
}

export default function PhysicalReportView() {
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<PhysicalReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    fetch("/api/reports/physical")
      .then((response) => response.json())
      .then((data) => {
        if (data?.report) {
          setReport(data.report);
        }
      })
      .catch(() => undefined);
  }, []);

  const bmi = useMemo(() => formatBmi(form.heightCm, form.weightKg), [form.heightCm, form.weightKg]);

  const uploadImage = async () => {
    if (!file) {
      return null;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "saarthi/physical");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to upload image.");
      }

      return data.url as string;
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const imageUrl = await uploadImage();

      const response = await fetch("/api/reports/physical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          imageUrl,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to generate physical report.");
      }

      setReport(data.report);
      setFile(null);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_80%_25%,rgba(16,185,129,0.16),transparent_22%),linear-gradient(180deg,rgba(15,23,42,0.02),transparent_60%)]" />
      <div className="pointer-events-none absolute left-0 top-28 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-44 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[2rem] border border-white/25 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl"
          >
            <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.32em] text-sky-600 dark:text-sky-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1"><ChefHat className="h-3.5 w-3.5" /> Nutrition scan</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1"><Dumbbell className="h-3.5 w-3.5" /> Workout planning</span>
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Physical report for diet, training, hydration, and recovery.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              This view combines a nutrition plan, a weekly workout rhythm, and an optional image scan so the whole analysis feels like a real progress review instead of a generic tracker.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {report?.metrics?.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/40 bg-white/80 p-4 shadow-sm dark:bg-slate-900/50">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{metric.label}</p>
                  <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{metric.value}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{metric.detail}</p>
                </div>
              ))}

              {!report && (
                <div className="rounded-3xl border border-dashed border-sky-300/60 bg-sky-500/5 p-4 dark:border-sky-500/30">
                  <div className="flex items-center gap-2 font-semibold text-sky-700 dark:text-sky-300"><Activity className="h-4 w-4" /> Weekly analysis ready</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Calculate your first report to get personalized meal and workout guidance.</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950 p-6 text-white shadow-[0_30px_90px_rgba(15,23,42,0.3)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.28),transparent_30%),linear-gradient(160deg,rgba(15,23,42,1),rgba(2,6,23,0.9))]" />
            <motion.div
              animate={{ rotateX: [0, 10, 0, -8, 0], rotateY: [0, 8, 0, -5, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex min-h-[320px] items-center justify-center"
            >
              <div className="absolute inset-x-8 top-10 h-1 rounded-full bg-sky-300/70 shadow-[0_0_24px_rgba(125,211,252,0.95)]" />
              <div className="absolute inset-y-8 left-1/2 w-px bg-white/10" />
              <div className="relative flex h-64 w-64 items-center justify-center rounded-[2rem] border border-white/15 bg-white/5 p-4 backdrop-blur-xl">
                <div className="absolute inset-4 rounded-[1.6rem] border border-sky-300/20" />
                <div className="absolute inset-8 rounded-[1.45rem] bg-sky-300/10 blur-2xl" />
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [0, 4, 0, -4, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full border border-white/20 bg-slate-950/80"
                >
                  <div className="text-center">
                    <Activity className="mx-auto mb-3 h-12 w-12 text-sky-300" />
                    <div className="text-lg font-bold text-white">Metabolic scan</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.32em] text-sky-200/70">diet + workout engine</div>
                  </div>
                </motion.div>
              </div>
              <div className="absolute inset-x-0 bottom-6 text-center text-xs uppercase tracking-[0.35em] text-sky-100/60">recovery aware</div>
            </motion.div>
          </motion.div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="glass rounded-[2rem] border border-white/25 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Daily inputs</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">BMI now {bmi.toFixed(1)} and update-ready.</p>
              </div>
              <div className="rounded-full bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-700 dark:text-sky-300">confidence {report?.confidence ?? 89}%</div>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-5 dark:border-slate-700 dark:bg-slate-950/40">
                <input type="file" accept="image/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300"><UploadCloud className="h-7 w-7" /></div>
                  <div>
                    <div className="font-semibold text-slate-950 dark:text-white">Upload progress photo</div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Use this to keep a visual record of your physical analysis.</p>
                  </div>
                </div>
                {(preview || report?.imageUrl) && <div className="mt-4 overflow-hidden rounded-2xl border border-white/30"><img src={preview || report?.imageUrl || undefined} alt="Physical preview" className="h-56 w-full object-cover" /></div>}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Height (cm)</label>
                  <input type="number" value={form.heightCm} onChange={(event) => setForm((current) => ({ ...current, heightCm: Number(event.target.value) }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Weight (kg)</label>
                  <input type="number" value={form.weightKg} onChange={(event) => setForm((current) => ({ ...current, weightKg: Number(event.target.value) }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Water intake</label>
                  <input type="range" min="0" max="5" step="0.1" value={form.waterLiters} onChange={(event) => setForm((current) => ({ ...current, waterLiters: Number(event.target.value) }))} className="w-full accent-sky-500" />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{form.waterLiters} L</div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Workout minutes</label>
                  <input type="range" min="0" max="180" step="5" value={form.workoutMinutes} onChange={(event) => setForm((current) => ({ ...current, workoutMinutes: Number(event.target.value) }))} className="w-full accent-emerald-500" />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{form.workoutMinutes} min</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Sleep hours</label>
                  <input type="range" min="4" max="10" step="0.5" value={form.sleepHours} onChange={(event) => setForm((current) => ({ ...current, sleepHours: Number(event.target.value) }))} className="w-full accent-indigo-500" />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{form.sleepHours} hours</div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Activity level</label>
                  <input type="range" min="1" max="5" step="1" value={form.activityLevel} onChange={(event) => setForm((current) => ({ ...current, activityLevel: Number(event.target.value) }))} className="w-full accent-cyan-500" />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Level {form.activityLevel}</div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Goal</label>
                <select value={form.goal} onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {goalOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>

              <button type="button" onClick={handleGenerate} disabled={isUploading || isGenerating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950">
                {isGenerating ? <span className="inline-flex items-center gap-2"><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Sparkles className="h-5 w-5" /></motion.span>Generating report...</span> : <span className="inline-flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Generate physical report</span>}
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="glass rounded-[2rem] border border-white/25 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            {!report ? (
              <div className="flex h-full min-h-[560px] flex-col justify-between rounded-[1.75rem] bg-gradient-to-b from-sky-500/10 to-emerald-500/5 p-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-600 dark:text-sky-300">report coverage</p>
                  <h3 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Diet plan, workout schedule, recovery, and progress scan.</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">The analysis focuses on the next actionable meal, the next workout block, and the recovery habits that actually move your score.</p>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-3xl bg-white/80 p-4 shadow-sm dark:bg-slate-950/50"><div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><ChefHat className="h-4 w-4 text-sky-500" /> Diet guidance</div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Balanced meals, meal timing, and protein targets.</p></div>
                  <div className="rounded-3xl bg-white/80 p-4 shadow-sm dark:bg-slate-950/50"><div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><Trophy className="h-4 w-4 text-emerald-500" /> Weekly training plan</div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Strength, mobility, and cardio structure.</p></div>
                  <div className="rounded-3xl bg-white/80 p-4 shadow-sm dark:bg-slate-950/50"><div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><ImagePlus className="h-4 w-4 text-cyan-500" /> Photo-based trend scan</div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Optional image storage in Cloudinary for progress review.</p></div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.32em] text-sky-300">{report.title}</p>
                      <h3 className="mt-2 text-2xl font-bold">{report.subtitle}</h3>
                    </div>
                    <div className="rounded-3xl bg-white/10 px-4 py-3 text-right">
                      <div className="text-xs uppercase tracking-[0.3em] text-sky-300">score</div>
                      <div className="text-3xl font-black text-white">{report.score}%</div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-4">
                    {report.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.26em] text-sky-300/80">{metric.label}</p><div className="mt-2 text-2xl font-bold text-white">{metric.value}</div><p className="mt-1 text-xs leading-5 text-slate-300">{metric.detail}</p></div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 dark:border-slate-700 dark:bg-slate-950/40">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">analysis snapshot</p>
                    <p className="mt-2 text-base leading-7 text-slate-700 dark:text-slate-300">{report.summary}</p>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white"><Activity className="h-5 w-5 text-sky-500" /> Findings</h4>
                    <div className="space-y-3">{report.findings.map((item) => <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-100/80 p-4 dark:bg-slate-900/70"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" /><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p></div>)}</div>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white"><Dumbbell className="h-5 w-5 text-emerald-500" /> Recommendations</h4>
                    <div className="space-y-3">{report.recommendations.map((item) => <div key={item} className="flex items-start gap-3 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</p></div>)}</div>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white"><Waves className="h-5 w-5 text-cyan-500" /> Suggested activities</h4>
                    <div className="grid gap-3 sm:grid-cols-3">{report.activities.map((item) => <div key={item} className="rounded-2xl bg-slate-900 px-4 py-5 text-sm leading-6 text-white shadow-lg shadow-slate-950/20">{item}</div>)}</div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100">{report.caution}</div>

                  <button type="button" onClick={() => { setReport(null); setFile(null); setPreview(null); }} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] dark:bg-white dark:text-slate-950">
                    <RefreshCw className="h-4 w-4" /> Run another analysis
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </section>
      </div>
    </div>
  );
}
