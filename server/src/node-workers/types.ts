import type { RawDocumentEngagement } from '../infra/queues/rawDocumentQueue.js';

export interface IngestionSourceRecord {
    url: string;
    source: string;
    html?: string;
    text?: string;
    timestamp?: number;
    engagement?: RawDocumentEngagement;
}
