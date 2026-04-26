/**
 * AuditForensicReport — post-scan forensic results view.
 *
 * This is the primary results surface after a scan completes.
 * It replaces ComprehensiveAnalysis + TextSummaryView entirely.
 *
 * Structure (7 sections):
 *  1. Score header + verdict + AI platform citation status
 *  2. CITE LEDGER breakdown table (clickable → expands evidence)
 *  3. Evidence panel (evidence_fix_plan.issues with BRAG metadata)
 *  4. AI interpretation snapshot (what AI "sees" about the entity)
 *  5. Citation tracking table (answer_presence.evidence)
 *  6. Priority fix engine (ranked, consequence-framed)
 *  7. Trend / re-scan CTA
 *
 * Tier gating:
 *  observer  → sections 1 + 3-row teaser + UpgradeWall
 *  starter   → sections 1–2 + fix engine
 *  alignment → + evidence panels + AI interpretation + citation tracking
 *  signal    → + triple-check validation data
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Minus,
  Lock,
  Zap,
  TrendingUp,
  Eye,
  FileText,
  Shield,
  Brain,
  Target,
  RefreshCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnalysisResponse } from '@shared/types';
import UpgradeWall from './UpgradeWall';

/* ─── Tier helpers ─────────────────────────────────────────────────── */

type Tier = 'observer' | 'starter' | 'alignment' | 'signal' | 'agency' | 'scorefix';

function tierRank(tier: Tier): number {
  const order: Tier[] = ['observer', 'starter', 'alignment', 'signal', 'agency', 'scorefix'];
  return order.indexOf(tier);
}

function atLeast(tier: Tier, required: Tier): boolean {
  return tierRank(tier) >= tierRank(required);
}

/* ─── Grade/score utilities ─────────────────────────────────────────── */

const GRADE_META: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  A: {
    label: 'Excellent',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: CheckCircle2,
  },
  B: {
    label: 'Good',
    color: 'text-teal-300',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    icon: CheckCircle2,
  },
  C: {
    label: 'Moderate',
    color: 'text-yellow-300',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: Minus,
  },
  D: {
    label: 'Weak',
    color: 'text-orange-300',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: AlertTriangle,
  },
  F: {
    label: 'Critical',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: XCircle,
  },
};

function scoreToGrade(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function scoreToVerdict(score: number): { short: string; color: string } {
  if (score >= 80) return { short: 'Strong Citation Readiness', color: 'text-emerald-300' };
  if (score >= 60) return { short: 'Moderate Citation Readiness', color: 'text-teal-300' };
  if (score >= 40)
    return { short: 'Partial Visibility — Significant Gaps', color: 'text-yellow-300' };
  if (score >= 20)
    return { short: 'Weak Entity Signal — AI Avoids Citing', color: 'text-orange-300' };
  return { short: 'Critical Visibility Failure', color: 'text-red-400' };
}

/* ─── Category weight map ────────────────────────────────────────────── */
// Canonical weights — must stay in sync with scoring engine
const CATEGORY_WEIGHT_MAP: Record<string, number> = {
  'Schema & Structured Data': 20,
  'Content Depth': 18,
  'Technical Trust': 15,
  'Meta & Open Graph': 15,
  'AI Readability': 12,
  'Heading Structure': 10,
  'Security & Trust': 10,
};

function getCategoryWeight(label: string): number {
  // Try exact match first
  if (CATEGORY_WEIGHT_MAP[label] !== undefined) return CATEGORY_WEIGHT_MAP[label];
  // Fuzzy match on key words
  const lower = label.toLowerCase();
  if (lower.includes('schema')) return 20;
  if (lower.includes('content')) return 18;
  if (lower.includes('technical')) return 15;
  if (lower.includes('meta') || lower.includes('og')) return 15;
  if (lower.includes('ai') || lower.includes('read')) return 12;
  if (lower.includes('head')) return 10;
  if (lower.includes('security') || lower.includes('trust')) return 10;
  return 10;
}

/* ─── Platform citation status ─────────────────────────────────────── */

function platformStatus(score: number): {
  icon: React.FC<{ className?: string }>;
  label: string;
  color: string;
  bg: string;
} {
  if (score >= 70)
    return {
      icon: CheckCircle2,
      label: 'Cited',
      color: 'text-emerald-300',
      bg: 'bg-emerald-500/10',
    };
  if (score >= 40)
    return {
      icon: AlertTriangle,
      label: 'Rare mentions',
      color: 'text-yellow-300',
      bg: 'bg-yellow-500/10',
    };
  return { icon: XCircle, label: 'Not cited', color: 'text-red-400', bg: 'bg-red-500/10' };
}

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI Overviews',
  claude: 'Claude',
};

