import { Router, Request, Response } from 'express';
import {
    ensureHomepageAutorunSessionQueued,
    getAuditSessionById,
    getAuditSessionReplayById,
    getCachedSessionId,
    getLatestCompletedHomepageSession,
    HOMEPAGE_TARGET_URL,
    upsertAuditSessionCache,
} from '../services/auditTraceSessionService.js';
import {
    replayTrace,
    replayAtTime,
    diffTraces,
} from '../services/replayEngine.js';
import {
    getLedgerEvents,
    verifyChain,
    CURRENT_REDUCER_VERSION,
} from '../services/ledgerService.js';

const router = Router();

// Public: latest homepage trace session reference.
// Never fabricates a session. If missing, queues a real session and returns explicit unavailability.
router.get('/audit/session/latest', async (_req: Request, res: Response) => {
    try {
        const cachedSessionId = await getCachedSessionId(HOMEPAGE_TARGET_URL);
        if (cachedSessionId) {
            const cached = await getAuditSessionById(cachedSessionId);
            if (cached && cached.session.status === 'completed') {
                res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=30');
                return res.json({
                    ok: true,
                    capability: 'public_trace_artifact',
                    tier_gate: 'none',
                    source: 'persisted_session',
                    ttl_seconds: 300,
                    session: cached.session,
                    events: cached.events,
                });
            }
        }

        const artifact = await getLatestCompletedHomepageSession();
        if (!artifact) {
            const queuedSessionId = await ensureHomepageAutorunSessionQueued();
            return res.status(202).json({
                ok: false,
                capability: 'public_trace_artifact',
                tier_gate: 'none',
                code: 'NO_COMPLETED_SESSION_AVAILABLE',
                message: 'No completed homepage audit session is available yet.',
                queued_session_id: queuedSessionId,
            });
        }

        await upsertAuditSessionCache({
            url: HOMEPAGE_TARGET_URL,
            sessionId: artifact.session.id,
            ttlSeconds: 300,
        });

        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=30');
        return res.json({
            ok: true,
            capability: 'public_trace_artifact',
            tier_gate: 'none',
            source: 'persisted_session',
            ttl_seconds: 300,
            session: artifact.session,
            events: artifact.events,
        });
    } catch (error) {
        console.error('[audit-trace] latest endpoint error:', error);
        return res.status(500).json({ ok: false, code: 'TRACE_SESSION_FETCH_FAILED' });
    }
});

// Public: immutable retrieval by id.
router.get('/audit/session/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) {
            return res.status(400).json({ ok: false, code: 'SESSION_ID_REQUIRED' });
        }

        const artifact = await getAuditSessionById(id);
        if (!artifact) {
            return res.status(404).json({ ok: false, code: 'SESSION_NOT_FOUND' });
        }

        // Public surface must only expose homepage artifact sessions.
        if (artifact.session.session_type !== 'homepage') {
            return res.status(403).json({ ok: false, code: 'SESSION_NOT_PUBLIC' });
        }

        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=30');
        return res.json({
            ok: true,
            capability: 'public_trace_artifact',
            tier_gate: 'none',
            source: 'persisted_session',
            ttl_seconds: 300,
            session: artifact.session,
            events: artifact.events,
        });
    } catch (error) {
        console.error('[audit-trace] session endpoint error:', error);
        return res.status(500).json({ ok: false, code: 'TRACE_SESSION_FETCH_FAILED' });
    }
});

// Public: deterministic replay frames for time-scrubbing UI.
// Query:
// - at_ms: scrub cursor in milliseconds from session start
// - window_ms: optional emitted window, e.g. 3000 for trailing 3s
router.get('/audit/session/:id/replay', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) {
            return res.status(400).json({ ok: false, code: 'SESSION_ID_REQUIRED' });
        }

        const atRaw = req.query.at_ms;
        const windowRaw = req.query.window_ms;

        const atMs = atRaw === undefined ? undefined : Number(atRaw);
        if (atMs !== undefined && !Number.isFinite(atMs)) {
            return res.status(400).json({ ok: false, code: 'INVALID_AT_MS' });
        }

        const windowMs = windowRaw === undefined ? undefined : Number(windowRaw);
        if (windowMs !== undefined && !Number.isFinite(windowMs)) {
            return res.status(400).json({ ok: false, code: 'INVALID_WINDOW_MS' });
        }

        const replay = await getAuditSessionReplayById({
            sessionId: id,
            atMs,
            windowMs,
        });

        if (!replay) {
            return res.status(404).json({ ok: false, code: 'SESSION_NOT_FOUND' });
        }

        if (replay.session.session_type !== 'homepage') {
            return res.status(403).json({ ok: false, code: 'SESSION_NOT_PUBLIC' });
        }

        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
        return res.json({
            ok: true,
            capability: 'public_trace_replay',
            tier_gate: 'none',
            source: 'persisted_session',
            replay,
        });
    } catch (error) {
        console.error('[audit-trace] replay endpoint error:', error);
        return res.status(500).json({ ok: false, code: 'TRACE_REPLAY_FETCH_FAILED' });
    }
});

