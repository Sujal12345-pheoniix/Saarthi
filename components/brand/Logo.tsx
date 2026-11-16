import { useId } from "react";

/** Saarthi lotus mark on the aurora gradient, drawn as SVG so it stays crisp at every size and theme. */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5B45E0" />
          <stop offset="0.45" stopColor="#8B5CF6" />
          <stop offset="0.8" stopColor="#E14F7A" />
          <stop offset="1" stopColor="#F08A24" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill={`url(#g${id})`} />
      <path d="M16 7.5c3.1 3.6 3.1 8.6 0 13-3.1-4.4-3.1-9.4 0-13Z" fill="#fff" />
      <path d="M8 12.8c4.3 0 7 3.3 8 7.7-4.8-.4-7.6-3.6-8-7.7Z" fill="#fff" fillOpacity=".82" />
      <path d="M24 12.8c-4.3 0-7 3.3-8 7.7 4.8-.4 7.6-3.6 8-7.7Z" fill="#fff" fillOpacity=".82" />
      <path
        d="M9.5 23.6c4.1 2 8.9 2 13 0"
        stroke="#fff"
        strokeOpacity=".9"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="font-display text-[1.6rem] leading-none tracking-tight text-ink">Saarthi</span>
    </span>
  );
}
