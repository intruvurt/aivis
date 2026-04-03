/**
 * Industry Benchmark Service (Level 5 — VaaS)
 *
 * Aggregates anonymised visibility scores from the audits table to build
 * industry/sector averages and percentile bands.  Data is recomputed on
 * demand and cached for 24 hours in the industry_benchmarks table.
 *
 * Categories are inferred from the domain TLD + audit metadata.
 * All aggregation is non-identifying — no user_id or URL is exposed.
 */
import { getPool } from './postgresql.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BenchmarkRow {
  category: string;
  subcategory: string | null;
  avg_score: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sample_count: number;
  computed_at: string;
}

export interface BenchmarkComparison {
  your_score: number;
  category: string;
  avg_score: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sample_count: number;
  percentile: number;           // 0–100: where your score sits in the distribution
  vs_avg: number;               // your_score - avg_score
  label: 'below_average' | 'average' | 'above_average' | 'top_quartile';
}

// ── Category inference ────────────────────────────────────────────────────────

const DOMAIN_CATEGORY_MAP: Array<[RegExp, string]> = [
  [/\b(saas|app|software|platform|tool|cloud)\b/i, 'SaaS'],
  [/\b(ecomm|shop|store|buy|product|market)\b/i, 'E-Commerce'],
  [/\b(blog|news|media|magazine|press|journal)\b/i, 'Media & Publishing'],
  [/\b(finance|bank|invest|capital|fund|crypto|payment)\b/i, 'Finance'],
  [/\b(agency|studio|design|creative|brand|consult)\b/i, 'Agency & Services'],
  [/\b(health|medical|clinic|pharma|wellness|doctor)\b/i, 'Health & Medical'],
  [/\b(edu|learn|course|school|academy|university)\b/i, 'Education'],
  [/\b(tech|dev|engineer|code|api|open.?source)\b/i, 'Technology'],
  [/\b(legal|law|attorney|firm|barrister)\b/i, 'Legal'],
  [/\b(real.?estate|property|home|rent|realty)\b/i, 'Real Estate'],
];

function inferCategory(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    for (const [rx, cat] of DOMAIN_CATEGORY_MAP) {
      if (rx.test(host)) return cat;
    }
  } catch {
    // ignore malformed URLs
  }
  return 'Other';
}

// ── Recompute benchmarks ──────────────────────────────────────────────────────

/**
 * Recomputes percentile bands from the audits table.
 * Runs at most once per 24 hours (enforced by the computed_at check).
 * Safe to call from any background loop — idempotent.
 */
