/**
 * CitationRankScore Service
 *
 * Computes a probabilistic "Citation Rank Score" (0–100) — the likelihood
 * that a given brand/URL appears, and at what position, when AI models respond
 * to a set of real user queries.
 *
 * For each query × model pair the service:
 *  1. Asks the model to answer the query and list any relevant sources/tools.
 *  2. Scans the response for the brand name using fuzzy matching.
 *  3. Extracts the brand's approximate position in the response.
 *  4. Generates a deterministic evidence ID (sha256 of query+model+brand+excerpt).
 *  5. Computes a weighted rank score (100 − rank×2, floored at 0).
 *
 * Aggregate formula:
 *   citation_rank_score = mean(weighted_rank_scores_where_found)
 *                         × (found_count / total_checks)
 *                         × 100
 *   Clamped to [0, 100].
 *
 * Tier gate: Signal (tier ≥ signal) — uses up to 3 models per query.
 *            Alignment — uses 1 model per query (primary only).
 */

import crypto from 'crypto';
import { callAIProvider } from './aiProviders.js';
import { getPool } from './postgresql.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EvidenceQueryResult {
    evidence_id: string;
    query: string;
    model: string;
    model_short_name: string;
    platform: string;
    brand_found: boolean;
    rank_position: number | null;   // 1-based position in model response (null = not found)
    weighted_rank_score: number;    // 0–100 per result
    excerpt: string;               // Relevant passage from response
    confidence: number;            // 0–1 how confident we are in the position estimate
}

