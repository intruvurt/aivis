/**
 * PostHog Analytics & Feature Flags Client
 * 
 * High-level client for server-side analytics and feature flag operations.
 * Provides simplified API and handles caching/batching internally.
 */

import type {
    FeatureFlagEvaluateResponse,
    FeatureFlagBatchResponse,
    PersonPropertiesResponse,
    AnalyticsError,
    ProductMetricsResponse,
    EngagementResponse,
    VisitorResponse,
    RetentionResponse,
    PersonPropertyValue,
    FeatureFlagClient,
    AnalyticsClient,
} from '../types/analyticsTypes.js';
import { AnalyticsErrorCode } from '../types/analyticsTypes.js';

class PostHogAnalyticsError extends Error implements AnalyticsError {
    public code: AnalyticsErrorCode;
    public statusCode: number;
    public details?: Record<string, any>;

    constructor(
        message: string,
        code: AnalyticsErrorCode,
        statusCode: number,
        details?: Record<string, any>
    ) {
        super(message);
        this.name = 'PostHogAnalyticsError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

/**
 * PostHog Feature Flag Client
 * Handles feature flag evaluation and caching
 */
export class FeatureFlagService implements FeatureFlagClient {
    private apiBase: string;
    private token: string;
    private flagCache = new Map<string, { value: boolean; time: number }>();
    private cacheTtlMs: number;
    private personCache = new Map<string, { value: PersonPropertyValue; time: number }>();

    constructor(
        apiBase: string,
        token: string,
        cacheTtlMs: number = 60_000 // 1 minute default
    ) {
        this.apiBase = apiBase;
        this.token = token;
        this.cacheTtlMs = cacheTtlMs;
    }

    /**
     * Evaluate a feature flag for a user with caching
     */
    async evaluate(userId: string, flagKey: string): Promise<boolean> {
        const cacheKey = `${userId}:${flagKey}`;
        const cached = this.flagCache.get(cacheKey);

        if (cached && Date.now() - cached.time < this.cacheTtlMs) {
            return cached.value;
        }

        const response = await this.makeRequest<FeatureFlagEvaluateResponse>(
            `${this.apiBase}/api/feature-flags/flags/evaluate`,
            {
                method: 'POST',
                body: JSON.stringify({ flagKey, userId }),
            }
        );

        if (!response.success) {
            throw new PostHogAnalyticsError(
                `Failed to evaluate flag: ${flagKey}`,
                AnalyticsErrorCode.QUERY_FAILED,
                500
            );
        }

        this.flagCache.set(cacheKey, { value: response.enabled, time: Date.now() });
        return response.enabled;
    }

    /**
     * Evaluate multiple flags in batch (more efficient)
     */
    async evaluateBatch(userId: string, flagKeys: string[]): Promise<Record<string, boolean>> {
        // First check cache for all flags
        const cached = new Map<string, boolean>();
        const uncached = [];

        for (const key of flagKeys) {
            const cacheKey = `${userId}:${key}`;
            const cachedFlag = this.flagCache.get(cacheKey);

            if (cachedFlag && Date.now() - cachedFlag.time < this.cacheTtlMs) {
                cached.set(key, cachedFlag.value);
            } else {
                uncached.push(key);
            }
        }

        // If all cached, return immediately
        if (uncached.length === 0) {
            return Object.fromEntries(cached);
        }

        // Query only uncached flags
        const response = await this.makeRequest<FeatureFlagBatchResponse>(
            `${this.apiBase}/api/feature-flags/flags/evaluate-batch`,
            {
                method: 'POST',
                body: JSON.stringify({ flagKeys: uncached, userId }),
            }
        );

        if (!response.success) {
            throw new PostHogAnalyticsError(
                'Failed to evaluate flags in batch',
                AnalyticsErrorCode.QUERY_FAILED,
                500
            );
        }

        // Cache and combine results
        const result = new Map(cached);
        for (const flag of response.flags) {
            const cacheKey = `${userId}:${flag.key}`;
            this.flagCache.set(cacheKey, { value: flag.enabled, time: Date.now() });
            result.set(flag.key, flag.enabled);
        }

        return Object.fromEntries(result);
    }

    /**
     * Check if feature is enabled for user (convenience method)
     */
    async isEnabled(userId: string, flagKey: string): Promise<boolean> {
        return this.evaluate(userId, flagKey);
    }

    /**
     * Get person properties with caching
     */
    async getPersonProperties(userId: string): Promise<PersonPropertyValue> {
        const cached = this.personCache.get(userId);
        if (cached && Date.now() - cached.time < this.cacheTtlMs) {
            return cached.value;
        }

        const response = await this.makeRequest<PersonPropertiesResponse>(
            `${this.apiBase}/api/feature-flags/person/${userId}`,
            { method: 'GET' }
        );

        if (!response.success || !response.properties) {
            throw new PostHogAnalyticsError(
                `Person not found: ${userId}`,
                AnalyticsErrorCode.NOT_FOUND,
                404
            );
        }

        this.personCache.set(userId, { value: response.properties, time: Date.now() });
        return response.properties;
    }

    /**
     * Update person properties
     */
    async updatePersonProperties(
        userId: string,
        properties: Partial<PersonPropertyValue>
    ): Promise<void> {
        const response = await this.makeRequest<PersonPropertiesResponse>(
            `${this.apiBase}/api/feature-flags/person/${userId}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ properties }),
            }
        );

        if (!response.success) {
            throw new PostHogAnalyticsError(
                `Failed to update person properties: ${userId}`,
                AnalyticsErrorCode.QUERY_FAILED,
                500
            );
        }

        // Invalidate person cache
        this.personCache.delete(userId);
    }

    /**
     * Get tier features for user
     */
    async getTierFeatures(userId: string): Promise<string[]> {
        const properties = await this.getPersonProperties(userId);
        const tier = properties.plan || 'observer';

        const TIER_FEATURES: Record<string, string[]> = {
            observer: ['basic_scan', 'search_visibility'],
            starter: ['basic_scan', 'search_visibility', 'competitor_tracking', 'api_access'],
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

        return TIER_FEATURES[tier] || TIER_FEATURES['observer'];
    }

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.flagCache.clear();
        this.personCache.clear();
    }

    private async makeRequest<T>(
        url: string,
        options: RequestInit = {}
    ): Promise<T> {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.token}`,
                    ...(options.headers || {}),
                },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new PostHogAnalyticsError(
                    error.error || 'API request failed',
                    AnalyticsErrorCode.QUERY_FAILED,
                    response.status,
                    error
                );
            }

            return await response.json();
        } catch (err: any) {
            if (err instanceof PostHogAnalyticsError) {
                throw err;
            }
            throw new PostHogAnalyticsError(
                err?.message || 'Network error',
                AnalyticsErrorCode.SERVICE_UNAVAILABLE,
                503
            );
        }
    }
}

