// server/src/services/serpService.ts
// SerpAPI integration for structured SERP data enrichment.
// Used to strengthen entity clarity, authority signals, and visibility scoring
// for Alignment, Signal, and Score Fix tiers (NOT observer or starter).
// Requires SERP_API_KEY environment variable (set in Railway).

import { getPool } from './postgresql.js';

const SERP_BASE = 'https://serpapi.com/search.json';
const FETCH_TIMEOUT = 20_000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface SERPKnowledgePanel {
    title: string | null;
    description: string | null;
    entity_type: string | null;
}

export interface SERPSignals {
    domain: string;
    query: string;
    organic_position: number | null;
    featured_snippet: boolean;
    knowledge_panel: boolean;
    knowledge_panel_data: SERPKnowledgePanel | null;
    paa_questions: string[];
    rich_results: boolean;
    sitelinks: boolean;
    total_organic_results: number;
    scraped_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isSERPAvailable(): boolean {
    return Boolean(
        process.env.SERP_API_KEY?.trim() || process.env.SERPAPI_KEY?.trim(),
    );
}

function getApiKey(): string {
    return (process.env.SERP_API_KEY || process.env.SERPAPI_KEY || '').trim();
}

// ── Core fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch raw SERP data from SerpAPI for a given brand/domain query.
 * Returns null on API error, timeout, or missing key.
 */
async function fetchRawSERP(params: Record<string, string>): Promise<any | null> {
    const key = getApiKey();
    if (!key) return null;

    const url = new URL(SERP_BASE);
    url.searchParams.set('api_key', key);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('num', '10');
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
        const res = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!res.ok) {
            console.warn(`[SERP] API returned ${res.status} for query="${params.q?.slice(0, 60)}"`);
            return null;
        }
        return await res.json();
    } catch (err: any) {
        if (err?.name !== 'AbortError') {
            console.warn('[SERP] fetch failed:', err?.message);
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ── Main public API ───────────────────────────────────────────────────────────

/**
 * Fetch structured SERP signals for a brand + domain.
 * Parses: organic position, featured snippet, knowledge panel,
 * People Also Ask questions, rich results, and sitelinks.
 *
 * @param brand  Brand/company name to search for
 * @param domain Target domain (e.g. "acme.com") for organic position detection
 * @param query  Optional custom query; defaults to `brand`
 */
export async function fetchSERPSignals(
    brand: string,
    domain: string,
    query?: string,
): Promise<SERPSignals | null> {
    if (!isSERPAvailable()) return null;

    const searchQuery = query || brand;
    const data = await fetchRawSERP({ q: searchQuery });
    if (!data) return null;

    const domainNorm = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

    // Organic position: find position where the result URL contains the target domain
    let organic_position: number | null = null;
    const organicResults: any[] = data.organic_results || [];
    for (let i = 0; i < organicResults.length; i++) {
        const link = String(organicResults[i]?.link || '');
        const linkNorm = link.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
        if (linkNorm.startsWith(domainNorm)) {
            organic_position = i + 1;
            break;
        }
    }

    // Featured snippet
    const featuredSnippet = data.answer_box || data.featured_snippet || null;
    const featured_snippet = Boolean(featuredSnippet);

    // Knowledge panel
    const kp = data.knowledge_graph || null;
    const knowledge_panel = Boolean(kp);
    const knowledge_panel_data: SERPKnowledgePanel | null = kp
        ? {
            title: kp.title ? String(kp.title) : null,
            description: kp.description ? String(kp.description) : null,
            entity_type: kp.type ? String(kp.type) : null,
        }
        : null;

    // People Also Ask
    const paa: any[] = data.related_questions || [];
    const paa_questions = paa
        .slice(0, 10)
        .map((q: any) => String(q?.question || ''))
        .filter(Boolean);

    // Rich results (structured data detected by Google)
    const rich_results = Boolean(
        data.rich_snippets ||
        data.inline_products ||
        data.recipes ||
        data.jobs_results ||
        data.events_results ||
        organicResults.some((r: any) => r?.rich_snippet || r?.sitelinks),
    );

    // Sitelinks (expanded brand results in SERP)
    const sitelinks = Boolean(
        organicResults.some((r: any) => Array.isArray(r?.sitelinks?.list) && r.sitelinks.list.length > 0)
        || data.sitelinks,
    );

    return {
        domain,
        query: searchQuery,
        organic_position,
        featured_snippet,
        knowledge_panel,
        knowledge_panel_data,
        paa_questions,
        rich_results,
        sitelinks,
        total_organic_results: organicResults.length,
        scraped_at: new Date().toISOString(),
    };
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Save a SERP snapshot to the DB for a user/domain pair.
 * Upserts daily — one snapshot per domain per day per user.
 */
export async function saveSERPSnapshot(
    userId: string,
    signals: SERPSignals,
): Promise<void> {
    if (!signals) return;
    const pool = getPool();
    await pool.query(
        `INSERT INTO serp_snapshots
       (user_id, domain, query, organic_position, featured_snippet,
        knowledge_panel, knowledge_panel_description, paa_questions,
        rich_results, sitelinks, scraped_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (user_id, domain, snapshot_date)
     DO UPDATE SET
       query = EXCLUDED.query,
       organic_position = EXCLUDED.organic_position,
       featured_snippet = EXCLUDED.featured_snippet,
       knowledge_panel = EXCLUDED.knowledge_panel,
       knowledge_panel_description = EXCLUDED.knowledge_panel_description,
       paa_questions = EXCLUDED.paa_questions,
       rich_results = EXCLUDED.rich_results,
       sitelinks = EXCLUDED.sitelinks,
       scraped_at = EXCLUDED.scraped_at`,
        [
            userId,
            signals.domain,
            signals.query,
            signals.organic_position,
            signals.featured_snippet,
            signals.knowledge_panel,
            signals.knowledge_panel_data?.description ?? null,
            JSON.stringify(signals.paa_questions),
            signals.rich_results,
            signals.sitelinks,
            signals.scraped_at,
        ],
    );
}

/**
 * Retrieve the most recent SERP snapshot for a user/domain (within 24h).
 */
export async function getCachedSERPSnapshot(
    userId: string,
    domain: string,
): Promise<SERPSignals | null> {
    const pool = getPool();
    const res = await pool.query(
        `SELECT * FROM serp_snapshots
     WHERE user_id = $1 AND LOWER(domain) = LOWER($2)
       AND scraped_at > NOW() - INTERVAL '24 hours'
     ORDER BY scraped_at DESC LIMIT 1`,
        [userId, domain],
    );
    if (!res.rowCount) return null;
    const r = res.rows[0];
    return {
        domain: r.domain,
        query: r.query,
        organic_position: r.organic_position ?? null,
        featured_snippet: Boolean(r.featured_snippet),
        knowledge_panel: Boolean(r.knowledge_panel),
        knowledge_panel_data: r.knowledge_panel_description
            ? { title: null, description: r.knowledge_panel_description, entity_type: null }
            : null,
        paa_questions: Array.isArray(r.paa_questions) ? r.paa_questions : JSON.parse(r.paa_questions || '[]'),
        rich_results: Boolean(r.rich_results),
        sitelinks: Boolean(r.sitelinks),
        total_organic_results: 0,
        scraped_at: r.scraped_at instanceof Date ? r.scraped_at.toISOString() : String(r.scraped_at),
    };
}

// ── Score boost helpers ───────────────────────────────────────────────────────

export interface SERPScoreBoost {
    entity_clarity_boost: number;
    authority_boost: number;
    reasons: string[];
}

/**
 * Compute score boosts derived from SERP signals.
 * Returns integer point boosts for entity_clarity_score and authority_score.
 */
export function computeSERPBoosts(signals: SERPSignals): SERPScoreBoost {
    let entity_clarity_boost = 0;
    let authority_boost = 0;
    const reasons: string[] = [];

    if (signals.knowledge_panel) {
        entity_clarity_boost += 15;
        reasons.push('Knowledge panel detected — strong entity disambiguation signal.');
    }

    if (signals.sitelinks) {
        entity_clarity_boost += 8;
        reasons.push('Sitelinks present — Google recognises structured site hierarchy.');
    }

    if (signals.rich_results) {
        entity_clarity_boost += 5;
        authority_boost += 5;
        reasons.push('Rich results detected — structured data markup is parsed by Google.');
    }

    if (signals.featured_snippet) {
        authority_boost += 10;
        reasons.push('Featured snippet — your content ranks as an authoritative direct answer.');
    }

    if (signals.organic_position !== null) {
        if (signals.organic_position <= 3) {
            authority_boost += 10;
            reasons.push(`Organic position #${signals.organic_position} — top-3 ranking confirms strong authority.`);
        } else if (signals.organic_position <= 10) {
            authority_boost += 5;
            reasons.push(`Organic position #${signals.organic_position} — first-page presence.`);
        }
    }

    if (signals.paa_questions.length >= 3) {
        entity_clarity_boost += 5;
        reasons.push(`${signals.paa_questions.length} People Also Ask questions — brand has notable public interest.`);
    }

    return { entity_clarity_boost, authority_boost, reasons };
}
