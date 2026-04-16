/* ========================= Product Definition (LOCKED) ========================= */
/**
 * AI Search Visibility Audit Tool
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

/**
 * AiVIS 5-Tier Model
 * - observer: Free tier ("see how AI systems parse and interpret your site")
 * - starter: Starter tier ("all recommendations with implementation code and PDF exports")
 * - alignment: Core tier ("turn structural gaps into extractable evidence")
 * - signal: Pro tier ("full visibility into how AI crawlers trust your content")
 * - scorefix: AutoFix PR tier ("automated score remediation")
 */
export type CanonicalTier = 'observer' | 'starter' | 'alignment' | 'signal' | 'scorefix';

/**
 * Legacy tier aliases for backwards compatibility
 */
export type LegacyTier = 'free' | 'core' | 'premium' | 'enterprise' | 'pro';

/**
 * Public-facing tiers for marketing/UI
 */
export type UiTier = 'observer' | 'starter' | 'alignment' | 'signal' | 'scorefix';

/**
 * Converts canonical tier to UI-friendly tier (identity for new system)
 */
export function uiTierFromCanonical(tier: CanonicalTier | LegacyTier): UiTier {
  // Handle legacy tier names
  const legacyMapping: Record<string, UiTier> = {
    free: 'observer',
    core: 'alignment',
    premium: 'signal',
    enterprise: 'signal',
    pro: 'signal',
    observer: 'observer',
    starter: 'starter',
    alignment: 'alignment',
    signal: 'signal',
    scorefix: 'scorefix',
  };
  return legacyMapping[tier] || 'observer';
}

/**
 * Converts UI tier to canonical tier (identity for new system)
 */
export function canonicalTierFromUi(tier: UiTier): CanonicalTier {
  return tier;
}

/**
 * Get tier display name for UI
 */
export function getTierDisplayName(tier: CanonicalTier | LegacyTier): string {
  const displayNames: Record<string, string> = {
    observer: 'Observer (Free)',
    starter: 'Starter',
    alignment: 'Alignment (Core)',
    signal: 'Signal (Pro)',
    scorefix: 'Score Fix [AutoFix PR]',
    // Legacy
    free: 'Observer (Free)',
    core: 'Alignment (Core)',
    premium: 'Signal (Pro)',
    enterprise: 'Signal (Pro)',
    pro: 'Signal (Pro)',
  };

  return displayNames[tier] || 'Observer (Free)';
}

/**
 * Get tier positioning tagline
 */
export function getTierPositioning(tier: CanonicalTier): string {
  const positioning: Record<CanonicalTier, string> = {
    observer: 'see how AI systems parse and interpret your site',
    starter: 'guided recommendations with implementation code',
    alignment: 'turn structural gaps into extractable evidence',
    signal: 'full visibility into how AI crawlers trust your content',
    scorefix: 'automated fix PRs and verification',
  };
  return positioning[tier];
}

/**
 * Get tier target audience
 */
export function getTierAudience(tier: CanonicalTier): string {
  const audience: Record<CanonicalTier, string> = {
    observer: 'curious builders • founders testing the mirror',
    starter: 'indie hackers • small teams shipping fast',
    alignment: 'solo builders • early founders • no-code creators',
    signal: 'agencies • studios • internal teams',
    scorefix: 'teams needing automated remediation',
  };
  return audience[tier];
}

/**
 * Check if a tier meets minimum requirement
 */
export function meetsMinimumTier(
  userTier: CanonicalTier | LegacyTier,
  requiredTier: CanonicalTier
): boolean {
  const tierHierarchy: Record<string, number> = {
    // New tiers
    observer: 0,
    starter: 1,
    alignment: 2,
    signal: 3,
    scorefix: 4,
    // Legacy mapping
    free: 0,
    core: 2,
    premium: 3,
    enterprise: 3,
    pro: 3,
  };

  return (tierHierarchy[userTier] ?? 0) >= tierHierarchy[requiredTier];
}

/**
 * Tier feature limits configuration
 */
export interface TierLimits {
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
}

