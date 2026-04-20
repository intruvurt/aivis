/**
 * Unified Scan Engine — SINGLE ENTRY GATE
 *
 * This is the ONLY public entry point for all scan execution.
 * No route, controller, or MCP tool may call scan/analysis logic directly.
 * All traffic flows through runUnifiedScan().
 *
 * Routing strategy (SAFE, NO DOWNTIME):
 *   tier < alignment → legacy pipeline (stable, no changes)
 *   alignment+       → intelligence pipeline (new system)
 *   shadow mode      → runs BOTH, returns comparison (drift detection)
 *
 * STEP 1 — SINGLE ENTRY GATE
 * STEP 2 — WRAP LEGACY, DO NOT DELETE (legacy becomes private module)
 * STEP 3 — SHADOW MODE for safe validation
 * STEP 4 — DRIFT DETECTOR (divergence scoring + logging)
 * STEP 5 — EVENTUAL CUTOVER (when divergence < 5% for 7 days)
 */

import type { CanonicalTier, IntelligenceAnalysisResponse } from '../../../shared/types.js';
import { meetsMinimumTier } from '../../../shared/types.js';

// ── Request / Response types ──────────────────────────────────────────────────

export interface UnifiedScanRequest {
    url: string;
    tier: CanonicalTier;
    userId: string;
    workspaceId?: string;
    /** If true, force shadow mode regardless of tier */
    forceShadow?: boolean;
    /** Scrape result from upstream (avoids double-scraping) */
    scrapeResult?: {
        html: string;
        domain: string;
        httpsEnabled: boolean;
        domainAgeYears?: number;
    };
}

export type ScanMode = 'legacy' | 'intelligence' | 'shadow';

export interface PipelineDivergence {
    /** 0.0 = identical, 1.0 = completely different */
    divergence_score: number;
    score_delta: number;
    missing_in_new: string[];
    missing_in_legacy: string[];
    entity_mismatch_rate: number;
    citation_count_delta: number;
    /** true if divergence exceeds threshold (5%) */
    exceeds_threshold: boolean;
}

export interface UnifiedScanResult {
    mode: ScanMode;
    url: string;
    tier: CanonicalTier;
    /** Primary result (intelligence pipeline or legacy depending on mode) */
    result: IntelligenceAnalysisResponse;
    /** Shadow mode only: the legacy result alongside */
    legacy_result?: IntelligenceAnalysisResponse;
    /** Shadow mode only: the new pipeline result */
    new_result?: IntelligenceAnalysisResponse;
    /** Shadow mode only: comparison output */
    comparison?: PipelineDivergence;
    execution_ms: number;
    pipeline_version: 'v1_legacy' | 'v2_intelligence' | 'shadow';
}

// ── Divergence threshold ──────────────────────────────────────────────────────

/** Divergence above this fraction triggers a warning log (does not block) */
const DIVERGENCE_LOG_THRESHOLD = 0.05;

// ── Pipeline comparison ────────────────────────────────────────────────────────

/**
 * comparePipelineOutputs()
 *
 * Compares legacy and new pipeline responses to detect drift.
 * Called in shadow mode — does NOT block requests.
 *
 * Divergence score formula:
 *   score_weight    = 0.40 (primary scoring)
 *   citation_weight = 0.30 (citation coverage)
 *   entity_weight   = 0.20 (entity recognition)
 *   rec_weight      = 0.10 (recommendation overlap)
 */
