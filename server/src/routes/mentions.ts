import { Router } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import type { Request, Response, NextFunction } from 'express';
import {
  runMentionScan,
  enqueueRssIngestionHandler,
  ingestUrlReplayHandler,
  getMentionHistoryHandler,
  getMentionTimelineHandler,
  getMentionKPIHandler,
  getMentionKPIHistoryHandler,
  computeMentionJuiceHandler,
  getMentionJuiceSnapshotHandler,
  getMentionJuiceHistoryHandler,
  getInfluenceSummaryHandler,
  getInfluenceEntityHandler,
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

// POST /api/mentions/ingest/rss - push one RSS document into ingestion queue
router.post('/ingest/rss', requireAlignmentOrHigher, enqueueRssIngestionHandler);

// POST /api/mentions/ingest/url - fetch URL content, enqueue, and return persisted IDs
router.post('/ingest/url', requireAlignmentOrHigher, ingestUrlReplayHandler);

// GET /api/mentions/history - get stored mentions for current user
router.get('/history', requireAlignmentOrHigher, getMentionHistoryHandler);

// GET /api/mentions/timeline - daily mention counts over past N days
router.get('/timeline', requireAlignmentOrHigher, getMentionTimelineHandler);

// GET /api/mentions/kpi - compute live KPI dashboard metrics
router.get('/kpi', requireAlignmentOrHigher, getMentionKPIHandler);

// GET /api/mentions/kpi/history - historical KPI snapshots for trend charts
router.get('/kpi/history', requireAlignmentOrHigher, getMentionKPIHistoryHandler);

// ─────────────────────────────────────────────────────────────────────────────
// MentionJuice Score (Alignment+)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/mentions/juice - compute live credibility-weighted MentionJuice Score
router.post('/juice', requireAlignmentOrHigher, computeMentionJuiceHandler);

// GET /api/mentions/juice/snapshot?brand=XYZ - fetch latest snapshot
router.get('/juice/snapshot', requireAlignmentOrHigher, getMentionJuiceSnapshotHandler);

// GET /api/mentions/juice/history?brand=XYZ - score trend history
router.get('/juice/history', requireAlignmentOrHigher, getMentionJuiceHistoryHandler);

// GET /api/mentions/influence/summary - persisted graph-backed influence leaderboard
router.get('/influence/summary', requireAlignmentOrHigher, getInfluenceSummaryHandler);

// GET /api/mentions/influence/entity/:entityId - persisted graph topology for one entity
router.get('/influence/entity/:entityId', requireAlignmentOrHigher, getInfluenceEntityHandler);

export default router;
