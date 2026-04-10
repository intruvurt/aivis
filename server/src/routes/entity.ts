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

export default router;
