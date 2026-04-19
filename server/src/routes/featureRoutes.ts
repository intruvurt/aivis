/**
 * Feature Routes
 * Handles scheduled rescans, API keys, webhooks, and user branding (white-label).
 * All routes are auth-required and feature-gated by tier.
 */
import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { enforceFeature } from '../middleware/usageEnforcement.js';
import {
  PRIVATE_EXPOSURE_SCAN_PACKAGING,
  TIER_LIMITS,
  meetsMinimumTier,
  uiTierFromCanonical,
} from '../../../shared/types.js';
import { dbConfigured, getPool } from '../services/postgresql.js';
import { runDiscovery, addDiscoveredToSchedule, getJob, listJobs } from '../services/nicheDiscoveryService.js';
import {
  createScheduledRescan,
  getScheduledRescans,
  updateScheduledRescan,
  deleteScheduledRescan,
} from '../services/scheduledRescanService.js';
import {
  createDeployVerificationJob,
  listDeployVerificationJobs,
  updateDeployVerificationJob,
} from '../services/deployVerificationService.js';
import {
  createDeployHookEndpoint,
  deleteDeployHookEndpoint,
  listDeployHookEndpoints,
  updateDeployHookEndpoint,
} from '../services/deployHookService.js';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  toggleApiKey,
} from '../services/apiKeyService.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import {
  createWebhook,
  listWebhooks,
  deleteWebhook,
  toggleWebhook,
  testWebhook,
  updateWebhook,
  getWebhookIntegrationCatalog,
} from '../services/webhookService.js';
import {
  getBranding,
  upsertBranding,
  deleteBranding,
} from '../services/brandingService.js';
import { renderPdfFromHtml } from '../services/reportPdfService.js';
import {
  createReportDelivery,
  deleteReportDelivery,
  listReportDeliveries,
  updateReportDelivery,
} from '../services/reportDeliveryService.js';
import { consumePackCredits, getAvailablePackCredits } from '../services/scanPackCredits.js';
import {
  getUnreadNotificationCount,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  getNotificationPreferences,
  upsertNotificationPreferences,
  NOTIFICATION_CATEGORIES,
} from '../services/notificationService.js';
import {
  cancelScheduledPlatformNotification,
  listScheduledPlatformNotifications,
  publishPlatformNotificationImmediate,
  publishScheduledPlatformNotificationNow,
  schedulePlatformNotification,
} from '../services/scheduledPlatformNotifications.js';
import { addClient } from '../services/sseHub.js';
import { verifyUserToken } from '../lib/utils/jwt.js';
import { getUserById } from '../models/User.js';
import {
  isGoogleMeasurementConfigured,
  isValidMeasurementEventName,
  sendMeasurementEvent,
} from '../services/googleMeasurement.js';
import { runPrivateExposureScan } from '../services/privateExposureScanService.js';
import { listAuditTruthHistory } from '../services/auditTruthService.js';
import { getUserMilestones, getNextMilestones } from '../services/milestoneService.js';
import { getToolUsageSummary } from '../services/toolCreditGate.js';

const router = Router();

// ── In-memory per-user caches ────────────────────────────────────────────────
interface CacheEntry<T = unknown> { data: T; ts: number; }

const featureStatusCache = new Map<string, CacheEntry>();
const notificationsCache = new Map<string, CacheEntry>();

const FEATURE_CACHE_TTL = 60_000; // 60 s
const NOTIF_CACHE_TTL = 8_000;   // 8 s

function readCache<T>(cache: Map<string, CacheEntry>, key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) { cache.delete(key); return null; }
  return entry.data as T;
}

function writeCache<T>(cache: Map<string, CacheEntry>, key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

/** Call after mutations that invalidate a user's cached data */
export function clearUserFeatureCaches(userId: string): void {
  featureStatusCache.delete(userId);
  notificationsCache.delete(userId);
}

function internalServerError(res: Response, fallback: string) {
  if (res.headersSent) return;
  return res.status(500).json({
    success: false,
    error: fallback,
    code: 'INTERNAL_ERROR',
  });
}

function hasNotificationAdminAccess(req: Request): boolean {
  const globalRole = String(req.user?.role || '').toLowerCase();
  const workspaceRole = String(req.workspace?.role || '').toLowerCase();
  return globalRole === 'admin' || workspaceRole === 'owner' || workspaceRole === 'admin';
}

function ensureNotificationAdmin(req: Request, res: Response): boolean {
  if (hasNotificationAdminAccess(req)) return true;
  res.status(403).json({ success: false, error: 'Admin or workspace owner/admin role is required' });
  return false;
}

// CORS preflight for notifications stream
router.options('/notifications/stream', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', String(req.headers.origin || '*'));
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.setHeader('Vary', 'Origin');
  res.status(204).end();
});

// SSE stream - must be before router.use(authRequired) because EventSource
// cannot send custom headers.  Auth is validated inline from query param.
router.get('/notifications/stream', async (req: Request, res: Response) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    res.setHeader('Access-Control-Allow-Origin', String(req.headers.origin || '*'));
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const decoded = verifyUserToken(token);
    const user = await getUserById(decoded.userId);
    if (!user) {
      res.setHeader('Access-Control-Allow-Origin', String(req.headers.origin || '*'));
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Prepare SSE headers - pass directly to writeHead to avoid conflicts
    const origin = String(req.headers.origin || '*');
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600',
      'Vary': 'Origin',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', /* CRITICAL: Disables Cloudflare buffering */
    };

    res.writeHead(200, headers);
    
    // Configure socket for streaming
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);

    // Initial SSE messages
    res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    res.write(`retry: 10000\n\n`);

    // Register client and cleanup handlers
    const removeClient = addClient(user.id, res);
    req.on('close', removeClient);
    req.on('error', removeClient);
  } catch {
    res.setHeader('Access-Control-Allow-Origin', String(req.headers.origin || '*'));
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
});

