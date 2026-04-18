import { createHash } from 'crypto';

export interface EmbeddingResult {
    embedding: number[];
    model: string;
    provider: 'openai' | 'openrouter' | 'local-fallback';
    dimensions: number;
    fromFallback?: boolean;
}

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '';

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENROUTER_EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';

function isFiniteVector(value: unknown): value is number[] {
    return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function buildFallbackEmbedding(text: string, dimensions = 1536): number[] {
    const tokens = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const vector = new Array<number>(dimensions).fill(0);
    if (tokens.length === 0) return vector;

    for (const token of tokens) {
        const digest = createHash('sha256').update(token).digest();
        for (let i = 0; i < digest.length; i += 1) {
            const bucket = digest[i] % dimensions;
            const signedSignal = digest[(i + 11) % digest.length] % 2 === 0 ? 1 : -1;
            vector[bucket] += signedSignal * ((digest[i] / 255) + 0.1);
        }
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm <= 1e-9) return vector;
    return vector.map((value) => Number((value / norm).toFixed(6)));
}

async function embedViaOpenAI(text: string): Promise<EmbeddingResult> {
    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
            model: OPENAI_EMBEDDING_MODEL,
            input: text,
        }),
        signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
        const message = await response.text().catch(() => 'Failed to read error body');
        throw new Error(`OpenAI embeddings failed (${response.status}): ${message.slice(0, 240)}`);
    }

    const json = await response.json() as { data?: Array<{ embedding?: unknown }>; model?: string };
    const embedding = json?.data?.[0]?.embedding;
    if (!isFiniteVector(embedding)) {
        throw new Error('OpenAI embeddings response did not include a valid embedding vector');
    }

    return {
        embedding,
        model: String(json.model || OPENAI_EMBEDDING_MODEL),
        provider: 'openai',
        dimensions: embedding.length,
    };
}

async function embedViaOpenRouter(text: string): Promise<EmbeddingResult> {
    const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            'HTTP-Referer': process.env.FRONTEND_URL || 'https://aivis.biz',
            'X-Title': 'AiVIS EntityOS',
        },
        body: JSON.stringify({
            model: OPENROUTER_EMBEDDING_MODEL,
            input: text,
        }),
        signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
        const message = await response.text().catch(() => 'Failed to read error body');
        throw new Error(`OpenRouter embeddings failed (${response.status}): ${message.slice(0, 240)}`);
    }

    const json = await response.json() as { data?: Array<{ embedding?: unknown }>; model?: string };
    const embedding = json?.data?.[0]?.embedding;
    if (!isFiniteVector(embedding)) {
        throw new Error('OpenRouter embeddings response did not include a valid embedding vector');
    }

    return {
        embedding,
        model: String(json.model || OPENROUTER_EMBEDDING_MODEL),
        provider: 'openrouter',
        dimensions: embedding.length,
    };
}

/**
 * Primary embedding API used by Entity OS.
 * Preference order:
 * 1) OPENAI_API_KEY
 * 2) OPENROUTER_API_KEY / OPEN_ROUTER_API_KEY
 * 3) deterministic fallback embedding (keeps pipeline online)
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
        return {
            embedding: buildFallbackEmbedding('empty-text'),
            model: 'local-hash-v1',
            provider: 'local-fallback',
            dimensions: 1536,
            fromFallback: true,
        };
    }

    if (OPENAI_KEY) {
        try {
            return await embedViaOpenAI(trimmed);
        } catch (err) {
            console.warn('[EmbeddingService] OpenAI embedding failed, attempting fallback provider:', (err as Error).message);
        }
    }

    if (OPENROUTER_KEY) {
        try {
            return await embedViaOpenRouter(trimmed);
        } catch (err) {
            console.warn('[EmbeddingService] OpenRouter embedding failed, using local fallback:', (err as Error).message);
        }
    }

    return {
        embedding: buildFallbackEmbedding(trimmed),
        model: 'local-hash-v1',
        provider: 'local-fallback',
        dimensions: 1536,
        fromFallback: true,
    };
}