/* ─── Severity badge ────────────────────────────────────────────────── */

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    critical: { color: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/25' },
    high: { color: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/25' },
    medium: { color: 'text-yellow-300', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25' },
    low: { color: 'text-white/50', bg: 'bg-white/5', border: 'border-white/10' },
  };
  const s = map[severity] ?? map.low;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${s.color} ${s.bg} ${s.border}`}
    >
      {severity}
    </span>
  );
}

/* ─── Priority badge ────────────────────────────────────────────────── */

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    high: { color: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/25' },
    medium: { color: 'text-yellow-300', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25' },
    low: { color: 'text-white/45', bg: 'bg-white/5', border: 'border-white/10' },
  };
  const s = map[priority] ?? map.low;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${s.color} ${s.bg} ${s.border}`}
    >
      {priority}
    </span>
  );
}

/* ─── Section wrapper ───────────────────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  badge,
  children,
  className = '',
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#0d111c]/80 overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/8 bg-white/[0.02]">
        <Icon className="h-4 w-4 text-cyan-400 shrink-0" />
        <span className="text-sm font-semibold text-white/90 tracking-tight">{title}</span>
        {badge && (
          <span className="ml-auto text-[10px] font-medium text-white/40 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ─── Score ring ────────────────────────────────────────────────────── */

function ScoreRing({ score }: { score: number }) {
  const grade = scoreToGrade(score);
  const meta = GRADE_META[grade];
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28">
      <svg viewBox="0 0 96 96" className="w-28 h-28 -rotate-90">
        <circle cx="48" cy="48" r={r} strokeWidth="8" fill="none" className="stroke-white/10" />
        <circle
          cx="48"
          cy="48"
          r={r}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: dashOffset,
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className={
            grade === 'A'
              ? 'stroke-emerald-400'
              : grade === 'B'
                ? 'stroke-teal-400'
                : grade === 'C'
                  ? 'stroke-yellow-400'
                  : grade === 'D'
                    ? 'stroke-orange-400'
                    : 'stroke-red-400'
          }
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white leading-none">{score}</span>
        <span className={`text-[11px] font-bold mt-0.5 ${meta.color}`}>{grade}</span>
      </div>
    </div>
  );
}

/* ─── Expandable CITE LEDGER row ──────────────────────────────────── */

