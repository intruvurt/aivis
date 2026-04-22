/**
 * Real-time Analysis Service
 * Listens to pipeline stages and emits deterministic state updates
 * UI subscribes to these events and projects them as emergence
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface PipelineStage {
  name: 'fetch' | 'parse' | 'entities' | 'score' | 'cache';
  status: 'pending' | 'running' | 'complete' | 'failed';
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface PartialAnalysis {
  entities?: Array<{
    id: string;
    value: string;
    type: string;
    confidence: number;
    context?: string;
  }>;
  citations?: Array<{
    source: string;
    mention: string;
    frequency: number;
  }>;
  score?: number;
  visibility?: number;
}

export interface PipelineState {
  runId: string;
  url: string;
  status: 'queued' | 'analyzing' | 'complete' | 'failed';
  stages: Record<string, PipelineStage>;
  partial: PartialAnalysis;
  timestamp: string;
  executionClass?: 'observer' | 'starter' | 'alignment' | 'signal';
  modelCount?: number;
  tripleCheck?: boolean;
}

export interface PipelineEvent {
  type: 'stage' | 'partial' | 'complete' | 'error';
  stage?: PipelineStage;
  data?: any;
  timestamp: string;
}

type PipelineListener = (event: PipelineEvent, state: PipelineState) => void;

class RealtimeAnalysisService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Set<PipelineListener>> = new Map();
  private pipelineStates: Map<string, PipelineState> = new Map();

  /**
   * Subscribe to a specific analysis run's pipeline
   * Returns unsubscribe function
   */
  subscribeToRun(
    runId: string,
    onUpdate: PipelineListener,
    tier?: 'free' | 'starter' | 'alignment' | 'signal'
  ): () => void {
    // Initialize listener set for this run
    if (!this.listeners.has(runId)) {
      this.listeners.set(runId, new Set());
      this.setupChannelForRun(runId, tier);
    }

    const listenerSet = this.listeners.get(runId)!;
    listenerSet.add(onUpdate);

    // Return unsubscribe function
    return () => {
      listenerSet.delete(onUpdate);
      if (listenerSet.size === 0) {
        this.unsubscribeRun(runId);
      }
    };
  }

  /**
   * Setup Realtime channels for a specific run
   * Subscribes to ingestion_jobs → analysis_runs → extracted_entities progression
   */
  private setupChannelForRun(runId: string, tier?: string) {
    const channelName = `analysis:${runId}`;
    const channel = supabase.channel(channelName);

    // Initialize state
    this.pipelineStates.set(runId, {
      runId,
      url: '',
      status: 'queued',
      stages: {
        fetch: { name: 'fetch', status: 'pending' },
        parse: { name: 'parse', status: 'pending' },
        entities: { name: 'entities', status: 'pending' },
        score: { name: 'score', status: 'pending' },
        cache: { name: 'cache', status: 'pending' },
      },
      partial: {},
      timestamp: new Date().toISOString(),
      executionClass: (tier as any) || 'observer',
    });

    // Subscribe to ingestion_jobs → detect stage transitions
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'ingestion_jobs',
        filter: `id=eq.${runId}`,
      },
      (payload) => this.handleJobUpdate(runId, payload)
    );

    // Subscribe to analysis_runs → stream partial results + deltas
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'analysis_runs',
        filter: `run_id=eq.${runId}`,
      },
      (payload) => this.handleAnalysisResult(runId, payload)
    );

    // Subscribe to extracted_entities → stream entities as they are parsed
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'extracted_entities',
        filter: `run_id=eq.${runId}`,
      },
      (payload) => this.handleEntityExtraction(runId, payload)
    );

    // Subscribe to citations → stream citations as they are scored
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'citations',
        filter: `run_id=eq.${runId}`,
      },
      (payload) => this.handleCitationInsert(runId, payload)
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[RT] Subscribed to analysis ${runId}`);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.log(`[RT] Channel closed for ${runId}`);
        this.unsubscribeRun(runId);
      }
    });

    this.channels.set(runId, channel);
  }

  /**
   * Handle ingestion_jobs UPDATE → stage transition
   */
  private handleJobUpdate(runId: string, payload: any) {
    const state = this.pipelineStates.get(runId);
    if (!state) return;

    const { old_record, new_record } = payload;
    const prevStatus = old_record?.status;
    const newStatus = new_record?.status;

    // Map job status to stage name
    const stageMap: Record<string, PipelineStage['name']> = {
      queued: 'fetch',
      processing: 'fetch',
      fetched: 'parse',
      parsed: 'entities',
      analyzed: 'score',
      completed: 'cache',
    };

    const stageName = stageMap[newStatus as string];
    if (!stageName) return;

    const now = new Date().toISOString();
    state.stages[stageName] = {
      name: stageName,
      status: newStatus === 'completed' ? 'complete' : 'running',
      startedAt: state.stages[stageName]?.startedAt || now,
      completedAt: newStatus === 'completed' ? now : undefined,
    };

    state.status = newStatus === 'completed' ? 'complete' : 'analyzing';
    state.timestamp = now;

    this.emitEvent(runId, {
      type: 'stage',
      stage: state.stages[stageName],
      timestamp: now,
    });
  }

  /**
   * Handle analysis_results INSERT → latest scores + visibility
   */
  private handleAnalysisResult(runId: string, payload: any) {
    const state = this.pipelineStates.get(runId);
    if (!state) return;

    const { new_record } = payload;
    state.partial.score = new_record?.score;
    state.partial.visibility = new_record?.visibility_score;
    state.timestamp = new Date().toISOString();

    this.emitEvent(runId, {
      type: 'partial',
      data: { score: state.partial.score, visibility: state.partial.visibility },
      timestamp: state.timestamp,
    });
  }

  /**
   * Handle extracted_entities INSERT → progressive entity emergence
   */
  private handleEntityExtraction(runId: string, payload: any) {
    const state = this.pipelineStates.get(runId);
    if (!state) return;

    const { new_record } = payload;
    if (!state.partial.entities) state.partial.entities = [];

    state.partial.entities.push({
      id: new_record?.id,
      value: new_record?.entity_value,
      type: new_record?.entity_type,
      confidence: new_record?.confidence || 0.5,
      context: new_record?.context,
    });

    state.timestamp = new Date().toISOString();

    this.emitEvent(runId, {
      type: 'partial',
      data: { entities: [state.partial.entities[state.partial.entities.length - 1]] },
      timestamp: state.timestamp,
    });
  }

  /**
   * Handle citations INSERT → progressive citation emergence
   */
  private handleCitationInsert(runId: string, payload: any) {
    const state = this.pipelineStates.get(runId);
    if (!state) return;

    const { new_record } = payload;
    if (!state.partial.citations) state.partial.citations = [];

    state.partial.citations.push({
      source: new_record?.source,
      mention: new_record?.target_entity,
      frequency: new_record?.mention_count || 1,
    });

    state.timestamp = new Date().toISOString();

    this.emitEvent(runId, {
      type: 'partial',
      data: { citations: [state.partial.citations[state.partial.citations.length - 1]] },
      timestamp: state.timestamp,
    });
  }

  /**
   * Emit event to all listeners for this run
   */
  private emitEvent(runId: string, event: PipelineEvent) {
    const state = this.pipelineStates.get(runId);
    if (!state) return;

    const listenerSet = this.listeners.get(runId);
    if (listenerSet) {
      listenerSet.forEach((listener) => {
        try {
          listener(event, state);
        } catch (err) {
          console.error(`[RT] Listener error for ${runId}:`, err);
        }
      });
    }
  }

  /**
   * Get current state for a run (useful for initial load)
   */
  getState(runId: string): PipelineState | undefined {
    return this.pipelineStates.get(runId);
  }

  /**
   * Unsubscribe from a run
   */
  private unsubscribeRun(runId: string) {
    const channel = this.channels.get(runId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(runId);
    }
    this.pipelineStates.delete(runId);
    this.listeners.delete(runId);
  }
}

export const realtimeAnalysis = new RealtimeAnalysisService();
