/**
 * Citation Evolution Engine
 *
 * The missing bridge between diagnosis and BECOMING VISIBLE.
 *
 * Pipeline:
 *   CitationLedger → Registry → Visibility Scoring
 *     → Gap Detection Engine
 *     → Action Graph Compiler
 *     → Persistence Layer (visibility plan)
 *     → Optional re-scan validation loop
 *
 * HARD RULE (AGENTS.md §9):
 * Every system output must contain:
 *   citations[] OR missing_citations[] + action_plan[]
 * No third option. Violations throw NON_COMPLIANT_OUTPUT.
 *
 * Visibility model:
 *   V = P(entity_in_AI_answers)
 *     + P(entity_in_SERP_AI_overlays)
 *     + P(entity_in_citations_graph)
 *
 * Every action must increase at least one term in V.
 */

import type { IntelligenceAnalysisResponse } from '../../../shared/types.js';
import {
    detectVisibilityGaps,
    type GapDetectionResult,
    type VisibilityGap,
} from './gapDetectionEngine.js';
import {
    compileActionGraph,
    simulateVisibilityUplift,
    type VisibilityActionGraph,
    type ActionNode,
} from './actionGraphCompiler.js';

// ── Output types ──────────────────────────────────────────────────────────────

export interface CitationEvolutionPlanItem {
    action: ActionNode;
    visibility_term: 'ai_answers' | 'serp_overlay' | 'citations_graph' | 'all';
    expected_delta_pct: number;
}

export interface CitationEvolutionResult {
    entity: string;
    domain: string;
    /** Current visibility score (0–100) */
    current_score: number;
    /** Projected score after all actions */
    projected_score: number;
    /** Expected score after top-3 priority actions */
    quick_win_score: number;
    gap_analysis: GapDetectionResult;
    action_graph: VisibilityActionGraph;
    /** Ordered execution plan */
    visibility_plan: CitationEvolutionPlanItem[];
    /** Citations that currently exist (passes compliance check) */
    citations: string[];
    /** Missing citation opportunities (also passes compliance check) */
    missing_citations: string[];
    /** Actions to remediate missing citations */
    action_plan: ActionNode[];
    /** Compliance marker — output is VALID only if this is true */
    is_compliant: boolean;
    generated_at: string;
    /** Scan request ID for traceability */
    scan_id?: string;
}

// ── Citation integrity enforcement ───────────────────────────────────────────

/**
 * enforceCitationIntegrity()
 *
 * STRUCTURAL CONSTRAINT: Any output without citations[] OR
 * (missing_citations[] + action_plan[]) is NON_COMPLIANT and must throw.
 *
 * This turns the architectural philosophy into an executable constraint.
 */
export function enforceCitationIntegrity(
    output: CitationEvolutionResult | { citations?: unknown[]; missing_citations?: unknown[]; action_plan?: unknown[] },
): void {
    const hasCitations =
        'citations' in output &&
        Array.isArray((output as CitationEvolutionResult).citations) &&
        ((output as CitationEvolutionResult).citations).length > 0;

    const hasActionPlan =
        'missing_citations' in output &&
        'action_plan' in output &&
        Array.isArray((output as CitationEvolutionResult).missing_citations) &&
        Array.isArray((output as CitationEvolutionResult).action_plan) &&
        ((output as CitationEvolutionResult).missing_citations).length > 0 &&
        ((output as CitationEvolutionResult).action_plan).length > 0;

    if (!hasCitations && !hasActionPlan) {
        throw new Error(
            'NON_COMPLIANT_OUTPUT: every system output must contain citations[] OR missing_citations[] + action_plan[]. Neither condition is satisfied.',
        );
    }
}

// ── Visibility term mapping ───────────────────────────────────────────────────

function mapActionToVisibilityTerm(
    action: ActionNode,
): CitationEvolutionPlanItem['visibility_term'] {
    switch (action.action_type) {
        case 'citation_seed':
        case 'content_generation':
        case 'query_cluster_expansion':
            return 'ai_answers';
        case 'schema_enhancement':
        case 'entity_consolidation':
            return 'citations_graph';
        case 'authority_signal':
        case 'trust_signal_repair':
            return 'serp_overlay';
        default:
            return 'all';
    }
}

// ── Missing citations extractor ───────────────────────────────────────────────

function extractMissingCitations(gaps: VisibilityGap[]): string[] {
    const citations = new Set<string>();
    for (const gap of gaps) {
        for (const platform of gap.missing_platforms) {
            citations.add(`${platform}: "${gap.entity}" — citation absent`);
        }
        for (const query of gap.missing_query_patterns.slice(0, 2)) {
            citations.add(`query: "${query}" → entity not surfaced`);
        }
    }
    return Array.from(citations);
}

// ── Existing citation extractor from analysis ─────────────────────────────────

