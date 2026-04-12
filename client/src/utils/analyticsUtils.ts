export interface TopDomainItem {
  domain: string;
  count: number;
  latestScore: number | null;
  avgScore: number | null;
}

export interface ScoreDistributionItem {
  bucket: string;
  count: number;
  pct: number;
}

export interface ImprovementDeltaItem {
  domain: string;
  url: string;
  firstScore: number | null;
  latestScore: number | null;
  delta: number | null;
  audits: number;
}

export interface DailyActivityItem {
  date: string;
  count: number;
}

export interface RulePassRate {
  ruleId: string;
  title: string;
  family: string;
  severity: string;
  hardBlocker: boolean;
  total: number;
  passCount: number;
  failCount: number;
  passRate: number;
}

export interface HardBlockerStats {
  auditsWithBlockers: number;
  totalAudits: number;
  avgBlockersPerAudit: number;
}

export interface DeterministicPipeline {
  avgFamilyScores: Record<string, number>;
  rulePassRates: RulePassRate[];
  hardBlockerStats: HardBlockerStats;
}

export interface PlatformTrendPoint {
  date: string;
  chatgpt: number | null;
  perplexity: number | null;
  google_ai: number | null;
  claude: number | null;
}

export interface MiniAnalyticsData {
  totalScans: number;
  avgScore: number;
  bestScore: number;
  latestScore: number;
  trendDelta: number;
  trend: Array<{
    date: string;
    score: number;
    url: string;
    chatgpt: number | null;
    perplexity: number | null;
    google_ai: number | null;
    claude: number | null;
  }>;
  distribution: Array<{ bucket: string; count: number }>;
}

export interface AnalyticsData {
  totalAnalyses: number;
  averageScore: number;
  latestScore: number;
  bestScore: number;
  worstScore: number;
  urlsAudited: number;
  topDomainsTotal: number;
  topDomains: TopDomainItem[];
  recentTrend: { date: string; count: number; avgScore: number }[];
  platformAverages: Record<string, number>;
  categoryAverages: { category: string; avgScore: number }[];
  seoDiagnosticsSummary: Record<string, { pass: number; warn: number; fail: number }>;
  scoreDistribution: ScoreDistributionItem[];
  improvementDeltas: ImprovementDeltaItem[];
  dailyActivity: DailyActivityItem[];
  platformTrends: PlatformTrendPoint[];
  streakDays: number;
  totalPasses: number;
  totalWarns: number;
  totalFails: number;
  deterministicPipeline: DeterministicPipeline | null;
  recommendationInsights: { total: number; avgPerAudit: number; topCategories: { category: string; count: number }[] };
  schemaInsights: { coveragePct: number; avgJsonLd: number; topTypes: { type: string; count: number }[] };
  contentAndTech: { avgWordCount: number; minWordCount: number; maxWordCount: number; httpsPct: number; avgResponseTimeMs: number; fastestResponseMs: number; slowestResponseMs: number };
  scoreVolatility: { domain: string; audits: number; stddev: number; label: string }[];
}

export interface PlatformTimeframeMetric {
  key: '1h' | '24h' | '7d' | '30d' | '90d' | '180d' | '365d';
  intervalText: string;
  analysesRan: number;
  activeMembers: number;
  freeMemberAnalyses: number;
  paidMemberAnalyses: number;
  freeActiveMembers: number;
  paidActiveMembers: number;
  avgVisibilityScore: number;
  sessionTraffic: number;
}

export interface PlatformMetricsData {
  trafficProxy: string;
  timeframeMetrics: PlatformTimeframeMetric[];
  membershipTotals: {
    totalMembers: number;
    realMembers: number;       // is_test = false
    testMembers: number;       // is_test = true
    freeMembers: number;
    paidMembers: number;       // all non-observer (includes admin-set)
    elevatedMembers: number;   // same as paidMembers (alias)
    stripePaidMembers: number; // stripe-verified paid only
  };
}

export const EMPTY_ANALYTICS_DATA: AnalyticsData = {
  totalAnalyses: 0,
  averageScore: 0,
  latestScore: 0,
  bestScore: 0,
  worstScore: 0,
  urlsAudited: 0,
  topDomainsTotal: 0,
  topDomains: [],
  recentTrend: [],
  platformAverages: {},
  categoryAverages: [],
  seoDiagnosticsSummary: {},
  scoreDistribution: [],
  improvementDeltas: [],
  dailyActivity: [],
  platformTrends: [],
  streakDays: 0,
  totalPasses: 0,
  totalWarns: 0,
  totalFails: 0,
  deterministicPipeline: null,
  recommendationInsights: { total: 0, avgPerAudit: 0, topCategories: [] },
  schemaInsights: { coveragePct: 0, avgJsonLd: 0, topTypes: [] },
  contentAndTech: { avgWordCount: 0, minWordCount: 0, maxWordCount: 0, httpsPct: 0, avgResponseTimeMs: 0, fastestResponseMs: 0, slowestResponseMs: 0 },
  scoreVolatility: [],
};

