"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export const ease = [0.22, 1, 0.36, 1] as const;

export function PageHeader({
  eyebrow,
  title,
  description,
  accent,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  accent?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease }}
      className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
    >
      <div className="max-w-2xl">
        <p className="eyebrow flex items-center gap-2">
          {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
          {eyebrow}
        </p>
        <h1 className="font-display mt-3 text-4xl leading-[1.05] text-ink sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 text-[1.02rem] leading-7 text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </motion.header>
  );
}

export function Panel({
  children,
  className = "",
  delay = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease }}
      className={`card ${className}`}
      style={style}
    >
      {children}
    </motion.section>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  color = "var(--brand)",
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  color?: string;
  hint?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="font-mono text-sm text-ink-2">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ ["--range-fill" as string]: `${fill}%`, ["--range-color" as string]: color }}
      />
      {hint && <p className="mt-2 text-xs text-ink-3">{hint}</p>}
    </label>
  );
}

export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  color = "var(--brand)",
}: {
  options: readonly T[];
  selected: readonly T[];
  onToggle: (v: T) => void;
  color?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            aria-pressed={active}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              active ? "border-transparent text-white shadow-soft" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
            }`}
            style={active ? { background: color } : undefined}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full flex-wrap gap-1 rounded-2xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`relative flex-1 rounded-xl px-3 py-2 text-sm transition ${
            value === o.value ? "text-ink" : "text-ink-3 hover:text-ink"
          }`}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join("-")}`} className="absolute inset-0 rounded-xl bg-surface shadow-soft" />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  placeholder,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  unit: string;
  placeholder?: string;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="field pr-12"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{unit}</span>
      </div>
    </label>
  );
}
