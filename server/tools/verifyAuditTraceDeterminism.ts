import 'dotenv/config';
import { getPool } from '../src/services/postgresql.js';
import { HOMEPAGE_TARGET_URL } from '../src/services/auditTraceSessionService.js';

type SessionRow = {
    id: string;
    target_url: string;
    completed_at: string;
    final_score_vector: Record<string, unknown> | null;
};

type EventRow = {
    session_id: string;
    event_type: string;
    sequence_index: number;
    created_at: string;
};

function toCanonicalScoreVector(value: Record<string, unknown> | null): string {
    if (!value) return '{}';
    const keys = Object.keys(value).sort();
    const obj: Record<string, unknown> = {};
    for (const key of keys) {
        const v = value[key];
        if (typeof v === 'number') {
            obj[key] = Number(v.toFixed(6));
        } else {
            obj[key] = v;
        }
    }
    return JSON.stringify(obj);
}

function validateStrictSequence(events: EventRow[]): { ok: boolean; reason?: string } {
    if (events.length === 0) {
        return { ok: false, reason: 'no events present' };
    }

    for (let i = 0; i < events.length; i++) {
        const expected = i;
        if (events[i].sequence_index !== expected) {
            return {
                ok: false,
                reason: `non-contiguous sequence index at position ${i}: got=${events[i].sequence_index} expected=${expected}`,
            };
        }
    }

    return { ok: true };
}

function eventTypeOrderingSignature(events: EventRow[]): string {
    return events
        .sort((a, b) => a.sequence_index - b.sequence_index)
        .map((e) => e.event_type)
        .join('|');
}

async function main() {
    const databaseUrl = String(process.env.DATABASE_URL || '').trim();
    const strictMode = String(process.env.AUDIT_TRACE_DETERMINISM_STRICT || '').toLowerCase() === 'true';
    if (!databaseUrl) {
        console.log('[AuditTraceDeterminism] SKIP - DATABASE_URL not configured');
        process.exit(0);
    }

    const targetUrl = String(process.env.AUDIT_TRACE_DETERMINISM_TARGET_URL || HOMEPAGE_TARGET_URL).trim();
    const source = String(process.env.AUDIT_TRACE_DETERMINISM_SOURCE || 'homepage_autorun').trim();

    const pool = getPool();

    let sessionsRes;
    try {
        sessionsRes = await pool.query(
            `SELECT id, target_url, completed_at, final_score_vector
     FROM audit_sessions
     WHERE target_url = $1
       AND session_type = 'homepage'
       AND source = $2
       AND status = 'completed'
     ORDER BY completed_at DESC NULLS LAST, created_at DESC
     LIMIT 2`,
            [targetUrl, source],
        );
    } catch (error: any) {
        const message = String(error?.message || error || 'unknown database error');
        if (!strictMode) {
            console.log(`[AuditTraceDeterminism] SKIP - unable to reach database: ${message}`);
            process.exit(0);
        }
        throw error;
    }

    const sessions = sessionsRes.rows as SessionRow[];
    if (sessions.length < 2) {
        console.error('[AuditTraceDeterminism] FAIL - Need at least 2 completed sessions for equivalence check');
        console.error(`[AuditTraceDeterminism] target_url=${targetUrl} source=${source} found=${sessions.length}`);
        process.exit(1);
    }

    const [latest, previous] = sessions;

    const eventsRes = await pool.query(
        `SELECT session_id, event_type, sequence_index, created_at
     FROM audit_events
     WHERE session_id = ANY($1::uuid[])
     ORDER BY session_id, sequence_index ASC, created_at ASC`,
        [[latest.id, previous.id]],
    );

    const allEvents = eventsRes.rows as EventRow[];
    const latestEvents = allEvents.filter((e) => e.session_id === latest.id);
    const previousEvents = allEvents.filter((e) => e.session_id === previous.id);

    const latestSeq = validateStrictSequence(latestEvents);
    if (!latestSeq.ok) {
        console.error(`[AuditTraceDeterminism] FAIL - latest session ordering invalid: ${latestSeq.reason}`);
        process.exit(1);
    }

    const previousSeq = validateStrictSequence(previousEvents);
    if (!previousSeq.ok) {
        console.error(`[AuditTraceDeterminism] FAIL - previous session ordering invalid: ${previousSeq.reason}`);
        process.exit(1);
    }

    const latestSig = eventTypeOrderingSignature(latestEvents);
    const previousSig = eventTypeOrderingSignature(previousEvents);
    if (latestSig !== previousSig) {
        console.error('[AuditTraceDeterminism] FAIL - event ordering/type signature mismatch');
        console.error(`[AuditTraceDeterminism] latest:   ${latestSig}`);
        console.error(`[AuditTraceDeterminism] previous: ${previousSig}`);
        process.exit(1);
    }

    const latestVector = toCanonicalScoreVector(latest.final_score_vector);
    const previousVector = toCanonicalScoreVector(previous.final_score_vector);
    if (latestVector !== previousVector) {
        console.error('[AuditTraceDeterminism] FAIL - final_score_vector mismatch');
        console.error(`[AuditTraceDeterminism] latest:   ${latestVector}`);
        console.error(`[AuditTraceDeterminism] previous: ${previousVector}`);
        process.exit(1);
    }

    console.log('[AuditTraceDeterminism] PASS');
    console.log(`[AuditTraceDeterminism] session_latest=${latest.id}`);
    console.log(`[AuditTraceDeterminism] session_previous=${previous.id}`);
    console.log(`[AuditTraceDeterminism] events=${latestEvents.length}`);
}

main().catch((error) => {
    console.error('[AuditTraceDeterminism] FAIL - uncaught error');
    console.error(error);
    process.exit(1);
});
