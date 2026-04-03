/**
 * BullMQ PR Queue — creates GitHub pull requests from generated fixes.
 * Runs after the fix worker produces a patch.
 */
import { Queue } from 'bullmq';
import { getBullMQConnection } from './connection.js';

export interface PRJobData {
  fixId: string;
  projectId: string;
  orgId: string;
  userId: string;
  repoOwner: string;
  repoName: string;
  installationId: number;
  baseBranch: string;
  files: Array<{ path: string; content: string; justification: string }>;
  title: string;
  body: string;
}

let prQueueInstance: Queue<PRJobData> | null = null;

export function getPRQueue(): Queue<PRJobData> | null {
  if (prQueueInstance) return prQueueInstance;
  const connection = getBullMQConnection();
  if (!connection) return null;
  prQueueInstance = new Queue<PRJobData>('pr', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 300, age: 86_400 },
      removeOnFail: { count: 100, age: 172_800 },
    },
  });
  return prQueueInstance;
}

export async function enqueuePRJob(data: PRJobData): Promise<string> {
  const queue = getPRQueue();
  if (!queue) throw new Error('PR queue unavailable — Redis not configured');
  const job = await queue.add('create-pr', data, { priority: 1 });
  return job.id!;
}
