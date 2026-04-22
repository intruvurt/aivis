import { createHash } from 'crypto';
import { getPool } from './postgresql.js';
import { normalizeTrackedUrl } from '../utils/normalizeUrl.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

type IngestOptions = {
  url: string;
  userId?: string | null;
  workspaceId?: string | null;
  lookbackMinutes?: number;
};

export type CloudflareMetricRow = {
  id: string;
  url: string;
  url_hash: string;
  requests: number;
  cached_requests: number;
  cache_hit_rate: number;
  ai_crawler_hits: number;
  human_hits: number;
  edge_bytes: number;
  origin_bytes: number;
  avg_ttfb_ms: number | null;
  source: Record<string, unknown>;
  observed_at: string;
};

export type CloudflareSignalSummary = {
  url: string;
  urlHash: string;
  metrics: {
    requests: number;
    cacheHitRate: number;
    aiCrawlerHits: number;
    humanHits: number;
    avgLatencyMs: number;
    dataServedBytes: number;
  };
  derived: {
    scanIntensity: number;
    cacheStability: number;
    crawlCostScore: number;
    aiVisibilityGate: 'open' | 'restricted';
    trafficPhysicsScore: number;
  };
  explanation: string[];
  observedAt: string;
};

function hashUrl(url: string): string {
  const normalized = normalizeTrackedUrl(url);
  return createHash('sha256').update(normalized).digest('hex');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cfConfigured(): boolean {
  return Boolean(process.env.CF_ZONE_ID && (process.env.CF_API_TOKEN || process.env.CF_API_KEY));
}

function classifyAiCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes('gptbot') ||
    ua.includes('chatgpt-user') ||
    ua.includes('oai-searchbot') ||
    ua.includes('claudebot') ||
    ua.includes('anthropic-ai') ||
    ua.includes('perplexitybot') ||
    ua.includes('google-extended') ||
    ua.includes('bytespider')
  );
}

async function fetchCloudflareRaw(url: string, lookbackMinutes = 60): Promise<CloudflareMetricRow> {
  if (!cfConfigured()) {
    throw new Error('Cloudflare API not configured (missing CF_ZONE_ID and/or CF_API_TOKEN)');
  }

  const zoneId = String(process.env.CF_ZONE_ID || '').trim();
  const token = String(process.env.CF_API_TOKEN || process.env.CF_API_KEY || '').trim();

  const normalized = normalizeTrackedUrl(url);
  const path = (() => {
    try {
      const parsed = new URL(normalized);
      return `${parsed.pathname}${parsed.search || ''}` || '/';
    } catch {
      return '/';
    }
  })();

  const sinceIso = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();

  const query = `
    query GetHttpTraffic($zoneTag: string, $datetime_geq: Time, $path: string) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 2000
            filter: { datetime_geq: $datetime_geq, clientRequestPath: $path }
          ) {
            sum {
              requests
              cachedRequests
              edgeResponseBytes
              visits
            }
            avg {
              edgeTimeToFirstByteMs
            }
            dimensions {
              clientRequestUserAgent
            }
          }
        }
      }
    }
  `;

  const resp = await fetch(`${CF_API_BASE}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: {
        zoneTag: zoneId,
        datetime_geq: sinceIso,
        path,
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Cloudflare GraphQL failed (${resp.status}): ${text.slice(0, 300)}`);
  }

  const json = await resp.json() as any;
  if (Array.isArray(json?.errors) && json.errors.length > 0) {
    throw new Error(`Cloudflare GraphQL error: ${JSON.stringify(json.errors[0])}`);
  }

  const groups = json?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups;
  const rows = Array.isArray(groups) ? groups : [];

  let requests = 0;
  let cachedRequests = 0;
  let edgeBytes = 0;
  let aiCrawlerHits = 0;
  let humanHits = 0;
  let avgTtfbNumerator = 0;
  let avgTtfbDenominator = 0;

  for (const row of rows) {
    const sum = row?.sum || {};
    const req = Number(sum.requests || 0);
    const cached = Number(sum.cachedRequests || 0);
    const bytes = Number(sum.edgeResponseBytes || 0);
    const ttfb = Number(row?.avg?.edgeTimeToFirstByteMs || 0);
    const ua = String(row?.dimensions?.clientRequestUserAgent || '');

    requests += req;
    cachedRequests += cached;
    edgeBytes += bytes;

    if (classifyAiCrawler(ua)) aiCrawlerHits += req;
    else humanHits += req;

    if (req > 0 && Number.isFinite(ttfb) && ttfb > 0) {
      avgTtfbNumerator += ttfb * req;
      avgTtfbDenominator += req;
    }
  }

  const safeRequests = Math.max(1, requests);
  const cacheHitRate = clamp(cachedRequests / safeRequests, 0, 1);
  const avgTtfbMs = avgTtfbDenominator > 0 ? Math.round(avgTtfbNumerator / avgTtfbDenominator) : null;

  return {
    id: '',
    url: normalized,
    url_hash: hashUrl(normalized),
    requests,
    cached_requests: cachedRequests,
    cache_hit_rate: cacheHitRate,
    ai_crawler_hits: aiCrawlerHits,
    human_hits: humanHits,
    edge_bytes: edgeBytes,
    origin_bytes: Math.max(0, edgeBytes - Math.round(edgeBytes * cacheHitRate)),
    avg_ttfb_ms: avgTtfbMs,
    source: {
      provider: 'cloudflare',
      path,
      lookback_minutes: lookbackMinutes,
      sampled_rows: rows.length,
    },
    observed_at: new Date().toISOString(),
  };
}

