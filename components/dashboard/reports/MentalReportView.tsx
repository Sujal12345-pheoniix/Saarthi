"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Heart,
  Moon,
  Sparkles,
  CloudRain,
  Sun,
  MessageSquareQuote,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  WandSparkles,
  Activity,
} from "lucide-react";

type MentalReport = {
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
};

const moods = [
  { value: 1, label: "Sad", icon: CloudRain },
  { value: 2, label: "Tired", icon: Moon },
  { value: 3, label: "Anxious", icon: Brain },
  { value: 4, label: "Calm", icon: Heart },
  { value: 5, label: "Happy", icon: Sun },
];

const defaultForm = {
  mood: 4,
  stress: 36,
  sleepHours: 7.5,
  energy: 3,
  journal: "",
};

export default function MentalReportView() {
  const [form, setForm] = useState(defaultForm);
  const [report, setReport] = useState<MentalReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/reports/mental")
      .then((response) => response.json())
      .then((data) => {
        if (data?.report) {
          setReport(data.report);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/reports/mental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to generate mental report.");
      }

      setReport(data.report);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.14),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.16),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.02),transparent_60%)]" />
      <div className="pointer-events-none absolute left-0 top-20 h-80 w-80 rounded-full bg-indigo-400/15 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-40 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[2rem] border border-white/25 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl">
            <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.32em] text-indigo-600 dark:text-indigo-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1"><WandSparkles className="h-3.5 w-3.5" /> Psychology guide</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1"><MessageSquareQuote className="h-3.5 w-3.5" /> Journal reflection</span>
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Mental health report with calm, practical, therapist-style guidance.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              This check-in focuses on mood, stress, sleep, and a short journal note so the advice feels specific, supportive, and useful for the next few hours.
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
                <div className="rounded-3xl border border-dashed border-indigo-300/60 bg-indigo-500/5 p-4 dark:border-indigo-500/30">
                  <div className="flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-300"><Activity className="h-4 w-4" /> Emotional check-in ready</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Generate your first report for grounded activities and stress support.</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950 p-6 text-white shadow-[0_30px_90px_rgba(15,23,42,0.3)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.28),transparent_30%),linear-gradient(160deg,rgba(15,23,42,1),rgba(2,6,23,0.9))]" />
            <motion.div animate={{ scale: [1, 1.04, 1], rotate: [0, 2, 0, -2, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="relative flex min-h-[320px] items-center justify-center">
              <div className="absolute inset-x-8 top-10 h-1 rounded-full bg-indigo-300/70 shadow-[0_0_24px_rgba(165,180,252,0.95)]" />
              <div className="relative flex h-64 w-64 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-xl">
                <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="flex h-40 w-40 items-center justify-center rounded-full border border-white/15 bg-slate-950/80">
                  <div className="text-center">
                    <Brain className="mx-auto mb-3 h-12 w-12 text-indigo-300" />
                    <div className="text-lg font-bold text-white">Calm engine</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.3em] text-indigo-200/70">thought reset</div>
                  </div>
                </motion.div>
              </div>
              <div className="absolute inset-x-0 bottom-6 text-center text-xs uppercase tracking-[0.35em] text-indigo-100/60">self regulation friendly</div>
            </motion.div>
          </motion.div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass rounded-[2rem] border border-white/25 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Mood inputs</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Stress currently at {form.stress}%.</p>
              </div>
              <div className="rounded-full bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">confidence {report?.confidence ?? 90}%</div>
            </div>

            <div className="mt-6 grid gap-5">
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">How are you feeling?</p>
                <div className="grid grid-cols-5 gap-2">
                  {moods.map((mood) => {
                    const active = form.mood === mood.value;
                    const Icon = mood.icon;
                    return (
                      <button
                        key={mood.value}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, mood: mood.value }))}
                        className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 transition ${active ? "border-indigo-500 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"}`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-xs font-semibold">{mood.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Stress level</label>
                <input type="range" min="0" max="100" value={form.stress} onChange={(event) => setForm((current) => ({ ...current, stress: Number(event.target.value) }))} className="w-full accent-indigo-500" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Sleep hours</label>
                  <input type="range" min="4" max="10" step="0.5" value={form.sleepHours} onChange={(event) => setForm((current) => ({ ...current, sleepHours: Number(event.target.value) }))} className="w-full accent-sky-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Energy</label>
                  <input type="range" min="1" max="5" step="1" value={form.energy} onChange={(event) => setForm((current) => ({ ...current, energy: Number(event.target.value) }))} className="w-full accent-cyan-500" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Journal note</label>
                <textarea value={form.journal} onChange={(event) => setForm((current) => ({ ...current, journal: event.target.value }))} placeholder="What happened, what you feel, and what you need today..." className="min-h-44 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>

              <button type="button" onClick={handleGenerate} disabled={isGenerating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950">
                {isGenerating ? <span className="inline-flex items-center gap-2"><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Sparkles className="h-5 w-5" /></motion.span>Generating report...</span> : <span className="inline-flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Analyze mental health</span>}
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="glass rounded-[2rem] border border-white/25 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            {!report ? (
              <div className="flex h-full min-h-[560px] flex-col justify-between rounded-[1.75rem] bg-gradient-to-b from-indigo-500/10 to-sky-500/5 p-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-indigo-600 dark:text-indigo-300">what you get</p>
                  <h3 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Mood analysis, stress relief activities, and a recovery plan.</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">The report is intentionally practical: it explains what your current state suggests and gives you the next actions to feel steadier.</p>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-3xl bg-white/80 p-4 shadow-sm dark:bg-slate-950/50"><div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><Activity className="h-4 w-4 text-indigo-500" /> Emotion score</div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">A quick read on your current regulation level.</p></div>
                  <div className="rounded-3xl bg-white/80 p-4 shadow-sm dark:bg-slate-950/50"><div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><Moon className="h-4 w-4 text-sky-500" /> Sleep and stress</div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The highest-impact levers for your mood this week.</p></div>
                  <div className="rounded-3xl bg-white/80 p-4 shadow-sm dark:bg-slate-950/50"><div className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><ShieldAlert className="h-4 w-4 text-orange-500" /> Support note</div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">If you feel unsafe, contact emergency support right away.</p></div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.32em] text-indigo-300">{report.title}</p>
                      <h3 className="mt-2 text-2xl font-bold">{report.subtitle}</h3>
                    </div>
                    <div className="rounded-3xl bg-white/10 px-4 py-3 text-right">
                      <div className="text-xs uppercase tracking-[0.3em] text-indigo-300">score</div>
                      <div className="text-3xl font-black text-white">{report.score}%</div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-4">
                    {report.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.26em] text-indigo-300/80">{metric.label}</p><div className="mt-2 text-2xl font-bold text-white">{metric.value}</div><p className="mt-1 text-xs leading-5 text-slate-300">{metric.detail}</p></div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 dark:border-slate-700 dark:bg-slate-950/40">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">supportive analysis</p>
                    <p className="mt-2 text-base leading-7 text-slate-700 dark:text-slate-300">{report.summary}</p>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white"><Brain className="h-5 w-5 text-indigo-500" /> Findings</h4>
                    <div className="space-y-3">{report.findings.map((item) => <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-100/80 p-4 dark:bg-slate-900/70"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p></div>)}</div>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white"><Sparkles className="h-5 w-5 text-sky-500" /> Recommendations</h4>
                    <div className="space-y-3">{report.recommendations.map((item) => <div key={item} className="flex items-start gap-3 rounded-2xl border border-sky-500/10 bg-sky-500/5 p-4"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" /><p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</p></div>)}</div>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white"><Heart className="h-5 w-5 text-rose-500" /> Activities</h4>
                    <div className="grid gap-3 sm:grid-cols-3">{report.activities.map((item) => <div key={item} className="rounded-2xl bg-slate-900 px-4 py-5 text-sm leading-6 text-white shadow-lg shadow-slate-950/20">{item}</div>)}</div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100">{report.caution}</div>

                  <button type="button" onClick={() => setReport(null)} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] dark:bg-white dark:text-slate-950">
                    <RefreshCw className="h-4 w-4" /> Reset mental check-in
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
