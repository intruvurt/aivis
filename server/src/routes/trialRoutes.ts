/**
 * Trial Routes — POST /api/trial/start, GET /api/trial/status
 */
import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { startTrial, getTrialStatus } from '../services/trialService.js';

const router = Router();

// Start a trial (Observer-only, one per account)
router.post('/start', authRequired, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id || !user?.email) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await startTrial(user.id, user.email);
    const status = result.ok ? 200 : 409;
    res.status(status).json(result);
  } catch (err: any) {
    console.error('[TrialRoutes] POST /start error:', err?.message);
    res.status(500).json({ error: 'Failed to start trial.' });
  }
});

// Check trial status
router.get('/status', authRequired, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const status = await getTrialStatus(user.id);
    res.json(status);
  } catch (err: any) {
    console.error('[TrialRoutes] GET /status error:', err?.message);
    res.status(500).json({ error: 'Failed to get trial status.' });
  }
});

export default router;