export const EMPTY_PLATFORM_METRICS: PlatformMetricsData = {
  trafficProxy: 'session_traffic_from_user_sessions',
  timeframeMetrics: [],
  membershipTotals: {
    totalMembers: 0,
    realMembers: 0,
    testMembers: 0,
    freeMembers: 0,
    paidMembers: 0,
    elevatedMembers: 0,
    stripePaidMembers: 0,
  },
};

function safeNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function toDomain(rawUrl: unknown): string {
  const value = String(rawUrl || '').trim();
  if (!value) return 'unknown';
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function mapRecentTrend(scoreHistory: unknown): Array<{ date: string; count: number; avgScore: number }> {
  const trendByDay = new Map<string, { date: string; sum: number; count: number }>();
  const list = Array.isArray(scoreHistory) ? scoreHistory : [];

  for (const item of list) {
    const date = String((item as any)?.date || '').trim();
    if (!date) continue;
    const score = safeNumber((item as any)?.score, 0);
    const existing = trendByDay.get(date);
    if (existing) {
      existing.sum += score;
      existing.count += 1;
    } else {
      trendByDay.set(date, { date, sum: score, count: 1 });
    }
  }

  return Array.from(trendByDay.values())
    .map((item) => ({
      date: item.date,
      count: item.count,
      avgScore: Math.round((item.sum / item.count) * 10) / 10,
    }))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
}

function normalizePlatformAverages(input: unknown): Record<string, number> {
  const source = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  const aliases: Record<'chatgpt' | 'perplexity' | 'google_ai' | 'claude', string[]> = {
    chatgpt: ['chatgpt'],
    perplexity: ['perplexity'],
    google_ai: ['google_ai', 'gemini_ai', 'google', 'google_ai_overviews'],
    claude: ['claude', 'claude/anthropic', 'anthropic'],
  };

  const canonical: Record<string, number> = {};
  for (const [platform, platformAliases] of Object.entries(aliases)) {
    const candidate = platformAliases
      .map((alias) => safeNumber(source[alias], NaN))
      .find((value) => Number.isFinite(value));
    canonical[platform] = Number.isFinite(candidate as number) ? (candidate as number) : 0;
  }

  return canonical;
}

export function mapAnalyticsApiResponse(json: unknown): AnalyticsData {
  const payload = json as any;
  if (!payload?.success || !payload?.data || typeof payload.data !== 'object') {
    throw new Error('Analytics service returned an invalid payload');
  }

  const data = payload.data;
  const summary = data.summary || {};

  return {
    totalAnalyses: safeNumber(summary.total_scans, 0) || safeNumber(summary.total_audits, 0),
    averageScore: safeNumber(summary.avg_score, 0),
    latestScore: safeNumber(summary.latest_score, 0),
    bestScore: safeNumber(summary.best_score, 0),
    worstScore: safeNumber(summary.worst_score, 0),
    urlsAudited: safeNumber(summary.urls_audited, 0),
    topDomainsTotal: safeNumber(data.url_breakdown_total, Array.isArray(data.url_breakdown) ? data.url_breakdown.length : 0),
    topDomains: (Array.isArray(data.url_breakdown) ? data.url_breakdown : []).map((item: any) => ({
      domain: toDomain(item?.url),
      count: safeNumber(item?.audits, 0),
      latestScore: Number.isFinite(Number(item?.latest_score)) ? Number(item.latest_score) : null,
      avgScore: Number.isFinite(Number(item?.avg_score)) ? Number(item.avg_score) : null,
    })),
    recentTrend: mapRecentTrend(data.score_history),
    platformAverages: normalizePlatformAverages(data.platform_averages),
    categoryAverages: (Array.isArray(data.category_averages) ? data.category_averages : []).map((item: any) => ({
      category: String(item?.category || 'Unknown'),
      avgScore: safeNumber(item?.avg_score, 0),
    })),
    seoDiagnosticsSummary: (data.seo_diagnostics_summary && typeof data.seo_diagnostics_summary === 'object')
      ? data.seo_diagnostics_summary
      : {},
    scoreDistribution: (Array.isArray(data.score_distribution) ? data.score_distribution : []).map((item: any) => ({
      bucket: String(item?.bucket || ''),
      count: safeNumber(item?.count, 0),
      pct: safeNumber(item?.pct, 0),
    })),
    improvementDeltas: (Array.isArray(data.improvement_deltas) ? data.improvement_deltas : []).map((item: any) => ({
      domain: String(item?.domain || ''),
      url: String(item?.url || ''),
      firstScore: Number.isFinite(Number(item?.first_score)) ? Number(item.first_score) : null,
      latestScore: Number.isFinite(Number(item?.latest_score)) ? Number(item.latest_score) : null,
      delta: Number.isFinite(Number(item?.delta)) ? Number(item.delta) : null,
      audits: safeNumber(item?.audits, 0),
    })),
    dailyActivity: (Array.isArray(data.daily_activity) ? data.daily_activity : []).map((item: any) => ({
      date: String(item?.date || ''),
      count: safeNumber(item?.count, 0),
    })),
    platformTrends: (Array.isArray(data.platform_trends) ? data.platform_trends : []).map((item: any) => ({
      date: String(item?.date || ''),
      chatgpt: Number.isFinite(Number(item?.chatgpt)) ? Number(item.chatgpt) : null,
      perplexity: Number.isFinite(Number(item?.perplexity)) ? Number(item.perplexity) : null,
      google_ai: Number.isFinite(Number(item?.google_ai)) ? Number(item.google_ai) : null,
      claude: Number.isFinite(Number(item?.claude)) ? Number(item.claude) : null,
    })),
    streakDays: safeNumber(summary.streak_days, 0),
    totalPasses: safeNumber(summary.total_passes, 0),
    totalWarns: safeNumber(summary.total_warns, 0),
    totalFails: safeNumber(summary.total_fails, 0),
    deterministicPipeline: mapDeterministicPipeline(data.deterministic_pipeline),
    recommendationInsights: mapRecommendationInsights(data.recommendation_insights),
    schemaInsights: mapSchemaInsights(data.schema_insights),
    contentAndTech: mapContentAndTech(data.content_and_tech),
    scoreVolatility: mapScoreVolatility(data.score_volatility),
  };
}

function mapDeterministicPipeline(input: unknown): DeterministicPipeline | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as any;

  const avgFamilyScores: Record<string, number> = {};
  if (d.avg_family_scores && typeof d.avg_family_scores === 'object') {
    for (const [k, v] of Object.entries(d.avg_family_scores)) {
      avgFamilyScores[k] = safeNumber(v, 0);
    }
  }

  const rulePassRates: RulePassRate[] = (Array.isArray(d.rule_pass_rates) ? d.rule_pass_rates : []).map((r: any) => ({
    ruleId: String(r?.rule_id || ''),
    title: String(r?.title || ''),
    family: String(r?.family || ''),
    severity: String(r?.severity || ''),
    hardBlocker: Boolean(r?.hard_blocker),
    total: safeNumber(r?.total, 0),
    passCount: safeNumber(r?.pass_count, 0),
    failCount: safeNumber(r?.fail_count, 0),
    passRate: safeNumber(r?.pass_rate, 0),
  }));

  const bs = d.hard_blocker_stats || {};
  const hardBlockerStats: HardBlockerStats = {
    auditsWithBlockers: safeNumber(bs.audits_with_blockers, 0),
    totalAudits: safeNumber(bs.total_audits, 0),
    avgBlockersPerAudit: safeNumber(bs.avg_blockers_per_audit, 0),
  };

  return { avgFamilyScores, rulePassRates, hardBlockerStats };
}

