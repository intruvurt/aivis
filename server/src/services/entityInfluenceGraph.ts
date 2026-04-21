import type { MentionRow } from './mentionTracker.js';
import {
    buildEntityFromAliases,
    computeEdgeWeight,
    computeEntityInfluence,
    processDocument,
    type CitationEdge,
    type IngestedDocument,
} from './aivisCitationCoreV2.js';

export interface InfluenceNode {
    id: string;
    node_type: 'entity' | 'platform_account' | 'document';
    label: string;
    source?: string;
    url?: string;
    weight: number;
}

export interface InfluenceEdge {
    from: string;
    to: string;
    edge_type: 'mentions' | 'implicit_citation' | 'reinforces';
    weight: number;
    evidence: string[];
}

export interface InfluencePath {
    path: string[];
    source: string;
    url: string;
    link_type: 'direct' | 'mention' | 'paraphrase' | 'semantic' | 'ai_summary';
    influence_score: number;
    confidence: number;
    implicit_citation: boolean;
    explanation: string;
}

export interface EntityInfluenceGraph {
    entity_id: string;
    aliases: string[];
    nodes: InfluenceNode[];
    edges: InfluenceEdge[];
    influence_score: number;
    ai_visibility_score: number;
    cross_platform_coverage: number;
    implicit_citation_count: number;
    signal_count: number;
    breakdown: {
        direct: number;
        semantic: number;
        paraphrase: number;
        ai_summary: number;
    };
    top_paths: InfluencePath[];
    generated_at: string;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function safeId(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9:_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
}

function normalizeAlias(value: string): string {
    return value.trim().toLowerCase();
}

function extractHostname(rawUrl: string): string {
    try {
        return new URL(rawUrl).hostname.toLowerCase();
    } catch {
        return rawUrl.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    }
}

function inferAccountLabel(url: string, source: string): string {
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length === 0) return `${source}:unknown`;

        if (source === 'reddit' && parts.length >= 2) return `reddit:${parts[1]}`;
        if (source === 'twitter' && parts.length >= 1) return `x:${parts[0]}`;
        if (source === 'bluesky' && parts.length >= 2) return `bsky:${parts[1]}`;
        if (source === 'medium' && parts.length >= 1) return `medium:${parts[0]}`;
        if (source === 'devto' && parts.length >= 1) return `devto:${parts[0]}`;
        if (source === 'github' && parts.length >= 1) return `github:${parts[0]}`;

        return `${source}:${parts[0]}`;
    } catch {
        return `${source}:unknown`;
    }
}

function summarizeExplanation(row: MentionRow, implicit: boolean, similarity: number, edgeType: CitationEdge['type']): string {
    const parts: string[] = [];
    parts.push(`authority=${(row.authority_weight ?? 0).toFixed(2)}`);
    parts.push(`relevance=${(row.relevance_score ?? 0).toFixed(2)}`);
    parts.push(`type=${edgeType}`);
    if (similarity > 0) parts.push(`semantic_similarity=${similarity.toFixed(2)}`);
    if ((row.relevance_reasons || []).some((reason) => reason.startsWith('alias-hit:'))) parts.push('alias_resolved=true');
    if ((row.relevance_reasons || []).some((reason) => reason.startsWith('owned-domain'))) parts.push('owned_domain=true');
    if (implicit) parts.push('implicit_citation=true');
    return parts.join(', ');
}

function estimateEngagement(row: MentionRow): IngestedDocument['engagement'] {
    const text = `${row.title || ''} ${row.snippet || ''}`;
    const numberMatches = text.match(/\b(\d{1,7})\b/g) || [];
    const values = numberMatches
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => b - a);

    return {
        likes: values[0] || 0,
        upvotes: values[1] || 0,
        comments: values[2] || 0,
        shares: values[3] || 0,
    };
}

function toIngestedDocument(row: MentionRow, index: number): IngestedDocument {
    const ts = Date.parse(row.detected_at);
    return {
        docId: safeId(`${row.source}:${row.url}:${index}`),
        source: row.source || 'unknown',
        url: row.url,
        authorId: inferAccountLabel(row.url || '', row.source || 'unknown'),
        timestamp: Number.isFinite(ts) ? ts : Date.now(),
        text: `${row.title || ''}\n\n${row.snippet || ''}`.trim(),
        engagement: estimateEngagement(row),
    };
}

