/**
 * claimConflictResolver.ts
 *
 * Probabilistic scoring model + graph-based conflict resolver.
 *
 * Architecture principle:
 *   Disagreement is signal tension, not failure.
 *   Contradictions degrade certainty; they do not destroy output.
 *
 * Pipeline (per invocation of resolveClaims):
 *
 *   1. Normalize  → canonicalize entities, predicates, values
 *   2. Cluster    → group by (subject, predicate)
 *   3. Score      → base weight per claim (confidence × source × evidence)
 *   4. Detect     → strict conflict detection within each cluster
 *   5. Graph      → build per-cluster conflict graph
 *   6. Aggregate  → sum support per candidate value
 *   7. Penalize   → reduce heavily contested values
 *   8. Softmax    → normalize to probability distribution (no zero collapse)
 *   9. Resolve    → assign VERIFIED / DEGRADED / CONTRADICTORY per cluster
 *  10. Score      → composite probabilistic score across all clusters
 *
 * Integration:
 *   Call resolveClaims(claims) with any Claim[] assembled from citation
 *   results, SERP signals, scrape evidence, or AI model outputs.
 *   Returns ClaimResolutionResult — safe to include in AnalysisResponse.
 */

import { randomUUID } from 'crypto';
import type {
    Claim,
    ClaimCluster,
    ClaimConflictGraph,
    ConflictEdge,
    ResolutionCandidate,
    ClaimResolution,
    ResolutionStatus,
    ClaimResolutionResult,
    AICitationResult,
    AuditEvidenceEntry,
} from '../../../shared/types.js';

/* ══════════════════════════════════════════════════════════════════════════
 * 1. ENTITY + PREDICATE + VALUE NORMALIZATION
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Predicate synonym map → canonical key.
 * Extend this table as new predicates are discovered in the wild.
 */
const PREDICATE_SYNONYMS: Readonly<Record<string, string>> = {
    // Founding year
    founded: 'foundedYear',
    established: 'foundedYear',
    'year founded': 'foundedYear',
    'founding year': 'foundedYear',
    'inception year': 'foundedYear',
    launched: 'foundedYear',

    // Headquarters / location
    location: 'headquarters',
    'hq location': 'headquarters',
    'hq city': 'headquarters',
    'based in': 'headquarters',
    'headquartered in': 'headquarters',

    // Employee count
    employees: 'employeeCount',
    'employee count': 'employeeCount',
    'number of employees': 'employeeCount',
    headcount: 'employeeCount',
    staff: 'employeeCount',

    // CEO / founder
    ceo: 'ceoName',
    'chief executive': 'ceoName',
    'chief executive officer': 'ceoName',
    founder: 'founderName',
    'co-founder': 'founderName',

    // Product / category
    product: 'primaryProduct',
    'main product': 'primaryProduct',
    'core product': 'primaryProduct',
    category: 'productCategory',
    industry: 'industryCategory',
    sector: 'industryCategory',
    vertical: 'industryCategory',

    // Revenue
    revenue: 'annualRevenue',
    'annual revenue': 'annualRevenue',
    'yearly revenue': 'annualRevenue',

    // Valuation
    valuation: 'companyValuation',
    'company valuation': 'companyValuation',
    'market cap': 'companyValuation',
};

/**
 * Known entity alias clusters → canonical name.
 * Keys are lowercase normalized aliases; values are canonical forms.
 */
const ENTITY_ALIASES: Readonly<Record<string, string>> = {
    openai: 'OpenAI',
    'open ai': 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    'google llc': 'Google',
    alphabet: 'Google',
    microsoft: 'Microsoft',
    meta: 'Meta',
    'meta platforms': 'Meta',
    facebook: 'Meta',
};

/** Normalize an entity name to its canonical form. */
export function normalizeEntity(name: string): string {
    const lower = name.toLowerCase().trim();
    return ENTITY_ALIASES[lower] ?? name.trim();
}

/** Normalize a predicate string to its canonical key. */
export function normalizePredicate(raw: string): string {
    const lower = raw.toLowerCase().trim();
    return PREDICATE_SYNONYMS[lower] ?? raw.trim();
}

/**
 * Normalize a value to a stable, comparable form.
 * Handles year strings, roman numerals, and numeric coercions.
 */
