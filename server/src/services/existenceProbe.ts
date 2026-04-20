/**
 * existenceProbe.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core Step 3 engine. Takes a single query + entity context and tests whether
 * the brand appears when it should — across web search and AI answer systems.
 *
 * Mental model: we are NOT searching for the brand.
 * We are asking: "Does this entity appear in the answer to a query where it
 * should legitimately be present?" and collecting evidence.
 *
 * Each probe run returns a ProbeResult — a single atomic evidence record that
 * can be fed directly into the citation_ledger via forensicPipeline.
 */

import { callAIProvider } from './aiProviders.js';
import { checkWebSearchPresence, checkBingSearchPresence } from './webSearch.js';
import { renderPrompt } from './promptRegistry.js';
import type { WebSearchPresenceResult } from '../../../shared/types.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PROBE_AI_MODEL = 'google/gemma-3-27b-it:free';
const PROBE_ANALYSIS_MODEL = 'openai/gpt-5-nano';
const PROBE_MAX_TOKENS = 600;
const PROBE_TEMPERATURE = 0.2;

// ── Types ─────────────────────────────────────────────────────────────────────

export type QueryType = 'direct' | 'intent' | 'comparative' | 'long_tail';

export interface TypedQuery {
    query: string;
    type: QueryType;
    rationale: string;
}

export interface ProbeWebResult {
    engine: 'ddg' | 'bing';
    mentioned: boolean;
    position: number | null;
    url: string | null;
    title: string | null;
    snippet: string | null;
    competitorsDomains: string[];
}

export interface ProbeAIResult {
    model: string;
    mentioned: boolean;
    cited: boolean;
    position: number | null;
    excerpt: string | null;
    competitorsInstead: string[];
    confidence: number;
    absenceReason: string | null;
    rawResponse: string;
}

export interface ProbeResult {
    query: string;
    queryType: QueryType;
    queryRationale: string;
    brandName: string;
    url: string;

    // Synthesized verdict (union of web + AI signals)
    mentioned: boolean;
    cited: boolean;
    overallConfidence: number;
    dominantPosition: number | null;
    bestExcerpt: string | null;
    absenceReason: string | null;
    competitorsDomains: string[];

    // Raw per-engine results
    webResults: ProbeWebResult[];
    aiResults: ProbeAIResult[];

    probed_at: string;
}

// ── Probe runner ──────────────────────────────────────────────────────────────

export async function probeQuery(
    typedQuery: TypedQuery,
    brandName: string,
    targetUrl: string,
    primaryEntity: string,
    apiKey: string,
): Promise<ProbeResult> {
    const { query, type, rationale } = typedQuery;
    const probed_at = new Date().toISOString();

    // Run web search and AI probe in parallel
    const [webResults, aiResult] = await Promise.all([
        runWebProbes(query, brandName, targetUrl),
        runAIProbe(query, type, rationale, brandName, targetUrl, primaryEntity, apiKey),
    ]);

    // Synthesize verdict from all signals
    const allMentioned = webResults.some(w => w.mentioned) || aiResult.mentioned;
    const allCited = webResults.some(w => w.mentioned && w.position !== null && w.position <= 3)
        || aiResult.cited;

    // Gather competitors across all results
    const competitorSet = new Set<string>();
    for (const w of webResults) w.competitorsDomains.forEach(c => competitorSet.add(c));
    aiResult.competitorsInstead.forEach(c => competitorSet.add(c));
    // Remove the brand's own domain from competitors
    const brandDomain = extractDomain(targetUrl);
    competitorSet.delete(brandDomain);

    // Best position: lowest (earliest) among results that mention the brand
    const positions: number[] = [];
    for (const w of webResults) { if (w.mentioned && w.position != null) positions.push(w.position); }
    if (aiResult.mentioned && aiResult.position != null) positions.push(aiResult.position);
    const dominantPosition = positions.length > 0 ? Math.min(...positions) : null;

    // Best excerpt
    const bestExcerpt = aiResult.excerpt
        || webResults.find(w => w.snippet && w.mentioned)?.snippet
        || null;

    // Confidence: average AI confidence, weighted up if web also found it
    const webBoost = webResults.some(w => w.mentioned) ? 0.1 : 0;
    const overallConfidence = Math.min(1.0, aiResult.confidence + webBoost);

    return {
        query,
        queryType: type,
        queryRationale: rationale,
        brandName,
        url: targetUrl,
        mentioned: allMentioned,
        cited: allCited,
        overallConfidence,
        dominantPosition,
        bestExcerpt,
        absenceReason: allMentioned ? null : aiResult.absenceReason,
        competitorsDomains: Array.from(competitorSet).slice(0, 10),
        webResults,
        aiResults: [aiResult],
        probed_at,
    };
}

// ── Web probes ────────────────────────────────────────────────────────────────

async function runWebProbes(
    query: string,
    brandName: string,
    targetUrl: string,
): Promise<ProbeWebResult[]> {
    const [ddg, bing] = await Promise.allSettled([
        checkWebSearchPresence(query, brandName, targetUrl),
        checkBingSearchPresence(query, brandName, targetUrl),
    ]);

    const results: ProbeWebResult[] = [];

    if (ddg.status === 'fulfilled') {
        results.push(webResultFromPresence('ddg', ddg.value, brandName));
    }
    if (bing.status === 'fulfilled') {
        results.push(webResultFromPresence('bing', bing.value, brandName));
    }

    return results;
}

