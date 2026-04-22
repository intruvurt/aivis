/**
 * RAG Pipeline Orchestrator
 *
 * Single entry point that runs the full AiVIS evidence pipeline in order:
 *
 *   Layer 0 — Intent Shaping     (intentShaper.ts)
 *   Layer 1 — Search Router      (searchRouter.ts)   ← multi-provider fanout
 *   Layer 2 — Context Extraction (contextExtractor.ts) ← claim decomposition
 *   Layer 3 — Entity Graph       (entityGraphBuilder.ts)
 *   Layer 4 — Evidence Scoring   (evidenceScorer.ts)
 *
 * Usage
 * ─────
 *   import { runRAGPipeline } from './ragPipeline.js';
 *
 *   const result = await runRAGPipeline({
 *     query:          'Is Notion actually growing?',
 *     subjectEntities: ['Notion'],
 *   });
 *
 * The result is self-contained and serialisable. Persist it alongside the
 * scan_id for full ledger traceability per the AGENTS.md invariant.
 */

import { shapeIntent } from './intentShaper.js';
import { routeSearchFanout } from './searchRouter.js';
import { extractContext } from './contextExtractor.js';
import { buildEntityGraph, serialiseGraph } from './entityGraphBuilder.js';
import { scoreEvidence } from './evidenceScorer.js';
import { scoreSourcesTrustBatch } from './sourceTrustScoringEngine.js';
import { appendScanEvent } from './scanEventStream.js';

