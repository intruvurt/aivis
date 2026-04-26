/**
 * CitationIntelligencePanel
 *
 * Consumes GET /api/citations/intelligence/overview and renders:
 *   1. Tracker headline  — "You are cited in X / Y AI responses"
 *   2. Why              — causal_insights (hypothesis + evidence + confidence)
 *   3. What Changed     — citation_coverage_time_series + signal layer deltas
 *   4. Competitor share — tracker.competitor_share
 *   5. Action path      — missing_citations + action_plan + projected vs quick-win score
 *
 * Alignment+ tier required (enforced server-side; client shows UpgradeWall).
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  Globe,
  Info,
  Layers,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { API_URL } from '../config';
import { meetsMinimumTier } from '@shared/types';
import { useAuthStore } from '../stores/authStore';
import UpgradeWall from './UpgradeWall';

// ─── API response types ────────────────────────────────────────────────────

interface CompetitorShareEntry {
  competitor: string;
  mentions: number;
  share_pct: number;
}

interface TimeSeriesPoint {
  date: string;
  ledger_entries?: number;
  audits?: number;
  cited?: number;
  total?: number;
  rate_pct?: number;
}

interface CausalInsight {
  hypothesis: string;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ActionPlanItem {
  action?: string;
  title?: string;
  description?: string;
  priority?: string;
  impact?: string;
}

interface IntelligenceOverview {
  url: string;
  window_days: number;
  tracker: {
    cited_responses: number;
    total_responses: number;
    citation_rate_pct: number;
    engines_covered: number;
    competitor_share: CompetitorShareEntry[];
  };
  cite_ledger_time_series: TimeSeriesPoint[];
  citation_coverage_time_series: TimeSeriesPoint[];
  signal_layer: {
    cloudflare?: {
      signal?: {
        metrics?: { aiCrawlerHits?: number };
        derived?: { trafficPhysicsScore?: number; aiVisibilityGate?: string };
      };
      trust?: {
        score?: number;
        issues?: string[];
        impact?: string;
        observedAt?: string;
      };
    };
    geekflare?: {
      lighthouse?: { performance?: number; seo?: number };
      tls?: { valid?: boolean; days_remaining?: number };
    };
  };
  entity_alignment: {
    identity?: { normalized_url?: string; business_name?: string; business_name_source?: string };
    knowledge_graph?: Record<string, unknown>;
    gsc?: { active_connections?: number; latest_snapshot_at?: string };
  };
  causal_insights: CausalInsight[];
  action_path: {
    citations?: string[];
    missing_citations?: string[];
    action_plan?: ActionPlanItem[];
    projected_score?: number;
    quick_win_score?: number;
    current_score?: number;
    gap_analysis?: unknown;
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  url: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const WINDOW_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

function confidenceBadge(c: CausalInsight['confidence']) {
  const map = {
    high: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    medium: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    low: 'bg-white/8 text-white/50 border-white/10',
  };
  return `inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide font-semibold ${map[c] ?? map.low}`;
}

function rateColor(pct: number) {
  if (pct >= 60) return 'text-emerald-400';
  if (pct >= 30) return 'text-amber-400';
  return 'text-red-400';
}

/** Mini SVG sparkline for a numeric series */
function Sparkline({ values, color = '#34d399' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 32;
  const PAD = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = (W - PAD * 2) / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = PAD + i * xStep;
      const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-8" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function CitationIntelligencePanel({ url }: Props) {
  const { user } = useAuthStore();
  const userTier = (user?.tier as string) || 'observer';
  const hasAccess = meetsMinimumTier(userTier, 'alignment');

  const [windowDays, setWindowDays] = useState(30);
  const [data, setData] = useState<IntelligenceOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionExpanded, setActionExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!url || !hasAccess) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API_URL}/api/citations/intelligence/overview?url=${encodeURIComponent(url)}&window_days=${windowDays}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json as IntelligenceOverview);
    } catch (e: any) {
      setError(e.message || 'Failed to load intelligence overview');
    } finally {
      setLoading(false);
    }
  }, [url, windowDays, hasAccess]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Tier gate ────────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <UpgradeWall
        feature="AI Citation Intelligence"
        description="See exactly how often AI systems cite you, why they do or don't, and what changed."
        requiredTier="alignment"
        icon={<Brain className="w-12 h-12 text-white/80" />}
        featurePreview={[
          'Cited in X / Y AI responses — real citation rate across all engines',
          'Causal insight engine — why citations are missing and what moved them',
          'Signal layer — Cloudflare AI trust score + performance benchmarks',
          'Action path — structured remediation plan with projected score',
        ]}
      />
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6 space-y-4 animate-pulse">
        <div className="h-10 w-64 rounded-xl bg-white/8" />
        <div className="h-4 w-40 rounded-lg bg-white/6" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/5" />
          ))}
        </div>
        <div className="h-32 rounded-xl bg-white/5" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-300">Failed to load citation intelligence</p>
          <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white/85 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  // ── No data yet ───────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <Activity className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No citation intelligence data yet.</p>
        <p className="text-xs text-slate-500 mt-1">
          Run a citation test first to populate the intelligence layer.
        </p>
      </div>
    );
  }

  const {
    tracker,
    causal_insights,
    citation_coverage_time_series,
    cite_ledger_time_series,
    signal_layer,
    entity_alignment,
    action_path,
  } = data;
  const rateValues = citation_coverage_time_series.map((p) => p.rate_pct ?? 0);
  const ledgerValues = cite_ledger_time_series.map((p) => p.ledger_entries ?? 0);
  const latestRate = rateValues[rateValues.length - 1] ?? tracker.citation_rate_pct;
  const prevRate = rateValues[rateValues.length - 2] ?? null;
  const rateDelta = prevRate !== null ? latestRate - prevRate : null;
  const cfTrust = signal_layer?.cloudflare?.trust;
  const gf = signal_layer?.geekflare;
  const gscActive = entity_alignment?.gsc?.active_connections ?? 0;
  const bizName = entity_alignment?.identity?.business_name;

  return (
    <div className="space-y-5">
      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-white/50 shrink-0" />
          <span className="text-sm font-semibold text-white/80">Citation Intelligence</span>
          {bizName && <span className="text-xs text-white/40 hidden sm:inline">— {bizName}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWindowDays(opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                windowDays === opt.value
                  ? 'bg-white/10 text-white'
                  : 'text-white/45 hover:text-white/75 hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={load}
            className="ml-1 p-1.5 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── SECTION 1: Tracker Headline ───────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-charcoal to-charcoal-deep p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          {/* Big cited count */}
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-white/45 mb-1">AI Citation Rate</p>
            <div className="flex items-end gap-3">
              <span
                className={`text-5xl font-black leading-none ${rateColor(tracker.citation_rate_pct)}`}
              >
                {tracker.cited_responses}
              </span>
              <span className="text-xl text-white/40 pb-1">/ {tracker.total_responses}</span>
            </div>
            <p className="mt-1 text-sm text-white/55 leading-snug">
              You are cited in{' '}
              <strong className={`font-semibold ${rateColor(tracker.citation_rate_pct)}`}>
                {tracker.cited_responses} of {tracker.total_responses} AI responses
              </strong>{' '}
              ({tracker.citation_rate_pct.toFixed(1)}%) across {tracker.engines_covered} engine
              {tracker.engines_covered !== 1 ? 's' : ''}.
            </p>
            {rateDelta !== null && (
              <div
                className={`mt-2 flex items-center gap-1.5 text-xs ${rateDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {rateDelta >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {rateDelta >= 0 ? '+' : ''}
                {rateDelta.toFixed(1)}% vs prior period
              </div>
            )}
          </div>

          {/* Rate sparkline */}
          <div className="flex flex-col items-start sm:items-end gap-1">
            <span className="text-[10px] uppercase tracking-wide text-white/35">
              Citation rate trend
            </span>
            <Sparkline
              values={rateValues}
              color={tracker.citation_rate_pct >= 30 ? '#34d399' : '#f87171'}
            />
            <span className={`text-lg font-bold ${rateColor(tracker.citation_rate_pct)}`}>
              {tracker.citation_rate_pct.toFixed(1)}%
            </span>
          </div>

          {/* Ledger signal */}
          {ledgerValues.length > 1 && (
            <div className="flex flex-col items-start sm:items-end gap-1">
              <span className="text-[10px] uppercase tracking-wide text-white/35">
                Ledger entries
              </span>
              <Sparkline values={ledgerValues} color="#818cf8" />
              <span className="text-lg font-bold text-indigo-300">
                {cite_ledger_time_series.reduce((s, p) => s + (p.ledger_entries ?? 0), 0)}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 2: Why (Causal Insights) ─────────────────────────────── */}
      {causal_insights.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <h3 className="text-sm font-semibold text-white">Why — causal analysis</h3>
            <span className="ml-auto text-[10px] text-white/35">
              {causal_insights.length} insight{causal_insights.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {causal_insights.map((insight, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="text-sm font-medium text-white/85 leading-snug">
                    {insight.hypothesis}
                  </p>
                  <span className={confidenceBadge(insight.confidence)}>{insight.confidence}</span>
                </div>
                <p className="text-xs leading-relaxed text-white/50">{insight.evidence}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION 3: What Changed (time series + signal layer) ──────────── */}
      <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-cyan-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white">What Changed — {windowDays}d window</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Citation coverage over time */}
          {citation_coverage_time_series.length > 1 && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">
                Citation rate / day
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-white/60">
                  <tbody>
                    {citation_coverage_time_series.slice(-7).map((p, i) => (
                      <tr key={i} className="border-t border-white/5 first:border-0">
                        <td className="py-1 text-white/35">{p.date?.slice(5)}</td>
                        <td className="py-1 text-right font-mono">
                          {p.cited ?? '-'}/{p.total ?? '-'}
                        </td>
                        <td
                          className={`py-1 pl-2 text-right font-medium ${rateColor(p.rate_pct ?? 0)}`}
                        >
                          {p.rate_pct !== undefined ? `${p.rate_pct.toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cloudflare AI trust signal */}
          {cfTrust && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-3.5 w-3.5 text-indigo-400" />
                <p className="text-[10px] uppercase tracking-wide text-white/40">AI Trust Score</p>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span
                  className={`text-3xl font-black leading-none ${(cfTrust.score ?? 0) >= 60 ? 'text-emerald-400' : (cfTrust.score ?? 0) >= 40 ? 'text-amber-400' : 'text-red-400'}`}
                >
                  {cfTrust.score ?? '—'}
                </span>
                <span className="text-xs text-white/35 pb-0.5">/ 100</span>
              </div>
              {cfTrust.impact && (
                <p className="text-[11px] text-white/50 leading-snug mb-2">{cfTrust.impact}</p>
              )}
              {cfTrust.issues && cfTrust.issues.length > 0 && (
                <ul className="space-y-1">
                  {cfTrust.issues.slice(0, 3).map((issue, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-red-400/80">
                      <CircleDot className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Geekflare signals */}
          {(gf?.lighthouse || gf?.tls) && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Performance signals
                </p>
              </div>
              {gf.lighthouse && (
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/45">Performance</span>
                  <span
                    className={`font-semibold ${(gf.lighthouse.performance ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {gf.lighthouse.performance ?? '—'}
                  </span>
                </div>
              )}
              {gf.lighthouse?.seo !== undefined && (
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/45">SEO</span>
                  <span
                    className={`font-semibold ${(gf.lighthouse.seo ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {gf.lighthouse.seo}
                  </span>
                </div>
              )}
              {gf.tls && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/45">TLS</span>
                  <span
                    className={`font-semibold ${gf.tls.valid ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {gf.tls.valid ? `✓ ${gf.tls.days_remaining}d` : '✗ invalid'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Entity alignment */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-3.5 w-3.5 text-sky-400" />
              <p className="text-[10px] uppercase tracking-wide text-white/40">Entity alignment</p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/45">Business name</span>
                <span className="text-white/80 font-medium truncate ml-2 max-w-[120px]">
                  {bizName ?? <span className="text-white/30">—</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">Knowledge Graph</span>
                <span
                  className={
                    entity_alignment?.knowledge_graph ? 'text-emerald-400' : 'text-white/30'
                  }
                >
                  {entity_alignment?.knowledge_graph ? '✓ found' : '— none'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">GSC connections</span>
                <span className={gscActive > 0 ? 'text-emerald-400' : 'text-white/30'}>
                  {gscActive > 0 ? `${gscActive} active` : '— none'}
                </span>
              </div>
            </div>
          </div>

          {/* Ledger time series last 7 */}
          {cite_ledger_time_series.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-3.5 w-3.5 text-purple-400" />
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Cite ledger activity
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-white/60">
                  <tbody>
                    {cite_ledger_time_series.slice(-7).map((p, i) => (
                      <tr key={i} className="border-t border-white/5 first:border-0">
                        <td className="py-1 text-white/35">{p.date?.slice(5)}</td>
                        <td className="py-1 text-right font-mono">
                          {p.ledger_entries ?? 0} entries
                        </td>
                        <td className="py-1 pl-2 text-right text-white/40">
                          {p.audits ?? 0} audits
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI crawler hits (Cloudflare) */}
          {signal_layer?.cloudflare?.signal?.metrics?.aiCrawlerHits !== undefined && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
                <p className="text-[10px] uppercase tracking-wide text-white/40">AI crawler hits</p>
              </div>
              <div className="text-3xl font-black text-cyan-300 leading-none">
                {signal_layer.cloudflare.signal.metrics.aiCrawlerHits.toLocaleString()}
              </div>
              {signal_layer.cloudflare.signal.derived?.aiVisibilityGate && (
                <p className="mt-1 text-[11px] text-white/45">
                  {signal_layer.cloudflare.signal.derived.aiVisibilityGate}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 4: Competitor Share ───────────────────────────────────── */}
      {tracker.competitor_share && tracker.competitor_share.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
          <div className="flex items-center gap-2 mb-4">
            <BadgeCheck className="h-4 w-4 text-violet-400 shrink-0" />
            <h3 className="text-sm font-semibold text-white">Competitor citation share</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left pb-2 text-[10px] uppercase tracking-wide text-white/40 font-medium">
                    Competitor
                  </th>
                  <th className="text-right pb-2 text-[10px] uppercase tracking-wide text-white/40 font-medium">
                    Mentions
                  </th>
                  <th className="text-right pb-2 text-[10px] uppercase tracking-wide text-white/40 font-medium">
                    Share
                  </th>
                  <th className="pb-2 text-[10px] uppercase tracking-wide text-white/40 font-medium w-24" />
                </tr>
              </thead>
              <tbody>
                {tracker.competitor_share.map((row, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-2 text-white/75 font-medium">{row.competitor}</td>
                    <td className="py-2 text-right font-mono text-white/60">{row.mentions}</td>
                    <td className="py-2 text-right font-semibold text-white/85">
                      {row.share_pct.toFixed(1)}%
                    </td>
                    <td className="py-2 pl-3">
                      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500/60"
                          style={{ width: `${Math.min(row.share_pct, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── SECTION 5: Action Path ────────────────────────────────────────── */}
      {action_path && (
        <section className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
          <button
            type="button"
            onClick={() => setActionExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <h3 className="text-sm font-semibold text-white">Action path</h3>
              {action_path.projected_score !== undefined && (
                <span className="text-xs text-white/45 ml-1">
                  projected {action_path.projected_score} → quick-win {action_path.quick_win_score}
                </span>
              )}
            </div>
            {actionExpanded ? (
              <ChevronUp className="h-4 w-4 text-white/40 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
            )}
          </button>

          {actionExpanded && (
            <div className="mt-4 space-y-4">
              {/* Score bars */}
              {action_path.projected_score !== undefined && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: 'Current',
                      value: action_path.current_score ?? 0,
                      color: 'bg-white/20',
                    },
                    {
                      label: 'Quick win',
                      value: action_path.quick_win_score ?? 0,
                      color: 'bg-amber-500/60',
                    },
                    {
                      label: 'Projected',
                      value: action_path.projected_score ?? 0,
                      color: 'bg-emerald-500/60',
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
                    >
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">
                        {s.label}
                      </p>
                      <p className="text-2xl font-black text-white/90 leading-none mb-2">
                        {s.value}
                      </p>
                      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.color}`}
                          style={{ width: `${s.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Missing citations */}
              {action_path.missing_citations && action_path.missing_citations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400/80 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" /> Missing citations
                  </p>
                  <ul className="space-y-1.5">
                    {action_path.missing_citations.slice(0, 6).map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-400/60 shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action plan */}
              {action_path.action_plan && action_path.action_plan.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Remediation steps
                  </p>
                  <div className="space-y-2">
                    {action_path.action_plan.slice(0, 5).map((item, i) => {
                      const title = item.title ?? item.action ?? `Step ${i + 1}`;
                      const detail = item.description;
                      const priority = item.priority;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] font-bold text-white/60 mt-0.5">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-white/85 leading-snug">
                                {title}
                              </p>
                              {priority && (
                                <span
                                  className={`shrink-0 text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full ${
                                    priority === 'high'
                                      ? 'bg-red-500/15 text-red-400'
                                      : priority === 'medium'
                                        ? 'bg-amber-500/15 text-amber-400'
                                        : 'bg-white/8 text-white/40'
                                  }`}
                                >
                                  {priority}
                                </span>
                              )}
                            </div>
                            {detail && (
                              <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                                {detail}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confirmed citations */}
              {action_path.citations && action_path.citations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed citations
                  </p>
                  <ul className="space-y-1.5">
                    {action_path.citations.slice(0, 4).map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400/60 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Footer note */}
      <p className="text-[11px] text-white/30 text-center">
        Data window: last {data.window_days} days ·{' '}
        <Link to="/app/citations" className="hover:text-white/55 transition-colors">
          Full citation engine <ArrowRight className="inline h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}
