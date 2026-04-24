/**
 * workerProgressRoutes.ts
 *
 * API routes for monitoring worker health and progress in real-time.
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import {
  getProgressTracker,
  sendWorkerProgressSSE,
  getAllWorkerProgress,
} from '../services/workerProgressSSE.js';

const router = Router();

/**
 * GET /api/workers/progress/all
 * Get current status of all registered workers (polling endpoint).
 */
router.get('/all', (_req: Request, res: Response) => {
  getAllWorkerProgress(_req, res);
});

/**
 * GET /api/workers/:workerId/progress
 * Stream real-time progress updates for a specific worker (SSE endpoint).
 *
 * Usage:
 *   const es = new EventSource('/api/workers/scan-worker-1/progress');
 *   es.onmessage = (e) => {
 *     const metrics = JSON.parse(e.data);
 *     console.log('Worker:', metrics);
 *   };
 */
router.get('/:workerId/progress', (req: Request, res: Response) => {
  const workerId = req.params.workerId;
  if (!workerId || typeof workerId !== 'string') {
    res.status(400).json({ error: 'Invalid workerId' });
    return;
  }
  sendWorkerProgressSSE(req, res, workerId);
});

/**
 * GET /api/workers/:workerId/metrics
 * Get current metrics snapshot for a worker (single poll).
 */
router.get('/:workerId/metrics', (req: Request, res: Response) => {
  const workerId = req.params.workerId;
  if (!workerId || typeof workerId !== 'string') {
    res.status(400).json({ error: 'Invalid workerId' });
    return;
  }
  const tracker = getProgressTracker();
  const metrics = tracker.getMetrics(workerId);

  if (!metrics) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  res.json(metrics);
});

/**
 * POST /api/workers/:workerId/reset
 * Reset metrics for a worker (for testing).
 */
router.post('/:workerId/reset', (req: Request, res: Response) => {
  const workerId = req.params.workerId;
  if (!workerId || typeof workerId !== 'string') {
    res.status(400).json({ error: 'Invalid workerId' });
    return;
  }
  const tracker = getProgressTracker();

  tracker.updateMetrics(workerId, {
    messagesProcessed: 0,
    messagesFailed: 0,
    pendingMessages: 0,
  });

  res.json({ status: 'reset', workerId });
});

export default router;
