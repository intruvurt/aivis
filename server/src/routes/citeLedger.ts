// server/src/routes/citeLedger.ts
// Cite Ledger API routes — entity drift tracking, job queue, ledger queries.
// All routes require authentication. Alignment+ tier required.

import { Router } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import type { Request, Response, NextFunction } from 'express';
import { getUserEntities } from '../services/entityService.js';
import { getDriftHistory, getLatestDriftScore } from '../services/entityService.js';
import {
    getCiteLedgerForRun,
    getEntityCiteLedgerSummary,
    getEntityJobs,
} from '../services/citeLedgerService.js';

const router = Router();

router.use(authRequired);

const requireAlignmentOrHigher = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
    if (!meetsMinimumTier(userTier, 'alignment')) {
        return res.status(403).json({
            error: 'Cite Ledger access requires an Alignment or Signal plan.',
            code: 'TIER_INSUFFICIENT',
            requiredTier: 'alignment',
        });
    }
    next();
};

// ── Entities (user's registered entities) ────────────────────────────────────

router.get('/entities', requireAlignmentOrHigher, async (req: Request, res: Response) => {
    try {
        const userId = String((req as any).user?.id || '');
        const entities = await getUserEntities(userId);
        res.json({ entities });
    } catch (err: any) {
        console.error('[cite-ledger] GET /entities error:', err?.message);
        res.status(500).json({ error: 'Failed to fetch entities' });
    }
});

// ── Drift score history for an entity ────────────────────────────────────────

router.get('/drift/:entityId', requireAlignmentOrHigher, async (req: Request, res: Response) => {
    try {
        const userId = String((req as any).user?.id || '');
        const eid = String(req.params.entityId);

        // Verify entity belongs to user
        const entities = await getUserEntities(userId);
        if (!entities.some((e: any) => e.id === eid)) {
            return res.status(404).json({ error: 'Entity not found' });
        }

        const [history, latest] = await Promise.all([
            getDriftHistory(eid),
            getLatestDriftScore(eid),
        ]);

        res.json({ entity_id: eid, latest, history });
    } catch (err: any) {
        console.error('[cite-ledger] GET /drift error:', err?.message);
        res.status(500).json({ error: 'Failed to fetch drift history' });
    }
});

// ── Cite ledger entries for a specific audit run ─────────────────────────────

router.get('/run/:auditRunId', requireAlignmentOrHigher, async (req: Request, res: Response) => {
    try {
        const entries = await getCiteLedgerForRun(String(req.params.auditRunId));
        res.json({ audit_run_id: String(req.params.auditRunId), entries, count: entries.length });
    } catch (err: any) {
        console.error('[cite-ledger] GET /run error:', err?.message);
        res.status(500).json({ error: 'Failed to fetch cite ledger entries' });
    }
});

// ── Cite ledger summary for an entity (all runs) ────────────────────────────

router.get('/entity/:entityId/summary', requireAlignmentOrHigher, async (req: Request, res: Response) => {
    try {
        const userId = String((req as any).user?.id || '');
        const eid = String(req.params.entityId);

        const entities = await getUserEntities(userId);
        if (!entities.some((e: any) => e.id === eid)) {
            return res.status(404).json({ error: 'Entity not found' });
        }

        const summary = await getEntityCiteLedgerSummary(eid);
        res.json({ entity_id: eid, runs: summary });
    } catch (err: any) {
        console.error('[cite-ledger] GET /entity summary error:', err?.message);
        res.status(500).json({ error: 'Failed to fetch entity summary' });
    }
});

// ── Job queue history for an entity ──────────────────────────────────────────

router.get('/jobs/:entityId', requireAlignmentOrHigher, async (req: Request, res: Response) => {
    try {
        const userId = String((req as any).user?.id || '');
        const eid = String(req.params.entityId);

        const entities = await getUserEntities(userId);
        if (!entities.some((e: any) => e.id === eid)) {
            return res.status(404).json({ error: 'Entity not found' });
        }

        const jobs = await getEntityJobs(eid);
        res.json({ entity_id: eid, jobs });
    } catch (err: any) {
        console.error('[cite-ledger] GET /jobs error:', err?.message);
        res.status(500).json({ error: 'Failed to fetch job history' });
    }
});

export default router;
