import { Router } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import type { Request, Response, NextFunction } from 'express';
import {
  runMentionScan,
  getMentionHistoryHandler,
  getMentionTimelineHandler,
} from '../controllers/mentions.controllers.js';

const router = Router();

// All mention routes require authentication
router.use(authRequired);

// Tier gate: Alignment (core) or higher
const requireAlignmentOrHigher = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      error: 'Brand mention tracking requires Alignment tier or higher.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }
  next();
};

// POST /api/mentions/scan - run a live mention scan
router.post('/scan', requireAlignmentOrHigher, runMentionScan);

// GET /api/mentions/history - get stored mentions for current user
router.get('/history', requireAlignmentOrHigher, getMentionHistoryHandler);

// GET /api/mentions/timeline - daily mention counts over past N days
router.get('/timeline', requireAlignmentOrHigher, getMentionTimelineHandler);

export default router;
