"use client";

import { motion } from "framer-motion";
import { ArrowRight, Brain, PersonStanding, ScanFace, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ScoreRing } from "@/components/ui/score-ring";
import { CLERK_ENABLED } from "@/lib/auth/clerk-config";

const ease = [0.22, 1, 0.36, 1] as const;

function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[30%] left-1/2 h-[900px] w-[1200px] -translate-x-1/2 animate-aurora opacity-60 blur-[90px] dark:opacity-40">
        <div className="absolute left-[10%] top-[30%] h-[420px] w-[420px] rounded-full bg-[#7c6cf6]/40" />
        <div className="absolute left-[42%] top-[18%] h-[380px] w-[480px] rounded-full bg-[#e14f7a]/25" />
        <div className="absolute right-[8%] top-[34%] h-[360px] w-[360px] rounded-full bg-[#f08a24]/25" />
      </div>
      <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] opacity-60" />
    </div>
  );
}

/** Illustrative product preview. Labelled as a sample so it is never mistaken for a real user's data. */
function PreviewCard() {
  const rows = [
    { icon: ScanFace, label: "Skin", note: "Computer vision · photo", value: 78, color: "var(--skin)" },
    { icon: PersonStanding, label: "Posture", note: "Computer vision · photo", value: 84, color: "var(--body)" },
    { icon: Brain, label: "Mind", note: "Your check-in answers", value: 71, color: "var(--mind)" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-aurora opacity-25 blur-3xl" />
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <p className="eyebrow">Sample report</p>
            <p className="mt-1 text-sm font-medium text-ink">Your wellness, this week</p>
          </div>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.7rem] font-medium text-ink-3">Illustration</span>
        </div>
        <div className="flex items-center gap-6 px-6 py-6">
          <ScoreRing value={78} size={118} gradient label="Overall" />
          <div className="space-y-2 text-sm text-ink-2">
            <p className="leading-6">
              An average of your three latest scores — calculated by Saarthi, not guessed by an AI.
            </p>
          </div>
        </div>
        <div className="space-y-1 px-3 pb-3">
          {rows.map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.12, duration: 0.5, ease }}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-surface-2"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in oklab, ${r.color} 14%, transparent)`, color: r.color }}
              >
                <r.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{r.label}</p>
                <p className="truncate text-xs text-ink-3">{r.note}</p>
              </div>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: r.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${r.value}%` }}
                  transition={{ delay: 0.8 + i * 0.12, duration: 1, ease }}
                />
              </div>
              <span className="w-8 text-right font-mono text-sm text-ink">{r.value}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6, ease }}
        className="absolute -bottom-16 -left-4 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:flex"
      >
        <ShieldCheck className="h-5 w-5 text-success" />
        <div>
          <p className="text-xs font-semibold text-ink">Photo quality checked</p>
          <p className="text-[0.7rem] text-ink-3">Blurry or dark photos are rejected, not guessed</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function Hero() {
  const start = CLERK_ENABLED ? "/sign-up" : "/dashboard";
  return (
    <section className="grain relative isolate overflow-hidden px-4 pb-24 pt-36 sm:px-6 md:pb-32 md:pt-44">
      <Aurora />
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1 pl-1 pr-3 text-xs text-ink-2 backdrop-blur"
          >
            <span className="rounded-full bg-aurora px-2 py-0.5 text-[0.68rem] font-semibold text-white">New</span>
            Skin &amp; posture analysis from a single photo
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease }}
            className="font-display mt-7 text-[3.2rem] leading-[0.98] text-ink sm:text-7xl lg:text-[5.4rem]"
          >
            Wellness guidance
            <br />
            that shows <span className="text-aurora italic">its work.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.16, ease }}
            className="mt-7 max-w-xl text-lg leading-8 text-ink-2"
          >
            Saarthi measures your skin and posture from a photo, listens to how you feel, and turns it into a calm,
            practical plan. Every number tells you how it was made — and what it can&apos;t tell you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease }}
            className="mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <ButtonLink href={start} size="lg" className="group">
              Start your first scan
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="#honest" size="lg" variant="secondary">
              See how it measures
            </ButtonLink>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-3"
          >
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Private photo storage
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> No diagnoses, ever
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rose" /> Export or delete anytime
            </li>
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease }}
        >
          <PreviewCard />
        </motion.div>
      </div>
    </section>
  );
}
