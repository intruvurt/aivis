/**
 * existenceMapper.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The full 8-step existence mapping pipeline.
 *
 * This answers the only question that matters:
 *   "Does this brand exist inside AI-generated answer space — and where it
 *    doesn't, why not, and what is fixable?"
 *
 * Steps:
 *   1. Identity extraction   — who this entity is (from scrape + structured data)
 *   2. Query generation      — typed, labeled, rationale-linked queries
 *   3. Parallel answer test  — run each query across web + AI; collect existence signals
 *   4. Citation capture      — every result → citation_ledger via forensicPipeline
 *   5. Authority mapping     — correlation of sources, authority, coverage
 *   6. Gap detection         — where brand should appear but doesn't
 *   7. Visibility scoring    — evidence-grounded, no synthetic metrics
 *   8. Action layer          — specific, traceable repair instructions
 *
 * Key constraint: "you don't search FOR the brand — you test whether the brand
 * appears when it should." Every score traces to evidence. No black boxes.
 */

import { scrapeWebsite } from './scraper.js';
import { extractEvidenceFromScrape } from './evidenceExtractor.js';
import { callAIProvider } from './aiProviders.js';
import { renderPrompt } from './promptRegistry.js';
import { pipeline as forensicPipeline, startScanRun } from './forensicPipeline.js';
import { probeQuery } from './existenceProbe.js';
import { getPool } from './postgresql.js';
import type { ProbeResult, TypedQuery } from './existenceProbe.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const QUERY_GEN_MODEL = 'google/gemma-3-27b-it:free';
const MAX_PARALLEL_PROBES = 3;
const PROBE_DELAY_MS = 300;

// ── Output types ──────────────────────────────────────────────────────────────

export interface PrimaryEntity {
    name: string;
    domain: string;
    aliases: string[];
    description: string;
    schemaTypes: string[];
    sameAsLinks: string[];
    headings: string[];
    authoritySignals: {
        hasOrgSchema: boolean;
        hasSameAs: boolean;
        hasAuthor: boolean;
        hasLLMsTxt: boolean;
        robotsAllowsAICrawlers: boolean;
    };
}

export interface ExistenceGap {
    type: 'query_absence' | 'citation_gap' | 'authority_gap' | 'entity_clarity';
    description: string;
    severity: number;
    relatedQuery?: string;
    relatedQueryRationale?: string;
    competitorsDomainsThere?: string[];
    actionSuggestion: string;
}

export interface VisibilityDimension {
    name: string;
    score: number;           // 0–100
    evidenceCount: number;
    evidenceSummary: string;
}

export interface ActionItem {
    priority: 'critical' | 'high' | 'medium';
    category: 'content' | 'authority' | 'entity' | 'citation';
    instruction: string;
    evidence: string;        // what specific evidence this is based on
    targetQueries: string[]; // queries where this fix would help
    targetSources: string[]; // sources that need to cover this
}

export interface ExistenceReport {
    url: string;
    brandName: string;
    scanId: string;
    primaryEntity: PrimaryEntity;

    // Step 2 — query set used
    queriesGenerated: TypedQuery[];

    // Step 3 — raw probe results (one per query)
    probeResults: ProbeResult[];

    // Step 7 — visibility scoring
    dimensions: VisibilityDimension[];
    overallScore: number;       // 0–100, evidence-grounded

    // Step 6 — gaps
    gaps: ExistenceGap[];

    // Step 8 — action layer
    actions: ActionItem[];