export const TIER_LIMITS: Record<CanonicalTier, TierLimits> = {
  observer: {
    scansPerMonth: 3,
    pagesPerScan: 2,
    competitors: 0,
    cacheDays: 7,
    hasExports: false,
    hasForceRefresh: false,
    hasApiAccess: false,
    hasWhiteLabel: false,
    hasScheduledRescans: false,
    hasReportHistory: false,
    hasShareableLink: false,
  },
  starter: {
    scansPerMonth: 15,
    pagesPerScan: 8,
    competitors: 0,
    cacheDays: 14,
    hasExports: true,
    hasForceRefresh: true,
    hasApiAccess: false,
    hasWhiteLabel: false,
    hasScheduledRescans: false,
    hasReportHistory: true,
    hasShareableLink: true,
  },
  alignment: {
    scansPerMonth: 60,
    pagesPerScan: 35,         // multi-page crawl
    competitors: 1,
    cacheDays: 30,
    hasExports: true,
    hasForceRefresh: true,
    hasApiAccess: false,
    hasWhiteLabel: false,
    hasScheduledRescans: true,
    hasReportHistory: true,
    hasShareableLink: true,
  },
  signal: {
    scansPerMonth: 200,
    pagesPerScan: 100,        // deep crawl
    competitors: 10,
    cacheDays: 90,
    hasExports: true,
    hasForceRefresh: true,
    hasApiAccess: true,
    hasWhiteLabel: true,
    hasScheduledRescans: true,
    hasReportHistory: true,
    hasShareableLink: true,
  },
  scorefix: {
    scansPerMonth: 15,
    pagesPerScan: 220,
    competitors: 5,
    cacheDays: 90,
    hasExports: true,
    hasForceRefresh: true,
    hasApiAccess: true,
    hasWhiteLabel: true,
    hasScheduledRescans: true,
    hasReportHistory: true,
    hasShareableLink: true,
  },
};

/**
 * Get feature limits for a tier (with legacy support)
 */
export function getTierLimitsForUser(tier: CanonicalTier | LegacyTier): TierLimits {
  const normalizedTier = uiTierFromCanonical(tier as CanonicalTier);
  return TIER_LIMITS[normalizedTier];
}

/* ========================= AI Visibility analysis types ========================= */

/**
 * Scores for major AI platforms (0-100)
 */
export interface AIPlatformScores {
  chatgpt: number;
  perplexity: number;
  google_ai: number;
  claude: number;
}

/**
 * Validates AI platform scores
 */
export function validateAIPlatformScores(scores: AIPlatformScores): boolean {
  return Object.values(scores).every(score =>
    typeof score === 'number' && score >= 0 && score <= 100
  );
}

/**
 * Priority level for recommendations
 */
export type RecommendationPriority = 'high' | 'medium' | 'low';

/**
 * Implementation difficulty for recommendations
 */
export type RecommendationDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Actionable recommendation for improving AI visibility
 */
export interface Recommendation {
  id?: string; // Optional unique identifier
  priority: RecommendationPriority;
  category: string;
  title: string;
  description: string;
  impact: string;
  difficulty: RecommendationDifficulty;
  implementation: string;
  estimatedTimeMinutes?: number;
  resources?: string[]; // Links to documentation/guides
}

/**
 * Content structure analysis
 */
export interface ContentAnalysis {
  word_count: number;
  headings: {
    h1: number;
    h2: number;
    h3: number;
  };
  has_proper_h1: boolean;
  faq_count: number;
  readability_score?: number; // Optional: Flesch reading ease
  keyword_density?: Record<string, number>; // Optional: top keywords
}

/**
 * Schema.org markup analysis
 */
export interface SchemaMarkup {
  json_ld_count: number;
  has_organization_schema: boolean;
  has_faq_schema: boolean;
  schema_types: string[];
  validation_errors?: string[]; // Optional: schema validation issues
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

/**
 * Domain-level intelligence
 */
export interface DomainIntelligence {
  domain: string;
  page_title: string;
  page_description: string;
  canonical_url: string;
  language: string;
  robots: string;
  primary_topics: string[];
  open_graph?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

/**
 * Technical performance signals
 */
export interface TechnicalSignals {
  response_time_ms: number;
  status_code: number;
  content_length: number;
  image_count: number;
  link_count: number;
  https_enabled: boolean;
  mobile_friendly?: boolean;
  has_viewport_meta?: boolean;
}

/**
 * Cryptocurrency-related intelligence
 */
export interface CryptoIntelligence {
  has_crypto_signals: boolean;
  summary: string;
  detected_assets: string[];
  keywords: string[];
  wallet_addresses: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  risk_notes: string[];
  chain_networks?: string[]; // e.g., ['ethereum', 'bitcoin']
}

/**
 * Main analysis response from the API
 */
export interface AnalysisResponse {
  // Core visibility metrics
  visibility_score: number;
  // Legacy / UI-friendly aliases (some UI uses camelCase)
  overallScore?: number;
  verdict?: string;
  categories?: any[];
  criticalFixes?: any[];
  quickWins?: any[];
  metadata?: any;

