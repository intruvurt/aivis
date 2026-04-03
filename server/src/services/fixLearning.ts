/**
 * Fix Learning Service — Level 4 Self-Healing System
 * Tracks the ROI of every fix type by recording expected vs actual score delta.
 * Provides a ranked list of fix types sorted by real-world effectiveness.
 *
 * Table: fix_outcomes
 */

import { getPool } from './postgresql.js';
import type { FixType } from './fixDecisionEngine.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FixOutcome {
  id: string;
  user_id: string;
  fix_type: FixType;
  fix_subtype: string | null;
  expected_delta: number;
  actual_delta: number;
  roi_ratio: number;
  url: string;
  captured_at: string;
}

export interface FixRanking {
  fix_type: FixType;
  sample_count: number;
  avg_expected_delta: number;
  avg_actual_delta: number;
  avg_roi_ratio: number;
  /** avg_actual_delta / avg_expected_delta — measures prediction accuracy */
  accuracy_ratio: number;
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Record the outcome after a fix-merged event for learning.
 * @param expectedDelta  Score improvement predicted before the fix
 * @param actualDelta    Actual score change measured after re-audit
 */
export async function recordFixOutcome(args: {
  userId: string;
  fixType: FixType;
  fixSubtype?: string;
  expectedDelta: number;
  actualDelta: number;
  url: string;
}): Promise<void> {
  const roi = args.expectedDelta !== 0
    ? Math.round((args.actualDelta / args.expectedDelta) * 100) / 100
    : 0;

  await getPool().query(
    `INSERT INTO fix_outcomes (user_id, fix_type, fix_subtype, expected_delta, actual_delta, roi_ratio, url)
     VALUES ($1, $2, $3, $4, $5, $6, LOWER($7))`,
    [
      args.userId,
      args.fixType,
      args.fixSubtype ?? null,
      args.expectedDelta,
      args.actualDelta,
      roi,
      args.url,
    ],
  );
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Return fix types ranked by real-world ROI (highest actual delta first).
 * Minimum 2 samples per fix type to be included.
 */
export async function getFixRankings(userId: string): Promise<FixRanking[]> {
  const { rows } = await getPool().query(
    `SELECT
       fix_type,
       COUNT(*)::int AS sample_count,
       ROUND(AVG(expected_delta)::numeric, 2) AS avg_expected_delta,
       ROUND(AVG(actual_delta)::numeric, 2) AS avg_actual_delta,
       ROUND(AVG(roi_ratio)::numeric, 3) AS avg_roi_ratio
     FROM fix_outcomes
     WHERE user_id = $1
     GROUP BY fix_type
     HAVING COUNT(*) >= 2
     ORDER BY AVG(actual_delta) DESC`,
    [userId],
  );

  return rows.map((r: any) => ({
    fix_type: r.fix_type as FixType,
    sample_count: Number(r.sample_count),
    avg_expected_delta: Number(r.avg_expected_delta),
    avg_actual_delta: Number(r.avg_actual_delta),
    avg_roi_ratio: Number(r.avg_roi_ratio),
    accuracy_ratio: Number(r.avg_expected_delta) !== 0
      ? Math.round((Number(r.avg_actual_delta) / Number(r.avg_expected_delta)) * 100) / 100
      : 0,
  }));
}

/**
 * Global fix rankings across all users — used for bootstrap recommendations
 * before per-user data accumulates.
 */
export async function getGlobalFixRankings(): Promise<FixRanking[]> {
  const { rows } = await getPool().query(
    `SELECT
       fix_type,
       COUNT(*)::int AS sample_count,
       ROUND(AVG(expected_delta)::numeric, 2) AS avg_expected_delta,
       ROUND(AVG(actual_delta)::numeric, 2) AS avg_actual_delta,
       ROUND(AVG(roi_ratio)::numeric, 3) AS avg_roi_ratio
     FROM fix_outcomes
     GROUP BY fix_type
     HAVING COUNT(*) >= 5
     ORDER BY AVG(actual_delta) DESC`,
  );

  return rows.map((r: any) => ({
    fix_type: r.fix_type as FixType,
    sample_count: Number(r.sample_count),
    avg_expected_delta: Number(r.avg_expected_delta),
    avg_actual_delta: Number(r.avg_actual_delta),
    avg_roi_ratio: Number(r.avg_roi_ratio),
    accuracy_ratio: Number(r.avg_expected_delta) !== 0
      ? Math.round((Number(r.avg_actual_delta) / Number(r.avg_expected_delta)) * 100) / 100
      : 0,
  }));
}

/**
 * Return the best-performing fix type for a given URL based on historical outcomes.
 * Useful for ordering fix plan items.
 */
export async function getBestFixTypeForUrl(userId: string, url: string): Promise<FixType | null> {
  const { rows } = await getPool().query(
    `SELECT fix_type, AVG(actual_delta) AS avg_delta
     FROM fix_outcomes
     WHERE user_id = $1 AND LOWER(url) = LOWER($2)
     GROUP BY fix_type
     ORDER BY avg_delta DESC
     LIMIT 1`,
    [userId, url],
  );
  return rows[0]?.fix_type ?? null;
}
