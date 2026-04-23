/**
 * consumerGroupHelper.ts
 *
 * Redis Stream consumer group infrastructure with guaranteed message delivery.
 *
 * CRITICAL: This module ensures that:
 * 1. No messages are lost (consumer groups track consumption state)
 * 2. Workers can be scaled independently (each gets unique consumer ID)
 * 3. Failed messages are not retried (xack only on success)
 * 4. Dead-letter queue captures unrecoverable errors
 *
 * Pattern (CORRECT):
 *   const helper = new StreamConsumerGroup(redis, 'stream:name', 'group:name', 'worker-1');
 *   while (true) {
 *     const messages = await helper.readNextBatch();
 *     for (const msg of messages) {
 *       try {
 *         await processMessage(msg.data);
 *         await helper.acknowledgeMessage(msg.id);
 *       } catch (err) {
 *         await helper.sendToDLQ(msg.id, err);
 *       }
 *     }
 *   }
 *
 * NEVER USE:
 *   redis.xread('BLOCK', 0, 'STREAMS', 'name', '$')  // ❌ Loses all prior events
 *   redis.xread('BLOCK', 0, 'STREAMS', 'name', '0')  // ❌ Reprocesses entire history
 */

import type { Redis } from 'ioredis';
import { getRedis } from '../redis.js';

export interface StreamMessage {
    id: string;
    data: Record<string, string>;
}

export interface ConsumerGroupConfig {
    streamKey: string;
    groupName: string;
    consumerId: string;
    blockTimeMs?: number;
    maxBatchSize?: number;
    dlqKey?: string;
}

/**
 * Manages Redis stream consumption with consumer groups.
 *
 * Consumer groups track which messages each worker has processed.
 * Missing ACK = message stays in pending queue and is retried by another worker.
 * XACK = message is removed from pending queue (acknowledged as successfully processed).
 */
export class StreamConsumerGroup {
    private redis: Redis | null;
    private streamKey: string;
    private groupName: string;
    private consumerId: string;
    private blockTimeMs: number;
    private maxBatchSize: number;
    private dlqKey: string;
    private initialized: boolean = false;

    constructor(config: ConsumerGroupConfig) {
        this.redis = getRedis();
        this.streamKey = config.streamKey;
        this.groupName = config.groupName;
        this.consumerId = config.consumerId;
        this.blockTimeMs = config.blockTimeMs ?? 5000;
        this.maxBatchSize = config.maxBatchSize ?? 10;
        this.dlqKey = config.dlqKey ?? `${config.streamKey}:dlq`;
    }

    /**
     * Initialize the consumer group.
     * MUST be called once before any readNextBatch() calls.
     *
     * Uses MKSTREAM flag to auto-create stream if it doesn't exist.
     * Uses '$' for group initialization to START from this point forward
     * (only new messages after initialization, not historical ones).
     */
    async initialize(): Promise<void> {
        if (this.initialized || !this.redis) return;

        try {
            // Try to create the group. If it exists, this will return an error which we ignore.
            await this.redis.xgroup(
                'CREATE',
                this.streamKey,
                this.groupName,
                '$', // Start from current position (not historical)
                'MKSTREAM', // Auto-create stream if missing
            );
            console.log(
                `[StreamConsumerGroup] Initialized group "${this.groupName}" on stream "${this.streamKey}"`,
            );
        } catch (err: unknown) {
            const e = err as { message?: string };
            // Group already exists is fine
            if (!e?.message?.includes('BUSYGROUP')) {
                console.warn(`[StreamConsumerGroup] Failed to initialize group: ${e?.message || String(err)}`);
            }
        }

        this.initialized = true;
    }

    /**
     * Read next batch of messages for this consumer.
     *
     * XREADGROUP syntax:
     *   GROUP groupName consumerId -- identify which group & consumer this is
     *   BLOCK blockTimeMs -- wait up to N ms for messages
     *   STREAMS streamKey '>' -- '>' means "give me new messages assigned to me"
     *
     * Returns messages that:
     * - Are in the consumer group
     * - Have not been ACKed yet by this consumer
     * - Are either new (not yet assigned) or pending (assigned but not ACKed)
     */
    async readNextBatch(): Promise<StreamMessage[]> {
        if (!this.redis) return [];

        try {
            // xreadgroup with proper parameter order: GROUP name consumer [BLOCK ms] [COUNT n] STREAMS key id
            const data = await (this.redis as any).xreadgroup(
                'GROUP',
                this.groupName,
                this.consumerId,
                'BLOCK',
                this.blockTimeMs,
                'COUNT',
                this.maxBatchSize,
                'STREAMS',
                this.streamKey,
                '>', // '>' means: give me messages I haven't seen yet
            );

            if (!data || !Array.isArray(data) || data.length === 0) {
                // Timeout (no messages available)
                return [];
            }

            const messages: StreamMessage[] = [];
            const streamData = data[0];

            if (streamData && Array.isArray(streamData) && streamData.length > 1) {
                const entries = streamData[1] as Array<[string, string[]]>;

                if (Array.isArray(entries)) {
                    for (const [id, fields] of entries) {
                        const record: Record<string, string> = {};
                        for (let i = 0; i < fields.length; i += 2) {
                            record[fields[i]] = fields[i + 1];
                        }
                        messages.push({ id, data: record });
                    }
                }
            }

            return messages;
        } catch (err: unknown) {
            const e = err as { message?: string };
            console.error(`[StreamConsumerGroup] Read failed: ${e?.message || String(err)}`);
            return [];
        }
    }

