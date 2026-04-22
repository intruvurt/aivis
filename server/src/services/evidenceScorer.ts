/**
 * Evidence Scorer — Layer 4 of the AiVIS RAG Pipeline
 *
 * Produces dynamic, multi-dimensional scores for each entity in the graph.
 * This is the product layer. Raw evidence is turned into monetisable signal.
 *
 * Score dimensions
 * ─────────────────
 *   visibility_score      — overall composite (0–100)
 *   source_credibility    — weighted average credibility of citing sources
 *   recency_score         — velocity-weighted freshness of evidence
 *   consensus_score       — cross-source agreement ratio
 *   contradiction_penalty — deduction for contested claims
 *   momentum_score        — acceleration of mention velocity
 *   hype_index            — ratio of opinion/announcement to stat claims
 *   risk_score            — proportion of risk-type claims
 *
 * All scores derive entirely from ledger/graph data — no AI inference.
 * This guarantees reproducibility and traceability per the AGENTS.md invariant.
 */

import type { EvidenceGraph, ClaimNode, SourceNode } from './entityGraphBuilder.js';

// ── Output types ──────────────────────────────────────────────────────────────

export interface EntityScore {
    entity_id: string;
    entity_label: string;
    /** Composite AiVIS visibility score 0–100 */
    visibility_score: number;
    /** Average credibility of sources citing this entity */
    source_credibility: number;
    /** Freshness of evidence (recency-decayed) */
    recency_score: number;
    /** Degree of cross-source agreement 0–1 */
    consensus_score: number;
    /** Deduction from contested/contradicted claims */
    contradiction_penalty: number;
    /** Mention velocity signal 0–1 */
    momentum_score: number;
    /** Ratio of hype (opinion+announcement) to fact (stat) claims */
    hype_index: number;
    /** Proportion of risk-type claims 0–1 */
    risk_score: number;
    /** Raw evidence counts */
    evidence_counts: {
        total_claims: number;
        stat_claims: number;
        contested_claims: number;
        uncited_claims: number;
        unique_sources: number;
    };
    /** Structured corrective actions when visibility is low */
    actions: VisibilityAction[];
}

export type ActionType =
    | 'add_stats'
    | 'diversify_sources'
    | 'resolve_contradiction'
    | 'increase_mentions'
    | 'cite_authoritative_source'
    | 'add_recent_content'
    | 'reduce_hype';

export interface VisibilityAction {
    type: ActionType;
    label: string;
    impact_estimate: number;  // expected score uplift
    priority: 'high' | 'medium' | 'low';
    evidence_gap: string;  // specific gap that triggered this action
}

export interface EvidenceScorerResult {
    entity_scores: EntityScore[];
    top_entity: EntityScore | null;
    graph_summary: {
        total_entities: number;
        total_claims: number;
        total_sources: number;
        average_credibility: number;
        uncited_ratio: number;
        contested_ratio: number;
    };
    execution_ms: number;
}

// ── Recency decay ─────────────────────────────────────────────────────────────

function recencyDecay(published_ms?: number): number {
    if (!published_ms) return 0.50;
    const ageDays = (Date.now() - published_ms) / 86_400_000;
    if (ageDays < 7) return 1.00;
    if (ageDays < 30) return 0.85;
    if (ageDays < 90) return 0.70;
    if (ageDays < 180) return 0.55;
    if (ageDays < 365) return 0.40;
    return 0.25;
}

// ── Action generator ──────────────────────────────────────────────────────────

