import type { PlannedToolCall, PlannedToolName } from './gsc.types.js';

const TOOL_BY_PATTERN: Array<{ pattern: RegExp; tool: PlannedToolName; confidence: number }> = [
  { pattern: /declin|drop|losing page|traffic down/i, tool: 'declining_pages', confidence: 0.92 },
  { pattern: /low ctr|ctr opportunity|high impression low click/i, tool: 'low_ctr_opportunities', confidence: 0.9 },
  { pattern: /winner|loser|what changed/i, tool: 'winners_losers_summary', confidence: 0.85 },
  { pattern: /gap|query gap|missed query/i, tool: 'query_gap_finder', confidence: 0.87 },
  { pattern: /decay|aging page|slow decline|historical decline/i, tool: 'page_decay_detector', confidence: 0.9 },
  { pattern: /cannibal|multiple pages|same query different pages/i, tool: 'cannibalization_detector', confidence: 0.9 },
  { pattern: /query matrix|query map|page queries/i, tool: 'page_query_matrix', confidence: 0.88 },
  { pattern: /recommend|fix plan|join audit|root cause/i, tool: 'audit_joined_recommendations', confidence: 0.86 },
];

function defaultArgsFor(tool: PlannedToolName): Record<string, unknown> {
  switch (tool) {
    case 'declining_pages':
      return { currentWindowDays: 60, previousWindowDays: 60, minClicks: 10, minLossPct: 30, sourceMode: 'live_gsc' };
    case 'low_ctr_opportunities':
      return { positionMin: 8, positionMax: 15, minImpressions: 100, maxCtr: 0.03, sourceMode: 'live_gsc' };
    case 'winners_losers_summary':
      return { rangeDays: 28, minImpressions: 50, sourceMode: 'live_gsc' };
    case 'query_gap_finder':
      return { minImpressions: 150, maxCtr: 0.02, sourceMode: 'live_gsc' };
    case 'page_decay_detector':
      return { lookbackMonths: 6, minPeakClicks: 30, declineConsistencyThreshold: 0.6, sourceMode: 'snapshot' };
    case 'cannibalization_detector':
      return { minSharedQueries: 2, minOverlapScore: 1, sourceMode: 'live_gsc' };
    case 'page_query_matrix':
      return { limit: 100, sourceMode: 'live_gsc' };
    case 'audit_joined_recommendations':
      return { compareWindowDays: 60, sourceMode: 'live_gsc' };
    default:
      return { sourceMode: 'live_gsc' };
  }
}

export function planToolFromPrompt(prompt: string): PlannedToolCall {
  const matched = TOOL_BY_PATTERN.find(({ pattern }) => pattern.test(prompt));
  const tool = matched?.tool || 'declining_pages';

  return {
    intent: tool,
    toolName: tool,
    args: defaultArgsFor(tool),
    confidence: matched?.confidence || 0.55,
  };
}