export function normalizeValue(
    value: string | number | boolean,
    predicate: string,
): string | number | boolean {
    if (typeof value === 'boolean') return value;

    if (typeof value === 'number') return value;

    const str = String(value).trim();

    // Roman numeral years (e.g. "MMXV" → 2015)
    const roman = parseRomanYear(str);
    if (roman !== null) return roman;

    // Predicates that expect a year — coerce numeric strings
    if (predicate.toLowerCase().includes('year') || predicate === 'foundedYear') {
        const n = parseInt(str, 10);
        if (!isNaN(n) && n > 1800 && n < 2200) return n;
        // Short year forms: "15" → 2015 (only in range 00-30)
        const shortYear = parseInt(str, 10);
        if (!isNaN(shortYear) && shortYear >= 0 && shortYear <= 30) return 2000 + shortYear;
    }

    // Numeric strings for numeric predicates
    const n = Number(str.replace(/[,_\s]/g, ''));
    if (!isNaN(n) && str !== '') {
        if (
            predicate === 'employeeCount' ||
            predicate === 'annualRevenue' ||
            predicate === 'companyValuation'
        ) return n;
    }

    return str;
}

/** Very limited Roman numeral → integer for 4-digit years only (e.g. MMXV → 2015). */
function parseRomanYear(s: string): number | null {
    const romanMap: Record<string, number> = {
        I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
    };
    if (!/^[IVXLCDM]+$/.test(s.toUpperCase())) return null;
    const upper = s.toUpperCase();
    let result = 0;
    for (let i = 0; i < upper.length; i++) {
        const curr = romanMap[upper[i]];
        const next = romanMap[upper[i + 1]];
        if (!curr) return null;
        result += next && next > curr ? -curr : curr;
    }
    // Only accept plausible year range
    if (result < 1800 || result > 2200) return null;
    return result;
}

