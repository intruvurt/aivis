import { embedText } from './embeddingService.js';

export type CitationLinkType = 'direct' | 'semantic' | 'paraphrase' | 'ai_summary';

export interface IngestedDocument {
    docId: string;
    source: string;
    url: string;
    authorId?: string;
    timestamp: number;
    text: string;
    engagement?: {
        likes?: number;
        upvotes?: number;
        comments?: number;
        shares?: number;
    };
}

export interface Entity {
    entityId: string;
    canonicalName: string;
    aliases: string[];
    centroidVector: number[];
}

export interface Chunk {
    chunkId: string;
    docId: string;
    text: string;
    vector: number[];
}

export interface CitationEdge {
    entityId: string;
    chunkId: string;
    docId: string;
    type: CitationLinkType;
    similarity: number;
    confidence: number;
    sourceAuthority: number;
    engagementScore: number;
    timestamp: number;
}

export interface EntityInfluenceResult {
    rawScore: number;
    normalizedScore: number;
    breakdown: {
        direct: number;
        semantic: number;
        paraphrase: number;
        ai_summary: number;
    };
}

const SOURCE_AUTHORITY: Record<string, number> = {
    wikipedia: 1.0,
    reddit: 0.85,
    hackernews: 0.8,
    stackoverflow: 0.8,
    github: 0.75,
    github_discussions: 0.72,
    google_news: 0.7,
    producthunt: 0.65,
    quora: 0.6,
    devto: 0.55,
    medium: 0.5,
    youtube: 0.5,
    lobsters: 0.45,
    bluesky: 0.35,
    twitter: 0.3,
    mastodon: 0.25,
    lemmy: 0.2,
    ddg_dork: 0.12,
    bing_dork: 0.12,
};

const DEFAULT_SOURCE_AUTHORITY = 0.2;
const MAX_CHUNK_CHARS = 500;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function splitTextIntoSemanticChunks(text: string): string[] {
    const normalized = String(text || '').replace(/\r/g, '').trim();
    if (!normalized) return [];

    const paragraphParts = normalized
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    for (const paragraph of paragraphParts.length > 0 ? paragraphParts : [normalized]) {
        if (paragraph.length <= MAX_CHUNK_CHARS) {
            chunks.push(paragraph);
            continue;
        }

        const sentenceParts = paragraph
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter(Boolean);

        let buffer = '';
        for (const sentence of sentenceParts) {
            const next = buffer ? `${buffer} ${sentence}` : sentence;
            if (next.length > MAX_CHUNK_CHARS) {
                if (buffer) chunks.push(buffer);
                buffer = sentence;
            } else {
                buffer = next;
            }
        }
        if (buffer) chunks.push(buffer);
    }

    return chunks.slice(0, 60);
}

function cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i += 1) {
        const av = a[i] || 0;
        const bv = b[i] || 0;
        dot += av * bv;
        normA += av * av;
        normB += bv * bv;
    }

    if (normA <= 1e-9 || normB <= 1e-9) return 0;
    return clamp(dot / (Math.sqrt(normA) * Math.sqrt(normB)), 0, 1);
}

function explicitMatch(chunk: Chunk, entity: Entity): boolean {
    const text = normalizeText(chunk.text);
    if (!text) return false;

    for (const alias of entity.aliases) {
        const normalizedAlias = normalizeText(alias);
        if (!normalizedAlias) continue;
        if (text.includes(normalizedAlias)) return true;
    }

    return false;
}

function semanticMatch(chunk: Chunk, entity: Entity): number {
    return cosineSimilarity(chunk.vector, entity.centroidVector);
}

function computeConfidence(explicit: boolean, semanticScore: number): number {
    return clamp((explicit ? 0.3 : 0) + semanticScore, 0, 1.3);
}

function detectCitation(chunk: Chunk, entity: Entity): Omit<CitationEdge, 'sourceAuthority' | 'engagementScore' | 'timestamp'> | null {
    const semanticScore = semanticMatch(chunk, entity);
    const explicit = explicitMatch(chunk, entity);
    const confidence = computeConfidence(explicit, semanticScore);

    const type: CitationLinkType | null =
        explicit && semanticScore > 0.6
            ? 'direct'
            : semanticScore > 0.82
                ? 'semantic'
                : semanticScore > 0.75
                    ? 'paraphrase'
                    : null;

    if (!type) return null;

    return {
        entityId: entity.entityId,
        chunkId: chunk.chunkId,
        docId: chunk.docId,
        type,
        similarity: semanticScore,
        confidence,
    };
}

