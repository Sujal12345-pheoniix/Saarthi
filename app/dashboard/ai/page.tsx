"use client";

import { motion } from "framer-motion";
import { Bot, Lock } from "lucide-react";
import Link from "next/link";

/**
 * The AI companion is not implemented yet (Phase 3). The previous page returned canned replies from a
 * setTimeout and claimed to have analysed the user's data; that mock has been removed rather than shown as real.
 */
export default function AICompanion() {
  return (
    <div className="p-8 max-w-5xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Bot className="w-8 h-8 text-primary-500" />
          Saarthi AI Companion
        </h1>
        <p className="text-slate-600 dark:text-slate-400">A conversational assistant grounded in your own reports.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 glass rounded-3xl flex flex-col items-center justify-center text-center p-10 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary-500/5 to-transparent pointer-events-none" />
        <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Coming soon</h2>
        <p className="mt-3 max-w-lg text-slate-600 dark:text-slate-400 leading-relaxed">
          The companion is not available yet. When it launches it will answer using your stored reports, with safety
          guidance built in. Until then, your reports and the combined AI synthesis are available on the Reports page.
        </p>
        <Link
          href="/dashboard/reports"
          className="mt-8 inline-flex items-center rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-500 transition-colors"
        >
          Go to Reports
        </Link>
      </motion.div>
    </div>
  );
}
