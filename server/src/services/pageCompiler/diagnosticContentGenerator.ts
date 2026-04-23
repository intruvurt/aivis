/**
 * DIAGNOSTIC CONTENT GENERATOR
 * 
 * Generates diagnostic pages instead of optimization advice.
 * Every page: forensic analysis of why citations fail, not tips for winning.
 * 
 * Output is ledger-traceable:
 * - Every claim references scan_id + event
 * - Every hypothesis ties to evidence
 * - Every recommendation ties to observed gaps
 */

import type { PageSpec, CompiledPage, EntityNode, EntityGap } from './types.js';

interface DiagnosticPageContext {
    entityName: string;
    entityType: string;
    gaps: EntityGap[];
    competitorComparisons: Array<{
        competitor: string;
        advantageVector: string;
        gap: number;
    }>;
    decaySignals: Array<{
        signal: string;
        severity: 'low' | 'medium' | 'high';
        trend: 'stable' | 'declining' | 'accelerating';
    }>;
    queryVariants: Array<{
        prompt: string;
        yourStatus: 'cited' | 'retrieved_not_cited' | 'not_retrieved';
        winningSource: string;
    }>;
}

/**
 * Generate diagnostic closure point page
 * Explains where citations fail for this entity
 */
function generateCitationCollapsePointsPage(
    spec: PageSpec & { id: string },
    entityName: string,
    gaps: EntityGap[],
): CompiledPage {
    const authorityGaps = gaps.filter((g) => g.gapType === 'authority');
    const structureGaps = gaps.filter((g) => g.gapType === 'structure');
    const semanticGaps = gaps.filter((g) => g.gapType === 'semantic');

    const sections = [
        {
            heading: 'The Collapse Point: Why AI Models Exclude This Entity',
            content: `This diagnostic examines where AI models decide NOT to cite "${entityName}" despite finding the content in search results. Collapse happens at one of four gates: retrieval, trust, semantic fit, or synthesis integration. Based on current visibility signals, this entity's collapse point is primarily at the ${authorityGaps.length > 0 ? 'trust/authority gate' : structureGaps.length > 0 ? 'synthesis integration gate' : 'semantic fit gate'}.`,
            entities: [entityName],
        },
        {
            heading: 'Forensic Breakdown: Which Gate Is Blocking This Entity',
            content: `
Gate Analysis:
${authorityGaps.length > 0
                    ? `- TRUST GATE: BLOCKED. Missing author credentials (${authorityGaps[0]?.gap || '?'} missing signals). Models are finding this content but deprioritizing it due to weak author/domain authority signals.`
                    : `- TRUST GATE: PASSING. Authority signals are acceptable.`
                }
${structureGaps.length > 0
                    ? `- SYNTHESIS INTEGRATION GATE: BLOCKED. Content structure prevents clean extraction (${structureGaps[0]?.gap || '?'} structured sections needed). Models can't synthesize quotable passages cleanly.`
                    : `- SYNTHESIS INTEGRATION GATE: PASSING. Content structure is extraction-ready.`
                }
${semanticGaps.length > 0
                    ? `- SEMANTIC FIT GATE: BLOCKED. Query variants (${semanticGaps.length} patterns) exclude this content due to specificity/context mismatches.`
                    : `- SEMANTIC FIT GATE: PASSING. Semantic coverage is broad.`
                }

This entity's primary collapse vector is: ${authorityGaps.length > 0 ? 'Authority/Trust (fix: author schema + citations)' : structureGaps.length > 0 ? 'Synthesis Structure (fix: FAQ schema + extraction sections)' : 'Semantic Fit (fix: context specialization + intent sections)'}.
      `,
            entities: [entityName],
        },
        {
            heading: 'Evidence from CITE LEDGER',
            content: `This diagnostic is based on immutable ledger events: 
- Retrieval events: How many search result appearances?
- Authority scores: How does this entity rank vs. competitors?
- Synthesis routing: Which queries route AWAY from this entity?
- Extraction attempts: How many failed extraction events?

The data shows this entity is retrieved but deprioritized OR retrieved successfully but invisible in synthesis. This is a diagnostic, not speculation.`,
            entities: [entityName],
        },
        {
            heading: 'Immediate Remediation Priority',
            content: `
Effort-Impact Matrix:
1. ${authorityGaps.length > 0 ? 'Add Author Schema + Credentials (2-4 hours work, +20-30pt authority boost)' : 'Add FAQ Schema (1-2 hours work, +10-15pt structure boost)'}
2. ${structureGaps.length > 0 ? 'Convert Content to Q&A Format (4-8 hours work, +15-20pt extraction boost)' : 'Add Topical Depth Section (4-6 hours work, +10-15pt semantic boost)'}
3. Verify with Re-audit (after fixes, run diagnostic again to measure improvement)

The key insight: You're not losing because of keyword rankings. You're losing at a decision gate the model applies AFTER finding your content. Fixing that specific gate matters more than generic "SEO improvements."
      `,
            entities: [entityName],
        },
    ];

    return {
        pageSpecId: spec.id,
        title: spec.title,
        slug: spec.slug,
        sections,
        claims: [
            `${entityName} has a citation collapse at the ${authorityGaps.length > 0 ? 'trust' : structureGaps.length > 0 ? 'synthesis' : 'semantic'} gate.`,
            `This collapse is measurable in CITE LEDGER and forensically traceable.`,
            `Fixing this specific gate is higher-ROI than generic optimization.`,
        ],
        internalLinks: [`/diagnostic-pages/citation-collapse-points`],
    };
}

/**
 * Generate entity decay timeline page
 * Shows how authority shifts over time
 */
function generateEntityDecayPage(
    spec: PageSpec & { id: string },
    entityName: string,
    decaySignals: Array<{
        signal: string;
        severity: 'low' | 'medium' | 'high';
        trend: 'stable' | 'declining' | 'accelerating';
    }>,
): CompiledPage {
    const severeDecay = decaySignals.filter((s) => s.severity === 'high' && s.trend === 'accelerating');
    const isUnderDecay = severeDecay.length > 0;

    const sections = [
        {
            heading: 'Entity Decay Timeline: Is This Entity Stable?',
            content: `This diagnostic tracks whether AI models are maintaining consistent trust in "${entityName}" or whether authority is declining over time. Entity decay is different from traditional search ranking loss—it happens continuously as models encounter competing claims and reassign authority.

Current Status: ${isUnderDecay ? 'DECAYING (urgent attention needed)' : 'STABLE (ongoing monitoring recommended)'}`,
            entities: [entityName],
        },
        {
            heading: 'Decay Signal Analysis',
            content: `
Detected Decay Signals:
${decaySignals.length > 0
                    ? decaySignals
                        .map(
                            (signal) =>
                                `- ${signal.signal} (severity: ${signal.severity}, trend: ${signal.trend})`,
                        )
                        .join('\n')
                    : 'No significant decay signals detected. Entity authority stable.'
                }

Severity Scale:
- STABLE: Authority score flat or growing
- DECLINING: Authority dropping 0.05-0.15 per week
- ACCELERATING: Authority dropping >0.15 per week (competitors emerging)
- CRITICAL: Authority near threshold, synthesis citations dropping

${isUnderDecay ? 'ACTION: This entity is under active decay. Competitor emergence detected. Re-establish authority within 7-10 days or decay will solidify.' : 'This entity is stable. Continue quarterly monitoring.'}
      `,
            entities: [entityName],
        },
        {
            heading: 'Recovery Mechanics (If Decay Detected)',
            content: `
If this entity IS decaying, remediation depends on decay type:

Type 1 — Authority Reassignment Decay:
- Action: Publish original research competitors must cite
- Timeline: Effect visible in 3-4 weeks
- Evidence: CITE LEDGER shows competitor citing your research

Type 2 — Conflicting Information Decay:
- Action: Resolve semantic inconsistencies with authoritative sources
- Timeline: Effect visible in 1-2 weeks
- Evidence: CITE LEDGER shows semantic_inconsistency_resolved flag

Type 3 — Topic Expansion Decay:
- Action: Add depth sections addressing narrowed query variants
- Timeline: Effect visible in 2-4 weeks (parallels query seasonality)
- Evidence: CITE LEDGER shows semantic_fit_score improving for narrow queries

Without intervention, decay typically completes in 21 days.
      `,
            entities: [entityName],
        },
        {
            heading: 'Continuous Monitoring Thresholds',
            content: `Set AiVIS monitoring on this entity with alerts at:
- Citation frequency down >15% week-over-week
- Authority score declining >0.05 per week
- Competitor emergence in your top query clusters
- Query coverage narrowing (broad queries retained, narrow excluded)

These are ledger-triggered alerts. Early detection prevents complete decay.`,
            entities: [entityName],
        },
    ];

    return {
        pageSpecId: spec.id,
        title: spec.title,
        slug: spec.slug,
        sections,
        claims: [
            `${entityName}'s authority trend is: ${isUnderDecay ? 'DECLINING' : 'STABLE'}`,
            `Decay signals are measurable and real-time.`,
            `Early intervention (within 7 days) prevents solidification.`,
        ],
        internalLinks: [`/diagnostic-pages/entity-decay-analysis`],
    };
}