// Public: replay for latest completed homepage session.
router.get('/audit/session/latest/replay', async (req: Request, res: Response) => {
    try {
        const latest = await getLatestCompletedHomepageSession();
        if (!latest) {
            const queuedSessionId = await ensureHomepageAutorunSessionQueued();
            return res.status(202).json({
                ok: false,
                capability: 'public_trace_replay',
                tier_gate: 'none',
                code: 'NO_COMPLETED_SESSION_AVAILABLE',
                message: 'No completed homepage audit session is available yet.',
                queued_session_id: queuedSessionId,
            });
        }

        const atRaw = req.query.at_ms;
        const windowRaw = req.query.window_ms;
        const atMs = atRaw === undefined ? undefined : Number(atRaw);
        const windowMs = windowRaw === undefined ? undefined : Number(windowRaw);

        if (atMs !== undefined && !Number.isFinite(atMs)) {
            return res.status(400).json({ ok: false, code: 'INVALID_AT_MS' });
        }
        if (windowMs !== undefined && !Number.isFinite(windowMs)) {
            return res.status(400).json({ ok: false, code: 'INVALID_WINDOW_MS' });
        }

        const replay = await getAuditSessionReplayById({
            sessionId: latest.session.id,
            atMs,
            windowMs,
        });

        if (!replay) {
            return res.status(404).json({ ok: false, code: 'SESSION_NOT_FOUND' });
        }

        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
        return res.json({
            ok: true,
            capability: 'public_trace_replay',
            tier_gate: 'none',
            source: 'persisted_session',
            replay,
        });
    } catch (error) {
        console.error('[audit-trace] latest replay endpoint error:', error);
        return res.status(500).json({ ok: false, code: 'TRACE_REPLAY_FETCH_FAILED' });
    }
});

// ─── Deterministic ledger endpoints ──────────────────────────────────────────

/**
 * GET /api/public/audit/ledger/:traceId/projection
 *
 * Returns the fully replayed AuditProjection for a trace.
 * Accepts optional query params:
 *   - at_ms: replay up to this server timestamp (time scrubbing)
 *   - reducer_version: override reducer (default: current)
 */
router.get('/audit/ledger/:traceId/projection', async (req: Request, res: Response) => {
    try {
        const traceId = String(req.params.traceId || '').trim();
        if (!traceId) return res.status(400).json({ ok: false, code: 'TRACE_ID_REQUIRED' });

        const atMsRaw = req.query.at_ms;
        const reducerVersion = String(req.query.reducer_version || CURRENT_REDUCER_VERSION);

        if (atMsRaw !== undefined) {
            const atMs = Number(atMsRaw);
            if (!Number.isFinite(atMs)) {
                return res.status(400).json({ ok: false, code: 'INVALID_AT_MS' });
            }
            const projection = await replayAtTime(traceId, atMs, reducerVersion);
            res.setHeader('Cache-Control', 'public, max-age=30');
            return res.json({ ok: true, projection, replayed_at_ms: atMs });
        }

        const projection = await replayTrace(traceId, { reducerVersion });
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
        return res.json({ ok: true, projection });
    } catch (error) {
        console.error('[ledger] projection endpoint error:', error);
        return res.status(500).json({ ok: false, code: 'PROJECTION_FAILED' });
    }
});

/**
 * GET /api/public/audit/ledger/:traceId/events
 *
 * Returns the raw ordered event stream for a trace (for UI time-scrubbing).
 * Accepts optional query params:
 *   - from_sequence: start index (default 0)
 *   - limit: max events (default 500, max 2000)
 */
router.get('/audit/ledger/:traceId/events', async (req: Request, res: Response) => {
    try {
        const traceId = String(req.params.traceId || '').trim();
        if (!traceId) return res.status(400).json({ ok: false, code: 'TRACE_ID_REQUIRED' });

        const fromSequence = Number(req.query.from_sequence ?? 0);
        const limit = Math.min(Number(req.query.limit ?? 500), 2000);

        if (!Number.isFinite(fromSequence) || !Number.isFinite(limit)) {
            return res.status(400).json({ ok: false, code: 'INVALID_PARAMS' });
        }

        const events = await getLedgerEvents(traceId, { fromSequence, limit });

        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        return res.json({ ok: true, trace_id: traceId, events, count: events.length });
    } catch (error) {
        console.error('[ledger] events endpoint error:', error);
        return res.status(500).json({ ok: false, code: 'EVENTS_FETCH_FAILED' });
    }
});

/**
 * GET /api/public/audit/ledger/:traceId/verify
 *
 * Verifies the hash chain integrity for a trace.
 * O(n) — do not call in hot paths.
 */
router.get('/audit/ledger/:traceId/verify', async (req: Request, res: Response) => {
    try {
        const traceId = String(req.params.traceId || '').trim();
        if (!traceId) return res.status(400).json({ ok: false, code: 'TRACE_ID_REQUIRED' });

        const result = await verifyChain(traceId);
        return res.json({ ok: true, trace_id: traceId, chain_valid: result });
    } catch (error) {
        console.error('[ledger] verify endpoint error:', error);
        return res.status(500).json({ ok: false, code: 'VERIFY_FAILED' });
    }
});

/**
 * GET /api/public/audit/ledger/diff
 *
 * Deterministic diff of two traces.
 * Query params: trace_a, trace_b, reducer_version (optional)
 */
router.get('/audit/ledger/diff', async (req: Request, res: Response) => {
    try {
        const traceA = String(req.query.trace_a || '').trim();
        const traceB = String(req.query.trace_b || '').trim();
        if (!traceA || !traceB) {
            return res.status(400).json({ ok: false, code: 'BOTH_TRACE_IDS_REQUIRED' });
        }
        const reducerVersion = String(req.query.reducer_version || CURRENT_REDUCER_VERSION);
        const diff = await diffTraces(traceA, traceB, reducerVersion);
        return res.json({ ok: true, trace_a: traceA, trace_b: traceB, diff });
    } catch (error) {
        console.error('[ledger] diff endpoint error:', error);
        return res.status(500).json({ ok: false, code: 'DIFF_FAILED' });
    }
});

export default router;
