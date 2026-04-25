/**
 * scanMachine.ts
 *
 * The truth engine for the public scan surface.
 *
 * All UI is derived from AppState — no scattered hooks, no parallel state.
 * Components are dumb renderers; this machine owns every transition.
 */

import type { CiteEntry, EntityRef } from '../../../shared/types';

// ── Stage ─────────────────────────────────────────────────────────────────────

export type ScanStage =
  | 'ingesting'
  | 'chunking'
  | 'embedding'
  | 'entity_resolving'
  | 'edge_building'
  | 'scoring';

export const STAGE_LABEL: Record<ScanStage, string> = {
  ingesting: 'ingesting and validating source…',
  chunking: 'segmenting document into semantic chunks…',
  embedding: 'embedding chunks and normalizing vectors…',
  entity_resolving: 'resolving entity matches and aliases…',
  edge_building: 'building citation graph edges…',
  scoring: 'computing influence score…',
};

// Ordered list used to animate the terminal stream
export const SCAN_STAGE_ORDER: ScanStage[] = [
  'ingesting',
  'chunking',
  'embedding',
  'entity_resolving',
  'edge_building',
  'scoring',
];

export interface TimelineEvent {
  stage: ScanStage;
  timestamp: number;
  progress?: number;
  data?: Record<string, unknown>;
  sourceType?: string;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface LayerScores {
  crawl:     number;
  semantic:  number;
  authority: number;
}

export interface ScanResult {
  url:             string;
  score:           number;
  status_line:     string;
  findings:        string[];
  recommendation:  string;
  hard_blockers:   string[];
  scanned_at:      string;
  cite_count:      number;
  entity_count:    number;
  processing_ms:   number;
  cites:           CiteEntry[];
  entities:        EntityRef[];
  scores:          LayerScores;
  timeline?:       TimelineEvent[];
}

// ── State ─────────────────────────────────────────────────────────────────────

export type AppState =
  | { phase: 'IDLE' }
  | { phase: 'INPUT_FOCUSED' }
  | {
      phase: 'SCANNING';
      url: string;
      stage: ScanStage;
      stageProgress: number;
      timeline: TimelineEvent[];
      cites: CiteEntry[];
      entities: EntityRef[];
      scores: Partial<LayerScores>;
    }
  | { phase: 'RESULT'; result: ScanResult }
  | { phase: 'ERROR'; error: string };

// ── Actions ───────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'FOCUS_INPUT' }
  | { type: 'BLUR_INPUT' }
  | { type: 'START_SCAN'; url: string }
  | {
      type: 'ADVANCE_STAGE';
      stage: ScanStage;
      progress?: number;
      timestamp?: number;
      data?: Record<string, unknown>;
      sourceType?: string;
    }
  | { type: 'ACCUMULATE_CITE'; cite: CiteEntry }
  | { type: 'ACCUMULATE_ENTITY'; entity: EntityRef }
  | { type: 'UPDATE_SCORE'; layer: keyof LayerScores; value: number }
  | { type: 'SCAN_COMPLETE'; result: ScanResult }
  | { type: 'RESET' }
  | { type: 'SET_ERROR'; message: string };

// ── Reducer (truth engine) ─────────────────────────────────────────────────────

export function scanReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'FOCUS_INPUT':
      if (state.phase !== 'IDLE') return state;
      return { phase: 'INPUT_FOCUSED' };

    case 'BLUR_INPUT':
      if (state.phase !== 'INPUT_FOCUSED') return state;
      return { phase: 'IDLE' };

    case 'START_SCAN':
      return {
        phase: 'SCANNING',
        url: action.url,
        stage: 'ingesting',
        stageProgress: 0,
        timeline: [],
        cites: [],
        entities: [],
        scores: {},
      };

    case 'ADVANCE_STAGE':
      if (state.phase !== 'SCANNING') return state;
      return {
        ...state,
        stage: action.stage,
        stageProgress: action.progress ?? state.stageProgress,
        timeline: [
          ...state.timeline,
          {
            stage: action.stage,
            timestamp: action.timestamp ?? Date.now(),
            progress: action.progress,
            data: action.data,
            sourceType: action.sourceType,
          },
        ],
      };

    case 'ACCUMULATE_CITE':
      if (state.phase !== 'SCANNING') return state;
      return { ...state, cites: [...state.cites, action.cite] };

    case 'ACCUMULATE_ENTITY':
      if (state.phase !== 'SCANNING') return state;
      return { ...state, entities: [...state.entities, action.entity] };

    case 'UPDATE_SCORE':
      if (state.phase !== 'SCANNING') return state;
      return { ...state, scores: { ...state.scores, [action.layer]: action.value } };

    case 'SCAN_COMPLETE':
      return { phase: 'RESULT', result: action.result };

    case 'RESET':
      return { phase: 'IDLE' };

    case 'SET_ERROR':
      return { phase: 'ERROR', error: action.message };

    default:
      return state;
  }
}
