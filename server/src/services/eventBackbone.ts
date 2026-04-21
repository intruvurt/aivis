import { EventEmitter } from 'events';
import { pushToAll, pushToUser } from './sseHub.js';
import { OBSERVABILITY, SYSTEM_CONFIG } from '../config/runtime.system.config.js';

type BackboneEventName =
    | 'bix.tick.started'
    | 'bix.scan.enqueued'
    | 'bix.error'
    | 'citation.job.started'
    | 'citation.job.completed'
    | 'citation.job.failed'
    | 'citation.ledger.updated'
    | 'heatmap.surface.built';

type BaseBackbonePayload = {
    userId?: string;
    domain?: string;
    source: 'scheduler' | 'citation' | 'heatmap' | 'queue';
    [key: string]: unknown;
};

type BackboneEnvelope = {
    id: string;
    ts: string;
    name: BackboneEventName;
    payload: BaseBackbonePayload;
};

const bus = new EventEmitter();
bus.setMaxListeners(200);

function generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function onBackboneEvent(
    name: BackboneEventName,
    handler: (event: BackboneEnvelope) => void | Promise<void>,
): void {
    bus.on(name, (event: BackboneEnvelope) => {
        void Promise.resolve(handler(event)).catch((err: unknown) => {
            if (OBSERVABILITY.logLevel !== 'silent') {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[event-backbone] handler failed for ${name}: ${msg}`);
            }
        });
    });
}

export function emitBackboneEvent(name: BackboneEventName, payload: BaseBackbonePayload): BackboneEnvelope {
    const envelope: BackboneEnvelope = {
        id: generateEventId(),
        ts: new Date().toISOString(),
        name,
        payload,
    };

    if (SYSTEM_CONFIG.streaming.sseEnabled) {
        const channel = `backbone:${name}`;
        if (payload.userId) {
            pushToUser(payload.userId, channel, envelope);
        }
        pushToAll(channel, envelope);
    }

    if (OBSERVABILITY.trackBixEvents || name.startsWith('citation.') || name.startsWith('heatmap.')) {
        if (OBSERVABILITY.logLevel === 'debug' || OBSERVABILITY.logLevel === 'info') {
            console.log(`[event-backbone] ${name}`, JSON.stringify({
                userId: payload.userId,
                domain: payload.domain,
                source: payload.source,
            }));
        }
    }

    bus.emit(name, envelope);
    return envelope;
}

export function getBackboneListenerCount(name?: BackboneEventName): number {
    if (!name) return bus.eventNames().reduce((acc, eventName) => acc + bus.listenerCount(eventName), 0);
    return bus.listenerCount(name);
}
