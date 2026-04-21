import { ingestSourceRecord } from './ingestPipeline.js';

export async function ingestRedditDocument(params: {
    url: string;
    html?: string;
    text?: string;
    timestamp?: number;
    engagement?: {
        upvotes?: number;
        comments?: number;
        shares?: number;
    };
}): Promise<string> {
    return ingestSourceRecord({
        ...params,
        source: 'reddit',
    });
}
