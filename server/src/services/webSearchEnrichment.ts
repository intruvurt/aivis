import { openrouterPrompt } from '../config/aiProviders.js';

export type PromptEnrichment = {
    discoveredQueries: string[];
    competitorPages: string[];
    citationPatterns: string[];
};

const DEFAULT_MODEL = process.env.OPENROUTER_WEB_SEARCH_MODEL || 'google/gemini-2.5-flash';
const WEB_SEARCH_PLUGIN_ID = process.env.OPENROUTER_WEB_SEARCH_PLUGIN_ID || 'web-search';
const WEB_SEARCH_MAX_RESULTS = Math.min(
    8,
    Math.max(5, Number(process.env.OPENROUTER_WEB_SEARCH_MAX_RESULTS || 6)),
);

// Enrichment-only prompt: this output is never used as deterministic scoring truth.
const DEFAULT_SEARCH_PROMPT = [
    'Return top pages that are being cited or ranked for the query.',
    'Prioritize pages that:',
    '- contain structured answers (definitions, steps, FAQ)',
    '- appear in AI-generated answers or featured snippets',
    '- clearly define the topic in the first 100 words',
    '',
    'Return only high-signal pages. Ignore directories, forums, and thin content.',
].join('\n');

const ENRICHMENT_SCHEMA = {
    name: 'PromptEnrichment',
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            discoveredQueries: {
                type: 'array',
                items: { type: 'string' },
                minItems: 0,
                maxItems: 20,
            },
            competitorPages: {
                type: 'array',
                items: { type: 'string' },
                minItems: 0,
                maxItems: 10,
            },
            citationPatterns: {
                type: 'array',
                items: { type: 'string' },
                minItems: 0,
                maxItems: 10,
            },
        },
        required: ['discoveredQueries', 'competitorPages', 'citationPatterns'],
    },
} as const;

export async function enrichPromptIntelligenceWithWebSearch(args: {
    brandName: string;
    url: string;
    topics: string[];
    count: number;
}): Promise<PromptEnrichment | null> {
    const enabled = process.env.OPENROUTER_WEB_SEARCH_ENABLED === '1';
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
    if (!enabled || !apiKey) return null;

    const topicList = args.topics.filter(Boolean).slice(0, 8).join(', ');
    const prompt = [
        'You are an enrichment engine for prompt discovery.',
        'Generate high-signal query variants for competitor and citation discovery.',
        `Brand: ${args.brandName}`,
        `URL: ${args.url}`,
        `Topics: ${topicList || 'none'}`,
        `Return up to ${Math.max(5, Math.min(20, args.count))} discoveredQueries.`,
        'Keep queries practical and AI-answer-oriented.',
        'Exclude generic vanity terms and duplicate intent phrasing.',
    ].join('\n');

    try {
        const content = await openrouterPrompt(
            prompt,
            {},
            0,
            DEFAULT_MODEL,
            900,
            'Return strict JSON only.',
            0.2,
            'json_schema',
            20_000,
            undefined,
            ENRICHMENT_SCHEMA,
            [
                {
                    id: WEB_SEARCH_PLUGIN_ID,
                    max_results: WEB_SEARCH_MAX_RESULTS,
                    search_prompt: DEFAULT_SEARCH_PROMPT,
                    prevent_overrides: true,
                },
                { id: 'response-healing' },
            ],
        );

        const parsed = JSON.parse(String(content || '{}')) as PromptEnrichment;
        return {
            discoveredQueries: Array.isArray(parsed.discoveredQueries)
                ? parsed.discoveredQueries.map((q) => String(q).trim()).filter(Boolean)
                : [],
            competitorPages: Array.isArray(parsed.competitorPages)
                ? parsed.competitorPages.map((q) => String(q).trim()).filter(Boolean)
                : [],
            citationPatterns: Array.isArray(parsed.citationPatterns)
                ? parsed.citationPatterns.map((q) => String(q).trim()).filter(Boolean)
                : [],
        };
    } catch (err: any) {
        console.warn('[WebSearchEnrichment] enrichment skipped:', err?.message || err);
        return null;
    }
}
