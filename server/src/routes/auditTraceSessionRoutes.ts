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
            return res.status(503).json({
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
            return res.status(503).json({
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

export default router;
