"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Camera,
  CircleCheck,
  Download,
  Eye,
  FileText,
  Gauge,
  Lock,
  PersonStanding,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { CLERK_ENABLED } from "@/lib/auth/clerk-config";

const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="font-display mt-4 text-4xl leading-[1.05] text-ink sm:text-5xl md:text-6xl">{title}</h2>
      {body && <p className="mt-5 text-lg leading-8 text-ink-2">{body}</p>}
    </Reveal>
  );
}

/* ───────────────────────── Pillars ───────────────────────── */

function SkinVisual() {
  return (
    <div className="relative mx-auto h-44 w-36 overflow-hidden rounded-[2.2rem] border border-line bg-gradient-to-b from-surface-2 to-surface">
      <svg viewBox="0 0 144 176" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <ellipse cx="72" cy="84" rx="44" ry="56" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
        {[
          [52, 70],
          [92, 70],
          [72, 50],
          [58, 104],
          [88, 104],
          [72, 128],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.2" fill="var(--skin)" opacity=".85" />
        ))}
        <rect x="40" y="58" width="24" height="24" rx="6" fill="none" stroke="var(--skin)" strokeDasharray="3 3" />
        <rect x="80" y="58" width="24" height="24" rx="6" fill="none" stroke="var(--skin)" strokeDasharray="3 3" />
      </svg>
      <div className="absolute inset-x-3 h-px animate-scan bg-[var(--skin)] shadow-[0_0_14px_var(--skin)]" />
    </div>
  );
}

function PostureVisual() {
  return (
    <svg viewBox="0 0 160 176" className="mx-auto h-44 w-40" aria-hidden="true">
      <line x1="80" y1="14" x2="80" y2="166" stroke="var(--line-strong)" strokeDasharray="4 4" />
      <g stroke="var(--body)" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <circle cx="80" cy="30" r="12" />
        <path d="M80 42 L80 96" />
        <path d="M52 56 L108 58" />
        <path d="M52 56 L44 92 M108 58 L116 94" />
        <path d="M64 98 L96 98" />
        <path d="M64 98 L60 160 M96 98 L100 160" />
      </g>
      <g fill="var(--surface)" stroke="var(--body)" strokeWidth="2">
        {[
          [52, 56],
          [108, 58],
          [64, 98],
          [96, 98],
          [80, 42],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" />
        ))}
      </g>
      <text x="114" y="50" fontSize="10" fill="var(--ink-3)" fontFamily="var(--font-geist-mono)">
        1.2°
      </text>
    </svg>
  );
}

function MindVisual() {
  const bars = [38, 52, 44, 66, 58, 74, 70];
  return (
    <div className="mx-auto flex h-44 w-48 items-end justify-between gap-2 px-2">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 8 }}
          whileInView={{ height: `${h}%` }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 * i, duration: 0.8, ease }}
          className="w-full rounded-t-lg"
          style={{ background: `color-mix(in oklab, var(--mind) ${40 + i * 8}%, transparent)` }}
        />
      ))}
    </div>
  );
}

const pillars = [
  {
    icon: ScanFace,
    color: "var(--skin)",
    title: "Skin",
    lead: "A clear photo becomes measurements.",
    body: "Saarthi maps your forehead, cheeks and chin, then counts reddish spots and measures redness, dark-spot contrast, texture and fine-line density — each with its unit and its limits.",
    visual: <SkinVisual />,
  },
  {
    icon: PersonStanding,
    color: "var(--body)",
    title: "Posture",
    lead: "Angles, not adjectives.",
    body: "A full-body photo gives shoulder and hip tilt, head offset and trunk lean, measured from body landmarks. Saarthi checks the framing first and tells you what one photo can't show.",
    visual: <PostureVisual />,
  },
  {
    icon: Brain,
    color: "var(--mind)",
    title: "Mind",
    lead: "Check in, in under a minute.",
    body: "Mood, stress, sleep and energy become a gentle trend line with grounding ideas for the day. Supportive coaching — never a diagnosis — with crisis resources always one tap away.",
    visual: <MindVisual />,
  },
];

