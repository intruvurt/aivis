/**
 * Replay Engine — versioned pure reducers over the audit ledger.
 *
 * Architecture:
 *   replay(traceId) = fold(reducer.initial(), events, reducer.apply)
 *
 * Determinism guarantees:
 *   - same events + same reducer_version → identical output, always
 *   - different version → different replay space (no cross-contamination)
 *   - snapshot acceleration: load nearest snapshot → fold from offset
 *
 * Output shape (the projection, not storage):
 *  {
 *    score,
 *    citation_state,
 *    entity_graph,
 *    failure_points[],
 *    action_graph[],
 *    confidence_vector,
 *    visibility_index,
 *  }
 *
 * Adding a new reducer version:
 *   1. Copy 'v1' block below, change version string to 'v2.0.0'
 *   2. Write the new initial() + apply() pure functions
 *   3. Register in REDUCER_REGISTRY
 *   Old events replayed with their stored reducer_version remain valid.
 */

import {
    getLedgerEvents,
    loadNearestSnapshot,
    writeSnapshot,
    computeStateHash,
    CURRENT_REDUCER_VERSION,
    type LedgerEventRow,
    type AuditEventType,
} from './ledgerService.js';

// ─── Projection state shape ───────────────────────────────────────────────────
export interface AuditProjection {
    trace_id: string;
    reducer_version: string;

    // Core visibility metrics
    score: number | null;
    confidence_vector: Record<string, number>;
    visibility_index: number | null;

    // Citation truth
    citation_state: {
        total_queries: number;
        cited_count: number;
        uncited_count: number;
        cited_sources: string[];
        missing_sources: string[];
    };

    // Entity knowledge
    entity_graph: {
        name: string | null;
        domain: string | null;
        topics: string[];
        queries: string[];
    };

    // What went wrong
    failure_points: Array<{
        sequence: number;
        event_type: AuditEventType;
        reason: string;
    }>;

    // What to fix
    action_graph: Array<{
        id: string;
        type: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        description: string;
        evidence_ref: string | null;
    }>;

    // Pipeline status
    status: 'started' | 'running' | 'completed' | 'failed';
    started_at: number | null;
    completed_at: number | null;
    last_sequence: number;
}

// ─── Reducer interface ────────────────────────────────────────────────────────
interface Reducer {
    version: string;
    initial: () => AuditProjection;
    apply: (state: AuditProjection, event: LedgerEventRow) => AuditProjection;
}