export interface CitationRankScoreResult {
    brand: string;
    url: string;
    citation_rank_score: number;               // 0–100 aggregate
    model_coverage: Record<string, number>;    // model_short_name → score on that model
    evidence_results: EvidenceQueryResult[];
    queries_tested: number;
    models_tested: number;
    found_count: number;
    computed_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Model definitions
// These mirror CITATION_VERIFY_CHAIN in citationRankingEngine.ts but are kept
// separate to avoid circular imports and to allow independent tier-gating.
// ─────────────────────────────────────────────────────────────────────────────

interface RankModel {
    model: string;
    shortName: string;
    platform: string;
}

const RANK_MODELS_SIGNAL: RankModel[] = [
    { model: 'openai/gpt-5-nano', shortName: 'GPT-5 Nano', platform: 'chatgpt' },
    { model: 'anthropic/claude-haiku-4.5', shortName: 'Claude Haiku 4.5', platform: 'claude' },
    { model: 'google/gemini-2.5-flash', shortName: 'Gemini 2.5 Flash', platform: 'google_ai' },
];

// Alignment uses only the primary model
const RANK_MODELS_ALIGNMENT: RankModel[] = [
    { model: 'openai/gpt-5-nano', shortName: 'GPT-5 Nano', platform: 'chatgpt' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

function buildRankQueryPrompt(brand: string, url: string, query: string): string {
    return `You are an AI answer engine. A user has asked: "${query}"

Provide a direct, helpful answer. At the end of your response, include a section titled "Notable sources / tools:" and list any relevant brands, tools, products, websites, or resources in ranked order (most relevant first, numbered 1 to 20).

If "${brand}" (${url}) is relevant to this query, include it where it genuinely belongs in your list — do not force-include it if it is not relevant.

Be honest and factual. Do not invent rankings.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand detection helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Returns the 1-based position of the brand in the model's response and an
 * excerpt (~150 chars) around the first mention. Returns null if not found.
 */
function detectBrandPosition(
    response: string,
    brand: string,
    domain: string,
): { position: number | null; excerpt: string } {
    const normalBrand = normalizeName(brand);
    const normalDomain = normalizeName(domain.replace(/^https?:\/\//, '').replace(/\/.*/, ''));

    // Split into lines to check numbered list entries
    const lines = response.split('\n');
    let listPosition = 0;
    let firstMentionIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if this is a numbered list item
        const numbered = /^\s*(\d+)[.)]\s+(.+)/.exec(line);
        if (numbered) {
            listPosition = parseInt(numbered[1], 10);
            const lineNorm = normalizeName(numbered[2]);
            if (
                lineNorm.includes(normalBrand) ||
                (normalDomain.length > 3 && lineNorm.includes(normalDomain))
            ) {
                const start = Math.max(0, response.indexOf(line) - 20);
                const excerpt = response.slice(start, start + 150).replace(/\n/g, ' ').trim();
                return { position: listPosition, excerpt };
            }
        } else {
            // Non-list line — check if brand is mentioned
            const lineNorm = normalizeName(line);
            if (
                firstMentionIdx === -1 &&
                (lineNorm.includes(normalBrand) ||
                    (normalDomain.length > 3 && lineNorm.includes(normalDomain)))
            ) {
                firstMentionIdx = i;
            }
        }
    }

    // If found only in prose (not in numbered list), estimate position as 10
    if (firstMentionIdx >= 0) {
        const lineContent = lines[firstMentionIdx];
        const start = Math.max(0, response.indexOf(lineContent) - 20);
        const excerpt = response.slice(start, start + 150).replace(/\n/g, ' ').trim();
        return { position: 10, excerpt };
    }

    return { position: null, excerpt: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic evidence ID
// sha256(query + '|' + model + '|' + brand + '|' + excerpt[:50])
// ─────────────────────────────────────────────────────────────────────────────

function makeEvidenceId(query: string, model: string, brand: string, excerpt: string): string {
    const raw = `${query}|${model}|${brand.toLowerCase()}|${excerpt.slice(0, 50)}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

// ─────────────────────────────────────────────────────────────────────────────
// Weighted rank score
// If found at position p: max(0, 100 - (p - 1) * 5)
//   position 1 → 100, position 5 → 80, position 10 → 55, position 20 → 5
// If not found: 0
// ─────────────────────────────────────────────────────────────────────────────

function weightedRankScore(position: number | null): number {
    if (position === null) return 0;
    return Math.max(0, 100 - (position - 1) * 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core computation
// ─────────────────────────────────────────────────────────────────────────────

export async function computeCitationRankScore(
    brand: string,
    url: string,
    queries: string[],
    tier: 'alignment' | 'signal' = 'signal',
    apiKey: string,
): Promise<CitationRankScoreResult> {
    const models = tier === 'signal' ? RANK_MODELS_SIGNAL : RANK_MODELS_ALIGNMENT;
    const domain = url.replace(/^https?:\/\//, '').replace(/\/.*/, '');

    const evidenceResults: EvidenceQueryResult[] = [];
    const modelScores: Record<string, number[]> = {};
    for (const m of models) modelScores[m.shortName] = [];

    // For each query, test against all models in parallel within the query
    for (const query of queries) {
        const prompt = buildRankQueryPrompt(brand, url, query);

        const modelChecks = models.map(async (rankModel): Promise<EvidenceQueryResult> => {
            let response = '';
            try {
                response = await callAIProvider({
                    provider: 'openrouter',
                    model: rankModel.model,
                    prompt,
                    apiKey,
                    opts: {
                        temperature: 0.3,
                        max_tokens: 800,
                        timeoutMs: 20_000,
                    },
                });
            } catch {
                // Model unavailable — record as not found
                response = '';
            }

            const { position, excerpt } = detectBrandPosition(response, brand, domain);
            const score = weightedRankScore(position);
            const evidenceId = makeEvidenceId(query, rankModel.model, brand, excerpt);

            return {
                evidence_id: evidenceId,
                query,
                model: rankModel.model,
                model_short_name: rankModel.shortName,
                platform: rankModel.platform,
                brand_found: position !== null,
                rank_position: position,
                weighted_rank_score: score,
                excerpt: excerpt.slice(0, 200),
                confidence: position !== null ? (position <= 5 ? 0.9 : 0.7) : 0.3,
            };
        });

        const results = await Promise.all(modelChecks);
        for (const r of results) {
            evidenceResults.push(r);
            modelScores[r.model_short_name].push(r.weighted_rank_score);
        }
    }

    // Aggregate
    const foundResults = evidenceResults.filter((r) => r.brand_found);
    const totalChecks = evidenceResults.length;
    const foundCount = foundResults.length;

    // Mean rank score only over found results (avoids penalising irrelevant queries twice)
    const meanFoundScore =
        foundCount > 0
            ? foundResults.reduce((sum, r) => sum + r.weighted_rank_score, 0) / foundCount
            : 0;

    // Presence rate: what fraction of checks found the brand
    const presenceRate = totalChecks > 0 ? foundCount / totalChecks : 0;

    const citationRankScore = Math.round(meanFoundScore * presenceRate * 100) / 100;

    // Per-model average scores
    const modelCoverage: Record<string, number> = {};
    for (const [shortName, scores] of Object.entries(modelScores)) {
        if (scores.length === 0) {
            modelCoverage[shortName] = 0;
        } else {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            modelCoverage[shortName] = Math.round(avg * 10) / 10;
        }
    }

    return {
        brand,
        url,
        citation_rank_score: citationRankScore,
        model_coverage: modelCoverage,
        evidence_results: evidenceResults,
        queries_tested: queries.length,
        models_tested: models.length,
        found_count: foundCount,
        computed_at: new Date().toISOString(),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB persistence
// ─────────────────────────────────────────────────────────────────────────────

export async function saveCitationRankSnapshot(
    userId: string,
    result: CitationRankScoreResult,
): Promise<void> {
    const pool = getPool();
    await pool.query(
        `INSERT INTO citation_rank_snapshots
       (user_id, brand, url, citation_rank_score, model_coverage, evidence_results,
        queries_tested, models_tested, found_count, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
            userId,
            result.brand,
            result.url,
            result.citation_rank_score,
            JSON.stringify(result.model_coverage),
            JSON.stringify(result.evidence_results),
            result.queries_tested,
            result.models_tested,
            result.found_count,
            result.computed_at,
        ],
    );
}

export async function getLatestCitationRankSnapshot(
    userId: string,
    url: string,
): Promise<CitationRankScoreResult | null> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT * FROM citation_rank_snapshots
     WHERE user_id = $1 AND url = $2
     ORDER BY computed_at DESC
     LIMIT 1`,
        [userId, url],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
        brand: row.brand,
        url: row.url,
        citation_rank_score: parseFloat(row.citation_rank_score),
        model_coverage: row.model_coverage ?? {},
        evidence_results: row.evidence_results ?? [],
        queries_tested: row.queries_tested,
        models_tested: row.models_tested,
        found_count: row.found_count,
        computed_at: row.computed_at,
    };
}

export async function getCitationRankHistory(
    userId: string,
    url: string,
    limit = 20,
): Promise<Array<{ citation_rank_score: number; found_count: number; computed_at: string }>> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT citation_rank_score, found_count, computed_at
     FROM citation_rank_snapshots
     WHERE user_id = $1 AND url = $2
     ORDER BY computed_at DESC
     LIMIT $3`,
        [userId, url, limit],
    );
    return rows.map((r) => ({
        citation_rank_score: parseFloat(r.citation_rank_score),
        found_count: r.found_count,
        computed_at: r.computed_at,
    }));
}
