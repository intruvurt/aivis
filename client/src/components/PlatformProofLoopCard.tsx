import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, RefreshCcw, Wand2 } from "lucide-react";

interface PlatformProofLoopCardProps {
  url?: string;
  score?: number;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

export default function PlatformProofLoopCard({
  url,
  score,
  compact = false,
  title = "Proof Loop",
  subtitle = "Use the platform as an operating loop: baseline, fix, validate, and share.",
}: PlatformProofLoopCardProps) {
  const encodedUrl = url ? encodeURIComponent(url) : "";
  const needsScoreFix = typeof score === "number" && score < 75;

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-cyan-200">{title}</div>
          <p className="mt-1 text-sm leading-6 text-cyan-50/90">{subtitle}</p>
        </div>
        {typeof score === "number" && (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-white/55">Current score</div>
            <div className="text-lg font-bold text-white">{score}</div>
          </div>
        )}
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {url && (
          <Link
            to={`/analyze?url=${encodedUrl}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-black/30"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Re-audit URL
          </Link>
        )}

        {url && needsScoreFix && (
          <Link
            to={`/score-fix?url=${encodedUrl}&source=proof-loop`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-black/30"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Open Score Fix
          </Link>
        )}

        <Link
          to="/app/workflow"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-black/30"
        >
          <FileText className="h-3.5 w-3.5" />
          Open Workflow
        </Link>
      </div>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-cyan-100/75">
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">1. Baseline</span>
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">2. Ship one fix</span>
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">3. Re-audit same URL</span>
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">4. Share measurable delta</span>
        </div>
      )}

      {url && (
        <div className="mt-3 text-xs text-cyan-100/70 inline-flex items-center gap-1.5">
          Keep the target fixed so improvements are attributable to the remediation, not a different page.
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
