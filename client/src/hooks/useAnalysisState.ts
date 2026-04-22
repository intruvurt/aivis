/**
 * Analysis State Reducer
 * Deterministic state machine that maps pipeline events to UI state
 * Designed to be replayable: same events always produce same state
 */

import { PipelineEvent, PipelineState } from './realtimeAnalysisService';

export interface UIState {
  // Pipeline stages with visual state
  stages: {
    [key: string]: {
      status: 'pending' | 'running' | 'complete' | 'failed';
      progress: number; // 0-1
      duration: number; // ms
      startTime: number; // timestamp
      animationFrame: number; // for deterministic replay
    };
  };

  // Partial results for progressive rendering
  entities: Array<{
    id: string;
    value: string;
    type: string;
    confidence: number;
    opacity: number; // confidence-driven
    scale: number; // emergence animation
    appearedAt: number; // timestamp for replay
  }>;

  citations: Array<{
    source: string;
    mention: string;
    frequency: number;
    thickness: number; // frequency-driven
    appearedAt: number; // timestamp for replay
  }>;

  scores: {
    visibility?: number;
    authority?: number;
    clarity?: number;
    coverage?: number;
  };

  // Timeline tracking for replay
  timeline: {
    events: Array<{ type: string; timestamp: string; frame: number; action?: AnalysisAction }>;
    currentFrame: number;
    isReplaying: boolean;
  };

  // Overall state
  status: 'idle' | 'analyzing' | 'complete' | 'error';
  error?: string;
  lastUpdate: number;
}

export interface AnalysisAction {
  type: 'STAGE_UPDATE' | 'ENTITIES_UPDATE' | 'CITATIONS_UPDATE' | 'SCORE_UPDATE' | 'ERROR' | 'RESET' | 'HYDRATE';
  payload?: any;
  timestamp: number;
}

const STAGE_ANIMATION_DURATIONS = {
  fetch: 1200,
  parse: 800,
  entities: 2000,
  score: 1500,
  cache: 600,
};

const ENTITY_EMERGENCE_ANIMATION_MS = 400; // time for entity to fade in + scale
const CITATION_EMERGENCE_ANIMATION_MS = 300;

/**
 * Deterministic reducer for analysis state
 * Every event produces the same state given the same inputs
 */