    // Meta
    queriesTested: number;
    queryTypeCounts: Record<string, number>;
    totalMentions: number;
    totalCitations: number;
    topCompetitorDomains: string[];
    scanned_at: string;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run the full existence mapping pipeline for a URL.
 * Emits evidence into the forensic pipeline as it runs.
 */
export async function mapExistence(
    url: string,
    apiKey: string,
    options: {
        brandName?: string;
        niche?: string;
        queryCount?: number;
        auditId?: string;
        onProgress?: (step: number, label: string) => void;
    } = {},
): Promise<ExistenceReport> {
    const { brandName: inputBrand, niche, queryCount = 20, auditId, onProgress } = options;
    const emit = onProgress ?? (() => { });
    const scanned_at = new Date().toISOString();

    // ── Step 1: Identity Extraction ────────────────────────────────────────────
    emit(1, 'Extracting entity identity');

    let scrapeResult: Awaited<ReturnType<typeof scrapeWebsite>>;
    try {
        scrapeResult = await scrapeWebsite(url);
    } catch (err: any) {
        throw new Error(`Identity extraction failed (scrape error): ${err?.message}`);
    }

    const primaryEntity = extractIdentity(scrapeResult, url, inputBrand);
    const domain = primaryEntity.domain;
    const brandName = primaryEntity.name;

    // Start forensic scan run
    const scanId = await startScanRun(auditId ?? null, url, domain, brandName);

    // Emit entity extracted event for each alias
    for (const alias of [brandName, ...primaryEntity.aliases].slice(0, 5)) {
        await forensicPipeline.emit('ENTITY_EXTRACTED', scanId, {
            name: alias,
            entityType: 'brand',
            confidence: 1.0,
            source: 'scraper',
        });
    }

    // ── Step 2: Query Generation ───────────────────────────────────────────────
    emit(2, 'Generating existence test queries');

    const typedQueries = await generateTypedQueries(
        brandName,
        url,
        primaryEntity,
        niche,
        queryCount,
        apiKey,
    );

    // Emit each query into the forensic pipeline
    for (const tq of typedQueries) {
        const queryId = await emitQueryGenerated(scanId, tq);
        (tq as any)._queryId = queryId; // carry through for ledger linking
    }

    // ── Step 3 & 4: Parallel Answer Testing + Citation Capture ────────────────
    emit(3, 'Testing presence across answer systems');

    const probeResults: ProbeResult[] = [];
    const queryIdMap = new Map<string, string>(); // query text → queryId

    // Build the query→id map
    for (const tq of typedQueries) {
        const id = (tq as any)._queryId;
        if (id) queryIdMap.set(tq.query, id);
    }

    // Run probes in bounded parallel batches
    for (let i = 0; i < typedQueries.length; i += MAX_PARALLEL_PROBES) {
        const batch = typedQueries.slice(i, i + MAX_PARALLEL_PROBES);
        const batchResults = await Promise.allSettled(
            batch.map(tq => probeQuery(tq, brandName, url, primaryEntity.name, apiKey)),
        );

        for (let b = 0; b < batchResults.length; b++) {
            const res = batchResults[b];
            if (res.status !== 'fulfilled') continue;
            const probe = res.value;
            probeResults.push(probe);

            const queryId = queryIdMap.get(probe.query);

            // Step 4: Capture citations into ledger
            await captureCitationToLedger(scanId, queryId ?? null, probe);

            // Also link entity mentions for each mention
            if (probe.mentioned) {
                const citationIdRes = await getPool().query(
                    `SELECT id FROM citation_ledger
           WHERE scan_id = $1 AND context = $2
           ORDER BY created_at DESC LIMIT 1`,
                    [scanId, probe.bestExcerpt?.slice(0, 500) ?? ''],
                ).catch(() => ({ rows: [] }));

                const citationId = citationIdRes.rows[0]?.id;
                if (citationId) {
                    for (const alias of [brandName, ...primaryEntity.aliases].slice(0, 3)) {
                        await forensicPipeline.emit('ENTITY_MENTION_LINKED', scanId, {
                            entityId: `entity:${domain}`,
                            citationId,
                            relevance: probe.overallConfidence,
                        }).catch(() => { });
                    }
                }
            }
        }

        // Pacing between batches
        if (i + MAX_PARALLEL_PROBES < typedQueries.length) {
            await sleep(PROBE_DELAY_MS);
        }
    }

    // ── Steps 5 & 6: Authority Mapping + Gap Detection ────────────────────────
    emit(5, 'Mapping authority signals and detecting gaps');

    // Trigger registry computation + gap detection
    await forensicPipeline.emit('SCAN_COMPLETED', scanId, {});

    // Fetch computed gaps from DB
    const dbGaps = await fetchGaps(scanId);

    // ── Step 6 continued: Augment gaps with probe-level context ───────────────
    const augmentedGaps = augmentGaps(dbGaps, probeResults, typedQueries);

    // ── Step 7: Visibility Scoring ─────────────────────────────────────────────
    emit(7, 'Computing evidence-grounded visibility score');

    const dimensions = computeDimensions(probeResults, primaryEntity);
    const overallScore = computeOverallScore(dimensions);

    // ── Step 8: Action Layer ───────────────────────────────────────────────────
    emit(8, 'Building evidence-linked action layer');

    const actions = generateActionLayer(augmentedGaps, probeResults, primaryEntity);

    // ── Summary stats ──────────────────────────────────────────────────────────
    const queryTypeCounts: Record<string, number> = {};
    for (const q of typedQueries) {
        queryTypeCounts[q.type] = (queryTypeCounts[q.type] ?? 0) + 1;
    }

    const competitorFreq = new Map<string, number>();
    for (const p of probeResults) {
        for (const c of p.competitorsDomains) {
            competitorFreq.set(c, (competitorFreq.get(c) ?? 0) + 1);
        }
    }
    const topCompetitorDomains = [...competitorFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([d]) => d);

    return {
        url,
        brandName,
        scanId,
        primaryEntity,
        queriesGenerated: typedQueries,
        probeResults,
        dimensions,
        overallScore,
        gaps: augmentedGaps,
        actions,
        queriesTested: probeResults.length,
        queryTypeCounts,
        totalMentions: probeResults.filter(p => p.mentioned).length,
        totalCitations: probeResults.filter(p => p.cited).length,
        topCompetitorDomains,
        scanned_at,
    };
}

// ── Step 1: Identity Extraction ───────────────────────────────────────────────

function extractIdentity(
    scrapeResult: Awaited<ReturnType<typeof scrapeWebsite>>,
    url: string,
    inputBrand?: string,
): PrimaryEntity {
    const d = scrapeResult.data;
    const domain = extractDomain(url);

    // Extract name from structured data first, then title, then domain
    const ldJsonItems: any[] = d.structuredData?.raw ?? [];
    let name = inputBrand ?? '';
    let description = '';
    const aliases: string[] = [];
    const schemaTypes: string[] = d.structuredData?.uniqueTypes ?? [];
    const sameAsLinks: string[] = [];

    for (const item of ldJsonItems) {
        if (!item || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        if (!name && typeof r.name === 'string') name = r.name;
        if (!description && typeof r.description === 'string') description = r.description;
        if (typeof r.alternateName === 'string') aliases.push(r.alternateName);
        if (Array.isArray(r.alternateName)) aliases.push(...(r.alternateName as string[]));
        if (Array.isArray(r.sameAs)) sameAsLinks.push(...(r.sameAs as string[]));
        if (typeof r.sameAs === 'string') sameAsLinks.push(r.sameAs);
    }

    // Fallback: extract from page title
    if (!name) {
        const title = d.title ?? '';
        name = title.split(/[|\-–—]/)[0].trim() || domain;
    }

    if (!description) {
        description = d.meta?.description ?? d.body?.slice(0, 200) ?? '';
    }

    // Authority signals
    const hasOrgSchema = schemaTypes.some(t =>
        t.toLowerCase().includes('organization') || t.toLowerCase().includes('localbusiness'),
    );
    const hasSameAs = sameAsLinks.length > 0;
    const hasAuthor = ldJsonItems.some(item => {
        if (!item || typeof item !== 'object') return false;
        return !!(item as any).author;
    });

    const robotsData = d.robots;
    const robotsAllowsAICrawlers = robotsData
        ? !!(
            robotsData.allows?.['gptbot'] !== false &&
            robotsData.allows?.['claudebot'] !== false
        )
        : true;

    const headings = [
        ...(d.headings?.h1 ?? []),
        ...(d.headings?.h2 ?? []).slice(0, 6),
    ].slice(0, 10);

    return {
        name,
        domain,
        aliases: [...new Set(aliases)].slice(0, 5),
        description,
        schemaTypes,
        sameAsLinks,
        headings,
        authoritySignals: {
            hasOrgSchema,
            hasSameAs,
            hasAuthor,
            hasLLMsTxt: !!(d as any).llmsTxt,
            robotsAllowsAICrawlers,
        },
    };
}

// ── Step 2: Typed Query Generation ───────────────────────────────────────────

async function generateTypedQueries(
    brandName: string,
    url: string,
    entity: PrimaryEntity,
    niche: string | undefined,
    count: number,
    apiKey: string,
): Promise<TypedQuery[]> {
    const promptConfig = renderPrompt('existence.typed_query_pack', {
        brandName,
        url,
        primaryEntity: entity.name,
        aliases: entity.aliases,
        topics: entity.headings,
        niche,
        description: entity.description,
    });

    try {
        const response = await callAIProvider({
            provider: 'openrouter',
            model: QUERY_GEN_MODEL,
            prompt: promptConfig.prompt,
            apiKey,
            endpoint: OPENROUTER_ENDPOINT,
            opts: { max_tokens: 1600 },
        });

        if (!response) throw new Error('Empty response');

        const cleaned = response.trim()
            .replace(/^```(?:json)?\s*\n?/i, '')
            .replace(/\n?```\s*$/i, '');
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed.queries)) throw new Error('No queries array in response');

        const queries: TypedQuery[] = parsed.queries
            .filter((q: any) => q && typeof q.query === 'string' && q.query.trim())
            .map((q: any) => ({
                query: q.query.trim(),
                type: validateQueryType(q.type),
                rationale: typeof q.rationale === 'string' ? q.rationale.trim() : 'Brand should appear in this answer space',
            }))
            .slice(0, Math.max(count, 20));

        if (queries.length < 4) throw new Error('Too few queries generated');
        return queries;
    } catch (err: any) {
        console.warn(`[existenceMapper] Query generation fell back: ${err?.message}`);
        return fallbackTypedQueries(brandName, entity);
    }
}

