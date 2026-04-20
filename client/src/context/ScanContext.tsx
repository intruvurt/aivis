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
import type { AppState, Action, ScanResult, LayerScores } from '../machines/scanMachine';
import { ScanEngine } from '../services/scanEngine';
import { API_URL } from '../config';
import { normalizePublicUrlInput } from '../utils/targetKey';
import type { CiteEntry, EntityRef, ScanSummary } from '../../../shared/types';

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
      getEngine().reset(scanId);
      accumulatedRef.current = { cites: [], entities: [], scores: {} };

      dispatch({ type: 'START_SCAN', url });

      const source = new EventSource(
        `${API_URL}/api/analyze/stream?url=${encodeURIComponent(url)}`
      );
      esRef.current = source;

      source.onmessage = (evt) => {
        try {
          const raw = JSON.parse(evt.data) as { type: string; [key: string]: unknown };
          const engine = getEngine();
          const sid = scanIdRef.current;

          switch (raw.type) {
            // ── Stage advances ──────────────────────────────────────────────────
            case 'SCAN_STARTED':
              engine.ingest(sid, { type: 'STAGE_UPDATE', stage: 'FETCHING' });
              break;

            case 'HTML_FETCHED':
              engine.ingest(sid, { type: 'STAGE_UPDATE', stage: 'PARSING_DOM' });
              break;

            case 'DOM_PARSED':
              engine.ingest(sid, { type: 'STAGE_UPDATE', stage: 'EXTRACTING_ENTITIES' });
              break;

            // ── Cite accumulation ───────────────────────────────────────────────
            case 'CITE_FOUND': {
              const cite = raw.cite as CiteEntry;
              accumulatedRef.current.cites.push(cite); // sync — always accurate
              engine.ingest(sid, { type: 'CITE_FOUND', cite });
              engine.ingest(sid, { type: 'STAGE_UPDATE', stage: 'EXTRACTING_ENTITIES' });
              break;
            }

            // ── Entity accumulation ─────────────────────────────────────────────
            case 'ENTITY_EXTRACTED': {
              const entity = raw.entity as EntityRef;
              accumulatedRef.current.entities.push(entity); // sync — always accurate
              engine.ingest(sid, { type: 'ENTITY_FOUND', entity });
              engine.ingest(sid, { type: 'STAGE_UPDATE', stage: 'RESOLVING_CITATIONS' });
              break;
            }

            case 'INTERPRETATION':
              engine.ingest(sid, { type: 'STAGE_UPDATE', stage: 'RESOLVING_CITATIONS' });
              break;

            // ── Score accumulation ──────────────────────────────────────────────
            case 'SCORE_UPDATED': {
              const layer = raw.layer as keyof LayerScores;
              const value = raw.value as number;
              accumulatedRef.current.scores[layer] = value; // sync — always accurate
              engine.ingest(sid, { type: 'SCORE_UPDATE', layer, value });
              engine.ingest(sid, { type: 'STAGE_UPDATE', stage: 'SCORING' });
              break;
            }

            // ── Completion ──────────────────────────────────────────────────────
            case 'SCAN_COMPLETED': {
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

              // Commit FINALIZING immediately so the terminal animation plays
              engine.ingest(sid, { type: 'STAGE_UPDATE', stage: 'FINALIZING' });
              engine.flush(sid);

              // After brief FINALIZING animation, flip to RESULT phase
              setTimeout(() => {
                engine.ingest(sid, { type: 'SCAN_COMPLETE', result });
                engine.flush(sid);
                source.close();
                esRef.current = null;
              }, 400);
              return; // skip scheduleFlush below — already flushed
            }

            // ── Error ───────────────────────────────────────────────────────────
            case 'ERROR': {
              engine.ingest(sid, {
                type: 'SCAN_ERROR',
                message: (raw.message as string) || 'Scan failed.',
              });
              engine.flush(sid);
              source.close();
              esRef.current = null;
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
        if (esRef.current) {
          const sid = scanIdRef.current;
          const engine = getEngine();
          engine.ingest(sid, {
            type: 'SCAN_ERROR',
            message: 'Connection lost. Check your network and try again.',
          });
          engine.flush(sid);
          source.close();
          esRef.current = null;
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
