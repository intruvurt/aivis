import React, { useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────
 * FeatureInstruction — highlighted "How to use" banner for tool pages.
 * Drop it at the top of any feature/tool page.
 *
 *   <FeatureInstruction
 *     headline="Run your first citation test"
 *     steps={["Enter a URL", "Pick query type", "Review results"]}
 *     benefit="See exactly where AI platforms cite — or skip — your pages."
 *   />
 * ────────────────────────────────────────────────────────────────── */

export interface FeatureInstructionProps {
  /** Short action headline, e.g. "Run your first audit" */
  headline: string;
  /** Ordered list of quick-start steps */
  steps: string[];
  /** One-line statement of what the user gains */
  benefit: string;
  /** Optional override icon (default Lightbulb) */
  icon?: LucideIcon;
  /** Optional accent colour class (default orange) */
  accentClass?: string;
  /** Start collapsed? (default false) */
  defaultCollapsed?: boolean;
}

export default function FeatureInstruction({
  headline,
  steps,
  benefit,
  icon: Icon = Lightbulb,
  accentClass = "text-orange-400 border-orange-500/30 bg-orange-500/[0.06]",
  defaultCollapsed = false,
}: FeatureInstructionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={`rounded-xl border px-4 py-3 sm:px-5 sm:py-4 ${accentClass} transition-all`}
    >
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Icon className="h-4.5 w-4.5 shrink-0 opacity-90" />
        <span className="flex-1 text-sm font-semibold tracking-tight text-white/90">
          {headline}
        </span>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronUp className="h-4 w-4 text-white/40" />
        )}
      </button>

      {/* Body — collapsible */}
      {!collapsed && (
        <div className="mt-3 space-y-2.5">
          <ol className="list-none space-y-1.5 pl-0.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-white/70">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-white/50">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <p className="text-[12px] italic leading-relaxed text-white/50">
            {benefit}
          </p>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * InfoTip — inline info icon with hover tooltip
 *
 *   <InfoTip text="This score reflects cross-platform citation readiness." />
 * ────────────────────────────────────────────────────────────────── */

export function InfoTip({ text, className = "" }: { text: string; className?: string }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className={`relative inline-flex cursor-help ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
      role="note"
      aria-label={text}
    >
      <svg
        className="h-3.5 w-3.5 text-white/35 hover:text-white/60 transition-colors"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>

      {show && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a1f2e] px-3 py-2 text-[11px] leading-relaxed text-white/75 shadow-xl">
          {text}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#1a1f2e]" />
        </span>
      )}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * ButtonTooltip — wraps an action button with a richer tooltip
 *
 *   <ButtonTooltip tip="Download full audit as JSON for import into your CI pipeline.">
 *     <button>...</button>
 *   </ButtonTooltip>
 * ────────────────────────────────────────────────────────────────── */

export function ButtonTooltip({
  tip,
  children,
  position = "top",
}: {
  tip: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}) {
  const [show, setShow] = useState(false);

  const posClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const caretClasses: Record<string, string> = {
    top: "absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#1a1f2e]",
    bottom: "absolute left-1/2 bottom-full -translate-x-1/2 border-4 border-transparent border-b-[#1a1f2e]",
    left: "absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-[#1a1f2e]",
    right: "absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1a1f2e]",
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className={`pointer-events-none absolute z-50 w-52 rounded-lg border border-white/10 bg-[#1a1f2e] px-3 py-2 text-[11px] leading-relaxed text-white/75 shadow-xl ${posClasses[position]}`}
        >
          {tip}
          <span className={caretClasses[position]} />
        </span>
      )}
    </span>
  );
}
