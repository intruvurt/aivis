/**
 * EVIDENCE-FIRST REPORT CARD
 *
 * Redesigned audit result display prioritizing evidence visibility over scores.
 * All evidence is traceable to verified sources with confidence metrics.
 *
 * Layout:
 * 1. Header — Domain identity + analysis timestamp
 * 2. Score Block — Evidence Coverage metric (not generic grade)
 * 3. Evidence Summary — Counts (verified | gaps | drift signals)
 * 4. Evidence Preview — Real snippets + source URLs
 * 5. Drift Insight — Attribution issues + recommendations
 * 6. Actions — Re-analyze | View Evidence | Compare
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  XCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
} from 'lucide-react';
import type { AnalysisResponse, AuditEvidenceRecord, AuditResult } from '@shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface EvidenceFirstReportCardProps {
  /** Full analysis response from /api/audits/:id */
  result: AnalysisResponse | AuditResult;

  /** Audit ID for linking  */
  auditId?: string;

  /** Allow re-analysis */
  onReanalyze?: () => void;

  /** Show full evidence detail */
  onViewEvidence?: () => void;

  /** Comparison with previous audit  */
  onCompare?: () => void;

  /** CSS class override  */
  className?: string;

  /** Hide hero/header section */
  hideHero?: boolean;

  /** Hide action buttons */
  hideActions?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract domain from URL for display
 */
function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || url;
  } catch {
    return url;
  }
}

/**
 * Calculate evidence coverage percentage
 * Based on verified evidence count / expected baseline
 */
function calculateEvidenceCoverage(result: AnalysisResponse | AuditResult): number {
  if ('avs' in result && result.avs) {
    return Math.round(result.visibility_score || 0);
  }
  if ('evidence' in result && Array.isArray(result.evidence)) {
    const evidenceCount = result.evidence.length;
    // Expected baseline: 15 key pieces of evidence
    const baseline = 15;
    return Math.min(100, Math.round((evidenceCount / baseline) * 100));
  }
  if ('visibility_score' in result) {
    // Fallback: use visibility score as proxy
    return Math.round(result.visibility_score || 0);
  }
  return 0;
}

/**
 * Count evidence by confidence tier
 */
function countEvidenceByConfidence(evidence: AuditEvidenceRecord[]): {
  high: number;
  medium: number;
  low: number;
} {
  const counts = { high: 0, medium: 0, low: 0 };
  evidence.forEach((ev) => {
    const confidence = ev.confidence || 0;
    if (confidence >= 0.8) counts.high++;
    else if (confidence >= 0.5) counts.medium++;
    else counts.low++;
  });
  return counts;
}

/**
 * Identify attribution gaps from evidence record
 */
function identifyAttributionGaps(evidence: AuditEvidenceRecord[]): {
  count: number;
  types: Set<string>;
} {
  const gaps = new Set<string>();
  const allTypes = new Set(evidence.map((e) => e.type));

  // Expected evidence types for full attribution
  const expectedTypes = ['html', 'schema', 'serp', 'mention', 'directory', 'social'];

  expectedTypes.forEach((type) => {
    if (!allTypes.has(type)) {
      gaps.add(type);
    }
  });

  return { count: gaps.size, types: gaps };
}

/**
 * Detect drift signals (consistency issues)
 */
function detectDriftSignals(result: AnalysisResponse | AuditResult): {
  count: number;
  signals: string[];
} {
  const signals: string[] = [];

  // Check for scrape warnings
  if ('scrape_warning' in result && result.scrape_warning) {
    signals.push(`Scrape limitation: ${result.scrape_warning}`);
  }

  // Check for thin content
  if ('thin_content_warning' in result && result.thin_content_warning) {
    signals.push(`Content concern: ${result.thin_content_warning}`);
  }

  // Check for fallback mode (non-live analysis)
  if ('analysis_integrity' in result && result.analysis_integrity) {
    const { mode } = result.analysis_integrity;
    if (mode !== 'live') {
      signals.push(`Analysis not live: ${mode} mode`);
    }
  }

  // Check for low confidence overall
  if ('visibility_score' in result && result.visibility_score < 40) {
    signals.push('Low visibility score may indicate detection difficulty');
  }

  return { count: signals.length, signals };
}