export function Pillars() {
  return (
    <section id="pillars" className="scroll-mt-24 px-4 py-24 sm:px-6 md:py-32">
      <SectionHeading
        eyebrow="One companion, three lenses"
        title={
          <>
            See the whole picture,
            <br />
            <span className="italic text-ink-2">gently.</span>
          </>
        }
        body="Skin, body and mind are connected. Saarthi looks at each one carefully, then shows you how they fit together."
      />
      <div className="mx-auto mt-16 grid max-w-6xl gap-5 md:grid-cols-3">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08}>
            <article className="card group flex h-full flex-col overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]">
              <div className="relative border-b border-line bg-bg-elevated px-6 py-8">
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
                  style={{ background: `radial-gradient(60% 60% at 50% 40%, color-mix(in oklab, ${p.color} 12%, transparent), transparent)` }}
                />
                {p.visual}
              </div>
              <div className="flex flex-1 flex-col p-7">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in oklab, ${p.color} 14%, transparent)`, color: p.color }}
                  >
                    <p.icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-lg font-semibold text-ink">{p.title}</h3>
                </div>
                <p className="font-display mt-4 text-2xl leading-tight text-ink">{p.lead}</p>
                <p className="mt-3 text-[0.95rem] leading-7 text-ink-2">{p.body}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Honest by design ───────────────────────── */

const methods = [
  {
    icon: Camera,
    tag: "Computer vision",
    title: "Measured from your photo",
    body: "Landmark detection and pixel analysis on your actual image. Scores come with the formula that produced them.",
  },
  {
    icon: FileText,
    tag: "Your answers",
    title: "Estimated from what you tell us",
    body: "No photo? You still get a useful, rule-based estimate — clearly labelled as reported, not measured.",
  },
  {
    icon: Sparkles,
    tag: "AI synthesis",
    title: "Written over your saved reports",
    body: "An AI connects the dots across your reports. It never invents scores: the overall number is calculated by Saarthi.",
  },
];

export function Honest() {
  return (
    <section id="honest" className="scroll-mt-24 px-4 py-24 sm:px-6 md:py-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[#0f0d16] px-6 py-16 text-white sm:px-12 md:py-24">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#7c6cf6]/30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 h-[460px] w-[460px] rounded-full bg-[#e14f7a]/20 blur-[120px]" />
        <div className="relative grid grid-cols-1 gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/50">Honest by design</p>
            <h2 className="font-display mt-4 text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
              Every number says
              <br />
              <span className="italic text-white/60">where it came from.</span>
            </h2>
            <p className="mt-6 max-w-md text-lg leading-8 text-white/65">
              No random scores, no made-up confidence, no pretending a photo shows what it can&apos;t. If a photo is too
              dark or blurry, Saarthi asks for another instead of guessing.
            </p>
            <ul className="mt-8 space-y-3 text-[0.95rem] text-white/80">
              {[
                "Image quality is checked before any analysis",
                "Unmeasured values show “Not measured”, never a placeholder",
                "Wellness guidance — not medical diagnoses or prescriptions",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2fd3a6]" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="space-y-3">
            {methods.map((m, i) => (
              <Reveal key={m.tag} delay={i * 0.1}>
                <div className="group flex gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <m.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider text-white/70">
                      {m.tag}
                    </span>
                    <h3 className="mt-3 text-lg font-semibold">{m.title}</h3>
                    <p className="mt-1.5 text-[0.95rem] leading-7 text-white/60">{m.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

const steps = [
  {
    n: "01",
    icon: Camera,
    title: "Take a photo or check in",
    body: "A front-facing selfie in daylight, a full-body photo from 2–3 metres, or a one-minute mood check-in.",
  },
  {
    n: "02",
    icon: Gauge,
    title: "Saarthi measures carefully",
    body: "Quality checks first, then measurement. You watch each stage happen — usually in a few seconds.",
  },
  {
    n: "03",
    icon: Eye,
    title: "Read a plan you understand",
    body: "What stood out, why it matters, what to do this week — and a progress line that grows with every scan.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 px-4 py-24 sm:px-6 md:py-32">
      <SectionHeading
        eyebrow="How it works"
        title={
          <>
            Three steps.
            <span className="italic text-ink-2"> No jargon.</span>
          </>
        }
      />
      <div className="relative mx-auto mt-16 grid max-w-6xl gap-5 md:grid-cols-3">
        <div className="pointer-events-none absolute left-[16%] right-[16%] top-[52px] hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent md:block" />
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}>
            <div className="relative flex h-full flex-col items-center px-4 text-center">
              <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full border border-line bg-surface shadow-[var(--shadow-md)]">
                <s.icon className="h-7 w-7 text-ink" />
                <span className="absolute -right-1 -top-1 rounded-full bg-aurora px-2 py-0.5 font-mono text-[0.68rem] font-semibold text-white">
                  {s.n}
                </span>
              </div>
              <h3 className="mt-7 text-xl font-semibold text-ink">{s.title}</h3>
              <p className="mt-3 max-w-xs text-[0.95rem] leading-7 text-ink-2">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Privacy ───────────────────────── */

const privacy = [
  { icon: Lock, title: "Private by default", body: "Photos are stored privately and only viewable through short-lived signed links." },
  { icon: ShieldCheck, title: "Only ever yours", body: "Every request is tied to your signed-in account. Nobody else can read your reports." },
  { icon: Download, title: "Take it with you", body: "Export everything Saarthi stores about you as a single file, whenever you like." },
  { icon: Trash2, title: "Delete means delete", body: "Remove a photo or your entire account — images, reports and history." },
];

export function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-24 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <Reveal>
          <p className="eyebrow">Privacy</p>
          <h2 className="font-display mt-4 text-4xl leading-[1.05] text-ink sm:text-5xl md:text-6xl">
            Your body.
            <br />
            <span className="italic text-ink-2">Your data.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-8 text-ink-2">
            Health information deserves more care than a typical app gives it. Here is exactly how Saarthi handles yours.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {privacy.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="card-quiet h-full p-6 transition hover:bg-surface">
                <p.icon className="h-5 w-5 text-brand" />
                <h3 className="mt-4 font-semibold text-ink">{p.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-7 text-ink-2">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Final call to action ───────────────────────── */

export function FinalCta() {
  const start = CLERK_ENABLED ? "/sign-up" : "/dashboard";
  return (
    <section className="px-4 pb-24 sm:px-6 md:pb-32">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border border-line bg-surface px-6 py-20 text-center shadow-[var(--shadow-lg)] sm:px-12">
        <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 w-[700px] max-w-full rounded-full bg-aurora opacity-20 blur-[100px]" />
        <h2 className="font-display relative text-4xl leading-[1.05] text-ink sm:text-6xl">
          Begin with one photo.
          <br />
          <span className="text-aurora italic">Stay for the clarity.</span>
        </h2>
        <p className="relative mx-auto mt-6 max-w-lg text-lg leading-8 text-ink-2">
          Your first report takes about a minute. No credit card, no device, no jargon.
        </p>
        <div className="relative mt-10 flex justify-center">
          <ButtonLink href={start} size="lg" variant="aurora" className="group">
            Create my first report
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </ButtonLink>
        </div>
      </Reveal>
    </section>
  );
}