function generateActions(scores: Omit<EntityScore, 'actions' | 'visibility_score'>): VisibilityAction[] {
    const actions: VisibilityAction[] = [];

    if (scores.evidence_counts.stat_claims < 3) {
        actions.push({
            type: 'add_stats',
            label: 'Add verifiable statistics and metrics to your content',
            impact_estimate: 12,
            priority: 'high',
            evidence_gap: `Only ${scores.evidence_counts.stat_claims} stat claim(s) detected`,
        });
    }

    if (scores.evidence_counts.unique_sources < 3) {
        actions.push({
            type: 'diversify_sources',
            label: 'Get coverage from at least 3 independent sources',
            impact_estimate: 10,
            priority: 'high',
            evidence_gap: `Only ${scores.evidence_counts.unique_sources} unique source(s)`,
        });
    }

    if (scores.evidence_counts.contested_claims > 0) {
        actions.push({
            type: 'resolve_contradiction',
            label: `Resolve ${scores.evidence_counts.contested_claims} contested claim(s) with authoritative data`,
            impact_estimate: 8,
            priority: 'high',
            evidence_gap: 'Contradicting claims across sources damage trust signal',
        });
    }

    if (scores.recency_score < 0.55) {
        actions.push({
            type: 'add_recent_content',
            label: 'Publish fresh content to restore recency score',
            impact_estimate: 6,
            priority: 'medium',
            evidence_gap: 'Most evidence is more than 90 days old',
        });
    }

    if (scores.source_credibility < 0.60) {
        actions.push({
            type: 'cite_authoritative_source',
            label: 'Earn coverage on high-authority publication (TechCrunch, Forbes, etc.)',
            impact_estimate: 10,
            priority: 'high',
            evidence_gap: `Average source credibility ${(scores.source_credibility * 100).toFixed(0)}% — below threshold`,
        });
    }

    if (scores.hype_index > 0.65) {
        actions.push({
            type: 'reduce_hype',
            label: 'Replace opinion/announcement copy with fact-backed claims',
            impact_estimate: 5,
            priority: 'medium',
            evidence_gap: `${(scores.hype_index * 100).toFixed(0)}% of claims are opinion or announcement-type`,
        });
    }

    if (scores.evidence_counts.total_claims < 5) {
        actions.push({
            type: 'increase_mentions',
            label: 'Increase total web mentions across diverse platforms',
            impact_estimate: 7,
            priority: 'medium',
            evidence_gap: `Only ${scores.evidence_counts.total_claims} claims found across all sources`,
        });
    }

    return actions.sort((a, b) => b.impact_estimate - a.impact_estimate);
}

// ── Per-entity scorer ─────────────────────────────────────────────────────────

