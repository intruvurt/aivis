/**
 * Action Graph Compiler
 *
 * Converts detected VisibilityGaps into a structured ActionGraph with
 * concrete remediation tasks, expected citation uplift, and execution order.
 *
 * INVARIANT: No insight without a path to citation gain.
 * Every gap fed into compileActionGraph() MUST produce at least one
 * ActionNode. Gaps without an action are rejected as non-compliant.
 *
 * The output satisfies:
 *   output.citations[] OR output.action_plan[] — BOTH must be present
 *   for the output to be compliant.
 */

import type { GapDetectionResult, VisibilityGap, GapType } from './gapDetectionEngine.js';

// ── Action types ─────────────────────────────────────────────────────────────

export type ActionType =
    | 'content_generation'
    | 'schema_enhancement'
    | 'citation_seed'
    | 'authority_signal'
    | 'entity_consolidation'
    | 'query_cluster_expansion'
    | 'trust_signal_repair'
    | 'freshness_update';

export type ActionPriority = 'p0' | 'p1' | 'p2' | 'p3';

export interface ActionNode {
    action_id: string;
    action_type: ActionType;
    priority: ActionPriority;
    /** Gap(s) this action closes */
    resolves_gap_ids: string[];
    gap_type: GapType;
    title: string;
    description: string;
    /** Entities that must appear in the output for the fix to take effect */
    required_entities: string[];
    /** Expected score delta (0–100 scale) after this action is executed */
    expected_uplift: number;
    /** Implementation detail for automated patch tools */
    implementation_hint: string;
    /** Effort estimate: hours or story points */
    effort_estimate: 'trivial' | 'low' | 'medium' | 'high';
    /** Whether ScoreFix engine can automate this */
    is_automatable: boolean;
}

export interface VisibilityActionGraph {
    entity: string;
    domain: string;
    actions: ActionNode[];
    total_action_count: number;
    automatable_count: number;
    /** Expected total score delta if ALL actions executed */
    projected_total_uplift: number;
    /** Projected score after executing top-3 priority actions */
    projected_score_after_top3: number;
    compiled_at: string;
}

// ── Action ID generator ───────────────────────────────────────────────────────

let actionCounter = 0;
function makeActionId(type: ActionType): string {
    return `act_${type}_${Date.now()}_${(++actionCounter).toString().padStart(4, '0')}`;
}

// ── Gap → Action mapping ─────────────────────────────────────────────────────