function webResultFromPresence(
    engine: 'ddg' | 'bing',
    presence: WebSearchPresenceResult,
    brandName: string,
): ProbeWebResult {
    const mentioned = presence.brandFound ?? presence.found ?? false;
    const position = presence.position ?? null;
    const topResult = presence.results?.[0];

    // Collect competitor domains from search results
    const brandDomainParts = brandName.toLowerCase().split(/\s+/);
    const competitors = (presence.results || [])
        .filter(r => {
            if (!r.url) return false;
            const domain = extractDomain(r.url).toLowerCase();
            return !brandDomainParts.some(p => domain.includes(p));
        })
        .map(r => extractDomain(r.url || ''))
        .filter(Boolean)
        .slice(0, 5);

    return {
        engine,
        mentioned,
        position,
        url: topResult?.url ?? null,
        title: topResult?.title ?? null,
        snippet: topResult?.snippet ?? null,
        competitorsDomains: competitors,
    };
}

// ── AI probe ──────────────────────────────────────────────────────────────────

async function runAIProbe(
    query: string,
    queryType: QueryType,
    rationale: string,
    brandName: string,
    targetUrl: string,
    primaryEntity: string,
    apiKey: string,
): Promise<ProbeAIResult> {
    // Step 1: Ask an AI to answer the query (simulate answer engine behavior)
    let rawResponse = '';
    try {
        rawResponse = await callAIProvider({
            provider: 'openrouter',
            model: PROBE_AI_MODEL,
            prompt: query,
            apiKey,
            endpoint: OPENROUTER_ENDPOINT,
            opts: {
                max_tokens: 500,
                temperature: PROBE_TEMPERATURE,
                system: `You are a helpful AI assistant. Answer the following question directly and concisely, mentioning specific brands, tools, or services where relevant.`,
            },
        }) ?? '';
    } catch {
        rawResponse = '';
    }

    if (!rawResponse.trim()) {
        return probeAIFallback(brandName, PROBE_AI_MODEL);
    }

    // Step 2: Analyze whether the brand appeared in that response
    const analysisPrompt = renderPrompt('existence.probe_analysis', {
        query,
        queryType,
        queryRationale: rationale,
        brandName,
        url: targetUrl,
        primaryEntity,
        aiResponse: rawResponse.slice(0, 2000),
        model: PROBE_AI_MODEL,
    });

    let analysisRaw = '';
    try {
        analysisRaw = await callAIProvider({
            provider: 'openrouter',
            model: PROBE_ANALYSIS_MODEL,
            prompt: analysisPrompt.prompt,
            apiKey,
            endpoint: OPENROUTER_ENDPOINT,
            opts: { max_tokens: PROBE_MAX_TOKENS, temperature: 0.1 },
        }) ?? '';
    } catch {
        return probeAIFallback(brandName, PROBE_AI_MODEL, rawResponse);
    }

    // Parse the analysis
    try {
        const cleaned = analysisRaw.trim()
            .replace(/^```(?:json)?\s*\n?/i, '')
            .replace(/\n?```\s*$/i, '');
        const parsed = JSON.parse(cleaned);
        return {
            model: PROBE_AI_MODEL,
            mentioned: Boolean(parsed.mentioned),
            cited: Boolean(parsed.cited),
            position: typeof parsed.position === 'number' ? parsed.position : null,
            excerpt: typeof parsed.excerpt === 'string' ? parsed.excerpt : null,
            competitorsInstead: Array.isArray(parsed.competitors_instead)
                ? parsed.competitors_instead.slice(0, 8)
                : [],
            confidence: typeof parsed.confidence === 'number'
                ? Math.max(0, Math.min(1, parsed.confidence))
                : 0.5,
            absenceReason: typeof parsed.absence_reason === 'string' ? parsed.absence_reason : null,
            rawResponse,
        };
    } catch {
        // Heuristic fallback: just check if brand name appears in the response
        const mentionedHeuristic = rawResponse.toLowerCase().includes(brandName.toLowerCase())
            || rawResponse.toLowerCase().includes(extractDomain(targetUrl).toLowerCase());
        return {
            model: PROBE_AI_MODEL,
            mentioned: mentionedHeuristic,
            cited: false,
            position: null,
            excerpt: null,
            competitorsInstead: [],
            confidence: 0.3,
            absenceReason: mentionedHeuristic
                ? null
                : 'Brand not detected in response (heuristic fallback)',
            rawResponse,
        };
    }
}

function probeAIFallback(
    _brandName: string,
    model: string,
    rawResponse = '',
): ProbeAIResult {
    return {
        model,
        mentioned: false,
        cited: false,
        position: null,
        excerpt: null,
        competitorsInstead: [],
        confidence: 0,
        absenceReason: 'AI probe failed — no response from model',
        rawResponse,
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
    try {
        return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    } catch {
        return url.split('/')[0].replace(/^www\./, '');
    }
}
