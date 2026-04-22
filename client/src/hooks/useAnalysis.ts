/**
 * useAnalysis Hook
 * Connects Realtime pipeline → State reducer → UI components
 * Tier-aware: free = cached snapshot only, paid = live stream
 */

import { useEffect, useReducer, useCallback, useRef } from 'react';
import { realtimeAnalysis, PipelineEvent, PipelineState } from '../services/realtimeAnalysisService';
import { analysisReducer, createInitialState, UIState, AnalysisAction } from './useAnalysisState';

interface UseAnalysisOptions {
  runId: string;
  userTier?: 'observer' | 'starter' | 'alignment' | 'signal';
  onError?: (error: string) => void;
  autoReplay?: boolean;
}

export function useAnalysis(options: UseAnalysisOptions) {
  const { runId, userTier = 'observer', onError, autoReplay = false } = options;

  const [state, dispatch] = useReducer(analysisReducer, undefined, createInitialState);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const replayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  /**
   * Event handler: receives pipeline events from realtime service
   */
  const handlePipelineEvent = useCallback((event: PipelineEvent, pipelineState: PipelineState) => {
    const timestamp = new Date(event.timestamp).getTime();

    switch (event.type) {
      case 'stage': {
        if (event.stage) {
          dispatch({
            type: 'STAGE_UPDATE',
            payload: { stage: event.stage },
            timestamp,
          });
        }
        break;
      }

      case 'partial': {
        const { entities, citations, score, visibility } = event.data || {};

        if (entities) {
          dispatch({
            type: 'ENTITIES_UPDATE',
            payload: { entities: Array.isArray(entities) ? entities : [entities] },
            timestamp,
          });
        }

        if (citations) {
          dispatch({
            type: 'CITATIONS_UPDATE',
            payload: { citations: Array.isArray(citations) ? citations : [citations] },
            timestamp,
          });
        }

        if (score !== undefined || visibility !== undefined) {
          dispatch({
            type: 'SCORE_UPDATE',
            payload: { score, visibility },
            timestamp,
          });
        }
        break;
      }

      case 'complete': {
        dispatch({
          type: 'STAGE_UPDATE',
          payload: { stage: { name: 'cache', status: 'complete' } },
          timestamp,
        });
        break;
      }

      case 'error': {
        const errorMsg = event.data?.message || 'Unknown error';
        dispatch({
          type: 'ERROR',
          payload: { message: errorMsg },
          timestamp,
        });
        onError?.(errorMsg);
        break;
      }
    }
  }, [onError]);

  /**
   * Setup realtime subscription (paid tiers only)
   */
  useEffect(() => {
    if (userTier === 'observer') {
      // Free tier: load cached snapshot only
      const cachedState = realtimeAnalysis.getState(runId);
      if (cachedState) {
        // Emit events from cached state to seed UI
        // (In production, load from analysis_cache instead)
      }
      return;
    }

    // Paid tiers: subscribe to live stream
    startTimeRef.current = Date.now();
    unsubscribeRef.current = realtimeAnalysis.subscribeToRun(
      runId,
      handlePipelineEvent,
      userTier
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [runId, userTier, handlePipelineEvent]);

  /**
   * Timeline replay: scrub through recorded events
   */
  const scrubToFrame = useCallback((frame: number) => {
    // Find all events up to this frame
    const eventsUpToFrame = state.timeline.events.filter((e) => e.frame <= frame);

    // Reset state and replay events deterministically
    dispatch({ type: 'RESET', timestamp: Date.now() });

    eventsUpToFrame.forEach((event) => {
      // Reconstruct action from timeline event
      // This requires the original event payloads to be stored
      // In production, fetch from analysis_runs history
    });
  }, [state.timeline.events]);

  /**
   * Auto-replay: cycle through timeline when complete
   */
  useEffect(() => {
    if (!autoReplay || state.status !== 'complete') return;

    // Wait 2s, then start replay
    replayTimeoutRef.current = setTimeout(() => {
      // TODO: implement timeline replay
    }, 2000);

    return () => {
      if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);
    };
  }, [autoReplay, state.status]);

  return {
    // Current state for rendering
    state,

    // Timeline controls
    timeline: {
      events: state.timeline.events,
      scrubToFrame,
      isReplaying: state.timeline.isReplaying,
    },

    // Stage getters (convenience)
    stages: {
      fetch: state.stages.fetch,
      parse: state.stages.parse,
      entities: state.stages.entities,
      score: state.stages.score,
      cache: state.stages.cache,
    },

    // Data getters
    entities: state.entities,
    citations: state.citations,
    scores: state.scores,

    // Status
    isAnalyzing: state.status === 'analyzing',
    isComplete: state.status === 'complete',
    isError: state.status === 'error',
    error: state.error,
  };
}

export default useAnalysis;
