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
  const payload = {
    type: 'stage',
    stage: {
      name: stageName,
      status: jobStatus === 'failed' ? 'failed' : jobStatus === 'completed' ? 'complete' : 'running',
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