// All routes require auth
router.use(authRequired);
router.use(workspaceRequired);

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      const cached = readCache(featureStatusCache, userId, FEATURE_CACHE_TTL);
      if (cached) return res.json(cached);
    }

    const tier = uiTierFromCanonical((req.user?.tier as any) || 'observer');
    const limits = TIER_LIMITS[tier];
    const monthlyLimit = Number(limits.scansPerMonth || 0);
    const hasScheduledRescans = Boolean(limits.hasScheduledRescans);
    const hasApiAccess = Boolean(limits.hasApiAccess);
    const hasWebhookAccess = hasApiAccess;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const usagePromise = dbConfigured
      ? getPool().query(
        `SELECT COALESCE(SUM(requests), 0) AS total_requests
           FROM usage_daily
           WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [req.user!.id, monthStart, monthEnd]
      )
      : Promise.resolve({ rows: [{ total_requests: 0 }] } as { rows: Array<{ total_requests: number }> });

    const packCreditsPromise = dbConfigured
      ? getPool().query(
        `SELECT COALESCE(credits_remaining, 0) AS credits_remaining
           FROM scan_pack_credits
           WHERE user_id = $1
           LIMIT 1`,
        [req.user!.id]
      )
      : Promise.resolve({ rows: [{ credits_remaining: 0 }] } as { rows: Array<{ credits_remaining: number }> });

    const referralEarnedPromise = dbConfigured
      ? getPool().query(
        `SELECT COALESCE(SUM(credits_awarded_referrer), 0) AS total_earned
           FROM referral_attributions
           WHERE referrer_user_id = $1 AND status = 'granted'`,
        [req.user!.id]
      )
      : Promise.resolve({ rows: [{ total_earned: 0 }] } as { rows: Array<{ total_earned: number }> });

    const trialPromise = dbConfigured
      ? getPool().query(
        `SELECT trial_ends_at, trial_used FROM users WHERE id = $1`,
        [req.user!.id]
      )
      : Promise.resolve({ rows: [{ trial_ends_at: null, trial_used: false }] } as { rows: Array<{ trial_ends_at: string | null; trial_used: boolean }> });

    const [scheduledRescans, deployVerifications, apiKeys, webhooks, reportDeliveries, usageResult, packCreditsResult, referralEarnedResult, trialResult, unlockedMilestones, nextMilestones, toolUsage] = await Promise.all([
      hasScheduledRescans ? getScheduledRescans(req.user!.id, req.workspace!.id) : Promise.resolve([]),
      hasScheduledRescans ? listDeployVerificationJobs(req.user!.id, req.workspace!.id, 20) : Promise.resolve([]),
      hasApiAccess ? listApiKeys(req.user!.id, req.workspace!.id) : Promise.resolve([]),
      hasWebhookAccess ? listWebhooks(req.user!.id, req.workspace!.id) : Promise.resolve([]),
      hasWebhookAccess ? listReportDeliveries(req.user!.id, req.workspace!.id) : Promise.resolve([]),
      usagePromise,
      packCreditsPromise,
      referralEarnedPromise,
      trialPromise,
      dbConfigured ? getUserMilestones(req.user!.id).catch(() => []) : Promise.resolve([]),
      dbConfigured ? getNextMilestones(req.user!.id).catch(() => []) : Promise.resolve([]),
      dbConfigured ? getToolUsageSummary(req.user!.id, (req.user?.tier as string) || 'observer').catch(() => null) : Promise.resolve(null),
    ]);
    const unreadNotifications = await getUnreadNotificationCount(req.user!.id);

    const usedThisMonth = Math.max(0, Number(usageResult?.rows?.[0]?.total_requests || 0));
    const remainingThisMonth = Math.max(0, monthlyLimit - usedThisMonth);
    const packCreditsRemaining = Math.max(0, Number(packCreditsResult?.rows?.[0]?.credits_remaining || 0));
    const referralCreditsEarnedTotal = Math.max(0, Number(referralEarnedResult?.rows?.[0]?.total_earned || 0));
    const totalAuditCreditsAvailable = Math.max(0, remainingThisMonth + packCreditsRemaining);

    const trialEndsAt = trialResult?.rows?.[0]?.trial_ends_at ? new Date(trialResult.rows[0].trial_ends_at) : null;
    const trialUsed = Boolean(trialResult?.rows?.[0]?.trial_used);
    const trialActive = trialEndsAt !== null && trialEndsAt.getTime() > Date.now();
    const trialDaysRemaining = trialActive ? Math.max(0, Math.ceil((trialEndsAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

    const responsePayload = {
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        tier,
        capabilities: {
          pagesPerScan: Number(limits.pagesPerScan || 0),
          competitors: Number(limits.competitors || 0),
          hasExports: Boolean(limits.hasExports),
          hasReportHistory: Boolean(limits.hasReportHistory),
          hasApiAccess: Boolean(limits.hasApiAccess),
          hasScheduledRescans: Boolean(limits.hasScheduledRescans),
          hasShareableLink: Boolean(limits.hasShareableLink),
        },
        usage: {
          monthlyLimit,
          usedThisMonth,
          remainingThisMonth,
        },
        credits: {
          packCreditsRemaining,
          referralCreditsEarnedTotal,
          totalAuditCreditsAvailable,
        },
        trial: {
          active: trialActive,
          endsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
          daysRemaining: trialDaysRemaining,
          used: trialUsed,
        },
        features: {
          notifications: {
            unreadCount: unreadNotifications,
          },
          scheduledRescans: {
            available: hasScheduledRescans,
            count: scheduledRescans.length,
            max: limits.maxScheduledRescans,
            allowedFrequencies: limits.allowedRescanFrequencies,
          },
          deployVerifications: {
            available: hasScheduledRescans,
            count: deployVerifications.length,
          },
          apiAccess: {
            available: hasApiAccess,
            keyCount: apiKeys.length,
            maxKeys: limits.maxApiKeys,
          },
          webhooks: {
            available: hasWebhookAccess,
            count: webhooks.length,
            max: limits.maxWebhooks,
          },
          reportDeliveries: {
            available: hasWebhookAccess,
            count: reportDeliveries.length,
            max: limits.maxReportDeliveries,
          },
        },
        milestones: {
          unlocked: unlockedMilestones,
          next: nextMilestones.map((m: any) => ({ key: m.key, label: m.label, description: m.description, creditReward: m.creditReward, icon: m.icon })),
          totalCreditsEarned: unlockedMilestones.reduce((sum: number, m: any) => sum + (m.creditsAwarded || 0), 0),
        },
        toolUsage: toolUsage || undefined,
      },
    };

    if (userId) writeCache(featureStatusCache, userId, responsePayload);
    res.json(responsePayload);
  } catch (err: any) {
    internalServerError(res, 'Failed to load feature status');
  }
});

router.get('/private-exposure-scan/packaging', async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      tiers: PRIVATE_EXPOSURE_SCAN_PACKAGING,
    },
  });
});

router.post('/private-exposure-scan', async (req: Request, res: Response) => {
  try {
    const userTier = (req.user?.tier || 'observer') as any;
    if (!meetsMinimumTier(userTier, 'alignment')) {
      return res.status(403).json({
        success: false,
        error: 'Private Exposure Scan requires an Alignment, Signal, or scorefix plan.',
        code: 'TIER_INSUFFICIENT',
        requiredTier: 'alignment',
      });
    }

    const ownershipAsserted = req.body?.ownership_asserted === true;
    if (!ownershipAsserted) {
      return res.status(400).json({
        success: false,
        error: 'ownership_asserted must be true for this defensive scan.',
        code: 'OWNERSHIP_ASSERTION_REQUIRED',
      });
    }

    const targetUrl = String(req.body?.target_url || '').trim();
    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        error: 'target_url is required',
        code: 'TARGET_URL_REQUIRED',
      });
    }

    const report = await runPrivateExposureScan({
      targetUrl,
      targetType: req.body?.target_type,
      targetLabel: req.body?.target_label,
      ownershipAsserted,
      authenticatedContextProvided: req.body?.authenticated_context_provided === true,
    });

    return res.json({
      success: true,
      data: report,
    });
  } catch {
    return internalServerError(res, 'Failed to run private exposure scan');
  }
});

router.get('/truth-history', async (req: Request, res: Response) => {
  try {
    const url = String(req.query?.url || '').trim();
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 25)));
    if (!url) {
      return res.status(400).json({ success: false, error: 'url query parameter is required' });
    }

    const normalized = normalizePublicHttpUrl(url);
    if (!normalized.ok) {
      return res.status(400).json({ success: false, error: normalized.error });
    }

    const history = await listAuditTruthHistory(req.user!.id, req.workspace!.id, normalized.url, limit);
    return res.json({ success: true, data: history });
  } catch (err: any) {
    return internalServerError(res, 'Failed to load truth history');
  }
});

router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      const cached = readCache<{ unreadCount: number; notifications: unknown[] }>(notificationsCache, userId, NOTIF_CACHE_TTL);
      if (cached) return res.json({ success: true, data: cached });
    }

    const limit = Number(req.query?.limit || 25);
    const notifications = await listNotificationsForUser(req.user!.id, limit);
    const unreadCount = await getUnreadNotificationCount(req.user!.id);

    const payload = { unreadCount, notifications };
    if (userId) writeCache(notificationsCache, userId, payload);

    return res.json({ success: true, data: payload });
  } catch (err: any) {
    return internalServerError(res, 'Failed to load notifications');
  }
});

router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'Notification id is required' });

    const updated = await markNotificationReadForUser(req.user!.id, id);
    if (!updated) return res.status(404).json({ success: false, error: 'Notification not found' });

    notificationsCache.delete(req.user!.id);
    const unreadCount = await getUnreadNotificationCount(req.user!.id);
    return res.json({ success: true, data: { unreadCount } });
  } catch (err: any) {
    return internalServerError(res, 'Failed to update notification');
  }
});

router.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const updated = await markAllNotificationsReadForUser(req.user!.id);
    notificationsCache.delete(req.user!.id);
    return res.json({ success: true, data: { updated, unreadCount: 0 } });
  } catch (err: any) {
    return internalServerError(res, 'Failed to update notifications');
  }
});

// ── Notification Preferences ────────────────────────────────────────────────

router.get('/notifications/preferences', async (req: Request, res: Response) => {
  try {
    const prefs = await getNotificationPreferences(req.user!.id);
    return res.json({
      success: true,
      data: {
        preferences: prefs,
        categories: NOTIFICATION_CATEGORIES,
      },
    });
  } catch (err: any) {
    return internalServerError(res, 'Failed to load notification preferences');
  }
});

router.put('/notifications/preferences', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const updates: Record<string, unknown> = {};

    if (typeof body.emailNotifications === 'boolean') updates.emailNotifications = body.emailNotifications;
    if (typeof body.inAppEnabled === 'boolean') updates.inAppEnabled = body.inAppEnabled;
    if (typeof body.soundEnabled === 'boolean') updates.soundEnabled = body.soundEnabled;
    if (typeof body.browserEnabled === 'boolean') updates.browserEnabled = body.browserEnabled;
    if (Array.isArray(body.mutedCategories)) updates.mutedCategories = body.mutedCategories;

    const saved = await upsertNotificationPreferences(req.user!.id, updates as any);
    return res.json({ success: true, data: saved });
  } catch (err: any) {
    return internalServerError(res, 'Failed to save notification preferences');
  }
});

router.post('/admin/notifications/publish', async (req: Request, res: Response) => {
  try {
    if (!ensureNotificationAdmin(req, res)) return;

    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const eventType = String(req.body?.eventType || 'platform_event').trim();
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object'
      ? req.body.metadata as Record<string, unknown>
      : undefined;

    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'title and message are required' });
    }

    const item = await publishPlatformNotificationImmediate({
      createdByUserId: req.user!.id,
      title,
      message,
      eventType,
      metadata: {
        ...(metadata || {}),
        workspaceId: req.workspace?.id,
        organizationId: req.organization?.id,
      },
    });

    return res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    return internalServerError(res, 'Failed to publish notification');
  }
});

router.post('/admin/notifications/schedule', async (req: Request, res: Response) => {
  try {
    if (!ensureNotificationAdmin(req, res)) return;

    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const eventType = String(req.body?.eventType || 'platform_event').trim();
    const scheduledFor = String(req.body?.scheduledFor || '').trim();
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object'
      ? req.body.metadata as Record<string, unknown>
      : undefined;

    if (!title || !message || !scheduledFor) {
      return res.status(400).json({ success: false, error: 'title, message, and scheduledFor are required' });
    }

    const item = await schedulePlatformNotification({
      createdByUserId: req.user!.id,
      title,
      message,
      eventType,
      scheduledFor,
      metadata: {
        ...(metadata || {}),
        workspaceId: req.workspace?.id,
        organizationId: req.organization?.id,
      },
    });

    return res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to schedule notification');
    const status = /required|valid/i.test(message) ? 400 : 500;
    if (status === 500) return internalServerError(res, 'Failed to schedule notification');
    return res.status(status).json({ success: false, error: message });
  }
});

router.get('/admin/notifications/scheduled', async (req: Request, res: Response) => {
  try {
    if (!ensureNotificationAdmin(req, res)) return;

    const status = String(req.query?.status || 'all').toLowerCase() as 'pending' | 'published' | 'cancelled' | 'failed' | 'all';
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 50)));

    const items = await listScheduledPlatformNotifications({ status, limit });
    return res.json({ success: true, data: items });
  } catch (err: any) {
    return internalServerError(res, 'Failed to list scheduled notifications');
  }
});

router.post('/admin/notifications/scheduled/:id/publish-now', async (req: Request, res: Response) => {
  try {
    if (!ensureNotificationAdmin(req, res)) return;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'Notification id is required' });

    const ok = await publishScheduledPlatformNotificationNow(id, req.user!.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Scheduled notification not found' });

    return res.json({ success: true });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to publish scheduled notification');
    const status = /cancelled/i.test(message) ? 409 : 500;
    if (status === 500) return internalServerError(res, 'Failed to publish scheduled notification');
    return res.status(status).json({ success: false, error: message });
  }
});

router.post('/admin/notifications/scheduled/:id/cancel', async (req: Request, res: Response) => {
  try {
    if (!ensureNotificationAdmin(req, res)) return;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'Notification id is required' });

    const ok = await cancelScheduledPlatformNotification(id);
    if (!ok) return res.status(404).json({ success: false, error: 'Pending scheduled notification not found' });

    return res.json({ success: true });
  } catch (err: any) {
    return internalServerError(res, 'Failed to cancel scheduled notification');
  }
});

router.get('/credits/ledger', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 100)));
    const format = String(req.query?.format || 'json').toLowerCase();
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, delta_credits, balance_after, reason, metadata, created_at
       FROM credit_usage_ledger
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user!.id, limit]
    );

    if (format === 'csv') {
      const csvEscape = (value: unknown): string => {
        const raw = value == null ? '' : String(value);
        return `"${raw.replace(/"/g, '""')}"`;
      };

      const header = ['id', 'created_at', 'delta_credits', 'balance_after', 'reason', 'metadata'];
      const lines = [header.join(',')];

      for (const row of rows) {
        lines.push([
          csvEscape(row.id),
          csvEscape(row.created_at),
          csvEscape(row.delta_credits),
          csvEscape(row.balance_after),
          csvEscape(row.reason),
          csvEscape(row.metadata ? JSON.stringify(row.metadata) : ''),
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="credit-usage-ledger-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(lines.join('\n'));
    }

    return res.json({
      success: true,
      data: {
        entries: rows,
      },
    });
  } catch (err: any) {
    return internalServerError(res, 'Failed to load credit ledger');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED RESCANS (Alignment+)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/scheduled-rescans', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const rescans = await getScheduledRescans(req.user!.id, req.workspace!.id);
    res.json({ success: true, data: rescans });
  } catch (err: any) {
    internalServerError(res, 'Failed to list scheduled rescans');
  }
});