export function comparePipelineOutputs(
    legacy: IntelligenceAnalysisResponse,
    newPipeline: IntelligenceAnalysisResponse,
): PipelineDivergence {
    // Score delta (normalized 0–1)
    const scoreDelta = Math.abs(
        (legacy.overall_ai_visibility_score ?? 0) - (newPipeline.overall_ai_visibility_score ?? 0),
    );
    const normalizedScoreDelta = Math.min(1, scoreDelta / 100);

    // Citation count delta
    const legacyCitations = (
        (legacy.citation_readiness?.data as Record<string, unknown>)?.citable_sections as unknown[]
    )?.length ?? 0;
    const newCitations = (
        (newPipeline.citation_readiness?.data as Record<string, unknown>)?.citable_sections as unknown[]
    )?.length ?? 0;
    const citationDelta = Math.abs(legacyCitations - newCitations);
    const normalizedCitationDelta = Math.min(1, citationDelta / Math.max(1, legacyCitations + newCitations));

    // Entity mismatch rate
    const legacyEntity = (
        (legacy.entity_graph?.data as Record<string, unknown>)?.primary_entity as Record<string, unknown>
    )?.canonical_name as string | undefined;
    const newEntity = (
        (newPipeline.entity_graph?.data as Record<string, unknown>)?.primary_entity as Record<string, unknown>
    )?.canonical_name as string | undefined;
    const entityMismatchRate = legacyEntity && newEntity
        ? legacyEntity.toLowerCase() !== newEntity.toLowerCase()
            ? 1.0
            : 0.0
        : 0.5; // unknown → assume 50% mismatch when one side is missing

    // Recommendations overlap
    const legacyRecs = extractRecommendations(legacy);
    const newRecs = extractRecommendations(newPipeline);
    const recOverlap = computeSetOverlap(legacyRecs, newRecs);
    const recDivergence = 1 - recOverlap;

    // Weighted divergence
    const divergenceScore =
        normalizedScoreDelta * 0.40 +
        normalizedCitationDelta * 0.30 +
        entityMismatchRate * 0.20 +
        recDivergence * 0.10;

    // What's present in new but missing from legacy
    const missingInLegacy = newRecs.filter(
        (r) => !legacyRecs.some((l) => l.toLowerCase().includes(r.toLowerCase().slice(0, 20))),
    );
    const missingInNew = legacyRecs.filter(
        (r) => !newRecs.some((n) => n.toLowerCase().includes(r.toLowerCase().slice(0, 20))),
    );

    return {
        divergence_score: Math.round(divergenceScore * 1000) / 1000,
        score_delta: scoreDelta,
        missing_in_new: missingInNew.slice(0, 10),
        missing_in_legacy: missingInLegacy.slice(0, 10),
        entity_mismatch_rate: entityMismatchRate,
        citation_count_delta: citationDelta,
        exceeds_threshold: divergenceScore > DIVERGENCE_LOG_THRESHOLD,
    };
}

function extractRecommendations(result: IntelligenceAnalysisResponse): string[] {
    const recs: string[] = [];
    const citData = result.citation_readiness?.data as Record<string, unknown> | undefined;
    if (Array.isArray(citData?.recommendations)) {
        recs.push(...(citData.recommendations as string[]));
    }
    const trustData = result.trust_layer?.data as Record<string, unknown> | undefined;
    if (Array.isArray(trustData?.recommendations)) {
        recs.push(...(trustData.recommendations as string[]));
    }
    const entityData = result.entity_graph?.data as Record<string, unknown> | undefined;
    if (Array.isArray(entityData?.recommendations)) {
        recs.push(...(entityData.recommendations as string[]));
    }
    return recs;
}

function computeSetOverlap(setA: string[], setB: string[]): number {
    if (setA.length === 0 && setB.length === 0) return 1;
    if (setA.length === 0 || setB.length === 0) return 0;
    const aLower = setA.map((s) => s.toLowerCase().slice(0, 30));
    const bLower = setB.map((s) => s.toLowerCase().slice(0, 30));
    let overlap = 0;
    for (const a of aLower) {
        if (bLower.some((b) => b.includes(a.slice(0, 20)) || a.includes(b.slice(0, 20)))) {
            overlap++;
        }
    }
    return overlap / Math.max(aLower.length, bLower.length);
}

// ── Tier routing decision ─────────────────────────────────────────────────────