function validateQueryType(raw: unknown): TypedQuery['type'] {
    const valid = ['direct', 'intent', 'comparative', 'long_tail'];
    if (typeof raw === 'string' && valid.includes(raw)) return raw as TypedQuery['type'];
    return 'intent';
}

function fallbackTypedQueries(brandName: string, entity: PrimaryEntity): TypedQuery[] {
    const topic = entity.headings[0] ?? 'this category';
    return [
        { query: `what is ${brandName}`, type: 'direct', rationale: 'Direct brand recognition test' },
        { query: `${brandName} review`, type: 'direct', rationale: 'Trust and legitimacy signal' },
        { query: `is ${brandName} legit`, type: 'direct', rationale: 'Credibility probe' },
        { query: `best tools for ${topic}`, type: 'intent', rationale: `Brand competes in ${topic} space` },
        { query: `how to use ${topic} effectively`, type: 'intent', rationale: 'Problem-solution intent' },
        { query: `${brandName} vs alternatives`, type: 'comparative', rationale: 'Competitive positioning probe' },
        { query: `alternatives to ${brandName}`, type: 'comparative', rationale: 'Comparative market test' },
        { query: `what tools help with ${topic} for teams`, type: 'long_tail', rationale: 'Long-tail AI-style query test' },
    ];
}

