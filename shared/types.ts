/* ========================= Product Definition (LOCKED) ========================= */
/**
 * AI Search Visibility Audit & Monitoring Tool
 *
 * PURPOSE: Determine how AI systems parse, trust, and surface a website
 *          in AI-driven search and answer engines
 *
 * FOCUS AREAS:
 * - Machine interpretation (how AI reads the site)
 * - Extractability (can AI pull structured data)
 * - Structural clarity (schema, headings, semantic HTML)
 * - Evidence availability (can AI find and cite facts)
 *
 * NOT ABOUT:
 * - Market demand
 * - Idea quality
 * - Validation
 * - Growth advice
 */

/* ========================= Canonical tier system ========================= */

export type CanonicalTier = 'observer' | 'starter' | 'alignment' | 'signal' | 'scorefix';

/**
 * Legacy tier aliases for backwards compatibility
 */
export type LegacyTier = 'free' | 'core' | 'premium';

/**
 * Public-facing tiers for marketing/UI
 * NOTE: UiTier is intentionally identical to CanonicalTier.
 * If UI naming ever diverges from canonical naming, update the
 * LEGACY_TO_UI_TIER map and canonicalTierFromUi() accordingly.
 */
export type UiTier = 'observer' | 'starter' | 'alignment' | 'signal' | 'scorefix';

/** Convenience re-aliases for external consumers */
export type Tier = CanonicalTier;
export type User = AuthUser;

/* ========================= Tier lookup maps ========================= */

const LEGACY_TO_UI_TIER: Readonly<Record<CanonicalTier | LegacyTier, UiTier>> = {
  // canonical pass-through
  observer: 'observer',
  starter: 'starter',
  alignment: 'alignment',
  signal: 'signal',
  scorefix: 'scorefix',
  // legacy aliases
  free: 'observer',
  core: 'alignment',
  premium: 'signal',
};

const UI_DISPLAY_NAMES: Readonly<Record<UiTier, string>> = {
  observer: 'Observer (Free)',
  starter: 'Starter',
  alignment: 'Alignment (Core)',
  signal: 'Signal (Pro)',
  scorefix: 'Score Fix [AutoFix PR]',
};

const TIER_POSITIONING: Readonly<Record<CanonicalTier, string>> = {
  observer: 'detection audit — see what AI systems misread on your site; free forever',
  starter: 'full audit with all recommendations, implementation code, and fix-ready outputs',
  alignment: 'structured optimization system — turn extraction failures into evidence-backed fixes',
  signal: 'verified AI answer pipeline — triple-check consensus across 3 models',
  scorefix: 'evidence-based fix pack — automated PRs that ship fixes, not guesses',
};

const TIER_AUDIENCE: Readonly<Record<CanonicalTier, string>> = {
  observer: 'curious builders • founders testing the mirror • free forever',
  starter: 'solo founders • side-project owners • early-stage builders who need fixes not just scores',
  alignment: 'solo builders • early founders • no-code creators • production ready audits',
  signal: 'agencies • studios • internal teams • 14-day free trial available',
  scorefix: 'teams needing automated remediation • CI/CD integration • auto-PR fixes',
};

const TIER_HIERARCHY: Readonly<Record<CanonicalTier | LegacyTier, number>> = {
  observer: 0,
  starter: 1,
  alignment: 2,
  signal: 3,
  scorefix: 4,
  free: 0,
  core: 2,
  premium: 3,
};

/**
 * Valid tier strings accepted at runtime (includes legacy + canonical).
 * 'enterprise' and 'pro' are intentionally excluded - they have no defined
 * mapping and will be rejected by isAuthUser() rather than silently
 * falling through to 'observer'.
 */
const VALID_TIER_STRINGS: ReadonlySet<string> = new Set<CanonicalTier | LegacyTier>([
  'observer',
  'starter',
  'alignment',
  'signal',
  'scorefix',
  'free',
  'core',
  'premium',
]);

/* ========================= Tier utility functions ========================= */

/**
 * Converts canonical or legacy tier string to the corresponding UiTier.
 * Falls back to 'observer' for unrecognized values - log a warning in callers
 * if this fallback is reached unexpectedly.
 */
export function uiTierFromCanonical(tier: CanonicalTier | LegacyTier): UiTier {
  return LEGACY_TO_UI_TIER[tier] ?? 'observer';
}

/**
 * Converts UiTier to CanonicalTier.
 * UiTier === CanonicalTier today; this function exists as a seam in case
 * they diverge in future.
 */
export function canonicalTierFromUi(tier: UiTier): CanonicalTier {
  return tier;
}

/**
 * Get the human-readable display name for a tier (supports legacy).
 */
export function getTierDisplayName(tier: CanonicalTier | LegacyTier): string {
  return UI_DISPLAY_NAMES[uiTierFromCanonical(tier)] ?? UI_DISPLAY_NAMES.observer;
}

/**
 * Get the one-line positioning tagline for a canonical tier.
 */
export function getTierPositioning(tier: CanonicalTier): string {
  return TIER_POSITIONING[tier];
}

/**
 * Get the target audience descriptor for a canonical tier.
 */
export function getTierAudience(tier: CanonicalTier): string {
  return TIER_AUDIENCE[tier];
}

/**
 * Returns true if the user's tier meets or exceeds the required tier.
 */
export function meetsMinimumTier(
  userTier: CanonicalTier | LegacyTier,
  requiredTier: CanonicalTier
): boolean {
  const userRank = TIER_HIERARCHY[userTier] ?? 0;
  const requiredRank = TIER_HIERARCHY[requiredTier] ?? 0;
  return userRank >= requiredRank;
}

/* ========================= Tier feature limits ========================= */

export interface TierLimits {
  /** -1 means unlimited */
  scansPerMonth: number;
  pagesPerScan: number;
  competitors: number;
  cacheDays: number;
  hasExports: boolean;
  hasForceRefresh: boolean;
  hasApiAccess: boolean;
  hasWhiteLabel: boolean;
  hasScheduledRescans: boolean;
  hasReportHistory: boolean;
  hasShareableLink: boolean;
  hasMentionDigests: boolean;
  hasNicheDiscovery: boolean;
  hasTripleCheck: boolean;
  hasAlertIntegrations: boolean;
  hasAutomationWorkflows: boolean;
  hasPriorityQueue: boolean;
  hasAutoFixPR: boolean;
  hasBatchRemediation: boolean;
  hasEvidenceLinkedPRs: boolean;
  hasTeamWorkspaces: boolean;
  maxScheduledRescans: number;
  allowedRescanFrequencies: readonly string[];
  maxApiKeys: number;
  maxWebhooks: number;
  maxReportDeliveries: number;
  maxTeamMembers: number;
  maxStoredAudits: number;
  /** Monthly API call quota for external API (0 = no API access, -1 = unlimited) */
  maxApiRequestsPerMonth: number;
  /** Agency / VaaS extras */
  hasAgencyDashboard: boolean;
  hasBulkFix: boolean;
  hasOrgBranding: boolean;
  hasEmbedWidgets: boolean;
  hasIndustryBenchmarks: boolean;
  hasCustomDomain: boolean;
  /** -1 = unlimited */
  maxProjects: number;
}

/* ══════════════════════════════════════════════════════════════════════════
 * PRICING CONTRACT — SINGLE SOURCE OF TRUTH
 * ──────────────────────────────────────────────────────────────────────────
 * Every number that appears in UI, checkout, Stripe, PayPal, or limit
 * enforcement MUST be derived from this object. If a price or limit exists
 * anywhere else in the codebase, it is a bug.
 * ══════════════════════════════════════════════════════════════════════════ */

export const PRICING = {
  observer: {
    name: 'Observer',
    billing: { monthly: 0, yearly: 0 },
    limits: { scans: 3, competitors: 0, citations: 0 },
  },
  starter: {
    name: 'Starter',
    billing: { monthly: 15, yearly: 140, yearlyDiscount: 0.22 },
    limits: { scans: 15, competitors: 0, citations: 0 },
  },
  alignment: {
    name: 'Alignment',
    billing: { monthly: 49, yearly: 458, yearlyDiscount: 0.22 },
    limits: { scans: 60, competitors: 1, citations: 50 },
  },
  signal: {
    name: 'Signal',
    billing: { monthly: 149, yearly: 1394, yearlyDiscount: 0.22 },
    limits: { scans: 200, competitors: 10, citations: 250 },
  },
  scorefix: {
    name: 'ScoreFix AutoFix PR',
    billing: { monthly: 299, yearly: 2868, yearlyDiscount: 0.2 },
    credits: 250,
    /** Output range (code lines) varies by issue complexity — internal only */
    output: { low: 1000, medium: 700, high: 400 },
    limits: { scans: 15, competitors: 5, citations: 100 },
  },
} as const;

/** Effective monthly price when billed annually (derived from PRICING) */
export function annualMonthlyPrice(tier: 'starter' | 'alignment' | 'signal'): number {
  const p = PRICING[tier].billing;
  return Math.round((p.yearly / 12) * 100) / 100;
}

