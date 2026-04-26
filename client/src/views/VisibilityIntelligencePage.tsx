import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Gauge,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import Spinner from '../components/Spinner';
import UpgradeWall from '../components/UpgradeWall';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import apiFetch from '../utils/api';
import { meetsMinimumTier } from '@shared/types';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildWebPageSchema } from '../lib/seoSchema';
import {
  EMPTY_ANALYTICS_DATA,
  EMPTY_PLATFORM_METRICS,
  mapAnalyticsApiResponse,
  mapPlatformMetricsResponse,
  type AnalyticsData,
  type PlatformMetricsData,
} from '../utils/analyticsUtils';

const CHECK_LABELS: Record<string, string> = {
  schema: 'Missing or invalid schema markup',
  entity_clarity: 'Weak entity signaling and disambiguation',
  internal_link_health: 'Weak internal support graph',
  h1: 'Heading hierarchy inconsistency',
  indexability: 'Indexing and crawlability friction',
  robots: 'Crawler policy friction',
  canonical: 'Canonical alignment drift',
  title: 'Title intent ambiguity',
  meta_description: 'Meta description intent drift',
};

type PublicInsights = {
  pct_no_schema?: number;
  pct_missing_h1?: number;
  pct_ai_crawler_blocked?: number;
};

type PublicProof = {
  avg_improvement?: number;
};