// ── Step 4: Citation Capture ──────────────────────────────────────────────────

async function emitQueryGenerated(scanId: string, tq: TypedQuery): Promise<string> {
    // Insert into scan_queries directly to get the ID back
    const pool = getPool();
    try {
        const res = await pool.query(
            `INSERT INTO scan_queries (scan_id, query, query_type, priority)
       VALUES ($1, $2, $3, $4) RETURNING id`,
            [scanId, tq.query, tq.type, typeToDefaultPriority(tq.type)],
        );
        const id = res.rows[0]?.id;
        return id;
    } catch {
        return '';
    }
}

function typeToDefaultPriority(type: TypedQuery['type']): number {
    const map: Record<TypedQuery['type'], number> = {
        direct: 10,
        intent: 7,
        comparative: 5,
        long_tail: 3,
    };
    return map[type] ?? 5;
}

async function captureCitationToLedger(
    scanId: string,
    queryId: string | null,
    probe: ProbeResult,
): Promise<void> {
    // One ledger entry per probe (summarizes all signals for this query)
    await forensicPipeline.emit('CITATION_FOUND', scanId, {
        queryId: queryId ?? undefined,
        sourceUrl: probe.url,
        sourceDomain: probe.url ? extractDomain(probe.url) : undefined,
        position: probe.dominantPosition ?? undefined,
        mentioned: probe.mentioned,
        cited: probe.cited,
        context: probe.bestExcerpt ?? undefined,
        sentiment: undefined,
        confidence: probe.overallConfidence,
        model: probe.aiResults[0]?.model ?? 'web',
    });
}

