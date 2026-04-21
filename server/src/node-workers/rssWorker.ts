import { ingestSourceRecord } from './ingestPipeline.js';

export async function ingestRssDocument(params: {
    url: string;
    html?: string;
    text?: string;
    timestamp?: number;
}): Promise<string> {
    return ingestSourceRecord({
        ...params,
        source: 'rss',
    });
}
