// server/src/routes/entity.ts
// Entity fingerprint, blocklist, collision detection, and anchor score routes.
// All routes require authentication. Alignment+ tier required.

import { Router } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import type { Request, Response, NextFunction } from 'express';
import {
  getFingerprintHandler,
  upsertFingerprintHandler,
  getBlocklistHandler,
  addBlocklistEntryHandler,
  removeBlocklistEntryHandler,
  detectCollisionsHandler,
  acceptBlocklistSuggestionsHandler,
  getAnchorScoreHandler,
  getAuditRunsHandler,
  ingestEntityHandler,
  getEntityHealthHandler,
  runEntityAuditHandler,
  diagnoseEntityHandler,
  clarifyEntityHandler,
  reinforceEntityHandler,
  simulateEntityHandler,
  publishEntityHandler,
} from '../controllers/entity.controllers.js';

const router = Router();

router.use(authRequired);

const requireAlignmentOrHigher = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      error: 'Entity fingerprinting requires an Alignment or Signal plan.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }
  next();
};

// ── Fingerprint CRUD ─────────────────────────────────────────────────────────
router.get('/fingerprint', requireAlignmentOrHigher, getFingerprintHandler);
router.put('/fingerprint', requireAlignmentOrHigher, upsertFingerprintHandler);

// ── Blocklist CRUD ───────────────────────────────────────────────────────────
router.get('/blocklist', requireAlignmentOrHigher, getBlocklistHandler);
router.post('/blocklist', requireAlignmentOrHigher, addBlocklistEntryHandler);
router.delete('/blocklist/:id', requireAlignmentOrHigher, removeBlocklistEntryHandler);

// ── Collision detection ──────────────────────────────────────────────────────
router.post('/detect-collisions', requireAlignmentOrHigher, detectCollisionsHandler);
router.post('/accept-blocklist', requireAlignmentOrHigher, acceptBlocklistSuggestionsHandler);

// ── Anchor score & audit runs ────────────────────────────────────────────────
router.get('/anchor-score', requireAlignmentOrHigher, getAnchorScoreHandler);
router.get('/audit-runs', requireAlignmentOrHigher, getAuditRunsHandler);

// ── Entity OS surface ────────────────────────────────────────────────────────
router.post('/ingest', requireAlignmentOrHigher, ingestEntityHandler);
router.get('/:id/health', requireAlignmentOrHigher, getEntityHealthHandler);
router.post('/:id/audit', requireAlignmentOrHigher, runEntityAuditHandler);
router.post('/:id/diagnose', requireAlignmentOrHigher, diagnoseEntityHandler);
router.post('/:id/clarify', requireAlignmentOrHigher, clarifyEntityHandler);
router.post('/:id/reinforce', requireAlignmentOrHigher, reinforceEntityHandler);
router.post('/:id/simulate', requireAlignmentOrHigher, simulateEntityHandler);
router.post('/:id/publish', requireAlignmentOrHigher, publishEntityHandler);

export default router;
