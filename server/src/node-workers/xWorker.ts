import { ingestSourceRecord } from './ingestPipeline.js';

export async function ingestXDocument(params: {
    url: string;
    html?: string;
    text?: string;
    timestamp?: number;
    engagement?: {
        likes?: number;
        comments?: number;
        shares?: number;
    };
}): Promise<string> {
    return ingestSourceRecord({
        ...params,
        source: 'x',
    });
}
