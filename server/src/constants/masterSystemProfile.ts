export type MasterSourceKey =
    | 'cloudflare'
    | 'google_kg'
    | 'gsc'
    | 'serp'
    | 'geekflare';

export type MasterModuleKey =
    | 'ai_citation_readiness'
    | 'entity_authority'
    | 'content_completeness'
    | 'schema_readiness'
    | 'technical_health';

export type MasterOutputModeKey =
    | 'instant_audit'
    | 'continuous_monitoring'
    | 'content_optimizer';

export const AIVIS_MASTER_SYSTEM_PROFILE = {
    version: '1.0',
    identity: {
        platform_name: 'AIVIS — The AI Visibility Intelligence Platform',
        tagline: 'Not where you rank. Whether AI will quote you at all.',
        primary_question: 'Will AI quote this page — or skip it entirely?',
        not_an_seo_tool: true,
    },
    scoring_weights: {
        ai_citation_readiness: 25,
        entity_authority: 20,
        content_completeness: 25,
        schema_readiness: 15,
        technical_health: 15,
    } satisfies Record<MasterModuleKey, number>,
    source_requirements: {
        minimum_sources_required: 3,
        canonical_sources: [
            'cloudflare',
            'google_kg',
            'gsc',
            'serp',
            'geekflare',
        ] as const satisfies readonly MasterSourceKey[],
    },
    modules: [
        {
            key: 'ai_citation_readiness',
            label: 'AI Citation Readiness',
            intent: 'Plain-language verdict for why AI would or would not quote this page.',
        },
        {
            key: 'entity_authority',
            label: 'Entity Authority',
            intent: 'Entity recognition depth and authority confidence for brand/topic entities.',
        },
        {
            key: 'content_completeness',
            label: 'Content Completeness',
            intent: 'Intent alignment and structural coverage versus answer-ready competitor formats.',
        },
        {
            key: 'schema_readiness',
            label: 'Schema Readiness',
            intent: 'Schema type fit and required field completeness for machine extraction.',
        },
        {
            key: 'technical_health',
            label: 'Technical Health',
            intent: 'Technical blockers that reduce crawler trust and answer inclusion reliability.',
        },
    ] as const,
    output_modes: [
        {
            key: 'instant_audit',
            label: 'Instant Audit',
            intent: 'Single-URL diagnostic with unified score and top fixes.',
        },
        {
            key: 'continuous_monitoring',
            label: 'Continuous Monitoring',
            intent: 'Weekly trend and displacement alerts over tracked URLs.',
        },
        {
            key: 'content_optimizer',
            label: 'Content Optimizer',
            intent: 'Answer-ready block generation with schema recommendation and rewrites.',
        },
    ] as const satisfies readonly { key: MasterOutputModeKey; label: string; intent: string }[],
} as const;

export type AivisMasterSystemProfile = typeof AIVIS_MASTER_SYSTEM_PROFILE;