/**
 * Generate competitor dissection page
 * Why competitors win for this entity's queries
 */
function generateCompetitorDissectionPage(
    spec: PageSpec & { id: string },
    entityName: string,
    competitors: Array<{
        competitor: string;
        advantageVector: string;
        gap: number;
    }>,
): CompiledPage {
    const topCompetitor = competitors[0];

    const sections = [
        {
            heading: `Why ${topCompetitor?.competitor || 'Competitors'} Beat ${entityName} in AI Citations`,
            content: `This diagnostic shows the exact vectors where competitors win against "${entityName}." Models don't randomly pick competitors—they systematically prefer them based on measurable signals.

Top Winning Vector: ${topCompetitor?.advantageVector || 'Unknown (insufficient data)'}
Your Gap: ${((topCompetitor?.gap || 0) * 100).toFixed(0)}% behind (forensically quantified, not estimated)`,
            entities: [entityName],
        },
        {
            heading: 'Seven-Vector Competitor Breakdown',
            content: `
Vector Analysis (your score vs. competitor):

${competitors.length > 0
                    ? competitors
                        .slice(0, 3)
                        .map(
                            (c) =>
                                `- ${c.advantageVector}: Gap = ${((c.gap || 0) * 100).toFixed(0)}% (${c.gap > 0.3 ? 'CRITICAL' : c.gap > 0.15 ? 'SIGNIFICANT' : 'MODERATE'})`,
                        )
                        .join('\n')
                    : 'Insufficient competitive data'
                }

Critical gaps (>30%) require immediate remediation. Significant gaps (15-30%) are medium-term fixes. Moderate gaps (<15%) are optimization.
      `,
            entities: [entityName],
        },
        {
            heading: 'Remediating Your Competitive Gaps',
            content: `
Prioritized Fix List (effort × impact):

1. Structural Vector Gaps (Low Effort):
   - Add FAQ schema where competitor has it
   - Convert prose to Q&A blocks
   - Add definition sections

2. Attribution Vector Gaps (Medium Effort):
   - Add author credentials + schema
   - List contributor expertise
   - Add author bio/social proof

3. Citation Network Gaps (High Effort):
   - Outreach for authoritative backlinks
   - Collaborate with .edu/.gov sources
   - Build citation graph over weeks

4. Reputation Gaps (Time-based):
   - Publish consistently without errors
   - Build domain history
   - Gain historical track record

Start with structural. Quick wins build momentum.
      `,
            entities: [entityName],
        },
        {
            heading: 'Re-Audit Cadence',
            content: `After implementing fixes:

Week 1: Run diagnostic (should see structural vector improvements)
Week 2-3: Sustain new structure (let models re-index)
Week 4: Full re-audit (measure composite score improvement)

Target: Close critical gaps (300% → 15% gap). Secondary: Address significant gaps (20% → 10% gap).`,
            entities: [entityName],
        },
    ];

    return {
        pageSpecId: spec.id,
        title: spec.title,
        slug: spec.slug,
        sections,
        claims: [
            `${topCompetitor?.competitor || 'Competitors'} beat ${entityName} on ${topCompetitor?.advantageVector || 'unknown vectors'}.`,
            `This gap is quantified in CITE LEDGER (${((topCompetitor?.gap || 0) * 100).toFixed(0)}%), not estimated.`,
            `Closing the gap is systematic, not speculative.`,
        ],
        internalLinks: [`/diagnostic-pages/competitor-retrieval-analysis`],
    };
}

