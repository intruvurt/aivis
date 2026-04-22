/**
 * PostHog Feature Flags & Analytics Types
 * 
 * Type definitions for feature flag evaluation, person properties,
 * cohort management, and analytics queries.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Feature Flag Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FeatureFlagEvaluateRequest {
    flagKey: string;
    userId: string;
}

export interface FeatureFlagEvaluateResponse {
    success: boolean;
    flagKey: string;
    userId: string;
    enabled: boolean;
    timestamp: string;
    error?: string;
}

export interface FeatureFlagBatchRequest {
    flagKeys: string[];
    userId: string;
}

export interface FeatureFlagBatchResponse {
    success: boolean;
    userId: string;
    flags: Array<{
        key: string;
        enabled: boolean;
    }>;
    timestamp: string;
    error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Person Properties Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonPropertiesRequest {
    properties: Record<string, any>;
}

export interface PersonPropertiesResponse {
    success: boolean;
    userId: string;
    properties?: Record<string, any>;
    cohorts?: number[];
    createdAt?: string;
    updated?: string[];
    timestamp: string;
    error?: string;
}

export interface PersonPropertyValue {
    email?: string;
    name?: string;
    plan?: 'observer' | 'starter' | 'alignment' | 'signal' | 'agency';
    signup_date?: string;
    last_scan?: string;
    total_scans?: number;
    usage_level?: 'low' | 'medium' | 'high';
    churn_risk?: boolean;
    engagement_score?: number;
    preferred_features?: string[];
    [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cohort Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CohortInfo {
    id: number;
    name: string;
    description?: string;
    count: number;
    createdAt: string;
}

export interface CohortsListResponse {
    success: boolean;
    cohorts: CohortInfo[];
    error?: string;
}

export interface CohortMembershipResponse {
    success: boolean;
    userId: string;
    cohortIds: number[];
    error?: string;
}

export interface CohortStatsRequest {
    cohortNames: string[];
}

export interface CohortStatInfo {
    name: string;
    found: boolean;
    count: number;
    createdAt?: string;
}

export interface CohortStatsResponse {
    success: boolean;
    stats: CohortStatInfo[];
    error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthCheckResponse {
    success: boolean;
    status: 'ok' | 'error';
    timestamp: string;
    error?: string;
}

export interface EventCountResponse {
    success: boolean;
    event: string;
    count: number;
    timeRange: {
        days: number;
        startDate: string;
        endDate: string;
    };
    error?: string;
}

export interface VisitorResponse {
    success: boolean;
    uniqueVisitors: number;
    timeRange: {
        days: number;
        startDate: string;
        endDate: string;
    };
    error?: string;
}

export interface EngagementMetric {
    event: string;
    count: number;
}

export interface EngagementResponse {
    success: boolean;
    engagement: EngagementMetric[];
    timeRange: {
        days: number;
        startDate: string;
        endDate: string;
    };
    error?: string;
}

export interface RetentionCohort {
    interval: number;
    cohort_size: number;
    return_rate: number;
}

export interface RetentionResponse {
    success: boolean;
    retention: RetentionCohort[];
    timeRange: {
        days: number;
    };
    error?: string;
}

export interface ProductMetrics {
    scansCompleted: number;
    citationsViewed: number;
    uniqueUsers: number;
}

export interface ProductMetricsResponse {
    success: boolean;
    metrics: ProductMetrics;
    timeRange: {
        days: number;
        startDate: string;
        endDate: string;
    };
    error?: string;
}

export interface CustomAnalyticsQuery {
    query: string;
}

export interface CustomAnalyticsResponse {
    success: boolean;
    results: Array<Record<string, any>>;
    query: string;
    error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard Events
// ─────────────────────────────────────────────────────────────────────────────

export enum StandardEvents {
    SCAN_STARTED = 'scan_started',
    SCAN_COMPLETED = 'scan_completed',
    SCAN_FAILED = 'scan_failed',
    CITATION_VIEWED = 'citation_viewed',
    CITATION_FILTERED = 'citation_filtered',
    MANUAL_CITATION_ADDED = 'manual_citation_added',
    EXPORT_GENERATED = 'export_generated',
    TIER_UPGRADED = 'tier_upgraded',
    FEATURE_ACCESSED = 'feature_accessed',
    INTEGRATION_ENABLED = 'integration_enabled',
    PAGEVIEW = '$pageview',
}

export interface AnalyticsEvent {
    distinctId: string;
    event: StandardEvents | string;
    properties?: Record<string, any>;
    timestamp?: Date;
}

export interface PersonEvent {
    distinctId: string;
    properties: PersonPropertyValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier-based Feature Controls
// ─────────────────────────────────────────────────────────────────────────────

export interface TierFeatureGates {
    observer: string[];
    starter: string[];
    alignment: string[];
    signal: string[];
    agency: string[];
}

export const TIER_FEATURE_GATES: TierFeatureGates = {
    observer: [
        'basic_scan',
        'search_visibility',
    ],
    starter: [
        'basic_scan',
        'search_visibility',
        'competitor_tracking',
        'api_access',
    ],
    alignment: [
        'basic_scan',
        'search_visibility',
        'competitor_tracking',
        'api_access',
        'advanced_analytics',
        'citation_testing',
        'scheduled_rescans',
    ],
    signal: [
        'basic_scan',
        'search_visibility',
        'competitor_tracking',
        'api_access',
        'advanced_analytics',
        'citation_testing',
        'scheduled_rescans',
        'triple_model_reasoning',
        'custom_queries',
        'serp_signals',
    ],
    agency: [
        'basic_scan',
        'search_visibility',
        'competitor_tracking',
        'api_access',
        'advanced_analytics',
        'citation_testing',
        'scheduled_rescans',
        'triple_model_reasoning',
        'custom_queries',
        'serp_signals',
        'white_label',
        'team_collaboration',
        'auto_scorefix',
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Client Integration Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FeatureFlagClient {
    evaluate(userId: string, flagKey: string): Promise<boolean>;
    evaluateBatch(userId: string, flags: string[]): Promise<Record<string, boolean>>;
    getPersonProperties(userId: string): Promise<PersonPropertyValue>;
    updatePersonProperties(userId: string, properties: Partial<PersonPropertyValue>): Promise<void>;
}

export interface AnalyticsClient {
    countEvent(event: string, days?: number): Promise<number>;
    getVisitorMetrics(days?: number): Promise<number>;
    getEngagementMetrics(days?: number): Promise<Record<string, number>>;
    getProductMetrics(days?: number): Promise<ProductMetrics>;
    executeQuery(query: string): Promise<Array<Record<string, any>>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

export enum AnalyticsErrorCode {
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    INVALID_REQUEST = 'INVALID_REQUEST',
    NOT_FOUND = 'NOT_FOUND',
    QUERY_FAILED = 'QUERY_FAILED',
    UNAUTHORIZED = 'UNAUTHORIZED',
}

export interface AnalyticsError extends Error {
    code: AnalyticsErrorCode;
    statusCode: number;
    details?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PostHogConfig {
    apiKey: string;
    apiEndpoint: string;
    projectId: string;
    enabled: boolean;
}

export interface AnalyticsConfig {
    posthog: PostHogConfig;
    cacheStrategy: {
        flagCacheTtlMs: number;
        personCacheTtlMs: number;
        metricsCacheTtlMs: number;
    };
    batchSettings: {
        eventBatchSize: number;
        eventBatchIntervalMs: number;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
    kpis: {
        scansCompleted: number;
        citationsViewed: number;
        activeUsers: number;
        retentionRate: number;
    };
    timeline: Array<{
        date: string;
        scans: number;
        citations: number;
        users: number;
    }>;
    topFeatures: Array<{
        feature: string;
        adoptionRate: number;
        activeUsers: number;
    }>;
    cohortMetrics: Array<{
        name: string;
        size: number;
        engagementScore: number;
        churnRisk: number;
    }>;
}

export interface UserSegmentMetrics {
    userId: string;
    tier: string;
    engagement: number;
    lastActive: string;
    totalScans: number;
    activeFeatures: string[];
    cohorts: string[];
}
