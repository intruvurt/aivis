/**
 * Visibility Timeline Service - Level 4 Self-Healing System
 * Stores and retrieves the audit score time series with fix-event overlays.
 *
 * Table: audit_score_timeline
 */

import { getPool } from './postgresql.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'scheduled_rescan'
  | 'manual_audit'
  | 'deploy_hook'
  | 'self_healing'
  | 'fix_merged'
  | 'competitor_shift';

export interface TimelinePoint {
  id: string;
  user_id: string;
  workspace_id: string | null;
  url: string;
  score: number;
  score_delta: number | null;
  event_type: TimelineEventType;
  event_label: string | null;
  audit_id: string | null;
  fix_id: string | null;
  captured_at: string;
}

export interface TimelineWithEvents {
  points: Array<{
    date: string;
    score: number;
    delta: number | null;
    event?: {
      type: TimelineEventType;
      label: string | null;
      auditId: string | null;
      fixId: string | null;
    };
  }>;
  minScore: number;
  maxScore: number;
  latestScore: number | null;
  trend: 'up' | 'down' | 'stable';
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Record a new score data point.
 * Call this after every completed audit / rescan / fix merge.
 */
export async function recordTimelinePoint(args: {
  userId: string;
  workspaceId: string | null;
  url: string;
  score: number;
  auditId?: string | null;
  fixId?: string | null;
  eventType?: TimelineEventType;
  eventLabel?: string | null;
}): Promise<void> {
  const pool = getPool();

  // Compute delta from last data point for this user/url
  let previousScore: number | null = null;
  try {
    const { rows } = await pool.query(
      `SELECT score FROM audit_score_timeline
       WHERE user_id = $1 AND LOWER(url) = LOWER($2)
         AND (($3::uuid IS NULL AND workspace_id IS NULL) OR workspace_id = $3::uuid)
       ORDER BY captured_at DESC LIMIT 1`,
      [args.userId, args.url, args.workspaceId ?? null],
    );
    if (rows.length) previousScore = Number(rows[0].score);
  } catch {
    // non-critical, just skip delta
  }

  const delta = previousScore !== null ? args.score - previousScore : null;

  await pool.query(
    `INSERT INTO audit_score_timeline
       (user_id, workspace_id, url, score, score_delta, event_type, event_label, audit_id, fix_id)
     VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8, $9)`,
    [
      args.userId,
      args.workspaceId ?? null,
      args.url,
      args.score,
      delta,
      args.eventType ?? 'manual_audit',
      args.eventLabel ?? null,
      args.auditId ?? null,
      args.fixId ?? null,
    ],
  );
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getTimeline(
  userId: string,
  url: string,
  days = 30,
  workspaceId: string | null,
): Promise<TimelineWithEvents> {
  const { rows } = await getPool().query(
    `SELECT * FROM audit_score_timeline
     WHERE user_id = $1 AND LOWER(url) = LOWER($2)
       AND (($4::uuid IS NULL AND workspace_id IS NULL) OR workspace_id = $4::uuid)
       AND captured_at >= NOW() - ($3 || ' days')::interval
     ORDER BY captured_at ASC`,
    [userId, url, days, workspaceId],
  );

  if (!rows.length) {
    return { points: [], minScore: 0, maxScore: 100, latestScore: null, trend: 'stable' };
  }

  const scores = rows.map((r: TimelinePoint) => Number(r.score));
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const latestScore = scores[scores.length - 1];

  // Trend: compare first vs last third of samples
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (scores.length >= 3) {
    const firstAvg = scores.slice(0, Math.ceil(scores.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(scores.length / 3);
    const lastAvg = scores.slice(-Math.ceil(scores.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(scores.length / 3);
    if (lastAvg - firstAvg > 3) trend = 'up';
    else if (firstAvg - lastAvg > 3) trend = 'down';
  }

  const points = rows.map((r: TimelinePoint) => ({
    date: r.captured_at,
    score: Number(r.score),
    delta: r.score_delta !== null ? Number(r.score_delta) : null,
    event: r.event_type !== 'manual_audit' || r.event_label || r.fix_id
      ? {
        type: r.event_type,
        label: r.event_label,
        auditId: r.audit_id,
        fixId: r.fix_id,
      }
      : undefined,
  }));

  return { points, minScore, maxScore, latestScore, trend };
}

export async function getUserTimelineUrls(userId: string, workspaceId: string | null): Promise<string[]> {
  const { rows } = await getPool().query(
    `SELECT DISTINCT url FROM audit_score_timeline
      WHERE user_id = $1
        AND (($2::uuid IS NULL AND workspace_id IS NULL) OR workspace_id = $2::uuid)
      ORDER BY url`,
    [userId, workspaceId],
  );
  return rows.map((r: { url: string }) => r.url);
}

/** Prune old timeline data (retention: 1 year). Called on server startup or daily cron. */
export async function pruneOldTimelineData(): Promise<number> {
  const { rowCount } = await getPool().query(
    `DELETE FROM audit_score_timeline WHERE captured_at < NOW() - INTERVAL '1 year'`,
  );
  return rowCount ?? 0;
}

// ── Temporal drift + AVP join ──────────────────────────────────────────────────

export interface TemporalDriftPoint {
  date: string;
  /** Traditional visibility score (0–100) from audit_score_timeline */
  visibility_score: number;
  /** AI Visibility Probability (0–1) from simulation_runs, if available */
  avp: number | null;
  /** AVP delta vs prior data point */
  avp_delta: number | null;
  /** Score delta vs prior audit */
  score_delta: number | null;
  /** Driving event, if any */
  event_type: TimelineEventType | null;
}

/**
 * Joins audit score timeline with simulation_runs AVP values to produce a
 * unified temporal drift view — the backbone of the Diagnose mode display.
 *
 * AVP values are matched to the nearest timeline point within a 24-hour window.
 * Falls back gracefully if simulation_runs table does not yet exist.
 */
export async function getTemporalDriftWithAVP(
  userId: string,
  url: string,
  days = 30,
  workspaceId: string | null,
): Promise<TemporalDriftPoint[]> {
  const pool = getPool();

  // Fetch audit score timeline
  const { rows: timelineRows } = await pool.query<TimelinePoint>(
    `SELECT * FROM audit_score_timeline
     WHERE user_id = $1 AND LOWER(url) = LOWER($2)
       AND (($4::uuid IS NULL AND workspace_id IS NULL) OR workspace_id = $4::uuid)
       AND captured_at >= NOW() - ($3 || ' days')::interval
     ORDER BY captured_at ASC`,
    [userId, url, days, workspaceId],
  );

  // Attempt to fetch simulation AVP values — graceful if table absent
  let simRows: Array<{ run_at: string; aggregate_avp: number; avp_delta: number | null }> = [];
  try {
    const result = await pool.query<{ run_at: string; aggregate_avp: number; avp_delta: number | null }>(
      `SELECT run_at, aggregate_avp, avp_delta FROM simulation_runs
       WHERE user_id = $1 AND LOWER(url) = LOWER($2)
         AND (($4::uuid IS NULL AND workspace_id IS NULL) OR workspace_id = $4::uuid)
         AND run_at >= NOW() - ($3 || ' days')::interval
       ORDER BY run_at ASC`,
      [userId, url, days, workspaceId],
    );
    simRows = result.rows;
  } catch {
    // simulation_runs table may not exist yet — continue without AVP
  }

  return timelineRows.map((tp) => {
    const tpMs = new Date(tp.captured_at).getTime();

    // Find nearest simulation run within ±24h
    let matchedSim: (typeof simRows)[0] | null = null;
    let minDiff = 24 * 60 * 60 * 1000; // 24h in ms
    for (const sr of simRows) {
      const diff = Math.abs(new Date(sr.run_at).getTime() - tpMs);
      if (diff < minDiff) {
        minDiff = diff;
        matchedSim = sr;
      }
    }

    return {
      date: tp.captured_at,
      visibility_score: Number(tp.score),
      avp: matchedSim ? matchedSim.aggregate_avp : null,
      avp_delta: matchedSim ? matchedSim.avp_delta : null,
      score_delta: tp.score_delta !== null ? Number(tp.score_delta) : null,
      event_type: tp.event_type ?? null,
    };
  });
}
