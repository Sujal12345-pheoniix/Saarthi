"use client";

import { motion } from "framer-motion";
import { useId } from "react";

/**
 * Circular score gauge (0–100). `value === null` renders an empty ring with an em dash — never a placeholder number.
 */
export function ScoreRing({
  value,
  size = 132,
  stroke = 10,
  color = "var(--brand)",
  label,
  gradient = false,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  gradient?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {gradient && (
          <defs>
            <linearGradient id={`sr${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand)" />
              <stop offset="50%" stopColor="var(--violet)" />
              <stop offset="100%" stopColor="var(--rose)" />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={gradient ? `url(#sr${id})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display leading-none text-ink" style={{ fontSize: size * 0.32 }}>
          {value === null ? "—" : Math.round(value)}
        </span>
        {label && (
          <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</span>
        )}
      </div>
      <span className="sr-only">
        {value === null ? `${label ?? "Score"}: not available` : `${label ?? "Score"}: ${Math.round(value)} out of 100`}
      </span>
    </div>
  );
}