export async function recomputeBenchmarks(): Promise<void> {
  const pool = getPool();

  // Check if we already computed in the last 24 hours
  const { rows: recent } = await pool.query(
    `SELECT id FROM industry_benchmarks WHERE computed_at > NOW() - INTERVAL '24 hours' LIMIT 1`
  );
  if (recent.length > 0) return;

  // Pull completed audits from the last 90 days (anonymised — no user_id)
  const { rows: audits } = await pool.query<{ url: string; score: number }>(
    `SELECT url, visibility_score::NUMERIC AS score
       FROM audits
      WHERE status = 'completed'
        AND visibility_score IS NOT NULL
        AND created_at > NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
      LIMIT 50000`
  );

  if (audits.length < 10) return; // not enough data yet

  // Group by inferred category
  const byCat: Record<string, number[]> = {};
  for (const { url, score } of audits) {
    const cat = inferCategory(url);
    (byCat[cat] ??= []).push(Number(score));
  }

  // Compute percentiles per category
  const rows: Array<[string, string | null, number, number, number, number, number, number]> = [];

  for (const [category, scores] of Object.entries(byCat)) {
    if (scores.length < 5) continue;
    scores.sort((a, b) => a - b);
    const n = scores.length;
    const avg = scores.reduce((s, v) => s + v, 0) / n;
    const at = (pct: number) => scores[Math.min(Math.floor((pct / 100) * n), n - 1)];

    rows.push([category, null, avg, at(25), at(50), at(75), at(90), n]);
  }

  // Also compute an "Overall" row
  const allScores = audits.map(a => Number(a.score)).sort((a, b) => a - b);
  const n = allScores.length;
  const avg = allScores.reduce((s, v) => s + v, 0) / n;
  const at = (pct: number) => allScores[Math.min(Math.floor((pct / 100) * n), n - 1)];
  rows.push(['Overall', null, avg, at(25), at(50), at(75), at(90), n]);

  if (rows.length === 0) return;

  // Upsert into industry_benchmarks
  // Strategy: delete old rows for these categories then insert fresh
  const categories = rows.map(r => r[0]);
  await pool.query(
    `DELETE FROM industry_benchmarks WHERE category = ANY($1::text[])`,
    [categories]
  );

  for (const [category, subcategory, avg_score, p25, p50, p75, p90, sample_count] of rows) {
    await pool.query(
      `INSERT INTO industry_benchmarks (category, subcategory, avg_score, p25, p50, p75, p90, sample_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [category, subcategory, avg_score.toFixed(2), p25.toFixed(2), p50.toFixed(2), p75.toFixed(2), p90.toFixed(2), sample_count]
    );
  }
}

// ── Read benchmarks ───────────────────────────────────────────────────────────

export async function getAllBenchmarks(): Promise<BenchmarkRow[]> {
  const { rows } = await getPool().query<BenchmarkRow>(
    `SELECT category, subcategory, avg_score::FLOAT AS avg_score,
            p25::FLOAT AS p25, p50::FLOAT AS p50, p75::FLOAT AS p75, p90::FLOAT AS p90,
            sample_count, computed_at
       FROM industry_benchmarks
      ORDER BY category ASC`
  );
  return rows;
}

export async function getBenchmarkForCategory(category: string): Promise<BenchmarkRow | null> {
  const { rows } = await getPool().query<BenchmarkRow>(
    `SELECT category, subcategory, avg_score::FLOAT AS avg_score,
            p25::FLOAT AS p25, p50::FLOAT AS p50, p75::FLOAT AS p75, p90::FLOAT AS p90,
            sample_count, computed_at
       FROM industry_benchmarks
      WHERE category = $1
      LIMIT 1`,
    [category]
  );
  return rows[0] ?? null;
}

export async function compareToBenchmarks(
  score: number,
  url: string,
): Promise<BenchmarkComparison | null> {
  const category = inferCategory(url);
  const benchmark = await getBenchmarkForCategory(category)
    ?? await getBenchmarkForCategory('Overall');

  if (!benchmark) return null;

  // Estimate percentile via linear interpolation between known quartile bands
  let percentile = 50;
  const { avg_score, p25, p50, p75, p90 } = benchmark;
  if (score <= p25) {
    percentile = Math.round((score / p25) * 25);
  } else if (score <= p50) {
    percentile = 25 + Math.round(((score - p25) / (p50 - p25 || 1)) * 25);
  } else if (score <= p75) {
    percentile = 50 + Math.round(((score - p50) / (p75 - p50 || 1)) * 25);
  } else if (score <= p90) {
    percentile = 75 + Math.round(((score - p75) / (p90 - p75 || 1)) * 15);
  } else {
    percentile = 90 + Math.min(Math.round(((score - p90) / (100 - p90 || 1)) * 10), 10);
  }

  const vs_avg = +(score - avg_score).toFixed(2);
  let label: BenchmarkComparison['label'] = 'average';
  if (score <= p25) label = 'below_average';
  else if (score >= p75) label = 'top_quartile';
  else if (score >= p50) label = 'above_average';

  return {
    your_score: score,
    category: benchmark.category,
    avg_score: benchmark.avg_score,
    p25: benchmark.p25,
    p50: benchmark.p50,
    p75: benchmark.p75,
    p90: benchmark.p90,
    sample_count: benchmark.sample_count,
    percentile,
    vs_avg,
    label,
  };
}