export const TIER_LIMITS: Readonly<Record<CanonicalTier, TierLimits>> = {
  observer: {
    scansPerMonth: PRICING.observer.limits.scans, pagesPerScan: 2, competitors: PRICING.observer.limits.competitors, cacheDays: 7,
    hasExports: false, hasForceRefresh: false, hasApiAccess: false, hasWhiteLabel: false,
    hasScheduledRescans: false, hasReportHistory: false, hasShareableLink: false,
    hasMentionDigests: false, hasNicheDiscovery: false, hasTripleCheck: false,
    hasAlertIntegrations: false, hasAutomationWorkflows: false, hasPriorityQueue: false,
    hasAutoFixPR: true, hasBatchRemediation: false, hasEvidenceLinkedPRs: false,
    hasTeamWorkspaces: false,
    maxScheduledRescans: 0, allowedRescanFrequencies: [] as readonly string[],
    maxApiKeys: 0, maxWebhooks: 0, maxReportDeliveries: 0, maxTeamMembers: 0, maxStoredAudits: 10,
    maxApiRequestsPerMonth: 0,
    hasAgencyDashboard: false, hasBulkFix: false, hasOrgBranding: false,
    hasEmbedWidgets: false, hasIndustryBenchmarks: false, hasCustomDomain: false, maxProjects: 0,
  },
  starter: {
    scansPerMonth: PRICING.starter.limits.scans, pagesPerScan: 8, competitors: PRICING.starter.limits.competitors, cacheDays: 14,
    hasExports: true, hasForceRefresh: true, hasApiAccess: false, hasWhiteLabel: false,
    hasScheduledRescans: false, hasReportHistory: true, hasShareableLink: true,
    hasMentionDigests: false, hasNicheDiscovery: false, hasTripleCheck: false,
    hasAlertIntegrations: false, hasAutomationWorkflows: false, hasPriorityQueue: false,
    hasAutoFixPR: true, hasBatchRemediation: false, hasEvidenceLinkedPRs: false,
    hasTeamWorkspaces: false,
    maxScheduledRescans: 0, allowedRescanFrequencies: [] as readonly string[],
    maxApiKeys: 0, maxWebhooks: 0, maxReportDeliveries: 2, maxTeamMembers: 0, maxStoredAudits: 25,
    maxApiRequestsPerMonth: 0,
    hasAgencyDashboard: false, hasBulkFix: false, hasOrgBranding: false,
    hasEmbedWidgets: false, hasIndustryBenchmarks: false, hasCustomDomain: false, maxProjects: 1,
  },
  alignment: {
    scansPerMonth: PRICING.alignment.limits.scans, pagesPerScan: 35, competitors: PRICING.alignment.limits.competitors, cacheDays: 30,
    hasExports: true, hasForceRefresh: true, hasApiAccess: false, hasWhiteLabel: false,
    hasScheduledRescans: true, hasReportHistory: true, hasShareableLink: true,
    hasMentionDigests: true, hasNicheDiscovery: true, hasTripleCheck: false,
    hasAlertIntegrations: false, hasAutomationWorkflows: false, hasPriorityQueue: false,
    hasAutoFixPR: true, hasBatchRemediation: false, hasEvidenceLinkedPRs: false,
    hasTeamWorkspaces: true,
    maxScheduledRescans: 2, allowedRescanFrequencies: ['weekly', 'monthly'] as readonly string[],
    maxApiKeys: 1, maxWebhooks: 2, maxReportDeliveries: 5, maxTeamMembers: 3, maxStoredAudits: 50,
    maxApiRequestsPerMonth: 500,
    hasAgencyDashboard: false, hasBulkFix: false, hasOrgBranding: false,
    hasEmbedWidgets: false, hasIndustryBenchmarks: false, hasCustomDomain: false, maxProjects: 3,
  },
  signal: {
    scansPerMonth: PRICING.signal.limits.scans, pagesPerScan: 100, competitors: PRICING.signal.limits.competitors, cacheDays: 90,
    hasExports: true, hasForceRefresh: true, hasApiAccess: true, hasWhiteLabel: true,
    hasScheduledRescans: true, hasReportHistory: true, hasShareableLink: true,
    hasMentionDigests: true, hasNicheDiscovery: true, hasTripleCheck: true,
    hasAlertIntegrations: true, hasAutomationWorkflows: true, hasPriorityQueue: true,
    hasAutoFixPR: true, hasBatchRemediation: true, hasEvidenceLinkedPRs: true,
    hasTeamWorkspaces: true,
    maxScheduledRescans: 20, allowedRescanFrequencies: ['daily', 'weekly', 'biweekly', 'monthly'] as readonly string[],
    maxApiKeys: 10, maxWebhooks: 20, maxReportDeliveries: 50, maxTeamMembers: 10, maxStoredAudits: 1000,
    maxApiRequestsPerMonth: 5000,
    hasAgencyDashboard: false, hasBulkFix: false, hasOrgBranding: false,
    hasEmbedWidgets: false, hasIndustryBenchmarks: true, hasCustomDomain: false, maxProjects: 25,
  },
  scorefix: {
    scansPerMonth: PRICING.scorefix.limits.scans, pagesPerScan: 220, competitors: PRICING.scorefix.limits.competitors, cacheDays: 90,
    hasExports: true, hasForceRefresh: true, hasApiAccess: true, hasWhiteLabel: false,
    hasScheduledRescans: true, hasReportHistory: true, hasShareableLink: true,
    hasMentionDigests: true, hasNicheDiscovery: true, hasTripleCheck: true,
    hasAlertIntegrations: false, hasAutomationWorkflows: true, hasPriorityQueue: true,
    hasAutoFixPR: true, hasBatchRemediation: true, hasEvidenceLinkedPRs: true,
    hasTeamWorkspaces: true,
    maxScheduledRescans: 5, allowedRescanFrequencies: ['daily', 'weekly', 'biweekly', 'monthly'] as readonly string[],
    maxApiKeys: 2, maxWebhooks: 5, maxReportDeliveries: 10, maxTeamMembers: 10, maxStoredAudits: 200,
    maxApiRequestsPerMonth: 2000,
    hasAgencyDashboard: false, hasBulkFix: false, hasOrgBranding: false,
    hasEmbedWidgets: false, hasIndustryBenchmarks: false, hasCustomDomain: false, maxProjects: 0,
  },
} as const;

/**
 * Get feature limits for a tier, with legacy tier support.
 */
export function getTierLimitsForUser(tier: CanonicalTier | LegacyTier): TierLimits {
  return TIER_LIMITS[uiTierFromCanonical(tier)];
}

/** Alias for getTierLimitsForUser */
export const getTierLimits = getTierLimitsForUser;

/**
 * Get feature limits adjusted for trial users (50% of numeric caps).
 * Boolean features remain unchanged; only numeric limits are halved.
 */
export function getTrialAdjustedLimits(tier: CanonicalTier | LegacyTier): TierLimits {
  const base = getTierLimitsForUser(tier);
  return {
    ...base,
    scansPerMonth: Math.max(1, Math.floor(base.scansPerMonth * TRIAL_LIMIT_MODIFIER)),
    pagesPerScan: Math.max(1, Math.floor(base.pagesPerScan * TRIAL_LIMIT_MODIFIER)),
    maxScheduledRescans: Math.floor(base.maxScheduledRescans * TRIAL_LIMIT_MODIFIER),
    maxApiKeys: Math.floor(base.maxApiKeys * TRIAL_LIMIT_MODIFIER),
    maxWebhooks: Math.floor(base.maxWebhooks * TRIAL_LIMIT_MODIFIER),
    maxReportDeliveries: Math.floor(base.maxReportDeliveries * TRIAL_LIMIT_MODIFIER),
    maxTeamMembers: Math.floor(base.maxTeamMembers * TRIAL_LIMIT_MODIFIER),
    maxStoredAudits: Math.floor(base.maxStoredAudits * TRIAL_LIMIT_MODIFIER),
    maxApiRequestsPerMonth: Math.floor(base.maxApiRequestsPerMonth * TRIAL_LIMIT_MODIFIER),
    maxProjects: Math.floor(base.maxProjects * TRIAL_LIMIT_MODIFIER),
  };
}

/* ── Tier pricing (derived from PRICING) ────────────────────────────────── */
export type TierBillingModel = 'free' | 'subscription' | 'one_time';

export interface TierPricing {
  monthlyUsd: number;
  yearlyUsd: number;
  oneTimeUsd: number;
  billingModel: TierBillingModel;
}

export const CANONICAL_TIER_PRICING: Readonly<Record<CanonicalTier, TierPricing>> = {
  observer: { monthlyUsd: PRICING.observer.billing.monthly, yearlyUsd: PRICING.observer.billing.yearly, oneTimeUsd: 0, billingModel: 'free' },
  starter: { monthlyUsd: PRICING.starter.billing.monthly, yearlyUsd: PRICING.starter.billing.yearly, oneTimeUsd: 0, billingModel: 'subscription' },
  alignment: { monthlyUsd: PRICING.alignment.billing.monthly, yearlyUsd: PRICING.alignment.billing.yearly, oneTimeUsd: 0, billingModel: 'subscription' },
  signal: { monthlyUsd: PRICING.signal.billing.monthly, yearlyUsd: PRICING.signal.billing.yearly, oneTimeUsd: 0, billingModel: 'subscription' },
  scorefix: { monthlyUsd: PRICING.scorefix.billing.monthly, yearlyUsd: PRICING.scorefix.billing.yearly, oneTimeUsd: 0, billingModel: 'subscription' },
};

/* ── Analysis execution class ───────────────────────────────────────────── */
export type AnalysisExecutionClass = 'LIVE' | 'DETERMINISTIC_FALLBACK' | 'SCRAPE_ONLY' | 'UPLOAD';

export function getAnalysisExecutionClass(result: AnalysisResponse): AnalysisExecutionClass {
  const r = result as unknown as Record<string, unknown>;
  const explicit =
    (r.analysis_integrity as Record<string, unknown> | undefined)?.execution_class ??
    r.execution_class;
  if (
    explicit === 'LIVE' ||
    explicit === 'DETERMINISTIC_FALLBACK' ||
    explicit === 'SCRAPE_ONLY' ||
    explicit === 'UPLOAD'
  ) return explicit as AnalysisExecutionClass;
  if (result.scrape_warning) return 'SCRAPE_ONLY';
  if ((result.url || '').startsWith('upload://')) return 'UPLOAD';
  if (result.visibility_score > 0) return 'LIVE';
  return 'DETERMINISTIC_FALLBACK';
}

/* ── Tool credit costs ──────────────────────────────────────────────────── */
export type ToolAction = 'citation_query' | 'reverse_engineer' | 'mention_scan' | 'competitor_scan' | 'mention_juice';

export interface ToolCreditRule {
  freeMonthly: Readonly<Record<CanonicalTier, number>>;
  creditCost: number;
}

export const TOOL_CREDIT_COSTS: Readonly<Record<ToolAction, ToolCreditRule>> = {
  citation_query: { freeMonthly: { observer: 0, starter: 0, alignment: 5, signal: 20, scorefix: 10 }, creditCost: 1 },
  reverse_engineer: { freeMonthly: { observer: 0, starter: 0, alignment: 3, signal: 10, scorefix: 5 }, creditCost: 2 },
  mention_scan: { freeMonthly: { observer: 0, starter: 0, alignment: 3, signal: 10, scorefix: 5 }, creditCost: 1 },
  competitor_scan: { freeMonthly: { observer: 0, starter: 0, alignment: 2, signal: 5, scorefix: 3 }, creditCost: 2 },
  mention_juice: { freeMonthly: { observer: 0, starter: 0, alignment: 3, signal: 10, scorefix: 5 }, creditCost: 1 },
};