// ── Step 6: Gap augmentation ──────────────────────────────────────────────────

interface RawGap {
    gap_type: string;
    description: string;
    severity: number;
    related_query_id: string | null;
}

async function fetchGaps(scanId: string): Promise<RawGap[]> {
    try {
        const res = await getPool().query(
            `SELECT gap_type, description, severity, related_query_id
       FROM scan_gaps WHERE scan_id = $1 ORDER BY severity DESC`,
            [scanId],
        );
        return res.rows;
    } catch {
        return [];
    }
}

function augmentGaps(
    dbGaps: RawGap[],
    probeResults: ProbeResult[],
    typedQueries: TypedQuery[],
): ExistenceGap[] {
    const queryById = new Map<string, TypedQuery>();
    for (const tq of typedQueries) {
        if ((tq as any)._queryId) queryById.set((tq as any)._queryId, tq);
    }

    const gaps: ExistenceGap[] = dbGaps.map(g => {
        const relatedTq = g.related_query_id ? queryById.get(g.related_query_id) : undefined;
        const relatedProbe = relatedTq
            ? probeResults.find(p => p.query === relatedTq.query)
            : undefined;

        const gapType = normalizeGapType(g.gap_type);
        return {
            type: gapType,
            description: g.description,
            severity: g.severity,
            relatedQuery: relatedTq?.query,
            relatedQueryRationale: relatedTq?.rationale,
            competitorsDomainsThere: relatedProbe?.competitorsDomains?.slice(0, 5),
            actionSuggestion: gapTypeToAction(gapType, relatedTq, relatedProbe),
        };
    });

    // Also synthesize entity clarity gaps from authority signals (not in DB)
    const noMentionProbes = probeResults.filter(p => !p.mentioned);
    if (noMentionProbes.length > probeResults.length * 0.6) {
        gaps.push({
            type: 'entity_clarity',
            description: `Brand absent from ${noMentionProbes.length}/${probeResults.length} tested queries — AI systems may not have a clear entity definition for this brand`,
            severity: 0.85,
            actionSuggestion: 'Add Organization schema with name, url, description, and sameAs links. Ensure the brand name appears in H1, meta title, and at least one JSON-LD block on every indexable page.',
        });
    }

    return gaps.sort((a, b) => b.severity - a.severity);
}

function normalizeGapType(raw: string): ExistenceGap['type'] {
    if (raw === 'query_absence') return 'query_absence';
    if (raw === 'citation_gap') return 'citation_gap';
    if (raw === 'authority_gap') return 'authority_gap';
    return 'entity_clarity';
}

function gapTypeToAction(
    type: ExistenceGap['type'],
    query?: TypedQuery,
    probe?: ProbeResult,
): string {
    const competitors = probe?.competitorsDomains?.slice(0, 3).join(', ');
    switch (type) {
        case 'query_absence':
            return query
                ? `Create content that directly answers "${query.query}". ${competitors ? `Competitors present: ${competitors}.` : ''} Match the query intent with a dedicated page or FAQ block indexed for AI crawlers.`
                : 'Create content targeting absent query intents. Ensure AI crawlers can access and parse it.';
        case 'citation_gap':
            return `Brand is mentioned but not cited as a source. Add authoritative structured data (Article or Organization schema) and ensure key claims include verifiable citations.`;
        case 'authority_gap':
            return `Build presence on high-authority domains. ${competitors ? `Target: ${competitors}.` : ''} Guest content, product listings, and entity mentions on trusted sources improve citation weight.`;
        case 'entity_clarity':
            return `AI cannot consistently disambiguate this entity. Add Organization schema sameAs links, ensure brand name consistency across all indexed pages, and consider an About or FAQ page that defines the entity explicitly.`;
    }
}

