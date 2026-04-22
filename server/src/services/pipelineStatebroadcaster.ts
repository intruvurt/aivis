/**
 * Edge Function: Pipeline State Broadcaster
 * Runs after ingestion job updates → broadcasts to Supabase Realtime
 * 
 * This is called by:
 * 1. auditWorker.ts (after each stage completes)
 * 2. Postgres triggers (automatic on analysis_runs INSERT)
 * 3. Manual annotation endpoints
 * 
 * It deserializes job status → stage name → broadcasts to channel subscribers
 */

import { createClient } from '@supabase/supabase-js';

type ContractStage =
  | 'queued'
  | 'fetched'
  | 'parsed'
  | 'entities'
  | 'citations'
  | 'scored'
  | 'finalized';

function toContractStage(jobStatus: string): ContractStage {
  switch (jobStatus) {
    case 'queued':
      return 'queued';
    case 'fetched':
      return 'fetched';
    case 'parsed':
      return 'parsed';
    case 'analyzed':
      return 'scored';
    case 'completed':
      return 'finalized';
    case 'failed':
      return 'finalized';
    default:
      return 'queued';
  }
}

/**
 * Map ingestion_jobs.status → pipeline stage name
 */
const jobStatusToStage: Record<string, string> = {
  queued: 'fetch',
  processing: 'fetch',
  fetched: 'parse',
  parsed: 'entities',
  analyzed: 'score',
  completed: 'cache',
  failed: 'error',
};

/**
 * Broadcast a pipeline stage update to Realtime subscribers
 * Call this from auditWorker after each major stage completes
 */
export async function broadcastStageUpdate(
  runId: string,
  jobStatus: string,
  duration?: number,
  error?: string
) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
  );

  const stageName = jobStatusToStage[jobStatus];
  if (!stageName) {
    console.warn(`[Broadcaster] Unknown job status: ${jobStatus}`);
    return;
  }

  const channelName = `analysis:${runId}`;
  const timestamp = Date.now();
  const stageStatus = jobStatus === 'failed' ? 'failed' : jobStatus === 'completed' ? 'complete' : 'running';
  const payload = {
    type: 'stage',
    runId,
    contract: {
      runId,
      stage: toContractStage(jobStatus),
      status: stageStatus,
      timestamp,
      payload: {
        duration: duration || 0,
        ...(error ? { error } : {}),
      },
    },
    // legacy shape kept for existing clients
    stage: {
      name: stageName,
      status: stageStatus,
      duration: duration || 0,
      timestamp: new Date().toISOString(),
    },
    ...(error && { error }),
  };

  // Broadcast to Realtime channel
  const channel = supabase.channel(channelName);

  await channel.send({
    type: 'broadcast',
    event: 'pipeline_update',
    payload,
  });

  console.log(`[Broadcaster] Sent stage update: ${stageName} for run ${runId}`);
}

/**
 * Broadcast partial analysis results (entities, citations, scores)
 * Call this from auditWorker as entities/citations are extracted
 */
export async function broadcastPartialResults(
  runId: string,
  partial: {
    entities?: any[];
    citations?: any[];
    score?: number;
    visibility?: number;
  }
) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
  );

  const channelName = `analysis:${runId}`;
  const payload = {
    type: 'partial',
    runId,
    contract: {
      runId,
      stage: 'entities' as ContractStage,
      status: 'complete',
      timestamp: Date.now(),
      payload: partial,
    },
    // legacy shape kept for existing clients
    data: partial,
    timestamp: new Date().toISOString(),
  };

  const channel = supabase.channel(channelName);

  await channel.send({
    type: 'broadcast',
    event: 'pipeline_update',
    payload,
  });

  console.log(`[Broadcaster] Sent partial results for run ${runId}`);
}

/**
 * Broadcast analysis complete
 */
export async function broadcastAnalysisComplete(runId: string, final: any) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
  );

  const channelName = `analysis:${runId}`;
  const payload = {
    type: 'complete',
    runId,
    contract: {
      runId,
      stage: 'finalized' as ContractStage,
      status: 'complete',
      timestamp: Date.now(),
      payload: final,
    },
    // legacy shape kept for existing clients
    data: final,
    timestamp: new Date().toISOString(),
  };

  const channel = supabase.channel(channelName);

  await channel.send({
    type: 'broadcast',
    event: 'pipeline_update',
    payload,
  });

  console.log(`[Broadcaster] Analysis complete for run ${runId}`);
}

/**
 * Broadcast error
 */
export async function broadcastAnalysisError(runId: string, error: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
  );

  const channelName = `analysis:${runId}`;
  const payload = {
    type: 'error',
    runId,
    contract: {
      runId,
      stage: 'finalized' as ContractStage,
      status: 'failed',
      timestamp: Date.now(),
      payload: { error: { message: error } },
    },
    // legacy shape kept for existing clients
    error: { message: error },
    timestamp: new Date().toISOString(),
  };

  const channel = supabase.channel(channelName);

  await channel.send({
    type: 'broadcast',
    event: 'pipeline_update',
    payload,
  });

  console.log(`[Broadcaster] Error broadcast for run ${runId}: ${error}`);
}
