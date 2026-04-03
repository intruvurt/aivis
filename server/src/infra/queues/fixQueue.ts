/**
 * BullMQ Fix Queue — processes automated fix generation for audit issues.
 * Fix → Generate Patch → Enqueue PR → GitHub service → PR created.
 */
import { Queue } from 'bullmq';
import { getBullMQConnection } from './connection.js';

export interface FixJobData {
  issueId: string;
  projectId: string;
  orgId: string;
  userId: string;
  expectedDelta: number;
}

let fixQueueInstance: Queue<FixJobData> | null = null;

export function getFixQueue(): Queue<FixJobData> | null {
  if (fixQueueInstance) return fixQueueInstance;
  const connection = getBullMQConnection();
  if (!connection) return null;
  fixQueueInstance = new Queue<FixJobData>('fix', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 500, age: 86_400 },
      removeOnFail: { count: 200, age: 172_800 },
    },
  });
  return fixQueueInstance;
}

export async function enqueueFixJob(data: FixJobData): Promise<string> {
  const queue = getFixQueue();
  if (!queue) throw new Error('Fix queue unavailable — Redis not configured');
  const job = await queue.add('generate-fix', data, { priority: 2 });
  return job.id!;
}