router.post('/scheduled-rescans', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const { url, frequency } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const normalizedUrl = normalizePublicHttpUrl(String(url));
    if (!normalizedUrl.ok) {
      return res.status(400).json({ success: false, error: normalizedUrl.error });
    }

    const tier = uiTierFromCanonical((req.user?.tier as any) || 'observer');
    const limits = TIER_LIMITS[tier];
    const allowedFreqs = limits.allowedRescanFrequencies as readonly string[];
    const effectiveFreq = frequency || allowedFreqs[0] || 'weekly';

    if (!allowedFreqs.includes(effectiveFreq)) {
      return res.status(400).json({ success: false, error: `Your plan allows: ${allowedFreqs.join(', ')}` });
    }

    // Enforce per-tier schedule cap
    const existing = await getScheduledRescans(req.user!.id, req.workspace!.id);
    if (existing.length >= limits.maxScheduledRescans) {
      return res.status(400).json({ success: false, error: `Maximum ${limits.maxScheduledRescans} scheduled rescans on your plan` });
    }

    const rescan = await createScheduledRescan(req.user!.id, req.workspace!.id, normalizedUrl.url, effectiveFreq);
    res.status(201).json({ success: true, data: rescan });
  } catch (err: any) {
    internalServerError(res, 'Failed to create scheduled rescan');
  }
});