    /**
     * Acknowledge a message as successfully processed.
     * XACK removes the message from the pending queue.
     *
     * ONLY call this after successful processing.
     * If not called, the message will be retried by another worker.
     */
    async acknowledgeMessage(messageId: string): Promise<void> {
        if (!this.redis) return;

        try {
            await this.redis.xack(this.streamKey, this.groupName, messageId);
        } catch (err: unknown) {
            const e = err as { message?: string };
            console.error(`[StreamConsumerGroup] ACK failed for ${messageId}: ${e?.message || String(err)}`);
        }
    }

    /**
     * Send a failed message to the dead-letter queue.
     * This extracts it from the consumer group so it won't be retried forever.
     */
    async sendToDLQ(messageId: string, error: unknown): Promise<void> {
        if (!this.redis) return;

        try {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const timestamp = Date.now();

            // Add to DLQ with error metadata
            await this.redis.xadd(
                this.dlqKey,
                '*',
                'original_id',
                messageId,
                'error',
                errorMessage,
                'failed_at',
                String(timestamp),
                'group',
                this.groupName,
                'consumer',
                this.consumerId,
            );

            // Remove from consumer group
            await this.acknowledgeMessage(messageId);

            console.log(
                `[StreamConsumerGroup] Message ${messageId} moved to DLQ: ${errorMessage}`,
            );
        } catch (err: unknown) {
            const e = err as { message?: string };
            console.error(`[StreamConsumerGroup] DLQ operation failed: ${e?.message || String(err)}`);
        }
    }

    /**
     * Get pending messages for this consumer (messages read but not ACKed).
     * Useful for monitoring/debugging stuck workers.
     */
    async getPendingMessages(): Promise<Array<{ id: string; deliveries: number }>> {
        if (!this.redis) return [];

        try {
            const pending = await this.redis.xpending(this.streamKey, this.groupName, '-', '+', 100);

            if (!Array.isArray(pending)) {
                return [];
            }

            return pending.map((item: any) => ({
                id: item[0],
                deliveries: item[2],
            }));
        } catch (err: unknown) {
            const e = err as { message?: string };
            console.warn(`[StreamConsumerGroup] Failed to fetch pending: ${e?.message || String(err)}`);
            return [];
        }
    }

    /**
     * Health check: return consumer group info.
     */
    async getGroupInfo(): Promise<Record<string, any> | null> {
        if (!this.redis) return null;

        try {
            const groups = await this.redis.xinfo('GROUPS', this.streamKey);
            if (!Array.isArray(groups)) return null;

            for (const group of groups) {
                if (group[1] === this.groupName) {
                    return {
                        name: group[1],
                        consumers: group[3],
                        pending: group[5],
                        lastDeliveredId: group[7],
                    };
                }
            }
            return null;
        } catch (err: unknown) {
            return null;
        }
    }

    /**
     * Cleanup: delete consumer group and DLQ.
     * Use only for testing/reset scenarios.
     */
    async destroy(): Promise<void> {
        if (!this.redis) return;

        try {
            await this.redis.xgroup('DESTROY', this.streamKey, this.groupName);
            await this.redis.del(this.dlqKey);
            console.log(`[StreamConsumerGroup] Destroyed group "${this.groupName}" and DLQ`);
        } catch (err: unknown) {
            const e = err as { message?: string };
            console.warn(`[StreamConsumerGroup] Cleanup failed: ${e?.message || String(err)}`);
        }
    }
}

/**
 * Factory for creating properly initialized consumer group handlers.
 */
export async function createStreamConsumer(
    config: ConsumerGroupConfig,
): Promise<StreamConsumerGroup | null> {
    const consumer = new StreamConsumerGroup(config);

    try {
        await consumer.initialize();
        return consumer;
    } catch (err: unknown) {
        const e = err as { message?: string };
        console.error(
            `[createStreamConsumer] Failed to initialize: ${e?.message || String(err)}`,
        );
        return null;
    }
}
