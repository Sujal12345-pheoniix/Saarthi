"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bot, MessageCircleHeart, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader, ease } from "@/components/analysis/primitives";
import { ButtonLink } from "@/components/ui/button";

/**
 * The AI companion is not implemented yet. A previous version returned canned replies from a setTimeout and
 * claimed to have analysed the user's data; that mock was removed rather than shown as real.
 */
const promises = [
  { icon: MessageCircleHeart, title: "Grounded in your reports", body: "It will answer from your own saved results — never invented numbers." },
  { icon: ShieldCheck, title: "Safety built in", body: "Crisis signals are handled with care and real resources, not chat." },
  { icon: Sparkles, title: "Yours to delete", body: "Conversations will be private, and deletable whenever you want." },
];

export default function AICompanion() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader
        eyebrow="Companion"
        title={
          <>
            A companion, <span className="italic text-ink-2">in the making.</span>
          </>
        }
        description="A conversational guide that knows your reports. We're building it carefully — it isn't available yet."
      />

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative overflow-hidden rounded-[28px] bg-[#0f0d16] px-6 py-14 text-center text-white sm:px-12"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[560px] max-w-full -translate-x-1/2 rounded-full bg-[#7c6cf6]/35 blur-[100px]" />
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-aurora shadow-[0_20px_50px_-12px_rgba(139,92,246,0.7)]"
        >
          <Bot className="h-7 w-7" />
        </motion.span>
        <h2 className="font-display relative mt-8 text-4xl">Coming soon</h2>
        <p className="relative mx-auto mt-3 max-w-lg leading-7 text-white/65">
          Until then, your reports and the combined AI synthesis are ready on the Reports page.
        </p>
        <div className="relative mt-8 flex justify-center">
          <ButtonLink href="/dashboard/reports" className="group bg-white !text-[#0f0d16]">
            Go to reports <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </ButtonLink>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-3">
        {promises.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.6, ease }}
            className="card p-6"
          >
            <p.icon className="h-5 w-5 text-brand" />
            <h3 className="mt-4 font-semibold text-ink">{p.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-2">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
