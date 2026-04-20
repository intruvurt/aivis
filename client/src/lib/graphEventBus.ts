/**
 * graphEventBus.ts
 *
 * Zero-dependency event bus bridging the SSE pipeline → replayStore → WebGL
 * graph renderer without going through React reconciliation.
 *
 * Event flow:
 *   SSE arrives → AnalyzePage.setProgress()
 *     → AnalyzeCognitionView passes `step` prop down
 *       → CognitionOverlay effect calls graphEventBus.emit('step', stepKey)
 *         → bus listeners push incremental CommitNode to replayStore
 *           → WebGL rAF loop reads updated sim via props on next frame
 *
 * Why outside React:
 *   The WebGL rAF loop reads state via refs every ~16 ms regardless of renders.
 *   Routing commits through this bus keeps the hot path synchronous and
 *   avoids scheduling delays from React batching.
 *
 * Usage:
 *   import { graphEventBus } from '@/lib/graphEventBus';
 *   graphEventBus.on('step', handler);
 *   graphEventBus.emit('step', 'ai1');
 *   graphEventBus.off('step', handler);
 */

type EventMap = {
    /** A new pipeline step key arrived from SSE (e.g. "dns", "ai1", "compile") */
    step: string;
    /** Scan completed — full AnalysisResponse available */
    complete: unknown;
    /** Graph node patch: a single node to add/update in the live graph */
    nodePatch: NodePatch;
    /** Reset all graph state for a new scan */
    reset: void;
};

export type NodePatch = {
    op: 'add' | 'update' | 'remove';
    nodeId: string;
    /** Present for add/update */
    label?: string;
    type?: string;
    confidence?: number;
    status?: string;
};

type Handler<T> = (payload: T) => void;
type AnyHandler = Handler<any>;

class GraphEventBus {
    private listeners = new Map<keyof EventMap, Set<AnyHandler>>();

    on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(handler as AnyHandler);
        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
        this.listeners.get(event)?.delete(handler as AnyHandler);
    }

    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
        const set = this.listeners.get(event);
        if (!set || set.size === 0) return;
        // Synchronous dispatch — no setTimeout, no microtask boundary
        for (const h of set) {
            try { h(payload); } catch (err) {
                console.error(`[graphEventBus] Handler error for "${event}":`, err);
            }
        }
    }

    /** Remove all listeners (call on scan reset) */
    clear(): void {
        this.listeners.clear();
    }
}

/** Singleton bus — shared by AnalyzeCognitionView + CognitionOverlay + any future consumer */
export const graphEventBus = new GraphEventBus();
