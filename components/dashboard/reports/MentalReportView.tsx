"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Brain, CloudRain, Heart, LifeBuoy, Moon, Smile, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader, Panel, SliderField, ease } from "@/components/analysis/primitives";
import { ReportDisplay, ReportSkeleton } from "@/components/analysis/ReportDisplay";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ReportView } from "@/features/reports/view-model";
import type { MentalQuestionnaire } from "@/features/wellness/schemas";
import { apiRequest, isAbortError } from "@/lib/api/client";

const ACCENT = "var(--mind)";

const MOODS = [
  { value: 1, label: "Low", icon: CloudRain },
  { value: 2, label: "Tired", icon: Moon },
  { value: 3, label: "Uneasy", icon: Brain },
  { value: 4, label: "Calm", icon: Heart },
  { value: 5, label: "Bright", icon: Sun },
];

const ENERGY = ["Drained", "Low", "Okay", "Good", "Charged"];

function SupportCard({ emphasis }: { emphasis: boolean }) {
  return (
    <div
      className={`flex gap-4 rounded-3xl border p-5 ${
        emphasis
          ? "border-[color-mix(in_oklab,var(--mind)_35%,transparent)] bg-[color-mix(in_oklab,var(--mind)_8%,transparent)]"
          : "border-line bg-surface"
      }`}
    >
      <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ACCENT }} />
      <div className="text-sm leading-6 text-ink-2">
        <p className="font-medium text-ink">If you&apos;re struggling, you don&apos;t have to carry it alone.</p>
        <p className="mt-1">
          If you feel unsafe or are thinking about harming yourself, contact your local emergency number now, or reach a
          crisis line in your country (for example, 988 in the US, 116 123 in the UK, or Tele-MANAS 14416 in India).
          Talking to someone you trust today also helps.
        </p>
      </div>
    </div>
  );
}

export default function MentalReportView() {
  const toast = useToast();
  const [form, setForm] = useState<MentalQuestionnaire>({ mood: 3, stress: 40, sleepHours: 7, energy: 3, journal: "" });
  const [report, setReport] = useState<ReportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    apiRequest<{ report: ReportView | null }>("/api/reports/mental", { signal: ctrl.signal })
      .then((d) => setReport(d.report))
      .catch((e) => {
        if (!isAbortError(e)) toast.error("Couldn't load your last check-in", e instanceof Error ? e.message : undefined);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [toast]);

  async function submit() {
    setRunning(true);
    try {
      const data = await apiRequest<{ report: ReportView }>("/api/reports/mental", { method: "POST", json: form });
      setReport(data.report);
      setForm((f) => ({ ...f, journal: "" }));
      toast.success("Check-in saved", "Thank you for taking a moment for yourself.");
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      toast.error("Couldn't save your check-in", e instanceof Error ? e.message : undefined);
    } finally {
      setRunning(false);
    }
  }

  const elevated = form.stress >= 70 || form.mood <= 2;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader
        eyebrow="Mind check-in"
        accent={ACCENT}
        title={
          <>
            How are you, <span className="italic text-ink-2">really?</span>
          </>
        }
        description="Under a minute. Your answers become a gentle read on your day and a few grounding ideas — supportive coaching, never a diagnosis."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-6 sm:p-8">
          <p className="text-sm font-medium text-ink">Mood right now</p>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
            {MOODS.map((m) => {
              const active = form.mood === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setForm((f) => ({ ...f, mood: m.value }))}
                  className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 transition ${
                    active ? "border-transparent text-white shadow-card" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                  }`}
                  style={active ? { background: ACCENT } : undefined}
                >
                  <m.icon className="h-6 w-6" />
                  <span className="text-xs font-medium sm:text-sm">{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-9 grid gap-8 sm:grid-cols-2">
            <SliderField
              label="Stress"
              value={form.stress}
              min={0}
              max={100}
              onChange={(v) => setForm((f) => ({ ...f, stress: v }))}
              format={(v) => `${v}/100`}
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

          <div className="mt-9">
            <p className="text-sm font-medium text-ink">Energy</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ENERGY.map((label, i) => {
                const active = form.energy === i + 1;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setForm((f) => ({ ...f, energy: i + 1 }))}
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${
                      active ? "border-transparent text-white" : "border-line-strong bg-surface text-ink-2 hover:text-ink"
                    }`}
                    style={active ? { background: ACCENT } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mt-9 block">
            <span className="text-sm font-medium text-ink">
              Anything on your mind? <span className="font-normal text-ink-3">(optional)</span>
            </span>
            <textarea
              value={form.journal}
              maxLength={5000}
              rows={4}
              onChange={(e) => setForm((f) => ({ ...f, journal: e.target.value }))}
              placeholder="A few words is enough…"
              className="field mt-3 resize-none leading-6"
            />
            <span className="mt-2 block text-xs text-ink-3">Used for this check-in only and not stored.</span>
          </label>

          <Button variant="aurora" size="lg" className="group mt-8 w-full" disabled={running} onClick={submit}>
            <Smile className="h-5 w-5" />
            {running ? "Saving…" : "Save my check-in"}
            {!running && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </Button>
        </Panel>

        <div className="space-y-6">
          <Panel className="relative overflow-hidden p-7" delay={0.06}>
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
              style={{ background: ACCENT }}
            />
            <p className="eyebrow">A small practice</p>
            <p className="font-display mt-3 text-2xl leading-snug text-ink">Breathe in for 4, hold for 4, out for 6.</p>
            <div className="my-8 flex justify-center">
              <motion.div
                animate={{ scale: [1, 1.35, 1.35, 1] }}
                transition={{ duration: 14, times: [0, 0.29, 0.57, 1], repeat: Infinity, ease: "easeInOut" }}
                className="h-24 w-24 rounded-full"
                style={{ background: `radial-gradient(circle, color-mix(in oklab, ${ACCENT} 55%, transparent), color-mix(in oklab, ${ACCENT} 10%, transparent))` }}
              />
            </div>
            <p className="text-sm leading-6 text-ink-2">Follow the circle for three rounds before you answer. It&apos;s okay to just notice.</p>
          </Panel>
          <SupportCard emphasis={elevated} />
        </div>
      </div>

      <div ref={resultRef} className="scroll-mt-24">
        <AnimatePresence mode="wait">
          {loading ? (
            <ReportSkeleton key="skeleton" />
          ) : report ? (
            <motion.div key={report.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
              <p className="eyebrow mb-4">Latest check-in</p>
              <ReportDisplay report={report} accent={ACCENT} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-quiet flex flex-col items-center px-6 py-16 text-center">
              <Brain className="h-8 w-8 text-ink-3" />
              <p className="font-display mt-4 text-2xl text-ink">Your first check-in will appear here</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-2">Check in regularly to see how your days trend over time.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
