/**
 * scanEngine.ts
 *
 * Production-grade event bus for the real-time scan pipeline.
 *
 * Architecture: Single-writer, ordered-event, idempotent commit pipeline.
 *
 *   [ SSE Producers ]
 *       ↓
 *   [ EventBus ]      — buffers chaos, enforces seq ordering
 *       ↓
 *   [ Sequencer ]     — single-writer lock gate, deduplication guard
 *       ↓
 *   [ commitToReducer ] — pure bridge to scanReducer
 *       ↓
 *   [ UI ]            — renders stable truth
 *
 * Guarantees:
 *   - No out-of-order reducer commits (seq sort before flush)
 *   - No duplicate commits (lastSeq hard guard)
 *   - No concurrent mutation per scan (activeLocks)
 *   - Zero cross-session contamination (scanId isolation)
 *   - Safe for multiple parallel scans
 */

import type { CiteEntry, EntityRef } from '../../../shared/types';
import type { Action, ScanResult, ScanStage, LayerScores } from '../machines/scanMachine';
import type React from 'react';

// ── Event schema (immutable + versioned) ──────────────────────────────────────

export type BusEvent =
  | {
      id: string;
      scanId: string;
      seq: number;
      timestamp: number;
      type: 'STAGE_UPDATE';
      stage: ScanStage;
      progress?: number;
      data?: Record<string, unknown>;
      sourceType?: string;
    }
  | { id: string; scanId: string; seq: number; timestamp: number; type: 'CITE_FOUND'; cite: CiteEntry }
  | { id: string; scanId: string; seq: number; timestamp: number; type: 'ENTITY_FOUND'; entity: EntityRef }
  | { id: string; scanId: string; seq: number; timestamp: number; type: 'SCORE_UPDATE'; layer: keyof LayerScores; value: number }
  | { id: string; scanId: string; seq: number; timestamp: number; type: 'SCAN_COMPLETE'; result: ScanResult }
  | { id: string; scanId: string; seq: number; timestamp: number; type: 'SCAN_ERROR'; message: string };

/** Payload shape passed to `ingest()` — id/scanId/seq/timestamp are assigned by the engine. */
export type BusEventPayload = Omit<BusEvent, 'id' | 'scanId' | 'seq' | 'timestamp'>;

// ── Event Bus (buffer layer) ───────────────────────────────────────────────────

/**
 * Collects raw events from any number of producers and enforces seq ordering
 * before handing them to the sequencer.
 *
 * O(1) ingestion. Sort deferred to drain time.
 */
class EventBus {
  private readonly buffer = new Map<string, BusEvent[]>();

  push(event: BusEvent): void {
    const list = this.buffer.get(event.scanId) ?? [];
    list.push(event);
    this.buffer.set(event.scanId, list);
  }

  /** Sort by seq, atomically drain, return ordered batch. */
  drain(scanId: string): BusEvent[] {
    const events = (this.buffer.get(scanId) ?? []).sort((a, b) => a.seq - b.seq);
    this.buffer.set(scanId, []);
    return events;
  }

  clear(scanId: string): void {
    this.buffer.delete(scanId);
  }
}

// ── Sequencer (single-writer lock gate) ───────────────────────────────────────

/**
 * Eliminates:
 *   - concurrent mutation per scan (activeLocks)
 *   - duplicate events (lastSeq dedup guard)
 *   - out-of-order commits (pre-sorted by EventBus.drain)
 */
class Sequencer {
  private readonly activeLocks = new Set<string>();
  private readonly lastSeq = new Map<string, number>();

  reset(scanId: string): void {
    this.lastSeq.delete(scanId);
    this.activeLocks.delete(scanId);
  }

  execute(
    scanId: string,
    events: BusEvent[],
    commit: (event: BusEvent) => void,
  ): void {
    // Reentrance guard: prevents concurrent execution for the same scan
    if (this.activeLocks.has(scanId)) return;
    this.activeLocks.add(scanId);

    try {
      for (const event of events) {
        const last = this.lastSeq.get(scanId) ?? -1;

        // Hard guard: reject duplicates and out-of-order writes
        if (event.seq <= last) continue;

        this.lastSeq.set(scanId, event.seq);
        commit(event);
      }
    } finally {
      // Always release — even if a commit throws
      this.activeLocks.delete(scanId);
    }
  }
}

// ── Commit engine (reducer bridge) ────────────────────────────────────────────

/**
 * Pure bridge from the sequenced event stream to the scan reducer.
 * The reducer never sees chaos — ordering and dedup are guaranteed by
 * the layers above.
 */
function commitToReducer(event: BusEvent, dispatch: React.Dispatch<Action>): void {
  switch (event.type) {
    case 'STAGE_UPDATE':
      dispatch({
        type: 'ADVANCE_STAGE',
        stage: event.stage,
        progress: event.progress,
        timestamp: event.timestamp,
        data: event.data,
        sourceType: event.sourceType,
      });
      break;
    case 'CITE_FOUND':
      dispatch({ type: 'ACCUMULATE_CITE', cite: event.cite });
      break;
    case 'ENTITY_FOUND':
      dispatch({ type: 'ACCUMULATE_ENTITY', entity: event.entity });
      break;
    case 'SCORE_UPDATE':
      dispatch({ type: 'UPDATE_SCORE', layer: event.layer, value: event.value });
      break;
    case 'SCAN_COMPLETE':
      dispatch({ type: 'SCAN_COMPLETE', result: event.result });
      break;
    case 'SCAN_ERROR':
      dispatch({ type: 'SET_ERROR', message: event.message });
      break;
  }
}

// ── Scan Engine (orchestration facade) ────────────────────────────────────────

/**
 * Public API used by ScanContext.
 *
 * Usage:
 *   engine.ingest(scanId, payload)     — assign seq + push to bus
 *   engine.flush(scanId)               — drain → sequence → commit
 *   engine.reset(scanId)               — full teardown for scan session
 */
export class ScanEngine {
  private readonly bus = new EventBus();
  private readonly sequencer = new Sequencer();
  private readonly seqCounter = new Map<string, number>();

  constructor(private readonly dispatch: React.Dispatch<Action>) {}

  /**
   * Assign a monotonic sequence number and push the event to the buffer.
   * Safe to call from any producer at any time — ordering is enforced at flush.
   */
  ingest(scanId: string, payload: BusEventPayload): void {
    const seq = (this.seqCounter.get(scanId) ?? 0) + 1;
    this.seqCounter.set(scanId, seq);
    const event = {
      ...payload,
      id: `${scanId}:${seq}`,
      scanId,
      seq,
      timestamp: Date.now(),
    } as BusEvent;
    this.bus.push(event);
  }

  /**
   * Drain the buffer and commit all ordered, deduplicated events to the reducer.
   * Idempotent — safe to call on an empty buffer.
   */
  flush(scanId: string): void {
    const events = this.bus.drain(scanId);
    this.sequencer.execute(scanId, events, (e) => commitToReducer(e, this.dispatch));
  }

  /** Tear down all per-scan tracking state. */
  reset(scanId: string): void {
    this.bus.clear(scanId);
    this.sequencer.reset(scanId);
    this.seqCounter.delete(scanId);
  }
}