export function detectImplicitCitation(chunk: Chunk, entity: Entity): boolean {
    const sim = semanticMatch(chunk, entity);
    return sim > 0.82 && !explicitMatch(chunk, entity);
}

export function computeSourceAuthority(source: string): number {
    return SOURCE_AUTHORITY[source] ?? DEFAULT_SOURCE_AUTHORITY;
}

export function computeEngagement(engagement?: IngestedDocument['engagement']): number {
    if (!engagement) return 0;
    const likes = Math.max(0, engagement.likes || 0);
    const upvotes = Math.max(0, engagement.upvotes || 0);
    const comments = Math.max(0, engagement.comments || 0);
    const shares = Math.max(0, engagement.shares || 0);
    return likes + upvotes + comments + shares;
}

export function computeEdgeWeight(edge: CitationEdge): number {
    const typeWeight: Record<CitationLinkType, number> = {
        direct: 1.0,
        paraphrase: 0.65,
        semantic: 0.5,
        ai_summary: 0.85,
    };

    const engagement = Math.log1p(Math.max(0, edge.engagementScore || 0)) / 10;
    const recency = Math.exp(-(Date.now() - edge.timestamp) / (1000 * 60 * 60 * 24 * 30));
    const authority = clamp(edge.sourceAuthority, 0, 2);
    const confidence = clamp(edge.confidence, 0, 1.5);

    return typeWeight[edge.type] * authority * confidence * (1 + engagement) * recency;
}

export function computeEntityInfluence(edges: CitationEdge[]): EntityInfluenceResult {
    let total = 0;
    const breakdown = {
        direct: 0,
        semantic: 0,
        paraphrase: 0,
        ai_summary: 0,
    };

    for (const edge of edges) {
        const score = computeEdgeWeight(edge);
        total += score;
        breakdown[edge.type] += score;
    }

    return {
        rawScore: total,
        normalizedScore: Math.log1p(total) * 10,
        breakdown,
    };
}

export async function chunkDocument(doc: IngestedDocument): Promise<Chunk[]> {
    const chunkTexts = splitTextIntoSemanticChunks(doc.text);
    if (chunkTexts.length === 0) return [];

    const chunks = await Promise.all(
        chunkTexts.map(async (chunkText, i) => {
            const embedding = await embedText(chunkText);
            return {
                chunkId: `${doc.docId}:${i}`,
                docId: doc.docId,
                text: chunkText,
                vector: embedding.embedding,
            } satisfies Chunk;
        }),
    );

    return chunks;
}

export async function processDocument(doc: IngestedDocument, entities: Entity[]): Promise<CitationEdge[]> {
    const chunks = await chunkDocument(doc);
    const edges: CitationEdge[] = [];

    for (const chunk of chunks) {
        for (const entity of entities) {
            const citation = detectCitation(chunk, entity);
            if (!citation) continue;

            const implicit = detectImplicitCitation(chunk, entity);
            const edge: CitationEdge = {
                ...citation,
                sourceAuthority: computeSourceAuthority(doc.source),
                engagementScore: computeEngagement(doc.engagement),
                timestamp: doc.timestamp,
            };

            if (implicit) {
                edge.type = 'semantic';
                edge.sourceAuthority *= 1.15;
            }

            edges.push(edge);
        }
    }

    return edges;
}

export async function buildEntityFromAliases(entityId: string, aliases: string[]): Promise<Entity> {
    const usableAliases = Array.from(new Set(aliases.map((alias) => alias.trim()).filter(Boolean))).slice(0, 24);
    const vectorInputs = usableAliases.length > 0 ? usableAliases : [entityId];

    const embeddings = await Promise.all(vectorInputs.map(async (value) => embedText(value)));
    const dimension = embeddings[0]?.embedding.length || 0;
    const centroid = new Array<number>(dimension).fill(0);

    if (dimension > 0) {
        for (const e of embeddings) {
            for (let i = 0; i < dimension; i += 1) {
                centroid[i] += e.embedding[i] || 0;
            }
        }

        for (let i = 0; i < dimension; i += 1) {
            centroid[i] /= embeddings.length;
        }

        const norm = Math.sqrt(centroid.reduce((acc, v) => acc + v * v, 0));
        if (norm > 1e-9) {
            for (let i = 0; i < dimension; i += 1) {
                centroid[i] = centroid[i] / norm;
            }
        }
    }

    return {
        entityId,
        canonicalName: entityId,
        aliases: usableAliases,
        centroidVector: centroid,
    };
}
