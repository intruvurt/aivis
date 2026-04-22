/**
 * graphRoutes.ts
 *
 * REST endpoints for the graph knowledge layer.
 *
 * GET  /api/graph/resolutions/:scanId  — fetch computed resolutions for a scan
 * POST /api/graph/resolve/:scanId      — manually trigger resolution engine for a scan
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { runResolution, getResolutionsForScan } from '../services/graphResolutionService.js';

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

export default router;