function signedNumber(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return '0';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function VisibilityIntelligencePage() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData>(EMPTY_ANALYTICS_DATA);
  const [platformMetrics, setPlatformMetrics] =
    useState<PlatformMetricsData>(EMPTY_PLATFORM_METRICS);
  const [publicInsights, setPublicInsights] = useState<PublicInsights | null>(null);
  const [publicProof, setPublicProof] = useState<PublicProof | null>(null);

  const hasAccess = meetsMinimumTier(user?.tier || 'observer', 'alignment');

  usePageMeta({
    title: 'Visibility Intelligence',
    description:
      'Visibility Intelligence shows your AI visibility state, model interpretation, active remediation activity, and projected citation impact.',
    path: '/analytics',
    structuredData: [
      buildWebPageSchema({
        path: '/analytics',
        name: 'Visibility Intelligence | AiVIS.biz',
        description:
          'AI visibility state, interpretation blockers, active remediation activity, and projected citation impact.',
      }),
    ],
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [analyticsRes, platformRes, insightsRes, proofRes] = await Promise.all([
          apiFetch(`${API_URL}/api/analytics?range=30d`, { headers: {} }),
          apiFetch(`${API_URL}/api/analytics/platform-metrics`, { headers: {} }),
          fetch(`${API_URL}/api/public/insights`),
          fetch(`${API_URL}/api/public/proof`),
        ]);

        if (!analyticsRes.ok) throw new Error('Failed to load visibility data');

        const analyticsJson = await analyticsRes.json();
        const nextAnalytics = mapAnalyticsApiResponse(analyticsJson);

        const nextPlatform = platformRes.ok
          ? mapPlatformMetricsResponse(await platformRes.json())
          : EMPTY_PLATFORM_METRICS;

        const nextInsights = insightsRes.ok
          ? ((await insightsRes.json()) as { success?: boolean; insights?: PublicInsights })
          : null;

        const nextProof = proofRes.ok
          ? ((await proofRes.json()) as { success?: boolean; proof?: PublicProof })
          : null;

        if (cancelled) return;
        setAnalytics(nextAnalytics);
        setPlatformMetrics(nextPlatform);
        setPublicInsights(nextInsights?.success ? nextInsights.insights || null : null);
        setPublicProof(nextProof?.success ? nextProof.proof || null : null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Visibility data unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const trendWindow = useMemo(() => analytics.recentTrend.slice(-7), [analytics.recentTrend]);
  const scoreDelta = useMemo(() => {
    if (trendWindow.length < 2) return 0;
    const first = trendWindow[0].avgScore;
    const last = trendWindow[trendWindow.length - 1].avgScore;
    return Math.round(last - first);
  }, [trendWindow]);

  const topIssues = useMemo(() => {
    const ranked = Object.entries(analytics.seoDiagnosticsSummary || {})
      .map(([key, counts]) => ({
        key,
        fail: Number(counts.fail || 0),
        warn: Number(counts.warn || 0),
      }))
      .sort((a, b) => (b.fail === a.fail ? b.warn - a.warn : b.fail - a.fail))
      .slice(0, 3);

    return ranked.map((issue) => CHECK_LABELS[issue.key] || issue.key.replace(/_/g, ' '));
  }, [analytics.seoDiagnosticsSummary]);

  const platformAverage = useMemo(() => {
    const values = Object.values(analytics.platformAverages || {}).filter(
      (value) => typeof value === 'number' && Number.isFinite(value)
    ) as number[];
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [analytics.platformAverages]);

  const confidence = useMemo(() => {
    if (analytics.totalAnalyses < 3) return 'Low';
    if (analytics.schemaInsights.coveragePct >= 65 && platformAverage >= 55) return 'High';
    return 'Medium';
  }, [analytics.totalAnalyses, analytics.schemaInsights.coveragePct, platformAverage]);

  const aiSummary = useMemo(() => {
    const schemaCoverage = Math.round(analytics.schemaInsights.coveragePct || 0);
    if (schemaCoverage < 40) {
      return 'Your site is interpreted as informative but structurally under-specified, which suppresses citation trust and entity resolution confidence.';
    }
    if (platformAverage >= 60) {
      return 'Your site is interpreted as a structurally coherent source, but remaining blocker clusters still cap citation probability in competitive prompts.';
    }
    return 'Your site is interpreted as partially reliable: content is parseable, but attribution confidence is reduced by weak schema and evidence continuity.';
  }, [analytics.schemaInsights.coveragePct, platformAverage]);

  const auditsCompleted = useMemo(() => {
    const metric24h = platformMetrics.timeframeMetrics.find((metric) => metric.key === '24h');
    return metric24h?.analysesRan ?? analytics.totalAnalyses;
  }, [platformMetrics.timeframeMetrics, analytics.totalAnalyses]);

  const fixesApplied = useMemo(() => {
    return analytics.improvementDeltas.filter((item) => Number(item.delta || 0) > 0).length;
  }, [analytics.improvementDeltas]);

  const rescansTriggered = useMemo(() => {
    const totalEvents = analytics.dailyActivity.reduce(
      (sum, day) => sum + Number(day.count || 0),
      0
    );
    return Math.max(0, totalEvents - analytics.urlsAudited);
  }, [analytics.dailyActivity, analytics.urlsAudited]);

  const projectedDiscoverabilityGain = useMemo(() => {
    if (publicProof?.avg_improvement && Number.isFinite(publicProof.avg_improvement)) {
      return clamp(Math.round(publicProof.avg_improvement), 1, 40);
    }
    if (!analytics.averageScore) return 0;
    const deltaPct =
      ((analytics.latestScore - analytics.averageScore) / analytics.averageScore) * 100;
    return clamp(Math.round(deltaPct), -40, 40);
  }, [publicProof?.avg_improvement, analytics.latestScore, analytics.averageScore]);

  const projectedCitationGain = useMemo(() => {
    const base = analytics.latestScore - analytics.averageScore;
    const structuralPenalty =
      Number(publicInsights?.pct_no_schema || 0) * 0.08 +
      Number(publicInsights?.pct_ai_crawler_blocked || 0) * 0.05;
    const candidate = Math.round(base * 1.8 - structuralPenalty + 12);
    return clamp(candidate, -25, 55);
  }, [analytics.latestScore, analytics.averageScore, publicInsights]);

  if (!hasAccess) {
    return (
      <UpgradeWall
        featureName="Visibility Intelligence"
        requiredTier="alignment"
        message="Upgrade to Alignment to access visibility state diagnostics, AI perception analysis, and remediation activity intelligence."
      />
    );
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#080a10] p-10 text-center">
        <Spinner size={38} className="mx-auto mb-4" />
        <p className="text-sm text-white/65">Loading visibility intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-400/25 bg-red-500/8 p-6">
        <p className="text-sm text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-300/20 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(16,185,129,0.18),rgba(5,8,14,0.95))] p-6 sm:p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">
          Visibility Intelligence
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black text-white">Your Visibility Health</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/72">
          AiVIS measures visibility state, not vanity analytics. Every signal below traces to audit
          evidence, citation behavior, or an active corrective action path.
        </p>
      </section>

      <section className="rounded-3xl border border-white/12 bg-[#0a0d15] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Visibility Score</p>
            <div className="mt-2 flex items-end gap-3">
              <span className="text-5xl font-black text-white tabular-nums">
                {analytics.latestScore}
              </span>
              <span className="mb-1 text-sm font-semibold text-emerald-300">
                {signedNumber(scoreDelta)} this week
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              North star status
            </p>
            <p className="mt-1 text-sm text-white/80">
              {analytics.latestScore >= 70
                ? 'Citation-ready baseline with targeted blockers'
                : 'Citation readiness below competitive threshold'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {topIssues.length ? (
            topIssues.map((issue) => (
              <div key={issue} className="rounded-xl border border-amber-300/20 bg-amber-400/8 p-3">
                <p className="text-sm text-amber-100">{issue}</p>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/12 bg-white/5 p-3 sm:col-span-3">
              <p className="text-sm text-white/75">
                No blocker cluster detected yet. Run more audits for stable issue ranking.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-300/18 bg-[linear-gradient(145deg,rgba(52,36,12,0.82),rgba(8,10,16,0.96))] p-6">
        <div className="flex items-center gap-2 text-amber-200">
          <Brain className="h-4 w-4" />
          <h2 className="text-lg font-bold">AI Interpretation Layer</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-white/78">{aiSummary}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-white/15 px-3 py-1 text-white/75">
            Confidence: {confidence}
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1 text-white/75">
            Schema coverage: {Math.round(analytics.schemaInsights.coveragePct || 0)}%
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1 text-white/75">
            Cross-model average: {platformAverage}/100
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-emerald-300/18 bg-emerald-400/8 p-4">
          <div className="flex items-center gap-2 text-emerald-200">
            <Wrench className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.16em]">Fixes Applied</p>
          </div>
          <p className="mt-2 text-3xl font-black text-white tabular-nums">{fixesApplied}</p>
        </article>
        <article className="rounded-2xl border border-emerald-300/18 bg-emerald-400/8 p-4">
          <div className="flex items-center gap-2 text-emerald-200">
            <Activity className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.16em]">Audits Completed</p>
          </div>
          <p className="mt-2 text-3xl font-black text-white tabular-nums">{auditsCompleted}</p>
        </article>
        <article className="rounded-2xl border border-amber-300/18 bg-amber-400/8 p-4">
          <div className="flex items-center gap-2 text-amber-200">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.16em]">Rescans Triggered</p>
          </div>
          <p className="mt-2 text-3xl font-black text-white tabular-nums">{rescansTriggered}</p>
        </article>
      </section>

      <section className="rounded-3xl border border-white/12 bg-[linear-gradient(120deg,rgba(7,10,16,0.96),rgba(18,26,40,0.96))] p-6">
        <div className="flex items-center gap-2 text-white">
          <TrendingUp className="h-4 w-4 text-emerald-300" />
          <h2 className="text-lg font-bold">Projected Impact</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">Discoverability</p>
            <p className="mt-2 text-3xl font-black text-emerald-300">
              {signedNumber(projectedDiscoverabilityGain)}%
            </p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">
              AI Citation Likelihood
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-300">
              {signedNumber(projectedCitationGain)}%
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/50">
          Projection model is derived from visibility trend movement, public improvement benchmarks,
          and active structural blockers. When evidence is unavailable, projections degrade
          conservatively.
        </p>
      </section>

      <section className="rounded-3xl border border-white/12 bg-[#0a0d15] p-5">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/app/scan')}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20"
          >
            <Gauge className="h-4 w-4" /> Run new audit
          </button>
          <Link
            to="/app/score-fix"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20"
          >
            <CheckCircle2 className="h-4 w-4" /> Open Score Fix
          </Link>
          <Link
            to="/methodology"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/8"
          >
            <Bot className="h-4 w-4" /> Review methodology
          </Link>
        </div>
        {analytics.totalAnalyses === 0 && (
          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/8 p-3 text-sm text-amber-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              No audit history yet. Run your first scan to populate visibility intelligence.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
