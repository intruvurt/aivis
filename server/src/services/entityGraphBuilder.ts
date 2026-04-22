/**
 * Entity Graph Builder — Layer 3 of the AiVIS RAG Pipeline
 *
 * Constructs an in-memory evidence graph from extracted page context.
 * At this layer AiVIS stops thinking in documents and starts thinking in
 * truth fragments — the distinction between a RAG system and an evidence
 * reasoning engine.
 *
 * Graph structure
 * ───────────────
 *  Nodes:  Entity | Claim | Source | Metric
 *  Edges:  cites | supports | contradicts | updates | has_claim
 *
 * Every claim must trace to at least one Source node. Unsourced claims are
 * assigned an UNCITED flag and surfaced as gaps in the visibility report.
 *
 * The resulting graph is serialisable so it can be persisted to the
 * citation_ledger and referenced by scan_id.
 */

import type { ExtractedPage, ExtractedClaim } from './contextExtractor.js';
import type { ClaimType } from './contextExtractor.js';

// ── Node types ────────────────────────────────────────────────────────────────

export type NodeKind = 'entity' | 'claim' | 'source' | 'metric';

export interface EntityNode {
    id: string;
    kind: 'entity';
    label: string;  // canonical name (deduplicated, lowercase)
    aliases: string[];
    mention_count: number;
}

export interface ClaimNode {
    id: string;
    kind: 'claim';
    text: string;
    claim_type: ClaimType;
    confidence: number;
    /** Claim is contested by at least one other source */
    contested: boolean;
    /** No source corroborates this claim */
    uncited: boolean;
}

export interface SourceNode {
    id: string;
    kind: 'source';
    url: string;
    title: string;
    domain: string;
    published_ms?: number;
    /** 0–1 credibility proxy based on domain signals */
    credibility: number;
}

export interface MetricNode {
    id: string;
    kind: 'metric';
    name: string;  // e.g. "revenue", "users", "growth_rate"
    value: string;
    unit: string;
    source_url: string;
}

export type GraphNode = EntityNode | ClaimNode | SourceNode | MetricNode;

// ── Edge types ────────────────────────────────────────────────────────────────

export type EdgeKind = 'cites' | 'supports' | 'contradicts' | 'updates' | 'has_claim' | 'mentions';

export interface GraphEdge {
    from: string;   // node id
    to: string;   // node id
    kind: EdgeKind;
    weight: number;   // 0–1
    provenance: string;   // source URL that justifies this edge
}

// ── Graph ─────────────────────────────────────────────────────────────────────

export interface EvidenceGraph {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
    /** Entities ranked by total evidence weight (descending) */
    entity_ranking: Array<{ entity_id: string; label: string; total_weight: number }>;
    /** Claims that have zero corroboration */
    uncited_claims: ClaimNode[];
    /** Claims that are contested by at least one counter-source */
    contested_claims: ClaimNode[];
    /** Summary stats */
    stats: {
        total_nodes: number;
        entity_count: number;
        claim_count: number;
        source_count: number;
        metric_count: number;
        edge_count: number;
        uncited_count: number;
        contested_count: number;
    };
}

// ── Domain credibility heuristic ─────────────────────────────────────────────
// No external API — uses known high-credibility domain patterns.

const HIGH_CREDIBILITY_DOMAINS = new Set([
    'techcrunch.com', 'forbes.com', 'bloomberg.com', 'reuters.com', 'wsj.com',
    'ft.com', 'nytimes.com', 'theverge.com', 'wired.com', 'venturebeat.com',
    'g2.com', 'capterra.com', 'trustpilot.com', 'producthunt.com',
    'crunchbase.com', 'pitchbook.com', 'sec.gov', 'statista.com',
    'wikipedia.org', 'github.com', 'arxiv.org',
]);

const MEDIUM_CREDIBILITY_PATTERNS = [/\.edu$/, /\.gov$/, /\.org$/, /news\.|blog\./i];

function domainCredibility(url: string): number {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        if (HIGH_CREDIBILITY_DOMAINS.has(host)) return 0.90;
        if (MEDIUM_CREDIBILITY_PATTERNS.some(p => p.test(host))) return 0.70;
        return 0.50; // unknown domain — neutral
    } catch {
        return 0.40;
    }
}

// ── Metric extraction ─────────────────────────────────────────────────────────

