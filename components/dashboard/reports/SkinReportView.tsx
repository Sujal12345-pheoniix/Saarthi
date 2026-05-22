"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Flame,
  ScanFace,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from "lucide-react";

type SkinReport = {
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

const skinTypes = ["Balanced", "Dry", "Oily", "Combination", "Sensitive"];
const commonConcerns = ["Dry patches", "Acne marks", "Dullness", "Redness", "Oiliness", "Uneven texture"];

const defaultForm = {
  skinType: "Balanced",
  hydration: 68,
  sunExposure: 3,
  sleepHours: 7,
  concerns: ["Dullness"],
};

export default function SkinReportView() {
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<SkinReport | null>(null);
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
    let active = true;

    fetch("/api/reports/skin")
      .then((response) => response.json())
      .then((data) => {
        if (!active || !data?.report) {
          return;
        }

        setReport(data.report);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const selectedConcernSummary = useMemo(() => form.concerns.join(" · "), [form.concerns]);

  const handleConcernToggle = (concern: string) => {
    setForm((current) => {
      const nextConcerns = current.concerns.includes(concern)
        ? current.concerns.filter((item) => item !== concern)
        : [...current.concerns, concern];

      return { ...current, concerns: nextConcerns };
    });
  };

  const uploadImage = async () => {
    if (!file) {
      return null;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "saarthi/skin");

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

      const response = await fetch("/api/reports/skin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skinType: form.skinType,
          concerns: form.concerns,
          hydration: form.hydration,
          sunExposure: form.sunExposure,
          sleepHours: form.sleepHours,
          imageUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to generate skin report.");
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.16),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.02),transparent_60%)]" />
      <div className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-40 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[2rem] border border-white/20 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl"
          >
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600 dark:text-emerald-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1">
                <WandSparkles className="h-3.5 w-3.5" /> Dermatology engine
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-slate-600 dark:text-slate-300">
                <ScanFace className="h-3.5 w-3.5" /> AI skin scan
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Skin report built like a dermatologist would explain it.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Upload a clean face photo, choose the concerns you want tracked, and generate a clear plan for hydration, barrier repair, sun protection, and daily skin activities.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {report?.metrics?.slice(0, 3).map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:bg-slate-900/50">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{metric.label}</p>
                  <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{metric.value}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{metric.detail}</p>
                </div>
              ))}

              {!report && (
                <div className="rounded-3xl border border-dashed border-emerald-300/70 bg-emerald-500/5 p-4 dark:border-emerald-500/30">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <Flame className="h-4 w-4" /> Live tracking ready
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    The first scan will generate your dermatologist-style report and save it to Neon.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18, rotateX: 14 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ perspective: 1200 }}
            className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.3)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.35),transparent_30%),linear-gradient(160deg,rgba(15,23,42,1),rgba(15,23,42,0.85))]" />
            <motion.div
              animate={{ rotateY: [0, 12, 0, -10, 0], rotateX: [0, 4, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex h-full min-h-[320px] items-center justify-center"
            >
              <div className="absolute inset-x-10 top-8 h-1 rounded-full bg-emerald-400/70 shadow-[0_0_24px_rgba(52,211,153,0.9)]" />
              <div className="absolute inset-y-8 left-1/2 w-px bg-white/10" />
              <div className="absolute inset-x-0 bottom-6 text-center text-xs uppercase tracking-[0.4em] text-emerald-200/60">
                scan depth 92%
              </div>
              <div className="relative flex h-60 w-60 items-center justify-center rounded-[2.25rem] border border-white/15 bg-white/5 p-3 backdrop-blur-xl">
                <div className="absolute inset-3 rounded-[1.8rem] border border-emerald-300/25" />
                <div className="absolute inset-6 rounded-[1.6rem] bg-gradient-to-br from-emerald-300/20 to-cyan-300/10 blur-xl" />
                <div className="absolute inset-10 rounded-full bg-gradient-to-br from-white/20 to-emerald-300/10" />
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [0, 4, 0, -4, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full border border-white/20 bg-slate-950/80 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
                >
                  <div className="text-center">
                    <ScanFace className="mx-auto mb-3 h-12 w-12 text-emerald-300" />
                    <div className="text-lg font-bold text-white">Barrier scan</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.3em] text-emerald-200/70">live report core</div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-[2rem] border border-white/25 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Scan inputs</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Today: {selectedConcernSummary || "No concerns selected"}</p>
              </div>
              <div className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                confidence {report?.confidence ?? 91}%
              </div>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-5 transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950/40">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950 dark:text-white">Upload a face photo</div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Saved to Cloudinary for scan comparison and trend history.</p>
                  </div>
                </div>
                {(preview || report?.imageUrl) && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/30">
                    <img src={preview || report?.imageUrl || undefined} alt="Skin preview" className="h-56 w-full object-cover" />
                  </div>
                )}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Skin type</label>
                  <select
                    value={form.skinType}
                    onChange={(event) => setForm((current) => ({ ...current, skinType: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-0 transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {skinTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Sleep hours</label>
                  <input
                    type="range"
                    min="4"
                    max="10"
                    step="0.5"
                    value={form.sleepHours}
                    onChange={(event) => setForm((current) => ({ ...current, sleepHours: Number(event.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{form.sleepHours} hours</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Hydration level</label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={form.hydration}
                    onChange={(event) => setForm((current) => ({ ...current, hydration: Number(event.target.value) }))}
                    className="w-full accent-cyan-500"
                  />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{form.hydration}%</div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Sun exposure</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={form.sunExposure}
                    onChange={(event) => setForm((current) => ({ ...current, sunExposure: Number(event.target.value) }))}
                    className="w-full accent-orange-500"
                  />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{form.sunExposure}/10</div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Concerns to track</p>
                <div className="flex flex-wrap gap-2">
                  {commonConcerns.map((concern) => {
                    const active = form.concerns.includes(concern);
                    return (
                      <button
                        key={concern}
                        type="button"
                        onClick={() => handleConcernToggle(concern)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          active
                            ? "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        }`}
                      >
                        {concern}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isUploading || isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {isGenerating ? (
                  <span className="inline-flex items-center gap-2">
                    <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Sparkles className="h-5 w-5" />
                    </motion.span>
                    Generating report...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ArrowRight className="h-5 w-5" /> Generate skin report
                  </span>
                )}
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="glass rounded-[2rem] border border-white/25 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          >
            {!report ? (
              <div className="flex h-full min-h-[560px] flex-col justify-between rounded-[1.75rem] bg-gradient-to-b from-emerald-500/10 to-cyan-500/5 p-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-600 dark:text-emerald-300">what the report will include</p>
                  <h3 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Barrier care, UV defense, hydration, and routine coaching.</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    The skin report reads like a focused dermatology note: what looks off, what matters most, and what to do next.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-3xl bg-white/70 p-4 shadow-sm dark:bg-slate-950/50">
                    <div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Personalized recommendations
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Morning, evening, and mid-day habits with clear next steps.</p>
                  </div>
                  <div className="rounded-3xl bg-white/70 p-4 shadow-sm dark:bg-slate-950/50">
                    <div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                      <Droplets className="h-4 w-4 text-cyan-500" /> Hydration and barrier score
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">A trend-friendly score that updates as you track scans.</p>
                  </div>
                  <div className="rounded-3xl bg-white/70 p-4 shadow-sm dark:bg-slate-950/50">
                    <div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                      <AlertCircle className="h-4 w-4 text-orange-500" /> Safety note
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This is wellness guidance, not a medical diagnosis.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.32em] text-emerald-300">{report.title}</p>
                      <h3 className="mt-2 text-2xl font-bold">{report.subtitle}</h3>
                    </div>
                    <div className="rounded-3xl bg-white/10 px-4 py-3 text-right">
                      <div className="text-xs uppercase tracking-[0.3em] text-emerald-300">score</div>
                      <div className="text-3xl font-black text-white">{report.score}%</div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {report.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.26em] text-emerald-300/80">{metric.label}</p>
                        <div className="mt-2 text-2xl font-bold text-white">{metric.value}</div>
                        <p className="mt-1 text-xs leading-5 text-slate-300">{metric.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 dark:border-slate-700 dark:bg-slate-950/40">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">clinical snapshot</p>
                    <p className="mt-2 text-base leading-7 text-slate-700 dark:text-slate-300">{report.summary}</p>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white">
                      <AlertCircle className="h-5 w-5 text-orange-500" /> What stood out
                    </h4>
                    <div className="space-y-3">
                      {report.findings.map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-100/80 p-4 dark:bg-slate-900/70">
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Recommendations
                    </h4>
                    <div className="space-y-3">
                      {report.recommendations.map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white">
                      <Sparkles className="h-5 w-5 text-cyan-500" /> Daily activities
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {report.activities.map((item) => (
                        <div key={item} className="rounded-2xl bg-slate-900 px-4 py-5 text-sm leading-6 text-white shadow-lg shadow-slate-950/20">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100">
                    {report.caution}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setReport(null);
                      setFile(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] dark:bg-white dark:text-slate-950"
                  >
                    Run another scan
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
