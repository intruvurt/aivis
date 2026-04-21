/**
 * ScanContext.tsx
 *
 * Single source of truth for the scan surface.
 * Provides state + dispatch to every component in the scan tree.
 *
 * SSE events are never committed directly to the reducer.
 * All ingestion routes through ScanEngine:
 *   SSE → engine.ingest() → EventBus → Sequencer → commitToReducer → reducer
 *
 * This eliminates:
 *   - race conditions from out-of-order network events
 *   - duplicate commits during burst SSE delivery
 *   - UI desync from concurrent async writes
 */

import { createContext, useContext, useReducer, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { scanReducer } from '../machines/scanMachine';
import type { AppState, Action, ScanResult, LayerScores, ScanStage } from '../machines/scanMachine';
import { ScanEngine } from '../services/scanEngine';
import { API_URL } from '../config';
import { normalizePublicUrlInput } from '../utils/targetKey';
import type {
  CiteEntry,
  EntityRef,
  ScanSummary,
  PipelineScanStage,
  ScanEvent,
} from '../../../shared/types';
import { useDebugStore } from '../stores/debugStore';

const PIPELINE_STAGE_MAP: Record<PipelineScanStage, ScanStage | null> = {
  ingesting: 'ingesting',
  chunking: 'chunking',
  embedding: 'embedding',
  entity_resolving: 'entity_resolving',
  edge_building: 'edge_building',
  scoring: 'scoring',
  complete: null,
  error: null,
};

function mapLegacyEventToStage(type: string): ScanStage | null {
  switch (type) {
    case 'SCAN_STARTED':
    case 'HTML_FETCHED':
      return 'ingesting';
    case 'DOM_PARSED':
      return 'chunking';
    case 'CITE_FOUND':
      return 'embedding';
    case 'ENTITY_EXTRACTED':
      return 'entity_resolving';
    case 'INTERPRETATION':
      return 'edge_building';
    case 'SCORE_UPDATED':
      return 'scoring';
    default:
      return null;
  }
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface ScanContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  startScan: (rawUrl: string) => void;
  reset: () => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(scanReducer, { phase: 'IDLE' });

  // Lazy-init the engine once; dispatch is stable across renders
  const engineRef = useRef<ScanEngine | null>(null);
  function getEngine(): ScanEngine {
    if (!engineRef.current) engineRef.current = new ScanEngine(dispatch);
    return engineRef.current;
  }

  // EventSource handle
  const esRef = useRef<EventSource | null>(null);

  // Per-scan UUID — isolates multi-scan sessions in the engine
  const scanIdRef = useRef<string>('');

  /**
   * Synchronous accumulation ref — updated directly in the SSE handler
   * before ingest, so the final ScanResult always reflects complete state
   * regardless of React's batched render cycle.
   */
  const accumulatedRef = useRef<{
    cites: CiteEntry[];
    entities: EntityRef[];
    scores: Partial<LayerScores>;
  }>({ cites: [], entities: [], scores: {} });

  /**
   * Schedule a non-blocking flush via requestIdleCallback (with setTimeout
   * fallback for environments that don't support rIC — e.g. older Safari).
   * Natural micro-batching: the first idle tick drains everything accumulated
   * since the last flush; subsequent ticks for the same burst are no-ops.
   */
  const scheduleFlush = useCallback((scanId: string) => {
    const flush = () => getEngine().flush(scanId);
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(flush);
    } else {
      setTimeout(flush, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScan = useCallback(
    (rawUrl: string) => {
      const url = normalizePublicUrlInput(rawUrl.trim());
      if (!url) return;

      // Tear down any in-flight stream
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      // New scan session — assign fresh UUID and reset engine + accumulator
      const scanId = crypto.randomUUID();
      scanIdRef.current = scanId;
      const sid = scanId;
      getEngine().reset(scanId);
      accumulatedRef.current = { cites: [], entities: [], scores: {} };

      // Shadow-projection: tell the debug store which scan is active
      const debugTap = useDebugStore.getState();
      debugTap.setScanId(scanId);

      dispatch({ type: 'START_SCAN', url });

      const source = new EventSource(
        `${API_URL}/api/analyze/stream?url=${encodeURIComponent(url)}`
      );
      esRef.current = source;
      let terminalEventReceived = false;

      const closeStream = () => {
        source.close();
        if (esRef.current === source) {
          esRef.current = null;
        }
      };

      let sseSeq = 0;

      source.onmessage = (evt) => {
        try {
          if (esRef.current !== source) return;

          const raw = JSON.parse(evt.data) as ScanEvent & { [key: string]: unknown };
          const engine = getEngine();
          const tap = useDebugStore.getState();
          const currentSeq = ++sseSeq;

          if (raw.type === 'PIPELINE_STAGE') {
            const mapped = PIPELINE_STAGE_MAP[raw.stage];
            if (mapped) {
              engine.ingest(sid, {
                type: 'STAGE_UPDATE',
                stage: mapped,
                progress: raw.progress,
                data: raw.payload,
                sourceType: raw.type,
              });
              tap.tapEvent(raw, sid, currentSeq);
              scheduleFlush(sid);
            }
            return;
          }

          const legacyStage = mapLegacyEventToStage(raw.type);
          if (legacyStage) {
            const progressByType: Record<string, number> = {
              SCAN_STARTED: 0.1,
              HTML_FETCHED: 1,
              DOM_PARSED: 1,
              CITE_FOUND: 0.65,
              ENTITY_EXTRACTED: 0.75,
              INTERPRETATION: 0.9,
              SCORE_UPDATED: 1,
            };
            engine.ingest(sid, {
              type: 'STAGE_UPDATE',
              stage: legacyStage,
              progress: progressByType[raw.type],
              sourceType: raw.type,
            });
          }

          switch (raw.type) {
            case 'SCAN_STARTED':
            case 'HTML_FETCHED':
            case 'DOM_PARSED':
              tap.tapEvent(raw, sid, currentSeq);
              break;

            // ── Cite accumulation ───────────────────────────────────────────────
            case 'CITE_FOUND': {
              const cite = raw.cite as CiteEntry;
              accumulatedRef.current.cites.push(cite); // sync — always accurate
              engine.ingest(sid, { type: 'CITE_FOUND', cite });
              tap.tapEvent(raw, sid, currentSeq);
              break;
            }

            // ── Entity accumulation ─────────────────────────────────────────────
            case 'ENTITY_EXTRACTED': {
              const entity = raw.entity as EntityRef;
              accumulatedRef.current.entities.push(entity); // sync — always accurate
              engine.ingest(sid, { type: 'ENTITY_FOUND', entity });
              tap.tapEvent(raw, sid, currentSeq);
              break;
            }

            case 'INTERPRETATION':
              tap.tapEvent(raw, sid, currentSeq);
              break;

            // ── Score accumulation ──────────────────────────────────────────────
            case 'SCORE_UPDATED': {
              const layer = raw.layer as keyof LayerScores;
              const value = raw.value as number;
              accumulatedRef.current.scores[layer] = value; // sync — always accurate
              engine.ingest(sid, { type: 'SCORE_UPDATE', layer, value });
              tap.tapEvent(raw, sid, currentSeq);
              break;
            }

            // ── Completion ──────────────────────────────────────────────────────
            case 'SCAN_COMPLETED': {
              terminalEventReceived = true;
              const s = raw.summary as ScanSummary & {
                cite_count: number;
                entity_count: number;
                processing_ms: number;
              };
              const acc = accumulatedRef.current;

              // Build final result from server summary + synchronously-accumulated data
              const result: ScanResult = {
                url: s.url,
                score: s.score,
                status_line: s.status_line,
                findings: s.findings,
                recommendation: s.recommendation,
                hard_blockers: s.hard_blockers,
                scanned_at: s.scanned_at,
                cite_count: s.cite_count,
                entity_count: s.entity_count,
                processing_ms: s.processing_ms,
                cites: [...acc.cites],
                entities: [...acc.entities],
                scores: {
                  crawl: acc.scores.crawl ?? 50,
                  semantic: acc.scores.semantic ?? 50,
                  authority: acc.scores.authority ?? 50,
                },
              };
              engine.ingest(sid, {
                type: 'STAGE_UPDATE',
                stage: 'scoring',
                progress: 1,
                sourceType: raw.type,
              });
              engine.flush(sid);
              tap.tapEvent(raw, sid, currentSeq);
              closeStream();
              engine.ingest(sid, { type: 'SCAN_COMPLETE', result });
              engine.flush(sid);
              return; // skip scheduleFlush below — already flushed
            }

            // ── Error ───────────────────────────────────────────────────────────
            case 'ERROR': {
              terminalEventReceived = true;
              engine.ingest(sid, {
                type: 'SCAN_ERROR',
                message: (raw.message as string) || 'Scan failed.',
              });
              tap.tapEvent(raw, sid, currentSeq);
              engine.flush(sid);
              closeStream();
              return; // skip scheduleFlush below — already flushed
            }
          }

          // Batch-flush via idle scheduling for all non-terminal events
          scheduleFlush(sid);
        } catch {
          // ignore malformed SSE frames
        }
      };

      source.onerror = () => {
        // EventSource fires onerror when the server closes the stream.
        // If a terminal event has already been processed, this is expected.
        if (terminalEventReceived) {
          closeStream();
          return;
        }

        if (esRef.current === source) {
          const engine = getEngine();
          engine.ingest(sid, {
            type: 'SCAN_ERROR',
            message: 'Connection lost. Check your network and try again.',
          });
          engine.flush(sid);
          closeStream();
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [scheduleFlush]
  );

  const reset = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    const sid = scanIdRef.current;
    if (sid) getEngine().reset(sid);
    dispatch({ type: 'RESET' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScanContext.Provider value={{ state, dispatch, startScan, reset }}>
      {children}
    </ScanContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScan must be used within ScanProvider');
  return ctx;
}
