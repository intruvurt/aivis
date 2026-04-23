import { getPool } from './postgresql.js';

export type AuditSessionStatus = 'queued' | 'running' | 'completed' | 'failed';
export type AuditSessionType = 'homepage' | 'user_url' | 'api_call';
export type AuditSessionSource = 'homepage_autorun' | 'user_request' | 'api';

export interface AuditTraceEventRow {
    id: string;
    session_id: string;
    event_type: string;
    event_payload: Record<string, unknown>;
    sequence_index: number;
    created_at: string;
}

export interface AuditTraceSessionRow {
    id: string;
    target_url: string;
    status: AuditSessionStatus;
    session_type: AuditSessionType;
    source: AuditSessionSource;
    execution_class: string;
    event_schema_version: number;
    created_at: string;
    completed_at: string | null;
    final_score: number | null;
    final_score_vector: Record<string, unknown> | null;
    execution_time_ms: number | null;
}

export interface AuditTraceSessionArtifact {
    session: AuditTraceSessionRow;
    events: AuditTraceEventRow[];
}

export interface ReplayFrame {
    event_id: string;
    sequence_index: number;
    timestamp: string;
    replay_ms: number;
    event_type: string;
    event_payload: Record<string, unknown>;
}

export interface AuditReplayArtifact {
    session: AuditTraceSessionRow;
    duration_ms: number;
    at_ms: number;
    active_sequence_index: number | null;
    emitted_count: number;
    total_count: number;
    frames: ReplayFrame[];
}

export const HOMEPAGE_TARGET_URL = 'https://aivis.biz/';

function stableUrl(input: string): string {
    const trimmed = String(input || '').trim();
    if (!trimmed) return HOMEPAGE_TARGET_URL;
    try {
        const url = new URL(trimmed);
        if (!url.pathname || url.pathname === '') url.pathname = '/';
        if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
        url.hash = '';
        url.search = '';
        return url.toString();
    } catch {
        return HOMEPAGE_TARGET_URL;
    }
}

export async function createAuditSession(input: {
    targetUrl: string;
    sessionType: AuditSessionType;
    source: AuditSessionSource;
    status?: AuditSessionStatus;
    executionClass?: string;
    eventSchemaVersion?: number;
}): Promise<AuditTraceSessionRow> {
    const pool = getPool();
    const { rows } = await pool.query(
        `INSERT INTO audit_sessions (
      target_url,
      status,
      session_type,
      source,
      execution_class,
      event_schema_version
    )
    VALUES ($1, COALESCE($2, 'queued'), $3, $4, COALESCE($5, 'observer'), COALESCE($6, 1))
    RETURNING *`,
        [
            stableUrl(input.targetUrl),
            input.status || 'queued',
            input.sessionType,
            input.source,
            input.executionClass || 'observer',
            input.eventSchemaVersion || 1,
        ],
    );
    return rows[0] as AuditTraceSessionRow;
}

export async function appendAuditEvent(input: {
    sessionId: string;
    eventType: string;
    eventPayload?: Record<string, unknown>;
}): Promise<AuditTraceEventRow> {
    const pool = getPool();
    const { rows } = await pool.query(
        `WITH next_idx AS (
      SELECT COALESCE(MAX(sequence_index), -1) + 1 AS sequence_index
      FROM audit_events
      WHERE session_id = $1
    )
    INSERT INTO audit_events (session_id, event_type, event_payload, sequence_index)
    SELECT $1, $2, COALESCE($3::jsonb, '{}'::jsonb), next_idx.sequence_index
    FROM next_idx
    RETURNING *`,
        [input.sessionId, input.eventType, JSON.stringify(input.eventPayload || {})],
    );
    return rows[0] as AuditTraceEventRow;
}

export async function finalizeAuditSession(input: {
    sessionId: string;
    status: 'completed' | 'failed';
    finalScore?: number | null;
    finalScoreVector?: Record<string, unknown> | null;
    executionTimeMs?: number | null;
}): Promise<void> {
    const pool = getPool();
    await pool.query(
        `UPDATE audit_sessions
      SET status = $2,
          final_score = $3,
          final_score_vector = COALESCE($4::jsonb, final_score_vector),
          execution_time_ms = COALESCE($5, execution_time_ms),
          completed_at = NOW()
      WHERE id = $1`,
        [
            input.sessionId,
            input.status,
            input.finalScore ?? null,
            input.finalScoreVector ? JSON.stringify(input.finalScoreVector) : null,
            input.executionTimeMs ?? null,
        ],
    );
}

export async function getAuditSessionById(sessionId: string): Promise<AuditTraceSessionArtifact | null> {
    const pool = getPool();
    const sessionRes = await pool.query(
        `SELECT * FROM audit_sessions WHERE id = $1 LIMIT 1`,
        [sessionId],
    );
    const session = sessionRes.rows[0] as AuditTraceSessionRow | undefined;
    if (!session) return null;

    const eventsRes = await pool.query(
        `SELECT *
     FROM audit_events
     WHERE session_id = $1
     ORDER BY sequence_index ASC, created_at ASC`,
        [sessionId],
    );

    return {
        session,
        events: eventsRes.rows as AuditTraceEventRow[],
    };
}