// ── Step 7: Visibility Scoring ────────────────────────────────────────────────

function computeDimensions(
    probeResults: ProbeResult[],
    entity: PrimaryEntity,
): VisibilityDimension[] {
    const total = probeResults.length || 1;

    // Entity Clarity — schema + sameAs + consistency signals
    const entityClarityScore = Math.round(
        (entity.authoritySignals.hasOrgSchema ? 30 : 0) +
        (entity.authoritySignals.hasSameAs ? 20 : 0) +
        (entity.authoritySignals.hasAuthor ? 10 : 0) +
        (entity.authoritySignals.hasLLMsTxt ? 15 : 0) +
        (entity.authoritySignals.robotsAllowsAICrawlers ? 25 : 0),
    );

    // Citation Coverage — fraction of queries where brand was mentioned
    const mentionRate = probeResults.filter(p => p.mentioned).length / total;
    const citationCoverageScore = Math.round(mentionRate * 100);

    // Authority Alignment — avg confidence on cited results
    const citedResults = probeResults.filter(p => p.cited);
    const authorityAlignmentScore = citedResults.length > 0
        ? Math.round(
            (citedResults.reduce((sum, p) => sum + p.overallConfidence, 0) / citedResults.length) * 100,
        )
        : 0;

    // Answer Presence — fraction cited (stronger signal than mentioned)
    const citationRate = citedResults.length / total;
    const answerPresenceScore = Math.round(citationRate * 100);

    // Crawl Integrity — robots access + llms.txt + aiCrawlerAccess
    const crawlScore = Math.round(
        (entity.authoritySignals.robotsAllowsAICrawlers ? 60 : 20) +
        (entity.authoritySignals.hasLLMsTxt ? 30 : 0) +
        (entity.authoritySignals.hasOrgSchema ? 10 : 0),
    );

    return [
        {
            name: 'Entity Clarity',
            score: Math.min(100, entityClarityScore),
            evidenceCount: entity.sameAsLinks.length + entity.schemaTypes.length,
            evidenceSummary: `${entity.schemaTypes.length} schema types, ${entity.sameAsLinks.length} sameAs links, ${entity.aliases.length} known aliases`,
        },
        {
            name: 'Citation Coverage',
            score: Math.min(100, citationCoverageScore),
            evidenceCount: probeResults.filter(p => p.mentioned).length,
            evidenceSummary: `${probeResults.filter(p => p.mentioned).length}/${total} tested queries returned a brand mention`,
        },
        {
            name: 'Authority Alignment',
            score: Math.min(100, authorityAlignmentScore),
            evidenceCount: citedResults.length,
            evidenceSummary: citedResults.length > 0
                ? `Cited in ${citedResults.length} queries at avg confidence ${(citedResults.reduce((s, p) => s + p.overallConfidence, 0) / citedResults.length).toFixed(2)}`
                : 'Not cited as an authoritative source in any tested query',
        },
        {
            name: 'Answer Presence',
            score: Math.min(100, answerPresenceScore),
            evidenceCount: citedResults.length,
            evidenceSummary: `${citedResults.length}/${total} tested queries resulted in a direct citation`,
        },
        {
            name: 'Crawl Integrity',
            score: Math.min(100, crawlScore),
            evidenceCount: entity.authoritySignals.robotsAllowsAICrawlers ? 1 : 0,
            evidenceSummary: [
                entity.authoritySignals.robotsAllowsAICrawlers ? 'AI crawlers allowed' : 'AI crawlers may be blocked',
                entity.authoritySignals.hasLLMsTxt ? 'llms.txt present' : 'no llms.txt',
            ].join(', '),
        },
    ];
}

