/**
 * Search Router — Layer 1 of the AiVIS RAG Pipeline
 *
 * Single-provider deterministic routing using Geekflare only.
 *
 * Flow:
 *   1. Geekflare Search (2 credits/request)
 *   2. Canonical URL dedupe
 *   3. Lighthouse quality gate (pre-scrape firewall)
 *   4. Ranked output for context extraction
 */

import type { ShapedIntent } from './intentShaper.js';
import {
    assessLighthouseQuality,
    isGeekflareAvailable,
    searchGeekflare,
} from './geekflareService.js';
import { isSafeExternalUrl } from '../middleware/securityMiddleware.js';

export type SearchProvider = 'geekflare_search' | 'geekflare_lighthouse';
export type IngestionDecision = 'accept' | 'partial' | 'reject';

const LIGHTHOUSE_GATE_LIMIT = 8;

export interface NormalisedResult {
    url: string;
    title: string;
    snippet: string;
    provider: SearchProvider;
    rank: number;
    published_ms?: number;
}

export interface RankedResult extends NormalisedResult {
    consensus_score: number;
    provider_count: number;
    providers_seen: SearchProvider[];
    source_quality_score: number;
    structure_stability: number;
    scrape_reliability: number;
    seo_integrity: number;
    lighthouse_eligible: boolean;
    pre_trust_score: number;
    pre_decision: IngestionDecision;
    pre_reason_flags: string[];
}

export interface SearchRouterResult {
    query: string;
    pool: RankedResult[];
    provider_stats: Record<SearchProvider, number>;
    consensus_top: RankedResult[];
    discarded: Array<{ url: string; decision: IngestionDecision; reason_flags: string[]; pre_trust_score: number }>;
    execution_ms: number;
}

export interface SearchRouterOptions {
    topN?: number;
    disableProviders?: SearchProvider[];
}

function canonicalUrl(raw: string): string | null {
    try {
        const u = new URL(raw);
        const TRACKING = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
            'ref', 'referrer', 'source', 'gclid', 'fbclid', 'msclkid',
        ];
        TRACKING.forEach((p) => u.searchParams.delete(p));
        const path = u.pathname.replace(/\/+$/, '') || '/';
        return `${u.hostname.replace(/^www\./, '')}${path}`;
    } catch {
        return null;
    }
}

function recencyScore(published_ms?: number): number {
    if (!published_ms) return 0.5;
    const ageDays = (Date.now() - published_ms) / 86_400_000;
    if (ageDays < 7) return 1.0;
    if (ageDays < 30) return 0.85;
    if (ageDays < 90) return 0.70;
    if (ageDays < 365) return 0.50;
    return 0.30;
}

async function toRankedResults(items: NormalisedResult[]): Promise<RankedResult[]> {
    const dedup = new Map<string, NormalisedResult>();

    for (const item of items) {
        if (!isSafeExternalUrl(item.url)) continue;
        const canon = canonicalUrl(item.url);
        if (!canon) continue;
        const existing = dedup.get(canon);
        if (!existing || item.rank < existing.rank) dedup.set(canon, item);
    }

    const rows = [...dedup.values()];

    const gateChecks = await Promise.all(
        rows.slice(0, LIGHTHOUSE_GATE_LIMIT).map((row) => assessLighthouseQuality(row.url)),
    );

    const ranked: RankedResult[] = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const gate = gateChecks[i] ?? {
            source_quality_score: 0.45,
            structure_stability: 0.45,
            scrape_reliability: 0.45,
            seo_integrity: 0.45,
            eligible: true,
        };

        const rankDecay = 1 / Math.sqrt(row.rank);
        const freshness = recencyScore(row.published_ms);
        const risk = Math.max(0, Math.min(1, 1 - gate.scrape_reliability));
        const preTrust = Math.max(0, Math.min(1,
            rankDecay * 0.40 +
            gate.source_quality_score * 0.30 +
            gate.structure_stability * 0.20 +
            freshness * 0.10 -
            risk * 0.10,
        ));

        const preDecision: IngestionDecision =
            preTrust >= 0.75 ? 'accept' : preTrust >= 0.45 ? 'partial' : 'reject';

        const preReasonFlags: string[] = [];
        if (!gate.eligible) preReasonFlags.push('lighthouse_gate_blocked');
        if (gate.source_quality_score < 0.45) preReasonFlags.push('low_source_quality');
        if (gate.scrape_reliability < 0.45) preReasonFlags.push('high_js_dependency');
        if (gate.seo_integrity < 0.45) preReasonFlags.push('low_seo_integrity');
        if (preTrust < 0.45) preReasonFlags.push('low_pretrust');

        const score = Math.min(
            1,
            rankDecay * 0.45 +
            gate.source_quality_score * 0.35 +
            freshness * 0.20,
        );

        ranked.push({
            ...row,
            consensus_score: score,
            provider_count: 1,
            providers_seen: ['geekflare_search'],
            source_quality_score: gate.source_quality_score,
            structure_stability: gate.structure_stability,
            scrape_reliability: gate.scrape_reliability,
            seo_integrity: gate.seo_integrity,
            lighthouse_eligible: gate.eligible,
            pre_trust_score: preTrust,
            pre_decision: preDecision,
            pre_reason_flags: [...new Set(preReasonFlags)].slice(0, 6),
        });
    }

    return ranked.sort((a, b) => b.consensus_score - a.consensus_score);
}