/** Apply all normalization to a Claim. Returns a new Claim (immutable). */
export function normalizeClaim(claim: Claim): Claim {
    return {
        ...claim,
        subject: normalizeEntity(claim.subject),
        predicate: normalizePredicate(claim.predicate),
        object: normalizeValue(claim.object, normalizePredicate(claim.predicate)),
    };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2. CLUSTERING — group by (subject, predicate)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Group a flat Claim[] into clusters by (subject, predicate).
 * Claims are normalized before clustering.
 */
export function buildClusters(claims: Claim[]): ClaimCluster[] {
    const normalized = claims.map(normalizeClaim);
    const map = new Map<string, Claim[]>();

    for (const claim of normalized) {
        const key = `${claim.subject}\x00${claim.predicate}`;
        const bucket = map.get(key);
        if (bucket) {
            bucket.push(claim);
        } else {
            map.set(key, [claim]);
        }
    }

    return Array.from(map.entries()).map(([key, claimsInCluster]) => {
        const [subject, predicate] = key.split('\x00');
        return { subject, predicate, claims: claimsInCluster };
    });
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3. BASE SCORING per claim
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Map evidence matchType → quality weight.
 *   exact structured match → 1.0
 *   fuzzy text match       → 0.6
 *   inferred               → 0.3
 */
function evidenceQuality(claim: Claim): number {
    switch (claim.evidence.matchType) {
        case 'exact': return 1.0;
        case 'fuzzy': return 0.6;
        case 'inferred': return 0.3;
        default: return 0.3;
    }
}

/**
 * Base score for a single claim.
 * Weights:
 *   extraction confidence : 0.40
 *   domain authority      : 0.25
 *   freshness             : 0.15
 *   evidence quality      : 0.20
 */
export function baseScore(claim: Claim): number {
    return (
        claim.confidence * 0.40 +
        claim.source.domainAuthority * 0.25 +
        claim.source.freshness * 0.15 +
        evidenceQuality(claim) * 0.20
    );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4. CONFLICT DETECTION — strict, not fuzzy
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Numeric tolerance per predicate key.
 * Claims whose numeric values differ by ≤ tolerance are NOT considered conflicting.
 */
const PREDICATE_NUMERIC_TOLERANCE: Readonly<Record<string, number>> = {
    foundedYear: 1,           // ±1 year
    employeeCount: 0.10,      // 10% relative (applied as fraction of larger value)
    annualRevenue: 0.15,      // 15% relative
    companyValuation: 0.20,   // 20% relative
};

/** Return the absolute numeric tolerance for a predicate. */
export function predicateTolerance(predicate: string, referenceValue?: number): number {
    const raw = PREDICATE_NUMERIC_TOLERANCE[predicate];
    if (raw === undefined) return 0;
    // Values < 1 are treated as relative fractions of the reference value
    if (raw < 1 && referenceValue !== undefined && referenceValue > 0) {
        return raw * referenceValue;
    }
    return raw;
}

/**
 * Strict conflict predicate.
 * Two claims conflict iff they share subject+predicate (guaranteed at cluster level)
 * AND their values are mutually exclusive given the type-specific tolerance.
 */
export function isConflict(a: Claim, b: Claim): boolean {
    if (a.valueType !== b.valueType) return false;

    if (a.valueType === 'number') {
        const aVal = Number(a.object);
        const bVal = Number(b.object);
        const larger = Math.max(Math.abs(aVal), Math.abs(bVal));
        const tol = predicateTolerance(a.predicate, larger);
        return Math.abs(aVal - bVal) > tol;
    }

    // Boolean: strict equality
    if (a.valueType === 'boolean') return a.object !== b.object;

    // String: case-insensitive strict inequality
    return String(a.object).toLowerCase() !== String(b.object).toLowerCase();
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5. CONFLICT GRAPH construction
 * ══════════════════════════════════════════════════════════════════════════ */

/** Build the conflict graph for a single cluster. */
export function buildConflictGraph(cluster: ClaimCluster): ClaimConflictGraph {
    const edges: ConflictEdge[] = [];
    const { claims } = cluster;

    for (let i = 0; i < claims.length; i++) {
        for (let j = i + 1; j < claims.length; j++) {
            if (isConflict(claims[i], claims[j])) {
                edges.push({ a: claims[i].id, b: claims[j].id });
            }
        }
    }

    return { nodes: claims, edges };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 6. SUPPORT AGGREGATION — sum scores per candidate value
 * ══════════════════════════════════════════════════════════════════════════ */

/** Aggregate support per unique value in a cluster. Returns Map<value, score>. */
export function aggregateSupport(cluster: ClaimCluster): Map<string, number> {
    const map = new Map<string, number>();

    for (const claim of cluster.claims) {
        const key = String(claim.object).toLowerCase();
        map.set(key, (map.get(key) ?? 0) + baseScore(claim));
    }

    return map;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 7. CONTRADICTION PENALTY
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Apply opposition penalty to each candidate value.
 * The penalty is proportional to the aggregated weight of all claims
 * that assert a DIFFERENT value (i.e. oppose this candidate).
 * Penalty factor: 0.30 — heavy opposition weakens but does not eliminate.
 */
export function applyConflictPenalty(
    cluster: ClaimCluster,
    scores: Map<string, number>,
): Map<string, number> {
    const result = new Map<string, number>();

    for (const [value, score] of scores.entries()) {
        const opposingWeight = cluster.claims
            .filter(c => String(c.object).toLowerCase() !== value)
            .reduce((sum, c) => sum + baseScore(c), 0);

        result.set(value, score - opposingWeight * 0.30);
    }

    return result;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 8. SOFTMAX NORMALIZATION — prevents zero collapse
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Numeric-stable softmax over a Map<value, raw_score>.
 * Returns candidates sorted descending by probability.
 * The max-subtraction trick prevents overflow for large raw scores.
 */
export function softmaxNormalize(
    scores: Map<string, number>,
    support: Map<string, number>,
    conflictMap: Map<string, string[]>,
): ResolutionCandidate[] {
    const entries = Array.from(scores.entries());
    const vals = entries.map(([, v]) => v);
    const max = Math.max(...vals);

    const exps = vals.map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);

    return entries
        .map(([key, _], i) => ({
            value: key,
            probability: exps[i] / sum,
            support: support.get(key) ?? 0,
            conflictsWith: conflictMap.get(key) ?? [],
        }))
        .sort((a, b) => b.probability - a.probability);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 9. CLUSTER RESOLUTION
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Map candidate distribution to a resolution status.
 *   top.probability ≥ 0.75          → VERIFIED
 *   top.probability 0.40–0.75       → DEGRADED
 *   top.probability < 0.40          → CONTRADICTORY
 */
function classifyStatus(candidates: ResolutionCandidate[]): ResolutionStatus {
    if (candidates.length === 0) return 'CONTRADICTORY';
    const top = candidates[0].probability;
    if (top >= 0.75) return 'VERIFIED';
    if (top >= 0.40) return 'DEGRADED';
    return 'CONTRADICTORY';
}

/**
 * Build a per-value conflict-with map for the final candidate array.
 * value → list of other values it directly conflicts with.
 */
function buildConflictMap(
    cluster: ClaimCluster,
    graph: ClaimConflictGraph,
): Map<string, string[]> {
    const claimById = new Map(cluster.claims.map(c => [c.id, c]));
    const map = new Map<string, string[]>();

    for (const edge of graph.edges) {
        const aVal = String(claimById.get(edge.a)?.object ?? '').toLowerCase();
        const bVal = String(claimById.get(edge.b)?.object ?? '').toLowerCase();

        if (!map.has(aVal)) map.set(aVal, []);
        if (!map.has(bVal)) map.set(bVal, []);

        if (!map.get(aVal)!.includes(bVal)) map.get(aVal)!.push(bVal);
        if (!map.get(bVal)!.includes(aVal)) map.get(bVal)!.push(aVal);
    }

    return map;
}

/** Fully resolve a single cluster through the aggregate → penalty → softmax pipeline. */
export function resolveCluster(cluster: ClaimCluster): ClaimResolution {
    const graph = buildConflictGraph(cluster);
    const rawSupport = aggregateSupport(cluster);
    const penalized = applyConflictPenalty(cluster, rawSupport);
    const conflictMap = buildConflictMap(cluster, graph);
    const candidates = softmaxNormalize(penalized, rawSupport, conflictMap);
    const status = classifyStatus(candidates);

    return {
        subject: cluster.subject,
        predicate: cluster.predicate,
        candidates,
        status,
    };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 10. FINAL COMPOSITE SCORE
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Aggregate score across all cluster resolutions (0–100).
 * Confidence multiplier by status:
 *   VERIFIED      → 1.00
 *   DEGRADED      → 0.60
 *   CONTRADICTORY → 0.30
 *
 * Formula: Σ(top.probability × confidence) / n × 100
 * Guarantees score > 0 even with all CONTRADICTORY clusters,
 * as long as any candidate has non-zero probability.
 */
export function finalScore(resolutions: ClaimResolution[]): number {
    if (resolutions.length === 0) return 0;

    let total = 0;
    let weight = 0;

    for (const r of resolutions) {
        const top = r.candidates[0];
        if (!top) continue;

        const confidence =
            r.status === 'VERIFIED' ? 1.0 :
                r.status === 'DEGRADED' ? 0.6 :
                    0.3;

        total += top.probability * confidence;
        weight += 1;
    }

    return Math.round((total / weight) * 100);
}

/* ══════════════════════════════════════════════════════════════════════════
 * PUBLIC ENTRY POINT
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Main entry point — resolve a flat Claim[] into a ClaimResolutionResult.
 *
 * The pipeline is fully synchronous (no I/O). Feed it any number of claims
 * extracted from citation results, SERP signals, or scrape evidence.
 */
export function resolveClaims(claims: Claim[]): ClaimResolutionResult {
    if (claims.length === 0) {
        return {
            resolved_at: new Date().toISOString(),
            resolutions: [],
            composite_score: 0,
            status_summary: { verified: 0, degraded: 0, contradictory: 0 },
            has_contradictions: false,
        };
    }

    const clusters = buildClusters(claims);
    const resolutions = clusters.map(resolveCluster);
    const score = finalScore(resolutions);

    const status_summary = resolutions.reduce(
        (acc, r) => {
            acc[r.status === 'VERIFIED' ? 'verified' : r.status === 'DEGRADED' ? 'degraded' : 'contradictory']++;
            return acc;
        },
        { verified: 0, degraded: 0, contradictory: 0 },
    );

    return {
        resolved_at: new Date().toISOString(),
        resolutions,
        composite_score: score,
        status_summary,
        has_contradictions: status_summary.contradictory > 0,
    };
}

/* ══════════════════════════════════════════════════════════════════════════
 * ADAPTER FUNCTIONS — convert existing pipeline types into Claim[]
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build claims from AICitationResult[] (citationTester output).
 * Each result contributes a "mentioned" boolean claim and, when cited,
 * a position claim — both anchored to the entity under test.
 *
 * @param results - Array of citation test results from citationTester
 * @param entityName - The canonical entity name under test
 */
export function claimsFromCitationResults(
    results: AICitationResult[],
    entityName: string,
): Claim[] {
    const claims: Claim[] = [];

    for (const r of results) {
        // Claim: entity is mentioned (boolean)
        claims.push({
            id: randomUUID(),
            subject: entityName,
            predicate: 'isMentioned',
            object: r.mentioned,
            valueType: 'boolean',
            confidence: r.mentioned ? 0.9 : 0.7,
            source: {
                url: `platform:${r.platform}`,
                domainAuthority: platformDomainAuthority(r.platform),
                freshness: 1.0,
            },
            evidence: {
                text: r.excerpt ?? '',
                position: [0, (r.excerpt ?? '').length],
                matchType: r.mentioned ? 'exact' : 'inferred',
            },
        });

        // Claim: citation position (when mentioned)
        if (r.mentioned && r.position > 0) {
            // Normalize position to 0–1 (lower rank = higher authority, cap at 10)
            const normalizedPosition = Math.max(0, 1 - (r.position - 1) / 10);

            claims.push({
                id: randomUUID(),
                subject: entityName,
                predicate: 'citationPosition',
                object: r.position,
                valueType: 'number',
                confidence: normalizedPosition,
                source: {
                    url: `platform:${r.platform}`,
                    domainAuthority: platformDomainAuthority(r.platform),
                    freshness: 1.0,
                },
                evidence: {
                    text: r.excerpt ?? '',
                    position: [0, (r.excerpt ?? '').length],
                    matchType: 'exact',
                },
            });
        }
    }

    return claims;
}

/**
 * Build claims from AuditEvidenceEntry[] (citation ledger entries).
 * Extracts signal-level claims where evidence is concrete and traceable.
 *
 * @param entries - Evidence entries from the audit ledger
 * @param entityName - The canonical entity name under test
 */
export function claimsFromEvidenceEntries(
    entries: AuditEvidenceEntry[],
    entityName: string,
): Claim[] {
    return entries.map(entry => ({
        id: randomUUID(),
        subject: entityName,
        predicate: entry.extracted_signal,
        object: entry.raw_evidence.slice(0, 500), // truncate for safety
        valueType: 'string' as const,
        confidence: entry.confidence_score,
        source: {
            url: entry.url,
            domainAuthority: sourceTypeDomainAuthority(entry.source_type),
            freshness: computeFreshness(entry.created_at),
        },
        evidence: {
            text: entry.raw_evidence.slice(0, 500),
            position: [0, Math.min(500, entry.raw_evidence.length)],
            matchType: entry.source_type === 'rule_engine' ? 'exact' : 'fuzzy' as const,
        },
    }));
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Approximate domain authority score for known AI platforms (0–1). */
function platformDomainAuthority(platform: string): number {
    const map: Record<string, number> = {
        chatgpt: 0.95,
        perplexity: 0.85,
        claude: 0.90,
        google_ai: 0.92,
    };
    return map[platform] ?? 0.70;
}

/** Approximate domain authority by evidence source type (0–1). */
function sourceTypeDomainAuthority(
    sourceType: AuditEvidenceEntry['source_type'],
): number {
    const map: Record<AuditEvidenceEntry['source_type'], number> = {
        citation_engine: 0.95,
        serp_service: 0.88,
        rule_engine: 0.85,
        ai_provider: 0.80,
        trust_layer: 0.78,
        entity_graph: 0.75,
        mention_tracker: 0.65,
    };
    return map[sourceType] ?? 0.60;
}

/**
 * Convert an ISO timestamp to a freshness score (0–1).
 * Freshness decays linearly from 1.0 to 0.0 over 365 days.
 */
function computeFreshness(isoTimestamp: string): number {
    const ageMs = Date.now() - new Date(isoTimestamp).getTime();
    const ageDays = ageMs / 86_400_000;
    return Math.max(0, 1 - ageDays / 365);
}
