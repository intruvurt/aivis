/**
 * heatmapRoutes.ts
 *
 * GET /api/heatmap?url=<url>
 *
 * Returns HeatmapSurface derived strictly from citation_results + citation_tests.
 * Auth required. No client-side aggregation — all computation is server-side.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { buildHeatmapSurface } from '../services/heatmapBuilder.js';
import { isSafeExternalUrl } from '../middleware/securityMiddleware.js';

const router = Router();

router.use(authRequired);

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const rawUrl = req.query['url'];
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'url query parameter required' });
    }

    const url = rawUrl.trim().slice(0, 2048);

    // Validate URL is safe before using it as a DB lookup key
    if (!isSafeExternalUrl(url)) {
      return res.status(400).json({ error: 'Invalid or unsafe URL' });
    }

    const surface = await buildHeatmapSurface(user.id, url);
    return res.json(surface);
  } catch (err) {
    console.error('[heatmap] build error:', err);
    return res.status(500).json({ error: 'Failed to build heatmap surface' });
  }
});

export default router;