function CiteLedgerRow({
  grade,
  locked,
}: {
  grade: {
    grade: string;
    label: string;
    score: number;
    summary: string;
    strengths: string[];
    improvements: string[];
  };
  locked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = GRADE_META[grade.grade] ?? GRADE_META['C'];
  const weight = getCategoryWeight(grade.label);
  const GradeIcon = meta.icon;

  if (locked) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5 last:border-0 opacity-40 blur-[2px] pointer-events-none select-none">
        <div className="w-5 flex justify-center">
          <Lock className="h-3.5 w-3.5 text-white/30" />
        </div>
        <span className="flex-1 text-sm text-white/60">███████████████</span>
        <span className="text-xs text-white/30">██/100</span>
        <span className="text-xs text-white/25">██%</span>
        <span className="w-16 h-5 rounded bg-white/10" />
      </div>
    );
  }

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors text-left group"
      >
        <div className="w-5 flex justify-center">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/50" />
          )}
        </div>
        <span className="flex-1 text-sm text-white/80 font-medium">{grade.label}</span>
        <span className="text-xs font-mono text-white/60 w-12 text-right">{grade.score}/100</span>
        <span className="text-[11px] text-white/35 w-8 text-right">{weight}%</span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ml-1 ${meta.color} ${meta.bg} ${meta.border}`}
        >
          <GradeIcon className="h-3 w-3" />
          {meta.label}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 ml-8 space-y-3">
          {grade.summary && (
            <p className="text-sm text-white/60 leading-relaxed">{grade.summary}</p>
          )}

          {grade.strengths?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/70 mb-1.5">
                What passes
              </p>
              <ul className="space-y-1">
                {grade.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/55">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400/60 mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {grade.improvements?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-400/70 mb-1.5">
                What blocks AI citation
              </p>
              <ul className="space-y-1">
                {grade.improvements.map((imp, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/55">
                    <XCircle className="h-3 w-3 text-red-400/60 mt-0.5 shrink-0" />
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Evidence issue card ─────────────────────────────────────────── */

function EvidenceCard({
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.025] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <SeverityBadge severity={issue.severity} />
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wide">
              {issue.id}
            </span>
          </div>
          <p className="text-sm text-white/80 font-medium leading-snug">{issue.finding}</p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/25 shrink-0 mt-0.5" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8">
          {issue.evidence_excerpt && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35 mb-1.5">
                Evidence
              </p>
              <blockquote className="text-xs text-white/50 italic border-l-2 border-white/15 pl-3 leading-relaxed">
                {issue.evidence_excerpt}
              </blockquote>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-400/60 mb-1.5">
              Required fix
            </p>
            <p className="text-sm text-white/70 leading-relaxed">{issue.actual_fix}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            {issue.evidence_ids?.length > 0 && (
              <div className="text-[11px] text-white/30">
                Evidence IDs:{' '}
                <span className="font-mono text-white/40">{issue.evidence_ids.join(', ')}</span>
              </div>
            )}
            <div className="text-[11px] text-white/30">
              Type: <span className="uppercase font-mono text-white/40">{issue.evidence_type}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Fix engine card ─────────────────────────────────────────────── */

function FixCard({
  rank,
  rec,
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
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        {/* Rank circle */}
        <div className="shrink-0 w-7 h-7 rounded-full bg-white/8 border border-white/15 flex items-center justify-center text-xs font-bold text-white/60">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <PriorityBadge priority={rec.priority} />
            <span className="text-[10px] text-white/35 font-medium">{rec.category}</span>
          </div>
          <p className="text-sm font-semibold text-white/85">{rec.title}</p>
          {rec.estimatedVisibilityLoss && (
            <p className="text-xs text-emerald-400/70 mt-0.5">
              Expected impact: +{rec.estimatedVisibilityLoss} visibility
            </p>
          )}
        </div>

        {expanded ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/25 shrink-0 mt-0.5" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8">
          <p className="mt-3 text-sm text-white/60 leading-relaxed">{rec.description}</p>

          {rec.consequenceStatement && (
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-400/70 mb-1">
                AI consequence
              </p>
              <p className="text-xs text-orange-200/70 leading-relaxed">
                {rec.consequenceStatement}
              </p>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-400/60 mb-1.5">
              How to fix
            </p>
            <p className="text-sm text-white/60 leading-relaxed">{rec.implementation}</p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/30 mb-1.5">
              Impact
            </p>
            <p className="text-xs text-white/50">{rec.impact}</p>
          </div>

          {rec.brag_id && (
            <p className="text-[10px] font-mono text-white/25">BRAG: {rec.brag_id}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */

interface AuditForensicReportProps {
  result: AnalysisResponse;
  tier: Tier;
  onRerunAudit?: () => void;
}

export default function AuditForensicReport({
  result,
  tier,
  onRerunAudit,
}: AuditForensicReportProps) {
  const score = result.visibility_score ?? 0;
  const grade = scoreToGrade(score);
  const verdict = scoreToVerdict(score);
  const gradeMeta = GRADE_META[grade];

  // Tier flags
  const canSeeLedger = atLeast(tier, 'starter');
  const canSeeFixEngine = atLeast(tier, 'starter');
  const canSeeEvidence = atLeast(tier, 'alignment');
  const canSeeInterpretation = atLeast(tier, 'alignment');
  const canSeeCitationTracking = atLeast(tier, 'alignment');

  // Data
  const platforms = result.ai_platform_scores ?? {
    chatgpt: 0,
    perplexity: 0,
    google_ai: 0,
    claude: 0,
  };
  const topBlockers = (result.recommendations ?? [])
    .filter((r) => r.priority === 'high')
    .slice(0, 3);
  const allRecommendations = [...(result.recommendations ?? [])].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });
  const categoryGrades = result.category_grades ?? [];
  const evidenceIssues = result.evidence_fix_plan?.issues ?? [];
  const answerPresence = result.answer_presence;
  const citationEvidence = answerPresence?.evidence ?? [];

  const processingLabel = result.processing_time_ms
    ? `${(result.processing_time_ms / 1000).toFixed(1)}s`
    : null;
  const cacheLabel = result.cached ? 'Cached' : 'Live scan';

  return (
    <div className="space-y-4">
      {/* ─── SECTION 1: Score + Verdict + Platform Status ─────────── */}
      <div className="rounded-xl border border-white/12 bg-[#0d111c]/90 overflow-hidden">
        {/* Score header row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-5 pb-4 border-b border-white/8">
          <ScoreRing score={score} />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-xl font-bold ${gradeMeta.color}`}>{score} / 100</span>
              <span
                className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${gradeMeta.color} ${gradeMeta.bg} ${gradeMeta.border}`}
              >
                {verdict.short}
              </span>
            </div>

            <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
              {result.summary ||
                'AI citation readiness assessed based on entity clarity, structured data, content depth, and trust signals.'}
            </p>

            {(processingLabel || cacheLabel) && (
              <div className="flex items-center gap-3 mt-2">
                {processingLabel && (
                  <span className="text-[11px] text-white/30">{processingLabel} processing</span>
                )}
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded border ${
                    result.cached
                      ? 'text-white/35 border-white/10 bg-white/5'
                      : 'text-cyan-400/60 border-cyan-500/20 bg-cyan-500/5'
                  }`}
                >
                  {cacheLabel}
                </span>
                {result.analysis_integrity?.triple_check_enabled && (
                  <span className="text-[11px] text-purple-300/60 border border-purple-500/20 bg-purple-500/5 px-1.5 py-0.5 rounded">
                    Triple-check verified
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI Platform citation status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/8">
          {(Object.entries(platforms) as [string, number][]).map(([key, val]) => {
            const status = platformStatus(val);
            const StatusIcon = status.icon;
            return (
              <div
                key={key}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 ${status.bg}`}
              >
                <StatusIcon className={`h-5 w-5 ${status.color}`} />
                <span className="text-[11px] font-medium text-white/70">
                  {PLATFORM_LABELS[key] ?? key}
                </span>
                <span className={`text-[11px] font-semibold ${status.color}`}>{status.label}</span>
              </div>
            );
          })}
        </div>

        {/* Primary blockers */}
        {topBlockers.length > 0 && (
          <div className="px-5 py-4 border-t border-white/8">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-2.5">
              Primary blockers
            </p>
            <div className="flex flex-col gap-1.5">
              {topBlockers.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                  <div>
                    <span className="text-sm text-white/75 font-medium">{b.title}</span>
                    {b.consequenceStatement && (
                      <span className="ml-2 text-xs text-orange-300/60">
                        {b.consequenceStatement}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: CITE LEDGER breakdown ─────────────────────── */}
      <Section
        icon={FileText}
        title="CITE LEDGER Score Breakdown"
        badge={`${categoryGrades.length} categories`}
      >
        {categoryGrades.length === 0 ? (
          <p className="text-sm text-white/35 italic">
            Category breakdown not available for this scan.
          </p>
        ) : (
          <>
            {/* Column headers */}
            <div className="flex items-center gap-3 px-3 pb-2 border-b border-white/8 mb-1">
              <div className="w-5" />
              <span className="flex-1 text-[10px] uppercase tracking-wide text-white/30 font-semibold">
                Category
              </span>
              <span className="text-[10px] uppercase tracking-wide text-white/30 font-semibold w-12 text-right">
                Score
              </span>
              <span className="text-[10px] uppercase tracking-wide text-white/25 font-semibold w-8 text-right">
                Wt.
              </span>
              <span className="text-[10px] uppercase tracking-wide text-white/30 font-semibold w-24 text-right">
                Status
              </span>
            </div>

            {canSeeLedger ? (
              categoryGrades.map((g, i) => <CiteLedgerRow key={i} grade={g} />)
            ) : (
              <>
                {/* Show first 3 as teaser, rest locked */}
                {categoryGrades.slice(0, 3).map((g, i) => (
                  <CiteLedgerRow key={i} grade={g} />
                ))}
                {categoryGrades.slice(3).map((_, i) => (
                  <CiteLedgerRow
                    key={`locked-${i}`}
                    grade={{
                      grade: 'C',
                      label: '',
                      score: 0,
                      summary: '',
                      strengths: [],
                      improvements: [],
                    }}
                    locked
                  />
                ))}
              </>
            )}

            {!canSeeLedger && categoryGrades.length > 3 && (
              <div className="mt-3 pt-3 border-t border-white/8">
                <UpgradeWall
                  feature="Full CITE LEDGER Breakdown"
                  description="See all 7 scored categories with clickable evidence rows explaining exactly what AI systems see in each dimension."
                  requiredTier="alignment"
                  featurePreview={[
                    'All 7 scored categories with evidence',
                    'Click each row to expand blockers and strengths',
                    'Weighted contribution to your total score',
                    'Direct path from category to fix',
                  ]}
                />
              </div>
            )}
          </>
        )}
      </Section>

      {/* ─── SECTION 3: Evidence panel ─────────────────────────────── */}
      {canSeeEvidence && evidenceIssues.length > 0 && (
        <Section
          icon={Shield}
          title="Evidence-Backed Findings"
          badge={`${evidenceIssues.length} issues`}
        >
          <div className="space-y-2">
            {evidenceIssues.map((issue, i) => (
              <EvidenceCard key={i} issue={issue} />
            ))}
          </div>
        </Section>
      )}

      {!canSeeEvidence && evidenceIssues.length > 0 && (
        <Section icon={Shield} title="Evidence-Backed Findings">
          <UpgradeWall
            feature="Evidence Panel"
            description="Every finding linked to a specific page element, schema gap, or content deficit — with proof, AI consequence, and the exact fix."
            requiredTier="alignment"
            featurePreview={[
              `${evidenceIssues.length} evidence-backed issues identified`,
              'BRAG ID traceability for each finding',
              'AI consequence statement per issue',
              'Exact fix instructions',
            ]}
          />
        </Section>
      )}

      {/* ─── SECTION 4: AI interpretation snapshot ─────────────────── */}
      {canSeeInterpretation && answerPresence && (
        <Section icon={Brain} title="AI Interpretation Snapshot">
          <div className="space-y-4">
            {/* Entity clarity */}
            <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35 mb-1">
                How AI systems read this entity
              </p>
              {answerPresence.primary_entity && (
                <p className="text-sm text-white/80 font-medium mb-2">
                  Entity: <span className="text-cyan-300">{answerPresence.primary_entity}</span>
                  {answerPresence.aliases?.length > 0 && (
                    <span className="text-white/40 text-xs ml-2">
                      (also: {answerPresence.aliases.slice(0, 3).join(', ')})
                    </span>
                  )}
                </p>
              )}
              <p className="text-sm text-white/55 leading-relaxed italic">
                &ldquo;
                {score >= 70
                  ? 'This entity is clearly defined and citation-ready across AI systems.'
                  : score >= 45
                    ? 'This page describes a service but lacks complete entity definition. AI systems can partially extract meaning but deprioritize it for citation.'
                    : 'This page lacks structured entity signals. AI systems cannot confidently resolve what this entity is, limiting citation probability significantly.'}
                &rdquo;
              </p>
            </div>

            {/* Presence scores */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: 'Entity Clarity', value: answerPresence.entity_clarity_score },
                { label: 'Citation Coverage', value: answerPresence.citation_coverage_score },
                { label: 'Authority Alignment', value: answerPresence.authority_alignment_score },
              ].map((m) => {
                const mg = GRADE_META[scoreToGrade(m.value)];
                return (
                  <div
                    key={m.label}
                    className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-white/35 mb-1">
                      {m.label}
                    </p>
                    <p className={`text-lg font-bold ${mg.color}`}>{m.value}</p>
                    <p className={`text-[11px] ${mg.color} opacity-80`}>{mg.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Gaps summary */}
            {answerPresence.gaps?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35 mb-2">
                  AI visibility gaps
                </p>
                <div className="space-y-1.5">
                  {answerPresence.gaps.slice(0, 5).map((gap, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-white/55">
                      <XCircle className="h-3 w-3 text-red-400/50 mt-0.5 shrink-0" />
                      <span>{gap.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ─── SECTION 5: Citation tracking table ────────────────────── */}
      {canSeeCitationTracking && citationEvidence.length > 0 && (
        <Section
          icon={Eye}
          title="Citation Presence — Query Results"
          badge={`${answerPresence?.mentions_found ?? 0}/${answerPresence?.queries_tested ?? 0} found`}
        >
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-white/35 pb-2 pr-3">
                    Query
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-white/35 pb-2 pr-3">
                    Intent
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-white/35 pb-2 pr-3">
                    Source
                  </th>
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-white/35 pb-2">
                    Cited
                  </th>
                </tr>
              </thead>
              <tbody>
                {citationEvidence.slice(0, 10).map((ev, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="py-2 pr-3 text-white/65 max-w-[200px]">
                      <span className="truncate block">{ev.query}</span>
                    </td>
                    <td className="py-2 pr-3 text-white/40 text-xs">{ev.intent || '—'}</td>
                    <td className="py-2 pr-3 text-white/40 text-xs">{ev.source || '—'}</td>
                    <td className="py-2 text-center">
                      {ev.mentioned ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400/60 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {!canSeeCitationTracking && citationEvidence.length > 0 && (
        <Section icon={Eye} title="Citation Presence — Query Results">
          <UpgradeWall
            feature="Citation Tracking Table"
            description="See exactly which queries your entity was cited in, which AI systems mentioned you, and where the gaps are."
            requiredTier="alignment"
            featurePreview={[
              `${citationEvidence.length} queries tested`,
              `${answerPresence?.mentions_found ?? 0} mentions found`,
              'Query-by-query citation breakdown',
              'AI engine × intent × presence matrix',
            ]}
          />
        </Section>
      )}

      {/* ─── SECTION 6: Priority fix engine ────────────────────────── */}
      <Section
        icon={Target}
        title="Priority Fix Engine"
        badge={`${allRecommendations.length} ranked fixes`}
      >
        {canSeeFixEngine ? (
          <div className="space-y-2">
            {allRecommendations.length === 0 && (
              <p className="text-sm text-white/35 italic">
                No recommendations generated for this scan.
              </p>
            )}
            {allRecommendations.map((rec, i) => (
              <FixCard key={i} rank={i + 1} rec={rec} />
            ))}
          </div>
        ) : (
          <UpgradeWall
            feature="Priority Fix Engine"
            description="Every ranked fix tells you what to do, what score increase to expect, and what AI consequence you're avoiding."
            requiredTier="alignment"
            featurePreview={[
              `${allRecommendations.length} evidence-backed fixes ranked by impact`,
              'Expected score increase per fix',
              'AI consequence framing on every issue',
              'Implementation instructions with BRAG traceability',
            ]}
          />
        )}
      </Section>

      {/* ─── SECTION 7: Trend / Re-scan CTA ─────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-[#0d111c]/80 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white/80">Track your progress</span>
            </div>
            <p className="text-xs text-white/45 leading-relaxed">
              This is your baseline:{' '}
              <span className="font-semibold text-white/65">{score}/100</span>. Implement the fixes
              above, then re-run the audit to measure the lift. Every point added increases AI
              citation probability.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {onRerunAudit && (
              <button
                type="button"
                onClick={onRerunAudit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-cyan-400/30 text-cyan-200 bg-cyan-500/8 hover:bg-cyan-500/15 transition-colors"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Re-run audit
              </button>
            )}
            <Link
              to="/app/score-fix"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-white/15 text-white/65 hover:text-white/85 hover:border-white/25 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Go to Score Fix
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