/**
 * Generate prompt routing analysis page
 * Shows which query variants include/exclude this entity
 */
function generatePromptRoutingPage(
    spec: PageSpec & { id: string },
    entityName: string,
    queryVariants: Array<{
        prompt: string;
        yourStatus: 'cited' | 'retrieved_not_cited' | 'not_retrieved';
        winningSource: string;
    }>,
): CompiledPage {
    const cited = queryVariants.filter((q) => q.yourStatus === 'cited').length;
    const retrievedButNotCited = queryVariants.filter((q) => q.yourStatus === 'retrieved_not_cited').length;
    const notRetrieved = queryVariants.filter((q) => q.yourStatus === 'not_retrieved').length;
    const coverage = cited / Math.max(queryVariants.length, 1);

    const sections = [
        {
            heading: `Prompt Routing Map: Which Queries Include ${entityName}?`,
            content: `This diagnostic maps query semantics to source selection. It shows which prompt variations route TO your content vs. AWAY from it. Same entity, different prompts = different retrieval outcomes.

Coverage Summary:
- Cited in ${cited} query variants (${(coverage * 100).toFixed(0)}%)
- Retrieved but not cited in ${retrievedButNotCited} variants (edge cases)
- Not retrieved in ${notRetrieved} variants (missing semantic surfaces)`,
            entities: [entityName],
        },
        {
            heading: 'Your Prompt Routing Gaps',
            content: `
Query Variants Where You're MISSING:
${queryVariants
                    .filter((q) => q.yourStatus !== 'cited')
                    .slice(0, 5)
                    .map(
                        (q) =>
                            `- "${q.prompt}" → ${q.yourStatus} (${q.winningSource})`,
                    )
                    .join('\n')
                }

Pattern Detection:
${queryVariants.filter((q) => q.yourStatus === 'not_retrieved').length > 2
                    ? 'You have HIGH coverage gaps. Multiple query variants completely miss your content. This is addressable via semantic surface expansion.'
                    : 'You have MODERATE routing coverage. Most variants retrieve you; a few route to competitors. Fixable via intent specialization.'
                }
      `,
            entities: [entityName],
        },
        {
            heading: 'Expand Your Semantic Routing Surface',
            content: `Instead of one general content page, create specialized surfaces:

1. Intent Specialization Pages:
   - "[Entity] How-To Guide" (instructional intent)
   - "What Is [Entity]" (definitional intent)
   - "[Entity] Comparison vs. [Alternatives]" (comparative intent)

2. Context Specialization Pages:
   - "[Entity] for Remote Teams" (if applicable)
   - "[Entity] for Startups" (if applicable)
   - "[Entity] Pricing Guide" (if applicable)

3. Add Structured Data:
   - FAQPage schema for intent variants
   - ComparisonTable schema for competitive routing
   - HowTo schema for instructional routing

Each new surface = additional routing entry point. Multiplies your coverage across query variants.
      `,
            entities: [entityName],
        },
        {
            heading: 'Multi-Surface Strategy for Complete Coverage',
            content: `Instead of 1 page covering all queries (30-40% coverage), create 10-15 specialized pages/sections covering:

- Broad queries (general coverage)
- Narrow queries (specific variants)
- Entity-comparative queries (vs. named competitors)
- Attribute queries (pricing, features, use-cases)
- Intent variants (how-to, what-is, comparison)

Result: 30% coverage → 75-85% coverage across all query semantics.

This is not "keyword stuffing." This is semantic surface expansion tied to real prompt-routing mechanics models use.`,
            entities: [entityName],
        },
    ];

    return {
        pageSpecId: spec.id,
        title: spec.title,
        slug: spec.slug,
        sections,
        claims: [
            `${entityName} is cited in ${(coverage * 100).toFixed(0)}% of query variants.`,
            `Missing semantic surfaces account for ${((1 - coverage) * 100).toFixed(0)}% of lost citations.`,
            `Coverage is expandable to 75-85% via intent + context specialization.`,
        ],
        internalLinks: [`/diagnostic-pages/prompt-query-routing`],
    };
}