function computeOverallScore(dimensions: VisibilityDimension[]): number {
    // Weighted: Answer Presence + Citation Coverage carry most weight
    const weights: Record<string, number> = {
        'Answer Presence': 0.30,
        'Citation Coverage': 0.25,
        'Authority Alignment': 0.20,
        'Entity Clarity': 0.15,
        'Crawl Integrity': 0.10,
    };
    const total = dimensions.reduce((sum, d) => {
        const w = weights[d.name] ?? 0.1;
        return sum + d.score * w;
    }, 0);
    return Math.round(Math.min(100, Math.max(0, total)));
}

// ── Step 8: Action Layer ──────────────────────────────────────────────────────

function generateActionLayer(
    gaps: ExistenceGap[],
    probeResults: ProbeResult[],
    entity: PrimaryEntity,
): ActionItem[] {
    const actions: ActionItem[] = [];

    // Action for each gap
    for (const gap of gaps.slice(0, 8)) {
        const targetQueries = gap.relatedQuery ? [gap.relatedQuery] : [];
        const targetSources = gap.competitorsDomainsThere ?? [];
        const priority: ActionItem['priority'] =
            gap.severity >= 0.85 ? 'critical' : gap.severity >= 0.6 ? 'high' : 'medium';

        actions.push({
            priority,
            category: gapTypeToCategory(gap.type),
            instruction: gap.actionSuggestion,
            evidence: gap.description,
            targetQueries,
            targetSources,
        });
    }

    // Entity-level actions from authority signal gaps
    if (!entity.authoritySignals.hasOrgSchema) {
        actions.push({
            priority: 'critical',
            category: 'entity',
            instruction: `Add Organization JSON-LD schema to every page with name: "${entity.name}", url: "${entity.domain}", description, and sameAs links`,
            evidence: 'Organization schema absent from all crawled pages',
            targetQueries: probeResults.filter(p => !p.mentioned).map(p => p.query).slice(0, 3),
            targetSources: [],
        });
    }

    if (!entity.authoritySignals.hasSameAs) {
        actions.push({
            priority: 'high',
            category: 'entity',
            instruction: `Add sameAs links to Organization schema: LinkedIn, GitHub, Twitter/X, Crunchbase, and any directory listings where "${entity.name}" is present`,
            evidence: 'Zero sameAs cross-platform links found in any structured data block',
            targetQueries: [],
            targetSources: [],
        });
    }

    if (!entity.authoritySignals.hasLLMsTxt) {
        actions.push({
            priority: 'medium',
            category: 'entity',
            instruction: 'Add an /llms.txt file at the root of the domain with a summary of the brand, its products, and key claims for AI model ingestion',
            evidence: 'No llms.txt found — AI systems have no explicit brand context document',
            targetQueries: [],
            targetSources: [],
        });
    }

    // Queries where brand is absent but competitors appear — specific actions
    const absentWithCompetitors = probeResults
        .filter(p => !p.mentioned && p.competitorsDomains.length > 0)
        .sort((a, b) => b.competitorsDomains.length - a.competitorsDomains.length)
        .slice(0, 3);

    for (const p of absentWithCompetitors) {
        actions.push({
            priority: 'high',
            category: 'content',
            instruction: `Create content that directly answers: "${p.query}". This query currently surfaces ${p.competitorsDomains.slice(0, 3).join(', ')} — not your brand.`,
            evidence: `Brand absent in ${probeResults.filter(r => !r.mentioned).length} direct answer tests. Competitors dominate this query.`,
            targetQueries: [p.query],
            targetSources: p.competitorsDomains.slice(0, 3),
        });
    }

    // Sort: critical first, then by category priority
    return actions
        .sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2 };
            return order[a.priority] - order[b.priority];
        })
        .slice(0, 12);
}

function gapTypeToCategory(type: ExistenceGap['type']): ActionItem['category'] {
    switch (type) {
        case 'query_absence': return 'content';
        case 'citation_gap': return 'citation';
        case 'authority_gap': return 'authority';
        case 'entity_clarity': return 'entity';
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
    try {
        return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    } catch {
        return url.split('/')[0].replace(/^www\./, '');
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
