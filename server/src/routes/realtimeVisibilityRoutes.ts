import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import {
  getRealtimeVisibilityRun,
  getVisibilityHistory,
  startRealtimeVisibilityRun,
} from '../services/realtimeVisibilityEngine.js';

const router = Router();

router.post('/start', authRequired, async (req: Request, res: Response) => {
  try {
    const domain = String(req.body?.domain || '').trim();
    const brand = String(req.body?.brand || '').trim();
    if (!domain) return res.status(400).json({ success: false, error: 'domain is required' });

    const run = await startRealtimeVisibilityRun({ domain, brand });
    return res.json({ success: true, runId: run.runId, cached: run.cached });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Unable to start visibility run' });
  }
});

router.get('/stream/:runId', authRequired, async (req: Request, res: Response) => {
  const runId = String(req.params.runId || '').trim();
  if (!runId) return res.status(400).json({ success: false, error: 'runId is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = async () => {
    const state = await getRealtimeVisibilityRun(runId);
    if (!state) {
      res.write(`data: ${JSON.stringify({ status: 'missing', runId })}\n\n`);
      clearInterval(tick);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify(state)}\n\n`);
    if (state.status === 'completed' || state.status === 'failed') {
      clearInterval(tick);
      res.end();
    }
  };

  const tick = setInterval(send, 1000);
  void send();

  req.on('close', () => {
    clearInterval(tick);
  });
});

router.get('/history', authRequired, async (req: Request, res: Response) => {
  try {
    const domain = String(req.query.domain || '').trim();
    if (!domain) return res.status(400).json({ success: false, error: 'domain is required' });
    const limit = Number(req.query.limit || 20);
    const rows = await getVisibilityHistory(domain, limit);
    return res.json({ success: true, domain, history: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch visibility history' });
  }
});

export default router;