function mapRecommendationInsights(input: unknown): AnalyticsData['recommendationInsights'] {
  if (!input || typeof input !== 'object') return { total: 0, avgPerAudit: 0, topCategories: [] };
  const d = input as any;
  return {
    total: safeNumber(d.total, 0),
    avgPerAudit: safeNumber(d.avg_per_audit, 0),
    topCategories: (Array.isArray(d.top_categories) ? d.top_categories : []).map((c: any) => ({
      category: String(c?.category || 'uncategorized'),
      count: safeNumber(c?.count, 0),
    })),
  };
}

function mapSchemaInsights(input: unknown): AnalyticsData['schemaInsights'] {
  if (!input || typeof input !== 'object') return { coveragePct: 0, avgJsonLd: 0, topTypes: [] };
  const d = input as any;
  return {
    coveragePct: safeNumber(d.coverage_pct, 0),
    avgJsonLd: safeNumber(d.avg_json_ld, 0),
    topTypes: (Array.isArray(d.top_types) ? d.top_types : []).map((t: any) => ({
      type: String(t?.type || ''),
      count: safeNumber(t?.count, 0),
    })),
  };
}

function mapContentAndTech(input: unknown): AnalyticsData['contentAndTech'] {
  if (!input || typeof input !== 'object') return { avgWordCount: 0, minWordCount: 0, maxWordCount: 0, httpsPct: 0, avgResponseTimeMs: 0, fastestResponseMs: 0, slowestResponseMs: 0 };
  const d = input as any;
  return {
    avgWordCount: safeNumber(d.avg_word_count, 0),
    minWordCount: safeNumber(d.min_word_count, 0),
    maxWordCount: safeNumber(d.max_word_count, 0),
    httpsPct: safeNumber(d.https_pct, 0),
    avgResponseTimeMs: safeNumber(d.avg_response_time_ms, 0),
    fastestResponseMs: safeNumber(d.fastest_response_ms, 0),
    slowestResponseMs: safeNumber(d.slowest_response_ms, 0),
  };
}