router.patch('/scheduled-rescans/:id', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const { frequency, enabled } = req.body;
    const updated = await updateScheduledRescan(String(req.params.id), req.user!.id, req.workspace!.id, { frequency, enabled });
    if (!updated) return res.status(404).json({ success: false, error: 'Schedule not found' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    internalServerError(res, 'Failed to update scheduled rescan');
  }
});

router.delete('/scheduled-rescans/:id', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const deleted = await deleteScheduledRescan(String(req.params.id), req.user!.id, req.workspace!.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Schedule not found' });
    res.json({ success: true });
  } catch (err: any) {
    internalServerError(res, 'Failed to delete scheduled rescan');
  }
});

router.get('/deploy-verifications', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 50)));
    const jobs = await listDeployVerificationJobs(req.user!.id, req.workspace!.id, limit);
    return res.json({ success: true, data: jobs });
  } catch (err: any) {
    return internalServerError(res, 'Failed to list deploy verifications');
  }
});

router.post('/deploy-verifications', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ success: false, error: 'url is required' });
    }

    const normalized = normalizePublicHttpUrl(rawUrl);
    if (!normalized.ok) {
      return res.status(400).json({ success: false, error: normalized.error });
    }

    const job = await createDeployVerificationJob({
      userId: req.user!.id,
      workspaceId: req.workspace!.id,
      url: normalized.url,
      scheduledFor: typeof req.body?.scheduledFor === 'string' ? req.body.scheduledFor : null,
      source: typeof req.body?.source === 'string' ? req.body.source : 'manual_deploy_verification',
      provider: typeof req.body?.provider === 'string' ? req.body.provider : null,
      environment: typeof req.body?.environment === 'string' ? req.body.environment : null,
      deploymentId: typeof req.body?.deploymentId === 'string' ? req.body.deploymentId : null,
      commitSha: typeof req.body?.commitSha === 'string' ? req.body.commitSha : null,
      baselineAuditId: typeof req.body?.baselineAuditId === 'string' ? req.body.baselineAuditId : null,
      triggerMetadata: req.body?.triggerMetadata && typeof req.body.triggerMetadata === 'object'
        ? req.body.triggerMetadata as Record<string, unknown>
        : undefined,
    });

    return res.status(201).json({ success: true, data: job });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to create deploy verification');
    const status = /required|valid/i.test(message) ? 400 : 500;
    if (status === 500) return internalServerError(res, 'Failed to create deploy verification');
    return res.status(status).json({ success: false, error: message });
  }
});

