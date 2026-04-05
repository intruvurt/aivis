import { randomUUID } from 'crypto';
import { getRedis } from '../redis.js';

function redis() {
  const r = getRedis();
  if (!r) throw new Error('Redis is not configured - audit queue requires REDIS_URL or REDIS_HOST');
  return r;
}

export type AuditQueueJobData = {
  url: string;
  userId: string;
  workspaceId?: string;
  priority?: 'high' | 'normal';
};

type StoredJob = {
  id: string;
  state: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  stage: string;
  payload: AuditQueueJobData;
  result?: unknown;
  error?: string;
  hints?: string[];
  createdAt: string;
  updatedAt: string;
};

const HIGH_PRIORITY_QUEUE_KEY = 'queue:audit:pending:high';
const NORMAL_PRIORITY_QUEUE_KEY = 'queue:audit:pending:normal';
const JOB_KEY = (id: string) => `queue:audit:job:${id}`;

export async function enqueueAuditJob(data: AuditQueueJobData): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const job: StoredJob = {
    id,
    state: 'queued',
    progress: 0,
    stage: 'queued',
    payload: data,
    createdAt: now,
    updatedAt: now,
  };
  await redis().set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
  const queueKey = data.priority === 'normal' ? NORMAL_PRIORITY_QUEUE_KEY : HIGH_PRIORITY_QUEUE_KEY;
  await redis().rpush(queueKey, id);
  return id;
}

export async function claimNextAuditJob(): Promise<StoredJob | null> {
  const id = (await redis().lpop(HIGH_PRIORITY_QUEUE_KEY)) ?? (await redis().lpop(NORMAL_PRIORITY_QUEUE_KEY));
  if (!id) return null;
  const raw = await redis().get(JOB_KEY(id));
  if (!raw) return null;
  const job = JSON.parse(raw) as StoredJob;
  job.state = 'running';
  job.stage = 'starting';
  job.updatedAt = new Date().toISOString();
  await redis().set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
  return job;
}

export async function requeueAuditJob(id: string): Promise<void> {
  const raw = await redis().get(JOB_KEY(id));
  if (!raw) return;
  const job = JSON.parse(raw) as StoredJob;
  job.state = 'queued';
  job.stage = 'queued';
  job.updatedAt = new Date().toISOString();
  await redis().set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
  const queueKey = job.payload.priority === 'normal' ? NORMAL_PRIORITY_QUEUE_KEY : HIGH_PRIORITY_QUEUE_KEY;
  await redis().rpush(queueKey, id);
}

export async function updateAuditJobProgress(id: string, stage: string, progress: number, hints?: string[]) {
  const raw = await redis().get(JOB_KEY(id));
  if (!raw) return;
  const job = JSON.parse(raw) as StoredJob;
  job.stage = stage;
  job.progress = Math.max(0, Math.min(100, progress));
  if (Array.isArray(hints) && hints.length > 0) {
    job.hints = hints.slice(0, 4);
  }
  job.updatedAt = new Date().toISOString();
  await redis().set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
}

export async function completeAuditJob(id: string, result: unknown) {
  const raw = await redis().get(JOB_KEY(id));
  if (!raw) return;
  const job = JSON.parse(raw) as StoredJob;
  job.state = 'completed';
  job.stage = 'completed';
  job.progress = 100;
  job.result = result;
  job.updatedAt = new Date().toISOString();
  await redis().set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
}

export async function failAuditJob(id: string, error: string) {
  const raw = await redis().get(JOB_KEY(id));
  if (!raw) return;
  const job = JSON.parse(raw) as StoredJob;
  job.state = 'failed';
  job.stage = 'failed';
  job.error = error;
  job.updatedAt = new Date().toISOString();
  await redis().set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
}

export async function getAuditJob(id: string): Promise<StoredJob | null> {
  const raw = await redis().get(JOB_KEY(id));
  return raw ? (JSON.parse(raw) as StoredJob) : null;
}
