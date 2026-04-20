/**
 * Gap Detection Engine
 *
 * ARCHITECTURAL RULE (AGENTS.md §3):
 * Every detected gap MUST produce:
 *   - missing citation source type
 *   - entity gap (who/what is not recognized)
 *   - query gap (what users would need to ask to find you)
 *   - authority gap (what signal is missing)
 *   - remediation action
 *
 * Converts registry state (engine analysis outputs) into structured
 * VisibilityGap nodes that feed the ActionGraphCompiler.
 */

import type {
    CitationReadinessOutput,
    CitableSection,
    TrustLayerOutput,
    EntityGraphOutput,
    IntelligenceAnalysisResponse,
} from '../../../shared/types.js';

// ── Gap type taxonomy ────────────────────────────────────────────────────────

export type GapType =
    | 'citation_absence'     // not cited in known AI answer platforms
    | 'entity_ambiguity'     // entity name inconsistency prevents recognition
    | 'authority_gap'        // missing social proof / trust signals
    | 'query_coverage_gap'   // entity does not map to discoverable query clusters
    | 'schema_gap'           // structural markup absent or incomplete
    | 'content_density_gap'  // content too thin to be quoted by AI
    | 'link_authority_gap'   // insufficient external linking / SERP authority
    | 'freshness_gap';       // content not recently updated

export interface VisibilityGap {
    gap_id: string;
    gap_type: GapType;
    severity: 'critical' | 'high' | 'medium' | 'low';
    entity: string;
    /** Platforms where this entity is absent or mis-cited */
    missing_platforms: string[];
    /** Query patterns users would need to enter to find this entity */
    missing_query_patterns: string[];
    /** Human-readable description of what signal is absent */
    authority_gap_description: string;
    /** Estimated visibility uplift (0-100 scale delta) if gap is closed */
    estimated_uplift: number;
    /** Raw evidence that exposed this gap */
    evidence_source: string;
    /** Score contribution loss from this gap */
    score_penalty: number;
}

export interface GapDetectionResult {
    entity: string;
    domain: string;
    gaps: VisibilityGap[];
    total_gap_count: number;
    critical_gap_count: number;
    aggregate_score_penalty: number;
    estimated_total_uplift: number;
    detected_at: string;
}

// ── Known AI answer platforms ────────────────────────────────────────────────

const AI_ANSWER_PLATFORMS = [
    'perplexity',
    'chatgpt',
    'claude',
    'gemini',
    'copilot',
    'grok',
    'you.com',
    'bing-ai',
];

// ── Gap ID generator ─────────────────────────────────────────────────────────

let gapCounter = 0;
function makeGapId(type: GapType): string {
    return `gap_${type}_${Date.now()}_${(++gapCounter).toString().padStart(4, '0')}`;
}

// ── Gap detector functions ───────────────────────────────────────────────────

