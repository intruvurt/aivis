export type AuditSourceKey =
    | 'cloudflare'
    | 'google_kg'
    | 'gsc'
    | 'serp'
    | 'geekflare';

/**
 * Neutral public-facing display labels for each evidence layer.
 * These replace vendor names in all serialized outputs and text formatting.
 * Internal AuditSourceKey values are never exposed to callers.
 */
const SOURCE_DISPLAY_LABELS: Readonly<Record<AuditSourceKey, string>> = {
    cloudflare: 'traffic_physics',
    google_kg: 'entity_authority',
    gsc: 'demand_intent',
    serp: 'serp_citation',
    geekflare: 'technical_health',
};

/** Canonical role descriptor for each evidence layer in the citation truth pipeline. */
const EVIDENCE_LAYER_ROLES: Readonly<Record<AuditSourceKey, string>> = {
    cloudflare: 'behavior_traffic_physics',
    google_kg: 'authority_entity_validation',
    gsc: 'demand_intent_drift',
    serp: 'authority_entity_validation',
    geekflare: 'technical_citability',
};

/** Human-readable description of each evidence layer's role in citation truth. */
const EVIDENCE_LAYER_DESCRIPTIONS: Readonly<Record<AuditSourceKey, string>> = {
    cloudflare: 'AI crawler detection, cache/latency trust signals, traffic physics layer.',
    google_kg: 'Knowledge Graph entity existence and authority confirmation.',
    gsc: 'Search demand trends, query intent drift, and demand-to-ledger gap mapping.',
    serp: 'SERP presence and competitive citation displacement signals.',
    geekflare: 'Technical citability — Lighthouse, load time, TLS, broken link signals.',
};

export type AuditIssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditIssue {
    type: string;
    severity: AuditIssueSeverity;
    reason: string;
    fix: string;
}

export interface AuditModule {
    score: number;
    issues: AuditIssue[];
}

export interface FinalAuditSchema {
    score: number;
    modules: {
        citation_readiness: AuditModule;
        entity_authority: AuditModule;
        content_completeness: AuditModule;
        schema: AuditModule;
        technical_health: AuditModule;
    };
    top_fixes: string[];
    verdict: string;
    metadata: {
        timestamp: string;
        /** Neutral display labels — no vendor names exposed. Mapped from internal AuditSourceKey. */
        sources_used: string[];
        source_count: number;
        minimum_sources_required: number;
        requirement_met: boolean;
    };
    /** Active evidence layers with role descriptors — feeds citation truth identity in API responses. */
    evidence_layers_active: Array<{
        /** Neutral display label — vendor name is never exposed. */
        layer_id: string;
        role: string;
        description: string;
    }>;
    /** Canonical identity of the system that produced this record. */
    system_class: 'AI Citation Truth Engine';
    // Compatibility fields retained for existing clients.
    visibility_score?: number;
    analyzed_at?: string;
    url?: string;
    summary?: string;
    recommendations?: Array<{ title?: string; description?: string;[key: string]: unknown }>;
    [key: string]: unknown;
}

export type AuditOutputMode = 'core' | 'presentation' | 'dual';

const MINIMUM_SOURCES_REQUIRED = 3;