/**
 * PostHog Analytics Client
 * High-level analytics queries and dashboard metrics
 */
export class AnalyticsService implements AnalyticsClient {
    private apiBase: string;
    private token: string;
    private metricsCache = new Map<string, { value: any; time: number }>();
    private metricsCacheTtlMs: number;

    constructor(
        apiBase: string,
        token: string,
        metricsCacheTtlMs: number = 300_000 // 5 minutes default
    ) {
        this.apiBase = apiBase;
        this.token = token;
        this.metricsCacheTtlMs = metricsCacheTtlMs;
    }

    /**
     * Count events over a time period
     */
    async countEvent(event: string, days: number = 7): Promise<number> {
        const cacheKey = `event_count:${event}:${days}`;
        const cached = this.metricsCache.get(cacheKey);

        if (cached && Date.now() - cached.time < this.metricsCacheTtlMs) {
            return cached.value;
        }

        const response = await this.makeRequest<{ count: number }>(
            `${this.apiBase}/api/analytics/events/count?event=${event}&days=${days}`,
            { method: 'GET' }
        );

        this.metricsCache.set(cacheKey, { value: response.count, time: Date.now() });
        return response.count;
    }

    /**
     * Get unique visitor metrics
     */
    async getVisitorMetrics(days: number = 7): Promise<number> {
        const cacheKey = `visitors:${days}`;
        const cached = this.metricsCache.get(cacheKey);

        if (cached && Date.now() - cached.time < this.metricsCacheTtlMs) {
            return cached.value;
        }

        const response = await this.makeRequest<VisitorResponse>(
            `${this.apiBase}/api/analytics/visitors?days=${days}`,
            { method: 'GET' }
        );

        if (!response.success) {
            throw new PostHogAnalyticsError(
                'Failed to fetch visitor metrics',
                AnalyticsErrorCode.QUERY_FAILED,
                500
            );
        }

        this.metricsCache.set(cacheKey, { value: response.uniqueVisitors, time: Date.now() });
        return response.uniqueVisitors;
    }

