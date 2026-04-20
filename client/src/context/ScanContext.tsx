/**
 * ScanContext.tsx
 *
 * Single source of truth for the scan surface.
 * Provides state + dispatch to every component in the scan tree.
 * The EventSource orchestration lives here so components stay pure renderers.
 */

import { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { scanReducer } from '../machines/scanMachine';
import type { AppState, Action, ScanResult } from '../machines/scanMachine';
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
  const esRef = useRef<EventSource | null>(null);
  // Mirror state in a ref so closures can read the latest accumulated data
  const stateRef = useRef<AppState>({ phase: 'IDLE' });
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const startScan = useCallback((rawUrl: string) => {
    const url = normalizePublicUrlInput(rawUrl.trim());
    if (!url) return;

    // Tear down any in-flight stream
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    dispatch({ type: 'START_SCAN', url });

    const source = new EventSource(`${API_URL}/api/analyze/stream?url=${encodeURIComponent(url)}`);
    esRef.current = source;

    source.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data) as { type: string; [key: string]: unknown };
        switch (event.type) {
          // Stage advances
          case 'SCAN_STARTED':
            dispatch({ type: 'ADVANCE_STAGE', stage: 'FETCHING' });
            break;
          case 'HTML_FETCHED':
            dispatch({ type: 'ADVANCE_STAGE', stage: 'PARSING_DOM' });
            break;
          case 'DOM_PARSED':
            dispatch({ type: 'ADVANCE_STAGE', stage: 'EXTRACTING_ENTITIES' });
            break;
          case 'CITE_FOUND':
            dispatch({ type: 'ACCUMULATE_CITE', cite: event.cite as CiteEntry });
            dispatch({ type: 'ADVANCE_STAGE', stage: 'EXTRACTING_ENTITIES' });
            break;
          case 'ENTITY_EXTRACTED':
            dispatch({ type: 'ACCUMULATE_ENTITY', entity: event.entity as EntityRef });
            dispatch({ type: 'ADVANCE_STAGE', stage: 'RESOLVING_CITATIONS' });
            break;
          case 'INTERPRETATION':
            dispatch({ type: 'ADVANCE_STAGE', stage: 'RESOLVING_CITATIONS' });
            break;
          case 'SCORE_UPDATED': {
            const layer = event.layer as 'crawl' | 'semantic' | 'authority';
            const value = event.value as number;
            dispatch({ type: 'UPDATE_SCORE', layer, value });
            dispatch({ type: 'ADVANCE_STAGE', stage: 'SCORING' });
            break;
          }
          case 'SCAN_COMPLETED': {
            dispatch({ type: 'ADVANCE_STAGE', stage: 'FINALIZING' });
            const s = event.summary as ScanSummary & {
              cite_count: number;
              entity_count: number;
              processing_ms: number;
            };
            // Small delay so FINALIZING renders briefly before flip
            // Read accumulated data from stateRef (reflects latest reducer state)
            setTimeout(() => {
              const snap = stateRef.current;
              const cites = snap.phase === 'SCANNING' ? snap.cites : [];
              const entities = snap.phase === 'SCANNING' ? snap.entities : [];
              const scores =
                snap.phase === 'SCANNING'
                  ? {
                      crawl: snap.scores.crawl ?? 50,
                      semantic: snap.scores.semantic ?? 50,
                      authority: snap.scores.authority ?? 50,
                    }
                  : { crawl: 50, semantic: 50, authority: 50 };
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
                cites,
                entities,
                scores,
              };
              dispatch({ type: 'SCAN_COMPLETE', result });
              source.close();
              esRef.current = null;
            }, 400);
            break;
          }
          case 'ERROR': {
            dispatch({ type: 'SET_ERROR', message: (event.message as string) || 'Scan failed.' });
            source.close();
            esRef.current = null;
            break;
          }
        }
      } catch {
        // ignore malformed SSE frames
      }
    };

    source.onerror = () => {
      if (esRef.current) {
        dispatch({
          type: 'SET_ERROR',
          message: 'Connection lost. Check your network and try again.',
        });
        source.close();
        esRef.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    dispatch({ type: 'RESET' });
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