/* ── Milestones ─────────────────────────────────────────────────────────── */
export type MilestoneKey =
  | 'first_audit'
  | 'power_scanner_25'
  | 'century_club_100'
  | 'score_improver_10'
  | 'citation_hunter_10'
  | 'competitor_watcher_3'
  | 'streak_7_days'
  | 'referral_star_3';

export interface MilestoneDefinition {
  key: MilestoneKey;
  label: string;
  description: string;
  icon: string;
  creditReward: number;
}

export const MILESTONES: readonly MilestoneDefinition[] = [
  { key: 'first_audit', label: 'First Audit', description: 'Run your first AI visibility audit', icon: '🔍', creditReward: 1 },
  { key: 'power_scanner_25', label: 'Power Scanner', description: 'Complete 25 audits', icon: '⚡', creditReward: 3 },
  { key: 'century_club_100', label: 'Century Club', description: 'Complete 100 audits', icon: '🏆', creditReward: 5 },
  { key: 'score_improver_10', label: 'Score Improver', description: 'Improve a site score by 10+ points', icon: '📈', creditReward: 2 },
  { key: 'citation_hunter_10', label: 'Citation Hunter', description: 'Run 10 citation tests', icon: '📝', creditReward: 2 },
  { key: 'competitor_watcher_3', label: 'Competitor Watcher', description: 'Track 3 competitors', icon: '🥊', creditReward: 2 },
  { key: 'streak_7_days', label: '7-Day Streak', description: 'Use the platform 7 consecutive days', icon: '🔥', creditReward: 3 },
  { key: 'referral_star_3', label: 'Referral Star', description: 'Successfully refer 3 users', icon: '⭐', creditReward: 5 },
];

/* ── Private exposure scan packaging ────────────────────────────────────── */
export interface PrivateExposureTierPackaging {
  available: boolean;
  label: string;
  maxTargetsPerScan: number;
  description: string;
}

export const PRIVATE_EXPOSURE_SCAN_PACKAGING: Readonly<Record<CanonicalTier, PrivateExposureTierPackaging>> = {
  observer: { available: false, label: 'Not available', maxTargetsPerScan: 0, description: 'Upgrade to Starter or Alignment to access Private Exposure Scans.' },
  starter: { available: false, label: 'Not available', maxTargetsPerScan: 0, description: 'Upgrade to Alignment to access Private Exposure Scans.' },
  alignment: { available: true, label: 'Standard', maxTargetsPerScan: 3, description: 'Run private exposure scans on up to 3 targets per request.' },
  signal: { available: true, label: 'Advanced', maxTargetsPerScan: 10, description: 'Full private exposure scanning with up to 10 targets per request.' },
  scorefix: { available: true, label: 'Premium', maxTargetsPerScan: 20, description: 'Unlimited private exposure scanning logic.' },
};

/* ========================= AI Platform scores ========================= */

export interface AIPlatformScores {
  chatgpt: number;
  perplexity: number;
  google_ai: number;
  claude: number;
}

export function validateAIPlatformScores(scores: AIPlatformScores): boolean {
  return Object.values(scores).every(
    (score) => typeof score === 'number' && score >= 0 && score <= 100
  );
}

/* ========================= Recommendations ========================= */

export type RecommendationPriority = 'high' | 'medium' | 'low';
export type RecommendationDifficulty = 'easy' | 'medium' | 'hard';

export interface Recommendation {
  id?: string;
  priority: RecommendationPriority;
  category: string;
  title: string;
  description: string;
  impact: string;
  difficulty: RecommendationDifficulty;
  implementation: string;
  estimatedTimeMinutes?: number;
  resources?: string[];
  /** BRAG: IDs of scraped evidence fields that justify this recommendation */
  evidence_ids?: string[];
  /** BRAG validation gate ID — only present if this recommendation passed the gate */
  brag_id?: string;
  /** Consequence framing: what happens if user ignores this (survival language) */
  consequenceStatement?: string;
  /** Estimated % visibility loss if not fixed (e.g. "18-32%") */
  estimatedVisibilityLoss?: string;
  /** Scorefix category for auto-PR routing */
  scorefix_category?: string;
}

/* ========================= Content & structural analysis ========================= */

