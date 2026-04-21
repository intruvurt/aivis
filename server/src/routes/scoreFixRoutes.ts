/**
 * Score Fix — Continuous Evidence Repair Routes
 *
 * These routes are the execution interface for the Score Fix tier's
 * always-on ledger repair system. All routes require:
 *   authRequired → requireScoreFixTier
 *
 * Routes:
 *   POST /api/scorefix/run         — trigger a repair cycle for a URL
 *   GET  /api/scorefix/ledger-sync — return current ledger drift state
 *   GET  /api/scorefix/pr-status   — return open/merged PR statuses
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { authRequired, requireScoreFixTier } from '../middleware/authRequired.js';
import { LEDGER_WATCH_CONFIG, getJobById } from '../services/autoScoreFixService.js';
import { pool } from '../services/postgresql.js';
function sanitizeInput(input: string, maxLen = 2000): string {
    return String(input).slice(0, maxLen).replace(/[<>'"]/g, '');
}

const router = Router();

// All scorefix action routes require auth + scorefix tier
router.use(authRequired, requireScoreFixTier);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scorefix/run
// Trigger an immediate ledger repair cycle for the specified URL.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/run', async (req: Request, res: Response) => {
    const userId = (req as any).userId as string;

    const rawUrl = (req.body?.url as string | undefined) ?? '';
    const url = sanitizeInput(rawUrl.trim());
    if (!url || !/^https?:\/\/.{3,}/.test(url)) {
        return res.status(400).json({ error: 'Valid URL required', code: 'INVALID_URL' });
    }

    try {
        // Count open jobs for this user to respect maxPRsPerWeek
        const openJobsResult = await pool.query<{ count: string }>(
            `SELECT COUNT(*) AS count
       FROM auto_score_fix_jobs
       WHERE user_id = $1
         AND status IN ('pending', 'generating', 'creating_pr', 'pending_approval')
         AND created_at > NOW() - INTERVAL '7 days'`,
            [userId]
        );
        const openJobs = parseInt(openJobsResult.rows[0]?.count ?? '0', 10);

        if (openJobs >= LEDGER_WATCH_CONFIG.maxPRsPerWeek) {
            return res.status(429).json({
                error: `Weekly PR limit reached (${LEDGER_WATCH_CONFIG.maxPRsPerWeek} PRs/week). Wait for open PRs to close.`,
                code: 'WEEKLY_PR_LIMIT',
                open_jobs: openJobs,
                max_per_week: LEDGER_WATCH_CONFIG.maxPRsPerWeek,
            });
        }

        return res.status(202).json({
            ok: true,
            message: 'Repair cycle queued. The ledger watch worker will pick it up within the next interval.',
            url,
            config: {
                autoFixThreshold: LEDGER_WATCH_CONFIG.autoFixThreshold,
                intervalHours: LEDGER_WATCH_CONFIG.intervalHours,
                maxPRsPerWeek: LEDGER_WATCH_CONFIG.maxPRsPerWeek,
            },
        });
    } catch (err: any) {
        console.error('[scorefix/run] Error:', err?.message ?? err);
        return res.status(500).json({ error: 'Repair cycle queue failed', code: 'QUEUE_FAILED' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/scorefix/ledger-sync
// Return the current ledger drift state: citations that have decayed,
// entity graph gaps, or broken schema @id continuity.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ledger-sync', async (req: Request, res: Response) => {
    const userId = (req as any).userId as string;

    try {
        // Pull the last 20 citation test results to surface decay signals
        const citationDecay = await pool.query(
            `SELECT ct.query, ct.source, ct.cited, ct.created_at, a.url
       FROM citation_tests ct
       JOIN audits a ON a.id = ct.audit_id
       WHERE a.user_id = $1
         AND ct.created_at > NOW() - INTERVAL '30 days'
       ORDER BY ct.created_at DESC
       LIMIT 20`,
            [userId]
        );

        // Pull the last repair jobs with score deltas
        const repairHistory = await pool.query(
            `SELECT id, url, status, score_before, score_after, score_delta,
              created_at, rescan_completed_at
       FROM auto_score_fix_jobs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
            [userId]
        );

        const citations = citationDecay.rows;
        const decayedCount = citations.filter((r: any) => r.cited === false).length;
        const totalCitations = citations.length;

        return res.json({
            ok: true,
            ledger_state: {
                decay_signals: decayedCount,
                total_citations_checked: totalCitations,
                decay_rate: totalCitations > 0 ? Math.round((decayedCount / totalCitations) * 100) : 0,
                watch_mode: LEDGER_WATCH_CONFIG,
            },
            citation_drift: citations,
            repair_history: repairHistory.rows,
        });
    } catch (err: any) {
        console.error('[scorefix/ledger-sync] Error:', err?.message ?? err);
        return res.status(500).json({ error: 'Ledger sync failed', code: 'LEDGER_SYNC_FAILED' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/scorefix/pr-status
// Return all open and recently merged PR statuses for this user.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pr-status', async (req: Request, res: Response) => {
    const userId = (req as any).userId as string;

    try {
        const jobs = await pool.query(
            `SELECT id, url, status, pr_url, pr_number, vcs_provider,
              score_before, score_after, score_delta,
              created_at, updated_at, rescan_completed_at,
              auto_rolled_back
       FROM auto_score_fix_jobs
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC
       LIMIT 50`,
            [userId]
        );

        const open = jobs.rows.filter((r: any) =>
            ['pending', 'generating', 'creating_pr', 'pending_approval'].includes(r.status)
        );
        const merged = jobs.rows.filter((r: any) => r.status === 'approved');
        const rolledBack = jobs.rows.filter((r: any) => r.auto_rolled_back === true);

        return res.json({
            ok: true,
            summary: {
                open: open.length,
                merged: merged.length,
                auto_rolled_back: rolledBack.length,
                max_prs_per_week: LEDGER_WATCH_CONFIG.maxPRsPerWeek,
            },
            jobs: jobs.rows,
        });
    } catch (err: any) {
        console.error('[scorefix/pr-status] Error:', err?.message ?? err);
        return res.status(500).json({ error: 'PR status fetch failed', code: 'PR_STATUS_FAILED' });
    }
});

export default router;
