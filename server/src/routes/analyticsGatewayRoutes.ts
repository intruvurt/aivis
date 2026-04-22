/**
 * Analytics Gateway Routes
 * 
 * Backend-only route; frontend never calls PostHog directly.
 * All analytics queries go through this gate.
 */

import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { queryAnalytics, getEventCounts, validateEventPayload } from '../services/analyticsGateway.js';
import type { AnalyticsEventType } from '../config/posthogEvents.js';

const router = Router();

router.use(authRequired);
router.use(workspaceRequired);

/**
 * GET /api/analytics/events
 * 
 * Query event counts for behavior signals
 */
router.get('/analytics/events', async (req: Request, res: Response) => {
    try {
        const eventType = (req.query.event as string) || undefined;
        const timeRangeMs = req.query.timeRangMs ? Number(req.query.timeRangMs) : 24 * 60 * 60 * 1000;

        if (eventType) {
            const validation = validateEventPayload(eventType as AnalyticsEventType, {});
            if (!validation.ok) {
                return res.status(400).json({ success: false, error: validation.error });
            }
        }

        const result = await getEventCounts(eventType as AnalyticsEventType, timeRangeMs);

        if (!result.ok) {
            return res.status(503).json({
                success: false,
                error: result.error || 'Analytics query failed',
            });
        }

        return res.json({ success: true, data: result.data });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err?.message || 'Analytics gateway error',
        });
    }
});

/**
 * POST /api/analytics/query
 * 
 * Advanced analytics query (filtered/time-bound)
 */
router.post('/analytics/query', async (req: Request, res: Response) => {
    try {
        const queryType = req.body?.queryType as string;
        const timeRange = req.body?.timeRange as { from: number; to: number } | undefined;
        const filters = req.body?.filters as Record<string, unknown> | undefined;

        if (!queryType) {
            return res.status(400).json({ success: false, error: 'queryType is required' });
        }

        const result = await queryAnalytics({ queryType: queryType as any, timeRange, filters });

        if (!result.ok) {
            return res.status(503).json({
                success: false,
                error: result.error || 'Query failed',
            });
        }

        return res.json({ success: true, data: result.data });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err?.message || 'Analytics gateway error',
        });
    }
});

/**
 * GET /api/analytics/health
 * 
 * Check if PostHog connection is healthy
 */
router.get('/analytics/health', async (_req: Request, res: Response) => {
    try {
        const apiKey = process.env.POSTHOG_API_KEY || '';
        const projectId = process.env.POSTHOG_PROJECT_ID || '';

        if (!apiKey) {
            return res.status(503).json({
                success: false,
                configured: false,
                error: 'POSTHOG_API_KEY not set',
            });
        }

        if (!projectId) {
            return res.status(503).json({
                success: false,
                configured: false,
                error: 'POSTHOG_PROJECT_ID not set',
            });
        }

        // Quick connectivity check
        const endpoint = process.env.POSTHOG_API_ENDPOINT || 'https://app.posthog.com';
        const response = await fetch(`${endpoint}/api/projects/${projectId}/events/?limit=1`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        const healthy = response.ok;

        return res.json({
            success: true,
            configured: true,
            healthy,
            projectId: projectId.slice(0, 8) + '***',
            endpoint,
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err?.message || 'Health check failed',
        });
    }
});

export default router;
