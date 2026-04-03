import React from "react";
import { Lock, ArrowRight, AlertTriangle, Wrench, CheckCircle2, BarChart3, Sparkles, Shield } from "lucide-react";
import type { TextSummary, TextSummaryDepth } from "@shared/types";

type CanonicalTier = 'observer' | 'alignment' | 'signal' | 'scorefix';

interface TextSummaryViewProps {
  summary: TextSummary;
  score: number;
  url?: string;
  tier?: CanonicalTier;
  /** @deprecated Use tier instead. Kept for PublicReportPage backward compat. */
  isObserver?: boolean;
  onUpgrade?: () => void;
  /** If provided, shows a CTA to switch to technical view (paid tiers only) */
  onSwitchTechnical?: () => void;
}

function scoreBadgeColor(score: number): string {
  if (score >= 75) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (score >= 50) return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  if (score >= 30) return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-red-400/30 bg-red-400/10 text-red-200";
}

function depthLabel(depth: TextSummaryDepth): { label: string; color: string; icon: React.ReactNode } {
  if (depth === 'full') return { label: 'Full Evidence Summary', color: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200', icon: <Sparkles className="h-3 w-3" /> };
  if (depth === 'standard') return { label: 'Detailed Summary', color: 'border-violet-400/30 bg-violet-400/10 text-violet-200', icon: <BarChart3 className="h-3 w-3" /> };
  return { label: 'Quick Summary', color: 'border-white/20 bg-white/5 text-white/60', icon: <Shield className="h-3 w-3" /> };
}

export default function TextSummaryView({
  summary,
  score,
  url,
  tier,
  isObserver: isObserverProp,
  onUpgrade,
  onSwitchTechnical,
}: TextSummaryViewProps) {
  const isObserver = isObserverProp ?? (tier ? tier === 'observer' : false);
  const isFull = summary.depth === 'full';
  const isStandard = summary.depth === 'standard';
  const depthMeta = depthLabel(summary.depth);

  return (
    <div className="space-y-6">
      {/* ── Score banner ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${scoreBadgeColor(score)}`}
          >
            Score: {score}/100
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${depthMeta.color}`}>
            {depthMeta.icon}
            {depthMeta.label}
          </span>
          {url && (
            <span className="truncate text-xs text-white/45">{url}</span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-white/80 whitespace-pre-line">
          {summary.intro}
        </p>
      </div>

      {/* ── Findings ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        {summary.findings.map((finding, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6 shadow-lg"
          >
            {/* Finding header + explanation */}
            <div className="flex items-start gap-3 mb-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                isFull
                  ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                  : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isFull ? 'text-cyan-400/60' : 'text-amber-400/60'}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isFull ? 'text-cyan-300/70' : 'text-amber-300/70'}`}>
                    Finding
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white/90 leading-snug">
                  {finding.title}
                </h3>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-white/70 mb-3 pl-10">
              {finding.explanation}
            </p>

            {/* Fix section — tier-differentiated */}
            {finding.fix ? (
              <div className={`ml-10 rounded-xl border p-4 ${
                isFull
                  ? 'border-cyan-400/20 bg-cyan-500/[0.06]'
                  : 'border-emerald-400/20 bg-emerald-500/[0.06]'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {isFull ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400/60 shrink-0" />
                  ) : (
                    <Wrench className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
                  )}
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    isFull ? 'text-cyan-300/70' : 'text-emerald-300/70'
                  }`}>
                    {isFull ? 'Evidence-based fix' : 'How to fix it'}
                  </p>
                </div>
                <p className={`text-sm leading-relaxed whitespace-pre-line ${
                  isFull ? 'text-cyan-100/60' : 'text-emerald-100/60'
                }`}>
                  {finding.fix}
                </p>
              </div>
            ) : isObserver ? (
              <div className="ml-10 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-4 flex items-center gap-3">
                <Lock className="h-4 w-4 shrink-0 text-violet-300/60" />
                <div className="flex-1">
                  <p className="text-xs text-violet-200/70">
                    Detailed fix guidance is available on paid plans.
                  </p>
                </div>
                {onUpgrade && (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-100 transition hover:bg-violet-500/25"
                  >
                    Upgrade
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* ── Priority order (alignment+ only) ───────────────────────── */}
      {!isObserver && summary.priority_order.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6 shadow-lg">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
            Recommended fix order
          </h3>
          <ol className="space-y-1.5 pl-1">
            {summary.priority_order.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-white/65">
                <span className="shrink-0 text-xs font-bold text-cyan-300/60 tabular-nums">
                  {idx + 1}.
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Closing ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6 shadow-lg">
        <p className="text-sm leading-relaxed text-white/70 whitespace-pre-line">
          {summary.closing}
        </p>
      </div>

      {/* ── Technical view CTA (paid tiers) ────────────────────────── */}
      {onSwitchTechnical && (
        <div className="rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-cyan-500/[0.06] via-[#111827] to-violet-500/[0.06] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/70 mb-0.5">
                Want the full technical breakdown?
              </p>
              <p className="text-xs text-white/45">
                View scores, code-level issues, category grades, platform benchmarks, and exportable reports.
              </p>
            </div>
            <button
              type="button"
              onClick={onSwitchTechnical}
              className="shrink-0 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Switch to Technical View
            </button>
          </div>
        </div>
      )}

      {/* ── Observer upgrade banner ────────────────────────────────── */}
      {isObserver && onUpgrade && (
        <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/[0.08] via-[#111827] to-cyan-500/[0.08] p-6">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-white/70">
              You are viewing the free summary. Paid plans include:
            </p>
            <ul className="mx-auto max-w-md space-y-1.5 text-left">
              <li className="flex items-start gap-2 text-xs text-white/55">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/60 mt-0.5" />
                Full findings with step-by-step fix guidance
              </li>
              <li className="flex items-start gap-2 text-xs text-white/55">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/60 mt-0.5" />
                Technical view with scores, grades, and code-level detail
              </li>
              <li className="flex items-start gap-2 text-xs text-white/55">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/60 mt-0.5" />
                Priority fix ordering and exportable reports
              </li>
              <li className="flex items-start gap-2 text-xs text-white/55">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/60 mt-0.5" />
                Competitor tracking, citation testing, and brand mentions
              </li>
            </ul>
            <button
              type="button"
              onClick={onUpgrade}
              className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-5 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25"
            >
              View Plans
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
