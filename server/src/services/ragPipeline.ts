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

import type { ShapedIntent } from './intentShaper.js';
import type { SearchRouterResult } from './searchRouter.js';
import type { ContextExtractionResult } from './contextExtractor.js';
import type { EvidenceGraph } from './entityGraphBuilder.js';
import type { EvidenceScorerResult } from './evidenceScorer.js';
import type { SourceTrustScore } from './sourceTrustScoringEngine.js';

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
    /** Total wall-clock time for full pipeline */
    pipeline_ms: number;
    /** Execution class for debugging/monitoring */
    execution_class: 'full' | 'partial' | 'no_results';
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function runRAGPipeline(input: RAGPipelineInput): Promise<RAGPipelineResult> {
    const t0 = Date.now();

    // ── Layer 0: Intent shaping ─────────────────────────────────────────────────
    const intent: ShapedIntent = input.intent?.raw_query
        ? { ...shapeIntent(input.query), ...input.intent } as ShapedIntent
        : shapeIntent(input.query);

    // ── Layer 1: Multi-provider search fanout ───────────────────────────────────
    const search = await routeSearchFanout(intent, { topN: input.topN ?? 20 });

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
            pipeline_ms: Date.now() - t0,
            execution_class: 'no_results',
        };
    }

    // ── Layer 2: Context extraction (parallel page fetch + claim decomposition) ─
    const context = await extractContext(search.consensus_top, intent, input.maxPages ?? 12);

    let execution_class: RAGPipelineResult['execution_class'] = 'full';
    if (context.pages.length === 0) execution_class = 'partial';

    // ── Trust scoring + gate (accept / partial / reject) ─────────────────────
    const trustScores = await scoreSourcesTrustBatch(search.pool, context.pages);
    const trustByUrl = new Map(trustScores.map((s) => [s.url, s]));

    const acceptedCount = trustScores.filter((s) => s.decision === 'accept').length;
    const partialCount = trustScores.filter((s) => s.decision === 'partial').length;
    const rejectedCount = trustScores.filter((s) => s.decision === 'reject').length;

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
        pipeline_ms: Date.now() - t0,
        execution_class,
    };
}