const METRIC_PATTERNS: Array<{ name: string; pattern: RegExp; unit: string }> = [
    { name: 'revenue', pattern: /\$([\d,.]+[MBK]?)\s*(ARR|MRR|revenue)/i, unit: 'USD' },
    { name: 'growth_rate', pattern: /([\d.]+)%\s*(growth|increase|rise|up)/i, unit: '%' },
    { name: 'users', pattern: /([\d,.]+[MBK]?)\s*(users?|customers?|clients?)/i, unit: 'count' },
    { name: 'funding', pattern: /raised?\s*\$([\d,.]+[MBK]?)/i, unit: 'USD' },
    { name: 'employees', pattern: /([\d,]+)\s*(employees?|team members?|headcount)/i, unit: 'people' },
    { name: 'uptime', pattern: /([\d.]+)%\s*uptime/i, unit: '%' },
    { name: 'downloads', pattern: /([\d,.]+[MBK]?)\s*(downloads?|installs?)/i, unit: 'count' },
];

function extractMetrics(text: string, sourceUrl: string): Array<Omit<MetricNode, 'id'>> {
    const found: Array<Omit<MetricNode, 'id'>> = [];
    for (const { name, pattern, unit } of METRIC_PATTERNS) {
        const m = pattern.exec(text);
        if (m) {
            found.push({ kind: 'metric', name, value: m[1], unit, source_url: sourceUrl });
        }
    }
    return found;
}

// ── ID helpers ────────────────────────────────────────────────────────────────

function nodeId(prefix: string, label: string): string {
    return `${prefix}:${label.toLowerCase().replace(/\s+/g, '_').slice(0, 60)}`;
}

function edgeKey(from: string, to: string, kind: EdgeKind): string {
    return `${from}→${kind}→${to}`;
}

// ── Contradiction detection ───────────────────────────────────────────────────

