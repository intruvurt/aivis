/**
 * Fix Learning Service - Level 4 Self-Healing System
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
  /** avg_actual_delta / avg_expected_delta - measures prediction accuracy */
  accuracy_ratio: number;
}

export interface ValidatedSeedResult {
  inserted: number;
  candidates: number;
}

const SEEDED_SUBTYPE_PREFIX = 'seed_validated_repeated';

const DEFAULT_EXPECTED_DELTA_BY_TYPE: Record<FixType, number> = {
  meta: 4,
  schema: 7,
  heading: 3,
  content: 3,
  internal_links: 2,
  canonical: 3,
  robots: 6,
  performance: 2,
  generic: 2,
};

function toFixType(category: string): FixType {
  const c = String(category || '').toLowerCase();
  if (c.includes('schema') || c.includes('structured')) return 'schema';
  if (c.includes('meta') || c.includes('open graph') || c.includes('og')) return 'meta';
  if (c.includes('heading') || c.includes('h1')) return 'heading';
  if (c.includes('content') || c.includes('readability')) return 'content';
  if (c.includes('link')) return 'internal_links';
  if (c.includes('canonical')) return 'canonical';
  if (c.includes('robot') || c.includes('crawl')) return 'robots';
  if (c.includes('performance') || c.includes('speed')) return 'performance';
  return 'generic';
}

function slugPart(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
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
 * Global fix rankings across all users - used for bootstrap recommendations
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

/**
 * Seed fix_outcomes from repeated, evidence-backed findings in recent audits.
 * This bootstraps rankings before post-merge verification data accumulates.
 */
export async function seedValidatedFixOutcomes(args: {
  userId: string;
  lookbackDays?: number;
  minOccurrences?: number;
}): Promise<ValidatedSeedResult> {
  const lookbackDays = Math.max(14, Math.min(365, Number(args.lookbackDays || 90)));
  const minOccurrences = Math.max(2, Math.min(12, Number(args.minOccurrences || 2)));

  const { rows } = await getPool().query(
    `SELECT
       LOWER(COALESCE(NULLIF(a.normalized_url, ''), a.url)) AS url,
       COALESCE(NULLIF(rec->>'category', ''), 'generic') AS category,
       COALESCE(NULLIF(rec->>'title', ''), 'Untitled finding') AS title,
       COUNT(*)::int AS occurrences
     FROM audits a
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a.result->'recommendations', '[]'::jsonb)) AS rec
     WHERE a.user_id = $1
       AND a.created_at >= NOW() - ($2::text || ' days')::interval
       AND COALESCE(a.status, 'completed') = 'completed'
       AND (
         (jsonb_typeof(rec->'evidence_ids') = 'array' AND jsonb_array_length(rec->'evidence_ids') > 0)
         OR rec ? 'evidence'
         OR rec ? 'implementation'
       )
     GROUP BY 1, 2, 3
     HAVING COUNT(*) >= $3
     ORDER BY occurrences DESC, url ASC
     LIMIT 120`,
    [args.userId, lookbackDays, minOccurrences],
  );

  let inserted = 0;

  for (const r of rows as Array<{ url: string; category: string; title: string; occurrences: number }>) {
    const fixType = toFixType(r.category);
    const expectedDelta = DEFAULT_EXPECTED_DELTA_BY_TYPE[fixType] + Math.min(3, Math.max(0, Number(r.occurrences) - minOccurrences));
    const actualDelta = Math.round((expectedDelta * 0.65) * 100) / 100;
    const subtype = `${SEEDED_SUBTYPE_PREFIX}:${slugPart(r.category)}:${slugPart(r.title)}`;
    const roi = expectedDelta !== 0 ? Math.round((actualDelta / expectedDelta) * 100) / 100 : 0;

    const result = await getPool().query(
      `INSERT INTO fix_outcomes (user_id, fix_type, fix_subtype, expected_delta, actual_delta, roi_ratio, url)
       SELECT $1, $2, $3, $4, $5, $6, LOWER($7)
       WHERE NOT EXISTS (
         SELECT 1
         FROM fix_outcomes
         WHERE user_id = $1
           AND LOWER(url) = LOWER($7)
           AND fix_subtype = $3
           AND captured_at >= NOW() - INTERVAL '30 days'
       )`,
      [args.userId, fixType, subtype, expectedDelta, actualDelta, roi, r.url],
    );

    if (Number(result.rowCount || 0) > 0) inserted += 1;
  }

  return {
    inserted,
    candidates: rows.length,
  };
}
