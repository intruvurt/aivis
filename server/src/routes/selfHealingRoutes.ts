import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { getPool } from '../services/postgresql.js';
import { runSelfHealingCycle } from '../services/selfHealingService.js';
import {
  getAlertSubscriptions,
  upsertAlertSubscription,
  deleteAlertSubscription,
  getAlertNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  sendTestAlert,
  type AlertChannel,
  type AlertType,
} from '../services/alertService.js';
import { getTimeline, getUserTimelineUrls } from '../services/visibilityTimeline.js';
import {
  getFixRankings,
  getGlobalFixRankings,
  seedValidatedFixOutcomes,
} from '../services/fixLearning.js';

const VALID_CHANNELS = new Set<AlertChannel>(['email', 'slack', 'discord', 'webhook', 'in_app']);
const VALID_ALERT_TYPES = new Set<AlertType>([
  'score_regression', 'score_improvement', 'opportunity',
  'competitor_gap', 'fix_applied', 'fix_merged', 'deploy_regression',
]);

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

// ── Visibility Timeline ───────────────────────────────────────────────────────

router.get('/timeline', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const url = String(req.query.url || '').trim();
  const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));

  if (!url) {
    const urls = await getUserTimelineUrls(userId);
    return res.json({ success: true, urls });
  }

  const timeline = await getTimeline(userId, url, days);
  return res.json({ success: true, timeline });
});

// ── Fix ROI Rankings ──────────────────────────────────────────────────────────

router.get('/fix-rankings', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const scope = String(req.query.scope || 'user');

  let seeding: { inserted: number; candidates: number } | null = null;
  if (scope !== 'global') {
    try {
      seeding = await seedValidatedFixOutcomes({ userId });
    } catch {
      seeding = null;
    }
  }

  const rankings = scope === 'global'
    ? await getGlobalFixRankings()
    : await getFixRankings(userId);

  return res.json({ success: true, rankings, seeding });
});

// ── Alert Subscriptions ───────────────────────────────────────────────────────

router.get('/alerts/subscriptions', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const subscriptions = await getAlertSubscriptions(userId);
  return res.json({ success: true, subscriptions });
});

router.put('/alerts/subscriptions', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const channel = String(req.body?.channel || '').toLowerCase() as AlertChannel;
  const channelConfig: Record<string, string> = req.body?.channel_config ?? {};
  const alertTypes: AlertType[] = Array.isArray(req.body?.alert_types) ? req.body.alert_types : [];
  const enabled = req.body?.enabled !== false;

  if (!VALID_CHANNELS.has(channel)) {
    return res.status(400).json({ success: false, error: `channel must be one of: ${[...VALID_CHANNELS].join(', ')}` });
  }

  const badTypes = alertTypes.filter((t) => !VALID_ALERT_TYPES.has(t));
  if (badTypes.length) {
    return res.status(400).json({ success: false, error: `Invalid alert_types: ${badTypes.join(', ')}` });
  }

  // Basic channel config validation
  if (['slack', 'discord', 'webhook'].includes(channel)) {
    if (!channelConfig.url || !channelConfig.url.startsWith('https://')) {
      return res.status(400).json({ success: false, error: 'channel_config.url must be a valid https URL' });
    }
  }
  if (channel === 'email' && channelConfig.address) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(channelConfig.address)) {
      return res.status(400).json({ success: false, error: 'channel_config.address must be a valid email' });
    }
  }

  const subscription = await upsertAlertSubscription(userId, channel, channelConfig, alertTypes, enabled);
  return res.json({ success: true, subscription });
});

router.delete('/alerts/subscriptions/:channel', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const channel = String(req.params.channel || '').toLowerCase() as AlertChannel;

  if (!VALID_CHANNELS.has(channel)) {
    return res.status(400).json({ success: false, error: 'Invalid channel' });
  }

  const deleted = await deleteAlertSubscription(userId, channel);
  return res.json({ success: true, deleted });
});

router.post('/alerts/test', async (req: Request, res: Response) => {
  const channel = String(req.body?.channel || '').toLowerCase() as AlertChannel;
  const channelConfig: Record<string, string> = req.body?.channel_config ?? {};

  if (!VALID_CHANNELS.has(channel) || channel === 'in_app') {
    return res.status(400).json({ success: false, error: 'Invalid channel for test' });
  }

  if (['slack', 'discord', 'webhook'].includes(channel) && !channelConfig.url?.startsWith('https://')) {
    return res.status(400).json({ success: false, error: 'channel_config.url must be a valid https URL' });
  }

  try {
    await sendTestAlert(channel, channelConfig);
    return res.json({ success: true, message: `Test alert sent to ${channel}` });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message || 'Failed to send test alert' });
  }
});

// ── In-app Notifications ──────────────────────────────────────────────────────

router.get('/notifications', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
  const unreadOnly = req.query.unread === 'true';

  const notifications = await getAlertNotifications(userId, limit, unreadOnly);
  return res.json({ success: true, notifications });
});

router.post('/notifications/read', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];

  if (ids.length === 0) {
    await markAllNotificationsRead(userId);
  } else {
    await markNotificationsRead(userId, ids);
  }

  return res.json({ success: true });
});

export default router;