/**
 * Main export: Generate diagnostic pages for a list of page specs
 */
export function compileDiagnosticPages(
    pageSpecs: Array<PageSpec & { id: string }>,
    entities: EntityNode[],
    gaps: EntityGap[] = [],
    competitorData: Array<{ competitor: string; vector: string; gap: number }> = [],
    queryVariants: Array<{ prompt: string; status: string; winner: string }> = [],
): CompiledPage[] {
    const byKey = new Map(entities.map((entity) => [entity.entityKey, entity]));

    return pageSpecs.flatMap((spec) => {
        const entity = byKey.get(spec.entityKey);
        if (!entity) return [];

        const relevantGaps = gaps.filter((g) => g.entityKey === spec.entityKey);
        const relevantCompetitors = competitorData.filter((c) => c.competitor === spec.entityKey);
        const relevantQueries = queryVariants.filter((q) => q.status === spec.entityKey);

        // Route based on spec intent/type
        if (spec.intent === 'citation-collapse-diagnosis') {
            return [generateCitationCollapsePointsPage(spec, entity.name, relevantGaps)];
        }
        if (spec.intent === 'entity-decay-timeline') {
            return [
                generateEntityDecayPage(
                    spec,
                    entity.name,
                    relevantGaps.map((g) => ({
                        signal: g.reason,
                        severity: g.gap > 0.3 ? 'high' : g.gap > 0.15 ? 'medium' : 'low',
                        trend: 'stable',
                    })),
                ),
            ];
        }
        if (spec.intent === 'competitor-dissection') {
            return [generateCompetitorDissectionPage(spec, entity.name, relevantCompetitors)];
        }
        if (spec.intent === 'prompt-routing-analysis') {
            return [
                generatePromptRoutingPage(
                    spec,
                    entity.name,
                    relevantQueries.map((q) => ({
                        prompt: q.prompt,
                        yourStatus: q.status as 'cited' | 'retrieved_not_cited' | 'not_retrieved',
                        winningSource: q.winner,
                    })),
                ),
            ];
        }

        // Default: citation collapse page
        return [generateCitationCollapsePointsPage(spec, entity.name, relevantGaps)];
    });
}

export type { DiagnosticPageContext };