import type { ShapedIntent } from './intentShaper.js';
import type { SearchRouterResult } from './searchRouter.js';
import type { ContextExtractionResult } from './contextExtractor.js';
import type { EvidenceGraph } from './entityGraphBuilder.js';
import type { EvidenceScorerResult } from './evidenceScorer.js';
import type { SourceTrustScore } from './sourceTrustScoringEngine.js';
import type { PipelineScanStage, ScanEvent } from '../../../shared/types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface RAGPipelineInput {
    /** Raw query string (user-supplied or generated) */
    query: string;
    /** Optional seed entities (e.g. brand name from scraper result) */
    subjectEntities?: string[];
    /** Max pages to fetch for context extraction (default 12) */
    maxPages?: number;
    /** Max consensus results to pass downstream (default 20) */
    topN?: number;
    /** Override shaped intent (skip Layer 0 re-shaping) */
    intent?: Partial<ShapedIntent>;
    /** Optional stream id for timeline emission */
    scanId?: string;
    /** Optional sequence ref used for scan timeline ordering */
    seqRef?: { value: number };
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface RAGPipelineResult {
    /** Layer 0 output */
    intent: ShapedIntent;
    /** Layer 1 output */
    search: SearchRouterResult;
    /** Layer 2 output */
    context: ContextExtractionResult;
    /** Layer 3 output (serialised for storage) */
    graph: Record<string, unknown>;
    /** Layer 4 output */
    scores: EvidenceScorerResult;
    /** Per-source trust score + gate decision */
    trust_sources: {
        items: SourceTrustScore[];
        summary: {
            accepted: number;
            partial: number;
            rejected: number;
        };
    };
    /** Transparent source candidate payload for UI inspection */
    source_candidates: Array<{
        url: string;
        title: string;
        rank: number;
        pre_decision: string;
        pre_trust_score: number;
        final_decision: string;
        trust_score: number;
        reason_flags: string[];
        lighthouse_eligible: boolean;
        format_used?: string;
    }>;
    /** Total wall-clock time for full pipeline */
    pipeline_ms: number;
    /** Execution class for debugging/monitoring */
    execution_class: 'full' | 'partial' | 'no_results';
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

function emitStage(
    scanId: string | undefined,
    seqRef: { value: number } | undefined,
    stage: PipelineScanStage,
    progress: number,
    payload: Record<string, unknown>,
): void {
    if (!scanId) return;
    const seq = seqRef ? seqRef.value++ : 0;
    const event: ScanEvent = {
        type: 'PIPELINE_STAGE',
        stage,
        progress,
        payload,
        timestamp: Date.now(),
    };
    void appendScanEvent(scanId, seq, event);
}

export async function runRAGPipeline(input: RAGPipelineInput): Promise<RAGPipelineResult> {
    const t0 = Date.now();

    // ── Layer 0: Intent shaping ─────────────────────────────────────────────────
    const intent: ShapedIntent = input.intent?.raw_query
        ? { ...shapeIntent(input.query), ...input.intent } as ShapedIntent
        : shapeIntent(input.query);
    emitStage(input.scanId, input.seqRef, 'entity_resolving', 0.08, {
        intent: intent.intent,
        entities: intent.entities.slice(0, 5),
        depth: intent.depth,
    });

    // ── Layer 1: Multi-provider search fanout ───────────────────────────────────
    const search = await routeSearchFanout(intent, { topN: input.topN ?? 20 });
    emitStage(input.scanId, input.seqRef, 'chunking', 0.22, {
        search_candidates: search.pool.length,
        retained: search.consensus_top.length,
        discarded: search.discarded.length,
    });

    if (search.consensus_top.length === 0) {
        // No results — return minimal structure, preserve schema
        const emptyGraph = buildEntityGraph([], input.subjectEntities ?? []);
        return {
            intent,
            search,
            context: { pages: [], total_claims: 0, execution_ms: 0 },
            graph: serialiseGraph(emptyGraph),
            scores: scoreEvidence(emptyGraph),
            trust_sources: {
                items: [],
                summary: { accepted: 0, partial: 0, rejected: 0 },
            },
            source_candidates: [],
            pipeline_ms: Date.now() - t0,
            execution_class: 'no_results',
        };
    }

    // ── Layer 2: Context extraction (parallel page fetch + claim decomposition) ─
    const context = await extractContext(search.consensus_top, intent, input.maxPages ?? 12);
    emitStage(input.scanId, input.seqRef, 'chunked', 0.48, {
        extracted_pages: context.pages.length,
        extracted_claims: context.total_claims,
    });

    let execution_class: RAGPipelineResult['execution_class'] = 'full';
    if (context.pages.length === 0) execution_class = 'partial';

    // ── Trust scoring + gate (accept / partial / reject) ─────────────────────
    const trustScores = await scoreSourcesTrustBatch(search.pool, context.pages);
    const trustByUrl = new Map(trustScores.map((s) => [s.url, s]));

    const acceptedCount = trustScores.filter((s) => s.decision === 'accept').length;
    const partialCount = trustScores.filter((s) => s.decision === 'partial').length;
    const rejectedCount = trustScores.filter((s) => s.decision === 'reject').length;
    emitStage(input.scanId, input.seqRef, 'scoring', 0.68, {
        accepted: acceptedCount,
        partial: partialCount,
        rejected: rejectedCount,
    });

    const gatedPages = context.pages
        .map((page) => {
            const trust = trustByUrl.get(page.url);
            if (!trust || trust.decision === 'reject') return null;
            if (trust.decision === 'partial') {
                return {
                    ...page,
                    clean_text: page.clean_text.slice(0, 4000),
                    claims: page.claims.slice(0, 12),
                };
            }
            return page;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

    // ── Layer 3: Entity graph construction ─────────────────────────────────────
    const rawGraph: EvidenceGraph = buildEntityGraph(
        gatedPages,
        input.subjectEntities ?? intent.entities,
    );

    // ── Layer 4: Evidence scoring ───────────────────────────────────────────────
    const scores = scoreEvidence(rawGraph);

    if (rejectedCount > 0 && acceptedCount === 0) {
        execution_class = 'partial';
    }

    const pageMap = new Map(context.pages.map((page) => [page.url, page]));
    const sourceCandidates = search.pool.map((row) => {
        const trust = trustByUrl.get(row.url);
        const page = pageMap.get(row.url);
        return {
            url: row.url,
            title: row.title,
            rank: row.rank,
            pre_decision: row.pre_decision,
            pre_trust_score: row.pre_trust_score,
            final_decision: trust?.decision || row.pre_decision,
            trust_score: trust?.trust_score ?? row.pre_trust_score,
            reason_flags: trust?.reason_flags || row.pre_reason_flags,
            lighthouse_eligible: row.lighthouse_eligible,
            format_used: page?.format_used,
        };
    });

    emitStage(input.scanId, input.seqRef, 'complete', 1.0, {
        graph_nodes: (serialiseGraph(rawGraph).stats as Record<string, unknown>)?.total_nodes ?? 0,
        top_entity: scores.top_entity?.entity_label ?? null,
        source_candidates: sourceCandidates.length,
    });

    return {
        intent,
        search,
        context,
        graph: serialiseGraph(rawGraph),
        scores,
        trust_sources: {
            items: trustScores,
            summary: {
                accepted: acceptedCount,
                partial: partialCount,
                rejected: rejectedCount,
            },
        },
        source_candidates: sourceCandidates,
        pipeline_ms: Date.now() - t0,
        execution_class,
    };
}
