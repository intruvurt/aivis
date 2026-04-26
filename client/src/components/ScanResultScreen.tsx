/**
 * ScanResultScreen — Full-page post-scan audit result view.
 *
 * Sections (top → bottom):
 *  1. Top bar       — URL anchor, live dot, timestamp  (trust signal)
 *  2. Hero          — Score ring + AI engine citation status chips
 *  3. Blockers row  — Grade pill + hard-blocker callouts
 *  4. Dimensions    — score-out-of-weight cards (9/20 pts format)
 *  5. Issues        — severity-triaged, color-coded, badge-labeled
 *  6. Fix list      — ranked with estimated point impact
 *  7. BRAG evidence — keyed BRAG-ID findings tied to live page
 *  8. Bottom bar    — Re-scan | Export PDF | Upgrade CTA
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Minus,
  RefreshCcw,
  Download,
  Zap,
  ChevronDown,
  ChevronRight,
  Shield,
  ArrowUpRight,
  TrendingUp,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnalysisResponse } from '@shared/types';
import { getScoreBand } from '../utils/scoreUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = 'observer' | 'starter' | 'alignment' | 'signal' | 'agency' | 'scorefix';

interface Props {
  result: AnalysisResponse;
  tier: Tier;
  onRerunAudit?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<string, number> = {
  'Schema & Structured Data': 20,
  'Content Depth': 18,
  'Technical Trust': 15,
  'Meta & Open Graph': 15,
  'AI Readability': 12,
  'Heading Structure': 10,
  'Security & Trust': 10,
};

function getDimensionWeight(label: string): number {
  if (DIMENSION_WEIGHTS[label] !== undefined) return DIMENSION_WEIGHTS[label];
  const l = label.toLowerCase();
  if (l.includes('schema')) return 20;
  if (l.includes('content')) return 18;
  if (l.includes('technical')) return 15;
  if (l.includes('meta') || l.includes('og')) return 15;
  if (l.includes('ai') || l.includes('read')) return 12;
  if (l.includes('head')) return 10;
  return 10;
}

const ENGINE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  claude: 'Claude',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierRank(tier: Tier): number {
  return ['observer', 'starter', 'alignment', 'signal', 'agency', 'scorefix'].indexOf(tier);
}
function atLeast(tier: Tier, required: Tier) {
  return tierRank(tier) >= tierRank(required);
}

/** Parse "18-32%" or "25%" into a midpoint integer */
function parseImpactPts(raw?: string, priority?: string): number {
  if (raw) {
    const rng = raw.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rng) return Math.round((parseInt(rng[1]) + parseInt(rng[2])) / 2);
    const single = raw.match(/(\d+)/);
    if (single) return parseInt(single[1]);
  }
  if (priority === 'high') return 20;
  if (priority === 'medium') return 10;
  return 4;
}

function fmtTimestamp(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ─── Engine citation chip ─────────────────────────────────────────────────────

function EngineChip({ name, score }: { name: string; score: number }) {
  const cited = score >= 70;
  const rare = score >= 40 && score < 70;

  if (cited) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium text-white/80 truncate">{name}</span>
        </div>
        <span className="text-xs font-semibold text-emerald-400 shrink-0">Citable</span>
      </div>
    );
  }

  if (rare) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium text-white/80 truncate">{name}</span>
        </div>
        <span className="text-xs font-semibold text-amber-400 shrink-0">Rare mentions</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/20">
      <div className="flex items-center gap-2 min-w-0">
        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span className="text-sm font-medium text-white/80 truncate">{name}</span>
      </div>
      <span className="text-xs font-semibold text-red-400 shrink-0">Not citable</span>
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const band = getScoreBand(score);
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div className="relative inline-flex items-center justify-center w-32 h-32 shrink-0">
      <svg viewBox="0 0 108 108" className="w-32 h-32 -rotate-90">
        {/* track */}
        <circle cx="54" cy="54" r={r} strokeWidth="9" fill="none" className="stroke-white/8" />
        {/* fill */}
        <circle
          cx="54"
          cy="54"
          r={r}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          stroke={band.hex}
          style={{
            strokeDasharray: circ,
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-3xl font-extrabold text-white">{score}</span>
        <span className="text-[11px] font-bold mt-1 tracking-wide" style={{ color: band.hex }}>
          {band.grade} — {band.label}
        </span>
      </div>
    </div>
  );
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ label, score, weight }: { label: string; score: number; weight: number }) {
  const earnedPts = Math.round((score / 100) * weight);
  const band = getScoreBand(score);
  const fillPct = `${score}%`;

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d111c]/70 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white/80 leading-tight">{label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${band.badgeClass}`}>
          {band.grade}
        </span>
      </div>

      {/* Points: earned / max */}
      <div className="flex items-end gap-1">
        <span className="text-2xl font-extrabold leading-none" style={{ color: band.hex }}>
          {earnedPts}
        </span>
        <span className="text-sm text-white/35 mb-0.5">/ {weight} pts</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: fillPct, backgroundColor: band.hex }}
        />
      </div>
    </div>
  );
}

