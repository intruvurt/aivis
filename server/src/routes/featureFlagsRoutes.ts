/**
 * Feature Flags & Person Analytics Routes
 * 
 * Real feature flag evaluation + person property management
 * Server-side authority for feature decisions
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

function getAuthHeader(): Record<string, string> {
    const key = getPostHogApiKey();
    return key ? { Authorization: `Bearer ${key}` } : {};
}

function requireActorUserId(req: Request, targetUserId: string): { ok: boolean; actorId?: string } {
    const actorId = String((req as any)?.user?.id || '');
    if (!actorId || actorId !== String(targetUserId)) {
        return { ok: false };
    }
    return { ok: true, actorId };
}

// Use real PostHog instance (from config)
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
        console.warn('[Features] PostHog client not available (feature flags disabled)');
    }
})();

/**
 * POST /api/features/flags/evaluate
 * Server-side feature flag evaluation
 */
router.post('/flags/evaluate', authRequired, async (req: Request, res: Response) => {
    try {
        const { flagKey } = req.body;
        const userId = String((req as any)?.user?.id || '');

        if (!flagKey || !userId) {
            return res.status(400).json({
                success: false,
                error: 'flagKey is required',
            });
        }

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Feature flag service unavailable',
            });
        }

        // Evaluate feature flag server-side
        const isEnabled = await posthogClient.isFeatureEnabled(flagKey, userId);

        return res.status(200).json({
            success: true,
            flagKey,
            userId,
            enabled: isEnabled === true,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error('[Features] Flag evaluation error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Flag evaluation failed',
        });
    }
});

/**
 * POST /api/features/flags/evaluate-batch
 * Evaluate multiple flags at once
 */
router.post('/flags/evaluate-batch', authRequired, async (req: Request, res: Response) => {
    try {
        const { flagKeys } = req.body;
        const userId = String((req as any)?.user?.id || '');

        if (!Array.isArray(flagKeys) || !userId) {
            return res.status(400).json({
                success: false,
                error: 'flagKeys (array) is required',
            });
        }

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Feature flag service unavailable',
            });
        }

        // Evaluate all flags concurrently
        const evaluations = await Promise.all(
            flagKeys.map(async (key) => ({
                key,
                enabled: (await posthogClient.isFeatureEnabled(key, userId)) === true,
            }))
        );

        return res.status(200).json({
            success: true,
            userId,
            flags: evaluations,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error('[Features] Batch flag evaluation error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Batch evaluation failed',
        });
    }
});

/**
 * GET /api/features/person/:userId
 * Retrieve person properties from PostHog
 */
router.get('/person/:userId', authRequired, async (req: Request, res: Response) => {
    try {
        const rawUserId = req.params.userId;
        const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

        if (!requireActorUserId(req, userId).ok) {
            return res.status(403).json({ success: false, error: 'Forbidden: user scope violation' });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Feature service unavailable',
            });
        }

        // Query PostHog API for person properties
        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        const response = await fetch(
            `${getPostHogApiEndpoint()}/api/projects/${projectId}/persons/?distinct_id=${userId}`,
            {
                headers: getAuthHeader(),
            }
        );

        if (!response.ok) {
            return res.status(404).json({
                success: false,
                error: 'Person not found',
            });
        }

        const data = await response.json();
        const person = data.results?.[0];

        if (!person) {
            return res.status(404).json({
                success: false,
                error: 'Person not found',
            });
        }

        return res.status(200).json({
            success: true,
            userId,
            properties: person.properties || {},
            cohorts: person.cohort_ids || [],
            createdAt: person.created_at,
        });
    } catch (err: any) {
        console.error('[Features] Get person error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch person',
        });
    }
});

/**
 * PATCH /api/features/person/:userId
 * Update person properties in PostHog
 */
router.patch('/person/:userId', authRequired, async (req: Request, res: Response) => {
    try {
        const rawUserId = req.params.userId;
        const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
        const { properties } = req.body;

        if (!requireActorUserId(req, userId).ok) {
            return res.status(403).json({ success: false, error: 'Forbidden: user scope violation' });
        }

        if (!userId || !properties || typeof properties !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'userId and properties object are required',
            });
        }

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Feature service unavailable',
            });
        }

        // Update person properties via PostHog
        posthogClient.people.set(userId, properties);

        return res.status(200).json({
            success: true,
            userId,
            updated: Object.keys(properties),
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error('[Features] Update person error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to update person',
        });
    }
});

/**
 * GET /api/features/cohorts
 * List available cohorts
 */
router.get('/cohorts', authRequired, async (req: Request, res: Response) => {
    try {
        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Feature service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        const response = await fetch(
            `${getPostHogApiEndpoint()}/api/projects/${projectId}/cohorts/`,
            {
                headers: getAuthHeader(),
            }
        );

        const data = await response.json();

        return res.status(200).json({
            success: true,
            cohorts: (data.results || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                count: c.count,
                createdAt: c.created_at,
            })),
        });
    } catch (err: any) {
        console.error('[Features] List cohorts error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch cohorts',
        });
    }
});

/**
 * GET /api/features/cohorts/:userId/membership
 * Check user's cohort membership
 */
router.get('/cohorts/:userId/membership', authRequired, async (req: Request, res: Response) => {
    try {
        const rawUserId = req.params.userId;
        const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

        if (!requireActorUserId(req, userId).ok) {
            return res.status(403).json({ success: false, error: 'Forbidden: user scope violation' });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Feature service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        // Get person to see cohort membership
        const response = await fetch(
            `${getPostHogApiEndpoint()}/api/projects/${projectId}/persons/?distinct_id=${userId}`,
            {
                headers: getAuthHeader(),
            }
        );

        if (!response.ok) {
            return res.status(404).json({
                success: false,
                error: 'Person not found',
            });
        }

        const data = await response.json();
        const person = data.results?.[0];

        if (!person) {
            return res.status(404).json({
                success: false,
                error: 'Person not found',
            });
        }

        return res.status(200).json({
            success: true,
            userId,
            cohortIds: person.cohort_ids || [],
        });
    } catch (err: any) {
        console.error('[Features] Get cohort membership error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch cohort membership',
        });
    }
});

/**
 * POST /api/features/cohorts/stats
 * Get statistics for specific cohorts
 */
router.post('/cohorts/stats', authRequired, async (req: Request, res: Response) => {
    try {
        const { cohortNames } = req.body;

        if (!Array.isArray(cohortNames) || cohortNames.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'cohortNames array is required',
            });
        }

        if (!posthogClient) {
            return res.status(503).json({
                success: false,
                error: 'Feature service unavailable',
            });
        }

        const projectId = process.env.POSTHOG_PROJECT_ID;
        if (!projectId) {
            return res.status(500).json({
                success: false,
                error: 'PostHog project ID not configured',
            });
        }

        // Fetch all cohorts and filter by names
        const response = await fetch(
            `${getPostHogApiEndpoint()}/api/projects/${projectId}/cohorts/`,
            {
                headers: getAuthHeader(),
            }
        );

        const data = await response.json();
        const allCohorts = data.results || [];

        const stats = cohortNames.map((name) => {
            const cohort = allCohorts.find((c: any) => c.name === name);
            return {
                name,
                found: !!cohort,
                count: cohort?.count || 0,
                createdAt: cohort?.created_at,
            };
        });

        return res.status(200).json({
            success: true,
            stats,
        });
    } catch (err: any) {
        console.error('[Features] Get cohort stats error:', err);
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to fetch cohort stats',
        });
    }
});

export default router;
