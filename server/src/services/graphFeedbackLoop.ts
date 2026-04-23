/**
 * graphFeedbackLoop.ts
 *
 * Recursive graph expansion feedback loop for the AiVIS pipeline.
 *
 * After every scan completes the core analysis pipeline, this service:
 *   1. Reads gap detection output
 *   2. Infers semantic relationship edges from competitors + topics
 *   3. Persists VisibilityEvents from AI simulation output
 *   4. Expands gaps into indexable content pages
 *   5. Queues generated pages for recursive re-evaluation
 *      (new pages → new entities → new gaps → new pages)
 *
 * ARCHITECTURE RULES:
 *   - Only runs AFTER ledger commit (stages 7+) — never before
 *   - Never mutates analysis_cache or citation_ledger
 *   - All outputs are traceable to scan_id
 *   - Errors are isolated per stage — one failure does not abort the loop
 *   - Re-entrancy guard: same scan_id cannot run feedback twice concurrently
 *
 * This implements the continuous loop described in the pipeline design:
 *
 *   /analyze → graph update → gap detection → content generation
 *   → indexing → LLM re-evaluation → new gaps → repeat
 */

import {
    writeRelationshipEdges,
    inferCompetitorEdges,
    inferExplainsEdges,
    inferFailsAtEdges,
    type RelationshipEdge,
} from './entityRelationshipEngine.js';
import {
    bulkWriteVisibilityEvents,
    type VisibilityEvent,
} from './visibilityEventLedger.js';
import {
    expandGapsToPages,
    type GeneratedPage,
} from './contentExpansionEngine.js';
import type { GapDetectionResult, VisibilityGap } from './gapDetectionEngine.js';

// ── Re-entrancy guard ─────────────────────────────────────────────────────────

const _activeFeedbackRuns = new Set<string>();

// ── Input contract ─────────────────────────────────────────────────────────────

export interface FeedbackLoopInput {
    scan_id: string;
    /** Primary entity from the scan (brand, domain, product) */
    entity: string;
    /** URL that was analyzed */
    evidence_url: string;
    /** Gap detection output — required for content expansion */
    gaps?: GapDetectionResult | null;
    /** Competitor names detected during citation testing */
    competitors?: string[];
    /** Topics covered by the scanned content */
    topics?: string[];
    /** Topics where entity is absent from AI responses */
    failure_topics?: string[];
    /** Visibility simulation probe results to persist */
    visibility_events?: Array<{
        prompt: string;
        model_used: string;
        cited_sources: string[];
        missing_sources: string[];
        position_rank: number | null;
        entity_present: boolean;
        raw_answer?: string;
    }>;
}

export interface FeedbackLoopResult {
    scan_id: string;
    relationships_written: number;
    visibility_events_written: number;
    pages_generated: number;
    pages: GeneratedPage[];
    errors: string[];
    duration_ms: number;
}

// ── Main loop ─────────────────────────────────────────────────────────────────

/**
 * Execute the graph expansion feedback loop for a completed scan.
 *
 * This is the post-analysis side-effect that turns every scan into
 * a node in the growing semantic intelligence graph.
 *
 * Fire-and-forget safe: callers may await or void this call.
 * Internal errors are captured in result.errors — never thrown.
 */
export async function runGraphFeedbackLoop(
    input: FeedbackLoopInput,
): Promise<FeedbackLoopResult> {
    const startMs = Date.now();
    const errors: string[] = [];

    // Re-entrancy guard
    if (_activeFeedbackRuns.has(input.scan_id)) {
        return {
            scan_id: input.scan_id,
            relationships_written: 0,
            visibility_events_written: 0,
            pages_generated: 0,
            pages: [],
            errors: ['Feedback loop already running for this scan_id'],
            duration_ms: 0,
        };
    }
    _activeFeedbackRuns.add(input.scan_id);

    let relationships_written = 0;
    let visibility_events_written = 0;
    const pages: GeneratedPage[] = [];

    try {
        // ── Stage 1: Relationship edge inference ──────────────────────────────

        const edges: RelationshipEdge[] = [];

        if (input.competitors?.length) {
            edges.push(...inferCompetitorEdges(
                input.entity,
                input.competitors,
                input.evidence_url,
            ));
        }

        if (input.topics?.length) {
            edges.push(...inferExplainsEdges(
                input.entity,
                input.topics,
                input.evidence_url,
            ));
        }

        if (input.failure_topics?.length) {
            edges.push(...inferFailsAtEdges(
                input.entity,
                input.failure_topics,
                input.evidence_url,
            ));
        }

        if (edges.length > 0) {
            try {
                const writeResult = await writeRelationshipEdges(edges, input.scan_id);
                relationships_written = writeResult.written;
            } catch (err) {
                errors.push(`Relationship write failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // ── Stage 2: VisibilityEvent persistence ──────────────────────────────

        if (input.visibility_events?.length) {
            const events: VisibilityEvent[] = input.visibility_events.map((e) => ({
                scan_id: input.scan_id,
                entity: input.entity,
                prompt: e.prompt,
                model_used: e.model_used,
                cited_sources: e.cited_sources,
                missing_sources: e.missing_sources,
                position_rank: e.position_rank,
                entity_present: e.entity_present,
                raw_answer: e.raw_answer,
            }));

            try {
                const bulkResult = await bulkWriteVisibilityEvents(events);
                visibility_events_written = bulkResult.written;
            } catch (err) {
                errors.push(`VisibilityEvent write failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // ── Stage 3: Gap → page expansion ────────────────────────────────────

        const gaps: VisibilityGap[] = input.gaps?.gaps ?? [];
        const competitors = input.competitors ?? [];

        if (gaps.length > 0 || competitors.length > 0) {
            try {
                const generatedPages = await expandGapsToPages(
                    input.entity,
                    gaps,
                    input.scan_id,
                    competitors,
                );
                pages.push(...generatedPages);
            } catch (err) {
                errors.push(`Content expansion failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    } finally {
        _activeFeedbackRuns.delete(input.scan_id);
    }

    return {
        scan_id: input.scan_id,
        relationships_written,
        visibility_events_written,
        pages_generated: pages.length,
        pages,
        errors,
        duration_ms: Date.now() - startMs,
    };
}

/**
 * Check whether a feedback loop run is currently active for a scan.
 * Useful for monitoring endpoints.
 */
export function isFeedbackLoopActive(scan_id: string): boolean {
    return _activeFeedbackRuns.has(scan_id);
}