export async function buildEntityInfluenceGraph(
    entityId: string,
    aliases: string[],
    mentions: MentionRow[],
): Promise<EntityInfluenceGraph> {
    const entityNodeId = `entity:${safeId(entityId)}`;
    const normalizedAliases = Array.from(new Set(aliases.map(normalizeAlias).filter(Boolean))).slice(0, 24);

    const entity = await buildEntityFromAliases(entityId, normalizedAliases);
    const docRows = mentions.map((row, index) => ({ row, doc: toIngestedDocument(row, index) }));
    const edgeRows = await Promise.all(docRows.map(async ({ doc }) => processDocument(doc, [entity])));
    const citationEdges = edgeRows.flat();

    const nodes = new Map<string, InfluenceNode>();
    const edges: InfluenceEdge[] = [];
    const paths: InfluencePath[] = [];
    const sourceSet = new Set<string>();
    const edgesByDocId = new Map<string, CitationEdge[]>();

    for (const edge of citationEdges) {
        const list = edgesByDocId.get(edge.docId) || [];
        list.push(edge);
        edgesByDocId.set(edge.docId, list);
    }

    nodes.set(entityNodeId, {
        id: entityNodeId,
        node_type: 'entity',
        label: entityId,
        weight: 1,
    });

    let implicitCitations = 0;

    for (const { row, doc } of docRows) {
        const docEdges = edgesByDocId.get(doc.docId) || [];
        if (docEdges.length === 0) continue;

        const strongestEdge = docEdges
            .slice()
            .sort((a, b) => computeEdgeWeight(b) - computeEdgeWeight(a))[0];

        const score = computeEdgeWeight(strongestEdge);
        const implicitCitation = strongestEdge.type === 'semantic' && strongestEdge.similarity > 0.82;

        const source = row.source || 'unknown';
        sourceSet.add(source);
        const accountLabel = inferAccountLabel(row.url || '', source);
        const accountNodeId = `acct:${safeId(accountLabel)}`;
        const docNodeId = `doc:${safeId(`${source}:${extractHostname(row.url || '')}:${row.url || row.title}`)}`;
        if (implicitCitation) implicitCitations += 1;

        if (!nodes.has(accountNodeId)) {
            const authority = clamp(strongestEdge.sourceAuthority, 0, 1);
            nodes.set(accountNodeId, {
                id: accountNodeId,
                node_type: 'platform_account',
                label: accountLabel,
                source,
                weight: Number((0.4 + authority * 0.6).toFixed(4)),
            });
            edges.push({
                from: entityNodeId,
                to: accountNodeId,
                edge_type: 'reinforces',
                weight: Number((0.35 + authority * 0.65).toFixed(4)),
                evidence: [`source:${source}`],
            });
        }

        nodes.set(docNodeId, {
            id: docNodeId,
            node_type: 'document',
            label: row.title || extractHostname(row.url || '') || 'document',
            source,
            url: row.url,
            weight: Number(score.toFixed(4)),
        });

        edges.push({
            from: accountNodeId,
            to: docNodeId,
            edge_type: implicitCitation ? 'implicit_citation' : 'mentions',
            weight: Number(score.toFixed(4)),
            evidence: row.relevance_reasons || [],
        });

        paths.push({
            path: [entityNodeId, accountNodeId, docNodeId],
            source,
            url: row.url,
            link_type: strongestEdge.type,
            influence_score: Number(score.toFixed(4)),
            confidence: Number(clamp(strongestEdge.confidence, 0, 1).toFixed(4)),
            implicit_citation: implicitCitation,
            explanation: summarizeExplanation(row, implicitCitation, strongestEdge.similarity, strongestEdge.type),
        });
    }

    const aggregation = computeEntityInfluence(citationEdges);
    const sourceCoverage = mentions.length > 0 ? sourceSet.size / Math.min(mentions.length, 19) : 0;
    const influenceScore = Number(clamp(aggregation.normalizedScore, 0, 100).toFixed(3));
    const semanticSignals = citationEdges.filter((edge) => edge.type === 'semantic' || edge.type === 'ai_summary');
    const aiVisibilityScore = Number(clamp(Math.log1p(semanticSignals.length) * 25, 0, 100).toFixed(3));

    const topPaths = paths
        .sort((a, b) => b.influence_score - a.influence_score)
        .slice(0, 12);

    return {
        entity_id: entityId,
        aliases: normalizedAliases,
        nodes: Array.from(nodes.values()),
        edges,
        influence_score: influenceScore,
        ai_visibility_score: aiVisibilityScore,
        cross_platform_coverage: Number((sourceCoverage * 100).toFixed(2)),
        implicit_citation_count: implicitCitations,
        signal_count: citationEdges.length,
        breakdown: {
            direct: Number(aggregation.breakdown.direct.toFixed(4)),
            semantic: Number(aggregation.breakdown.semantic.toFixed(4)),
            paraphrase: Number(aggregation.breakdown.paraphrase.toFixed(4)),
            ai_summary: Number(aggregation.breakdown.ai_summary.toFixed(4)),
        },
        top_paths: topPaths,
        generated_at: new Date().toISOString(),
    };
}
