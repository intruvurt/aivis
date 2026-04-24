import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import { enqueueAuditJob } from '../infra/queues/auditQueue.js';
import {
    runProductionHardChecks,
    createFixPlanRecord,
    ensureDeterministicContractTables,
} from '../services/deterministicContractService.js';

const router = Router();

// Scope auth/workspace checks only to deterministic loop namespaces.
// This router is mounted at /api in server.ts, so unscoped router.use(authRequired)
// would accidentally intercept unrelated public endpoints like /api/health.
router.use(['/determinism', '/fix', '/analysis'], authRequired);
router.use(['/determinism', '/fix', '/analysis'], workspaceRequired);

router.get('/determinism/checks', async (_req: Request, res: Response) => {
    try {
        const report = await runProductionHardChecks();
        return res.status(report.ok ? 200 : 503).json({
            success: report.ok,
            report,
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to run deterministic checks',
        });
    }
});

router.post('/fix/apply', async (req: Request, res: Response) => {
    const userId = String(req.user?.id || '').trim();
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const runId = req.body?.runId ? String(req.body.runId).trim() : '';
    const urlInput = String(req.body?.url || '').trim();
    const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];

    if (!urlInput) return res.status(400).json({ success: false, error: 'url is required' });
    if (actions.length === 0) {
        return res.status(400).json({ success: false, error: 'actions are required' });
    }

    const normalized = normalizePublicHttpUrl(urlInput, {
        allowPrivate: process.env.NODE_ENV !== 'production',
    });
    if (!normalized.ok) {
        return res.status(400).json({ success: false, error: normalized.error, code: 'INVALID_URL' });
    }

    try {
        await ensureDeterministicContractTables();
        const created = await createFixPlanRecord({
            runId: runId || undefined,
            previousRunId: runId || undefined,
            userId,
            workspaceId: req.workspace?.id || null,
            url: normalized.url,
            actions: actions.map((a: any) => ({
                type: String(a?.type || '').trim(),
                value: a?.value,
            })),
        });

        return res.json({
            success: true,
            fixPlanId: created.id,
            status: created.status,
            runId: runId || null,
            url: normalized.url,
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to apply fix plan',
        });
    }
});

router.post('/analysis/rerun', async (req: Request, res: Response) => {
    const userId = String(req.user?.id || '').trim();
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const previousRunId = String(req.body?.previousRunId || '').trim();
    const urlInput = String(req.body?.url || '').trim();
    if (!urlInput) return res.status(400).json({ success: false, error: 'url is required' });
    if (!previousRunId) {
        return res.status(400).json({ success: false, error: 'previousRunId is required' });
    }

    const normalized = normalizePublicHttpUrl(urlInput, {
        allowPrivate: process.env.NODE_ENV !== 'production',
    });
    if (!normalized.ok) {
        return res.status(400).json({ success: false, error: normalized.error, code: 'INVALID_URL' });
    }

    try {
        const report = await runProductionHardChecks();
        if (!report.ok) {
            return res.status(503).json({
                success: false,
                error: 'determinism_gate_failed',
                report: report.checks,
            });
        }

        const jobId = await enqueueAuditJob({
            url: normalized.url,
            userId,
            workspaceId: req.workspace?.id,
            priority: 'high',
        });

        return res.json({
            success: true,
            previousRunId,
            jobId,
            status: 'queued',
            url: normalized.url,
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            error: err?.message || 'Failed to queue rerun',
        });
    }
});

export default router;