router.post('/deploy-verifications/:id/run-now', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const updated = await updateDeployVerificationJob(
      String(req.params.id || ''),
      req.user!.id,
      req.workspace!.id,
      { scheduledFor: new Date().toISOString(), status: 'pending' }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Deploy verification not found' });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return internalServerError(res, 'Failed to schedule deploy verification');
  }
});

router.post('/deploy-verifications/:id/cancel', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const updated = await updateDeployVerificationJob(
      String(req.params.id || ''),
      req.user!.id,
      req.workspace!.id,
      { status: 'cancelled' }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Deploy verification not found' });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return internalServerError(res, 'Failed to cancel deploy verification');
  }
});

router.get('/deploy-hooks', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const hooks = await listDeployHookEndpoints(req.user!.id, req.workspace!.id);
    return res.json({ success: true, data: hooks });
  } catch {
    return internalServerError(res, 'Failed to list deploy hooks');
  }
});

router.post('/deploy-hooks', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    const created = await createDeployHookEndpoint({
      userId: req.user!.id,
      workspaceId: req.workspace!.id,
      name,
      provider: req.body?.provider,
      defaultUrl: typeof req.body?.defaultUrl === 'string' ? req.body.defaultUrl : null,
    });
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: String(err?.message || 'Failed to create deploy hook') });
  }
});

router.patch('/deploy-hooks/:id', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const updated = await updateDeployHookEndpoint(String(req.params.id || ''), req.user!.id, req.workspace!.id, {
      enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
      defaultUrl: typeof req.body?.defaultUrl !== 'undefined' ? String(req.body.defaultUrl || '') : undefined,
      name: typeof req.body?.name === 'string' ? req.body.name : undefined,
      provider: typeof req.body?.provider !== 'undefined' ? req.body.provider : undefined,
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Deploy hook not found' });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: String(err?.message || 'Failed to update deploy hook') });
  }
});

