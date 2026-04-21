import { ingestSourceRecord } from './ingestPipeline.js';

export async function ingestSerpDocument(params: {
    url: string;
    html?: string;
    text?: string;
    timestamp?: number;
}): Promise<string> {
    return ingestSourceRecord({
        ...params,
        source: 'serp',
    });
}