export async function ingestCloudflareMetrics(options: IngestOptions): Promise<CloudflareMetricRow> {
  const metric = await fetchCloudflareRaw(options.url, options.lookbackMinutes || 60);
  const res = await getPool().query(
    `INSERT INTO cloudflare_metrics (
       user_id,
       workspace_id,
       url,
       url_hash,
       requests,
       cached_requests,
       cache_hit_rate,
       ai_crawler_hits,
       human_hits,
       edge_bytes,
       origin_bytes,
       avg_ttfb_ms,
       source,
       observed_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14
     ) RETURNING *`,
    [
      options.userId || null,
      options.workspaceId || null,
      metric.url,
      metric.url_hash,
      metric.requests,
      metric.cached_requests,
      metric.cache_hit_rate,
      metric.ai_crawler_hits,
      metric.human_hits,
      metric.edge_bytes,
      metric.origin_bytes,
      metric.avg_ttfb_ms,
      JSON.stringify(metric.source || {}),
      metric.observed_at,
    ],
  );
  return res.rows[0] as CloudflareMetricRow;
}

export async function getLatestCloudflareSignal(url: string, workspaceId?: string | null): Promise<CloudflareSignalSummary | null> {
  const normalized = normalizeTrackedUrl(url);
  const urlHash = hashUrl(normalized);
  const res = await getPool().query(
    `SELECT *
       FROM cloudflare_metrics
      WHERE url_hash = $1
        AND ($2::uuid IS NULL OR workspace_id IS NOT DISTINCT FROM $2::uuid)
      ORDER BY observed_at DESC
      LIMIT 1`,
    [urlHash, workspaceId || null],
  );

  const row = res.rows[0] as CloudflareMetricRow | undefined;
  if (!row) return null;

  const requests = Number(row.requests || 0);
  const cacheHitRate = clamp(Number(row.cache_hit_rate || 0), 0, 1);
  const aiCrawlerHits = Number(row.ai_crawler_hits || 0);
  const humanHits = Number(row.human_hits || 0);
  const avgLatencyMs = Number(row.avg_ttfb_ms || 0);
  const dataServedBytes = Number(row.edge_bytes || 0);

  const scanIntensity = clamp(Math.round(Math.log10(Math.max(1, requests)) * 32), 0, 100);
  const cacheStability = clamp(Math.round(cacheHitRate * 100), 0, 100);
  const bytesPerRequest = requests > 0 ? dataServedBytes / requests : 0;
  const latencyPenalty = clamp(Math.round(avgLatencyMs / 15), 0, 40);
  const transferPenalty = clamp(Math.round(bytesPerRequest / 15_000), 0, 40);
  const crawlCostScore = clamp(100 - latencyPenalty - transferPenalty, 0, 100);
  const aiVisibilityGate = aiCrawlerHits > 0 ? 'open' : 'restricted';

  const trafficPhysicsScore = clamp(
    Math.round(scanIntensity * 0.30 + cacheStability * 0.30 + crawlCostScore * 0.25 + (aiVisibilityGate === 'open' ? 100 : 25) * 0.15),
    0,
    100,
  );

  const explanation: string[] = [];
  explanation.push(`Traffic intensity is ${scanIntensity}/100 based on ${requests} requests.`);
  explanation.push(`Cache stability is ${cacheStability}% with hit-rate ${(cacheHitRate * 100).toFixed(1)}%.`);
  if (avgLatencyMs > 0) explanation.push(`Average edge latency is ${avgLatencyMs}ms.`);
  explanation.push(`AI crawler hits: ${aiCrawlerHits}, human hits: ${humanHits}.`);
  if (aiVisibilityGate === 'restricted') {
    explanation.push('AI visibility is restricted: no AI crawler requests observed in this window.');
  }

  return {
    url: normalized,
    urlHash,
    metrics: {
      requests,
      cacheHitRate,
      aiCrawlerHits,
      humanHits,
      avgLatencyMs,
      dataServedBytes,
    },
    derived: {
      scanIntensity,
      cacheStability,
      crawlCostScore,
      aiVisibilityGate,
      trafficPhysicsScore,
    },
    explanation,
    observedAt: row.observed_at,
  };
}

export async function listCloudflareSignalHistory(url: string, workspaceId?: string | null, limit = 24): Promise<CloudflareMetricRow[]> {
  const normalized = normalizeTrackedUrl(url);
  const urlHash = hashUrl(normalized);
  const safeLimit = clamp(limit, 1, 168);

  const res = await getPool().query(
    `SELECT *
       FROM cloudflare_metrics
      WHERE url_hash = $1
        AND ($2::uuid IS NULL OR workspace_id IS NOT DISTINCT FROM $2::uuid)
      ORDER BY observed_at DESC
      LIMIT $3`,
    [urlHash, workspaceId || null, safeLimit],
  );

  return res.rows as CloudflareMetricRow[];
}