router.delete('/deploy-hooks/:id', enforceFeature('rescan'), async (req: Request, res: Response) => {
  try {
    const deleted = await deleteDeployHookEndpoint(String(req.params.id || ''), req.user!.id, req.workspace!.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Deploy hook not found' });
    return res.json({ success: true });
  } catch {
    return internalServerError(res, 'Failed to delete deploy hook');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API KEYS (Alignment+)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/api-keys', enforceFeature('api'), async (req: Request, res: Response) => {
  try {
    const keys = await listApiKeys(req.user!.id, req.workspace!.id);
    res.json({ success: true, data: keys });
  } catch (err: any) {
    internalServerError(res, 'Failed to list API keys');
  }
});

router.post('/api-keys', enforceFeature('api'), async (req: Request, res: Response) => {
  try {
    const { name, scopes } = req.body;
    const key = await createApiKey(req.user!.id, req.workspace!.id, name || 'Default', scopes, req.user?.tier || 'observer');
    res.status(201).json({ success: true, data: key });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to create API key');
    const status = /Maximum|Invalid API key scope|name/i.test(message) ? 400 : 500;
    if (status === 500) return internalServerError(res, 'Failed to create API key');
    res.status(status).json({ success: false, error: message });
  }
});

router.patch('/api-keys/:id', enforceFeature('api'), async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, error: 'enabled (boolean) is required' });
    const updated = await toggleApiKey(String(req.params.id), req.user!.id, req.workspace!.id, enabled);
    if (!updated) return res.status(404).json({ success: false, error: 'API key not found' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    internalServerError(res, 'Failed to update API key');
  }
});

router.delete('/api-keys/:id', enforceFeature('api'), async (req: Request, res: Response) => {
  try {
    const deleted = await revokeApiKey(String(req.params.id), req.user!.id, req.workspace!.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'API key not found' });
    res.json({ success: true });
  } catch (err: any) {
    internalServerError(res, 'Failed to delete API key');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS (Alignment+)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/webhooks', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const hooks = await listWebhooks(req.user!.id, req.workspace!.id);
    res.json({ success: true, data: hooks });
  } catch (err: any) {
    internalServerError(res, 'Failed to list webhooks');
  }
});

router.get('/webhooks/catalog', enforceFeature('webhook'), async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: getWebhookIntegrationCatalog() });
  } catch (err: any) {
    return internalServerError(res, 'Failed to load webhook catalog');
  }
});

router.post('/webhooks', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const { url, events, provider, displayName } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const hook = await createWebhook(req.user!.id, req.workspace!.id, url, events, { provider, displayName }, req.user?.tier || 'observer');
    res.status(201).json({ success: true, data: hook });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to create webhook');
    const status = /Maximum|Invalid|Private|localhost|HTTPS|Slack|Discord|Zapier/i.test(message) ? 400 : 500;
    if (status === 500) return internalServerError(res, 'Failed to create webhook');
    res.status(status).json({ success: false, error: message });
  }
});

router.patch('/webhooks/:id', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const { enabled, url, events, provider, displayName } = req.body;
    if (
      typeof enabled === 'undefined' &&
      typeof url === 'undefined' &&
      typeof events === 'undefined' &&
      typeof provider === 'undefined' &&
      typeof displayName === 'undefined'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Provide at least one field: enabled, url, events, provider, displayName',
      });
    }

    const updated =
      typeof url !== 'undefined' || typeof events !== 'undefined' || typeof provider !== 'undefined' || typeof displayName !== 'undefined'
        ? await updateWebhook(String(req.params.id), req.user!.id, req.workspace!.id, {
          enabled,
          url,
          events,
          provider,
          displayName,
        })
        : await toggleWebhook(String(req.params.id), req.user!.id, req.workspace!.id, Boolean(enabled));

    if (!updated) return res.status(404).json({ success: false, error: 'Webhook not found' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to update webhook');
    const status = /Invalid|Private|localhost|HTTPS|Slack|Discord|Zapier/i.test(message) ? 400 : 500;
    if (status === 500) return internalServerError(res, 'Failed to update webhook');
    res.status(status).json({ success: false, error: message });
  }
});

router.delete('/webhooks/:id', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const deleted = await deleteWebhook(String(req.params.id), req.user!.id, req.workspace!.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Webhook not found' });
    res.json({ success: true });
  } catch (err: any) {
    internalServerError(res, 'Failed to delete webhook');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATIC REPORT DELIVERY (Alignment+)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/report-deliveries', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const deliveries = await listReportDeliveries(req.user!.id, req.workspace!.id);
    return res.json({ success: true, data: deliveries });
  } catch {
    return internalServerError(res, 'Failed to list report deliveries');
  }
});

router.post('/report-deliveries', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const delivery = await createReportDelivery(req.user!.id, req.workspace!.id, {
      provider: req.body?.provider,
      target: req.body?.target,
      displayName: req.body?.displayName,
      branded: req.body?.branded,
      includePdf: req.body?.includePdf,
      includeShareLink: req.body?.includeShareLink,
    }, req.user?.tier || 'observer');
    return res.status(201).json({ success: true, data: delivery });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to create report delivery');
    const status = /Invalid|Maximum|required|HTTPS|Slack|Discord|Zapier|email|localhost|Private/i.test(message) ? 400 : 500;
    if (status === 500) return internalServerError(res, 'Failed to create report delivery');
    return res.status(status).json({ success: false, error: message });
  }
});