function claimsContradict(a: ClaimNode, b: ClaimNode): boolean {
    const aL = a.text.toLowerCase();
    const bL = b.text.toLowerCase();

    // Negation pattern: one asserts, other negates with "not", "no", "never", "doesn't"
    const NEGATE = /\b(not|no|never|doesn['']?t|hasn['']?t|isn['']?t|won['']?t)\b/i;
    if (NEGATE.test(aL) !== NEGATE.test(bL)) {
        // Rough check: significant word overlap with opposite polarity
        const wordsA = new Set(aL.split(/\W+/).filter(w => w.length > 4));
        const wordsB = new Set(bL.split(/\W+/).filter(w => w.length > 4));
        const overlap = [...wordsA].filter(w => wordsB.has(w)).length;
        if (overlap >= 3) return true;
    }

    // Different stat values for same metric
    if (a.claim_type === 'stat' && b.claim_type === 'stat') {
        const numA = a.text.match(/\d[\d,.]*/)?.[0];
        const numB = b.text.match(/\d[\d,.]*/)?.[0];
        if (numA && numB && numA !== numB) {
            // Same context words around the numbers
            const ctxA = aL.replace(numA, '').slice(0, 80);
            const ctxB = bL.replace(numB, '').slice(0, 80);
            const words = (s: string) => new Set(s.split(/\W+/).filter(w => w.length > 3));
            const ov = [...words(ctxA)].filter(w => words(ctxB).has(w));
            if (ov.length >= 2) return true;
        }
    }

    return false;
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Build an EvidenceGraph from extracted page context.
 *
 * This is the core AiVIS reasoning layer. It transforms a list of pages
 * with claims into a structured evidence graph where every assertion is
 * traceable to its source and contradiction/corroboration relationships
 * are explicit.
 */
export function buildEntityGraph(
    pages: ExtractedPage[],
    subjectEntities: string[] = [],
): EvidenceGraph {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const edgeSeen = new Set<string>();

    function addEdge(e: GraphEdge): void {
        const key = edgeKey(e.from, e.to, e.kind);
        if (!edgeSeen.has(key)) { edgeSeen.add(key); edges.push(e); }
    }

    function upsertEntity(label: string): EntityNode {
        const id = nodeId('entity', label);
        let node = nodes.get(id) as EntityNode | undefined;
        if (!node) {
            node = { id, kind: 'entity', label: label.toLowerCase(), aliases: [], mention_count: 0 };
            nodes.set(id, node);
        }
        node.mention_count++;
        return node;
    }

    // ── 1. Seed subject entities (from intent or scrape) ───────────────────────
    for (const label of subjectEntities) {
        upsertEntity(label);
    }

    // ── 2. Ingest sources ──────────────────────────────────────────────────────
    for (const page of pages) {
        const sourceId = nodeId('source', page.url);
        const source: SourceNode = {
            id: sourceId,
            kind: 'source',
            url: page.url,
            title: page.title,
            domain: (() => { try { return new URL(page.url).hostname.replace(/^www\./, ''); } catch { return page.url; } })(),
            published_ms: page.published_ms,
            credibility: domainCredibility(page.url),
        };
        nodes.set(sourceId, source);

        // ── 3. Ingest entities from this page ─────────────────────────────────
        for (const rawLabel of page.entities.slice(0, 20)) {
            const entity = upsertEntity(rawLabel);
            addEdge({ from: sourceId, to: entity.id, kind: 'mentions', weight: 0.5, provenance: page.url });
        }

        // ── 4. Ingest claims ──────────────────────────────────────────────────
        for (const extracted of page.claims) {
            const claimId = nodeId('claim', extracted.text.slice(0, 80));

            if (!nodes.has(claimId)) {
                const claim: ClaimNode = {
                    id: claimId,
                    kind: 'claim',
                    text: extracted.text,
                    claim_type: extracted.type,
                    confidence: extracted.confidence,
                    contested: false,
                    uncited: false,
                };
                nodes.set(claimId, claim);
            }

            // source → cites → claim
            addEdge({ from: sourceId, to: claimId, kind: 'cites', weight: source.credibility * extracted.confidence, provenance: page.url });

            // entity → has_claim
            for (const rawLabel of extracted.entities.slice(0, 3)) {
                const entity = upsertEntity(rawLabel);
                addEdge({ from: entity.id, to: claimId, kind: 'has_claim', weight: 0.7, provenance: page.url });
            }

            // ── 5. Metric nodes ────────────────────────────────────────────────
            for (const metric of extractMetrics(extracted.text, page.url)) {
                const metricId = nodeId('metric', `${metric.name}_${metric.value}`);
                if (!nodes.has(metricId)) {
                    nodes.set(metricId, { ...metric, id: metricId } as MetricNode);
                }
                addEdge({ from: claimId, to: metricId, kind: 'supports', weight: 0.8, provenance: page.url });
            }
        }
    }

    // ── 6. Cross-source contradiction + corroboration scan ────────────────────
    const claimNodes = [...nodes.values()].filter((n): n is ClaimNode => n.kind === 'claim');

    for (let i = 0; i < claimNodes.length; i++) {
        for (let j = i + 1; j < claimNodes.length; j++) {
            const a = claimNodes[i];
            const b = claimNodes[j];
            if (claimsContradict(a, b)) {
                a.contested = true;
                b.contested = true;
                addEdge({ from: a.id, to: b.id, kind: 'contradicts', weight: 0.9, provenance: 'cross_source' });
            }
        }
    }

    // ── 7. Mark uncited claims (claim with no supporting source edge) ──────────
    const citedClaimIds = new Set(edges.filter(e => e.kind === 'cites').map(e => e.to));
    for (const claim of claimNodes) {
        if (!citedClaimIds.has(claim.id)) claim.uncited = true;
    }

    // ── 8. Entity ranking by total edge weight ────────────────────────────────
    const entityWeights = new Map<string, number>();
    for (const edge of edges) {
        const fromNode = nodes.get(edge.from);
        if (fromNode?.kind === 'entity') {
            entityWeights.set(edge.from, (entityWeights.get(edge.from) || 0) + edge.weight);
        }
        const toNode = nodes.get(edge.to);
        if (toNode?.kind === 'entity') {
            entityWeights.set(edge.to, (entityWeights.get(edge.to) || 0) + edge.weight * 0.5);
        }
    }

    const entity_ranking = [...nodes.values()]
        .filter((n): n is EntityNode => n.kind === 'entity')
        .map(n => ({ entity_id: n.id, label: n.label, total_weight: entityWeights.get(n.id) || n.mention_count * 0.1 }))
        .sort((a, b) => b.total_weight - a.total_weight);

    const uncited_claims = claimNodes.filter(c => c.uncited);
    const contested_claims = claimNodes.filter(c => c.contested);

    const entityCount = [...nodes.values()].filter(n => n.kind === 'entity').length;
    const claimCount = claimNodes.length;
    const sourceCount = [...nodes.values()].filter(n => n.kind === 'source').length;
    const metricCount = [...nodes.values()].filter(n => n.kind === 'metric').length;

    return {
        nodes,
        edges,
        entity_ranking,
        uncited_claims,
        contested_claims,
        stats: {
            total_nodes: nodes.size,
            entity_count: entityCount,
            claim_count: claimCount,
            source_count: sourceCount,
            metric_count: metricCount,
            edge_count: edges.length,
            uncited_count: uncited_claims.length,
            contested_count: contested_claims.length,
        },
    };
}

/**
 * Serialise an EvidenceGraph to a plain object for ledger persistence or API response.
 */
export function serialiseGraph(graph: EvidenceGraph): Record<string, unknown> {
    return {
        nodes: [...graph.nodes.values()],
        edges: graph.edges,
        entity_ranking: graph.entity_ranking,
        uncited_claims: graph.uncited_claims,
        contested_claims: graph.contested_claims,
        stats: graph.stats,
    };
}
