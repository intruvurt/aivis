/**
 * Intent Shaper — Layer 0 of the AiVIS RAG Pipeline
 *
 * Converts an unstructured user query into a deterministic, typed intent
 * context before any search or retrieval occurs. This single step improves
 * downstream retrieval quality more than any API swap.
 *
 * Output is fully serialisable so it can be stored in the ledger alongside
 * the scan_id for full traceability.
 */

export type QueryIntent =
    | 'growth_verification'
    | 'competitive_comparison'
    | 'product_discovery'
    | 'credibility_check'
    | 'pricing_research'
    | 'use_case_fit'
    | 'technology_evaluation'
    | 'sentiment_probe'
    | 'entity_lookup'
    | 'general';

export type QueryDomain =
    | 'funding'
    | 'traffic'
    | 'reviews'
    | 'news'
    | 'pricing'
    | 'features'
    | 'integrations'
    | 'compliance'
    | 'team'
    | 'product';

export interface ShapedIntent {
    /** Original raw query before shaping */
    raw_query: string;
    /** Classified intent bucket */
    intent: QueryIntent;
    /** Primary entities extracted from the query */
    entities: string[];
    /** Relevant knowledge domains to retrieve from */
    domains: QueryDomain[];
    /** Lookback window expressed as a readable key */
    time_range: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_year' | 'all_time';
    /** ISO-3166-1 alpha-2 market scope, "global" if undetected */
    geography: string;
    /** 0–1 confidence in the shaped intent classification */
    confidence: number;
    /** Retrieval depth: 1 = surface, 3 = deep evidence, 5 = exhaustive */
    depth: 1 | 2 | 3 | 4 | 5;
    /** Expanded query variants to fan out to search providers */
    expanded_queries: string[];
}

// ── Intent signal maps ────────────────────────────────────────────────────────

const INTENT_SIGNALS: Record<QueryIntent, RegExp[]> = {
    growth_verification: [/grow/i, /grow(ing|th)/i, /revenue/i, /traction/i, /scale/i, /momentum/i, /mrr|arr/i],
    competitive_comparison: [/vs\.?|versus|compare|compared|alternative|better than|competitor/i],
    product_discovery: [/best .+? (tool|platform|software|solution)/i, /what is|what are/i, /recommend/i],
    credibility_check: [/legit|scam|trust|reliable|safe|review|honest/i],
    pricing_research: [/pric(e|ing)|cost|how much|plan|tier|paid|free/i],
    use_case_fit: [/who (should|can|uses)|best for|use case|ideal for/i],
    technology_evaluation: [/integrat|api|stack|tech|infrastructure|built with/i],
    sentiment_probe: [/opinion|sentiment|community|reddit|hacker news|people say/i],
    entity_lookup: [/who is|what is [A-Z]|tell me about/i],
    general: [],
};

const DOMAIN_SIGNALS: Record<QueryDomain, RegExp[]> = {
    funding: [/fund|invest|raise|series|valuation|capital/i],
    traffic: [/traffic|visit|user|dau|mau|session/i],
    reviews: [/review|rating|g2|capterra|trustpilot/i],
    news: [/news|announc|launch|release|product update/i],
    pricing: [/pric|cost|plan|tier|paid/i],
    features: [/feature|capabilit|function|support/i],
    integrations: [/integrat|api|plugin|connect|webhook/i],
    compliance: [/gdpr|hipaa|soc2|compliance|certif/i],
    team: [/ceo|founder|team|hire|headcount/i],
    product: [/product|roadmap|beta|launch/i],
};

const GEOGRAPHY_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
    { pattern: /\b(uk|united kingdom|britain)\b/i, code: 'GB' },
    { pattern: /\b(eu|europe|european)\b/i, code: 'EU' },
    { pattern: /\b(us|usa|united states|america)\b/i, code: 'US' },
    { pattern: /\b(canada|canadian)\b/i, code: 'CA' },
    { pattern: /\b(australia|australian)\b/i, code: 'AU' },
    { pattern: /\b(india|indian)\b/i, code: 'IN' },
    { pattern: /\b(germany|german|deutschland)\b/i, code: 'DE' },
    { pattern: /\b(france|french)\b/i, code: 'FR' },
];

const TIME_SIGNALS: Array<{ pattern: RegExp; range: ShapedIntent['time_range'] }> = [
    { pattern: /this week|last 7 days?|past week/i, range: 'last_7_days' },
    { pattern: /this month|last 30 days?|past month/i, range: 'last_30_days' },
    { pattern: /last (quarter|90 days?|3 months?)|q[1-4]/i, range: 'last_90_days' },
    { pattern: /this year|last (year|12 months?)/i, range: 'last_year' },
];

