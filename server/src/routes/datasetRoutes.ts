/**
 * Dataset Pipeline Routes
 *
 * Signal+ tier gate — high-value dataset pipeline for verified training data
 */

import { Router } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import type { Request, Response, NextFunction } from 'express';
import {
    getVerticals,
    getSummary,
    listEntries,
    ingest,
    annotate,
    synthesize,
    audit,
    auditBatch,
    review,
    getProof,
    removeEntry,
} from '../controllers/dataset.controllers.js';

const router = Router();

router.use(authRequired);

const requireSignalOrHigher = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
    if (!meetsMinimumTier(userTier, 'signal')) {
        return res.status(403).json({
            error: 'Dataset Pipeline requires Signal tier or higher.',
            code: 'TIER_INSUFFICIENT',
            requiredTier: 'signal',
        });
    }
    next();
};

// Read-only metadata (available to all authenticated)
router.get('/verticals', getVerticals);

// Everything else requires Signal+
router.get('/summary', requireSignalOrHigher, getSummary);
router.get('/entries', requireSignalOrHigher, listEntries);
router.post('/ingest', requireSignalOrHigher, ingest);
router.post('/annotate/:id', requireSignalOrHigher, annotate);
router.post('/synthesize', requireSignalOrHigher, synthesize);
router.post('/audit/:id', requireSignalOrHigher, audit);
router.post('/audit/batch', requireSignalOrHigher, auditBatch);
router.patch('/review/:id', requireSignalOrHigher, review);
router.get('/proof/:id', requireSignalOrHigher, getProof);
router.delete('/entries/:id', requireSignalOrHigher, removeEntry);

export default router;
