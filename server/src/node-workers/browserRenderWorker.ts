import { ingestSourceRecord } from './ingestPipeline.js';

export async function ingestRenderedDocument(params: {
    url: string;
    source: string;
    renderedHtml: string;
    timestamp?: number;
    engagement?: {
        likes?: number;
        upvotes?: number;
        comments?: number;
        shares?: number;
    };
}): Promise<string> {
    return ingestSourceRecord({
        url: params.url,
        source: params.source,
        html: params.renderedHtml,
        timestamp: params.timestamp,
        engagement: params.engagement,
    });
}
