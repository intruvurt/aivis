import type { RankedResult } from './searchRouter.js';
import type { ExtractedPage } from './contextExtractor.js';
import { getRedis } from '../infra/redis.js';

export type SourceDecision = 'accept' | 'partial' | 'reject';

export interface SourceTrustScore {
    url: string;
    trust_score: number;
    components: {
        serp: number;
        content: number;
        structure: number;
        risk: number;
    };
    decision: SourceDecision;
    reason_flags: string[];
}

const CACHE_TTL_SECONDS = 60 * 60 * 6;

function clamp01(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
}

function decisionForScore(score: number): SourceDecision {
    if (score >= 0.75) return 'accept';
    if (score >= 0.45) return 'partial';
    return 'reject';
}

function buildReasonFlags(payload: {
    serp: number;
    content: number;
    structure: number;
    risk: number;
    row?: RankedResult;
    page?: ExtractedPage;
}): string[] {
    const flags: string[] = [];

    if (payload.serp < 0.45) flags.push('low_serp_consensus');
    if (payload.content < 0.45) flags.push('low_entity_density');
    if (payload.structure < 0.45) flags.push('weak_structure_signal');
    if (payload.risk > 0.55) flags.push('high_behavioral_risk');

    if (payload.row) {
        if (payload.row.seo_integrity < 0.45) flags.push('low_seo_integrity');
        if (payload.row.scrape_reliability < 0.45) flags.push('high_js_dependency');
        if (payload.row.pre_decision === 'reject') flags.push('pre_gate_reject');
    }

    if (payload.page) {
        if (!payload.page.full_fetch) flags.push('partial_fetch');
        if ((payload.page.claims?.length || 0) < 3) flags.push('low_claim_density');
    }

    return [...new Set(flags)].slice(0, 8);
}

function scoreSerp(row: RankedResult): number {
    const positionWeight = clamp01(1 / Math.sqrt(Math.max(1, row.rank)));
    const providerConsensus = clamp01(row.provider_count >= 1 ? 1 : 0);
    const queryRelevance = clamp01((row.snippet?.length || 0) > 40 ? 0.65 : 0.45);
    const domainAuthorityProxy = clamp01(row.source_quality_score);

    return clamp01(
        positionWeight * 0.35 +
        providerConsensus * 0.20 +
        queryRelevance * 0.20 +
        domainAuthorityProxy * 0.25,
    );
}

function scoreStructure(row: RankedResult): number {
    const seoIntegrity = clamp01(row.seo_integrity);
    const accessibilityProxy = clamp01(row.structure_stability);
    const performanceStability = clamp01(row.scrape_reliability);

    const jsDependencyRisk = clamp01(1 - row.scrape_reliability);
    const layoutInstability = clamp01(1 - row.structure_stability);

    return clamp01(
        seoIntegrity * 0.35 +
        accessibilityProxy * 0.25 +
        performanceStability * 0.25 -
        jsDependencyRisk * 0.10 -
        layoutInstability * 0.05,
    );
}

function scoreRisk(row: RankedResult, page?: ExtractedPage): number {
    const botBlockingIntensity = row.lighthouse_eligible ? 0.15 : 0.65;
    const dynamicRenderingDependency = clamp01(1 - row.scrape_reliability);
    const fingerprintingBehavior = clamp01(row.structure_stability < 0.35 ? 0.55 : 0.25);
    const extractionFragility = page ? (page.full_fetch ? 0.15 : 0.50) : 0.30;

    return clamp01(
        botBlockingIntensity * 0.30 +
        dynamicRenderingDependency * 0.30 +
        fingerprintingBehavior * 0.20 +
        extractionFragility * 0.20,
    );
}

function scoreContent(page: ExtractedPage | undefined): number {
    if (!page) return 0.35;

    const textLen = page.clean_text?.length || 0;
    const claimCount = page.claims?.length || 0;
    const entityCount = page.entities?.length || 0;
    const numericClaims = page.claims?.filter((c) => c.type === 'stat').length || 0;

    const entityDensity = clamp01(entityCount / 12);
    const claimDensity = clamp01(claimCount / 20);
    const numericPresence = clamp01(numericClaims / 8);
    const boilerplateRatio = clamp01(textLen > 0 ? Math.max(0, (1500 - textLen) / 1500) : 1);
    const seoSpamPatterns = clamp01(/\b(best\s+\w+\s+202\d|buy now|top \d+|sponsored)\b/i.test(page.clean_text || '') ? 0.55 : 0.10);

    return clamp01(
        entityDensity * 0.30 +
        claimDensity * 0.30 +
        numericPresence * 0.20 -
        boilerplateRatio * 0.10 -
        seoSpamPatterns * 0.10,
    );
}

function cacheKey(url: string): string {
    return `trustscore:${url}`;
}

async function getCached(url: string): Promise<SourceTrustScore | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
        const v = await redis.get(cacheKey(url));
        if (!v) return null;
        return JSON.parse(v) as SourceTrustScore;
    } catch {
        return null;
    }
}

async function setCached(score: SourceTrustScore): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
        await redis.setex(cacheKey(score.url), CACHE_TTL_SECONDS, JSON.stringify(score));
    } catch {
        // no-op
    }
}

export async function scoreSourceTrust(
    row: RankedResult,
    page?: ExtractedPage,
): Promise<SourceTrustScore> {
    const cached = await getCached(row.url);
    if (cached) return cached;

    const serp = scoreSerp(row);
    const content = scoreContent(page);
    const structure = scoreStructure(row);
    const risk = scoreRisk(row, page);

    const trust_score = clamp01(
        0.30 * serp +
        0.35 * content +
        0.25 * structure -
        0.10 * risk,
    );

    const decision = decisionForScore(trust_score);

    const result: SourceTrustScore = {
        url: row.url,
        trust_score,
        components: { serp, content, structure, risk },
        decision,
        reason_flags: buildReasonFlags({ serp, content, structure, risk, row, page }),
    };

    await setCached(result);
    return result;
}

export async function scoreSourcesTrustBatch(
    rows: RankedResult[],
    pages: ExtractedPage[],
): Promise<SourceTrustScore[]> {
    const pageMap = new Map(pages.map((p) => [p.url, p]));
    return Promise.all(rows.map((row) => scoreSourceTrust(row, pageMap.get(row.url))));
}