// ─── Severity bullet styling ──────────────────────────────────────────────────

const SEV_STYLE: Record<string, { dot: string; badge: string; border: string }> = {
  critical: {
    dot: 'bg-red-400',
    badge: 'text-red-300 bg-red-500/10 border-red-500/25',
    border: 'border-red-500/15',
  },
  high: {
    dot: 'bg-orange-400',
    badge: 'text-orange-300 bg-orange-500/10 border-orange-500/25',
    border: 'border-orange-500/15',
  },
  medium: {
    dot: 'bg-amber-400',
    badge: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
    border: 'border-amber-500/15',
  },
  low: {
    dot: 'bg-white/25',
    badge: 'text-white/40 bg-white/5 border-white/10',
    border: 'border-white/8',
  },
};

// ─── Issue row ────────────────────────────────────────────────────────────────

function IssueRow({
  issue,
}: {
  issue: {
    id: string;
    finding: string;
    severity: string;
    evidence_ids: string[];
    actual_fix: string;
    evidence_excerpt?: string;
    evidence_type: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const s = SEV_STYLE[issue.severity] ?? SEV_STYLE.low;

  return (
    <div className={`rounded-lg border ${s.border} bg-white/[0.018] overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.025] transition-colors"
      >
        {/* severity dot */}
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${s.badge}`}
            >
              {issue.severity}
            </span>
            <span className="text-[10px] font-mono text-white/25 uppercase tracking-wider">
              {issue.id}
            </span>
          </div>
          <p className="text-sm text-white/80 leading-snug">{issue.finding}</p>
        </div>

        {open ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
          {issue.evidence_excerpt && (
            <blockquote className="text-xs text-white/50 italic border-l-2 border-white/15 pl-3 leading-relaxed">
              {issue.evidence_excerpt}
            </blockquote>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/60 mb-1.5">
              Required fix
            </p>
            <p className="text-sm text-white/65 leading-relaxed">{issue.actual_fix}</p>
          </div>
          {issue.evidence_ids?.length > 0 && (
            <p className="text-[10px] text-white/25 font-mono">
              Evidence IDs: {issue.evidence_ids.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fix row ──────────────────────────────────────────────────────────────────

function FixRow({
  rank,
  rec,
  pts,
}: {
  rank: number;
  rec: {
    title: string;
    description: string;
    priority: string;
    category: string;
    impact: string;
    implementation: string;
    estimatedVisibilityLoss?: string;
    consequenceStatement?: string;
    brag_id?: string;
  };
  pts: number;
}) {
  const [open, setOpen] = useState(false);
  const priorityColor =
    rec.priority === 'high'
      ? 'text-red-300'
      : rec.priority === 'medium'
        ? 'text-amber-300'
        : 'text-white/40';
  const priorityBadge =
    rec.priority === 'high'
      ? 'text-red-300 bg-red-500/10 border-red-500/25'
      : rec.priority === 'medium'
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
        : 'text-white/40 bg-white/5 border-white/10';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.018] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        {/* rank */}
        <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-xs font-bold text-white/50">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${priorityBadge}`}
            >
              {rec.priority}
            </span>
            <span className="text-[10px] text-white/30">{rec.category}</span>
          </div>
          <p className="text-sm font-semibold text-white/85">{rec.title}</p>
        </div>

        {/* point impact */}
        <div className="shrink-0 text-right">
          <span className="text-sm font-bold text-emerald-400">+{pts}</span>
          <span className="text-[10px] text-white/30 block leading-none">pts est.</span>
        </div>

        {open ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-1" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/20 shrink-0 mt-1" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
          <p className="text-sm text-white/60 leading-relaxed">{rec.description}</p>

          {rec.consequenceStatement && (
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-400/70 mb-1">
                AI consequence
              </p>
              <p className="text-xs text-orange-200/70 leading-relaxed">
                {rec.consequenceStatement}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/60 mb-1.5">
              How to fix
            </p>
            <p className="text-sm text-white/60 leading-relaxed">{rec.implementation}</p>
          </div>

          {rec.brag_id && (
            <p className="text-[10px] font-mono text-white/20">BRAG-ID: {rec.brag_id}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BRAG finding row ─────────────────────────────────────────────────────────

function BragRow({
  finding,
}: {
  finding: {
    brag_id: string;
    title: string;
    severity: string;
    is_hard_blocker: boolean;
    evidence_keys: string[];
    evidence_value?: string;
    confidence: number;
    remediation?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const s = SEV_STYLE[finding.severity] ?? SEV_STYLE.low;
  const confPct = Math.round(finding.confidence * 100);

  return (
    <div className={`rounded-lg border ${s.border} bg-white/[0.018] overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.025] transition-colors"
      >
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            {/* BRAG key identifier — the differentiated trust layer */}
            <span className="text-[10px] font-mono text-cyan-400/70 bg-cyan-500/8 border border-cyan-500/20 px-1.5 py-0.5 rounded">
              {finding.brag_id}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${s.badge}`}
            >
              {finding.severity}
            </span>
            {finding.is_hard_blocker && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-red-300 bg-red-500/10 border border-red-500/25 px-1.5 py-0.5 rounded">
                Hard blocker
              </span>
            )}
          </div>
          <p className="text-sm text-white/80 leading-snug">{finding.title}</p>
        </div>

        <div className="shrink-0 text-right">
          <span className="text-[10px] text-white/30">{confPct}% conf.</span>
        </div>

        {open ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
          {finding.evidence_value && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/30 mb-1.5">
                Evidence from live page
              </p>
              <blockquote className="text-xs text-white/50 italic border-l-2 border-cyan-400/25 pl-3 leading-relaxed font-mono">
                {finding.evidence_value}
              </blockquote>
            </div>
          )}
          {finding.evidence_keys?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {finding.evidence_keys.map((k, i) => (
                <span
                  key={i}
                  className="text-[10px] font-mono text-white/30 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded"
                >
                  {k}
                </span>
              ))}
            </div>
          )}
          {finding.remediation && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/60 mb-1.5">
                Remediation
              </p>
              <p className="text-sm text-white/60 leading-relaxed">{finding.remediation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d111c]/80 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/8 bg-white/[0.018]">
        <Icon className="h-4 w-4 text-cyan-400 shrink-0" />
        <span className="text-sm font-semibold text-white/90 tracking-tight">{title}</span>
        {badge && (
          <span className="ml-auto text-[10px] font-medium text-white/35 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Upgrade gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Lock className="h-6 w-6 text-white/20" />
      <p className="text-sm text-white/40">{feature} available on Alignment+</p>
      <Link
        to="/pricing"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all"
      >
        Upgrade <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScanResultScreen({ result, tier, onRerunAudit }: Props) {
  const score = result.visibility_score ?? 0;
  const band = getScoreBand(score);

  const canSeeDimensions = atLeast(tier, 'starter');
  const canSeeIssues = atLeast(tier, 'alignment');
  const canSeeFixes = atLeast(tier, 'starter');
  const canSeeBrag = atLeast(tier, 'alignment');

  // AI engine scores
  const engines = result.ai_platform_scores ?? {
    chatgpt: 0,
    perplexity: 0,
    google_ai: 0,
    claude: 0,
  };

  // Hard blockers — prefer BRAG findings flagged as hard blockers, fall back to high-priority recs
  const bragFindings = result.brag_validation?.findings ?? [];
  const hardBlockers =
    bragFindings.filter((f) => f.is_hard_blocker).length > 0
      ? bragFindings.filter((f) => f.is_hard_blocker).map((f) => f.title)
      : (result.recommendations ?? [])
          .filter((r) => r.priority === 'high')
          .slice(0, 3)
          .map((r) => r.title);

  // Dimensions
  const dims = (result.category_grades ?? []).map((g) => ({
    label: g.label,
    score: g.score,
    weight: getDimensionWeight(g.label),
  }));

  // Issues — sorted: critical → high → medium → low
  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const issues = [...(result.evidence_fix_plan?.issues ?? [])].sort(
    (a, b) =>
      (SEV_ORDER[a.severity as keyof typeof SEV_ORDER] ?? 3) -
      (SEV_ORDER[b.severity as keyof typeof SEV_ORDER] ?? 3)
  );

  // Fixes — sorted by priority
  const fixes = [...(result.recommendations ?? [])].sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 };
    return (o[a.priority as keyof typeof o] ?? 2) - (o[b.priority as keyof typeof o] ?? 2);
  });

  // Metadata
  const isLive = !result.cached;
  const domain = getDomain(result.url ?? '');
  const ts = fmtTimestamp(result.analyzed_at);

  // Export handler — download JSON report
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aivis-audit-${domain}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-28">
      {/* ─── 1. TOP BAR ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-[#0d111c]/90 px-4 py-3 flex flex-wrap items-center gap-3">
        {/* URL anchor */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-mono text-white/60 hover:text-cyan-300 transition-colors truncate"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <span className="truncate">{result.url}</span>
          </a>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`}
            />
            <span
              className={`text-[11px] font-semibold ${isLive ? 'text-emerald-400' : 'text-white/30'}`}
            >
              {isLive ? 'LIVE' : 'CACHED'}
            </span>
          </div>

          {/* Timestamp */}
          <span className="text-[11px] text-white/30 font-mono">{ts}</span>

          {/* Processing time */}
          {result.processing_time_ms && (
            <span className="text-[11px] text-white/20">
              {(result.processing_time_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* ─── 2. HERO — Score ring + Engine chips ────────────────────────── */}
      <div className="rounded-xl border border-white/12 bg-[#0d111c]/90 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-5 p-5">
          {/* Score ring */}
          <div className="flex flex-col items-center gap-3">
            <ScoreRing score={score} />

            {/* Grade pill */}
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${band.badgeClass}`}
            >
              {score >= 70 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : score >= 40 ? (
                <Minus className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {band.label}
            </span>
          </div>

          {/* Engine citation chips */}
          <div className="flex-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">
              AI Engine Citation Status
            </p>
            {(Object.entries(engines) as [string, number][]).map(([key, val]) => (
              <EngineChip key={key} name={ENGINE_LABELS[key] ?? key} score={val} />
            ))}
          </div>
        </div>

        {/* Hard-blocker callouts — directly under grade pill */}
        {hardBlockers.length > 0 && (
          <div className="px-5 py-4 border-t border-white/8 bg-red-500/[0.04]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 mb-2">
              Hard blockers — capping your score
            </p>
            <div className="space-y-1.5">
              {hardBlockers.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <XCircle className="h-3.5 w-3.5 text-red-400/60 shrink-0 mt-0.5" />
                  <span className="text-sm text-red-200/70 leading-snug">{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {result.summary && (
          <div className="px-5 py-3 border-t border-white/8">
            <p className="text-sm text-white/55 leading-relaxed">{result.summary}</p>
          </div>
        )}
      </div>

      {/* ─── 3. DIMENSION CARDS ─────────────────────────────────────────── */}
      {dims.length > 0 && (
        <Section
          icon={TrendingUp}
          title="Score Breakdown by Dimension"
          badge={`${dims.length} categories`}
        >
          {canSeeDimensions ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {dims.map((d, i) => (
                <DimensionCard key={i} label={d.label} score={d.score} weight={d.weight} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {/* First 2 visible as teaser */}
              {dims.slice(0, 2).map((d, i) => (
                <DimensionCard key={i} label={d.label} score={d.score} weight={d.weight} />
              ))}
              {/* Rest blurred */}
              {dims.slice(2).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/8 bg-[#0d111c]/50 px-4 py-3 blur-[3px] pointer-events-none select-none opacity-40"
                >
                  <div className="h-4 bg-white/10 rounded mb-2 w-3/4" />
                  <div className="h-7 bg-white/10 rounded w-1/2" />
                </div>
              ))}
              <UpgradeGate feature="Full dimension breakdown" />
            </div>
          )}
        </Section>
      )}

      {/* ─── 4. ISSUES TRIAGE ───────────────────────────────────────────── */}
      {issues.length > 0 && (
        <Section
          icon={AlertTriangle}
          title="Issues — Severity Triage"
          badge={`${issues.length} issues`}
        >
          {canSeeIssues ? (
            <div className="space-y-2">
              {issues.map((issue, i) => (
                <IssueRow key={i} issue={issue} />
              ))}
            </div>
          ) : (
            <UpgradeGate feature="Evidence-backed issues" />
          )}
        </Section>
      )}

      {/* ─── 5. FIX LIST ─────────────────────────────────────────────────── */}
      {fixes.length > 0 && (
        <Section icon={Zap} title="Priority Fix Engine" badge={`${fixes.length} ranked fixes`}>
          {canSeeFixes ? (
            <div className="space-y-2">
              {fixes.map((rec, i) => (
                <FixRow
                  key={i}
                  rank={i + 1}
                  rec={rec}
                  pts={parseImpactPts(rec.estimatedVisibilityLoss, rec.priority)}
                />
              ))}
            </div>
          ) : (
            <UpgradeGate feature="Ranked fix engine with point estimates" />
          )}
        </Section>
      )}

      {/* ─── 6. BRAG EVIDENCE BLOCK ─────────────────────────────────────── */}
      {bragFindings.length > 0 && (
        <Section
          icon={Shield}
          title="BRAG Evidence — Verified Findings"
          badge={`${bragFindings.length} findings · ${result.brag_validation?.root_hash ? 'chain verified' : 'unverified'}`}
        >
          {canSeeBrag ? (
            <>
              {/* Chain metadata strip */}
              {result.brag_validation && (
                <div className="flex flex-wrap items-center gap-3 mb-4 px-3 py-2 rounded-lg bg-white/[0.025] border border-white/8">
                  <span className="text-[10px] text-white/35 font-mono">
                    audit: {result.brag_validation.audit_id.slice(0, 12)}…
                  </span>
                  <span className="text-white/15">·</span>
                  <span className="text-[10px] text-white/35 font-mono">
                    root: {result.brag_validation.root_hash.slice(0, 16)}…
                  </span>
                  <span className="text-white/15">·</span>
                  <span className="text-[10px] text-white/35">
                    {result.brag_validation.rejected_count} claims rejected
                  </span>
                  <span className="text-white/15">·</span>
                  <span className="text-[10px] text-white/35">
                    gate v{result.brag_validation.gate_version}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {bragFindings.map((f, i) => (
                  <BragRow key={i} finding={f} />
                ))}
              </div>
            </>
          ) : (
            <UpgradeGate feature="BRAG evidence chain (Alignment+)" />
          )}
        </Section>
      )}

      {/* ─── 7. BOTTOM ACTION BAR (sticky) ──────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#080c14]/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Primary: Re-scan */}
          <button
            type="button"
            onClick={onRerunAudit}
            disabled={!onRerunAudit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-500 to-emerald-500 text-white hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
          >
            <RefreshCcw className="h-4 w-4" />
            Re-scan
          </button>

          {/* Secondary: Export */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white/70 border border-white/15 hover:border-white/30 hover:text-white/90 transition-all"
          >
            <Download className="h-4 w-4" />
            Export
          </button>

          {/* Upgrade CTA — shown when below alignment */}
          {!atLeast(tier, 'alignment') && (
            <Link
              to="/pricing"
              className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-violet-500/40 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-400/60 transition-all"
            >
              <Zap className="h-4 w-4" />
              Unlock continuous monitoring
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Score baseline label */}
          {atLeast(tier, 'alignment') && (
            <div className="ml-auto text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Baseline</p>
              <p className="text-sm font-bold" style={{ color: band.hex }}>
                {score}/100
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
