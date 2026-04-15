/**
 * Citation Revalidation Service
 *
 * Runs every 6 hours and back-fills `is_false_positive` on citation_results rows
 * that were written before the strengthened false-positive logic existed (i.e. rows
 * where `is_false_positive IS NULL`).  It also re-checks rows that are 48+ hours
 * old to catch stale decisions made by earlier, weaker detection logic.
 *
 * Detection criteria (same triple-gate used at write-time in citations.controllers):
 *  1. Negative mention context  — "could not find X", "didn't mention X", etc.
 *  2. Lacks substantive support — excerpt too short or contains no brand/host hit
 *  3. Low quality score         — claimed mention with quality_score < 15
 *
 * No AI API calls are made; all checks run against the stored `excerpt` column.
 */

import { getPool } from './postgresql.js';
import { excerptHasSubstantiveSupport, containsNegativeMentionContext } from './citationTester.js';
import { computeMentionQuality } from './citationIntelligenceService.js';

// How many rows to revalidate per tick (keep DB query short)
const BATCH_SIZE = 100;

// Only revalidate rows that are at least 48 hours old so freshly-written rows
// settle before we second-guess them.
const STALE_HOURS = 48;

// Re-run every 6 hours
const INTERVAL_MS = 6 * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;

/** Extract hostname without www prefix from a plain domain string. */
function hostnameFromUrl(urlOrDomain: string): string {
    try {
        const withScheme = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;
        return new URL(withScheme).hostname.replace(/^www\./, '');
    } catch {
        return urlOrDomain.replace(/^www\./, '').split('/')[0];
    }
}

/**
 * Revalidate one batch of stale citation_results rows.
 * Returns the number of rows updated.
 */
async function revalidateBatch(): Promise<number> {
    const pool = getPool();

    // Fetch rows whose false-positive status is unknown OR that were written with
    // the old block-list-only logic.  We join citation_tests to get the target URL
    // and brand name needed for the substantive-support check.
    const selectRes = await pool.query<{
        id: string;
        mentioned: boolean;
        excerpt: string | null;
        mention_quality_score: number | null;
        url: string;
        brand_name: string | null;
    }>(
        `SELECT cr.id,
            cr.mentioned,
            cr.excerpt,
            cr.mention_quality_score,
            ct.url,
            ct.brand_name
     FROM   citation_results  cr
     JOIN   citation_tests    ct ON ct.id = cr.citation_test_id
     WHERE  cr.is_false_positive IS NULL
        AND cr.created_at < NOW() - INTERVAL '${STALE_HOURS} hours'
     LIMIT  $1`,
        [BATCH_SIZE],
    );

    if (!selectRes.rowCount || selectRes.rowCount === 0) return 0;

    let updated = 0;

    for (const row of selectRes.rows) {
        const excerpt = row.excerpt || '';
        const hostname = hostnameFromUrl(row.url || '');
        const brandName = row.brand_name || hostname;

        // ── Gate 1: negative mention context ────────────────────────────────────
        const negativeContext = row.mentioned
            ? containsNegativeMentionContext(excerpt.toLowerCase(), brandName, hostname)
            : false;

        // ── Gate 2: lacks substantive support ───────────────────────────────────
        const lacksSupport = row.mentioned
            ? !excerptHasSubstantiveSupport(excerpt, brandName, hostname)
            : false;

        // ── Gate 3: low quality score ────────────────────────────────────────────
        const quality = row.mention_quality_score != null
            ? Number(row.mention_quality_score)
            : computeMentionQuality(row.mentioned, 0, excerpt);

        const lowQualityMention = row.mentioned && quality < 15;

        const isFalsePositive = negativeContext || lacksSupport || lowQualityMention;

        await pool.query(
            `UPDATE citation_results SET is_false_positive = $1 WHERE id = $2`,
            [isFalsePositive, row.id],
        );
        updated += 1;
    }

    return updated;
}

/** Single tick handler — catches its own errors so the loop never dies. */
async function tick(): Promise<void> {
    try {
        const count = await revalidateBatch();
        if (count > 0) {
            console.log(`[citationRevalidation] Updated ${count} stale citation result(s)`);
        }
    } catch (err) {
        console.error('[citationRevalidation] Batch error:', err);
    }
}

/** Start the 6-hour revalidation loop. Safe to call multiple times. */
export function startCitationRevalidationLoop(): void {
    if (intervalId) return; // already running

    console.log('[citationRevalidation] Starting loop (6-hour interval)');

    // Run once shortly after startup to catch any backlog, then on schedule.
    setTimeout(tick, 60_000);
    intervalId = setInterval(tick, INTERVAL_MS);
}

/** Stop the revalidation loop. */
export function stopCitationRevalidationLoop(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}
