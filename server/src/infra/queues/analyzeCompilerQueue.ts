import { Queue } from 'bullmq';
import { getBullMQConnection } from './connection.js';

export interface AnalyzeCompilerJobData {
    jobId: string;
}

let analyzeCompilerQueueInstance: Queue<AnalyzeCompilerJobData> | null = null;

export function getAnalyzeCompilerQueue(): Queue<AnalyzeCompilerJobData> | null {
    if (analyzeCompilerQueueInstance) return analyzeCompilerQueueInstance;
    const connection = getBullMQConnection();
    if (!connection) return null;

    analyzeCompilerQueueInstance = new Queue<AnalyzeCompilerJobData>('analyze-compiler', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 3_000 },
            removeOnComplete: { count: 200, age: 86_400 },
            removeOnFail: { count: 200, age: 172_800 },
        },
    });

    return analyzeCompilerQueueInstance;
}

export async function enqueueAnalyzeCompilerJob(data: AnalyzeCompilerJobData): Promise<string> {
    const queue = getAnalyzeCompilerQueue();
    if (!queue) throw new Error('Analyze compiler queue unavailable - Redis not configured');

    const job = await queue.add('compile-pages', data, {
        jobId: `analyze-compiler:${data.jobId}`,
        priority: 2,
    });

    return String(job.id || data.jobId);
}