export interface ReviewSentimentDetail {
  excerpt: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface ReviewSentimentResult {
  /** 0–100 where 50 is neutral */
  score: number;
  overall?: 'positive' | 'neutral' | 'negative';
  details: ReviewSentimentDetail[];
}

export interface ContentAnalysis {
  word_count: number;
  headings: {
    h1: number;
    h2: number;
    h3: number;
  };
  has_proper_h1: boolean;
  has_meta_description?: boolean;
  faq_count: number;
  review_sentiment?: ReviewSentimentResult;
  readability_score?: number;
  /**
   * Keyword density map populated by AI pipeline output.
   * Keys are keyword strings; values are 0–1 density ratios.
   * Validated at ingestion before storage; do not trust raw AI output without check.
   */
  keyword_density?: Record<string, number>;
}

export interface SchemaMarkup {
  json_ld_count: number;
  has_organization_schema: boolean;
  has_faq_schema: boolean;
  schema_types: string[];
  validation_errors?: string[];
  schema_score?: {
    total: number;
    validity: { score: number; max: number; details: string[] };
    typeCoverage: { score: number; max: number; details: string[] };
    propertyCompleteness: { score: number; max: number; details: string[] };
    entityGraph: { score: number; max: number; details: string[] };
    contentAlignment: { score: number; max: number; details: string[] };
    advancedVocabulary: { score: number; max: number; details: string[] };
    relationshipDepth: { score: number; max: number; details: string[] };
    bestPractices: { score: number; max: number; details: string[] };
    evidenceSummary: string[];
    declaredIds: string[];
    crossReferences: string[];
    issues: string[];
  };
}

export interface CitationStrength {
  domain: string;
  strength: 'high' | 'medium' | 'low' | 'unknown';
  notes?: string;
}

export interface DomainIntelligence {
  domain: string;
  page_title: string;
  page_description: string;
  canonical_url: string;
  language: string;
  robots: string;
  primary_topics: string[];
  citation_domains?: string[];
  citation_strength?: CitationStrength[];
  /** 0–100; higher = clearer About/brand description for AI extractability */
  entity_clarity_score?: number;
  entity_clarity_excerpt?: string;
  open_graph?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

export interface TechnicalSignals {
  response_time_ms: number;
  status_code: number;
  content_length: number;
  image_count: number;
  link_count: number;
  https_enabled: boolean;
  has_canonical?: boolean;
  has_robots_txt?: boolean;
  mobile_friendly?: boolean;
  has_viewport_meta?: boolean;
}

/* ========================= Crypto intelligence ========================= */

export interface CryptoAddressInfo {
  address: string;
  chain: 'ethereum' | 'bitcoin' | 'solana' | string;
  balance?: string;
  balanceUsd?: string;
  txCount?: number;
  isContract?: boolean;
  tokenName?: string;
  tokenSymbol?: string;
  tags?: string[];
  error?: string;
}

export interface CryptoIntelligence {
  has_crypto_signals: boolean;
  summary: string;
  detected_assets: string[];
  keywords: string[];
  wallet_addresses: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  risk_notes: string[];
  chain_networks?: string[];
  /** Live on-chain enrichment - only present when API keys are configured */
  onchain_data?: CryptoAddressInfo[];
  /** Whether live on-chain data was successfully fetched */
  onchain_enriched?: boolean;
  /** Feature is experimental - UI must show appropriate disclaimer */
  experimental?: true;
}

/* ========================= Audit grading & highlights ========================= */

export type AuditGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface CategoryGrade {
  grade: AuditGrade;
  label: string;
  /** 0–100 backing score */
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface ContentHighlight {
  area: 'heading' | 'meta' | 'schema' | 'content' | 'technical' | 'readability';
  /** Actual text from the page or a structural observation */
  found: string;
  status: 'good' | 'warning' | 'critical' | 'missing';
  /** Brief explanation of why this matters for AI visibility */
  note: string;
  /** BRAG: ID of the specific scraped evidence field this is drawn from */
  source_id?: string;
}

export interface AuditVersion {
  /** Monotonically increasing audit version for this URL */
  version: number;
  /** ISO timestamp */
  timestamp: string;
  /** Unique audit ID (request_id) */
  audit_id: string;
  /** Pipeline models used */
  models: string[];
}

/* ========================= Keyword intelligence ========================= */

export interface KeywordIntelligence {
  keyword: string;
  intent: 'informational' | 'commercial' | 'navigational' | 'transactional';
  volume_tier: 'low' | 'medium' | 'high' | 'very_high';
  competition: 'low' | 'medium' | 'high';
  /** 0–100 opportunity score */
  opportunity: number;
  trend: 'rising' | 'stable' | 'declining';
}

/* ========================= Triple-check AI pipeline ========================= */

export interface TripleCheckSummary {
  ai1_score: number;
  /** Negative value = score was reduced by peer critique */
  ai2_adjustment: number;
  ai3_validated: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/* ========================= Core analysis response ========================= */

export interface RecommendationEvidenceSummary {
  evidence_coverage_percent: number;
  evidence_ref_integrity_percent: number;
}

export interface GeoSignalProfile {
  source_verified: boolean;
  signal_consistent: boolean;
  fact_unique: boolean;
  relationship_anchored: boolean;
  information_gain: string;
}

export interface ContradictionReport {
  status: string;
  blocker_count: number;
}

export interface AnalysisResponse {
  visibility_score: number;

  /**
   * Legacy/UI aliases - retained for backwards compatibility with older
   * components. Prefer visibility_score and typed fields above in new code.
   */
  overallScore?: number;
  verdict?: string;
  categories?: unknown[];
  criticalFixes?: unknown[];
  quickWins?: unknown[];
  metadata?: Record<string, unknown>;

  ai_platform_scores: AIPlatformScores;
  recommendations: Recommendation[];

  schema_markup: SchemaMarkup;
  content_analysis: ContentAnalysis;

  summary: string;
  key_takeaways: string[];
  topical_keywords: string[];
  keyword_intelligence?: KeywordIntelligence[];
  brand_entities: string[];

  domain_intelligence: DomainIntelligence;
  technical_signals: TechnicalSignals;
  crypto_intelligence: CryptoIntelligence;

  url: string;
  analyzed_at: string;

  category_grades?: CategoryGrade[];
  content_highlights?: ContentHighlight[];
  audit_version?: AuditVersion;

  processing_time_ms?: number;
  cached?: boolean;
  cache_age_seconds?: number | null;
  analysis_version?: string;
  triple_check_summary?: TripleCheckSummary;
  /** Set when AI provider timed out and result is scrape-only (score will be 0) */
  scrape_warning?: string;
  /** Set when the page returned very little server-rendered content (JS SPA detected) */
  thin_content_warning?: string;
  request_id?: string;

  /** Evidence-driven fix plan generated by SSFR pipeline */
  evidence_fix_plan?: { issues: EvidenceDrivenFixIssue[]; mode?: string; issue_count?: number };
  /** Competitor hint from analysis */
  competitor_hint?: { match_reasons: string[] };
  /** Audit ID for linking to stored audits */
  audit_id?: string;
  /** AI recommendation evidence summary */
  recommendation_evidence_summary?: RecommendationEvidenceSummary;
  /** Execution and truth-boundary metadata for evidence-backed vs model-interpreted output */
  analysis_integrity?: {
    mode?: 'live' | 'scrape-only' | 'deterministic-fallback' | 'upload';
    execution_class?: string;
    evidence_items?: number;
    model_count?: number;
    triple_check_enabled?: boolean;
    recommendation_evidence_coverage_percent?: number;
    recommendation_evidence_integrity_percent?: number;
    reflection_applied?: boolean;
    reflection_source?: 'evidence-bounds' | 'deterministic-fallback' | 'upload-evidence';
    normalized_target_url?: string;
    fallback_mode?: string;
    warnings?: string[];
    evidence_policy?: {
      deterministic_core: boolean;
      opinion_sections_labeled: boolean;
      evidence_backed_label: 'EVIDENCE_BACKED';
      opinion_only_label: 'AI_OPINION_ONLY';
      anti_drift_mode: 'evidence-bounded' | 'deterministic-fallback' | 'upload-evidence';
    };
  };
  /** Geo-adaptive signal profile */
  geo_signal_profile?: GeoSignalProfile;
  /** Contradiction report from multi-model analysis */
  contradiction_report?: ContradictionReport;
  /** Threat intelligence from security scan */
  threat_intel?: { risk_level?: string;[key: string]: unknown };
  /** SEO diagnostics computed from scrape data */
  seo_diagnostics?: SeoDiagnostics;
  /** Strict rubric scoring system with gates and fixpacks */
  strict_rubric?: StrictRubricSystem;
  /** BRAG: scrape method pipeline info and badge */
  scrape_info?: BragScrapeInfo;
  /** BRAG validation gate result — cite ledger + validated findings */
  brag_validation?: BragValidationResult;
  /** Pipeline execution state — ordered stages and score derivation source */
  pipeline_state?: PipelineState;
  /** User-supplied findability goal strings */
  findability_goals?: string[];
  /** Goal alignment result comparing content against findability goals */
  goal_alignment?: {
    coverage: number;
    matched_goals: string[];
    missing_goals: string[];
    score_adjustment: number;
  };
  /**
   * Answer presence pipeline result — evidence that the entity appears (or is
   * absent) in AI-generated answers and search results.
   * Steps 1-7 from the extraction → query → test → ledger → gap spec.
   */
  answer_presence?: AnswerPresenceResult;
}

export function isValidAnalysisResponse(obj: unknown): obj is AnalysisResponse {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as unknown as Record<string, unknown>;
  return (
    typeof r.visibility_score === 'number' &&
    typeof r.url === 'string' &&
    typeof r.analyzed_at === 'string' &&
    Array.isArray(r.recommendations) &&
    !!r.ai_platform_scores &&
    typeof r.ai_platform_scores === 'object'
  );
}

export interface AnalysisSummary {
  id: string;
  url: string;
  visibility_score: number;
  analyzed_at: string;
  cached: boolean;
  user_id?: string;
}

/* ========================= User / auth types ========================= */

export interface AuthUser {
  id: string;
  email: string;
  tier: CanonicalTier;
}

export interface UserProfile extends AuthUser {
  full_name?: string;
  created_at?: string;
  updated_at?: string;
  avatar_url?: string;
  company?: string;
  website?: string;
}

export interface UserProfileUi extends UserProfile {
  subscription_tier: UiTier;
  tier_limits: TierLimits;
  display_name: string;
}

export function toUserProfileUi(user: UserProfile): UserProfileUi {
  const emailPrefix = user.email.includes('@') ? user.email.split('@')[0] : user.email;
  return {
    ...user,
    subscription_tier: uiTierFromCanonical(user.tier),
    tier_limits: getTierLimitsForUser(user.tier),
    display_name: user.full_name?.trim() || emailPrefix,
  };
}

/**
 * Type guard for AuthUser.
 * Accepts canonical and legacy tier strings only.
 * Rejects 'enterprise', 'pro', and any other unmapped strings explicitly
 * rather than silently falling through to 'observer'.
 */
export function isAuthUser(obj: unknown): obj is AuthUser {
  if (!obj || typeof obj !== 'object') return false;
  const u = obj as Record<string, unknown>;
  return (
    typeof u.id === 'string' &&
    typeof u.email === 'string' &&
    typeof u.tier === 'string' &&
    VALID_TIER_STRINGS.has(u.tier)
  );
}

/* ========================= Subscription / billing ========================= */

export interface Subscription {
  id: string;
  user_id: string;
  tier: CanonicalTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id?: string;
  crypto_payment_address?: string;
}

/* ========================= Usage tracking ========================= */

export interface UsageStats {
  user_id: string;
  period_start: string;
  period_end: string;
  analyses_count: number;
  api_calls_count: number;
  storage_mb: number;
}

/**
 * Returns true when the user has consumed all scans for the current period.
 * Uses >= so the limit blocks on the NEXT attempt after reaching the ceiling.
 * If scansPerMonth is -1 (unlimited), always returns false.
 */
export function hasExceededLimits(usage: UsageStats, tier: CanonicalTier): boolean {
  const limits = TIER_LIMITS[tier];
  if (limits.scansPerMonth === -1) return false;
  return usage.analyses_count >= limits.scansPerMonth;
}

/* ========================= API response envelope ========================= */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: string;
  statusCode?: number;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false;
}

/* ========================= Pagination ========================= */

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/* ========================= Web search types ========================= */

export interface WebSearchResultEntry {
  title: string;
  url: string;
  description: string;
  position: number;
}

export interface WebSearchPresenceResult {
  found: boolean;
  position: number;
  results_checked: number;
  matching_results: WebSearchResultEntry[];
  competitor_urls_found: string[];
  top_results: WebSearchResultEntry[];
  source: 'ddg_web' | 'bing_web' | 'ddg_instant' | 'brave_web' | 'wikipedia_web' | 'yahoo_web';
}

/* ========================= Competitor intelligence ========================= */

export interface CompetitorTracking {
  id: string;
  user_id: string;
  competitor_url: string;
  nickname: string;
  latest_audit_id?: string;
  latest_score?: number;
  created_at: string;
  updated_at: string;
}

export interface CompetitorComparison {
  your_url: string;
  your_score: number;
  your_analysis: AnalysisResponse;
  competitors: Array<{
    url: string;
    nickname: string;
    score: number;
    analysis: AnalysisResponse;
    /**
     * Score delta: your_score - competitor_score.
     * Negative = competitor is ahead. Positive = you are ahead.
     */
    gap: number;
  }>;
  category_comparison: Array<{
    category: string;
    your_score: number;
    /** Map of competitor nickname → score */
    competitor_scores: Record<string, number>;
  }>;
  opportunities: Array<{
    title: string;
    description: string;
    impact: string;
    /** Which competitors are doing this */
    competitor_doing_it: string[];
  }>;
  your_advantages: Array<{
    title: string;
    description: string;
    /** e.g. "+12 points ahead" */
    lead_amount: string;
  }>;
}

/* ========================= AI Citation tracking ========================= */

export interface AICitationResult {
  id: string;
  query: string;
  platform: 'chatgpt' | 'perplexity' | 'claude' | 'google_ai';
  mentioned: boolean;
  /** 1–10, or 0 if not mentioned */
  position: number;
  /** What the AI actually said */
  excerpt: string;
  screenshot_url?: string;
  competitors_mentioned: string[];
  citation_urls?: string[];
  created_at: string;
  model_used?: string;
  model_short?: string;
  model_role?: 'primary' | 'fallback';
  source_type?: 'direct' | 'simulated';
}

export interface CitationTest {
  id: string;
  user_id: string;
  url: string;
  queries: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: AICitationResult[];
  summary?: {
    total_queries: number;
    /** Percentage 0–100 */
    mention_rate: number;
    avg_position: number;
    /** Map of platform → mention count */
    platforms: Record<string, number>;
  };
  created_at: string;
  completed_at?: string;
}

export interface QueryGenerationRequest {
  url: string;
  industry?: string;
  topic_keywords?: string[];
  /** How many queries to generate */
  count?: number;
}

/* ========================= Answer decomposition ========================= */

export type AnswerSourceType =
  | 'authoritative_reference'
  | 'how_to_guide'
  | 'faq_block'
  | 'definition'
  | 'comparison'
  | 'list_aggregation'
  | 'news_synthesis'
  | 'academic_citation';

/* ========================= Engine tier gating ========================= */

export interface EngineAccess {
  hasComparison: boolean;
  hasRepair: boolean;
}

/**
 * Determines which intelligence engines a given tier can access.
 * - Comparison: available for alignment+ tiers
 * - Repair: available for scorefix tier only
 */
export function getEnginesForTier(tier: CanonicalTier | 'scorefix'): EngineAccess {
  return {
    hasComparison: tier === 'alignment' || tier === 'signal' || tier === 'scorefix',
    hasRepair: tier === 'scorefix',
  };
}

/* ========================= Engine output types ========================= */

export interface EngineOutputBase {
  status: 'ok' | 'success' | 'failed';
  timeMs: number;
  errors?: string[];
}

export interface CitationReadinessOutput extends EngineOutputBase {
  data: {
    citation_readiness_score: number;
    quotability_index: number;
    citable_sections: CitableSection[];
    blockers_to_citation: string[];
    recommendations: string[];
  };
}

export interface TrustLayerOutput extends EngineOutputBase {
  data: {
    trust_score: number;
    signal_status: {
      https_enabled: boolean;
      domain_age_years: number;
      tls_certificate_trusted: boolean;
      contact_info_present: boolean;
      privacy_policy_accessible: boolean;
      [key: string]: unknown;
    };
    risk_flags?: string[];
    recommendations?: string[];
    [key: string]: unknown;
  };
}

export interface EntityGraphOutput extends EngineOutputBase {
  data: {
    entity_clarity_score: number;
    primary_entity?: {
      canonical_name: string;
      aliases: string[];
      confidence: number;
      primary_location: string;
    };
    entity_mentions?: {
      count: number;
      consistency_ratio: number;
      variance_issues: string[];
    };
    organization_clarity?: {
      has_leadership: boolean;
      leadership_consistent: boolean;
      department_clarity: string;
    };
    entities?: unknown[];
    recommendations?: string[];
    [key: string]: unknown;
  };
}

export interface IntelligenceAnalysisResponse {
  url: string;
  analyzed_at: string;
  tier: CanonicalTier | 'scorefix';
  processing_time_ms: number;
  is_cached: boolean;
  overall_ai_visibility_score: number;
  citation_readiness_score: number;
  trust_score: number;
  entity_clarity_score: number;
  citation_readiness: CitationReadinessOutput | null;
  trust_layer: TrustLayerOutput | null;
  entity_graph: EntityGraphOutput | null;
  [key: string]: unknown;
}

export type AnswerStructuralPattern =
  | 'numbered_list'
  | 'bullet_hierarchy'
  | 'qa_pair'
  | 'step_sequence'
  | 'comparison_table'
  | 'definition_block'
  | 'citation_cluster';

export type AnswerPositionBias = 'opening' | 'middle' | 'closing' | 'distributed';

export interface AnswerDecompositionSourceType {
  type: AnswerSourceType;
  confidence: number;
  indicators: string[];
  examplePatterns: string[];
}

export interface AnswerDecompositionStructuralPattern {
  pattern: AnswerStructuralPattern;
  frequency: number;
  positionBias: AnswerPositionBias;
  weight: number;
}

export interface AnswerDecompositionSemanticCluster {
  topic: string;
  entities: string[];
  relationships: string[];
  density: number;
  answerContribution: number;
}

export interface AnswerDecompositionCitationVector {
  contentType: string;
  probability: number;
  requiredSignals: string[];
  missingFromYourContent: string[];
}

export interface AnswerDecompositionShape {
  skeleton: string;
  entityDensity: number;
  factDensity: number;
  listRatio: number;
  averageSentenceComplexity: number;
  trustSignalPlacement: string[];
}

export interface AnswerDecomposition {
  sourceTypes: AnswerDecompositionSourceType[];
  structuralPatterns: AnswerDecompositionStructuralPattern[];
  semanticClusters: AnswerDecompositionSemanticCluster[];
  citationVectors: AnswerDecompositionCitationVector[];
  answerShape: AnswerDecompositionShape;
  reconstructionBlueprint: string;
}

/** TODO: Define concrete shape when CompetitorGhost feature is spec'd */
export interface CompetitorGhost {
  [key: string]: unknown;
}

/** TODO: Define concrete shape when ModelPreferenceDiff feature is spec'd */
export interface ModelPreferenceDiff {
  [key: string]: unknown;
}

/** TODO: Define concrete shape when VisibilitySimulation feature is spec'd */
export interface VisibilitySimulation {
  [key: string]: unknown;
}

/** TODO: Define concrete shape when ModelAnalysis feature is spec'd */
export interface ModelAnalysis {
  [key: string]: unknown;
}

/* ── BRAG constants ─────────────────────────────────────────────────────── */
export const BRAG_ACRONYM = 'BRAG';
export const BRAG_EXPANSION = 'Based-Retrieval-Auditable-Grading';
export const BRAG_TRAIL_LABEL = 'BRAG Trail';

/* ── BRAG Validation Gate types ─────────────────────────────────────────── */

/** Source that produced the BRAG finding */
export type BragFindingSource = 'rule' | 'ai' | 'python';

/** A single validated BRAG finding — the atomic unit of truth. */
export interface BragFinding {
  /** Deterministic BRAG ID: BRAG-{source}-{sha256_12} */
  brag_id: string;
  /** Which system produced this finding */
  source: BragFindingSource;
  /** Rule ID if source=rule (e.g. "C02", "M01") */
  rule_id?: string;
  /** Human-readable title */
  title: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Whether this is a hard blocker that caps the score */
  is_hard_blocker: boolean;
  /** Evidence key(s) this finding is grounded in */
  evidence_keys: string[];
  /** Evidence status values */
  evidence_statuses: string[];
  /** Truncated evidence value for audit trail */
  evidence_value?: string;
  /** Validation confidence 0.0-1.0 */
  confidence: number;
  /** Scoring family for grouping */
  family?: string;
  /** Remediation guidance */
  remediation?: string;
}

/** One link in the CITE LEDGER hash chain */
export interface CiteLedgerEntry {
  /** Position in the chain */
  sequence: number;
  /** BRAG ID of the finding this entry covers */
  brag_id: string;
  /** SHA-256 hash of the finding content */
  content_hash: string;
  /** Previous entry's chain hash (genesis = 64 zeroes) */
  previous_hash: string;
  /** SHA-256(previous_hash + content_hash) */
  chain_hash: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/* ── Pipeline State ─────────────────────────────────────────────────────────── */

/** Sequential pipeline stages — each must complete before the next starts */
export type PipelineStageName =
  | 'scrape'          // Fetch + render page
  | 'evidence'        // Extract evidence ledger items
  | 'rules'           // Run 30-rule deterministic engine
  | 'ai_analysis'     // AI model(s) produce category grades + recommendations
  | 'brag_gate'       // BRAG validation gate — score derivation + cite ledger
  | 'finalize';       // Assemble response

export interface PipelineStageRecord {
  stage: PipelineStageName;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  /** Human-readable note on failure or skip reason */
  note?: string;
  /** Count of items produced (evidence items, findings, etc.) */
  item_count?: number;
}

/** Full pipeline state included in every analysis response */
export interface PipelineState {
  /** Ordered stages in execution sequence */
  stages: PipelineStageRecord[];
  /** Whether the pipeline completed all stages */
  completed: boolean;
  /** If score was derived purely from evidence (true) or fell back to AI (false) */
  score_source: 'evidence' | 'ai_fallback' | 'deterministic' | 'hard_guard_zero';
  /** Total pipeline wall-clock time in ms */
  total_ms: number;
}

/** Full result returned by the BRAG validation gate */
export interface BragValidationResult {
  /** Audit run this validation belongs to */
  audit_id: string;
  /** Target URL */
  url: string;
  /** When the gate ran */
  validated_at: string;
  /** Validated findings — only these surface to the user */
  findings: BragFinding[];
  /** Claims that failed validation — suppressed from user view */
  rejected_count: number;
  /** Cryptographic hash chain for tamper detection */
  cite_ledger: CiteLedgerEntry[];
  /** Score derived purely from validated findings: 100 − Σ deductions */
  derived_score: number;
  /** Number of validated findings */
  finding_count: number;
  /** Root hash of the cite ledger chain */
  root_hash: string;
  /** Gate implementation version */
  gate_version: string;
}

/* ── BRAG Scrape Method Pipeline ────────────────────────────────────────── */

/** Scrape method used to collect evidence for the audit */
export type ScrapeMethod = 'http_fetch' | 'python_nlp' | 'cf_browser_run';

// ── Answer Presence Pipeline ─────────────────────────────────────────────────

/** One citation / mention entry in the live evidence ledger */
export interface QueryEvidence {
  /** The query that was tested */
  query: string;
  /** Why this query was generated */
  intent: 'direct' | 'intent' | 'comparative' | 'longtail';
  /** Search engine or AI model that returned this result */
  source: string;
  /** Whether the brand/entity appeared in results */
  mentioned: boolean;
  /** Position in result list (1-indexed), if applicable */
  position?: number;
  /** Snippet text where brand was detected */
  snippet?: string;
  /** 0.0–1.0 confidence in this citation observation */
  citation_strength: number;
}

/** A detected absence in AI/search visibility */
export interface GapItem {
  /** Category of the gap */
  type: 'content' | 'citation' | 'authority' | 'entity_clarity';
  /** Human-readable description of the gap */
  description: string;
  /** Query that revealed the gap */
  query?: string;
  /** Domains that DO appear for this query (competitors) */
  dominant_sources?: string[];
  /** What to do about this gap */
  action: string;
}

/**
 * Full result of the answer presence pipeline (Steps 1-7 from spec).
 * All scores derived ONLY from observed QueryEvidence — no synthetic metrics.
 */
export interface AnswerPresenceResult {
  /** Canonical primary entity name extracted from the page */
  primary_entity: string;
  /** Known aliases / variant spellings detected */
  aliases: string[];
  /** Total queries tested in parallel */
  queries_tested: number;
  /** Number of queries where entity was mentioned */
  mentions_found: number;
  /** Full citation ledger — every query result, positive or negative */
  evidence: QueryEvidence[];
  /** Gaps where entity should appear but does not */
  gaps: GapItem[];
  /** 0-100: how clearly the entity is defined in search/AI systems */
  entity_clarity_score: number;
  /** 0-100: fraction of tested queries where entity has a citation */
  citation_coverage_score: number;
  /** 0-100: presence in authoritative (high-rank) sources */
  authority_alignment_score: number;
  /** 0-100: composite presence score derived from evidence */
  answer_presence_score: number;
}

export const SCRAPE_METHOD_LABELS: Readonly<Record<ScrapeMethod, string>> = {
  http_fetch: 'HTTP Fetch',
  python_nlp: 'Python NLP',
  cf_browser_run: 'CF Browser Run',
};

export const SCRAPE_METHOD_BADGE_COLORS: Readonly<Record<ScrapeMethod, { bg: string; text: string; border: string }>> = {
  http_fetch: { bg: '#064e3b', text: '#6ee7b7', border: '#10b981' },
  python_nlp: { bg: '#1e1b4b', text: '#a5b4fc', border: '#6366f1' },
  cf_browser_run: { bg: '#7c2d12', text: '#fdba74', border: '#f97316' },
};

/** Pipeline execution order for scrape methods */
export const SCRAPE_PIPELINE_ORDER: readonly ScrapeMethod[] = [
  'http_fetch',
  'python_nlp',
  'cf_browser_run',
] as const;

/** BRAG scrape info attached to every analysis response */
export interface BragScrapeInfo {
  /** Which scrape method produced the final evidence */
  method: ScrapeMethod;
  /** Unique BRAG ID for this scrape run (uuid) */
  brag_id: string;
  /** Methods attempted in order, with outcome */
  pipeline: BragPipelineStep[];
  /** Total scrape pipeline time in ms */
  total_ms: number;
}

export interface BragPipelineStep {
  method: ScrapeMethod;
  attempted: boolean;
  success: boolean;
  duration_ms: number;
  /** Word count from this method (0 if failed/skipped) */
  word_count: number;
  /** Reason for failure or skip */
  note?: string;
}

/** Free trial modifier: trial users get 50% of their tier's numeric limits */
export const TRIAL_LIMIT_MODIFIER = 0.5;

/* ── Text summary depth helper ──────────────────────────────────────────── */
export type TextSummaryDepth = 'minimal' | 'brief' | 'standard' | 'detailed';

export function getTextSummaryDepth(tier: CanonicalTier): TextSummaryDepth {
  switch (tier) {
    case 'signal': return 'detailed';
    case 'scorefix': return 'detailed';
    case 'alignment': return 'standard';
    case 'starter': return 'standard';
    default: return 'brief';
  }
}

/* ── Support ticket types ───────────────────────────────────────────────── */
export type SupportTicketCategory =
  | 'billing' | 'technical' | 'account' | 'audit_results'
  | 'api_integration' | 'feature_request' | 'bug_report' | 'general';

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type SupportTicketStatus =
  | 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  created_at: string;
  updated_at: string;
}

export const SUPPORT_TICKET_CATEGORIES: ReadonlyArray<{ value: SupportTicketCategory; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'account', label: 'Account' },
  { value: 'audit_results', label: 'Audit Results' },
  { value: 'api_integration', label: 'API Integration' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' },
];

/* ── SSFR types ─────────────────────────────────────────────────────────── */

export type SSFRFamily = 'source' | 'signal' | 'fact' | 'relationship';

export type SSFREvidenceStatus = 'present' | 'missing' | 'partial' | 'invalid';

export type SSFRRuleSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SSFREvidenceItem {
  family: SSFRFamily;
  evidence_key: string;
  value: unknown;
  source: string;
  status: SSFREvidenceStatus;
  confidence: number;
  notes?: unknown;
}

export interface SSFRRuleResult {
  family: SSFRFamily;
  rule_id: string;
  title: string;
  passed: boolean;
  severity: SSFRRuleSeverity;
  is_hard_blocker: boolean;
  score_cap?: number;
  evidence_ids: string[];
  details?: Record<string, unknown>;
}

export type SSFRFixpackType = 'schema_fix' | 'entity_patch' | 'meta_fix' | 'content_block' | 'insight';

export interface SSFRFixpackAsset {
  type: 'json_ld' | 'markdown' | 'meta_tag' | 'text' | 'html_block';
  label: string;
  content: string;
}

export type SSFRVerificationStatus = 'verified' | 'failed' | 'pending';

export interface SSFRFixpack {
  type: SSFRFixpackType;
  title: string;
  summary: string;
  priority: number;
  assets: SSFRFixpackAsset[];
  auto_generatable: boolean;
  verification_status: SSFRVerificationStatus;
  based_on_rule_ids: string[];
}

/* ── Citation types ─────────────────────────────────────────────────────── */

export interface CitationMentionTrend {
  id: string;
  user_id: string;
  url: string;
  test_id: string | null;
  mention_rate: number;
  total_queries: number;
  mentioned_count: number;
  platform_breakdown: Record<string, number>;
  sampled_at: string;
}

export interface CitationDropAlert {
  id: string;
  user_id: string;
  url: string;
  previous_mention_rate: number;
  current_mention_rate: number;
  drop_magnitude: number;
  alert_type: string;
  created_at: string;
}

export interface CitationCoOccurrence {
  id: string;
  user_id: string;
  url: string;
  brand_name: string;
  query_used: string;
  source_url: string;
  source_title: string;
  mention_context: string;
  has_link: boolean;
  found_at: string;
}

export interface CitationCompetitorShareEntry {
  competitor_name: string;
  mention_count: number;
  total_queries: number;
  share_pct: number;
  platforms_present: string[];
}

export interface ConsistencyMatrixCell {
  query: string;
  platform: string;
  mentioned: boolean;
  position: number;
  excerpt: string;
}

export interface CitationIdentityResponse {
  normalized_url: string;
  business_name: string;
  business_name_source: 'audit_evidence' | 'schema_org' | 'og_site_name' | 'page_title' | 'domain';
  page_title?: string;
  evidence_updated_at?: string;
  evidence_url: string;
  recent_audit_found: boolean;
}

export interface CitableSection {
  page: string;
  section_heading: string;
  confidence: number;
  extractable_text: string;
  word_count: number;
  risk_factors: string[];
}

/**
 * Preset schedules for citation monitoring.
 *   - `2x_month`  — twice monthly, ~15 days apart  (360 interval_hours)
 *   - `4x_month`  — four times monthly, ~7.5 days apart (180 interval_hours)
 *   - `weekly`    — once a week (168 interval_hours)
 *   - `daily`     — once a day  (24 interval_hours, Signal tier only)
 *   - `custom`    — user-defined interval_hours
 */
export type CitationSchedulePreset = '2x_month' | '4x_month' | 'weekly' | 'daily' | 'custom';

/** Maps a preset to the equivalent interval_hours value */
export const CITATION_PRESET_HOURS: Readonly<Record<CitationSchedulePreset, number>> = {
  '2x_month': 360,  // 15 days
  '4x_month': 180,  // 7.5 days
  weekly: 168,      // 7 days
  daily: 24,        // 1 day
  custom: 0,        // caller provides interval_hours directly
} as const;

export interface ScheduledCitationJob {
  id: string;
  user_id: string;
  target_url: string;
  niche?: string;
  niche_keywords: string[];
  interval_hours: number;
  /** Convenience preset — if set, interval_hours is derived from CITATION_PRESET_HOURS */
  preset?: CitationSchedulePreset;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_ranking_id?: string;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export type CitationDimensionKey =
  | 'entity_clarity'
  | 'answer_density'
  | 'structured_data'
  | 'trust_architecture'
  | 'content_query_alignment'
  | 'topical_authority_depth'
  | 'noise_to_signal'
  | 'technical_crawl_integrity'
  | 'citation_surface_area'
  | 'offpage_visibility_footprint';

export interface CitationDimensionScore {
  key: CitationDimensionKey;
  label: string;
  score_0_10: number;
  weighted_points: number;
  evidence_count: number;
  rationale: string;
}

export interface CitationEvidenceArtifact {
  dimension: CitationDimensionKey;
  score_0_10: number;
  finding: string;
  evidence_type: 'metadata' | 'dom' | 'schema' | 'link' | 'http' | 'search' | 'other';
  evidence_id: string;
  source_url: string;
  selector_or_locator: string;
  observed_value: string;
  capture_time_utc: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ModelParityCheck {
  required_dimensions: CitationDimensionKey[];
  covered_dimensions: CitationDimensionKey[];
  missing_dimensions: CitationDimensionKey[];
  required_outputs: string[];
  outputs_present: string[];
  outputs_missing: string[];
  pass: boolean;
}

export interface CitationParityAudit {
  rubric_version: string;
  parity_complete: boolean;
  ai_visibility_score_0_100: number;
  verdict: 'Safe to cite as factual' | 'OK as opinion' | 'Avoid for serious factual claims';
  strongest_reliability_indicators: string[];
  biggest_concerns_or_limitations: string[];
  visibility_note: {
    level: 'high' | 'medium' | 'low';
    reasons: string[];
  };
  dimensions: CitationDimensionScore[];
  top_friction_points: string[];
  priority_fixes: string[];
  model_parity: Record<string, ModelParityCheck>;
  evidence: CitationEvidenceArtifact[];
}

/* ── Authority types ────────────────────────────────────────────────────── */

export type AuthorityPlatform =
  | 'reddit' | 'linkedin' | 'substack' | 'medium' | 'github'
  | 'stackoverflow' | 'wikipedia' | 'youtube' | 'g2' | 'trustpilot'
  | 'crunchbase' | 'producthunt' | 'techcrunch' | 'blogger'
  | 'facebook' | 'devpost' | 'hackernews' | 'chrome_web_store'
  | 'twitter' | 'devto' | 'bluesky';

export type ContentNature = 'spammy' | 'direct_promo' | 'organic_pain_solution' | 'neutral';

export interface AuthorityCitationItem {
  platform: AuthorityPlatform;
  rank: number;
  title: string;
  snippet: string;
  source_url: string;
  backlink_found: boolean;
  authority_score: number;
  content_nature: ContentNature;
  confidence: number;
}

export interface AuthorityCheckResponse {
  target: string;
  mode: string;
  official_domain?: string;
  checked_at: string;
  platforms: Array<{
    platform: AuthorityPlatform;
    authority_score: number;
    citation_count: number;
    backlink_count: number;
    content_breakdown: Record<ContentNature, number>;
    items: AuthorityCitationItem[];
  }>;
  overall: {
    authority_index: number;
    total_citations: number;
    total_backlinks: number;
    spammy_count: number;
    direct_promo_count: number;
    organic_pain_solution_count: number;
  };
  audit: {
    policy: string;
    citation_density: number;
    refusal: boolean;
    refusal_reason?: string;
    notes: string[];
  };
  security: {
    https: boolean;
    hardening_score: number;
    missing_header_count: number;
  };
  phishing_risk: {
    level: 'low' | 'medium' | 'high';
    reasons: string[];
  };
  compliance: {
    detected_niche: string;
    required_signals: string[];
    present_signals: string[];
    missing_signals: string[];
  };
  entity?: {
    fingerprint_active: boolean;
    anchor_score: number;
    false_positives_blocked: number;
    brand_name?: string;
    canonical_domain?: string;
  };
}

/* ── Entity fingerprint types ────────────────────────────────────────────── */

export interface EntityFingerprint {
  id: string;
  user_id: string;
  brand_name: string;
  canonical_domain: string;
  founder_name: string;
  social_handles: Record<string, string>;
  wikidata_id: string;
  google_kg_id: string;
  schema_org_id: string;
  product_category: string;
  description_keywords: string[];
  updated_at: string;
  created_at: string;
}

export type BlocklistEntryType = 'name' | 'domain' | 'keyword' | 'entity_type';

export interface BlocklistEntry {
  id: string;
  user_id: string;
  pattern: string;
  type: BlocklistEntryType;
  reason: string;
  auto_detected: boolean;
  created_at: string;
}

export interface CollisionCluster {
  entity_type: 'person' | 'company' | 'project' | 'product' | 'unknown';
  name: string;
  description: string;
  source_urls: string[];
  suggested_blocks: Array<{ pattern: string; type: BlocklistEntryType; reason: string }>;
}

export interface CollisionDetectionResult {
  brand_name: string;
  collisions: CollisionCluster[];
  anchor_score: number;
  suggested_blocklist: Array<{ pattern: string; type: BlocklistEntryType; reason: string }>;
}

export interface AuditRunRecord {
  id: string;
  user_id: string;
  triggered_by: string;
  queries_run: number;
  citations_found: number;
  false_positives_blocked: number;
  anchor_score: number;
  duration_ms: number;
  created_at: string;
}

/* ── Niche ranking types ────────────────────────────────────────────────── */

export type ModelRole = 'primary' | 'fallback';

export type ModelShortName = string;

export interface NicheRankingEntry {
  rank: number;
  brand_name: string;
  is_target: boolean;
  citation_excerpt?: string;
}

export interface NicheRankingResult {
  id: string;
  target_url: string;
  brand_name: string;
  niche: string;
  niche_keywords: string[];
  target_rank: number | null;
  in_top_50: boolean;
  in_top_100: boolean;
  top_50: NicheRankingEntry[];
  top_100: NicheRankingEntry[];
  ranking_model_id: string;
  ranking_model_short: ModelShortName;
  ranking_model_role: ModelRole;
  citation_models_used: Array<{
    platform: string;
    model_id: string;
    model_short: ModelShortName;
    role: ModelRole;
    mentioned: boolean;
    position: number | null;
  }>;
  ran_at: string;
  scheduled_job_id?: string;
}

/* ── Geo / Rubric / Truth types ─────────────────────────────────────────── */

export interface GeoSignalProfile {
  source_verified: boolean;
  signal_consistent: boolean;
  fact_unique: boolean;
  relationship_anchored: boolean;
  information_gain: string;
}

export interface ContradictionReport {
  status: string;
  blocker_count: number;
  issue_count: number;
  issues: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    dimension: 'source' | 'signal' | 'fact' | 'relationship';
    title: string;
    detail: string;
    blocking: boolean;
    evidence_keys: string[];
  }>;
}

export interface AuditTruthHistoryEntry {
  audit_id: string;
  url: string;
  created_at: string;
  visibility_score: number;
  execution_class: string | null;
  geo_signal_profile: GeoSignalProfile | null;
  contradiction_report: ContradictionReport | null;
}

export interface StrictRubricSystem {
  version: string;
  score_0_100: number;
  reliability_index_0_100: number;
  gates: Array<{
    id: string;
    label: string;
    weight: number;
    status: 'pass' | 'warn' | 'fail';
    score_0_100: number;
    threshold_pass: number;
    actual_value: number;
    evidence_ids: string[];
  }>;
  required_fixpacks: Array<{
    id: string;
    label: string;
    target_gate_ids: string[];
    estimated_score_lift_min: number;
    estimated_score_lift_max: number;
    actions: string[];
    validation_steps: string[];
  }>;
  pass_rate: number;
  cross_platform_ready: boolean;
  guarantee_policy: {
    mode: string;
    baseline_preconditions: string[];
    expected_delta_band: { min: number; max: number };
  };
}

/* ── Text summary types ─────────────────────────────────────────────────── */

export interface TextSummaryFinding {
  title: string;
  explanation: string;
  fix: string;
}

export interface TextSummary {
  depth: TextSummaryDepth;
  intro: string;
  findings: TextSummaryFinding[];
  priority_order: string[];
  closing: string;
}

/* ── SEO diagnostics ────────────────────────────────────────────────────── */

export interface SeoDiagnosticEntry {
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface SeoDiagnostics {
  title: SeoDiagnosticEntry;
  meta_description: SeoDiagnosticEntry;
  h1: SeoDiagnosticEntry;
  schema: SeoDiagnosticEntry;
  canonical: SeoDiagnosticEntry;
  https: SeoDiagnosticEntry;
  robots: SeoDiagnosticEntry;
  indexability: SeoDiagnosticEntry;
  internal_link_health: SeoDiagnosticEntry;
  content_uniqueness: SeoDiagnosticEntry;
  performance_hint: SeoDiagnosticEntry;
  image_alt_coverage: SeoDiagnosticEntry;
  semantic_landmarks: SeoDiagnosticEntry;
  form_accessibility: SeoDiagnosticEntry;
  [key: string]: SeoDiagnosticEntry;
}

/* ── Private exposure types ─────────────────────────────────────────────── */

export type PrivateExposureTargetType = 'site' | string;

export type PrivateExposureFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type PrivateExposureFindingConfidence = 'high' | 'medium' | 'low';

export type PrivateExposureFindingDomain =
  | 'client_secret_leakage'
  | 'route_protection_integrity'
  | 'session_hardening'
  | 'header_hardening'
  | 'public_data_spill_risk';

export type PrivateExposureFindingStatus = 'confirmed' | 'possible';

export type PrivateExposureScoreBand =
  | 'hardened_surface'
  | 'mostly_sound_notable_trust_gaps'
  | 'meaningful_exposure_risk'
  | 'high_risk_public_surface'
  | 'critical_exposure_posture';

export type PrivateExposureVerdict = 'confirmed_exposure' | 'possible_exposure' | 'no_clear_exposure';

export interface PrivateExposureFinding {
  evidence_id: string;
  title: string;
  domain: PrivateExposureFindingDomain;
  severity: PrivateExposureFindingSeverity;
  confidence: PrivateExposureFindingConfidence;
  status: PrivateExposureFindingStatus;
  where_found: {
    asset_type: 'response_header' | 'cookie' | 'javascript_bundle' | 'source_map' | 'api_endpoint';
    location: string;
    line_hint: number | null;
  };
  what_was_observed: string;
  why_it_matters: string;
  minimal_redacted_proof: string;
  fix_path: string[];
  retest_steps: string[];
  affected_assets: string[];
  tags: string[];
}

export interface PrivateExposureScanReport {
  scan_type: 'private_exposure_scan';
  scan_version: string;
  scope: {
    target_type: PrivateExposureTargetType;
    target_label: string;
    ownership_asserted: boolean;
    scan_mode: 'passive';
    authenticated_context_provided: boolean;
  };
  summary: {
    exposure_surface_score: number;
    score_band: PrivateExposureScoreBand;
    verdict: PrivateExposureVerdict;
    top_priorities: string[];
  };
  domain_scores: Record<PrivateExposureFindingDomain, {
    score: number;
    weight: number;
    status: 'hardened' | 'not_observed' | 'high_risk_exposure' | 'at_risk' | 'needs_attention';
  }>;
  findings: PrivateExposureFinding[];
  quick_wins_under_30m: string[];
  needs_engineering_changes: string[];
  retest_plan: {
    recommended: boolean;
    retest_scope: string[];
  };
  history: {
    prior_scan_id: string | null;
    regressions: unknown[];
    resolved_evidence_ids: string[];

  };
}

/* ── Evidence-driven fix types ──────────────────────────────────────────── */

export interface EvidenceDrivenFixIssue {
  id: string;
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence_ids: string[];
  actual_fix: string;
  evidence_excerpt?: string;
  evidence_type: 'metadata' | 'dom' | 'schema' | 'link' | 'http' | 'search' | 'other';

}

/* ── Self-Healing Pipeline types ──────────────────────────────────────── */

/** The 11 canonical fix classes that the pipeline maps every finding to. */
export type FixClass =
  | 'CONTENT_REWRITE'
  | 'META_REWRITE'
  | 'HEADING_RESTRUCTURE'
  | 'SCHEMA_INSERT'
  | 'SCHEMA_REPAIR'
  | 'TRUST_BLOCK_ADD'
  | 'INTERNAL_LINK_PATCH'
  | 'TECHNICAL_CONFIG_PATCH'
  | 'SECURITY_HARDENING'
  | 'LLMS_TXT_CREATE'
  | 'CRAWLABILITY_REPAIR';

/** Scoring categories for deterministic evidence-based scoring. */
export type ScoringCategory =
  | 'content_depth'
  | 'heading_structure'
  | 'schema_structured_data'
  | 'meta_tags_og'
  | 'technical_seo'
  | 'ai_readability'
  | 'security_trust';

/** A single scored category with evidence-backed reasoning. */
export interface CategoryScore {
  category: ScoringCategory;
  score_0_100: number;
  weight: number;
  weighted_contribution: number;
  evidence_keys: string[];
  fix_classes: FixClass[];
  reasoning: string;
}

/** The full deterministic score breakdown for one audit. */
export interface ScoringResult {
  overall_score: number;
  categories: CategoryScore[];
  hard_blockers: string[];
  score_cap: number | null;
  score_cap_reason: string | null;
}

/** A classified finding mapping to exactly one fix class. */
export interface ClassifiedFinding {
  id: string;
  rule_id: string;
  fix_class: FixClass;
  title: string;
  severity: SSFRRuleSeverity;
  auto_fixable: boolean;
  expected_uplift_min: number;
  expected_uplift_max: number;
  affected_files: string[];
  evidence_ids: string[];
  reasoning: string;
}

/** The full classification result for one audit. */
export interface ClassificationResult {
  findings: ClassifiedFinding[];
  auto_fixable_count: number;
  manual_only_count: number;
  total_expected_uplift_min: number;
  total_expected_uplift_max: number;
}

/** Pipeline remediation mode. */
export type RemediationMode = 'advisory' | 'assisted' | 'autonomous';

/** A single file patch produced by the pipeline. */
export interface PipelinePatch {
  file_path: string;
  operation: 'create' | 'update' | 'append';
  content: string;
  fix_class: FixClass;
  justification: string;
}

/** Level 1/2/3 fixpack from the pipeline. */
export type FixpackLevel = 1 | 2 | 3;

/** A levelled fixpack output. */
export interface LevelledFixpack {
  level: FixpackLevel;
  fix_class: FixClass;
  title: string;
  summary: string;
  patches: PipelinePatch[];
  auto_applicable: boolean;
  expected_uplift_min: number;
  expected_uplift_max: number;
  based_on_finding_ids: string[];
}

/** The outcome of a rescan comparison. */
export interface RescanUplift {
  score_before: number;
  score_after: number;
  score_delta: number;
  categories_before: CategoryScore[];
  categories_after: CategoryScore[];
  improvements: Array<{
    category: ScoringCategory;
    delta: number;
    fix_classes_applied: FixClass[];
  }>;
  proof_timestamp: string;
}

/** Status of a pipeline run. */
export type PipelineRunStatus =
  | 'pending'
  | 'scanning'
  | 'scoring'
  | 'classifying'
  | 'generating_fixpacks'
  | 'awaiting_approval'
  | 'applying'
  | 'rescanning'
  | 'completed'
  | 'failed';

/** Top-level pipeline run record. */
export interface PipelineRun {
  id: string;
  user_id: string;
  workspace_id: string | null;
  target_url: string;
  mode: RemediationMode;
  status: PipelineRunStatus;
  audit_id: string | null;
  scoring_result: ScoringResult | null;
  classification_result: ClassificationResult | null;
  fixpacks: LevelledFixpack[];
  rescan_uplift: RescanUplift | null;
  created_at: string;
  updated_at: string;
}

/* ── Brand Mention Tracker ──────────────────────────────────────────────── */

export type MentionSentiment = 'positive' | 'negative' | 'neutral';

export interface BrandMentionRow {
  id?: string;
  source: string;
  url: string;
  title: string;
  snippet: string;
  sentiment?: MentionSentiment;
  detected_at: string;
}

export interface BrandMentionScanResponse {
  success: boolean;
  brand: string;
  domain: string;
  sources_checked: string[];
  mentions: BrandMentionRow[];
  scanned_at: string;
  persisted: number;
}

export interface BrandMentionHistoryResponse {
  success: boolean;
  mentions: BrandMentionRow[];
  total: number;
  source_breakdown: Array<{ source: string; count: number; latest?: string }>;
}

export interface BrandMentionTimelinePoint {
  date: string;
  count: number;
}

/* ── Mention KPI Dashboard ──────────────────────────────────────────────── */

export interface MentionKPIData {
  brand: string;
  volume: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  /** (positive - negative) / volume * 100, range -100..100 */
  net_sentiment_score: number;
  /** Composite 0–100: 40% NSS-normalised + 30% volume index + 30% source diversity */
  brand_health_score: number;
  source_count: number;
  top_sources: Array<{ source: string; count: number }>;
  computed_at: string;
}

/* ── Named Entity Recognition (NER) ────────────────────────────────────────── */

export type NEREntityType = 'ORG' | 'PRODUCT' | 'PERSON' | 'LOCATION' | 'BRAND';

export interface NEREntity {
  text: string;
  type: NEREntityType;
  /** Summed occurrences across all results in the run */
  total_count: number;
  /** Number of distinct results the entity appeared in */
  result_count: number;
  is_target_brand: boolean;
}

export interface NERRunSummary {
  run_id: string;
  entities: NEREntity[];
  total_unique_entities: number;
  org_count: number;
  product_count: number;
  person_count: number;
  location_count: number;
  /** Non-target ORG + PRODUCT entities co-mentioned alongside the brand */
  co_mentioned_count: number;
}
/* ========================= Dataset Pipeline (Audit-Verified) ========================= */

/** Vertical domain focus for high-value datasets */
export type DatasetVertical = 'ai_governance' | 'incident_response' | 'agentic_interaction';

/** Pipeline stage an entry has reached */
export type DatasetEntryStage = 'ingested' | 'annotated' | 'synthesized' | 'audited';

/** Whether an entry is real (scraped) or synthetic (ML-generated edge case) */
export type DatasetEntryOrigin = 'real' | 'synthetic';

export const DATASET_VERTICALS: Readonly<Record<DatasetVertical, {
  name: string;
  description: string;
  primarySources: string[];
  schemaType: string;
}>> = {
  ai_governance: {
    name: 'AI Governance',
    description: 'AI-related torts, regulations, insurance acts, and compliance frameworks',
    primarySources: ['justia.com', 'law.cornell.edu', 'eur-lex.europa.eu'],
    schemaType: 'LegalDocument',
  },
  incident_response: {
    name: 'Incident Response',
    description: 'Annotated telemetry from data breaches and cybersecurity incidents',
    primarySources: ['nvd.nist.gov', 'cve.mitre.org', 'cisa.gov'],
    schemaType: 'SecurityIncident',
  },
  agentic_interaction: {
    name: 'Agentic Interaction',
    description: 'Logs of human-LLM interaction patterns for trust and verification research',
    primarySources: ['arxiv.org', 'dl.acm.org', 'openreview.net'],
    schemaType: 'InteractionLog',
  },
};

/** A single dataset entry with provenance + audit trail */
export interface DatasetEntry {
  id: string;
  vertical: DatasetVertical;
  stage: DatasetEntryStage;
  origin: DatasetEntryOrigin;
  /** Source URL or identifier for provenance */
  source_url: string;
  /** Human-readable title */
  title: string;
  /** Raw extracted content */
  content: string;
  /** ML-applied labels (Contextual Integrity annotation) */
  labels: Record<string, string | number | boolean>;
  /** Ground-truth fix annotations from the ML auditor */
  ground_truth: Record<string, string | number | boolean> | null;
  /** SHA-256 verification hash of content + labels */
  audit_hash: string | null;
  /** JSON-LD provenance metadata */
  provenance_jsonld: Record<string, unknown> | null;
  /** Confidence score from the ML annotator (0-1) */
  confidence: number;
  /** Whether a human has reviewed this entry */
  human_reviewed: boolean;
  /** Tags for filtering */
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** Summary of a dataset vertical's pipeline status */
export interface DatasetVerticalSummary {
  vertical: DatasetVertical;
  total_entries: number;
  by_stage: Record<DatasetEntryStage, number>;
  by_origin: Record<DatasetEntryOrigin, number>;
  audited_percentage: number;
  human_reviewed_count: number;
  avg_confidence: number;
  last_ingestion_at: string | null;
}

/** Request payload for ingesting new entries */
export interface DatasetIngestRequest {
  vertical: DatasetVertical;
  source_url: string;
  title?: string;
}

/** Request for generating synthetic edge cases */
export interface DatasetSynthesizeRequest {
  vertical: DatasetVertical;
  count: number;
  seed_entry_ids?: string[];
}

/** Audit proof attached to a verified entry */
export interface DatasetAuditProof {
  entry_id: string;
  audit_hash: string;
  algorithm: 'sha256';
  content_snapshot: string;
  labels_snapshot: string;
  provenance_jsonld: Record<string, unknown>;
  issued_at: string;
}

// ── Streaming scan event types ──────────────────────────────────────────────

/** A single cite-ledger entry streamed during a live scan */
export interface CiteEntry {
  /** Stable hash ID: sha1(evidence_key + ':' + source) */
  id: string;
  /** Raw signal text extracted from the page */
  raw_evidence: string;
  /** Human-readable signal interpretation */
  extracted_signal: string;
  /** Normalised evidence key (e.g. 'schema_org', 'meta_description') */
  evidence_key: string;
  /** Unix ms timestamp when this cite was extracted */
  timestamp: number;
  /**
   * Reliability score produced by the citation filter (0.0–1.0).
   * Measures structural stability of the evidence element.
   * Only entries scoring ≥ CITATION_THRESHOLD (0.98) receive a citation_handle.
   */
  reliability_score: number;
  /**
   * Citation Handle — sha256(evidence_key + source + stable_value + html_hash).
   * Present only when reliability_score ≥ 0.98.
   * Resolves back to the original rendered HTML snapshot for full auditability.
   */
  citation_handle: string | null;
  /**
   * SHA-256 of the raw HTML at capture time.
   * Immutable upstream anchor — ties the cite to a specific page render.
   */
  source_html_hash: string;
}

/** Result shape returned by the citation filter for a single evidence item */
export interface CitationFilterResult {
  cite: CiteEntry;
  /** true = passed threshold, emitted to stream; false = rejected */
  accepted: boolean;
  /** Reason for rejection, when accepted === false */
  rejection_reason?: string;
  /** Individual penalty breakdown for observability */
  score_breakdown: {
    base: number;
    volatility_penalty: number;
    structure_bonus: number;
    delta_correction: number;
    final: number;
  };
}

/** A named entity reference streamed during entity extraction */
export interface EntityRef {
  name: string;
  /** SSFF family: 'source' | 'signal' | 'fact' | 'relationship' */
  type: string;
  confidence: number;
}

/** Final scan summary included with SCAN_COMPLETED */
export interface ScanSummary {
  url: string;
  score: number;
  cite_count: number;
  entity_count: number;
  processing_ms: number;
  /** Pre-built preview result for the result card */
  status_line: string;
  findings: string[];
  recommendation: string;
  hard_blockers: string[];
  scanned_at: string;
}

/** Discriminated union of all events emitted over the SSE stream */
export type ScanEvent =
  | { type: 'SCAN_STARTED'; url: string; ts: number }
  | { type: 'HTML_FETCHED'; bytes: number }
  | { type: 'DOM_PARSED'; nodes: number }
  | { type: 'CITE_FOUND'; cite: CiteEntry }
  | { type: 'ENTITY_EXTRACTED'; entity: EntityRef }
  | { type: 'INTERPRETATION'; message: string; cite_ids: string[] }
  | { type: 'SCORE_UPDATED'; layer: 'crawl' | 'semantic' | 'authority'; value: number }
  | { type: 'ERROR'; stage: string; message: string }
  | { type: 'SCAN_COMPLETED'; summary: ScanSummary };