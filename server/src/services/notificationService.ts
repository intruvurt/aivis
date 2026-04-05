import { getPool } from './postgresql.js';
import { pushToUser, pushToAll } from './sseHub.js';

type NotificationScope = 'user' | 'platform';

export type NotificationEventType =
  | 'scheduled_rescan_completed'
  | 'scheduled_rescan_failed'
  | 'scheduled_rescan_skipped'
  | 'credit_spent'
  | 'credit_added'
  | 'platform_event';

export type NotificationCategory =
  | 'scan_results'
  | 'billing'
  | 'account'
  | 'platform';

/** Maps event_type strings to notification categories for preference filtering. */
const EVENT_CATEGORY_MAP: Record<string, NotificationCategory> = {
  scheduled_rescan_completed: 'scan_results',
  scheduled_rescan_failed: 'scan_results',
  scheduled_rescan_skipped: 'scan_results',
  auto_score_fix_rescan_completed: 'scan_results',
  auto_score_fix_rescan_failed: 'scan_results',
  auto_score_fix_rescan_scheduled: 'scan_results',
  deploy_verification_completed: 'scan_results',
  deploy_verification_failed: 'scan_results',
  agent_task_completed: 'scan_results',
  credit_spent: 'billing',
  credit_added: 'billing',
  plan_upgraded: 'billing',
  plan_downgraded: 'billing',
  plan_canceled: 'billing',
  trial_started: 'account',
  trial_converted: 'account',
  trial_expired: 'account',
  platform_event: 'platform',
};

export function eventToCategory(eventType: string): NotificationCategory {
  return EVENT_CATEGORY_MAP[eventType] ?? 'account';
}

export const NOTIFICATION_CATEGORIES: { key: NotificationCategory; label: string; description: string }[] = [
  { key: 'scan_results', label: 'Scan Results', description: 'Scheduled rescans, deploy verifications, and score fix results' },
  { key: 'billing', label: 'Billing & Credits', description: 'Credit spend/add, plan upgrades, downgrades, and cancellations' },
  { key: 'account', label: 'Account & Trials', description: 'Trial start, conversion, expiration, and account events' },
  { key: 'platform', label: 'Platform Announcements', description: 'Product updates and team broadcasts' },
];

export type NotificationPreferences = {
  emailNotifications: boolean;
  inAppEnabled: boolean;
  soundEnabled: boolean;
  browserEnabled: boolean;
  mutedCategories: NotificationCategory[];
  shareLinkExpirationDays: number;
};

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT email_notifications, in_app_enabled, sound_enabled, browser_enabled, muted_categories, share_link_expiration_days
     FROM user_notification_preferences WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (!rows[0]) {
    return {
      emailNotifications: true,
      inAppEnabled: true,
      soundEnabled: true,
      browserEnabled: false,
      mutedCategories: [],
      shareLinkExpirationDays: 30,
    };
  }
  const r = rows[0];
  return {
    emailNotifications: r.email_notifications !== false,
    inAppEnabled: r.in_app_enabled !== false,
    soundEnabled: r.sound_enabled !== false,
    browserEnabled: r.browser_enabled === true,
    mutedCategories: Array.isArray(r.muted_categories) ? r.muted_categories : [],
    shareLinkExpirationDays: typeof r.share_link_expiration_days === 'number' ? r.share_link_expiration_days : 30,
  };
}

export async function upsertNotificationPreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, 'shareLinkExpirationDays'>>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);

  const emailNotifications = typeof updates.emailNotifications === 'boolean' ? updates.emailNotifications : current.emailNotifications;
  const inAppEnabled = typeof updates.inAppEnabled === 'boolean' ? updates.inAppEnabled : current.inAppEnabled;
  const soundEnabled = typeof updates.soundEnabled === 'boolean' ? updates.soundEnabled : current.soundEnabled;
  const browserEnabled = typeof updates.browserEnabled === 'boolean' ? updates.browserEnabled : current.browserEnabled;

  const validCategories = new Set<NotificationCategory>(['scan_results', 'billing', 'account', 'platform']);
  const mutedCategories = Array.isArray(updates.mutedCategories)
    ? updates.mutedCategories.filter((c) => validCategories.has(c))
    : current.mutedCategories;

  const pool = getPool();
  await pool.query(
    `INSERT INTO user_notification_preferences
       (user_id, email_notifications, in_app_enabled, sound_enabled, browser_enabled, muted_categories, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       email_notifications = EXCLUDED.email_notifications,
       in_app_enabled = EXCLUDED.in_app_enabled,
       sound_enabled = EXCLUDED.sound_enabled,
       browser_enabled = EXCLUDED.browser_enabled,
       muted_categories = EXCLUDED.muted_categories,
       updated_at = NOW()`,
    [userId, emailNotifications, inAppEnabled, soundEnabled, browserEnabled, mutedCategories],
  );

  return { emailNotifications, inAppEnabled, soundEnabled, browserEnabled, mutedCategories, shareLinkExpirationDays: current.shareLinkExpirationDays };
}