router.patch('/report-deliveries/:id', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const updated = await updateReportDelivery(String(req.params.id), req.user!.id, req.workspace!.id, {
      displayName: req.body?.displayName,
      target: req.body?.target,
      branded: req.body?.branded,
      includePdf: req.body?.includePdf,
      includeShareLink: req.body?.includeShareLink,
      enabled: req.body?.enabled,
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Report delivery target not found' });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to update report delivery');
    const status = /Invalid|required|HTTPS|Slack|Discord|Zapier|email|localhost|Private/i.test(message) ? 400 : 500;
    if (status === 500) return internalServerError(res, 'Failed to update report delivery');
    return res.status(status).json({ success: false, error: message });
  }
});

router.delete('/report-deliveries/:id', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const deleted = await deleteReportDelivery(String(req.params.id), req.user!.id, req.workspace!.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Report delivery target not found' });
    return res.json({ success: true });
  } catch {
    return internalServerError(res, 'Failed to delete report delivery');
  }
});

router.post('/webhooks/:id/test', enforceFeature('webhook'), async (req: Request, res: Response) => {
  try {
    const event = String(req.body?.event || 'audit.completed') as any;
    const result = await testWebhook(String(req.params.id), req.user!.id, req.workspace!.id, event);
    if (!result.ok) {
      const status = result.message === 'Webhook not found' ? 404 : 400;
      return res.status(status).json({ success: false, error: result.message, statusCode: result.status });
    }
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return internalServerError(res, 'Failed to test webhook');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS EVENTS (Signal-tier API access)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/analytics/measurement-event', enforceFeature('api'), async (req: Request, res: Response) => {
  try {
    if (!isGoogleMeasurementConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'GA4 Measurement Protocol is not configured on server',
      });
    }

    const eventName = String(req.body?.eventName || '').trim();
    const eventParams = req.body?.eventParams;
    const providedClientId = String(req.body?.clientId || '').trim();

    if (!eventName) {
      return res.status(400).json({ success: false, error: 'eventName is required' });
    }

    if (!isValidMeasurementEventName(eventName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid eventName. Use letters, numbers, and underscores (max 40 chars).',
      });
    }

    const fallbackClientId = `${req.user!.id}.${Date.now()}`;
    const clientId = providedClientId || fallbackClientId;

    const result = await sendMeasurementEvent({
      eventName,
      clientId,
      userId: req.user!.id,
      params: eventParams,
    });

    if (!result.ok) {
      return res.status(result.status || 502).json({
        success: false,
        error: result.error || 'Failed to send event to GA4',
      });
    }

    return res.status(202).json({
      success: true,
      data: {
        accepted: true,
        eventName,
      },
    });
  } catch (err: any) {
    return internalServerError(res, 'Failed to send analytics event');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BRANDING / WHITE-LABEL (Signal-tier)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/branding', enforceFeature('whiteLabel'), async (req: Request, res: Response) => {
  try {
    const branding = await getBranding(req.user!.id, req.workspace!.id);
    res.json({ success: true, data: branding });
  } catch (err: any) {
    internalServerError(res, 'Failed to load branding');
  }
});

router.put('/branding', enforceFeature('whiteLabel'), async (req: Request, res: Response) => {
  try {
    const { company_name, logo_url, logo_base64, primary_color, accent_color, footer_text, tagline, contact_email, website_url, show_cover_page } = req.body;
    const branding = await upsertBranding(req.user!.id, req.workspace!.id, {
      company_name,
      logo_url,
      logo_base64,
      primary_color,
      accent_color,
      footer_text,
      tagline,
      contact_email,
      website_url,
      show_cover_page,
    });
    res.json({ success: true, data: branding });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to update branding');
    const status = message.includes('under') || message.includes('Invalid') ? 400 : 500;
    if (status === 500) return internalServerError(res, 'Failed to update branding');
    res.status(status).json({ success: false, error: message });
  }
});

router.delete('/branding', enforceFeature('whiteLabel'), async (req: Request, res: Response) => {
  try {
    await deleteBranding(req.user!.id, req.workspace!.id);
    res.json({ success: true });
  } catch (err: any) {
    internalServerError(res, 'Failed to delete branding');
  }
});

