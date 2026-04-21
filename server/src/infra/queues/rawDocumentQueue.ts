import { Queue } from 'bullmq';
import { getBullMQConnection } from './connection.js';

export interface RawDocumentEngagement {
    likes?: number;
    upvotes?: number;
    comments?: number;
    shares?: number;
}

export interface RawDocumentEvent {
    docId: string;
    url: string;
    source: string;
    text: string;
    engagement?: RawDocumentEngagement;
    timestamp: number;
}

let rawDocumentQueueInstance: Queue<RawDocumentEvent> | null = null;

export function getRawDocumentQueue(): Queue<RawDocumentEvent> | null {
    if (rawDocumentQueueInstance) return rawDocumentQueueInstance;
    const connection = getBullMQConnection();
    if (!connection) return null;

    rawDocumentQueueInstance = new Queue<RawDocumentEvent>('raw-document', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 3_000 },
            removeOnComplete: { count: 1000, age: 172_800 },
            removeOnFail: { count: 500, age: 345_600 },
        },
    });

    return rawDocumentQueueInstance;
}

export async function enqueueRawDocument(data: RawDocumentEvent): Promise<string> {
    const queue = getRawDocumentQueue();
    if (!queue) throw new Error('Raw-document queue unavailable - Redis not configured');

    const job = await queue.add('process-raw-document', data, {
        jobId: `raw-document:${data.docId}`,
        priority: 2,
    });

    return String(job.id || data.docId);
}
