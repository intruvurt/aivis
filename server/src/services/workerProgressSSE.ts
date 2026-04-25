/**
 * workerProgressSSE.ts
 *
 * Server-Sent Events (SSE) integration for real-time worker progress tracking.
 *
 * Allows UI to:
 * - See live worker status (running, processing, paused)
 * - Monitor message throughput
 * - Track pending messages and dead-letter queue size
 * - Detect worker crashes/hangs
 *
 * USAGE IN ROUTES:
 *   app.get('/api/workers/:workerId/progress', workerProgressSSE);
 *
 * USAGE IN UI:
 *   const eventSource = new EventSource('/api/workers/scan-worker-1/progress');
 *   eventSource.addEventListener('status', (e) => {
 *     const status = JSON.parse(e.data);
 *     console.log('Worker status:', status);
 *   });
 *   eventSource.addEventListener('message', (e) => {
 *     const count = JSON.parse(e.data);
 *     console.log('Messages processed:', count);
 *   });
 */

import type { Response } from 'express';
import type { StreamConsumerGroup } from '../infra/streams/consumerGroupHelper.js';
import { getRedis } from '../infra/redis.js';

export interface WorkerProgressMetrics {
  workerId: string;
  streamKey: string;
  groupName: string;
  status: 'running' | 'stopped' | 'error';
  messagesProcessed: number;
  messagesFailed: number;
  pendingMessages: number;
  dlqSize: number;
  lastUpdateAt: number;
  uptime: number;
}

/**
 * Manager for tracking worker progress across multiple workers.
 * Stores metrics in Redis for distributed access.
 */
export class WorkerProgressTracker {
  private redis = getRedis();
  private metrics: Map<string, WorkerProgressMetrics> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private syncInFlight = false;

  /**
   * Register a worker and start tracking its progress.
   */
  registerWorker(
    workerId: string,
    streamKey: string,
    groupName: string,
  ): void {
    const key = `worker:progress:${workerId}`;
    const initialMetrics: WorkerProgressMetrics = {
      workerId,
      streamKey,
      groupName,
      status: 'running',
      messagesProcessed: 0,
      messagesFailed: 0,
      pendingMessages: 0,
      dlqSize: 0,
      lastUpdateAt: Date.now(),
      uptime: 0,
    };

    this.metrics.set(workerId, initialMetrics);

    // Persist to Redis
    if (this.redis) {
      this.redis.hset(key, [
        'status',
        'running',
        'registered_at',
        String(Date.now()),
      ]).catch(() => {});
    }

    console.log(`[WorkerProgressTracker] Registered worker: ${workerId}`);
  }

  /**
   * Update worker metrics.
   * Called periodically by the worker during operation.
   */
  updateMetrics(
    workerId: string,
    updates: Partial<WorkerProgressMetrics>,
  ): void {
    const current = this.metrics.get(workerId);
    if (!current) return;

    const updated = { ...current, ...updates, lastUpdateAt: Date.now() };
    this.metrics.set(workerId, updated);

    // Persist to Redis
    if (this.redis) {
      const key = `worker:progress:${workerId}`;
      this.redis.hset(key, [
        'status',
        updated.status,
        'messagesProcessed',
        String(updated.messagesProcessed),
        'messagesFailed',
        String(updated.messagesFailed),
        'pendingMessages',
        String(updated.pendingMessages),
        'dlqSize',
        String(updated.dlqSize),
        'lastUpdateAt',
        String(updated.lastUpdateAt),
      ]).catch(() => {});
    }
  }

  /**
   * Increment processed message counter.
   */
  incrementProcessed(workerId: string): void {
    const current = this.metrics.get(workerId);
    if (current) {
      this.updateMetrics(workerId, {
        messagesProcessed: current.messagesProcessed + 1,
      });
    }
  }

  /**
   * Increment failed message counter.
   */
  incrementFailed(workerId: string): void {
    const current = this.metrics.get(workerId);
    if (current) {
      this.updateMetrics(workerId, {
        messagesFailed: current.messagesFailed + 1,
      });
    }
  }