function mapScoreVolatility(input: unknown): AnalyticsData['scoreVolatility'] {
  if (!Array.isArray(input)) return [];
  return input.map((item: any) => ({
    domain: String(item?.domain || ''),
    audits: safeNumber(item?.audits, 0),
    stddev: safeNumber(item?.stddev, 0),
    label: String(item?.label || 'stable'),
  }));
}

export function mapMiniAnalyticsResponse(json: unknown): MiniAnalyticsData {
  const payload = json as any;
  if (!payload?.success || !payload?.data) {
    throw new Error('Mini analytics returned invalid payload');
  }
  const d = payload.data;
  return {
    totalScans: safeNumber(d.total_scans, 0),
    avgScore: safeNumber(d.avg_score, 0),
    bestScore: safeNumber(d.best_score, 0),
    latestScore: safeNumber(d.latest_score, 0),
    trendDelta: safeNumber(d.trend_delta, 0),
    trend: (Array.isArray(d.trend) ? d.trend : []).map((p: any) => ({
      date: String(p?.date || ''),
      score: safeNumber(p?.score, 0),
      url: String(p?.url || ''),
      chatgpt: Number.isFinite(Number(p?.chatgpt)) ? Number(p.chatgpt) : null,
      perplexity: Number.isFinite(Number(p?.perplexity)) ? Number(p.perplexity) : null,
      google_ai: Number.isFinite(Number(p?.google_ai)) ? Number(p.google_ai) : null,
      claude: Number.isFinite(Number(p?.claude)) ? Number(p.claude) : null,
    })),
    distribution: (Array.isArray(d.distribution) ? d.distribution : []).map((p: any) => ({
      bucket: String(p?.bucket || ''),
      count: safeNumber(p?.count, 0),
    })),
  };
}

export function mapPlatformMetricsResponse(json: unknown): PlatformMetricsData {
  const payload = json as any;
  if (!payload?.success || !payload?.data || typeof payload.data !== 'object') {
    throw new Error('Platform metrics returned invalid payload');
  }

  const d = payload.data;
  return {
    trafficProxy: String(d.traffic_proxy || 'session_traffic_from_user_sessions'),
    timeframeMetrics: (Array.isArray(d.timeframe_metrics) ? d.timeframe_metrics : []).map((row: any) => ({
      key: String(row?.key || '24h') as PlatformTimeframeMetric['key'],
      intervalText: String(row?.interval_text || ''),
      analysesRan: safeNumber(row?.analyses_ran, 0),
      activeMembers: safeNumber(row?.active_members, 0),
      freeMemberAnalyses: safeNumber(row?.free_member_analyses, 0),
      paidMemberAnalyses: safeNumber(row?.paid_member_analyses, 0),
      freeActiveMembers: safeNumber(row?.free_active_members, 0),
      paidActiveMembers: safeNumber(row?.paid_active_members, 0),
      avgVisibilityScore: safeNumber(row?.avg_visibility_score, 0),
      sessionTraffic: safeNumber(row?.session_traffic, 0),
    })),
    membershipTotals: {
      totalMembers: safeNumber(d?.membership_totals?.total_members, 0),
      realMembers: safeNumber(d?.membership_totals?.real_members, 0),
      testMembers: safeNumber(d?.membership_totals?.test_members, 0),
      freeMembers: safeNumber(d?.membership_totals?.free_members, 0),
      paidMembers: safeNumber(d?.membership_totals?.elevated_members ?? d?.membership_totals?.paid_members, 0),
      elevatedMembers: safeNumber(d?.membership_totals?.elevated_members ?? d?.membership_totals?.paid_members, 0),
      stripePaidMembers: safeNumber(d?.membership_totals?.stripe_paid_members, 0),
    },
  };
}