function clampScore(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function inferSeverity(raw: unknown): AuditIssueSeverity {
    const text = String(raw ?? '').toLowerCase();
    if (text.includes('critical')) return 'critical';
    if (text.includes('high')) return 'high';
    if (text.includes('medium')) return 'medium';
    return 'low';
}

function asIssue(raw: any): AuditIssue {
    const type = String(raw?.type || raw?.id || 'unknown_issue');
    const reason = String(raw?.reason || raw?.description || raw?.impact || 'Reason not provided');
    const fix = String(raw?.fix || raw?.recommendation || raw?.action || 'Fix not provided');

    return {
        type,
        severity: inferSeverity(raw?.severity || raw?.priority),
        reason,
        fix,
    };
}

function normalizeModule(rawModule: any, fallbackScore: number): AuditModule {
    const issuesRaw = Array.isArray(rawModule?.issues)
        ? rawModule.issues
        : Array.isArray(rawModule?.gaps)
            ? rawModule.gaps
            : [];

    return {
        score: clampScore(rawModule?.score ?? fallbackScore),
        issues: issuesRaw.map(asIssue),
    };
}

function extractSources(raw: any): AuditSourceKey[] {
    const direct = Array.isArray(raw?.metadata?.sources_used)
        ? raw.metadata.sources_used.map((s: unknown) => String(s).toLowerCase())
        : [];

    const signalMap: Record<AuditSourceKey, boolean> = {
        cloudflare: !!raw?.api_signal_coverage?.cloudflare_bot_signals,
        google_kg: !!raw?.api_signal_coverage?.knowledge_graph_signals,
        gsc: !!raw?.api_signal_coverage?.query_demand_signals,
        serp: !!raw?.api_signal_coverage?.serp_answer_signals,
        geekflare: !!raw?.api_signal_coverage?.technical_health_signals,
    };

    const inferred = (Object.keys(signalMap) as AuditSourceKey[]).filter((k) => signalMap[k]);
    const merged = new Set<AuditSourceKey>();

    for (const s of [...direct, ...inferred]) {
        if (s === 'cloudflare' || s === 'google_kg' || s === 'gsc' || s === 'serp' || s === 'geekflare') {
            merged.add(s);
        }
    }

    return [...merged];
}

function fallbackVerdict(score: number, sourceRequirementMet: boolean): string {
    if (!sourceRequirementMet) {
        return 'Audit confidence is limited because fewer than 3 required data sources were active. AI citation probability is not trustworthy until source coverage is met.';
    }

    if (score >= 80) {
        return 'This page is likely to be cited by AI systems. Extractability, trust, and structure are strong enough for quotation eligibility.';
    }
    if (score >= 60) {
        return 'This page is close to citation readiness, but key structural and trust gaps still reduce quote probability. Fixing the top issues can move it into citation territory.';
    }
    if (score >= 40) {
        return 'This page has structural weaknesses that make AI citation unreliable. AI systems may parse parts of the page, but trust and consistency signals are not yet strong.';
    }
    return 'This page is currently unlikely to be cited by AI systems. Core trust, extraction, and structural signals are too weak for reliable quote inclusion.';
}

function buildTopFixes(raw: any): string[] {
    const direct = Array.isArray(raw?.top_fixes)
        ? raw.top_fixes.map((f: unknown) => String(f).trim()).filter(Boolean)
        : [];

    if (direct.length > 0) return direct.slice(0, 5);

    const recTitles = Array.isArray(raw?.recommendations)
        ? raw.recommendations
            .map((r: any) => String(r?.title || r?.description || '').trim())
            .filter(Boolean)
        : [];

    return recTitles.slice(0, 5);
}

export function normalizeFinalAuditSchema(raw: any, url?: string): FinalAuditSchema {
    const overallScore = clampScore(raw?.score ?? raw?.visibility_score);

    const fallbackByCategory = new Map<string, number>();
    if (Array.isArray(raw?.category_grades)) {
        for (const grade of raw.category_grades) {
            const key = String(grade?.label || '').toLowerCase();
            const value = clampScore(grade?.score);
            if (key) fallbackByCategory.set(key, value);
        }
    }

    const citationReadiness = normalizeModule(raw?.modules?.citation_readiness, fallbackByCategory.get('citation readiness') ?? overallScore);
    const entityAuthority = normalizeModule(raw?.modules?.entity_authority, fallbackByCategory.get('entity authority') ?? overallScore);
    const contentCompleteness = normalizeModule(raw?.modules?.content_completeness, fallbackByCategory.get('content completeness') ?? overallScore);
    const schema = normalizeModule(raw?.modules?.schema, fallbackByCategory.get('schema') ?? overallScore);
    const technicalHealth = normalizeModule(raw?.modules?.technical_health, fallbackByCategory.get('technical health') ?? overallScore);

    const sourcesUsed = extractSources(raw);
    const sourceCount = sourcesUsed.length;
    const requirementMet = sourceCount >= MINIMUM_SOURCES_REQUIRED;

    const metadataTimestamp = String(
        raw?.metadata?.timestamp || raw?.analyzed_at || new Date().toISOString(),
    );

    const topFixes = buildTopFixes(raw);

    const evidenceLayersActive = sourcesUsed.map((source) => ({
        layer_id: SOURCE_DISPLAY_LABELS[source],
        role: EVIDENCE_LAYER_ROLES[source],
        description: EVIDENCE_LAYER_DESCRIPTIONS[source],
    }));

    // Use neutral display labels in all serialized output — vendor names stay internal.
    const sourcesUsedDisplay = sourcesUsed.map((s) => SOURCE_DISPLAY_LABELS[s]);

    return {
        ...raw,
        score: overallScore,
        modules: {
            citation_readiness: citationReadiness,
            entity_authority: entityAuthority,
            content_completeness: contentCompleteness,
            schema,
            technical_health: technicalHealth,
        },
        top_fixes: topFixes,
        verdict: String(raw?.verdict || raw?.summary || fallbackVerdict(overallScore, requirementMet)),
        metadata: {
            timestamp: metadataTimestamp,
            sources_used: sourcesUsedDisplay,
            source_count: sourceCount,
            minimum_sources_required: MINIMUM_SOURCES_REQUIRED,
            requirement_met: requirementMet,
        },
        evidence_layers_active: evidenceLayersActive,
        system_class: 'AI Citation Truth Engine' as const,
        visibility_score: clampScore(raw?.visibility_score ?? overallScore),
        analyzed_at: String(raw?.analyzed_at || metadataTimestamp),
        url: String(raw?.url || url || ''),
    };
}

export function formatAuditForUser(core: FinalAuditSchema): string {
    const lines = [
        `AI CITATION TRUTH SCORE: ${core.score}/100`,
        '',
        'SUB-SCORES:',
        `- Citation Readiness: ${core.modules.citation_readiness.score}`,
        `- Entity Authority: ${core.modules.entity_authority.score}`,
        `- Content Completeness: ${core.modules.content_completeness.score}`,
        `- Schema: ${core.modules.schema.score}`,
        `- Technical Health: ${core.modules.technical_health.score}`,
        '',
        'VERDICT:',
        core.verdict,
        '',
        'TOP FIXES (each tied to a ledger evidence gap):',
    ];

    if (core.top_fixes.length === 0) {
        lines.push('1. No prioritized fixes were returned in the current audit payload.');
    } else {
        core.top_fixes.slice(0, 5).forEach((fix, index) => {
            lines.push(`${index + 1}. ${fix}`);
        });
    }

    lines.push('');
    if (core.evidence_layers_active.length > 0) {
        lines.push('EVIDENCE LAYERS ACTIVE:');
        for (const layer of core.evidence_layers_active) {
            lines.push(`- ${layer.layer_id} [${layer.role}]: ${layer.description}`);
        }
    } else {
        lines.push(`SIGNAL LAYERS: ${core.metadata.sources_used.join(', ') || 'none detected'}`);
    }
    lines.push(`TIMESTAMP: ${core.metadata.timestamp}`);
    lines.push(
        `SOURCE REQUIREMENT: ${core.metadata.source_count}/${core.metadata.minimum_sources_required} (${core.metadata.requirement_met ? 'met' : 'not met'})`,
    );

    return lines.join('\n');
}

export function buildPresentationPayload(core: FinalAuditSchema) {
    return {
        instant_audit: formatAuditForUser(core),
        monitoring: {
            wins: ['New AI citations gained: pending current vs prior scan diff.'],
            losses: ['Competitor displacement: pending competitive delta computation.'],
            opportunities: ['Near-citation pages: pending threshold-based expansion from current gaps.'],
        },
        content_optimizer: {
            definition_block: 'Define the entity in one sentence with explicit category and differentiator.',
            tldr: 'Summarize the page in 2-3 sentences with direct, citation-safe claims.',
            step_list: [
                'State the entity and primary claim in the first paragraph.',
                'Add one evidence-backed example with source attribution.',
                'Close with a concise FAQ-ready summary section.',
            ],
            faq: [
                'What is this page about?',
                'Why should AI trust this page as a source?',
                'What evidence supports the main claim?',
            ],
            schema_markup: 'Use Organization, WebPage, and FAQPage only when each field is evidence-backed by on-page content.',
        },
    };
}

export function parseAuditOutputMode(rawMode: unknown): AuditOutputMode {
    const mode = String(rawMode || '').toLowerCase();
    if (mode === 'core') return 'core';
    if (mode === 'presentation') return 'presentation';
    return 'dual';
}

export function buildAuditApiResponse(core: FinalAuditSchema, mode: AuditOutputMode, cached: boolean) {
    if (mode === 'core') {
        return { ...core, output_mode: 'core', cached };
    }

    const presentation = buildPresentationPayload(core);

    if (mode === 'presentation') {
        return {
            output_mode: 'presentation',
            cached,
            presentation,
            metadata: core.metadata,
            score: core.score,
            url: core.url,
            analyzed_at: core.analyzed_at,
        };
    }

    return {
        ...core,
        output_mode: 'dual',
        cached,
        presentation,
    };
}
