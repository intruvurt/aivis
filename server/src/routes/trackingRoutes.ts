import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { getPool } from '../services/postgresql.js';
import {
    TRACKING_MAX_QUERIES,
    createTrackingProjectForUser,
    assertProjectTenantAccess,
    createRunForProject,
    getRunForUser,
    computeRunInsightsForUser,
    getEntityClarityWithSERP,
} from '../services/trackingService.js';
import { enqueueTrackingRun } from '../infra/queues/trackingQueue.js';

const router = Router();
router.use(authRequired);

/** Validate tenantId looks like a safe UUID before injecting into set_config. */
function assertSafeTenantId(id: string): string {
    if (!id || !/^[0-9a-f-]{8,36}$/i.test(id)) throw new Error(`Unsafe tenantId: ${id}`);
    return id;
}

/**
 * Middleware: Inject Tenant Context
 * Sets the PostgreSQL session variable for Row-Level Security (RLS) using
 * the parameterised set_config() function — fully injection-safe.
 */
async function injectTenantContext(req: Request, res: Response, next: NextFunction) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Tenant context missing' });
    try {
        const safeTenantId = assertSafeTenantId(tenantId);
        // is_local=true → scoped to current transaction, never bleeds across pool connections
        await getPool().query(`SELECT set_config('app.current_tenant', $1, true)`, [safeTenantId]);
        next();
    } catch {
        return res.status(400).json({ error: 'Invalid tenant context' });
    }
}

/**
 * POST /api/tracking/projects
 * Logic: Strict 50-query validation and tenant-scoped project creation
 */
router.post('/projects', injectTenantContext, async (req: Request, res: Response) => {
    const { domain, queries, competitorDomains } = req.body;

    if (!domain || !Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'Invalid project configuration' });
    }

    // 50-Query Limit Enforcement 
    if (queries.length > TRACKING_MAX_QUERIES) {
        return res.status(400).json({
            error: `Project exceeds 50-query limit for standard tracking.`,
            limit: TRACKING_MAX_QUERIES
        });
    }

    const project = await createTrackingProjectForUser((req as any).user.id, {
        domain: domain.trim(),
        queries: queries.map(q => q.trim()).filter(Boolean),
        competitorDomains: competitorDomains || [],
    });

    return res.status(201).json(project);
});

/**
 * POST /api/tracking/projects/:projectId/runs
 * Logic: Hybrid Parallelization Run Queue
 */
router.post('/projects/:projectId/runs', injectTenantContext, async (req: Request, res: Response) => {
    const projectId = String(req.params.projectId);
    const userId = (req as any).user?.id as string;

    try {
        await assertProjectTenantAccess(userId, projectId);

        // Initialize Run context including AI Tier and Domain data 
        const { runId, totalQueries } = await createRunForProject(projectId);

        // enqueueTrackingRun maps tenantTier to BullMQ priority (signal/enterprise → P0=1, others → P1=3)
        const jobId = await enqueueTrackingRun({
            runId,
            projectId,
            tenantTier: (req as any).user?.tier,
        });

        return res.status(202).json({ runId, totalQueries, jobId, status: 'enqueued' });
    } catch (err: any) {
        return res.status(403).json({ error: 'Unauthorized or invalid project' });
    }
});

/**
 * GET /api/tracking/runs/:runId
 * Returns run status and metadata for polling from the client.
 */
router.get('/runs/:runId', injectTenantContext, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string;
    try {
        const run = await getRunForUser(userId, String(req.params.runId));
        if (!run) return res.status(404).json({ error: 'Run not found' });
        return res.json(run);
    } catch {
        return res.status(403).json({ error: 'Access denied' });
    }
});

/**
 * GET /api/tracking/runs/:runId/insights
 * Computes aggregate visibility insights for a completed run.
 */
router.get('/runs/:runId/insights', injectTenantContext, async (req: Request, res: Response) => {
    const userId2 = (req as any).user?.id as string;
    try {
        const insights = await computeRunInsightsForUser(userId2, String(req.params.runId));
        if (!insights) return res.status(404).json({ error: 'Insights not yet available' });
        return res.json(insights);
    } catch {
        return res.status(403).json({ error: 'Access denied' });
    }
});

/**
 * GET /api/tracking/runs/:runId/entity-clarity
 * Calculates how consistently AI engines describe the brand,
 * optionally boosted by live SERP signals (Knowledge Panels, Featured Snippets).
 */
router.get('/runs/:runId/entity-clarity', injectTenantContext, async (req: Request, res: Response) => {
    const clarityData = await getEntityClarityWithSERP(
        (req as any).user?.id as string,
        String(req.params.runId),
        (req as any).user?.tier as string,
    );
    if (!clarityData) return res.status(404).json({ error: 'Data not yet available' });
    return res.json(clarityData);
});

export default router;