/**
 * Analyze Pipeline Ledger Hook
 *
 * Converts the /api/analyze pipeline into a streaming ledger writer.
 * Every stage fires appendLedgerEvent() non-blocking (fire-and-detach).
 *
 * Usage (in server.ts analyze handler):
 *
 *   const ledger = createAnalysisLedgerContext(requestId, targetUrl);
 *
 *   await ledger.started({ url: targetUrl });
 *
 *   //  ... scraper runs ...
 *   await ledger.crawlComplete({ scrapeResult });
 *
 *   //  ... citation tests run ...
 *   await ledger.citationTested({ query, cited, source });
 *
 *   //  after res.json():
 *   ledger.scoreComputed({ score, visibilityIndex, actionGraph }).catch(noop);
 *   ledger.completed({ score }).catch(noop);
 *
 * The context object serialises all writes for the same trace_id so sequence
 * is strictly monotonic even when called rapidly.
 *
 * Design:
 *   - Each method computes state_delta from its inputs → pure reducer input
 *   - Caller never sees ledger errors (all caught + logged, never thrown)
 *   - Safe to call in fire-and-forget (.catch(noop)) after response is sent
 */

import {
    appendLedgerEvent,
    CURRENT_REDUCER_VERSION,
    type AuditEventType,
} from './ledgerService.js';
import { replayAndSnapshot } from './replayEngine.js';

type Noop = () => void;
const noop: Noop = () => undefined;

// ─── Per-request ledger context ───────────────────────────────────────────────
export interface AnalysisLedgerContext {
    traceId: string;

    /** Stage 1: audit.started */
    started(payload: { url: string; tier?: string; userId?: string }): Promise<void>;

    /** Stage 2: crawl.complete */
    crawlComplete(payload: {
        url: string;
        entityName?: string;
        domain?: string;
        topics?: string[];
        wordCount?: number;
    }): Promise<void>;

    /** Stage 3: entity.resolved */
    entityResolved(payload: {
        name?: string;
        domain?: string;
        topics?: string[];
    }): Promise<void>;

    /** Stage 4: query.expanded */
    queryExpanded(payload: { queries: string[] }): Promise<void>;

    /** Stage 5: citation.tested (call once per query-result pair) */
    citationTested(payload: {
        query: string;
        cited: boolean;
        source?: string;
        engine?: string;
    }): Promise<void>;

    /** Stage 6: ai.reconciled */
    aiReconciled(payload: {
        models: string[];
        confidenceVector: Record<string, number>;
    }): Promise<void>;

    /** Stage 7: score.computed */
    scoreComputed(payload: {
        score: number;
        visibilityIndex?: number;
        actionGraph?: Array<{ id: string; type: string; priority: string; description: string; evidence_ref?: string }>;
    }): Promise<void>;

    /** Stage 8a: audit.completed */
    completed(payload: { score?: number }): Promise<void>;

    /** Stage 8b: audit.failed */
    failed(payload: { reason: string; error?: string }): Promise<void>;

    /** Snapshot the projection (call after completed, fire-and-forget) */
    snapshot(): Promise<void>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────
/**
 * Create a ledger context for one analysis run.
 * All writes are serialized via a microtask queue so sequence is monotonic.
 */
export function createAnalysisLedgerContext(
    traceId: string,
    reducerVersion = CURRENT_REDUCER_VERSION,
): AnalysisLedgerContext {
    // Serialisation: chain the next write onto the previous promise.
    // This guarantees sequential execution even when rapid fire-and-forget.
    let chain: Promise<unknown> = Promise.resolve();

    function schedule(
        eventType: AuditEventType,
        payload: Record<string, unknown>,
        stateDelta: Record<string, unknown>,
    ): Promise<void> {
        chain = chain.then(() =>
            appendLedgerEvent({
                traceId,
                eventType,
                payload,
                stateDelta,
                reducerVersion,
            }).catch((err: unknown) => {
                // Ledger writes must never crash the analysis pipeline.
                console.error(`[ledger] Write failed for trace ${traceId} event ${eventType}:`, err);
            }),
        );
        return chain as Promise<void>;
    }

    return {
        traceId,

        started({ url, tier, userId }) {
            return schedule(
                'audit.started',
                { url, tier: tier ?? null, user_id: userId ?? null },
                { url, tier: tier ?? null },
            );
        },

        crawlComplete({ url, entityName, domain, topics, wordCount }) {
            return schedule(
                'crawl.complete',
                { url },
                {
                    entity_name: entityName ?? null,
                    domain: domain ?? null,
                    topics: topics ?? [],
                    word_count: wordCount ?? null,
                },
            );
        },

        entityResolved({ name, domain, topics }) {
            return schedule(
                'entity.resolved',
                {},
                {
                    name: name ?? null,
                    domain: domain ?? null,
                    topics: topics ?? [],
                },
            );
        },

        queryExpanded({ queries }) {
            return schedule(
                'query.expanded',
                { count: queries.length },
                { queries },
            );
        },

        citationTested({ query, cited, source, engine }) {
            return schedule(
                'citation.tested',
                { query, engine: engine ?? null },
                {
                    cited: cited,
                    source: source ?? null,
                    query,
                },
            );
        },

        aiReconciled({ models, confidenceVector }) {
            return schedule(
                'ai.reconciled',
                { models },
                { confidence_vector: confidenceVector },
            );
        },

        scoreComputed({ score, visibilityIndex, actionGraph }) {
            return schedule(
                'score.computed',
                { score },
                {
                    score,
                    visibility_index: visibilityIndex ?? null,
                    action_graph: actionGraph ?? [],
                },
            );
        },

        completed({ score }) {
            return schedule(
                'audit.completed',
                { score: score ?? null },
                { score: score ?? null },
            );
        },

        failed({ reason, error }) {
            return schedule(
                'audit.failed',
                { reason, error: error ?? null },
                { reason, error: error ?? null },
            );
        },

        async snapshot(): Promise<void> {
            try {
                await chain; // wait for all pending writes first
                await replayAndSnapshot(traceId, reducerVersion);
            } catch (err: unknown) {
                console.error(`[ledger] Snapshot failed for trace ${traceId}:`, err);
            }
        },
    };
}

// ─── Convenience: fire-and-forget wrapper ─────────────────────────────────────
/**
 * Wraps any ledger write so it never propagates errors to the caller.
 * Use this for writes after res.json() is already sent.
 */
export function fireLedgerEvent(p: Promise<void>): void {
    p.catch(noop);
}
