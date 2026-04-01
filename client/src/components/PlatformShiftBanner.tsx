import React from "react";
import { PLATFORM_NARRATIVE } from "../constants/platformNarrative";

interface PlatformShiftBannerProps {
  eyebrow?: string;
  title?: string;
  body?: string;
  bullets?: readonly string[];
  tone?: "cyan" | "emerald" | "amber";
}

const toneClasses = {
  cyan: {
    shell: "border-cyan-300/25 bg-cyan-500/10",
    eyebrow: "text-cyan-100",
    body: "text-cyan-50/90",
    bullet: "text-cyan-100/85",
  },
  emerald: {
    shell: "border-emerald-300/25 bg-emerald-500/10",
    eyebrow: "text-emerald-100",
    body: "text-emerald-50/90",
    bullet: "text-emerald-100/85",
  },
  amber: {
    shell: "border-amber-300/25 bg-amber-500/10",
    eyebrow: "text-amber-100",
    body: "text-amber-50/90",
    bullet: "text-amber-100/85",
  },
} as const;

export default function PlatformShiftBanner({
  eyebrow = "Category shift",
  title = PLATFORM_NARRATIVE.disruption,
  body = PLATFORM_NARRATIVE.oneLiner,
  bullets = PLATFORM_NARRATIVE.pillars,
  tone = "cyan",
}: PlatformShiftBannerProps) {
  const palette = toneClasses[tone];

  return (
    <div className={`rounded-2xl border p-4 ${palette.shell}`}>
      <h2 className={`text-sm font-semibold uppercase tracking-wide ${palette.eyebrow}`}>{eyebrow}</h2>
      <p className={`mt-2 text-sm leading-7 ${palette.body}`}>{title}</p>
      <p className={`mt-2 text-sm leading-7 ${palette.body}`}>{body}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {bullets.map((bullet) => (
          <span key={bullet} className={`rounded-full border border-white/10 bg-black/20 px-3 py-1 ${palette.bullet}`}>
            {bullet}
          </span>
        ))}
      </div>
    </div>
  );
}