function getScanMode(tier: CanonicalTier, forceShadow?: boolean): ScanMode {
    if (forceShadow) return 'shadow';
    // alignment+ uses intelligence pipeline; observer/starter use legacy
    if (meetsMinimumTier(tier, 'alignment')) return 'intelligence';
    return 'legacy';
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * runUnifiedScan()
 *
 * SINGLE ENTRY GATE for all scan execution.
 *
 * Routes based on tier:
 *   observer/starter → legacy pipeline (stable, well-tested)
 *   alignment+       → intelligence pipeline (new modular system)
 *   shadow           → both pipelines, returns comparison
 *
 * Shadow mode returns:
 * {
 *   mode: "shadow",
 *   legacy_result: ...,
 *   new_result: ...,
 *   comparison: { divergence_score, missing_citations, scoring_differences, entity_mismatch_rate }
 * }
 *
 * This function imports the pipeline runners lazily to avoid circular deps
 * and to allow the legacy engine to remain as a private module.
 */
export async function runUnifiedScan(
    request: UnifiedScanRequest,
    runners: {
        runLegacy: (req: UnifiedScanRequest) => Promise<IntelligenceAnalysisResponse>;
        runIntelligence: (req: UnifiedScanRequest) => Promise<IntelligenceAnalysisResponse>;
    },
): Promise<UnifiedScanResult> {
    const start = Date.now();
    const mode = getScanMode(request.tier, request.forceShadow);

    if (mode === 'legacy') {
        const result = await runners.runLegacy(request);
        return {
            mode: 'legacy',
            url: request.url,
            tier: request.tier,
            result,
            execution_ms: Date.now() - start,
            pipeline_version: 'v1_legacy',
        };
    }

    if (mode === 'intelligence') {
        const result = await runners.runIntelligence(request);
        return {
            mode: 'intelligence',
            url: request.url,
            tier: request.tier,
            result,
            execution_ms: Date.now() - start,
            pipeline_version: 'v2_intelligence',
        };
    }

    // Shadow mode: run both concurrently
    const [legacyResult, intelligenceResult] = await Promise.allSettled([
        runners.runLegacy(request),
        runners.runIntelligence(request),
    ]);

    // Resolve results with safe fallbacks
    const legacy = legacyResult.status === 'fulfilled'
        ? legacyResult.value
        : buildFailedPlaceholder(request.url, request.tier, 'legacy_pipeline_failed');
    const intelligence = intelligenceResult.status === 'fulfilled'
        ? intelligenceResult.value
        : buildFailedPlaceholder(request.url, request.tier, 'intelligence_pipeline_failed');

    // Compute divergence (does not block response)
    const comparison = comparePipelineOutputs(legacy, intelligence);

    if (comparison.exceeds_threshold) {
        console.warn(
            `[UnifiedScanEngine] Shadow divergence ABOVE threshold for ${request.url}: ` +
            `score=${comparison.divergence_score.toFixed(3)}, ` +
            `delta=${comparison.score_delta}, ` +
            `entity_mismatch=${comparison.entity_mismatch_rate}`,
        );
    } else {
        console.info(
            `[UnifiedScanEngine] Shadow divergence OK for ${request.url}: ` +
            `score=${comparison.divergence_score.toFixed(3)}`,
        );
    }

    // Primary result for shadow: use intelligence pipeline output
    // (shadow mode is for validation, so prefer the new system's result)
    return {
        mode: 'shadow',
        url: request.url,
        tier: request.tier,
        result: intelligence,
        legacy_result: legacy,
        new_result: intelligence,
        comparison,
        execution_ms: Date.now() - start,
        pipeline_version: 'shadow',
    };
}

// ── Internal utility ──────────────────────────────────────────────────────────

function buildFailedPlaceholder(
    url: string,
    tier: CanonicalTier,
    errorCode: string,
): IntelligenceAnalysisResponse {
    return {
        url,
        analyzed_at: new Date().toISOString(),
        tier,
        processing_time_ms: 0,
        is_cached: false,
        overall_ai_visibility_score: 0,
        citation_readiness_score: 0,
        trust_score: 0,
        entity_clarity_score: 0,
        citation_readiness: null,
        trust_layer: null,
        entity_graph: null,
        _error: errorCode,
    };
}
