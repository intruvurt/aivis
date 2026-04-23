/**
 * graphRoutes.ts
 *
 * REST endpoints for the graph knowledge layer.
 *
 * GET  /api/graph/resolutions/:scanId        — fetch computed resolutions for a scan
 * POST /api/graph/resolve/:scanId            — manually trigger resolution engine for a scan
 * GET  /api/graph/export/:scanId             — JSON-LD @graph export for a scan
 * GET  /api/graph/relationships/:entity      — semantic relationship edges for an entity
 * POST /api/graph/feedback/:scanId           — manually trigger graph feedback loop
 * GET  /api/graph/visibility-events/:entity  — VisibilityEvent ledger for an entity
 * GET  /api/graph/content-pages/:entity      — generated content pages for an entity
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { runResolution, getResolutionsForScan } from '../services/graphResolutionService.js';
import { buildGraphExport } from '../services/graphExportService.js';
import { getEntityRelationships } from '../services/entityRelationshipEngine.js';
import { getVisibilityEventsForEntity } from '../services/visibilityEventLedger.js';
import { getContentPagesForEntity } from '../services/contentExpansionEngine.js';
import { runGraphFeedbackLoop, isFeedbackLoopActive } from '../services/graphFeedbackLoop.js';
import { sanitizePromptInput } from '../utils/sanitize.js';

const router = Router();

/**
 * GET /api/graph/resolutions/:scanId
 *
 * Returns the computed resolution candidates for every cluster in a scan.
 * Ordered by predicate → probability DESC.
 */