export function analysisReducer(state: UIState, action: AnalysisAction): UIState {
  const baselineFrame = Math.floor(action.timestamp / 16); // 16ms = ~60fps

  switch (action.type) {
    case 'STAGE_UPDATE': {
      const { stage } = action.payload;
      if (!stage) return state;

      const stageDuration = STAGE_ANIMATION_DURATIONS[stage.name as keyof typeof STAGE_ANIMATION_DURATIONS] || 1000;
      const isComplete = stage.status === 'complete';
      const isFailed = stage.status === 'failed';

      return {
        ...state,
        stages: {
          ...state.stages,
          [stage.name]: {
            status: isFailed ? 'failed' : isComplete ? 'complete' : 'running',
            progress: isComplete ? 1 : stage.status === 'running' ? 0.5 : 0,
            duration: stage.duration || stageDuration,
            startTime: action.timestamp,
            animationFrame: baselineFrame,
          },
        },
        status: isFailed ? 'error' : state.status === 'idle' ? 'analyzing' : state.status,
        timeline: {
          ...state.timeline,
          events: [
            ...state.timeline.events,
            {
              type: `stage:${stage.name}:${stage.status}`,
              timestamp: new Date(action.timestamp).toISOString(),
              frame: baselineFrame,
              action: {
                type: 'STAGE_UPDATE',
                payload: action.payload,
                timestamp: action.timestamp,
              },
            },
          ],
          currentFrame: baselineFrame,
        },
        lastUpdate: action.timestamp,
      };
    }

    case 'ENTITIES_UPDATE': {
      const { entities } = action.payload || { entities: [] };
      if (!entities || !Array.isArray(entities)) return state;

      const newEntities = entities.map((entity: any) => ({
        id: entity.id,
        value: entity.value,
        type: entity.type,
        confidence: entity.confidence,
        opacity: entity.confidence, // confidence drives opacity
        scale: 1, // will animate from 0.8 → 1
        appearedAt: action.timestamp,
      }));

      // Merge with existing, avoiding duplicates by ID
      const existingIds = new Set(state.entities.map((e) => e.id));
      const mergedEntities = [
        ...state.entities,
        ...newEntities.filter((e) => !existingIds.has(e.id)),
      ];

      return {
        ...state,
        entities: mergedEntities,
        timeline: {
          ...state.timeline,
          events: [
            ...state.timeline.events,
            {
              type: `entities:${newEntities.length}`,
              timestamp: new Date(action.timestamp).toISOString(),
              frame: baselineFrame,
              action: {
                type: 'ENTITIES_UPDATE',
                payload: action.payload,
                timestamp: action.timestamp,
              },
            },
          ],
          currentFrame: baselineFrame,
        },
        lastUpdate: action.timestamp,
      };
    }

    case 'CITATIONS_UPDATE': {
      const { citations } = action.payload || { citations: [] };
      if (!citations || !Array.isArray(citations)) return state;

      const newCitations = citations.map((citation: any) => ({
        source: citation.source,
        mention: citation.mention,
        frequency: citation.frequency,
        thickness: Math.min(citation.frequency * 2, 5), // frequency-driven thickness, capped at 5px
        appearedAt: action.timestamp,
      }));

      const existingKeys = new Set(state.citations.map((c) => `${c.source}:${c.mention}`));
      const mergedCitations = [
        ...state.citations,
        ...newCitations.filter((c) => !existingKeys.has(`${c.source}:${c.mention}`)),
      ];

      return {
        ...state,
        citations: mergedCitations,
        timeline: {
          ...state.timeline,
          events: [
            ...state.timeline.events,
            {
              type: `citations:${newCitations.length}`,
              timestamp: new Date(action.timestamp).toISOString(),
              frame: baselineFrame,
              action: {
                type: 'CITATIONS_UPDATE',
                payload: action.payload,
                timestamp: action.timestamp,
              },
            },
          ],
          currentFrame: baselineFrame,
        },
        lastUpdate: action.timestamp,
      };
    }

    case 'SCORE_UPDATE': {
      const { score, visibility, authority, clarity, coverage } = action.payload || {};
      return {
        ...state,
        scores: {
          ...state.scores,
          ...(visibility !== undefined && { visibility }),
          ...(authority !== undefined && { authority }),
          ...(clarity !== undefined && { clarity }),
          ...(coverage !== undefined && { coverage }),
          ...(score !== undefined && { visibility: score }), // backward compat
        },
        timeline: {
          ...state.timeline,
          events: [
            ...state.timeline.events,
            {
              type: 'score:updated',
              timestamp: new Date(action.timestamp).toISOString(),
              frame: baselineFrame,
              action: {
                type: 'SCORE_UPDATE',
                payload: action.payload,
                timestamp: action.timestamp,
              },
            },
          ],
          currentFrame: baselineFrame,
        },
        lastUpdate: action.timestamp,
      };
    }

    case 'ERROR': {
      return {
        ...state,
        status: 'error',
        error: action.payload?.message,
        timeline: {
          ...state.timeline,
          events: [
            ...state.timeline.events,
            {
              type: 'error',
              timestamp: new Date(action.timestamp).toISOString(),
              frame: baselineFrame,
              action: {
                type: 'ERROR',
                payload: action.payload,
                timestamp: action.timestamp,
              },
            },
          ],
          currentFrame: baselineFrame,
        },
        lastUpdate: action.timestamp,
      };
    }

    case 'RESET': {
      return createInitialState();
    }

    case 'HYDRATE': {
      return action.payload as UIState;
    }

    default:
      return state;
  }
}

/**
 * Create initial UI state
 */
export function createInitialState(): UIState {
  return {
    stages: {
      fetch: { status: 'pending', progress: 0, duration: 0, startTime: 0, animationFrame: 0 },
      parse: { status: 'pending', progress: 0, duration: 0, startTime: 0, animationFrame: 0 },
      entities: { status: 'pending', progress: 0, duration: 0, startTime: 0, animationFrame: 0 },
      score: { status: 'pending', progress: 0, duration: 0, startTime: 0, animationFrame: 0 },
      cache: { status: 'pending', progress: 0, duration: 0, startTime: 0, animationFrame: 0 },
    },
    entities: [],
    citations: [],
    scores: {},
    timeline: {
      events: [],
      currentFrame: 0,
      isReplaying: false,
    },
    status: 'idle',
    lastUpdate: 0,
  };
}

/**
 * Calculate animation progress for a stage
 * Useful for smooth animations between frames
 */
export function getStageAnimationProgress(
  stage: UIState['stages'][string],
  currentTime: number,
  stageDuration: number
): number {
  if (stage.status === 'complete') return 1;
  if (stage.status === 'pending') return 0;

  const elapsed = currentTime - stage.startTime;
  return Math.min(elapsed / stageDuration, 0.99); // Cap at 0.99 to show it's still running
}

/**
 * Calculate emergence animation progress for an entity
 * Returns 0-1 for smooth fade-in + scale
 */
export function getEntityEmergenceProgress(entity: UIState['entities'][0], currentTime: number): number {
  const elapsed = currentTime - entity.appearedAt;
  return Math.min(elapsed / ENTITY_EMERGENCE_ANIMATION_MS, 1);
}

/**
 * Export state to serializable form for timeline replay
 */
export function exportStateSnapshot(state: UIState): any {
  return {
    stages: state.stages,
    entitiesCount: state.entities.length,
    citationsCount: state.citations.length,
    scores: state.scores,
    status: state.status,
    timestamp: state.lastUpdate,
  };
}
