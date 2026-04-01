export type ToolConfidence = 'observed' | 'correlated' | 'inferred';

export type GscSourceMode = 'live_gsc' | 'snapshot';

export type GscPropertyRef = {
  propertyId: string;
  siteUrl: string;
};

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type GscMetricRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type EvidenceRef = {
  evidenceId: string;
  sourceType: 'gsc' | 'aivis_audit';
  sourceRef: string;
};

export type LikelyCause = {
  type: string;
  confidence: ToolConfidence;
  reason: string;
};

export type ToolRowBase = {
  evidenceIds: string[];
  likelyCauses: LikelyCause[];
};

export type DecliningPageRow = ToolRowBase & {
  page: string;
  clicksBefore: number;
  clicksAfter: number;
  deltaClicks: number;
  deltaPct: number;
  impressionsBefore: number;
  impressionsAfter: number;
  ctrBefore: number;
  ctrAfter: number;
  positionBefore: number;
  positionAfter: number;
};

export type LowCtrOpportunityRow = ToolRowBase & {
  query: string;
  topPage: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  opportunityScore: number;
};

export type PageDecayRow = ToolRowBase & {
  page: string;
  peakPeriod: string;
  currentPeriod: string;
  declineRate: number;
  trendlineDirection: 'declining' | 'stable' | 'volatile';
};

export type CannibalizationRow = {
  query: string;
  urls: string[];
  clickShareByUrl: Record<string, number>;
  impressionShareByUrl: Record<string, number>;
  overlapScore: number;
  canonicalRisk: 'low' | 'medium' | 'high';
  intentSplitRisk: 'low' | 'medium' | 'high';
  evidenceIds: string[];
};

export type QueryGapRow = ToolRowBase & {
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  snippetRisk: 'low' | 'medium' | 'high';
  intentMismatchRisk: 'low' | 'medium' | 'high';
};

export type PageQueryMatrixRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  evidenceIds: string[];
};

export type RankedFix = {
  priority: 1 | 2 | 3;
  action: string;
  rationale: string;
};

export type AuditJoinedRecommendationRow = {
  page: string;
  summary: string;
  gsc: {
    clicksDeltaPct: number;
    ctrDelta: number;
    positionDelta: number;
  };
  auditFindings: Array<{
    type: string;
    severity: string;
    evidenceId?: string;
    summary: string;
  }>;
  rankedFixes: RankedFix[];
  expectedImpact: 'low' | 'medium' | 'high';
  evidenceIds: string[];
};

export type ToolOutput<T> = {
  tool: string;
  property: string;
  sourceMode: GscSourceMode;
  dateRanges: Record<string, DateRange>;
  rows: T[];
  truncated: boolean;
  notes: string[];
  dimensionSet?: string[];
  rowCount?: number;
  inferenceFlags?: string[];
};

export type PlannedToolName =
  | 'declining_pages'
  | 'low_ctr_opportunities'
  | 'winners_losers_summary'
  | 'query_gap_finder'
  | 'page_decay_detector'
  | 'cannibalization_detector'
  | 'page_query_matrix'
  | 'audit_joined_recommendations';

export type PlannedToolCall = {
  intent: PlannedToolName;
  toolName: PlannedToolName;
  args: Record<string, unknown>;
  confidence: number;
};

export type GscToolContext = {
  userId: string;
  workspaceId?: string | null;
};
