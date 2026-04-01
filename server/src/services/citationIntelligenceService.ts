/**
 * Citation Intelligence Service
 *
 * Business logic for the 6 citation tracking intelligence features:
 *  1. Mention trend snapshots (sparkline data)
 *  2. Competitor citation share aggregation
 *  3. Cross-platform consistency matrix
 *  4. Mention quality score computation
 *  5. Drop alert detection
 *  6. Unlinked co-occurrence scanning via DDG web search
 */

import { getPool } from './postgresql.js';
import { checkWebSearchPresence } from './webSearch.js';
import type {
  CitationMentionTrend,
  CitationCompetitorShareEntry,
  CitationDropAlert,
  CitationCoOccurrence,
  ConsistencyMatrixCell,
} from '../../../shared/types.js';

// Re-export for use in trendAlertEmails (avoids circular import)
export type { CitationDropAlert };

// ─── 1. Mention Trend Snapshot ────────────────────────────────────────────────

/**
 * Persist a mention-rate snapshot after a citation test completes.
 * This is the raw data that powers the sparkline chart.
 */
export async function recordMentionTrendSnapshot(
  userId: string,
  url: string,
  testId: string | null,
  mentionRate: number,
  totalQueries: number,
  mentionedCount: number,
  platformBreakdown: Record<string, number>
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO citation_mention_trends
      (user_id, url, test_id, mention_rate, total_queries, mentioned_count, platform_breakdown)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      url,
      testId ?? null,
      mentionRate,
      totalQueries,
      mentionedCount,
      JSON.stringify(platformBreakdown),
    ]
  );
}

/**
 * Retrieve the last N mention-rate snapshots for a URL (sparkline data).
 */
export async function getMentionTrendHistory(
  userId: string,
  url: string,
  limit = 30
): Promise<CitationMentionTrend[]> {
  const pool = getPool();
  const { rows } = await pool.query<CitationMentionTrend>(
    `SELECT id, user_id, url, test_id, mention_rate, total_queries, mentioned_count,
            platform_breakdown, sampled_at
     FROM citation_mention_trends
     WHERE user_id = $1 AND url = $2
     ORDER BY sampled_at DESC
     LIMIT $3`,
    [userId, url, limit]
  );
  // Return chronological order (oldest → newest) for sparkline rendering
  return rows.reverse();
}

// ─── 2. Competitor Share Aggregation ─────────────────────────────────────────

/**
 * Tally competitor_mentioned JSONB arrays from recent citation_results for a URL
 * and persist an aggregated snapshot to citation_competitor_share.
 * Returns the computed entries.
 */