function buildActionsForGap(gap: VisibilityGap): ActionNode[] {
    const nodes: ActionNode[] = [];

    switch (gap.gap_type) {
        case 'citation_absence': {
            nodes.push({
                action_id: makeActionId('citation_seed'),
                action_type: 'citation_seed',
                priority: 'p0',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Add structured FAQ injection for ${gap.entity}`,
                description: 'Inject an FAQ schema block with direct answers to common AI queries. AI crawlers prioritize explicit QA structures for citation extraction.',
                required_entities: [gap.entity, 'FAQPage', 'schema.org'],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.7),
                implementation_hint: 'Add <script type="application/ld+json"> FAQPage schema with 5–10 Q/A pairs covering the missing_query_patterns.',
                effort_estimate: 'low',
                is_automatable: true,
            });
            nodes.push({
                action_id: makeActionId('content_generation'),
                action_type: 'content_generation',
                priority: 'p1',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Create targeted content for: ${gap.missing_query_patterns.slice(0, 2).join(' / ')}`,
                description: 'Generate a blog post or landing page section explicitly targeting the missing query patterns. Must include the entity name in H1, meta, and first paragraph.',
                required_entities: [gap.entity, ...gap.missing_query_patterns.slice(0, 2)],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.5),
                implementation_hint: `Target queries: ${gap.missing_query_patterns.join(', ')}. Minimum 600 words. Include citations to authoritative sources.`,
                effort_estimate: 'medium',
                is_automatable: false,
            });
            break;
        }

        case 'entity_ambiguity': {
            nodes.push({
                action_id: makeActionId('entity_consolidation'),
                action_type: 'entity_consolidation',
                priority: 'p0',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Consolidate entity name usage for "${gap.entity}"`,
                description: 'Ensure the canonical entity name appears consistently in title, H1, meta description, OG tags, and schema.org Organization markup. Variance forces AI models to create multiple conflicting entity nodes.',
                required_entities: [gap.entity],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.8),
                implementation_hint: 'Run entity consolidation: unify all name variants to canonical form. Add schema.org/Organization with canonical name + sameAs links.',
                effort_estimate: 'low',
                is_automatable: true,
            });
            nodes.push({
                action_id: makeActionId('schema_enhancement'),
                action_type: 'schema_enhancement',
                priority: 'p1',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Add DefinedTermSet + Organization schema for ${gap.entity}`,
                description: 'Expand schema.org coverage to explicitly define the entity: its category, domain, and relationship to industry concepts. This seeds the AI entity graph.',
                required_entities: [gap.entity, 'Organization', 'DefinedTermSet'],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.4),
                implementation_hint: 'Add schema.org/DefinedTermSet with all product/service category terms. Include DefinedTerm nodes for each core concept.',
                effort_estimate: 'low',
                is_automatable: true,
            });
            break;
        }

        case 'authority_gap': {
            nodes.push({
                action_id: makeActionId('trust_signal_repair'),
                action_type: 'trust_signal_repair',
                priority: gap.severity === 'critical' ? 'p0' : 'p1',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Repair authority signals: ${gap.authority_gap_description.slice(0, 60)}`,
                description: `Address missing trust signals that prevent AI citation models from grounding your entity. ${gap.authority_gap_description}`,
                required_entities: [gap.entity],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.9),
                implementation_hint: 'Checklist: HTTPS enforcement, contact page with verifiable details, privacy policy at /privacy, schema.org/ContactPoint, TLS cert renewal.',
                effort_estimate: gap.severity === 'critical' ? 'medium' : 'trivial',
                is_automatable: gap.severity !== 'critical',
            });
            nodes.push({
                action_id: makeActionId('authority_signal'),
                action_type: 'authority_signal',
                priority: 'p2',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Build external authority links for ${gap.entity}`,
                description: 'Acquire citations from Wikipedia, Crunchbase, industry directories, and authoritative external sites. External citations directly increase citation probability in AI systems.',
                required_entities: [gap.entity, 'Wikipedia', 'Crunchbase'],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.5),
                implementation_hint: 'Target: Wikipedia article creation, Crunchbase profile, LinkedIn company page, Product Hunt listing, relevant industry directories.',
                effort_estimate: 'high',
                is_automatable: false,
            });
            break;
        }

        case 'query_coverage_gap': {
            nodes.push({
                action_id: makeActionId('query_cluster_expansion'),
                action_type: 'query_cluster_expansion',
                priority: 'p1',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Expand query cluster surface for ${gap.entity}`,
                description: `Map the entity to ${gap.missing_query_patterns.length} missing query patterns. Each pattern needs a dedicated content entry point.`,
                required_entities: [gap.entity, ...gap.missing_query_patterns.slice(0, 3)],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.75),
                implementation_hint: `Create content targeting: ${gap.missing_query_patterns.join(', ')}. Use conversational H2 headers. Include natural language answers.`,
                effort_estimate: 'medium',
                is_automatable: false,
            });
            break;
        }

        case 'schema_gap': {
            nodes.push({
                action_id: makeActionId('schema_enhancement'),
                action_type: 'schema_enhancement',
                priority: gap.severity === 'critical' ? 'p0' : 'p1',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Implement structured schema for ${gap.entity}`,
                description: 'Add machine-readable schema markup that AI answer engines use for entity grounding and content extraction.',
                required_entities: [gap.entity, 'schema.org'],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.85),
                implementation_hint: 'Add: Organization, WebSite, BreadcrumbList, FAQPage, HowTo (where applicable). Use Google\'s Rich Results test to validate.',
                effort_estimate: 'low',
                is_automatable: true,
            });
            break;
        }

        case 'content_density_gap': {
            nodes.push({
                action_id: makeActionId('content_generation'),
                action_type: 'content_generation',
                priority: 'p0',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Increase content density and quotability for ${gap.entity}`,
                description: 'Add structured, quotable content sections that AI models can extract. Each section should have a clear claim, evidence, and entity reference.',
                required_entities: [gap.entity],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.8),
                implementation_hint: 'For each key topic: write 150–300 word sections with clear topic sentence, 2–3 supporting facts, and citation-ready structure. Avoid JS-only rendering.',
                effort_estimate: 'medium',
                is_automatable: false,
            });
            nodes.push({
                action_id: makeActionId('citation_seed'),
                action_type: 'citation_seed',
                priority: 'p1',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Add answer-block content structures for ${gap.entity}`,
                description: 'Insert direct-answer content blocks (concise 40–60 word definitions, numbered how-to steps) that AI models preferentially cite.',
                required_entities: [gap.entity],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.45),
                implementation_hint: 'Add a TL;DR section near page top. Use <dl>/<dt>/<dd> or definition-style paragraphs. Avoid answer fragmentation across JS components.',
                effort_estimate: 'low',
                is_automatable: true,
            });
            break;
        }

        case 'link_authority_gap': {
            nodes.push({
                action_id: makeActionId('authority_signal'),
                action_type: 'authority_signal',
                priority: 'p2',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Build inbound link authority for ${gap.entity}`,
                description: 'Acquire high-authority inbound links from domains cited by AI answer engines.',
                required_entities: [gap.entity],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.6),
                implementation_hint: 'Target: thought leadership articles in industry publications, guest posts, mention outreach to bloggers already cited in AI answers for your category.',
                effort_estimate: 'high',
                is_automatable: false,
            });
            break;
        }

        case 'freshness_gap': {
            nodes.push({
                action_id: makeActionId('freshness_update'),
                action_type: 'freshness_update',
                priority: 'p2',
                resolves_gap_ids: [gap.gap_id],
                gap_type: gap.gap_type,
                title: `Update content freshness signals for ${gap.entity}`,
                description: 'AI models weight recently-updated content more heavily. Add lastReviewed schema, update meta dates, and refresh key content blocks.',
                required_entities: [gap.entity],
                expected_uplift: Math.ceil(gap.estimated_uplift * 0.5),
                implementation_hint: 'Add schema.org dateModified. Update the "last updated" metadata. Refresh 30% of content with current-year information.',
                effort_estimate: 'trivial',
                is_automatable: true,
            });
            break;
        }
    }

    return nodes;
}

// ── Uplift simulation ────────────────────────────────────────────────────────

/**
 * Simulate expected visibility score after executing actions.
 *
 * Applies diminishing returns: each additional action has 85% of previous
 * action's marginal contribution to avoid overconfident projections.
 */
export function simulateVisibilityUplift(
    baseScore: number,
    actions: ActionNode[],
): { projected_score: number; uplift_breakdown: Array<{ action_id: string; uplift: number }> } {
    const sorted = [...actions].sort((a, b) => b.expected_uplift - a.expected_uplift);
    let score = baseScore;
    let decay = 1.0;
    const breakdown: Array<{ action_id: string; uplift: number }> = [];

    for (const action of sorted) {
        const uplift = Math.round(action.expected_uplift * decay);
        score = Math.min(100, score + uplift);
        breakdown.push({ action_id: action.action_id, uplift });
        decay *= 0.85;
    }

    return { projected_score: score, uplift_breakdown: breakdown };
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * compileActionGraph() — convert VisibilityGaps into an ordered ActionGraph.
 *
 * INVARIANT: Every gap produces at least one action.
 * Gaps with zero actions are a compiler violation and will throw.
 */
export function compileActionGraph(
    gapResult: GapDetectionResult,
    baseScore = 0,
): VisibilityActionGraph {
    const allActions: ActionNode[] = [];

    for (const gap of gapResult.gaps) {
        const actions = buildActionsForGap(gap);
        if (actions.length === 0) {
            throw new Error(
                `ACTION_COMPILER_VIOLATION: Gap ${gap.gap_id} (type=${gap.gap_type}) produced zero actions. Every gap must have a remediation path.`,
            );
        }
        allActions.push(...actions);
    }

    // Deduplicate by action_type + gap_type to avoid flooding similar actions
    const seen = new Set<string>();
    const deduped = allActions.filter((a) => {
        const key = `${a.action_type}::${a.gap_type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort: p0 first, then p1, p2, p3; within priority sort by highest uplift
    const priorityOrder: Record<ActionPriority, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };
    const sorted = deduped.sort((a, b) => {
        const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pd !== 0) return pd;
        return b.expected_uplift - a.expected_uplift;
    });

    const { projected_score: projectedTop3 } = simulateVisibilityUplift(
        baseScore,
        sorted.slice(0, 3),
    );
    const { projected_score: projectedAll } = simulateVisibilityUplift(baseScore, sorted);
    const automatableCount = sorted.filter((a) => a.is_automatable).length;

    return {
        entity: gapResult.entity,
        domain: gapResult.domain,
        actions: sorted,
        total_action_count: sorted.length,
        automatable_count: automatableCount,
        projected_total_uplift: Math.max(0, projectedAll - baseScore),
        projected_score_after_top3: projectedTop3,
        compiled_at: new Date().toISOString(),
    };
}