router.post('/exports/report-pdf-session', enforceFeature('export'), async (req: Request, res: Response) => {
  try {
    const branded = Boolean(req.body?.branded);
    if (!branded) {
      return res.json({
        success: true,
        data: {
          branded: false,
          creditsCharged: 0,
        },
      });
    }

    const tier = uiTierFromCanonical((req.user?.tier as any) || 'observer');
    if (!TIER_LIMITS[tier].hasWhiteLabel) {
      return res.status(403).json({ success: false, error: 'Branded PDF export requires Signal or Score Fix.' });
    }

    const branding = await getBranding(req.user!.id, req.workspace!.id);
    if (!branding) {
      return res.status(400).json({ success: false, error: 'Set up white-label branding before exporting a branded PDF.' });
    }

    const requiredCredits = 1;
    const available = await getAvailablePackCredits(req.user!.id);
    if (available < requiredCredits) {
      return res.status(402).json({
        success: false,
        error: `Branded PDF export requires ${requiredCredits.toFixed(2)} credits. Available: ${available.toFixed(2)}.`,
        code: 'INSUFFICIENT_PACK_CREDITS',
        requiredCredits,
        availableCredits: available,
      });
    }

    const charge = await consumePackCredits(req.user!.id, requiredCredits, 'branded_pdf_export', {
      workspaceId: req.workspace!.id,
      branded: true,
    });

    if (!charge.consumed) {
      return res.status(402).json({
        success: false,
        error: 'Branded PDF export credits were no longer available. Refresh your balance and retry.',
        code: 'INSUFFICIENT_PACK_CREDITS',
      });
    }

    return res.json({
      success: true,
      data: {
        branded: true,
        creditsCharged: requiredCredits,
        creditsRemaining: charge.remaining,
        branding,
      },
    });
  } catch (err: any) {
    return internalServerError(res, 'Failed to prepare PDF export');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PDF EXPORT - server-side Puppeteer rendering (real .pdf file download)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/exports/generate-pdf', enforceFeature('export'), async (req: Request, res: Response) => {
  const { html, branded } = req.body as { html?: string; branded?: boolean };

  if (!html || typeof html !== 'string' || html.trim().length < 100) {
    return res.status(400).json({ success: false, error: 'html is required' });
  }

  // Gate branded exports to Signal/scorefix and deduct credit (same as pdf-session)
  if (branded) {
    const tier = uiTierFromCanonical((req.user?.tier as any) || 'observer');
    if (!TIER_LIMITS[tier].hasWhiteLabel) {
      return res.status(403).json({ success: false, error: 'Branded PDF export requires Signal or Score Fix.' });
    }
    const branding = await getBranding(req.user!.id, req.workspace!.id);
    if (!branding) {
      return res.status(400).json({ success: false, error: 'Set up white-label branding before exporting a branded PDF.' });
    }
    const available = await getAvailablePackCredits(req.user!.id);
    if (available < 1) {
      return res.status(402).json({ success: false, error: 'Insufficient pack credits for branded PDF export.', code: 'INSUFFICIENT_PACK_CREDITS' });
    }
    const charge = await consumePackCredits(req.user!.id, 1, 'branded_pdf_export', { workspaceId: req.workspace!.id });
    if (!charge.consumed) {
      return res.status(402).json({ success: false, error: 'Credits were no longer available. Refresh and retry.', code: 'INSUFFICIENT_PACK_CREDITS' });
    }
  }

  try {
    const pdf = await renderPdfFromHtml(html);

    const slug = (req.user?.id ?? 'report').slice(0, 8);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="aivis-report-${slug}-${date}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.send(pdf);
  } catch (err: any) {
    console.error('[PDF Export] Puppeteer failed:', err?.message);
    return res.status(500).json({ success: false, error: 'PDF generation failed. Please try again.' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// NICHE URL DISCOVERY (Alignment+)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/features/niche-discovery
 * Body: { query: string, location: string }
 * Discovers real business URLs via AI for a given niche + geographic area,
 * validates each URL via HTTP, flags duplicates.
 */
router.post('/niche-discovery', enforceFeature('nicheDiscovery'), async (req: Request, res: Response) => {
  try {
    const query = String(req.body?.query || '').trim();
    const location = String(req.body?.location || '').trim();

    if (!query) {
      return res.status(400).json({ success: false, error: 'A niche or industry query is required' });
    }
    if (query.length > 200 || location.length > 200) {
      return res.status(400).json({ success: false, error: 'Query and location must be under 200 characters' });
    }

    const job = await runDiscovery(req.user!.id, req.workspace!.id, query, location);

    if (job.status === 'failed') {
      return res.status(422).json({
        success: false,
        error: job.error || 'No business URLs found. Try broadening the niche or simplifying the location.',
        job,
      });
    }

    return res.json({ success: true, job });
  } catch (err: any) {
    console.error('[NicheDiscovery] Error:', err?.message);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Niche discovery failed',
    });
  }
});

/**
 * GET /api/features/niche-discovery
 * Returns past discovery jobs for the current user/workspace.
 */
router.get('/niche-discovery', enforceFeature('nicheDiscovery'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query?.limit || 20)));
    const jobs = await listJobs(req.user!.id, req.workspace!.id, limit);
    return res.json({ success: true, jobs });
  } catch (err: any) {
    return internalServerError(res, 'Failed to list discovery jobs');
  }
});

/**
 * GET /api/features/niche-discovery/:id
 * Returns a single discovery job by ID.
 */
router.get('/niche-discovery/:id', enforceFeature('nicheDiscovery'), async (req: Request, res: Response) => {
  try {
    const job = await getJob(String(req.params.id), req.user!.id);
    if (!job) return res.status(404).json({ success: false, error: 'Discovery job not found' });
    return res.json({ success: true, job });
  } catch (err: any) {
    return internalServerError(res, 'Failed to load discovery job');
  }
});

/**
 * POST /api/features/niche-discovery/:id/schedule
 * Body: { urls: string[], frequency?: string }
 * Adds selected validated URLs from a discovery job to scheduled rescans.
 */
router.post('/niche-discovery/:id/schedule', enforceFeature('nicheDiscovery'), async (req: Request, res: Response) => {
  try {
    const urls = req.body?.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one URL is required' });
    }
    if (urls.length > 50) {
      return res.status(400).json({ success: false, error: 'Cannot schedule more than 50 URLs at once' });
    }

    const frequency = String(req.body?.frequency || 'weekly').trim();
    const result = await addDiscoveredToSchedule(
      req.user!.id,
      req.workspace!.id,
      String(req.params.id),
      urls.map(String),
      frequency,
    );

    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[NicheDiscovery] Schedule error:', err?.message);
    if (err.message.includes('not found') || err.message.includes('not completed') || err.message.includes('not available')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    return internalServerError(res, 'Failed to schedule discovered URLs');
  }
});

export default router;
