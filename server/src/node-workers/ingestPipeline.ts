import { createHash } from 'crypto';
import { enqueueRawDocument, type RawDocumentEvent } from '../infra/queues/rawDocumentQueue.js';
import { normalizeUrl } from './urlNormalizer.js';
import type { IngestionSourceRecord } from './types.js';

function stripHtml(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildDocId(url: string, source: string, timestamp: number): string {
    const digest = createHash('sha256').update(`${source}:${url}:${timestamp}`).digest('hex');
    return digest.slice(0, 24);
}

export function toRawDocumentEvent(input: IngestionSourceRecord): RawDocumentEvent {
    const normalizedUrl = normalizeUrl(input.url);
    const timestamp = input.timestamp || Date.now();
    const extractedText = (input.text || '').trim() || stripHtml(input.html || '');

    if (!extractedText) {
        throw new Error(`No extractable text found for ${normalizedUrl}`);
    }

    return {
        docId: buildDocId(normalizedUrl, input.source, timestamp),
        url: normalizedUrl,
        source: input.source,
        text: extractedText,
        engagement: input.engagement,
        timestamp,
    };
}

export async function ingestSourceRecord(input: IngestionSourceRecord): Promise<string> {
    const event = toRawDocumentEvent(input);
    return enqueueRawDocument(event);
}