function detectCitationGaps(
    citationResult: CitationReadinessOutput | null,
    entity: string,
): VisibilityGap[] {
    if (!citationResult?.data) return [];
    const gaps: VisibilityGap[] = [];
    const data = citationResult.data;

    // Missing quotable blocks
    const quotability = data.quotability_index ?? 0;
    if (quotability < 0.5) {
        const severity = quotability < 0.2 ? 'critical' : quotability < 0.35 ? 'high' : 'medium';
        gaps.push({
            gap_id: makeGapId('content_density_gap'),
            gap_type: 'content_density_gap',
            severity,
            entity,
            missing_platforms: AI_ANSWER_PLATFORMS,
            missing_query_patterns: [
                `What is ${entity}?`,
                `How does ${entity} work?`,
                `${entity} explained`,
            ],
            authority_gap_description: `Quotability index is ${(quotability * 100).toFixed(0)}% — content is too sparse or unstructured for AI models to extract citable blocks.`,
            estimated_uplift: Math.round((0.5 - quotability) * 60),
            evidence_source: 'citation_engine.quotability_index',
            score_penalty: Math.round((0.5 - quotability) * 30),
        });
    }

    // Citation blockers
    const blockers = data.blockers_to_citation ?? [];
    if (blockers.length > 0) {
        gaps.push({
            gap_id: makeGapId('citation_absence'),
            gap_type: 'citation_absence',
            severity: blockers.length >= 3 ? 'critical' : blockers.length >= 2 ? 'high' : 'medium',
            entity,
            missing_platforms: AI_ANSWER_PLATFORMS,
            missing_query_patterns: [
                `${entity} review`,
                `${entity} alternatives`,
                `Best ${entity} use cases`,
            ],
            authority_gap_description: `Citation blocked by: ${blockers.slice(0, 3).join('; ')}`,
            estimated_uplift: Math.min(40, blockers.length * 12),
            evidence_source: 'citation_engine.blockers_to_citation',
            score_penalty: Math.min(25, blockers.length * 8),
        });
    }

    // Schema gaps (if citable sections exist but have no structured markup signals)
    const sections = data.citable_sections ?? [];
    const schemaSignalMissing = sections.some((s: CitableSection & { has_schema_markup?: boolean }) => !s.has_schema_markup);
    if (schemaSignalMissing || sections.length === 0) {
        gaps.push({
            gap_id: makeGapId('schema_gap'),
            gap_type: 'schema_gap',
            severity: sections.length === 0 ? 'critical' : 'high',
            entity,
            missing_platforms: ['chatgpt', 'perplexity', 'gemini'],
            missing_query_patterns: [
                `${entity} definition`,
                `What does ${entity} do`,
            ],
            authority_gap_description: 'Structured schema markup (FAQ, HowTo, DefinedTerm) is absent — AI models cannot ground the entity from page structure alone.',
            estimated_uplift: sections.length === 0 ? 25 : 15,
            evidence_source: 'citation_engine.citable_sections',
            score_penalty: sections.length === 0 ? 20 : 10,
        });
    }

    return gaps;
}

function detectAuthorityGaps(
    trustResult: TrustLayerOutput | null,
    entity: string,
): VisibilityGap[] {
    if (!trustResult?.data) return [];
    const gaps: VisibilityGap[] = [];
    const signals = trustResult.data.signal_status as Record<string, unknown> | undefined;
    const riskFlags = (trustResult.data.risk_flags as string[]) ?? [];

    if (!signals) return gaps;

    const missingSignals: string[] = [];
    if (!signals['https_enabled']) missingSignals.push('HTTPS');
    if (!signals['contact_info_present']) missingSignals.push('contact information');
    if (!signals['privacy_policy_accessible']) missingSignals.push('privacy policy');
    if (!signals['tls_certificate_trusted']) missingSignals.push('trusted TLS certificate');

    if (missingSignals.length > 0) {
        const severity =
            missingSignals.length >= 3 ? 'critical' :
                missingSignals.length >= 2 ? 'high' : 'medium';
        gaps.push({
            gap_id: makeGapId('authority_gap'),
            gap_type: 'authority_gap',
            severity,
            entity,
            missing_platforms: ['perplexity', 'claude', 'chatgpt'],
            missing_query_patterns: [
                `Is ${entity} trustworthy?`,
                `${entity} credibility`,
                `${entity} legitimate`,
            ],
            authority_gap_description: `Missing trust signals: ${missingSignals.join(', ')}. AI models require verifiable authority signals before citing an entity.`,
            estimated_uplift: Math.min(30, missingSignals.length * 8),
            evidence_source: 'trust_engine.signal_status',
            score_penalty: Math.min(20, missingSignals.length * 5),
        });
    }

    if (riskFlags.length > 0) {
        gaps.push({
            gap_id: makeGapId('authority_gap'),
            gap_type: 'authority_gap',
            severity: riskFlags.length >= 2 ? 'high' : 'medium',
            entity,
            missing_platforms: AI_ANSWER_PLATFORMS,
            missing_query_patterns: [],
            authority_gap_description: `Trust risk flags detected: ${riskFlags.slice(0, 3).join('; ')}`,
            estimated_uplift: Math.min(20, riskFlags.length * 6),
            evidence_source: 'trust_engine.risk_flags',
            score_penalty: Math.min(15, riskFlags.length * 4),
        });
    }

    return gaps;
}