    /**
     * Get engagement metrics (per-event counts)
     */
    async getEngagementMetrics(days: number = 7): Promise<Record<string, number>> {
        const cacheKey = `engagement:${days}`;
        const cached = this.metricsCache.get(cacheKey);

        if (cached && Date.now() - cached.time < this.metricsCacheTtlMs) {
            return cached.value;
        }

        const response = await this.makeRequest<EngagementResponse>(
            `${this.apiBase}/api/analytics/engagement?days=${days}`,
            { method: 'GET' }
        );

        if (!response.success) {
            throw new PostHogAnalyticsError(
                'Failed to fetch engagement metrics',
                AnalyticsErrorCode.QUERY_FAILED,
                500
            );
        }

        const metrics = response.engagement.reduce(
            (acc, e) => {
                acc[e.event] = e.count;
                return acc;
            },
            {} as Record<string, number>
        );

        this.metricsCache.set(cacheKey, { value: metrics, time: Date.now() });
        return metrics;
    }

    /**
     * Get core product metrics (KPI dashboard)
     */
    async getProductMetrics(days: number = 30): Promise<{
        scansCompleted: number;
        citationsViewed: number;
        uniqueUsers: number;
    }> {
        const cacheKey = `product_metrics:${days}`;
        const cached = this.metricsCache.get(cacheKey);

        if (cached && Date.now() - cached.time < this.metricsCacheTtlMs) {
            return cached.value;
        }

        const response = await this.makeRequest<ProductMetricsResponse>(
            `${this.apiBase}/api/analytics/product-metrics?days=${days}`,
            { method: 'GET' }
        );

        if (!response.success) {
            throw new PostHogAnalyticsError(
                'Failed to fetch product metrics',
                AnalyticsErrorCode.QUERY_FAILED,
                500
            );
        }

        this.metricsCache.set(cacheKey, { value: response.metrics, time: Date.now() });
        return response.metrics;
    }

    /**
     * Get retention cohort data
     */
    async getRetention(days: number = 30): Promise<Array<{ interval: number; cohortSize: number; returnRate: number }>> {
        const response = await this.makeRequest<RetentionResponse>(
            `${this.apiBase}/api/analytics/retention?days=${days}`,
            { method: 'GET' }
        );

        if (!response.success) {
            throw new PostHogAnalyticsError(
                'Failed to fetch retention data',
                AnalyticsErrorCode.QUERY_FAILED,
                500
            );
        }

        return response.retention.map((point) => ({
            interval: point.interval,
            cohortSize: point.cohort_size,
            returnRate: point.return_rate,
        }));
    }

    /**
     * Execute custom HogQL query
     */
    async executeQuery(query: string): Promise<Array<Record<string, any>>> {
        const response = await this.makeRequest<{ results: Array<Record<string, any>> }>(
            `${this.apiBase}/api/analytics/query`,
            {
                method: 'POST',
                body: JSON.stringify({ query }),
            }
        );

        if (!response.results) {
            throw new PostHogAnalyticsError(
                'Query execution returned no results',
                AnalyticsErrorCode.QUERY_FAILED,
                500
            );
        }

        return response.results;
    }

    /**
     * Clear all metrics caches
     */
    clearCache(): void {
        this.metricsCache.clear();
    }

    private async makeRequest<T>(
        url: string,
        options: RequestInit = {}
    ): Promise<T> {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.token}`,
                    ...(options.headers || {}),
                },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new PostHogAnalyticsError(
                    error.error || 'API request failed',
                    AnalyticsErrorCode.QUERY_FAILED,
                    response.status,
                    error
                );
            }

            return await response.json();
        } catch (err: any) {
            if (err instanceof PostHogAnalyticsError) {
                throw err;
            }
            throw new PostHogAnalyticsError(
                err?.message || 'Network error',
                AnalyticsErrorCode.SERVICE_UNAVAILABLE,
                503
            );
        }
    }
}

/**
 * Unified client for both feature flags and analytics
 */
export class PostHogClient {
    public flags: FeatureFlagService;
    public analytics: AnalyticsService;

    constructor(apiBase: string, token: string) {
        this.flags = new FeatureFlagService(apiBase, token);
        this.analytics = new AnalyticsService(apiBase, token);
    }

    clearAllCaches(): void {
        this.flags.clearCache();
        this.analytics.clearCache();
    }
}

/**
 * Create a global PostHog client instance
 */
let globalClient: PostHogClient | null = null;

export function initializePostHogClient(apiBase: string, token: string): PostHogClient {
    globalClient = new PostHogClient(apiBase, token);
    return globalClient;
}

export function getPostHogClient(): PostHogClient {
    if (!globalClient) {
        const apiBase = process.env.VITE_API_URL || 'http://localhost:3001';
        const token = process.env.API_TOKEN || '';
        return initializePostHogClient(apiBase, token);
    }
    return globalClient;
}

export { PostHogAnalyticsError };
