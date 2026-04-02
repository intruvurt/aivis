import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { getPool } from '../services/postgresql.js';
import { runSelfHealingCycle } from '../services/selfHealingService.js';

const router = Router();
router.use(authRequired);

router.get('/preferences', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const { rows } = await getPool().query(
    `SELECT mode, enabled, drop_threshold, updated_at
       FROM self_healing_preferences
      WHERE user_id = $1`,
    [userId]
  );

  if (!rows.length) {
    return res.json({ success: true, preferences: { mode: 'manual', enabled: true, drop_threshold: 10 } });
  }

  return res.json({ success: true, preferences: rows[0] });
});

router.put('/preferences', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const mode = String(req.body?.mode || 'manual').toLowerCase();
  const enabled = req.body?.enabled !== false;
  const dropThreshold = Math.max(5, Number(req.body?.drop_threshold || 10));

  if (!['manual', 'assisted', 'autonomous'].includes(mode)) {
    return res.status(400).json({ success: false, error: 'mode must be manual, assisted, or autonomous' });
  }

  await getPool().query(
    `INSERT INTO self_healing_preferences (user_id, mode, enabled, drop_threshold, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET mode = EXCLUDED.mode,
                   enabled = EXCLUDED.enabled,
                   drop_threshold = EXCLUDED.drop_threshold,
                   updated_at = NOW()`,
    [userId, mode, enabled, dropThreshold]
  );

  return res.json({ success: true, preferences: { mode, enabled, drop_threshold: dropThreshold } });
});

router.get('/events', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));

  const { rows } = await getPool().query(
    `SELECT id, domain, before_score, after_score, score_drop, mention_drop, mode, status, confidence, reason, fix_plan, created_at
       FROM self_healing_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, limit]
  );

  return res.json({ success: true, events: rows });
});

router.post('/run-now', async (_req: Request, res: Response) => {
  const result = await runSelfHealingCycle();
  return res.json({ success: true, ...result });
});

export default router;