export async function getLatestCompletedHomepageSession(): Promise<AuditTraceSessionArtifact | null> {
    const pool = getPool();
    const targetUrl = stableUrl(HOMEPAGE_TARGET_URL);
    const { rows } = await pool.query(
        `SELECT *
     FROM audit_sessions
     WHERE target_url = $1
       AND session_type = 'homepage'
       AND source = 'homepage_autorun'
       AND status = 'completed'
     ORDER BY completed_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
        [targetUrl],
    );

    const session = rows[0] as AuditTraceSessionRow | undefined;
    if (!session) return null;

    const eventsRes = await pool.query(
        `SELECT *
     FROM audit_events
     WHERE session_id = $1
     ORDER BY sequence_index ASC, created_at ASC`,
        [session.id],
    );

    return {
        session,
        events: eventsRes.rows as AuditTraceEventRow[],
    };
}

export async function ensureHomepageAutorunSessionQueued(): Promise<string | null> {
    const pool = getPool();
    const targetUrl = stableUrl(HOMEPAGE_TARGET_URL);

    const active = await pool.query(
        `SELECT id
     FROM audit_sessions
     WHERE target_url = $1
       AND session_type = 'homepage'
       AND source = 'homepage_autorun'
       AND status IN ('queued', 'running')
     ORDER BY created_at DESC
     LIMIT 1`,
        [targetUrl],
    );

    if (active.rows[0]?.id) {
        return String(active.rows[0].id);
    }

    const inserted = await createAuditSession({
        targetUrl,
        sessionType: 'homepage',
        source: 'homepage_autorun',
        status: 'queued',
        executionClass: 'observer',
        eventSchemaVersion: 1,
    });

    return inserted.id;
}

export async function upsertAuditSessionCache(input: {
    url: string;
    sessionId: string;
    ttlSeconds: number;
}): Promise<void> {
    const pool = getPool();
    const url = stableUrl(input.url);
    await pool.query(
        `INSERT INTO audit_session_cache (url, session_id, ttl_expires_at)
     VALUES ($1, $2, NOW() + make_interval(secs => $3))
     ON CONFLICT (url)
     DO UPDATE SET
       session_id = EXCLUDED.session_id,
       last_updated = NOW(),
       ttl_expires_at = EXCLUDED.ttl_expires_at`,
        [url, input.sessionId, Math.max(1, Math.floor(input.ttlSeconds))],
    );
}

export async function getCachedSessionId(urlInput: string): Promise<string | null> {
    const pool = getPool();
    const url = stableUrl(urlInput);
    const { rows } = await pool.query(
        `SELECT session_id
     FROM audit_session_cache
     WHERE url = $1
       AND ttl_expires_at > NOW()
     LIMIT 1`,
        [url],
    );
    return rows[0]?.session_id ? String(rows[0].session_id) : null;
}

function toMs(input: string): number {
    const value = Date.parse(input);
    return Number.isFinite(value) ? value : 0;
}

function toReplayFrames(events: AuditTraceEventRow[]): ReplayFrame[] {
    if (events.length === 0) return [];
    const firstMs = toMs(events[0].created_at);
    return events.map((event) => {
        const createdMs = toMs(event.created_at);
        const replayMs = Math.max(0, createdMs - firstMs);
        return {
            event_id: event.id,
            sequence_index: event.sequence_index,
            timestamp: event.created_at,
            replay_ms: replayMs,
            event_type: event.event_type,
            event_payload: event.event_payload || {},
        };
    });
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export async function getAuditSessionReplayById(input: {
    sessionId: string;
    atMs?: number;
    windowMs?: number;
}): Promise<AuditReplayArtifact | null> {
    const artifact = await getAuditSessionById(input.sessionId);
    if (!artifact) return null;

    const framesAll = toReplayFrames(artifact.events);
    const durationMs = framesAll.length > 0
        ? framesAll[framesAll.length - 1].replay_ms
        : Math.max(0, Number(artifact.session.execution_time_ms || 0));
    const rawAt = Number.isFinite(input.atMs as number) ? Number(input.atMs) : durationMs;
    const atMs = clamp(Math.floor(rawAt), 0, durationMs);

    const emittedAll = framesAll.filter((frame) => frame.replay_ms <= atMs);
    const windowMs = Number.isFinite(input.windowMs as number)
        ? Math.max(0, Math.floor(Number(input.windowMs)))
        : null;

    const frames = windowMs === null
        ? emittedAll
        : emittedAll.filter((frame) => frame.replay_ms >= Math.max(0, atMs - windowMs));

    const active = emittedAll.length > 0 ? emittedAll[emittedAll.length - 1] : null;

    return {
        session: artifact.session,
        duration_ms: durationMs,
        at_ms: atMs,
        active_sequence_index: active ? active.sequence_index : null,
        emitted_count: emittedAll.length,
        total_count: framesAll.length,
        frames,
    };
}
