import { buildTrailingRange, monthWindowAgo } from './gsc.dates.js';
import { findRecentAuditsForPage, deriveLikelyAuditCauses } from './audit-join.service.js';
import { mintAuditEvidenceId, mintGscEvidenceId } from './evidence.service.js';
import {
  getPropertyForUser,
  getSnapshotPageMetrics,
  getSnapshotQueryPageMetrics,
  queryLiveMetrics,
  saveToolRun,
} from './gsc.service.js';
import type {
  AuditJoinedRecommendationRow,
  CannibalizationRow,
  DecliningPageRow,
  GscSourceMode,
  GscToolContext,
  LowCtrOpportunityRow,
  PageDecayRow,
  PageQueryMatrixRow,
  QueryGapRow,
  ToolOutput,
} from './gsc.types.js';
import {
  auditJoinedRecommendationsInputSchema,
  cannibalizationInputSchema,
  decliningPagesInputSchema,
  lowCtrOpportunitiesInputSchema,
  pageDecayInputSchema,
  pageQueryMatrixInputSchema,
  queryGapInputSchema,
  winnersLosersInputSchema,
} from './gsc.validators.js';

type BasicMetric = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position?: number;
};

function safePctChange(before: number, after: number): number {
  if (before <= 0) return after > 0 ? 100 : 0;
  return ((after - before) / before) * 100;
}

function avgPositionFromRow(row: { position?: number }): number {
  return Number(row.position || 0);
}