// ── Entity extraction (lightweight, no external API) ──────────────────────────

function extractEntities(query: string): string[] {
    const tokens = query.split(/\s+/);
    const entities: string[] = [];
    let i = 0;
    while (i < tokens.length) {
        // Multi-word capitalised sequences → probable named entity
        if (/^[A-Z][a-zA-Z0-9]*/.test(tokens[i]) && tokens[i].length > 1) {
            let span = tokens[i];
            let j = i + 1;
            while (j < tokens.length && /^[A-Z][a-zA-Z0-9]*/.test(tokens[j])) {
                span += ' ' + tokens[j];
                j++;
            }
            // Skip known stopwords masquerading as caps (sentence starts, Is, The, etc.)
            const SKIP_CAPS = new Set(['Is', 'Are', 'The', 'What', 'Who', 'How', 'Does', 'Can', 'And', 'Or', 'In', 'Of', 'For']);
            if (!SKIP_CAPS.has(span) && span.length > 1) {
                entities.push(span.trim());
            }
            i = j;
        } else {
            i++;
        }
    }
    return [...new Set(entities)].slice(0, 8);
}

// ── Query expansion ───────────────────────────────────────────────────────────

function expandQuery(raw: string, intent: QueryIntent, entities: string[]): string[] {
    const base = raw.trim();
    const expanded: string[] = [base];
    const primary = entities[0] || '';

    switch (intent) {
        case 'growth_verification':
            if (primary) {
                expanded.push(`${primary} revenue growth`, `${primary} user growth`, `${primary} traction metrics`);
            }
            break;
        case 'competitive_comparison':
            if (primary) {
                expanded.push(`${primary} alternatives`, `best ${primary} competitors`, `${primary} vs top tools`);
            }
            break;
        case 'credibility_check':
            if (primary) {
                expanded.push(`${primary} reviews`, `${primary} trustpilot`, `is ${primary} legit`);
            }
            break;
        case 'pricing_research':
            if (primary) {
                expanded.push(`${primary} pricing plans`, `${primary} cost per month`, `${primary} free vs paid`);
            }
            break;
        case 'product_discovery':
            expanded.push(`best tools like ${primary || base}`, `top alternatives to ${primary || base}`);
            break;
        default:
            if (primary) {
                expanded.push(`${primary} overview`, `learn about ${primary}`);
            }
    }

    return [...new Set(expanded)].slice(0, 6);
}

// ── Depth heuristic ───────────────────────────────────────────────────────────

function computeDepth(intent: QueryIntent): ShapedIntent['depth'] {
    const DEEP: Record<QueryIntent, ShapedIntent['depth']> = {
        growth_verification: 4,
        competitive_comparison: 3,
        credibility_check: 4,
        pricing_research: 2,
        use_case_fit: 3,
        technology_evaluation: 3,
        sentiment_probe: 4,
        product_discovery: 2,
        entity_lookup: 2,
        general: 1,
    };
    return DEEP[intent] ?? 2;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Shape a raw query into a typed, structured intent context.
 * Pure function — no side effects, no I/O.
 */
export function shapeIntent(rawQuery: string): ShapedIntent {
    const q = rawQuery.trim();

    // Intent classification
    let intent: QueryIntent = 'general';
    let maxSignals = 0;
    for (const [key, patterns] of Object.entries(INTENT_SIGNALS) as [QueryIntent, RegExp[]][]) {
        const hits = patterns.filter(p => p.test(q)).length;
        if (hits > maxSignals) { maxSignals = hits; intent = key; }
    }
    const confidence = maxSignals === 0 ? 0.4 : Math.min(0.95, 0.5 + maxSignals * 0.15);

    // Domain extraction
    const domains: QueryDomain[] = (Object.entries(DOMAIN_SIGNALS) as [QueryDomain, RegExp[]][])
        .filter(([, patterns]) => patterns.some(p => p.test(q)))
        .map(([key]) => key)
        .slice(0, 5);
    if (domains.length === 0) domains.push('product');

    // Time range
    let time_range: ShapedIntent['time_range'] = 'last_90_days';
    for (const { pattern, range } of TIME_SIGNALS) {
        if (pattern.test(q)) { time_range = range; break; }
    }

    // Geography
    let geography = 'global';
    for (const { pattern, code } of GEOGRAPHY_PATTERNS) {
        if (pattern.test(q)) { geography = code; break; }
    }

    // Entities
    const entities = extractEntities(q);

    // Expanded queries
    const expanded_queries = expandQuery(q, intent, entities);

    return {
        raw_query: q,
        intent,
        entities,
        domains,
        time_range,
        geography,
        confidence,
        depth: computeDepth(intent),
        expanded_queries,
    };
}