function extractExistingCitations(analysis: IntelligenceAnalysisResponse): string[] {
    const citations: string[] = [];

    // Extract from citation readiness engine
    const citationData = analysis.citation_readiness?.data as Record<string, unknown> | undefined;
    if (citationData?.citable_sections) {
        const sections = citationData.citable_sections as Array<Record<string, unknown>>;
        for (const s of sections) {
            if (s.section_heading) {
                citations.push(`section: "${s.section_heading}" — confidence ${((s.confidence as number ?? 0.5) * 100).toFixed(0)}%`);
            }
        }
    }

    // Extract from trust layer (trust signals serve as authority citations)
    const trustData = analysis.trust_layer?.data as Record<string, unknown> | undefined;
    if (trustData?.signal_status) {
        const signals = trustData.signal_status as Record<string, unknown>;
        if (signals['https_enabled']) citations.push('authority: HTTPS enabled');
        if (signals['tls_certificate_trusted']) citations.push('authority: TLS certificate trusted');
        if (signals['contact_info_present']) citations.push('authority: contact info present');
    }

    // Extract from entity graph
    const entityData = analysis.entity_graph?.data as Record<string, unknown> | undefined;
    if (entityData?.primary_entity) {
        const entity = entityData.primary_entity as Record<string, unknown>;
        if (entity.canonical_name) {
            citations.push(`entity: "${entity.canonical_name}" recognized — confidence ${((entity.confidence as number ?? 0.8) * 100).toFixed(0)}%`);
        }
    }

    return citations;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * runCitationEvolutionEngine()
 *
 * Full pipeline: analysis state → gap detection → action graph → visibility plan.
 *
 * Enforces citation integrity contract: if no existing citations AND no gap
 * actions can be generated, throws NON_COMPLIANT_OUTPUT.
 *
 * Returns a CitationEvolutionResult that:
 *   1. Identifies where the entity is currently NOT cited
 *   2. Produces a concrete action graph to close each gap
 *   3. Projects expected visibility uplift per action
 *   4. Satisfies the compliance contract (citations OR action_plan)
 */
export function runCitationEvolutionEngine(
    analysis: IntelligenceAnalysisResponse,
    options: {
        entityOverride?: string;
        scanId?: string;
        includeAutomatable?: boolean;
    } = {},
): CitationEvolutionResult {
    const baseScore = analysis.overall_ai_visibility_score ?? 0;

    // Stage 1: Gap Detection
    const gapResult = detectVisibilityGaps(analysis, options.entityOverride);

    // Stage 2: Action Graph Compilation
    // If no gaps found, produce a minimal compliant result using existing citations
    let actionGraph: VisibilityActionGraph;
    if (gapResult.gaps.length > 0) {
        actionGraph = compileActionGraph(gapResult, baseScore);
    } else {
        // No gaps = healthy entity — build empty action graph
        actionGraph = {
            entity: gapResult.entity,
            domain: gapResult.domain,
            actions: [],
            total_action_count: 0,
            automatable_count: 0,
            projected_total_uplift: 0,
            projected_score_after_top3: baseScore,
            compiled_at: new Date().toISOString(),
        };
    }

    // Stage 3: Visibility plan — map each action to a visibility term
    const visibilityPlan: CitationEvolutionPlanItem[] = actionGraph.actions.map((action) => ({
        action,
        visibility_term: mapActionToVisibilityTerm(action),
        expected_delta_pct: action.expected_uplift,
    }));

    // Stage 4: Extract existing citations vs missing citations
    const existingCitations = extractExistingCitations(analysis);
    const missingCitations = extractMissingCitations(gapResult.gaps);
    const actionPlan = options.includeAutomatable
        ? actionGraph.actions.filter((a) => a.is_automatable)
        : actionGraph.actions;

    // Stage 5: Compute projected scores
    const { projected_score: projectedAll } = simulateVisibilityUplift(
        baseScore,
        actionGraph.actions,
    );
    const { projected_score: quickWin } = simulateVisibilityUplift(
        baseScore,
        actionGraph.actions.slice(0, 3),
    );

    const result: CitationEvolutionResult = {
        entity: gapResult.entity,
        domain: gapResult.domain,
        current_score: baseScore,
        projected_score: projectedAll,
        quick_win_score: quickWin,
        gap_analysis: gapResult,
        action_graph: actionGraph,
        visibility_plan: visibilityPlan,
        citations: existingCitations,
        missing_citations: missingCitations,
        action_plan: actionPlan,
        is_compliant: false, // set by integrity check below
        generated_at: new Date().toISOString(),
        scan_id: options.scanId,
    };

    // Stage 6: Enforce citation integrity contract
    // This is the structural enforcement layer — throws if output is non-compliant
    enforceCitationIntegrity(result);

    // Mark compliant only after passing the check
    result.is_compliant = true;

    return result;
}