function emptyResult(query: string, t0: number): SearchRouterResult {
    return {
        query,
        pool: [],
        provider_stats: { geekflare_search: 0, geekflare_lighthouse: 0 },
        consensus_top: [],
        discarded: [],
        execution_ms: Date.now() - t0,
    };
}

export async function routeSearch(
    query: string,
    _intent?: Partial<ShapedIntent>,
    opts: SearchRouterOptions = {},
): Promise<SearchRouterResult> {
    const t0 = Date.now();
    const safeQ = query.trim().replace(/[<>'"`;]/g, '').slice(0, 500);
    if (!safeQ) return emptyResult(query, t0);
    if (!isGeekflareAvailable()) return emptyResult(safeQ, t0);

    const topN = opts.topN ?? 20;
    const disable = new Set(opts.disableProviders ?? []);

    if (disable.has('geekflare_search')) {
        return emptyResult(safeQ, t0);
    }

    const searched = await searchGeekflare(safeQ, 30);
    const normalized: NormalisedResult[] = searched.map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.description,
        provider: 'geekflare_search',
        rank: r.rank,
        published_ms: r.published_ms,
    }));

    const pool = await toRankedResults(normalized);

    const consensusTop = pool
        .filter((r) => r.pre_decision !== 'reject')
        .slice(0, topN);
    const discarded = pool
        .filter((r) => r.pre_decision === 'reject')
        .map((r) => ({
            url: r.url,
            decision: r.pre_decision,
            reason_flags: r.pre_reason_flags,
            pre_trust_score: r.pre_trust_score,
        }));

    return {
        query: safeQ,
        pool,
        provider_stats: {
            geekflare_search: normalized.length,
            geekflare_lighthouse: Math.min(normalized.length, LIGHTHOUSE_GATE_LIMIT),
        },
        consensus_top: consensusTop,
        discarded,
        execution_ms: Date.now() - t0,
    };
}

export async function routeSearchFanout(
    intent: ShapedIntent,
    opts: SearchRouterOptions = {},
): Promise<SearchRouterResult> {
    const t0 = Date.now();
    const queries = intent.expanded_queries.slice(0, intent.depth);

    const batch = await Promise.all(queries.map((q) => routeSearch(q, intent, { ...opts, topN: 15 })));
    const merged = batch.flatMap((r) => r.pool);

    const canonBest = new Map<string, RankedResult>();
    for (const row of merged) {
        const canon = canonicalUrl(row.url);
        if (!canon) continue;
        const existing = canonBest.get(canon);
        if (!existing || row.consensus_score > existing.consensus_score) {
            canonBest.set(canon, row);
        }
    }

    const pool = [...canonBest.values()].sort((a, b) => b.consensus_score - a.consensus_score);
    const discarded = pool
        .filter((r) => r.pre_decision === 'reject')
        .map((r) => ({
            url: r.url,
            decision: r.pre_decision,
            reason_flags: r.pre_reason_flags,
            pre_trust_score: r.pre_trust_score,
        }));

    return {
        query: intent.raw_query,
        pool,
        provider_stats: {
            geekflare_search: batch.reduce((sum, r) => sum + (r.provider_stats.geekflare_search || 0), 0),
            geekflare_lighthouse: batch.reduce((sum, r) => sum + (r.provider_stats.geekflare_lighthouse || 0), 0),
        },
        consensus_top: pool.filter((r) => r.pre_decision !== 'reject').slice(0, opts.topN ?? 20),
        discarded,
        execution_ms: Date.now() - t0,
    };
}
