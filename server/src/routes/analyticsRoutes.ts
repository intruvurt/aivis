/**
 * Analytics Query Routes
 * 
 * Server-side analytics queries + aggregation
 * Powers dashboard and reporting
 */

import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';

const router = Router();

function getPostHogApiKey(): string {
    return process.env.POSTHOG_API_KEY || process.env.POSTHOG_KEY || '';
}

function getPostHogApiEndpoint(): string {
    return process.env.POSTHOG_API_ENDPOINT || 'https://app.posthog.com';
}

function parseDays(input: unknown, fallback: number): number {
    const parsed = Number.parseInt(String(input ?? fallback), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(365, Math.max(1, parsed));
}

function getAuthHeader(): Record<string, string> {
    const key = getPostHogApiKey();
    return key ? { Authorization: `Bearer ${key}` } : {};
}

// PostHog instance
let posthogClient: any;
(async () => {
    try {
        const moduleRef = await import('posthog-node');
        const PostHogCtor = (moduleRef as any).PostHog || (moduleRef as any).default;
        const apiKey = getPostHogApiKey();
        if (PostHogCtor && apiKey) {
            posthogClient = new PostHogCtor(apiKey, {
                apiHost: getPostHogApiEndpoint(),
            });
        }
    } catch (err) {
        console.warn('[Analytics] PostHog client not available');
    }
})();

/**
 * GET /api/analytics/health
 * System heath check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        return res.status(200).json({
            success: true,
            status: 'ok',
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: 'Health check failed',
        });
    }
});

/**
 * GET /api/analytics/events/count
 * Count events over a time range
 */
router.get('/events/count', authRequired, async (req: Request, res: Response) => {
    try {
        const { event, days = 7 } = req.query;

        if (!event) {
            return res.status(400).json({
                success: false,
                error: 'event parameter is required',
            });
        }

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        const daysCount = parseDays(days, 7);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        const response = await fetch(
            `${getPostHogApiEndpoint()}/api/projects/${projectId}/events/?event=${event}&after=${startDate.toISOString()}&limit=1`,
            {
                headers: getAuthHeader(),
            }
        );

        const data = await response.json();

        return res.status(200).json({
            success: true,
            event,
            count: data.count || 0,
            timeRange: {
                days: daysCount,
                startDate: startDate.toISOString(),
                endDate: new Date().toISOString(),
            },
        });
    } catch (err: any) {
        console.error('[Analytics] Event count error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to count events',
        });
    }
});

/**
 * GET /api/analytics/visitors
 * Get unique visitor count and trends
 */
router.get('/visitors', authRequired, async (req: Request, res: Response) => {
    try {
        const { days = 7 } = req.query;

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        const daysCount = parseDays(days, 7);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        // Query for page view events to count unique visitors
        const response = await fetch(
            `${getPostHogApiEndpoint()}/api/projects/${projectId}/events/?event=$pageview&after=${startDate.toISOString()}&limit=1`,
            {
                headers: getAuthHeader(),
            }
        );

        const data = await response.json();

        return res.status(200).json({
            success: true,
            uniqueVisitors: data.count || 0,
            timeRange: {
                days: daysCount,
                startDate: startDate.toISOString(),
                endDate: new Date().toISOString(),
            },
        });
    } catch (err: any) {
        console.error('[Analytics] Visitors error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch visitor data',
        });
    }
});

/**
 * GET /api/analytics/engagement
 * Get engagement metrics
 */
