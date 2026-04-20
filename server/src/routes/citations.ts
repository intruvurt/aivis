import { Router } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import type { Request, Response, NextFunction } from 'express';
import {
  authorityGranularCheck,
  getCitationIdentity,
  generateTestQueries,
  startCitationTest,
  getCitationTest,
  listCitationTests,
  exportCitationTestCsv,
  createQueryPack,
  listQueryPacks,
  getQueryPack,
  updateQueryPack,
  deleteQueryPack,
  executeQueryPack,
  getCitationEvidence,
  curateEvidence,
  getRevCiteSuggestions,
  listCitationPromptLedger,
} from '../controllers/citations.controllers.js';
import {
  runNicheRankingHandler,
  getNicheRankingHandler,
  getLatestNicheRankingHandler,
  listNicheRankingsHandler,
  createScheduledJobHandler,
  listScheduledJobsHandler,
  getScheduledJobHandler,
  toggleScheduledJobHandler,
  deleteScheduledJobHandler,
  updateScheduledJobIntervalHandler,
  getMentionTrendHandler,
  getCompetitorShareHandler,
  getConsistencyMatrixHandler,
  getDropAlertsHandler,
  dismissDropAlertHandler,
  getCoOccurrencesHandler,
  runCoOccurrenceCheckHandler,
  runCitationRankScoreHandler,
  getCitationRankSnapshotHandler,
  getCitationRankHistoryHandler,
  runExistenceMap,
} from '../controllers/citations.controllers.js';

const router = Router();

// All citation routes require authentication
router.use(authRequired);

const requireAlignmentOrHigher = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      error: 'Authority check is a paid feature (Alignment or Signal).',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }
  next();
};

const requireSignal = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'signal')) {
    return res.status(403).json({
      error: 'Citation Testing requires a Signal plan.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'signal',
    });
  }
  next();
};

// Paid tiers only (Alignment+): granular authority/citation/backlink checker
router.post('/authority-check', requireAlignmentOrHigher, authorityGranularCheck);
router.get('/identity', requireAlignmentOrHigher, getCitationIdentity);

// Prompt Intelligence query generation (Alignment+)
router.post('/generate-queries', requireAlignmentOrHigher, generateTestQueries);

// Start a new citation test
router.post('/test', requireSignal, startCitationTest);

// Get specific citation test results
router.get('/test/:id', requireSignal, getCitationTest);

// Export specific citation test results as CSV
router.get('/test/:id/export.csv', requireSignal, exportCitationTestCsv);

// List all citation tests for user
router.get('/tests', requireSignal, listCitationTests);

// List validated prompt runs tied to citation tests and URLs
router.get('/prompt-ledger', requireSignal, listCitationPromptLedger);

// ─────────────────────────────────────────────────────────────────────────────
// QUERY PACK MANAGEMENT (Signal-only)
// ─────────────────────────────────────────────────────────────────────────────

// Create new query pack
router.post('/query-packs', requireSignal, createQueryPack);

// List user's query packs
router.get('/query-packs', requireSignal, listQueryPacks);

// Get specific query pack
router.get('/query-packs/:id', requireSignal, getQueryPack);

// Update query pack
router.put('/query-packs/:id', requireSignal, updateQueryPack);

// Delete query pack
router.delete('/query-packs/:id', requireSignal, deleteQueryPack);

// Execute query pack (starts a new test with saved queries)
router.post('/query-packs/:id/execute', requireSignal, executeQueryPack);

// ─────────────────────────────────────────────────────────────────────────────
// CITATION EVIDENCE & REV-CITE (Signal-only)
// ─────────────────────────────────────────────────────────────────────────────

// Get high-confidence evidence for a test (top mentions)
router.get('/test/:testId/evidence', requireSignal, getCitationEvidence);

// Curate evidence (star/approve for implementation)
router.put('/evidence/:id/curate', requireSignal, curateEvidence);

// Get Rev-Cite suggestions (alternative query phrasings)
router.get('/evidence/:id/rev-cite', requireSignal, getRevCiteSuggestions);

// ─────────────────────────────────────────────────────────────────────────────
// NICHE COMPETITIVE RANKING (Signal-only)
// ─────────────────────────────────────────────────────────────────────────────

// Run a new niche ranking scan
router.post('/niche-ranking', requireSignal, runNicheRankingHandler);

// List all niche rankings for the user
router.get('/niche-rankings', requireSignal, listNicheRankingsHandler);

// Get the latest ranking for a specific URL (?url=...)
router.get('/niche-ranking/latest', requireSignal, getLatestNicheRankingHandler);

// Get a specific niche ranking by ID
router.get('/niche-ranking/:id', requireSignal, getNicheRankingHandler);

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED CITATION RANKING JOBS (Signal-only)
// ─────────────────────────────────────────────────────────────────────────────

// Create a new scheduled ranking job
router.post('/schedule', requireSignal, createScheduledJobHandler);

// List all scheduled jobs for the user
router.get('/schedule', requireSignal, listScheduledJobsHandler);

// Get a specific scheduled job
router.get('/schedule/:id', requireSignal, getScheduledJobHandler);

// Toggle a scheduled job active/inactive
router.patch('/schedule/:id/toggle', requireSignal, toggleScheduledJobHandler);

// Update the run interval for a scheduled job
router.patch('/schedule/:id/interval', requireSignal, updateScheduledJobIntervalHandler);

// Delete a scheduled job
router.delete('/schedule/:id', requireSignal, deleteScheduledJobHandler);


// ─────────────────────────────────────────────────────────────────────────────
// CITATION INTELLIGENCE (Alignment+ / Signal)
// ─────────────────────────────────────────────────────────────────────────────

// Mention-rate sparkline history for a URL (alignment+)
router.get('/trend', requireAlignmentOrHigher, getMentionTrendHandler);

// Competitor citation share table (alignment+)
router.get('/competitor-share', requireAlignmentOrHigher, getCompetitorShareHandler);

// Cross-platform consistency matrix (alignment+)
router.get('/consistency-matrix', requireAlignmentOrHigher, getConsistencyMatrixHandler);

// Drop alerts -- list and dismiss (signal)
router.get('/drop-alerts', requireSignal, getDropAlertsHandler);
router.post('/drop-alerts/:id/dismiss', requireSignal, dismissDropAlertHandler);

// Unlinked co-occurrence scanning (signal)
router.get('/co-occurrences', requireSignal, getCoOccurrencesHandler);
router.post('/co-occurrences', requireSignal, runCoOccurrenceCheckHandler);

// ─────────────────────────────────────────────────────────────────────────────
// CITATION RANK SCORE (Signal) — probabilistic AI model citation coverage
// ─────────────────────────────────────────────────────────────────────────────

// Compute citation rank score across AI models for a set of queries
router.post('/rank-score', requireSignal, runCitationRankScoreHandler);

// Latest snapshot for a URL
router.get('/rank-score/snapshot', requireSignal, getCitationRankSnapshotHandler);

// Historic trend
router.get('/rank-score/history', requireSignal, getCitationRankHistoryHandler);

// ─────────────────────────────────────────────────────────────────────────────
// EXISTENCE MAPPING — 8-step answer space probe (Alignment+)
// ─────────────────────────────────────────────────────────────────────────────

// Full existence test: identity extract → typed queries → AI probes → ledger → score → actions
router.post('/existence', requireAlignmentOrHigher, runExistenceMap);

export { router as citationRoutes };
export default router;