  /**
   * Get current metrics for a worker.
   */
  getMetrics(workerId: string): WorkerProgressMetrics | undefined {
    return this.metrics.get(workerId);
  }

  /**
   * Get all registered workers.
   */
  getAllMetrics(): WorkerProgressMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Update pending and DLQ counts from Redis.
   */
  async syncMetricsFromRedis(workerId: string): Promise<void> {
    const current = this.metrics.get(workerId);
    if (!current || !this.redis) return;

    try {
      // Get pending messages from consumer group
      const pending = await this.redis.xpending(
        current.streamKey,
        current.groupName,
        '-',
        '+',
        1000,
      );
      const pendingCount = Array.isArray(pending) ? pending.length : 0;

      // Get DLQ size
      const dlqSize = await this.redis.xlen(`${current.streamKey}:dlq`);

      this.updateMetrics(workerId, {
        pendingMessages: pendingCount,
        dlqSize: Number(dlqSize) || 0,
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.warn(
        `[WorkerProgressTracker] Failed to sync metrics for ${workerId}: ${e?.message || String(err)}`,
      );
    }
  }

  /**
   * Start periodic metric syncing from Redis.
   */
  startSync(intervalMs: number = 5000): void {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(async () => {
      if (this.syncInFlight) return;
      this.syncInFlight = true;
      const allWorkers = this.getAllMetrics();
      try {
        for (const worker of allWorkers) {
          await this.syncMetricsFromRedis(worker.workerId);
        }
      } finally {
        this.syncInFlight = false;
      }
    }, intervalMs);

    if (typeof this.updateInterval === 'object' && 'unref' in this.updateInterval) {
      this.updateInterval.unref();
    }

    console.log('[WorkerProgressTracker] Started metric sync loop');
  }

  /**
   * Stop periodic metric syncing.
   */
  stopSync(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('[WorkerProgressTracker] Stopped metric sync loop');
    }
  }
}

/**
 * Global singleton instance.
 */
let trackerInstance: WorkerProgressTracker | null = null;

export function getProgressTracker(): WorkerProgressTracker {
  if (!trackerInstance) {
    trackerInstance = new WorkerProgressTracker();
  }
  return trackerInstance;
}

/**
 * SSE endpoint handler for worker progress.
 *
 * USAGE:
 *   app.get('/api/workers/:workerId/progress', (req, res) => {
 *     sendWorkerProgressSSE(req, res, req.params.workerId);
 *   });
 *
 * CLIENT USAGE:
 *   const es = new EventSource('/api/workers/scan-worker-1/progress');
 *   es.addEventListener('status', (e) => {
 *     const metrics = JSON.parse(e.data);
 *     updateUI(metrics);
 *   });
 */
export function sendWorkerProgressSSE(
  _req: any,
  res: Response,
  workerId: string,
): void {
  const tracker = getProgressTracker();

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial metrics
  const initialMetrics = tracker.getMetrics(workerId);
  if (initialMetrics) {
    res.write(`data: ${JSON.stringify(initialMetrics)}\n\n`);
  }

  // Send periodic updates
  const updateInterval = setInterval(() => {
    const current = tracker.getMetrics(workerId);
    if (current) {
      res.write(`data: ${JSON.stringify(current)}\n\n`);
    }
  }, 2000);

  // Cleanup on client disconnect
  res.on('close', () => {
    clearInterval(updateInterval);
    res.end();
  });

  // Handle errors
  res.on('error', () => {
    clearInterval(updateInterval);
    res.end();
  });
}

/**
 * Batch endpoint: get all worker progress at once (non-streaming).
 *
 * USAGE:
 *   app.get('/api/workers/progress/all', (_req, res) => {
 *     getAllWorkerProgress(res);
 *   });
 */
export function getAllWorkerProgress(_req: any, res: Response): void {
  const tracker = getProgressTracker();
  const allMetrics = tracker.getAllMetrics();

  res.json({
    timestamp: Date.now(),
    workers: allMetrics,
    count: allMetrics.length,
  });
}