async function loadPageMetrics(args: {
  context: GscToolContext;
  propertyId: string;
  range: { startDate: string; endDate: string };
  sourceMode: GscSourceMode;
}): Promise<BasicMetric[]> {
  if (args.sourceMode === 'snapshot') {
    const rows = await getSnapshotPageMetrics({
      userId: args.context.userId,
      propertyId: args.propertyId,
      range: args.range,
    });
    return rows.map((row) => ({
      page: row.page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
      position: 0,
    }));
  }

  const live = await queryLiveMetrics({
    userId: args.context.userId,
    propertyId: args.propertyId,
    range: args.range,
    dimensions: ['page'],
    rowLimit: 2000,
  });

  return live.rows.map((row) => ({
    page: row.keys[0] || '',
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

export async function decliningPagesTool(context: GscToolContext, rawInput: Record<string, unknown>): Promise<ToolOutput<DecliningPageRow>> {
  const input = decliningPagesInputSchema.parse(rawInput);
  const currentRange = buildTrailingRange(input.currentWindowDays, 0);
  const previousRange = buildTrailingRange(input.previousWindowDays, input.currentWindowDays);

  const [currentRows, previousRows] = await Promise.all([
    loadPageMetrics({ context, propertyId: input.propertyId, range: currentRange, sourceMode: input.sourceMode }),
    loadPageMetrics({ context, propertyId: input.propertyId, range: previousRange, sourceMode: input.sourceMode }),
  ]);

  const currentMap = new Map(currentRows.map((r) => [r.page, r]));
  const previousMap = new Map(previousRows.map((r) => [r.page, r]));
  const pages = Array.from(new Set([...currentMap.keys(), ...previousMap.keys()])).filter(Boolean);

  const rows: DecliningPageRow[] = [];
  for (const page of pages) {
    const before = previousMap.get(page);
    const after = currentMap.get(page);
    const clicksBefore = before?.clicks || 0;
    const clicksAfter = after?.clicks || 0;
    const deltaPct = safePctChange(clicksBefore, clicksAfter);
    if (clicksBefore < input.minClicks || deltaPct > -input.minLossPct) continue;

    const evidenceId = await mintGscEvidenceId({
      userId: context.userId,
      propertyId: input.propertyId,
      toolName: 'declining_pages',
      sourceMode: input.sourceMode,
      sourceRef: page,
      payload: { page, clicksBefore, clicksAfter, deltaPct },
    });

    rows.push({
      page,
      clicksBefore,
      clicksAfter,
      deltaClicks: clicksAfter - clicksBefore,
      deltaPct,
      impressionsBefore: before?.impressions || 0,
      impressionsAfter: after?.impressions || 0,
      ctrBefore: before?.ctr || 0,
      ctrAfter: after?.ctr || 0,
      positionBefore: avgPositionFromRow(before || {}),
      positionAfter: avgPositionFromRow(after || {}),
      evidenceIds: [evidenceId],
      likelyCauses: [{ type: 'traffic_decline', confidence: 'observed', reason: 'Significant click decline observed in compared windows.' }],
    });
  }

  rows.sort((a, b) => a.deltaPct - b.deltaPct);

  await saveToolRun({
    userId: context.userId,
    propertyId: input.propertyId,
    toolName: 'declining_pages',
    sourceMode: input.sourceMode,
    inputArgs: input,
    outputSummary: { rowCount: rows.length },
  });

  const property = await getPropertyForUser(context.userId, input.propertyId);
  return {
    tool: 'declining_pages',
    property: property?.site_url || input.propertyId,
    sourceMode: input.sourceMode,
    dateRanges: { previous: previousRange, current: currentRange },
    rows,
    truncated: rows.length > 200,
    notes: rows.length ? [] : ['No declining pages matched thresholds.'],
  };
}

export async function lowCtrOpportunitiesTool(context: GscToolContext, rawInput: Record<string, unknown>): Promise<ToolOutput<LowCtrOpportunityRow>> {
  const input = lowCtrOpportunitiesInputSchema.parse(rawInput);

  const live = await queryLiveMetrics({
    userId: context.userId,
    propertyId: input.propertyId,
    range: { startDate: input.startDate, endDate: input.endDate },
    dimensions: ['query', 'page'],
    rowLimit: 4000,
  });

  const rows: LowCtrOpportunityRow[] = [];
  for (const row of live.rows) {
    const query = row.keys[0] || '';
    const page = row.keys[1] || '';
    if (!query || !page) continue;
    if (row.impressions < input.minImpressions) continue;
    if (row.position < input.positionMin || row.position > input.positionMax) continue;
    if (row.ctr > input.maxCtr) continue;

    const opportunityScore = Number((row.impressions * (input.maxCtr - row.ctr + 0.0001)).toFixed(4));
    const evidenceId = await mintGscEvidenceId({
      userId: context.userId,
      propertyId: input.propertyId,
      toolName: 'low_ctr_opportunities',
      sourceMode: input.sourceMode,
      sourceRef: `${query}::${page}`,
      payload: { query, page, impressions: row.impressions, ctr: row.ctr, position: row.position },
    });

    rows.push({
      query,
      topPage: page,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      position: row.position,
      opportunityScore,
      evidenceIds: [evidenceId],
      likelyCauses: [{ type: 'snippet_mismatch', confidence: 'inferred', reason: 'Ranking is visible, but CTR underperforms expected range.' }],
    });
  }

  rows.sort((a, b) => b.opportunityScore - a.opportunityScore);

  await saveToolRun({
    userId: context.userId,
    propertyId: input.propertyId,
    toolName: 'low_ctr_opportunities',
    sourceMode: input.sourceMode,
    inputArgs: input,
    outputSummary: { rowCount: rows.length },
  });

  return {
    tool: 'low_ctr_opportunities',
    property: live.property.site_url,
    sourceMode: input.sourceMode,
    dateRanges: { window: { startDate: input.startDate, endDate: input.endDate } },
    rows,
    truncated: rows.length > 300,
    notes: rows.length ? [] : ['No low CTR opportunities met thresholds.'],
    dimensionSet: ['query', 'page'],
  };
}

export async function winnersLosersSummaryTool(context: GscToolContext, rawInput: Record<string, unknown>): Promise<ToolOutput<DecliningPageRow>> {
  const input = winnersLosersInputSchema.parse(rawInput);
  const currentRange = buildTrailingRange(input.rangeDays, 0);
  const previousRange = buildTrailingRange(input.rangeDays, input.rangeDays);

  const [currentRows, previousRows] = await Promise.all([
    loadPageMetrics({ context, propertyId: input.propertyId, range: currentRange, sourceMode: input.sourceMode }),
    loadPageMetrics({ context, propertyId: input.propertyId, range: previousRange, sourceMode: input.sourceMode }),
  ]);

  const currentMap = new Map(currentRows.map((r) => [r.page, r]));
  const previousMap = new Map(previousRows.map((r) => [r.page, r]));
  const pages = Array.from(new Set([...currentMap.keys(), ...previousMap.keys()])).filter(Boolean);

  const rows: DecliningPageRow[] = [];
  for (const page of pages) {
    const before = previousMap.get(page);
    const after = currentMap.get(page);
    const impressionsBefore = before?.impressions || 0;
    const impressionsAfter = after?.impressions || 0;
    if (Math.max(impressionsBefore, impressionsAfter) < input.minImpressions) continue;

    const evidenceId = await mintGscEvidenceId({
      userId: context.userId,
      propertyId: input.propertyId,
      toolName: 'winners_losers_summary',
      sourceMode: input.sourceMode,
      sourceRef: page,
      payload: {
        beforeClicks: before?.clicks || 0,
        afterClicks: after?.clicks || 0,
        beforeImpressions: impressionsBefore,
        afterImpressions: impressionsAfter,
      },
    });

    rows.push({
      page,
      clicksBefore: before?.clicks || 0,
      clicksAfter: after?.clicks || 0,
      deltaClicks: (after?.clicks || 0) - (before?.clicks || 0),
      deltaPct: safePctChange(before?.clicks || 0, after?.clicks || 0),
      impressionsBefore,
      impressionsAfter,
      ctrBefore: before?.ctr || 0,
      ctrAfter: after?.ctr || 0,
      positionBefore: avgPositionFromRow(before || {}),
      positionAfter: avgPositionFromRow(after || {}),
      evidenceIds: [evidenceId],
      likelyCauses: [{ type: 'trend_shift', confidence: 'observed', reason: 'Page-level click and impression trend shift across adjacent windows.' }],
    });
  }

  rows.sort((a, b) => b.deltaClicks - a.deltaClicks);

  await saveToolRun({
    userId: context.userId,
    propertyId: input.propertyId,
    toolName: 'winners_losers_summary',
    sourceMode: input.sourceMode,
    inputArgs: input,
    outputSummary: { rowCount: rows.length },
  });

  const property = await getPropertyForUser(context.userId, input.propertyId);
  return {
    tool: 'winners_losers_summary',
    property: property?.site_url || input.propertyId,
    sourceMode: input.sourceMode,
    dateRanges: { previous: previousRange, current: currentRange },
    rows,
    truncated: rows.length > 300,
    notes: rows.length ? [] : ['No winners/losers met minimum impression threshold.'],
  };
}

export async function queryGapFinderTool(context: GscToolContext, rawInput: Record<string, unknown>): Promise<ToolOutput<QueryGapRow>> {
  const input = queryGapInputSchema.parse(rawInput);

  const live = await queryLiveMetrics({
    userId: context.userId,
    propertyId: input.propertyId,
    range: { startDate: input.startDate, endDate: input.endDate },
    dimensions: ['query', 'page'],
    rowLimit: 5000,
  });

  const rows: QueryGapRow[] = [];
  for (const row of live.rows) {
    const query = row.keys[0] || '';
    const page = row.keys[1] || '';
    if (!query || !page) continue;
    if (row.impressions < input.minImpressions || row.ctr > input.maxCtr) continue;

    const snippetRisk: 'low' | 'medium' | 'high' = row.position <= 6 ? 'high' : row.position <= 10 ? 'medium' : 'low';
    const intentMismatchRisk: 'low' | 'medium' | 'high' = /how|what|why|best|vs/i.test(query) ? 'medium' : 'low';

    const evidenceId = await mintGscEvidenceId({
      userId: context.userId,
      propertyId: input.propertyId,
      toolName: 'query_gap_finder',
      sourceMode: input.sourceMode,
      sourceRef: `${query}::${page}`,
      payload: { query, page, impressions: row.impressions, ctr: row.ctr, position: row.position },
    });

    rows.push({
      query,
      page,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      position: row.position,
      snippetRisk,
      intentMismatchRisk,
      evidenceIds: [evidenceId],
      likelyCauses: [{ type: 'query_gap', confidence: 'observed', reason: 'High impression / low CTR gap detected.' }],
    });
  }

  rows.sort((a, b) => b.impressions - a.impressions);

  await saveToolRun({
    userId: context.userId,
    propertyId: input.propertyId,
    toolName: 'query_gap_finder',
    sourceMode: input.sourceMode,
    inputArgs: input,
    outputSummary: { rowCount: rows.length },
  });

  return {
    tool: 'query_gap_finder',
    property: live.property.site_url,
    sourceMode: input.sourceMode,
    dateRanges: { window: { startDate: input.startDate, endDate: input.endDate } },
    rows,
    truncated: rows.length > 500,
    notes: rows.length ? [] : ['No query gaps matched thresholds.'],
    dimensionSet: ['query', 'page'],
  };
}

export async function pageDecayDetectorTool(context: GscToolContext, rawInput: Record<string, unknown>): Promise<ToolOutput<PageDecayRow>> {
  const input = pageDecayInputSchema.parse(rawInput);

  const monthlyData: Array<{ period: string; page: string; clicks: number }> = [];

  for (let m = input.lookbackMonths - 1; m >= 0; m -= 1) {
    const range = monthWindowAgo(m);
    const rows = await loadPageMetrics({ context, propertyId: input.propertyId, range, sourceMode: input.sourceMode });
    for (const row of rows) {
      monthlyData.push({
        period: `${range.startDate.slice(0, 7)}`,
        page: row.page,
        clicks: row.clicks,
      });
    }
  }

  const byPage = new Map<string, Array<{ period: string; clicks: number }>>();
  for (const row of monthlyData) {
    if (!byPage.has(row.page)) byPage.set(row.page, []);
    byPage.get(row.page)!.push({ period: row.period, clicks: row.clicks });
  }

  const rows: PageDecayRow[] = [];
  for (const [page, points] of byPage.entries()) {
    if (points.length < 3) continue;
    const ordered = points.sort((a, b) => a.period.localeCompare(b.period));
    const peak = ordered.reduce((max, p) => (p.clicks > max.clicks ? p : max), ordered[0]);
    if (peak.clicks < input.minPeakClicks) continue;
    const current = ordered[ordered.length - 1];
    const declineRate = (peak.clicks - current.clicks) / Math.max(peak.clicks, 1);
    if (declineRate <= 0) continue;

    const negativeSteps = ordered.slice(1).filter((p, idx) => p.clicks <= ordered[idx].clicks).length;
    const consistency = negativeSteps / Math.max(ordered.length - 1, 1);
    const direction: 'declining' | 'stable' | 'volatile' = consistency >= input.declineConsistencyThreshold
      ? 'declining'
      : consistency >= 0.45
        ? 'volatile'
        : 'stable';

    if (direction === 'stable') continue;

    const evidenceId = await mintGscEvidenceId({
      userId: context.userId,
      propertyId: input.propertyId,
      toolName: 'page_decay_detector',
      sourceMode: input.sourceMode,
      sourceRef: page,
      payload: { peakPeriod: peak.period, currentPeriod: current.period, declineRate, consistency },
    });

    rows.push({
      page,
      peakPeriod: peak.period,
      currentPeriod: current.period,
      declineRate: Number(declineRate.toFixed(4)),
      trendlineDirection: direction,
      evidenceIds: [evidenceId],
      likelyCauses: [{ type: 'content_decay', confidence: 'correlated', reason: 'Traffic trend shows sustained post-peak decline.' }],
    });
  }

  rows.sort((a, b) => b.declineRate - a.declineRate);

  await saveToolRun({
    userId: context.userId,
    propertyId: input.propertyId,
    toolName: 'page_decay_detector',
    sourceMode: input.sourceMode,
    inputArgs: input,
    outputSummary: { rowCount: rows.length },
  });

  const property = await getPropertyForUser(context.userId, input.propertyId);
  return {
    tool: 'page_decay_detector',
    property: property?.site_url || input.propertyId,
    sourceMode: input.sourceMode,
    dateRanges: { lookback: { startDate: monthWindowAgo(input.lookbackMonths - 1).startDate, endDate: monthWindowAgo(0).endDate } },
    rows,
    truncated: rows.length > 200,
    notes: rows.length ? [] : ['No decaying pages detected with current thresholds.'],
  };
}

export async function cannibalizationDetectorTool(context: GscToolContext, rawInput: Record<string, unknown>): Promise<ToolOutput<CannibalizationRow>> {
  const input = cannibalizationInputSchema.parse(rawInput);

  const rows = input.sourceMode === 'snapshot'
    ? await getSnapshotQueryPageMetrics({
      userId: context.userId,
      propertyId: input.propertyId,
      range: { startDate: input.startDate, endDate: input.endDate },
    })
    : (await queryLiveMetrics({
      userId: context.userId,
      propertyId: input.propertyId,
      range: { startDate: input.startDate, endDate: input.endDate },
      dimensions: ['query', 'page'],
      rowLimit: 5000,
    })).rows.map((r) => ({
      query: r.keys[0] || '',
      page: r.keys[1] || '',
      clicks: r.clicks,
      impressions: r.impressions,
    }));

  const filtered = input.topic
    ? rows.filter((r) => r.query.toLowerCase().includes(input.topic!.toLowerCase()))
    : rows;

  const byQuery = new Map<string, Array<{ page: string; clicks: number; impressions: number }>>();
  for (const row of filtered) {
    if (!row.query || !row.page) continue;
    if (!byQuery.has(row.query)) byQuery.set(row.query, []);
    byQuery.get(row.query)!.push({ page: row.page, clicks: row.clicks, impressions: row.impressions });
  }

  const output: CannibalizationRow[] = [];

  for (const [query, variants] of byQuery.entries()) {
    const byPage = new Map<string, { clicks: number; impressions: number }>();
    for (const variant of variants) {
      const prev = byPage.get(variant.page) || { clicks: 0, impressions: 0 };
      byPage.set(variant.page, {
        clicks: prev.clicks + variant.clicks,
        impressions: prev.impressions + variant.impressions,
      });
    }

    const urls = Array.from(byPage.keys());
    if (urls.length < input.minSharedQueries) continue;

    const totalClicks = Array.from(byPage.values()).reduce((sum, val) => sum + val.clicks, 0);
    const totalImpressions = Array.from(byPage.values()).reduce((sum, val) => sum + val.impressions, 0);

    const clickShareByUrl: Record<string, number> = {};
    const impressionShareByUrl: Record<string, number> = {};

    const shares = urls.map((url) => {
      const stats = byPage.get(url)!;
      const clickShare = totalClicks > 0 ? stats.clicks / totalClicks : 0;
      const impressionShare = totalImpressions > 0 ? stats.impressions / totalImpressions : 0;
      clickShareByUrl[url] = Number(clickShare.toFixed(4));
      impressionShareByUrl[url] = Number(impressionShare.toFixed(4));
      return clickShare;
    });

    const entropy = shares.reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0);
    const overlapScore = Number(entropy.toFixed(4));
    if (overlapScore < input.minOverlapScore) continue;

    const canonicalRisk: 'low' | 'medium' | 'high' = overlapScore > 1.5 ? 'high' : overlapScore > 1 ? 'medium' : 'low';
    const intentSplitRisk: 'low' | 'medium' | 'high' = urls.length >= 4 ? 'high' : urls.length >= 3 ? 'medium' : 'low';

    const evidenceId = await mintGscEvidenceId({
      userId: context.userId,
      propertyId: input.propertyId,
      toolName: 'cannibalization_detector',
      sourceMode: input.sourceMode,
      sourceRef: query,
      payload: { query, urls, overlapScore, clickShareByUrl, impressionShareByUrl },
    });

    output.push({
      query,
      urls,
      clickShareByUrl,
      impressionShareByUrl,
      overlapScore,
      canonicalRisk,
      intentSplitRisk,
      evidenceIds: [evidenceId],
    });
  }

  output.sort((a, b) => b.overlapScore - a.overlapScore);

  await saveToolRun({
    userId: context.userId,
    propertyId: input.propertyId,
    toolName: 'cannibalization_detector',
    sourceMode: input.sourceMode,
    inputArgs: input,
    outputSummary: { rowCount: output.length },
  });

  const property = await getPropertyForUser(context.userId, input.propertyId);
  return {
    tool: 'cannibalization_detector',
    property: property?.site_url || input.propertyId,
    sourceMode: input.sourceMode,
    dateRanges: { window: { startDate: input.startDate, endDate: input.endDate } },
    rows: output,
    truncated: output.length > 300,
    notes: output.length ? [] : ['No cannibalization clusters found with current thresholds.'],
  };
}

export async function pageQueryMatrixTool(context: GscToolContext, rawInput: Record<string, unknown>): Promise<ToolOutput<PageQueryMatrixRow>> {
  const input = pageQueryMatrixInputSchema.parse(rawInput);

  const rows = input.sourceMode === 'snapshot'
    ? await getSnapshotQueryPageMetrics({
      userId: context.userId,
      propertyId: input.propertyId,
      range: { startDate: input.startDate, endDate: input.endDate },
    })
    : (await queryLiveMetrics({
      userId: context.userId,
      propertyId: input.propertyId,
      range: { startDate: input.startDate, endDate: input.endDate },
      dimensions: ['query', 'page'],
      rowLimit: Math.min(5000, input.limit * 6),
    })).rows.map((r) => ({
      query: r.keys[0] || '',
      page: r.keys[1] || '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));

  const targetPage = input.page;
  const matrix = rows
    .filter((row) => row.page === targetPage)
    .map(async (row) => {
      const evidenceId = await mintGscEvidenceId({
        userId: context.userId,
        propertyId: input.propertyId,
        toolName: 'page_query_matrix',
        sourceMode: input.sourceMode,
        sourceRef: `${targetPage}::${row.query}`,
        payload: { page: targetPage, query: row.query, clicks: row.clicks, impressions: row.impressions },
      });

      return {
        query: row.query,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: 'ctr' in row ? Number(row.ctr || 0) : row.impressions > 0 ? row.clicks / row.impressions : 0,
        position: 'position' in row ? Number(row.position || 0) : 0,
        evidenceIds: [evidenceId],
      };
    });

  const resolved = (await Promise.all(matrix)).sort((a, b) => b.clicks - a.clicks).slice(0, input.limit);

  await saveToolRun({
    userId: context.userId,
    propertyId: input.propertyId,
    toolName: 'page_query_matrix',
    sourceMode: input.sourceMode,
    inputArgs: input,
    outputSummary: { rowCount: resolved.length, page: targetPage },
  });

  const property = await getPropertyForUser(context.userId, input.propertyId);
  return {
    tool: 'page_query_matrix',
    property: property?.site_url || input.propertyId,
    sourceMode: input.sourceMode,
    dateRanges: { window: { startDate: input.startDate, endDate: input.endDate } },
    rows: resolved,
    truncated: resolved.length >= input.limit,
    notes: resolved.length ? [] : ['No query data found for this page and date range.'],
    rowCount: resolved.length,
  };
}

export async function auditJoinedRecommendationsTool(context: GscToolContext, rawInput: Record<string, unknown>): Promise<ToolOutput<AuditJoinedRecommendationRow>> {
  const input = auditJoinedRecommendationsInputSchema.parse(rawInput);

  const compare = await decliningPagesTool(context, {
    propertyId: input.propertyId,
    currentWindowDays: input.compareWindowDays,
    previousWindowDays: input.compareWindowDays,
    minClicks: 1,
    minLossPct: 1,
    sourceMode: input.sourceMode,
  });

  const matching = compare.rows.find((row) => row.page === input.page) || compare.rows[0];
  if (!matching) {
    return {
      tool: 'audit_joined_recommendations',
      property: input.propertyId,
      sourceMode: input.sourceMode,
      dateRanges: compare.dateRanges,
      rows: [],
      truncated: false,
      notes: ['No decline signal available to join with audit evidence.'],
    };
  }

  const audits = await findRecentAuditsForPage(context.userId, matching.page);
  const auditFindings: Array<{ type: string; severity: string; evidenceId?: string; summary: string }> = [];

  for (const audit of audits) {
    const causes = deriveLikelyAuditCauses(audit.result);
    for (const cause of causes) {
      const evidenceId = await mintAuditEvidenceId({
        userId: context.userId,
        propertyId: input.propertyId,
        auditId: audit.id,
        findingType: cause.type,
        payload: { auditId: audit.id, cause },
      });

      auditFindings.push({
        type: cause.type,
        severity: cause.severity,
        summary: cause.summary,
        evidenceId,
      });
    }
  }

  const rankedFixes = [
    {
      priority: 1 as const,
      action: 'Improve title/meta to match dominant query intent.',
      rationale: 'CTR and/or ranking underperformance indicates mismatch at snippet level.',
    },
    {
      priority: 2 as const,
      action: 'Refresh page sections for query coverage and entity depth.',
      rationale: 'Declining or stagnant pages often recover after intent-complete content refresh.',
    },
    {
      priority: 3 as const,
      action: 'Strengthen internal links from related high-authority pages.',
      rationale: 'Helps consolidate relevance and distributes authority for decaying URLs.',
    },
  ];

  const expectedImpact: 'low' | 'medium' | 'high' = Math.abs(matching.deltaPct) > 50 ? 'high' : Math.abs(matching.deltaPct) > 25 ? 'medium' : 'low';

  const evidenceIds = [
    ...matching.evidenceIds,
    ...auditFindings.map((f) => f.evidenceId).filter((v): v is string => Boolean(v)),
  ];

  const recommendationRow: AuditJoinedRecommendationRow = {
    page: matching.page,
    summary: `Joined GSC decline signal with ${auditFindings.length} recent audit findings.`,
    gsc: {
      clicksDeltaPct: Number(matching.deltaPct.toFixed(2)),
      ctrDelta: Number((matching.ctrAfter - matching.ctrBefore).toFixed(4)),
      positionDelta: Number((matching.positionAfter - matching.positionBefore).toFixed(2)),
    },
    auditFindings,
    rankedFixes,
    expectedImpact,
    evidenceIds,
  };

  await saveToolRun({
    userId: context.userId,
    propertyId: input.propertyId,
    toolName: 'audit_joined_recommendations',
    sourceMode: input.sourceMode,
    inputArgs: input,
    outputSummary: { rowCount: 1, joinedAuditCount: audits.length },
  });

  return {
    tool: 'audit_joined_recommendations',
    property: input.propertyId,
    sourceMode: input.sourceMode,
    dateRanges: compare.dateRanges,
    rows: [recommendationRow],
    truncated: false,
    notes: audits.length ? [] : ['No direct recent audits found for this page; recommendations rely on GSC-only evidence.'],
  };
}

export type GscToolName =
  | 'declining_pages'
  | 'low_ctr_opportunities'
  | 'winners_losers_summary'
  | 'query_gap_finder'
  | 'page_decay_detector'
  | 'cannibalization_detector'
  | 'page_query_matrix'
  | 'audit_joined_recommendations';

export const gscToolRegistry: Record<GscToolName, (context: GscToolContext, args: Record<string, unknown>) => Promise<ToolOutput<unknown>>> = {
  declining_pages: decliningPagesTool,
  low_ctr_opportunities: lowCtrOpportunitiesTool,
  winners_losers_summary: winnersLosersSummaryTool,
  query_gap_finder: queryGapFinderTool,
  page_decay_detector: pageDecayDetectorTool,
  cannibalization_detector: cannibalizationDetectorTool,
  page_query_matrix: pageQueryMatrixTool,
  audit_joined_recommendations: auditJoinedRecommendationsTool,
};

export async function executeGscTool(toolName: GscToolName, context: GscToolContext, args: Record<string, unknown>) {
  const handler = gscToolRegistry[toolName];
  if (!handler) {
    throw new Error(`Unknown GSC tool: ${toolName}`);
  }
  return handler(context, args);
}
