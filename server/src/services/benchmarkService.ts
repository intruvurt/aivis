import { createHash } from 'crypto';
import { getPool } from './postgresql.js';

/** SHA-256 hash of a URL — ensures no raw URLs leak into the public proof table */
function hashUrl(url: string): string {
  return createHash('sha256').update(url.toLowerCase().trim()).digest('hex');
}

// ── Lazy schema init (self-healing for score_improvements) ──────────────────
let benchmarkSchemaInitPromise: Promise<void> | null = null;

async function ensureBenchmarkSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS score_improvements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url_hash VARCHAR(64) NOT NULL,
      first_audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      latest_audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      score_before INTEGER NOT NULL,
      score_after INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      audit_count INTEGER NOT NULL DEFAULT 2,
      domain_category VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_score_improvements_user_url ON score_improvements(user_id, url_hash)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_score_improvements_delta ON score_improvements(delta DESC)`,
  );
}

function isMissingScoreImprovementsError(err: unknown): boolean {
  const code = String((err as any)?.code || '');
  if (code === '42P01' || code === '42703') return true;
  return String((err as any)?.message || '').toLowerCase().includes('score_improvements');
}

async function withBenchmarkSchema<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (isMissingScoreImprovementsError(err)) {
      if (!benchmarkSchemaInitPromise) {
        benchmarkSchemaInitPromise = ensureBenchmarkSchema().catch((e) => {
          benchmarkSchemaInitPromise = null;
          throw e;
        });
      }
      await benchmarkSchemaInitPromise;
      return await fn();
    }
    throw err;
  }
}

/**
 * Called after every audit persistence. Checks whether this URL now qualifies
 * as a ≥ 10-point improvement benchmark for the user.
 */
export async function trackScoreImprovement(
  userId: string,
  url: string,
  latestAuditId: string,
  latestScore: number,
): Promise<void> {
  const pool = getPool();
  const urlHash = hashUrl(url);

  await withBenchmarkSchema(async () => {
    // Get the first audit and total count for this user + url combo
    const history = await pool.query(
      `SELECT id, visibility_score, created_at
       FROM audits
       WHERE user_id = $1 AND url = $2
       ORDER BY created_at ASC`,
      [userId, url],
    );

    if (history.rows.length < 2) return;

    const firstAudit = history.rows[0];
    const scoreBefore = Number(firstAudit.visibility_score);
    const delta = latestScore - scoreBefore;

    if (delta < 10) {
      // Improvement doesn't meet threshold — remove existing row if regression
      await pool.query(
        `DELETE FROM score_improvements WHERE user_id = $1 AND url_hash = $2`,
        [userId, urlHash],
      );
      return;
    }

    // Upsert — one row per user+URL
    await pool.query(
      `INSERT INTO score_improvements
         (user_id, url_hash, first_audit_id, latest_audit_id, score_before, score_after, delta, audit_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id, url_hash) DO UPDATE SET
         latest_audit_id = EXCLUDED.latest_audit_id,
         score_after = EXCLUDED.score_after,
         delta = EXCLUDED.delta,
         audit_count = EXCLUDED.audit_count,
         updated_at = NOW()`,
      [
        userId,
        urlHash,
        firstAudit.id,
        latestAuditId,
        scoreBefore,
        latestScore,
        delta,
        history.rows.length,
      ],
    );
  });
}

/** Aggregated, anonymised proof data for the public /proof page */
export interface PublicBenchmarkData {
  total_improved: number;
  avg_improvement: number;
  max_improvement: number;
  median_improvement: number;
  distribution: { range: string; count: number }[];
  top_deltas: { score_before: number; score_after: number; delta: number; audit_count: number }[];
  generated_at: string;
}

/**
 * Returns anonymised benchmark aggregates — no URLs, no user IDs, no PII.
 */
export async function getPublicBenchmarkData(): Promise<PublicBenchmarkData> {
  const pool = getPool();

  const empty: PublicBenchmarkData = {
    total_improved: 0,
    avg_improvement: 0,
    max_improvement: 0,
    median_improvement: 0,
    distribution: [],
    top_deltas: [],
    generated_at: new Date().toISOString(),
  };

  try {
    const stats = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(AVG(delta), 0)::int AS avg_delta,
      COALESCE(MAX(delta), 0)::int AS max_delta,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta), 0)::int AS median_delta
    FROM score_improvements
    WHERE delta >= 10
  `);

    const dist = await pool.query(`
    SELECT
      CASE
        WHEN delta BETWEEN 10 AND 19 THEN '10-19'
        WHEN delta BETWEEN 20 AND 29 THEN '20-29'
        WHEN delta BETWEEN 30 AND 39 THEN '30-39'
        WHEN delta BETWEEN 40 AND 49 THEN '40-49'
        WHEN delta >= 50 THEN '50+'
      END AS range,
      COUNT(*)::int AS count
    FROM score_improvements
    WHERE delta >= 10
    GROUP BY 1
    ORDER BY MIN(delta)
  `);

    const topDeltas = await pool.query(`
    SELECT score_before, score_after, delta, audit_count
    FROM score_improvements
    WHERE delta >= 10
    ORDER BY delta DESC
    LIMIT 12
  `);

    const row = stats.rows[0] || {};
    return {
      total_improved: Number(row.total || 0),
      avg_improvement: Number(row.avg_delta || 0),
      max_improvement: Number(row.max_delta || 0),
      median_improvement: Number(row.median_delta || 0),
      distribution: dist.rows.map((r) => ({ range: String(r.range), count: Number(r.count) })),
      top_deltas: topDeltas.rows.map((r) => ({
        score_before: Number(r.score_before),
        score_after: Number(r.score_after),
        delta: Number(r.delta),
        audit_count: Number(r.audit_count),
      })),
      generated_at: new Date().toISOString(),
    };
  } catch (err: any) {
    // Table may not yet exist in this deployment — return empty rather than 500
    console.warn('[benchmarkService] getPublicBenchmarkData failed:', err?.message);
    return { ...empty, generated_at: new Date().toISOString() };
  }
}
