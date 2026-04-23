/**
 * WORKER TEMPLATE: Stream-Based Worker with Consumer Groups
 *
 * This template demonstrates the CORRECT pattern for Redis stream-based workers.
 *
 * ✅ DO:
 * - Use StreamConsumerGroup for all stream-based workers
 * - ACK only after successful processing
 * - Send failures to DLQ for analysis
 * - Use unique consumerId per worker instance (scale with process ID)
 *
 * ❌ DON'T:
 * - Use xread(..., "$") — loses all prior events
 * - Use xread(..., "0") — reprocesses entire history on restart
 * - Skip ACK — causes infinite retry loops
 * - Block without timeout — can hang indefinitely
 */

import type { Logger } from 'pino';
import {
  createStreamConsumer,
  type StreamConsumerGroup,
  type StreamMessage,
} from './consumerGroupHelper.js';
import { getRedis } from '../redis.js';

/**
 * Example configuration for a stream-based worker.
 * Adapt this to your specific worker's needs.
 */
interface ExampleWorkerConfig {
  streamKey: string;
  groupName: string;
  logger?: Logger;
}

/**
 * Example worker implementation.
 * 
 * Real workers should:
 * 1. Parse message data
 * 2. Validate against schema
 * 3. Execute business logic
 * 4. ACK on success or send to DLQ on failure
 */
export class ExampleStreamWorker {
  private consumer: StreamConsumerGroup | null = null;
  private isRunning = false;
  private config: ExampleWorkerConfig;
  private consumerId: string;

  constructor(config: ExampleWorkerConfig) {
    this.config = config;
    // Each worker instance gets a unique ID based on hostname + process ID
    this.consumerId = `${require('os').hostname()}-${process.pid}`;
  }

  /**
   * Start the worker loop.
   * Will continuously read and process messages until stopped.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.consumer = await createStreamConsumer({
      streamKey: this.config.streamKey,
      groupName: this.config.groupName,
      consumerId: this.consumerId,
      blockTimeMs: 5000,
      maxBatchSize: 10,
    });

    if (!this.consumer) {
      console.error('[ExampleStreamWorker] Failed to initialize consumer group');
      return;
    }

    this.isRunning = true;
    console.log(`[ExampleStreamWorker] Started (consumer=${this.consumerId})`);

    this.processLoop();
  }

  /**
   * Main processing loop.
   * Continuously reads and processes messages.
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning && this.consumer) {
      try {
        const messages = await this.consumer.readNextBatch();

        if (messages.length === 0) {
          // No messages available, loop will retry after blockTime
          continue;
        }

        console.log(`[ExampleStreamWorker] Processing ${messages.length} message(s)`);

        for (const message of messages) {
          await this.processMessage(message);
        }
      } catch (err: unknown) {
        const e = err as { message?: string };
        console.error(`[ExampleStreamWorker] Loop error: ${e?.message || String(err)}`);
        // Continue loop even on error — don't crash the worker
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Process a single message.
   * This is where your business logic goes.
   */
  private async processMessage(message: StreamMessage): Promise<void> {
    try {
      console.log(`[ExampleStreamWorker] Processing message ${message.id}`);

      // STEP 1: Parse and validate
      const payload = this.parseMessage(message);
      if (!payload) {
        // Invalid message — send to DLQ
        if (this.consumer) {
          await this.consumer.sendToDLQ(message.id, new Error('Invalid payload'));
        }
        return;
      }

      // STEP 2: Execute business logic
      await this.executeLogic(payload);

      // STEP 3: ACK only after success
      if (this.consumer) {
        await this.consumer.acknowledgeMessage(message.id);
      }

      console.log(`[ExampleStreamWorker] ✓ Processed ${message.id}`);
    } catch (err: unknown) {
      // On error: don't ACK, let another worker retry
      // OR send to DLQ after max retries
      console.error(`[ExampleStreamWorker] ✗ Failed to process ${message.id}:`, err);

      if (this.consumer) {
        await this.consumer.sendToDLQ(message.id, err);
      }
    }
  }

  /**
   * Parse incoming message.
   * Adapt schema validation to your needs.
   */
  private parseMessage(message: StreamMessage): Record<string, string> | null {
    try {
      // Example: expect a JSON field
      const dataField = message.data['data'];
      if (!dataField) return null;

      const parsed = JSON.parse(dataField);
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Execute worker business logic.
   * This is where external API calls, DB writes, etc. go.
   */
  private async executeLogic(payload: Record<string, string>): Promise<void> {
    // Replace with your actual business logic
    console.log('[ExampleStreamWorker] Business logic:', payload);

    // Example:
    // - Call external API
    // - Write to database
    // - Emit event to next worker
    // - Update UI via WebSocket
  }

  /**
   * Get worker health status.
   */
  async getStatus(): Promise<Record<string, any>> {
    if (!this.consumer) {
      return { status: 'uninitialized' };
    }

    return {
      status: this.isRunning ? 'running' : 'stopped',
      consumer: this.consumerId,
      stream: this.config.streamKey,
      group: this.config.groupName,
      groupInfo: await this.consumer.getGroupInfo(),
      pending: await this.consumer.getPendingMessages(),
    };
  }

  /**
   * Gracefully stop the worker.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log(`[ExampleStreamWorker] Stopped`);
  }
}

/**
 * Singleton instance (optional pattern).
 */
let instance: ExampleStreamWorker | null = null;

export function getExampleStreamWorker(config: ExampleWorkerConfig): ExampleStreamWorker {
  if (!instance) {
    instance = new ExampleStreamWorker(config);
  }
  return instance;
}

/**
 * Module initialization.
 * Call this from server.ts to start the worker.
 */
export function startExampleStreamWorker(config: ExampleWorkerConfig): void {
  const worker = getExampleStreamWorker(config);
  worker.start().catch((err) => {
    console.error('[startExampleStreamWorker] Failed to start:', err);
  });
}