function scoreEntity(
    entityId: string,
    entityLabel: string,
    graph: EvidenceGraph,
): EntityScore {
    // Gather all edges from/to this entity
    const relatedEdges = graph.edges.filter(e => e.from === entityId || e.to === entityId);

    // Claims connected to this entity
    const claimIds = new Set(
        relatedEdges
            .filter(e => e.kind === 'has_claim' && e.from === entityId)
            .map(e => e.to),
    );

    const connectedClaims: ClaimNode[] = [];
    for (const cid of claimIds) {
        const node = graph.nodes.get(cid);
        if (node?.kind === 'claim') connectedClaims.push(node as ClaimNode);
    }

    // Sources mentioning this entity
    const sourceMentionIds = new Set(
        relatedEdges
            .filter(e => e.kind === 'mentions' && e.to === entityId)
            .map(e => e.from),
    );

    const sources: SourceNode[] = [];
    for (const sid of sourceMentionIds) {
        const node = graph.nodes.get(sid);
        if (node?.kind === 'source') sources.push(node as SourceNode);
    }

    const totalClaims = connectedClaims.length;
    const statClaims = connectedClaims.filter(c => c.claim_type === 'stat').length;
    const contestedClaims = connectedClaims.filter(c => c.contested).length;
    const uncitedClaims = connectedClaims.filter(c => c.uncited).length;
    const uniqueSources = sources.length;

    // ── Dimension scores ────────────────────────────────────────────────────────

    // Source credibility: weighted average
    const source_credibility = uniqueSources === 0
        ? 0
        : sources.reduce((s, src) => s + src.credibility, 0) / uniqueSources;

    // Recency score: best recency across sources
    const best_published = sources
        .filter(s => s.published_ms)
        .sort((a, b) => (b.published_ms ?? 0) - (a.published_ms ?? 0))[0]?.published_ms;
    const recency_score = recencyDecay(best_published);

    // Consensus: proportion of claims backed by multiple sources
    const citingEdges = graph.edges.filter(e => e.kind === 'cites');
    const claimSourceCount = new Map<string, number>();
    for (const e of citingEdges) {
        if (claimIds.has(e.to)) {
            claimSourceCount.set(e.to, (claimSourceCount.get(e.to) || 0) + 1);
        }
    }
    const multiSourced = totalClaims === 0
        ? 0
        : [...claimSourceCount.values()].filter(c => c > 1).length / Math.max(1, totalClaims);
    const consensus_score = Math.min(1, multiSourced + (uniqueSources > 1 ? 0.15 : 0));

    // Contradiction penalty
    const contradiction_penalty = totalClaims === 0
        ? 0
        : Math.min(0.40, (contestedClaims / totalClaims) * 0.50);

    // Momentum: log-damped mention count relative to entity ranking
    const rankEntry = graph.entity_ranking.find(r => r.entity_id === entityId);
    const raw_weight = rankEntry?.total_weight ?? 0;
    const momentum_score = Math.min(1, Math.log2(raw_weight + 1) / 6);

    // Hype index
    const opinionClaims = connectedClaims.filter(c => c.claim_type === 'opinion' || c.claim_type === 'announcement').length;
    const hype_index = totalClaims === 0 ? 0.5 : opinionClaims / totalClaims;

    // Risk score
    const riskClaims = connectedClaims.filter(c => c.claim_type === 'risk').length;
    const risk_score = totalClaims === 0 ? 0 : riskClaims / totalClaims;

    // ── Composite visibility score (0–100) ──────────────────────────────────────
    const WEIGHTS = {
        source_credibility: 0.25,
        recency_score: 0.20,
        consensus_score: 0.25,
        momentum_score: 0.15,
        coverage_breadth: 0.15,
    };

    const coverage_breadth = Math.min(1, uniqueSources / 5);

    const raw_score =
        source_credibility * WEIGHTS.source_credibility +
        recency_score * WEIGHTS.recency_score +
        consensus_score * WEIGHTS.consensus_score +
        momentum_score * WEIGHTS.momentum_score +
        coverage_breadth * WEIGHTS.coverage_breadth;

    const visibility_score_raw = Math.max(0, raw_score - contradiction_penalty - risk_score * 0.10) * 100;
    const visibility_score = Math.round(Math.min(100, visibility_score_raw));

    const partialScores = {
        entity_id: entityId,
        entity_label: entityLabel,
        source_credibility,
        recency_score,
        consensus_score,
        contradiction_penalty,
        momentum_score,
        hype_index,
        risk_score,
        evidence_counts: {
            total_claims: totalClaims,
            stat_claims: statClaims,
            contested_claims: contestedClaims,
            uncited_claims: uncitedClaims,
            unique_sources: uniqueSources,
        },
    };

    const actions = generateActions(partialScores);

    return { ...partialScores, visibility_score, actions };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Score all entities in an EvidenceGraph.
 *
 * Returns per-entity visibility scores, structured action paths,
 * and graph-level summary statistics.
 */
export function scoreEvidence(graph: EvidenceGraph): EvidenceScorerResult {
    const t0 = Date.now();

    const entity_scores: EntityScore[] = graph.entity_ranking.map(({ entity_id, label }) =>
        scoreEntity(entity_id, label, graph),
    );

    entity_scores.sort((a, b) => b.visibility_score - a.visibility_score);

    const top_entity = entity_scores[0] ?? null;

    const sources = [...graph.nodes.values()].filter((n): n is SourceNode => n.kind === 'source');
    const average_credibility = sources.length === 0
        ? 0
        : sources.reduce((s, n) => s + n.credibility, 0) / sources.length;

    const claimCount = graph.stats.claim_count;

    return {
        entity_scores,
        top_entity,
        graph_summary: {
            total_entities: graph.stats.entity_count,
            total_claims: claimCount,
            total_sources: graph.stats.source_count,
            average_credibility,
            uncited_ratio: claimCount === 0 ? 0 : graph.stats.uncited_count / claimCount,
            contested_ratio: claimCount === 0 ? 0 : graph.stats.contested_count / claimCount,
        },
        execution_ms: Date.now() - t0,
    };
}
