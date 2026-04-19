/**
 * Query → Scan Pipeline Integration
 *
 * Wire deterministic queries into your analysis engines:
 * 1. Query node renders with cached insights
 * 2. User enters URL
 * 3. System auto-triggers appropriate scan (audit/checker/report)
 * 4. Scan results are linked to query node
 * 5. Results feed cite ledger and entity graph
 * 6. Registry pattern learning updates for future queries
 *
 * Implementation:
 * - QueryPage accepts onScanTrigger callback
 * - Maps query intent to system function via mapQueryToScanIntent()
 * - Sends POST /api/analyze or specialized endpoint
 * - Results stored with query_slug metadata
 * - Cite entries tagged with query origin
 */

import { mapQueryToScanIntent, getPrecomputedCache } from './queryCache.js';

/**
 * Trigger scan from query node context
 *
 * @param querySlug - The query node identifier
 * @param targetUrl - User-provided URL to audit
 * @param onProgress - Progress callback
 */
export async function triggerQueryScan(
  querySlug: string,
  targetUrl: string,
  onProgress?: (event: ScanProgressEvent) => void
): Promise<{ auditId: string; results: unknown }> {
  const scanIntent = mapQueryToScanIntent(querySlug);
  const cache = getPrecomputedCache(querySlug);

  if (!cache) {
    throw new Error(`Query not found: ${querySlug}`);
  }

  // Map query type to endpoint
  const endpoint = (() => {
    switch (scanIntent.scanType) {
      case 'audit':
        return '/api/analyze/intelligence';
      case 'entity-check':
        return '/api/analyze/entity';
      case 'schema-validation':
        return '/api/analyze/schema';
      case 'citation-test':
        return '/api/analyze/citations';
      default:
        return '/api/analyze/intelligence';
    }
  })();

  // Create analysis request with query context
  const request = {
    url: targetUrl,
    query_slug: querySlug,
    query_intent: cache.title,
    priority: scanIntent.priority,
  };

  // Stream results if available
  if (endpoint.includes('stream')) {
    return triggerStreamingScan(endpoint, request, onProgress);
  }

  // Standard request
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Scan failed: ${response.statusText}`);
  }

  const results = await response.json();

  return {
    auditId: results.audit_id || results.id,
    results,
  };
}

interface ScanProgressEvent {
  phase: 'fetch' | 'parse' | 'analyze' | 'complete';
  progress: number;
  message: string;
  partial?: unknown;
}

/**
 * Streaming scan with real-time progress
 */
async function triggerStreamingScan(
  endpoint: string,
  request: unknown,
  onProgress?: (event: ScanProgressEvent) => void
): Promise<{ auditId: string; results: unknown }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Stream failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let auditId = '';
  let lastResults: unknown = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        try {
          const event = JSON.parse(line.slice(6)) as ScanProgressEvent & {
            audit_id?: string;
            results?: unknown;
          };

          if (event.audit_id) auditId = event.audit_id;
          if (event.results) lastResults = event.results;

          onProgress?.(event);
        } catch {
          // Ignore parse errors in stream
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    auditId,
    results: lastResults || {},
  };
}

/**
 * Query analytics event
 */
export interface QueryAnalyticsEvent {
  query_slug: string;
  event: 'view' | 'cta_click' | 'scan_started' | 'scan_completed' | 'related_click';
  url?: string;
  audit_id?: string;
  timestamp: number;
}

/**
 * Track query interaction for feedback loop
 */
export async function trackQueryEvent(event: QueryAnalyticsEvent) {
  try {
    await fetch('/api/events/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch {
    // Non-critical
  }
}