function detectEntityGaps(
    entityResult: EntityGraphOutput | null,
    entity: string,
): VisibilityGap[] {
    if (!entityResult?.data) return [];
    const gaps: VisibilityGap[] = [];
    const entityMentions = entityResult.data.entity_mentions as Record<string, unknown> | undefined;

    if (!entityMentions) return gaps;

    const consistencyRatio = (entityMentions['consistency_ratio'] as number) ?? 1;
    const varianceIssues = (entityMentions['variance_issues'] as string[]) ?? [];

    if (consistencyRatio < 0.7 || varianceIssues.length > 0) {
        const severity = consistencyRatio < 0.4 ? 'critical' : consistencyRatio < 0.6 ? 'high' : 'medium';
        gaps.push({
            gap_id: makeGapId('entity_ambiguity'),
            gap_type: 'entity_ambiguity',
            severity,
            entity,
            missing_platforms: AI_ANSWER_PLATFORMS,
            missing_query_patterns: [
                `What is ${entity}?`,
                `${entity} company`,
                `${entity} product`,
            ],
            authority_gap_description: `Entity name consistency ratio is ${(consistencyRatio * 100).toFixed(0)}%. Inconsistent naming forces AI models to guess or skip citation. Variance issues: ${varianceIssues.slice(0, 2).join('; ')}`,
            estimated_uplift: Math.round((1 - consistencyRatio) * 40),
            evidence_source: 'entity_engine.entity_mentions.consistency_ratio',
            score_penalty: Math.round((1 - consistencyRatio) * 25),
        });
    }

    // Check for missing query coverage (primary entity has no associated queries)
    const primaryEntity = entityResult.data.primary_entity as Record<string, unknown> | undefined;
    if (primaryEntity && !primaryEntity['query_associations']) {
        gaps.push({
            gap_id: makeGapId('query_coverage_gap'),
            gap_type: 'query_coverage_gap',
            severity: 'high',
            entity,
            missing_platforms: AI_ANSWER_PLATFORMS,
            missing_query_patterns: [
                `${entity} for [use case]`,
                `How to use ${entity}`,
                `${entity} pricing`,
                `${entity} vs competitors`,
            ],
            authority_gap_description: 'No discoverable query clusters mapped to entity. Users cannot find this entity through natural language queries to AI systems.',
            estimated_uplift: 20,
            evidence_source: 'entity_engine.primary_entity',
            score_penalty: 15,
        });
    }

    return gaps;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * detectVisibilityGaps() — convert engine analysis to structured gap graph.
 *
 * INVARIANT: Every gap has:
 * - missing citation sources
 * - entity gap description
 * - query gap patterns
 * - authority gap description
 * - estimated_uplift (remediation value)
 * Gaps without estimated_uplift are non-compliant and will be filtered.
 */
export function detectVisibilityGaps(
    analysis: IntelligenceAnalysisResponse,
    entityOverride?: string,
): GapDetectionResult {
    const entityName =
        entityOverride ??
            (analysis.entity_graph?.data as Record<string, unknown> | undefined)
                ?.primary_entity
            ? ((analysis.entity_graph?.data as Record<string, unknown>)
                ?.primary_entity as Record<string, unknown>)?.canonical_name as string
            : analysis.url
                ? new URL(analysis.url).hostname
                : 'unknown';

    const domain = (() => {
        try { return new URL(analysis.url).hostname; }
        catch { return analysis.url; }
    })();

    const citationGaps = detectCitationGaps(
        analysis.citation_readiness as CitationReadinessOutput | null,
        String(entityName),
    );
    const authorityGaps = detectAuthorityGaps(
        analysis.trust_layer as TrustLayerOutput | null,
        String(entityName),
    );
    const entityGaps = detectEntityGaps(
        analysis.entity_graph as EntityGraphOutput | null,
        String(entityName),
    );

    // Filter: only keep gaps with valid uplift estimates (non-zero evidence)
    const allGaps = [...citationGaps, ...authorityGaps, ...entityGaps]
        .filter((g) => g.estimated_uplift > 0 && g.evidence_source)
        .sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

    const criticalCount = allGaps.filter((g) => g.severity === 'critical').length;
    const aggregatePenalty = Math.min(100, allGaps.reduce((sum, g) => sum + g.score_penalty, 0));
    const totalUplift = Math.min(100, allGaps.reduce((sum, g) => sum + g.estimated_uplift, 0));

    return {
        entity: String(entityName),
        domain,
        gaps: allGaps,
        total_gap_count: allGaps.length,
        critical_gap_count: criticalCount,
        aggregate_score_penalty: aggregatePenalty,
        estimated_total_uplift: totalUplift,
        detected_at: new Date().toISOString(),
    };
}