export async function aggregateCompetitorShare(
  userId: string,
  url: string,
  windowDays = 30
): Promise<CitationCompetitorShareEntry[]> {
  const pool = getPool();

  // Pull recent results rows for this user + URL from the last N days
  const { rows: resultRows } = await pool.query<{
    competitors_mentioned: string[];
    platform: string;
    total_queries_in_test: number;
  }>(
    `SELECT cr.competitors_mentioned, cr.platform,
            ct.summary->>'total_queries' AS total_queries_in_test
     FROM citation_results cr
     JOIN citation_tests ct ON ct.id = cr.citation_test_id
     WHERE ct.user_id = $1
       AND ct.url = $2
       AND cr.created_at >= NOW() - INTERVAL '1 day' * $3`,
    [userId, url, windowDays]
  );

  if (resultRows.length === 0) return [];

  // Tally competitors across all results
  const tallyMap = new Map<string, { count: number; platforms: Set<string> }>();
  let totalQueries = 0;

  for (const row of resultRows) {
    totalQueries++;
    const competitors: string[] = Array.isArray(row.competitors_mentioned)
      ? row.competitors_mentioned
      : [];
    for (const comp of competitors) {
      const key = comp.trim().toLowerCase();
      if (!key) continue;
      if (!tallyMap.has(key)) {
        tallyMap.set(key, { count: 0, platforms: new Set() });
      }
      const entry = tallyMap.get(key)!;
      entry.count++;
      entry.platforms.add(row.platform);
    }
  }

  if (tallyMap.size === 0) return [];

  const entries: CitationCompetitorShareEntry[] = Array.from(tallyMap.entries())
    .map(([name, data]) => ({
      competitor_name: name,
      mention_count: data.count,
      total_queries: totalQueries,
      share_pct: parseFloat(((data.count / totalQueries) * 100).toFixed(1)),
      platforms_present: Array.from(data.platforms),
    }))
    .sort((a, b) => b.mention_count - a.mention_count);

  // Persist snapshot for historical comparison
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const windowEnd = new Date();

  await pool.query(
    `DELETE FROM citation_competitor_share
     WHERE user_id = $1 AND url = $2
       AND computed_at >= NOW() - INTERVAL '1 hour'`,
    [userId, url]
  );

  for (const e of entries) {
    await pool.query(
      `INSERT INTO citation_competitor_share
        (user_id, url, competitor_name, mention_count, total_queries, platforms_present,
         window_start, window_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        url,
        e.competitor_name,
        e.mention_count,
        e.total_queries,
        e.platforms_present,
        windowStart.toISOString(),
        windowEnd.toISOString(),
      ]
    );
  }

  return entries;
}

// ─── 3. Cross-Platform Consistency Matrix ─────────────────────────────────────

/**
 * Build a per-platform × per-query matrix from the citation_prompt_ledger for a URL.
 * Returns flat cells; the client builds the pivot table.
 */
export async function buildConsistencyMatrix(
  userId: string,
  url: string
): Promise<ConsistencyMatrixCell[]> {
  const pool = getPool();

  const { rows } = await pool.query<{
    prompt_text: string;
    platform: string;
    mentioned: boolean;
    position: number | null;
    evidence_excerpt: string | null;
  }>(
    `SELECT cpl.prompt_text, cpl.platform, cpl.mentioned, cpl.position, cpl.evidence_excerpt
     FROM citation_prompt_ledger cpl
     JOIN citation_tests ct ON ct.id = cpl.citation_test_id
     WHERE ct.user_id = $1 AND ct.url = $2
     ORDER BY cpl.created_at DESC
     LIMIT 400`,
    [userId, url]
  );

  return rows.map((r) => ({
    query: r.prompt_text,
    platform: r.platform,
    mentioned: r.mentioned,
    position: r.position ?? 0,
    excerpt: r.evidence_excerpt ?? '',
  }));
}

// ─── 4. Mention Quality Score ─────────────────────────────────────────────────

/**
 * Compute a 1–5 mention quality score for a single citation result.
 * Higher = deeper, more specific mention with early position.
 *
 * Scoring rubric:
 *  +2  position 1–3
 *  +1  position 4–6
 *  +2  excerpt length ≥ 100 chars
 *  +1  excerpt length ≥ 50 chars (partial credit)
 *  +1  excerpt contains a number or specific proper noun (signals specificity)
 *
 * Max raw = 5, Min = 1, not mentioned = 0.
 */
export function computeMentionQuality(
  mentioned: boolean,
  position: number,
  excerpt: string
): number {
  if (!mentioned) return 0;

  let score = 0;

  // Position bonus
  if (position >= 1 && position <= 3) score += 2;
  else if (position >= 4 && position <= 6) score += 1;

  // Excerpt depth
  const len = (excerpt || '').trim().length;
  if (len >= 100) score += 2;
  else if (len >= 50) score += 1;

  // Specificity signal: digit or capitalised proper noun of ≥ 4 chars
  const hasSpecificity =
    /\d/.test(excerpt) || /\b[A-Z][a-z]{3,}/.test(excerpt);
  if (hasSpecificity) score += 1;

  return Math.min(Math.max(score, 1), 5);
}

// ─── 5. Drop Alert Detection ─────────────────────────────────────────────────

const DROP_THRESHOLD_PCT = 15; // minimum drop in mention_rate to create alert

/**
 * Compare the two most recent trend snapshots for a URL.
 * If drop ≥ threshold, insert a citation_drop_alerts row.
 * Skips duplicate alert if one already exists for this URL within 24h.
 *
 * Returns the new alert record if created, null otherwise.
 */
export async function detectAndStoreDropAlert(
  userId: string,
  url: string
): Promise<CitationDropAlert | null> {
  const pool = getPool();

  // Get the two most recent snapshots
  const { rows: snapshots } = await pool.query<{
    mention_rate: string;
    sampled_at: string;
  }>(
    `SELECT mention_rate, sampled_at
     FROM citation_mention_trends
     WHERE user_id = $1 AND url = $2
     ORDER BY sampled_at DESC
     LIMIT 2`,
    [userId, url]
  );

  if (snapshots.length < 2) return null;

  const current = parseFloat(snapshots[0].mention_rate);
  const previous = parseFloat(snapshots[1].mention_rate);
  const drop = previous - current;

  if (drop < DROP_THRESHOLD_PCT) return null;

  // Dedup: don't fire twice within 24h for the same URL
  const { rows: existing } = await pool.query(
    `SELECT id FROM citation_drop_alerts
     WHERE user_id = $1 AND url = $2 AND created_at >= NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [userId, url]
  );

  if (existing.length > 0) return null;

  const { rows: inserted } = await pool.query<CitationDropAlert>(
    `INSERT INTO citation_drop_alerts
      (user_id, url, previous_mention_rate, current_mention_rate, drop_magnitude, alert_type)
     VALUES ($1, $2, $3, $4, $5, 'mention_drop')
     RETURNING *`,
    [userId, url, previous, current, drop]
  );

  return inserted[0] ?? null;
}

// ─── 6. Co-occurrence Scan ───────────────────────────────────────────────────

/**
 * Search for unlinked brand mentions on the web using DDG HTML search.
 * Stores any found co-occurrences in citation_cooccurrences.
 * Returns the newly-found entries.
 */
export async function checkAndStoreCoOccurrences(
  userId: string,
  url: string,
  brandName: string
): Promise<CitationCoOccurrence[]> {
  // Build co-occurrence query: brand mentioned without site: constraint
  const query = `"${brandName}"`;

  const presence = await checkWebSearchPresence(query, brandName, url, []);

  if (!presence.found && presence.top_results.length === 0) return [];

  const pool = getPool();
  const found: CitationCoOccurrence[] = [];

  for (const result of presence.top_results) {
    // Determine if target URL appears as a link in this result
    const hasLink = result.url.toLowerCase().includes(new URL(url).hostname.toLowerCase());

    // Only store if brand name appears in the title or description
    const combinedText = `${result.title} ${result.description}`.toLowerCase();
    if (!combinedText.includes(brandName.toLowerCase())) continue;

    const { rows } = await pool.query<CitationCoOccurrence>(
      `INSERT INTO citation_cooccurrences
        (user_id, url, brand_name, query_used, source_url, source_title, mention_context, has_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        userId,
        url,
        brandName,
        query,
        result.url,
        result.title,
        result.description.slice(0, 500),
        hasLink,
      ]
    );

    if (rows[0]) found.push(rows[0]);
  }

  return found;
}

/**
 * Retrieve stored co-occurrences for a URL.
 */
export async function getStoredCoOccurrences(
  userId: string,
  url: string,
  limit = 50
): Promise<CitationCoOccurrence[]> {
  const pool = getPool();
  const { rows } = await pool.query<CitationCoOccurrence>(
    `SELECT * FROM citation_cooccurrences
     WHERE user_id = $1 AND url = $2
     ORDER BY found_at DESC
     LIMIT $3`,
    [userId, url, limit]
  );
  return rows;
}
