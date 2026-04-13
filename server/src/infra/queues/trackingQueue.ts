import { Queue } from 'bullmq';
import { getBullMQConnection } from './connection.js';

export interface TrackingJobData {
  runId: string;
  projectId: string;
}

let trackingQueueInstance: Queue<TrackingJobData> | null = null;

export function getTrackingQueue(): Queue<TrackingJobData> | null {
  if (trackingQueueInstance) return trackingQueueInstance;
  const connection = getBullMQConnection();
  if (!connection) return null;

  trackingQueueInstance = new Queue<TrackingJobData>('tracking', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3_000 },
      removeOnComplete: { count: 1000, age: 172_800 },
      removeOnFail: { count: 500, age: 345_600 },
    },
  });

  return trackingQueueInstance;
}

export async function enqueueTrackingRun(data: TrackingJobData): Promise<string> {
  const queue = getTrackingQueue();
  if (!queue) throw new Error('Tracking queue unavailable - Redis not configured');
  const job = await queue.add('run-tracking', data, {
    jobId: `tracking:${data.runId}`,
    priority: 3,
  });
  return String(job.id || data.runId);
}
