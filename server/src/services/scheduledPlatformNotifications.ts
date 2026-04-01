import { getPool } from './postgresql.js';
import { createPlatformNotification } from './notificationService.js';

export type ScheduledPlatformNotification = {
  id: string;
  event_type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  status: 'pending' | 'published' | 'cancelled' | 'failed';
  scheduled_for: string;
  published_at: string | null;
  created_by_user_id: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

let intervalId: ReturnType<typeof setInterval> | null = null;

function normalizeEventType(input: unknown): string {
  const value = String(input || 'platform_event').trim();
  return value || 'platform_event';
}

function normalizeTitle(input: unknown): string {
  const value = String(input || '').trim();
  if (!value) throw new Error('Title is required');
  return value.slice(0, 140);
}

function normalizeMessage(input: unknown): string {
  const value = String(input || '').trim();
  if (!value) throw new Error('Message is required');
  return value.slice(0, 500);
}

function normalizeScheduledFor(input: unknown): string {
  const value = String(input || '').trim();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('scheduledFor must be a valid ISO datetime');
  }
  return parsed.toISOString();
}

export async function schedulePlatformNotification(args: {
  createdByUserId: string;
  eventType?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  scheduledFor: string;
}): Promise<ScheduledPlatformNotification> {
  const pool = getPool();
  const eventType = normalizeEventType(args.eventType);
  const title = normalizeTitle(args.title);
  const message = normalizeMessage(args.message);
  const scheduledFor = normalizeScheduledFor(args.scheduledFor);

  const { rows } = await pool.query(
    `INSERT INTO scheduled_platform_notifications
      (event_type, title, message, metadata, status, scheduled_for, created_by_user_id)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)
     RETURNING *`,
    [
      eventType,
      title,
      message,
      args.metadata ? JSON.stringify(args.metadata) : null,
      scheduledFor,
      args.createdByUserId,
    ]
  );

  return rows[0];
}

export async function publishPlatformNotificationImmediate(args: {
  createdByUserId: string;
  eventType?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<ScheduledPlatformNotification> {
  const pool = getPool();
  const eventType = normalizeEventType(args.eventType);
  const title = normalizeTitle(args.title);
  const message = normalizeMessage(args.message);

  const { rows } = await pool.query(
    `INSERT INTO scheduled_platform_notifications
      (event_type, title, message, metadata, status, scheduled_for, published_at, created_by_user_id)
     VALUES ($1, $2, $3, $4, 'published', NOW(), NOW(), $5)
     RETURNING *`,
    [
      eventType,
      title,
      message,
      args.metadata ? JSON.stringify(args.metadata) : null,
      args.createdByUserId,
    ]
  );

  const record = rows[0] as ScheduledPlatformNotification;
  await createPlatformNotification({
    eventType,
    title,
    message,
    metadata: {
      ...(args.metadata || {}),
      delivery: 'immediate',
      scheduledNotificationId: record.id,
      createdByUserId: args.createdByUserId,
    },
  });

  return record;
}

export async function listScheduledPlatformNotifications(args?: {
  status?: 'pending' | 'published' | 'cancelled' | 'failed' | 'all';
  limit?: number;
}): Promise<ScheduledPlatformNotification[]> {
  const pool = getPool();
  const status = String(args?.status || 'all').toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(args?.limit || 50)));

  if (status === 'all') {
    const { rows } = await pool.query(
      `SELECT *
       FROM scheduled_platform_notifications
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  const { rows } = await pool.query(
    `SELECT *
     FROM scheduled_platform_notifications
     WHERE status = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [status, limit]
  );
  return rows;
}

export async function publishScheduledPlatformNotificationNow(id: string, actorUserId: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT *
     FROM scheduled_platform_notifications
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return false;

  const row = rows[0] as ScheduledPlatformNotification;
  if (row.status === 'cancelled') {
    throw new Error('Cannot publish a cancelled notification');
  }
  if (row.status === 'published') return true;

  await createPlatformNotification({
    eventType: row.event_type,
    title: row.title,
    message: row.message,
    metadata: {
      ...(row.metadata || {}),
      delivery: 'manual_publish_now',
      scheduledNotificationId: row.id,
      publishedByUserId: actorUserId,
    },
  });

  await pool.query(
    `UPDATE scheduled_platform_notifications
     SET status = 'published', published_at = NOW(), updated_at = NOW(), last_error = NULL
     WHERE id = $1`,
    [id]
  );

  return true;
}

export async function cancelScheduledPlatformNotification(id: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE scheduled_platform_notifications
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [id]
  );
  return (rowCount || 0) > 0;
}

export async function processDueScheduledPlatformNotifications(limit = 20): Promise<number> {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id
     FROM scheduled_platform_notifications
     WHERE status = 'pending' AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT $1`,
    [Math.min(100, Math.max(1, Number(limit || 20)))]
  );

  let published = 0;

  for (const row of rows) {
    const id = String(row.id || '');
    if (!id) continue;
    try {
      const { rows: detailRows } = await pool.query(
        `SELECT * FROM scheduled_platform_notifications WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (!detailRows.length) continue;

      const detail = detailRows[0] as ScheduledPlatformNotification;
      if (detail.status !== 'pending') continue;

      await createPlatformNotification({
        eventType: detail.event_type,
        title: detail.title,
        message: detail.message,
        metadata: {
          ...(detail.metadata || {}),
          delivery: 'scheduled',
          scheduledNotificationId: detail.id,
          createdByUserId: detail.created_by_user_id,
        },
      });

      await pool.query(
        `UPDATE scheduled_platform_notifications
         SET status = 'published', published_at = NOW(), updated_at = NOW(), last_error = NULL
         WHERE id = $1`,
        [id]
      );
      published += 1;
    } catch (err: any) {
      await pool.query(
        `UPDATE scheduled_platform_notifications
         SET status = 'failed', updated_at = NOW(), last_error = $2
         WHERE id = $1`,
        [id, String(err?.message || 'Failed to publish scheduled notification').slice(0, 400)]
      );
    }
  }

  return published;
}

export function startScheduledPlatformNotificationLoop() {
  if (intervalId) return;

  processDueScheduledPlatformNotifications().catch((err: any) => console.error('[PlatformNotify] Init tick error:', err?.message));
  intervalId = setInterval(() => {
    processDueScheduledPlatformNotifications().catch((err: any) => console.error('[PlatformNotify] Loop error:', err?.message));
  }, 60_000);
  setTimeout(() => processDueScheduledPlatformNotifications().catch((err: any) => console.error('[PlatformNotify] Delayed tick error:', err?.message)), 15_000);
}

export function stopScheduledPlatformNotificationLoop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}