// ─── v1.0.0 reducer ───────────────────────────────────────────────────────────
const reducerV1: Reducer = {
    version: 'v1.0.0',

    initial(): AuditProjection {
        return {
            trace_id: '',
            reducer_version: 'v1.0.0',
            score: null,
            confidence_vector: {},
            visibility_index: null,
            citation_state: {
                total_queries: 0,
                cited_count: 0,
                uncited_count: 0,
                cited_sources: [],
                missing_sources: [],
            },
            entity_graph: {
                name: null,
                domain: null,
                topics: [],
                queries: [],
            },
            failure_points: [],
            action_graph: [],
            status: 'started',
            started_at: null,
            completed_at: null,
            last_sequence: -1,
        };
    },

    apply(state: AuditProjection, event: LedgerEventRow): AuditProjection {
        // Pure function — never mutate `state` in place.
        const d = event.state_delta as Record<string, unknown>;
        const p = event.payload as Record<string, unknown>;
        const next: AuditProjection = { ...state, last_sequence: event.sequence };

        switch (event.event_type) {
            case 'audit.started': {
                return {
                    ...next,
                    trace_id: String(p.trace_id ?? state.trace_id),
                    status: 'running',
                    started_at: event.ts,
                    entity_graph: {
                        ...next.entity_graph,
                        domain: String(p.url ?? next.entity_graph.domain ?? ''),
                    },
                };
            }

            case 'crawl.complete': {
                return {
                    ...next,
                    entity_graph: {
                        ...next.entity_graph,
                        name: String(d.entity_name ?? next.entity_graph.name ?? ''),
                        domain: String(d.domain ?? next.entity_graph.domain ?? ''),
                        topics: Array.isArray(d.topics)
                            ? (d.topics as string[])
                            : next.entity_graph.topics,
                    },
                };
            }

            case 'entity.resolved': {
                return {
                    ...next,
                    entity_graph: {
                        ...next.entity_graph,
                        name: String(d.name ?? next.entity_graph.name ?? ''),
                        topics: Array.isArray(d.topics)
                            ? (d.topics as string[])
                            : next.entity_graph.topics,
                    },
                };
            }

            case 'query.expanded': {
                const newQueries = Array.isArray(d.queries) ? (d.queries as string[]) : [];
                const existing = new Set(next.entity_graph.queries);
                const merged = [...next.entity_graph.queries, ...newQueries.filter(q => !existing.has(q))];
                return {
                    ...next,
                    entity_graph: { ...next.entity_graph, queries: merged },
                    citation_state: {
                        ...next.citation_state,
                        total_queries: merged.length,
                    },
                };
            }

            case 'citation.tested': {
                const cited = Boolean(d.cited);
                const source = String(d.source ?? '');
                const query = String(d.query ?? '');
                const prevCited = next.citation_state.cited_sources;
                const prevMissing = next.citation_state.missing_sources;

                if (cited) {
                    const already = prevCited.includes(source);
                    return {
                        ...next,
                        citation_state: {
                            ...next.citation_state,
                            cited_count: next.citation_state.cited_count + (already ? 0 : 1),
                            cited_sources: already ? prevCited : [...prevCited, source],
                        },
                    };
                } else {
                    const already = prevMissing.includes(query);
                    const newPoints = already ? next.failure_points : [
                        ...next.failure_points,
                        { sequence: event.sequence, event_type: event.event_type, reason: `Not cited for query: ${query}` },
                    ];
                    return {
                        ...next,
                        citation_state: {
                            ...next.citation_state,
                            uncited_count: next.citation_state.uncited_count + (already ? 0 : 1),
                            missing_sources: already ? prevMissing : [...prevMissing, query],
                        },
                        failure_points: newPoints,
                    };
                }
            }

            case 'ai.reconciled': {
                return {
                    ...next,
                    confidence_vector: typeof d.confidence_vector === 'object' && d.confidence_vector !== null
                        ? (d.confidence_vector as Record<string, number>)
                        : next.confidence_vector,
                };
            }

            case 'score.computed': {
                const rawScore = typeof d.score === 'number' ? d.score : null;
                const rawViz = typeof d.visibility_index === 'number' ? d.visibility_index : null;
                const rawActions = Array.isArray(d.action_graph) ? d.action_graph : [];

                return {
                    ...next,
                    score: rawScore,
                    visibility_index: rawViz,
                    action_graph: rawActions as AuditProjection['action_graph'],
                };
            }

            case 'audit.completed': {
                return {
                    ...next,
                    status: 'completed',
                    completed_at: event.ts,
                };
            }

            case 'audit.failed': {
                return {
                    ...next,
                    status: 'failed',
                    failure_points: [
                        ...next.failure_points,
                        {
                            sequence: event.sequence,
                            event_type: event.event_type,
                            reason: String(p.reason ?? p.error ?? 'unknown failure'),
                        },
                    ],
                };
            }

            default:
                // Unknown event type — identity transition (future-proof)
                return next;
        }
    },
};

// ─── Reducer registry ─────────────────────────────────────────────────────────
const REDUCER_REGISTRY: Record<string, Reducer> = {
    'v1.0.0': reducerV1,
};

function getReducer(version: string): Reducer {
    const r = REDUCER_REGISTRY[version];
    if (!r) {
        // Fall back to latest for unknown versions (graceful degradation).
        console.warn(`[replay] Unknown reducer version ${version}, falling back to ${CURRENT_REDUCER_VERSION}`);
        return REDUCER_REGISTRY[CURRENT_REDUCER_VERSION];
    }
    return r;
}

// ─── Core replay function ─────────────────────────────────────────────────────
/**
 * Pure fold over ordered events.
 * This is the mathematical core:  State(t) = R(S₀, E₁…Eₙ, V)
 *
 * When events span multiple reducer versions (rare upgrade scenario),
 * each event is applied by the reducer that matches its own stored version.
 * The final state uses the latest reducer's shape — cross-version compatibility
 * is maintained because the state shape is additive (new fields default to null).
 */