  ai_platform_scores: AIPlatformScores;
  recommendations: Recommendation[];

  // Structured data analysis
  schema_markup: SchemaMarkup;
  content_analysis: ContentAnalysis;

  // Summary and insights
  summary: string;
  key_takeaways: string[];
  topical_keywords: string[];
  brand_entities: string[];

  // Domain and technical data
  domain_intelligence: DomainIntelligence;
  technical_signals: TechnicalSignals;

  // Crypto-specific analysis
  crypto_intelligence: CryptoIntelligence;

  // Metadata
  url: string; // The analyzed URL
  analyzed_at: string; // ISO timestamp
  processing_time_ms?: number;
  cached?: boolean;
  cache_age_seconds?: number | null;
  analysis_version?: string; // Track analysis algorithm version
}

/**
 * Type guard for AnalysisResponse
 */
export function isValidAnalysisResponse(obj: unknown): obj is AnalysisResponse {
  if (!obj || typeof obj !== 'object') return false;

  const response = obj as Record<string, unknown>;

  return (
    typeof response.visibility_score === 'number' &&
    typeof response.ai_platform_scores === 'object' &&
    Array.isArray(response.recommendations) &&
    typeof response.analyzed_at === 'string' &&
    typeof response.url === 'string'
  );
}

/**
 * Simplified analysis result for list views
 */
export interface AnalysisSummary {
  id: string;
  url: string;
  visibility_score: number;
  analyzed_at: string;
  cached: boolean;
  user_id?: string;
}

/* ========================= User/auth types aligned to DB + JWT ========================= */

/**
 * Authenticated user data (matches JWT claims and DB schema)
 */
export interface AuthUser {
  id: string;
  email: string;
  tier: CanonicalTier;
}

/**
 * Extended user profile with optional fields
 */
export interface UserProfile extends AuthUser {
  full_name?: string;
  created_at?: string;
  updated_at?: string;
  avatar_url?: string;
  company?: string;
  website?: string;
}

/**
 * UI-ready user profile with marketing tier
 */
export interface UserProfileUi extends UserProfile {
  subscription_tier: UiTier;
  tier_limits: TierLimits;
  display_name: string; // Computed: full_name || email
}

/**
 * Converts UserProfile to UI-ready format
 */
export function toUserProfileUi(user: UserProfile): UserProfileUi {
  return {
    ...user,
    subscription_tier: uiTierFromCanonical(user.tier),
    tier_limits: getTierLimitsForUser(user.tier),
    display_name: user.full_name || user.email.split('@')[0],
  };
}

/**
 * Type guard for AuthUser
 */
export function isAuthUser(obj: unknown): obj is AuthUser {
  if (!obj || typeof obj !== 'object') return false;

  const user = obj as Record<string, unknown>;

  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.tier === 'string' &&
    ['free', 'core', 'premium', 'observer', 'alignment', 'signal', 'scorefix'].includes(user.tier as string)
  );
}

/**
 * Subscription/billing related types
 */
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

/**
 * Usage tracking for tier limits
 */
export interface UsageStats {
  user_id: string;
  period_start: string;
  period_end: string;
  analyses_count: number;
  api_calls_count: number;
  storage_mb: number;
}

/**
 * Check if user has exceeded tier limits
 */
export function hasExceededLimits(
  usage: UsageStats,
  tier: CanonicalTier
): boolean {
  const limits = TIER_LIMITS[tier];

  if (limits.scansPerMonth === -1) return false; // Unlimited

  return usage.analyses_count >= limits.scansPerMonth;
}

/* ========================= API Response types ========================= */

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: string;
  statusCode?: number;
}

/**
 * Union type for API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Type guard for API success response
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard for API error response
 */
export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false;
}

/* ========================= Pagination types ========================= */

/**
 * Paginated response wrapper
 */
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

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/* ========================= Export all types ========================= */

export type {
  // Re-export for convenience
  CanonicalTier as Tier,
  AuthUser as User,
};