/** Check whether in-app notification should be created for a user given their preferences. */
async function shouldCreateNotification(userId: string, eventType: string): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.inAppEnabled) return false;
  const category = eventToCategory(eventType);
  if (prefs.mutedCategories.includes(category)) return false;
  return true;
}

export type NotificationItem = {
  id: string;
  user_id: string | null;
  scope: NotificationScope;
  event_type: NotificationEventType | string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

function toIntegerLimit(value: unknown, fallback = 25, max = 100): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

export async function createUserNotification(args: {
  userId: string;
  eventType: NotificationEventType | string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Check user preferences - skip if in-app disabled or category muted
  const allowed = await shouldCreateNotification(args.userId, args.eventType);
  if (!allowed) return;

  const pool = getPool();
  await pool.query(
    `INSERT INTO notifications (user_id, scope, event_type, title, message, metadata)
     VALUES ($1, 'user', $2, $3, $4, $5)`,
    [
      args.userId,
      args.eventType,
      String(args.title || '').slice(0, 140),
      String(args.message || '').slice(0, 500),
      args.metadata ? JSON.stringify(args.metadata) : null,
    ]
  );

  // Push real-time SSE event to connected clients for this user
  pushToUser(args.userId, 'notification', {
    eventType: args.eventType,
    title: String(args.title || '').slice(0, 140),
    message: String(args.message || '').slice(0, 500),
  });
}

export async function createPlatformNotification(args: {
  eventType?: NotificationEventType | string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO notifications (user_id, scope, event_type, title, message, metadata)
     VALUES (NULL, 'platform', $1, $2, $3, $4)`,
    [
      args.eventType || 'platform_event',
      String(args.title || '').slice(0, 140),
      String(args.message || '').slice(0, 500),
      args.metadata ? JSON.stringify(args.metadata) : null,
    ]
  );

  // Broadcast platform notification to all connected SSE clients
  pushToAll('notification', {
    scope: 'platform',
    eventType: args.eventType || 'platform_event',
    title: String(args.title || '').slice(0, 140),
    message: String(args.message || '').slice(0, 500),
  });
}

export async function listNotificationsForUser(
  userId: string,
  limitInput?: unknown
): Promise<NotificationItem[]> {
  const pool = getPool();
  const limit = toIntegerLimit(limitInput, 25, 100);
  const { rows } = await pool.query(
    `SELECT
       n.id,
       n.user_id,
       n.scope,
       n.event_type,
       n.title,
       n.message,
       n.metadata,
       CASE
         WHEN n.scope = 'platform' THEN (nr.notification_id IS NOT NULL)
         ELSE n.is_read
       END AS is_read,
       n.created_at,
       CASE
         WHEN n.scope = 'platform' THEN nr.read_at
         ELSE n.read_at
       END AS read_at
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id AND nr.user_id = $1
     WHERE n.user_id = $1 OR n.scope = 'platform'
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id AND nr.user_id = $1
     WHERE
       (
         (n.user_id = $1 AND n.is_read = FALSE)
         OR
         (n.scope = 'platform' AND nr.notification_id IS NULL)
       )`,
    [userId]
  );
  return Math.max(0, Number(rows[0]?.total || 0));
}

export async function markNotificationReadForUser(userId: string, id: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, scope, user_id
     FROM notifications
     WHERE id = $1 AND (user_id = $2 OR scope = 'platform')
     LIMIT 1`,
    [id, userId]
  );

  if (!rows.length) return false;

  const notification = rows[0];
  if (String(notification.scope) === 'platform') {
    await pool.query(
      `INSERT INTO notification_reads (user_id, notification_id, read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, notification_id) DO UPDATE SET read_at = EXCLUDED.read_at`,
      [userId, id]
    );
    return true;
  }

  const { rowCount } = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function markAllNotificationsReadForUser(userId: string): Promise<number> {
  const pool = getPool();
  const userResult = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );

  const platformResult = await pool.query(
    `INSERT INTO notification_reads (user_id, notification_id, read_at)
     SELECT $1, n.id, NOW()
     FROM notifications n
     LEFT JOIN notification_reads nr
       ON nr.notification_id = n.id AND nr.user_id = $1
     WHERE n.scope = 'platform' AND nr.notification_id IS NULL
     ON CONFLICT (user_id, notification_id) DO NOTHING`,
    [userId]
  );

  return Number((userResult.rowCount || 0) + (platformResult.rowCount || 0));
}