function foldEvents(
    initial: AuditProjection,
    events: LedgerEventRow[],
): AuditProjection {
    let state = initial;
    for (const event of events) {
        const reducer = getReducer(event.reducer_version);
        state = reducer.apply(state, event);
    }
    return state;
}

// ─── Public: replay from scratch ─────────────────────────────────────────────
export async function replayTrace(
    traceId: string,
    opts?: {
        reducerVersion?: string;
        atSequence?: number;       // replay up to (inclusive) this sequence
        useSnapshot?: boolean;     // default true — load nearest snapshot to accelerate
    },
): Promise<AuditProjection> {
    const reducerVersion = opts?.reducerVersion ?? CURRENT_REDUCER_VERSION;
    const reducer = getReducer(reducerVersion);
    const useSnapshot = opts?.useSnapshot !== false;

    let fromSequence = 0;
    let baseState = reducer.initial();

    // Snapshot acceleration: load nearest snapshot then fold delta
    if (useSnapshot) {
        const snap = await loadNearestSnapshot(traceId, reducerVersion);
        if (snap) {
            // Verify snapshot integrity before trusting
            const expectedHash = computeStateHash(snap.state as Record<string, unknown>);
            if (expectedHash === snap.stateHash) {
                fromSequence = snap.sequenceAt + 1;
                baseState = { ...(snap.state as unknown as AuditProjection) };
            } else {
                console.warn(`[replay] Snapshot hash mismatch for trace ${traceId} — replaying from scratch`);
            }
        }
    }

    const events = await getLedgerEvents(traceId, {
        fromSequence,
        toSequence: opts?.atSequence,
    });

    return foldEvents(baseState, events);
}

// ─── Public: replay at specific timestamp (ms) ───────────────────────────────
export async function replayAtTime(
    traceId: string,
    atMs: number,
    reducerVersion?: string,
): Promise<AuditProjection> {
    const version = reducerVersion ?? CURRENT_REDUCER_VERSION;
    const reducer = getReducer(version);

    // No snapshot optimisation for time-scrubbing — we need exact events
    const allEvents = await getLedgerEvents(traceId);
    const eventsUpToTime = allEvents.filter(e => e.ts <= atMs);

    return foldEvents(reducer.initial(), eventsUpToTime);
}

// ─── Public: replay + auto-snapshot (used by background job) ─────────────────
/**
 * Replay the full trace and persist a snapshot at the final sequence.
 * Call this after audit.completed to prime the snapshot cache.
 */
export async function replayAndSnapshot(
    traceId: string,
    reducerVersion?: string,
): Promise<AuditProjection> {
    const version = reducerVersion ?? CURRENT_REDUCER_VERSION;
    const projection = await replayTrace(traceId, { reducerVersion: version, useSnapshot: false });

    if (projection.last_sequence >= 0) {
        await writeSnapshot({
            traceId,
            sequenceAt: projection.last_sequence,
            state: projection as unknown as Record<string, unknown>,
            reducerVersion: version,
        });
    }

    return projection;
}

// ─── Public: diff two traces (or two points in time of same trace) ───────────
export async function diffTraces(
    traceIdA: string,
    traceIdB: string,
    reducerVersion?: string,
): Promise<{
    score_delta: number | null;
    visibility_delta: number | null;
    citation_delta: number;
    new_failures: AuditProjection['failure_points'];
    resolved_failures: AuditProjection['failure_points'];
}> {
    const version = reducerVersion ?? CURRENT_REDUCER_VERSION;
    const [a, b] = await Promise.all([
        replayTrace(traceIdA, { reducerVersion: version }),
        replayTrace(traceIdB, { reducerVersion: version }),
    ]);

    const failKeysA = new Set(a.failure_points.map(f => f.reason));
    const failKeysB = new Set(b.failure_points.map(f => f.reason));

    return {
        score_delta: a.score !== null && b.score !== null ? b.score - a.score : null,
        visibility_delta: a.visibility_index !== null && b.visibility_index !== null
            ? b.visibility_index - a.visibility_index
            : null,
        citation_delta: b.citation_state.cited_count - a.citation_state.cited_count,
        new_failures: b.failure_points.filter(f => !failKeysA.has(f.reason)),
        resolved_failures: a.failure_points.filter(f => !failKeysB.has(f.reason)),
    };
}