function getAVS(result: AnalysisResponse | AuditResult) {
  return 'avs' in result ? result.avs : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Component 1: Header with domain identity + timestamp
 */
function ReportHeader({ result }: { result: AnalysisResponse | AuditResult }) {
  const url = 'url' in result ? result.url : '';
  const domain = getDomainFromUrl(url);
  const timestamp = 'analyzed_at' in result ? result.analyzed_at : new Date().toISOString();
  const analysisDate = new Date(timestamp);

  return (
    <div className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-b border-slate-700/50 px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Analyzed URL</p>
          <h2 className="text-2xl font-bold text-white mb-2 break-all">{domain}</h2>
          <p className="text-xs text-slate-500">
            {analysisDate.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="shrink-0">
          <Shield className="w-6 h-6 text-emerald-400/60" />
        </div>
      </div>
    </div>
  );
}

/**
 * Component 2: Evidence Coverage metric block
 */
function EvidenceCoverageBlock({ result }: { result: AnalysisResponse | AuditResult }) {
  const coverage = calculateEvidenceCoverage(result);
  const avs = getAVS(result);
  const pillars = avs ? Object.values(avs.pillars) : [];
  const topReasons = avs?.reasons.slice(0, 3) ?? [];
  const coverageColor =
    coverage >= 80
      ? 'from-emerald-500 to-cyan-400'
      : coverage >= 60
        ? 'from-cyan-500 to-blue-400'
        : coverage >= 40
          ? 'from-amber-500 to-orange-400'
          : 'from-rose-500 to-orange-400';

  return (
    <div className="px-6 py-6 border-b border-slate-700/30">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide">
          {avs ? 'AI Visibility Score (AVS)' : 'AI Citation Probability'}
        </p>
        {avs && (
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
            <Zap className="w-3.5 h-3.5" />
            Confidence {avs.confidence.score}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-6">
        {/* Circular gauge */}
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(148,163,184,0.1)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#coverageGradient)"
              strokeWidth="8"
              strokeDasharray={`${coverage * 2.83} 283`}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="coverageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop
                  offset="0%"
                  stopColor={
                    coverage >= 80
                      ? '#10b981'
                      : coverage >= 60
                        ? '#06b6d4'
                        : coverage >= 40
                          ? '#f59e0b'
                          : '#ef4444'
                  }
                />
                <stop
                  offset="100%"
                  stopColor={
                    coverage >= 80
                      ? '#06b6d4'
                      : coverage >= 60
                        ? '#3b82f6'
                        : coverage >= 40
                          ? '#f97316'
                          : '#f97316'
                  }
                />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-3xl font-black text-white">{coverage}</p>
              <p className="text-xs text-slate-400">%</p>
            </div>
          </div>
        </div>

        {/* Interpretation */}
        <div className="flex-1">
          <p className="text-sm font-semibold text-white mb-2">
            {coverage >= 80
              ? 'AI systems reliably cite this content'
              : coverage >= 60
                ? 'Citation likelihood is partial'
                : coverage >= 40
                  ? 'Citation likelihood is low'
                  : 'Absent from AI answers'}
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            {coverage >= 80
              ? 'All major evidence types detected. AI systems should reliably cite this content.'
              : coverage >= 60
                ? 'Most evidence types present. Minor gaps may reduce citation likelihood.'
                : coverage >= 40
                  ? 'Significant gaps detected. Consider addressing missing evidence types.'
                  : 'Critical evidence gaps. Major barriers to AI citation and attribution.'}
          </p>
          {avs && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{avs.methodology}</p>
          )}
        </div>
      </div>

      {avs && (
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pillar Breakdown
            </p>
            <div className="space-y-3">
              {pillars.map((pillar) => {
                const percent =
                  pillar.maxPoints > 0 ? Math.round((pillar.score / pillar.maxPoints) * 100) : 0;
                return (
                  <div key={pillar.key}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-white">{pillar.label}</span>
                      <span className="text-slate-300">
                        {pillar.score.toFixed(1)}/{pillar.maxPoints}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${coverageColor}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {pillar.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Why This Score
            </p>
            <div className="space-y-3">
              {topReasons.length > 0 ? (
                topReasons.map((reason) => (
                  <div
                    key={`${reason.pillar}-${reason.issue}`}
                    className="rounded-lg border border-rose-400/10 bg-rose-500/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{reason.issue}</p>
                      <span className="text-xs font-semibold text-rose-300">
                        {reason.impact.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                      {reason.pillar}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {reason.rationale}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">
                  No high-impact deductions detected in the evidence-backed rule set.
                </p>
              )}

              <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Confidence Basis
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Data</p>
                    <p className="font-semibold text-white">
                      {avs.confidence.components.dataCompleteness}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Crawl Depth</p>
                    <p className="font-semibold text-white">
                      {avs.confidence.components.crawlDepth}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Agreement</p>
                    <p className="font-semibold text-white">
                      {avs.confidence.components.evidenceAgreement}%
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  {avs.confidence.basis}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Component 3: Evidence Summary Row (metrics)
 */
function EvidenceSummaryRow({ result }: { result: AnalysisResponse | AuditResult }) {
  const evidence = 'evidence' in result && Array.isArray(result.evidence) ? result.evidence : [];
  const confidenceCounts = countEvidenceByConfidence(evidence);
  const gaps = identifyAttributionGaps(evidence);
  const drift = detectDriftSignals(result);

  const totalVerified = evidence.length;

  return (
    <div className="px-6 py-6 grid grid-cols-3 gap-4 border-b border-slate-700/30">
      {/* Verified Evidence */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <p className="text-xs text-slate-400 uppercase tracking-wide">Verified Evidence</p>
        </div>
        <p className="text-3xl font-black text-emerald-300">{totalVerified}</p>
        <div className="mt-2 flex gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
            High: {confidenceCounts.high}
          </span>
          <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300">
            Med: {confidenceCounts.medium}
          </span>
        </div>
      </div>

      {/* Attribution Gaps */}
      <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <p className="text-xs text-slate-400 uppercase tracking-wide">Attribution Gaps</p>
        </div>
        <p className="text-3xl font-black text-amber-300">{gaps.count}</p>
        {gaps.types.size > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Missing: {Array.from(gaps.types).join(', ')}
          </p>
        )}
      </div>

      {/* Drift Signals */}
      <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-rose-400" />
          <p className="text-xs text-slate-400 uppercase tracking-wide">Drift Signals</p>
        </div>
        <p className="text-3xl font-black text-rose-300">{drift.count}</p>
        {drift.count > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {drift.count === 1 ? '1 issue' : `${drift.count} issues`}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Component 4: Evidence Preview
 */
function EvidencePreview({ result }: { result: AnalysisResponse | AuditResult }) {
  const evidence = 'evidence' in result && Array.isArray(result.evidence) ? result.evidence : [];
  const [expanded, setExpanded] = useState(false);

  // Show top 3 by default, expand for all
  const displayed = expanded ? evidence : evidence.slice(0, 3);

  if (evidence.length === 0) {
    return (
      <div className="px-6 py-6 border-b border-slate-700/30">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-4">Evidence Preview</p>
        <p className="text-sm text-slate-500 italic">No evidence records available</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 border-b border-slate-700/30">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-4">Evidence Preview</p>

      <div className="space-y-3">
        {displayed.map((ev, idx) => (
          <div
            key={`ev-${idx}`}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="inline-block px-2 py-1 bg-slate-700/50 rounded text-xs font-mono text-slate-300">
                  {ev.type}
                </span>
                <span className="text-xs text-slate-400">
                  Confidence: {Math.round((ev.confidence || 0) * 100)}%
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            {/* Source */}
            <p className="text-xs text-slate-400 mb-2 truncate">
              <span className="font-mono break-all">{ev.source}</span>
            </p>

            {/* Extract/snippet */}
            <p className="text-sm text-slate-300 line-clamp-2">{ev.extract}</p>
          </div>
        ))}
      </div>

      {evidence.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 w-full px-4 py-2 flex items-center justify-center gap-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 text-slate-300 text-sm transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" /> Collapse
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" /> View all {evidence.length} evidence records
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Component 5: Drift Insight
 */
function DriftInsight({ result }: { result: AnalysisResponse | AuditResult }) {
  const drift = detectDriftSignals(result);

  if (drift.count === 0) {
    return (
      <div className="px-6 py-6 border-b border-slate-700/30">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <p className="text-xs text-slate-400 uppercase tracking-wide">Attribution Health</p>
        </div>
        <p className="text-sm text-emerald-300">
          No drift signals detected. Content is consistent and ready for citation.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 border-b border-slate-700/30">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <p className="text-xs text-slate-400 uppercase tracking-wide">Attribution Issues</p>
      </div>

      <div className="space-y-2">
        {drift.signals.map((signal, idx) => (
          <div
            key={`signal-${idx}`}
            className="flex gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
          >
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">{signal}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Resolve these issues to improve citation likelihood and attribution accuracy.
      </p>
    </div>
  );
}

/**
 * Component 6: Action Buttons
 */
function ActionButtons({
  onReanalyze,
  onViewEvidence,
  onCompare,
}: {
  onReanalyze?: () => void;
  onViewEvidence?: () => void;
  onCompare?: () => void;
}) {
  return (
    <div className="px-6 py-6 flex gap-3">
      <button
        onClick={onReanalyze}
        disabled={!onReanalyze}
        className="flex-1 px-4 py-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCcw className="w-4 h-4" /> Re-analyze
      </button>

      <button
        onClick={onViewEvidence}
        disabled={!onViewEvidence}
        className="flex-1 px-4 py-2 flex items-center justify-center gap-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Eye className="w-4 h-4" /> View Evidence
      </button>

      <button
        onClick={onCompare}
        disabled={!onCompare}
        className="flex-1 px-4 py-2 flex items-center justify-center gap-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Zap className="w-4 h-4" /> Compare
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function EvidenceFirstReportCard({
  result,
  auditId,
  onReanalyze,
  onViewEvidence,
  onCompare,
  className = '',
  hideHero = false,
  hideActions = false,
}: EvidenceFirstReportCardProps) {
  return (
    <div
      className={`rounded-lg border border-slate-700/30 overflow-hidden shadow-lg bg-slate-900/40 backdrop-blur ${className}`}
    >
      {/* Component 1: Header */}
      {!hideHero && <ReportHeader result={result} />}

      {/* Component 2: Score Block */}
      <EvidenceCoverageBlock result={result} />

      {/* Component 3: Summary metrics */}
      <EvidenceSummaryRow result={result} />

      {/* Component 4: Evidence preview */}
      <EvidencePreview result={result} />

      {/* Component 5: Drift insight */}
      <DriftInsight result={result} />

      {/* Component 6: Actions */}
      {!hideActions && (
        <ActionButtons
          onReanalyze={onReanalyze}
          onViewEvidence={onViewEvidence}
          onCompare={onCompare}
        />
      )}
    </div>
  );
}

export default EvidenceFirstReportCard;
