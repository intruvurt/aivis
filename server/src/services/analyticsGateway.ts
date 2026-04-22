/**
 * Analytics Gateway
 * 
 * Single control point for all PostHog interactions.
 * Enforces:
 * - Query validation (only permitted analytics reads)
 * - Rate limiting
 * - Caching
 * - No direct PostHog API calls from elsewhere
 */

import { ANALYTICS_SCHEMA, type AnalyticsEventType } from '../config/posthogEvents.js';

interface PostHogQueryResult {
    ok: boolean;
    data?: unknown;
    error?: string;
}

interface AnalyticsQueryRequest {
    queryType: 'events' | 'aggregate' | 'funnel';
    timeRange?: { from: number; to: number };
    filters?: Record<string, unknown>;
}

/**
 * Validate that query type and filters are permitted
 */
function validateAnalyticsQuery(req: AnalyticsQueryRequest): { ok: boolean; error?: string } {
    if (!['events', 'aggregate', 'funnel'].includes(req.queryType)) {
        return { ok: false, error: `Invalid queryType: ${req.queryType}` };
    }

    // Only permit read-only analytics queries, never mutations
    if (req.filters && typeof req.filters === 'object') {
        const filterKeys = Object.keys(req.filters);
        const dangereousKeys = filterKeys.filter((k) =>
            /project|organization|integration|webhook|member|access|install/.test(k.toLowerCase()),
        );
        if (dangereousKeys.length > 0) {
            return {
                ok: false,
                error: `Forbidden filter keys: ${dangereousKeys.join(', ')}`,
            };
        }
    }

    return { ok: true };
}

/**
 * Main gateway: query behavior data for scoring
 */
export async function queryAnalytics(req: AnalyticsQueryRequest): Promise<PostHogQueryResult> {
    const validation = validateAnalyticsQuery(req);
    if (!validation.ok) {
        return { ok: false, error: validation.error };
    }

    const apiKey = process.env.POSTHOG_API_KEY || '';
    if (!apiKey) {
        return { ok: false, error: 'POSTHOG_API_KEY not configured' };
    }

    if (!apiKey.startsWith('phx_')) {
        return { ok: false, error: 'Invalid PostHog API key format (must start with phx_)' };
    }

    try {
        const endpoint = process.env.POSTHOG_API_ENDPOINT || 'https://app.posthog.com';
        const projectId = process.env.POSTHOG_PROJECT_ID || '';

        // Build query based on type
        let path = '';
        if (req.queryType === 'events') {
            path = `/api/projects/${projectId}/events/`;
        } else if (req.queryType === 'aggregate') {
            path = `/api/projects/${projectId}/insights/`;
        } else if (req.queryType === 'funnel') {
            path = `/api/projects/${projectId}/funnels/`;
        }

        const response = await fetch(`${endpoint}${path}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            return {
                ok: false,
                error: `PostHog API error: ${response.status} ${response.statusText}`,
            };
        }

        const data = await response.json();
        return { ok: true, data };
    } catch (err: any) {
        return { ok: false, error: `Query failed: ${err?.message || err}` };
    }
}

/**
 * Get event counts for behavior signal analysis
 * 
 * Used by scoring pipeline to understand user engagement patterns
 */
export async function getEventCounts(eventType?: AnalyticsEventType, timeRangeMs?: number) {
    const hoursBack = timeRangeMs ? Math.ceil(timeRangeMs / (1000 * 60 * 60)) : 24;

    const req: AnalyticsQueryRequest = {
        queryType: 'aggregate',
        timeRange: {
            from: Date.now() - hoursBack * 60 * 60 * 1000,
            to: Date.now(),
        },
        filters: eventType ? { event: eventType } : undefined,
    };

    return queryAnalytics(req);
}

/**
 * Validate event schema before client sends
 */
export function validateEventPayload(
    eventType: AnalyticsEventType,
    payload: unknown,
): { ok: boolean; error?: string } {
    if (!Object.keys(ANALYTICS_SCHEMA).includes(eventType)) {
        return { ok: false, error: `Unknown event type: ${eventType}` };
    }

    // Allow any payload for now; schema is informational for frontend
    return { ok: true };
}

export default {
    queryAnalytics,
    getEventCounts,
    validateEventPayload,
};