router.get('/engagement', authRequired, async (req: Request, res: Response) => {
    try {
        const { days = 7 } = req.query;

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        const daysCount = parseDays(days, 7);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        // Track key engagement events
        const analyticsEventNames = [
            'scan_started',
            'scan_completed',
            'citation_viewed',
            'manual_citation_added',
        ];

        const eventCounts = await Promise.all(
            analyticsEventNames.map(async (eventName) => {
                const response = await fetch(
                    `${getPostHogApiEndpoint()}/api/projects/${projectId}/events/?event=${eventName}&after=${startDate.toISOString()}&limit=1`,
                    {
                        headers: getAuthHeader(),
                    }
                );
                const data = await response.json();
                return {
                    event: eventName,
                    count: data.count || 0,
                };
            })
        );

        return res.status(200).json({
            success: true,
            engagement: eventCounts,
            timeRange: {
                days: daysCount,
                startDate: startDate.toISOString(),
                endDate: new Date().toISOString(),
            },
        });
    } catch (err: any) {
        console.error('[Analytics] Engagement error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch engagement data',
        });
    }
});

/**
 * GET /api/analytics/retention
 * Get user retention metrics
 */
router.get('/retention', authRequired, async (req: Request, res: Response) => {
    try {
        const { days = 30 } = req.query;

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        // Fetch retention data from PostHog API
        const daysCount = parseDays(days, 30);
        const response = await fetch(
            `${getPostHogApiEndpoint()}/api/projects/${projectId}/insights/retention/`,
            {
                method: 'POST',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date_from: new Date(Date.now() - daysCount * 24 * 60 * 60 * 1000).toISOString(),
                    target_event: 'scan_completed',
                    returning_event: 'scan_started',
                }),
            }
        );

        const data = await response.json();

        return res.status(200).json({
            success: true,
            retention: data.result || [],
            timeRange: {
                days: daysCount,
            },
        });
    } catch (err: any) {
        console.error('[Analytics] Retention error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch retention data',
        });
    }
});

/**
 * GET /api/analytics/product-metrics
 * Get core product metrics dashboard
 */
router.get('/product-metrics', authRequired, async (req: Request, res: Response) => {
    try {
        const { days = 30 } = req.query;

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        const daysCount = parseDays(days, 30);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        // Fetch multiple metrics in parallel
        const [scansRes, citationsRes, usersRes] = await Promise.all([
            fetch(
                `${getPostHogApiEndpoint()}/api/projects/${projectId}/events/?event=scan_completed&after=${startDate.toISOString()}&limit=1`,
                {
                    headers: getAuthHeader(),
                }
            ),
            fetch(
                `${getPostHogApiEndpoint()}/api/projects/${projectId}/events/?event=citation_viewed&after=${startDate.toISOString()}&limit=1`,
                {
                    headers: getAuthHeader(),
                }
            ),
            fetch(
                `${getPostHogApiEndpoint()}/api/projects/${projectId}/events/?event=$pageview&after=${startDate.toISOString()}&distinct=true&limit=1`,
                {
                    headers: getAuthHeader(),
                }
            ),
        ]);

        const [scans, citations, users] = await Promise.all([
            scansRes.json(),
            citationsRes.json(),
            usersRes.json(),
        ]);

        return res.status(200).json({
            success: true,
            metrics: {
                scansCompleted: scans.count || 0,
                citationsViewed: citations.count || 0,
                uniqueUsers: users.count || 0,
            },
            timeRange: {
                days: daysCount,
                startDate: startDate.toISOString(),
                endDate: new Date().toISOString(),
            },
        });
    } catch (err: any) {
        console.error('[Analytics] Product metrics error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch product metrics',
        });
    }
});

/**
 * POST /api/analytics/query
 * Custom analytics query endpoint
 */
router.post('/query', authRequired, async (req: Request, res: Response) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'query parameter is required',
            });
        }

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        // Custom HogQL query
        const response = await fetch(
            `${getPostHogApiEndpoint()}/api/projects/${projectId}/query/`,
            {
                method: 'POST',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: data.detail || 'Query execution failed',
            });
        }

        return res.status(200).json({
            success: true,
            results: data.results || [],
            query,
        });
    } catch (err: any) {
        console.error('[Analytics] Custom query error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Query execution failed',
        });
    }
});

export default router;