router.get(
  '/resolutions/:scanId',
  authRequired,
  async (req: Request, res: Response): Promise<void> => {
    const { scanId } = req.params as { scanId: string };

    if (!scanId || typeof scanId !== 'string') {
      res.status(400).json({ error: 'Invalid scanId' });
      return;
    }

    try {
      const resolutions = await getResolutionsForScan(scanId);
      res.json({ scanId, resolutions, count: resolutions.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resolution read failed';
      console.error('[graphRoutes] GET resolutions failed:', msg);
      res.status(500).json({ error: 'Failed to fetch resolutions' });
    }
  },
);

/**
 * POST /api/graph/resolve/:scanId
 *
 * Manually runs (or re-runs) the resolution engine for a scan.
 * Idempotent — deletes and rewrites resolution rows.
 */
router.post(
  '/resolve/:scanId',
  authRequired,
  async (req: Request, res: Response): Promise<void> => {
    const { scanId } = req.params as { scanId: string };

    if (!scanId || typeof scanId !== 'string') {
      res.status(400).json({ error: 'Invalid scanId' });
      return;
    }

    try {
      const result = await runResolution({ scanId });
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resolution failed';
      console.error('[graphRoutes] POST resolve failed:', msg);
      res.status(500).json({ error: 'Resolution run failed' });
    }
  },
);

/**
 * GET /api/graph/export/:scanId
 *
 * Returns a JSON-LD @graph document for all entities, relationships,
 * visibility events, and content pages tied to a scan.
 * Used by LLM crawlers and structured data consumers.
 */
router.get(
  '/export/:scanId',
  authRequired,
  async (req: Request, res: Response): Promise<void> => {
    const { scanId } = req.params as { scanId: string };

    if (!scanId || typeof scanId !== 'string' || scanId.length > 100) {
      res.status(400).json({ error: 'Invalid scanId' });
      return;
    }

    try {
      const graph = await buildGraphExport(scanId);
      res.setHeader('Content-Type', 'application/ld+json');
      res.json(graph);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Graph export failed';
      console.error('[graphRoutes] GET export failed:', msg);
      res.status(500).json({ error: 'Graph export failed' });
    }
  },
);

/**
 * GET /api/graph/relationships/:entity
 *
 * Returns semantic relationship edges for a canonical entity name.
 * Optional ?types= query param filters by relationship type(s).
 */
router.get(
  '/relationships/:entity',
  authRequired,
  async (req: Request, res: Response): Promise<void> => {
    const entity = sanitizePromptInput(String(req.params.entity || '')).slice(0, 300);
    if (!entity) {
      res.status(400).json({ error: 'Invalid entity' });
      return;
    }

    const rawTypes = req.query.types;
    const types = rawTypes
      ? String(rawTypes).split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;

    try {
      const relationships = await getEntityRelationships(entity, types as any);
      res.json({ entity, relationships, count: relationships.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Relationship fetch failed';
      console.error('[graphRoutes] GET relationships failed:', msg);
      res.status(500).json({ error: 'Relationship fetch failed' });
    }
  },
);

/**
 * GET /api/graph/visibility-events/:entity
 *
 * Returns VisibilityEvent ledger entries for an entity.
 * Optional ?limit= controls result count (max 500).
 */
router.get(
  '/visibility-events/:entity',
  authRequired,
  async (req: Request, res: Response): Promise<void> => {
    const entity = sanitizePromptInput(String(req.params.entity || '')).slice(0, 300);
    if (!entity) {
      res.status(400).json({ error: 'Invalid entity' });
      return;
    }

    const rawLimit = parseInt(String(req.query.limit || '100'), 10);
    const limit = isNaN(rawLimit) ? 100 : Math.min(Math.max(1, rawLimit), 500);

    try {
      const events = await getVisibilityEventsForEntity(entity, limit);
      res.json({ entity, events, count: events.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Visibility events fetch failed';
      console.error('[graphRoutes] GET visibility-events failed:', msg);
      res.status(500).json({ error: 'Visibility events fetch failed' });
    }
  },
);

/**
 * GET /api/graph/content-pages/:entity
 *
 * Returns all auto-generated content pages for an entity.
 */
router.get(
  '/content-pages/:entity',
  authRequired,
  async (req: Request, res: Response): Promise<void> => {
    const entity = sanitizePromptInput(String(req.params.entity || '')).slice(0, 300);
    if (!entity) {
      res.status(400).json({ error: 'Invalid entity' });
      return;
    }

    try {
      const pages = await getContentPagesForEntity(entity);
      res.json({ entity, pages, count: pages.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Content pages fetch failed';
      console.error('[graphRoutes] GET content-pages failed:', msg);
      res.status(500).json({ error: 'Content pages fetch failed' });
    }
  },
);

/**
 * POST /api/graph/feedback/:scanId
 *
 * Manually triggers (or re-triggers) the graph expansion feedback loop
 * for a completed scan. Idempotent — re-entrant calls for the same
 * scan_id are rejected with 409.
 *
 * Body (all optional):
 *   entity          string     — primary entity name
 *   evidence_url    string     — source URL
 *   competitors     string[]   — competitor names
 *   topics          string[]   — topic clusters
 *   failure_topics  string[]   — topics where entity is absent
 */
router.post(
  '/feedback/:scanId',
  authRequired,
  async (req: Request, res: Response): Promise<void> => {
    const { scanId } = req.params as { scanId: string };

    if (!scanId || typeof scanId !== 'string' || scanId.length > 100) {
      res.status(400).json({ error: 'Invalid scanId' });
      return;
    }

    if (isFeedbackLoopActive(scanId)) {
      res.status(409).json({ error: 'Feedback loop already running for this scan_id' });
      return;
    }

    const entity = sanitizePromptInput(String(req.body?.entity || '')).slice(0, 300);
    const evidence_url = String(req.body?.evidence_url || '').slice(0, 2000);
    const competitors: string[] = Array.isArray(req.body?.competitors)
      ? req.body.competitors.map((c: unknown) => sanitizePromptInput(String(c)).slice(0, 200)).filter(Boolean)
      : [];
    const topics: string[] = Array.isArray(req.body?.topics)
      ? req.body.topics.map((t: unknown) => String(t).slice(0, 200)).filter(Boolean)
      : [];
    const failure_topics: string[] = Array.isArray(req.body?.failure_topics)
      ? req.body.failure_topics.map((t: unknown) => String(t).slice(0, 200)).filter(Boolean)
      : [];

    if (!entity) {
      res.status(400).json({ error: 'entity is required' });
      return;
    }

    try {
      // Run async — return 202 immediately and let caller poll
      const resultPromise = runGraphFeedbackLoop({
        scan_id: scanId,
        entity,
        evidence_url,
        competitors,
        topics,
        failure_topics,
      });

      // For small feedback runs, await with a 10s timeout and return inline
      const INLINE_TIMEOUT_MS = 10_000;
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), INLINE_TIMEOUT_MS),
      );

      const winner = await Promise.race([resultPromise, timeoutPromise]);

      if (winner) {
        res.json({ scan_id: scanId, status: 'complete', result: winner });
      } else {
        // Still running — return 202
        res.status(202).json({
          scan_id: scanId,
          status: 'running',
          message: 'Graph feedback loop is running. Check /api/graph/content-pages/:entity for results.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Feedback loop failed';
      console.error('[graphRoutes] POST feedback failed:', msg);
      res.status(500).json({ error: 'Feedback loop failed' });
    }
  },
);

export default router;
