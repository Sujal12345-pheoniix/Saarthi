"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, CircleCheck, ImageUp, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SIDE = 480;

export interface PhotoGuide {
  title: string;
  tips: string[];
  illustration: ReactNode;
}

/** Reads natural size so an obviously small photo is caught before uploading (the server re-checks everything). */
function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function PhotoDropzone({
  file,
  onFile,
  existingUrl,
  guide,
  accent,
  disabled,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  existingUrl?: string | null;
  guide: PhotoGuide;
  accent: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function accept(f: File | undefined | null) {
    setError("");
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setError("Please choose a JPEG, PNG or WebP photo.");
    if (f.size > MAX_BYTES) return setError("That photo is over 10 MB. Please choose a smaller one.");
    if (f.size === 0) return setError("That file is empty. Please choose another photo.");
    const d = await readDimensions(f);
    if (!d) return setError("We couldn't open that file as an image. Please choose a JPEG, PNG or WebP photo.");
    if (Math.min(d.width, d.height) < MIN_SIDE) {
      return setError(`That photo is ${d.width}×${d.height}. Analysis needs at least ${MIN_SIDE} px on the short side.`);
    }
    setDims(d);
    onFile(f);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative overflow-hidden rounded-3xl border border-line bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Selected photo" className="h-80 w-full object-contain" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <CircleCheck className="h-4 w-4 text-[#2fd3a6]" /> Ready to analyse
                </p>
                <p className="truncate text-xs text-white/70">
                  {file?.name} · {dims ? `${dims.width}×${dims.height} · ` : ""}
                  {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => inputRef.current?.click()}
                  className="rounded-full bg-white/15 p-2 backdrop-blur transition hover:bg-white/25 disabled:opacity-50"
                  aria-label="Choose a different photo"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onFile(null)}
                  className="rounded-full bg-white/15 p-2 backdrop-blur transition hover:bg-white/25 disabled:opacity-50"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="drop"
            type="button"
            disabled={disabled}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void accept(e.dataTransfer.files?.[0]);
            }}
            className={`group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging ? "scale-[1.01] bg-surface" : "border-line-strong bg-surface-2/60 hover:bg-surface"
            }`}
            style={dragging ? { borderColor: accent } : undefined}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
              style={{ background: `radial-gradient(50% 60% at 50% 30%, color-mix(in oklab, ${accent} 10%, transparent), transparent)` }}
            />
            <div className="relative mb-5">{guide.illustration}</div>
            <span
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-card transition group-hover:-translate-y-0.5"
              style={{ background: accent }}
            >
              <ImageUp className="h-5 w-5" />
            </span>
            <p className="relative mt-4 font-medium text-ink">Drop a photo here, or click to choose</p>
            <p className="relative mt-1 text-sm text-ink-3">JPEG, PNG or WebP · up to 10 MB · at least 480 px</p>
          </motion.button>
        )}
      </AnimatePresence>

      {existingUrl && !preview && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-3">
          <Camera className="h-3.5 w-3.5" /> Your last photo is shown with your latest report below.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-2xl border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-[color-mix(in_oklab,var(--danger)_7%,transparent)] px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 rounded-2xl border border-line bg-bg-elevated p-4">
        <p className="text-sm font-medium text-ink">{guide.title}</p>
        <ul className="mt-2 grid gap-1.5 text-sm text-ink-2 sm:grid-cols-2">
          {guide.tips.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
