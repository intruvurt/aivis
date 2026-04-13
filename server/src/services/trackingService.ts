import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from './postgresql.js';
import { checkBingSearchPresence, checkWebSearchPresence } from './webSearch.js';
import {
  extractEntitiesFromText,
  aggregateEntities,
  filterEntities,
} from './nerService.js';
import type { NERRunSummary } from '../../../shared/types.js';

const MODEL_TIMEOUT_MS = 10_000;

export const TRACKING_MAX_QUERIES = 50;
export const TRACKING_CONCURRENCY = 5;

export type TrackingModelResponse = {
  model: string;
  text: string;
};

export type CreateTrackingProjectInput = {
  domain: string;
  queries: string[];
  tenantId?: string;
  competitorDomains?: string[];
};

function normalizeDomain(input: string): string {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const withProto = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
  }
}

function normalizeQueryList(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const q of queries) {
    const value = String(q || '').trim().replace(/\s+/g, ' ');
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }

  return out;
}

function normalizeDomains(domains: string[] = []): string[] {
  const out = new Set<string>();
  for (const d of domains) {
    const host = normalizeDomain(d);
    if (host) out.add(host);
  }
  return Array.from(out);
}

function ensureQueryLimit(queries: string[]): void {
  if (queries.length === 0) {
    throw new Error('At least one query is required');
  }
  if (queries.length > TRACKING_MAX_QUERIES) {
    throw new Error(`Max ${TRACKING_MAX_QUERIES} queries per project`);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function extractUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function extractUrls(text: string): string[] {
  const regex = /(https?:\/\/[^\s)\]}>"']+)/gi;
  const matches = text.match(regex) || [];
  return Array.from(
    new Set(
      matches
        .map((u) => u.trim().replace(/[.,;:!?]+$/g, ''))
        .filter(Boolean),
    ),
  );
}

export function findPosition(text: string, domain: string): number | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const target = domain.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(target)) return i + 1;
  }
  return null;
}

export function extractMentions(text: string, domain: string) {
  const normalizedDomain = normalizeDomain(domain);
  const lower = String(text || '').toLowerCase();
  const urls = extractUrls(text || '');
  const mentioned = normalizedDomain ? lower.includes(normalizedDomain) : false;
  const cited = urls.some((u) => {
    const host = extractUrlDomain(u);
    return !!host && (host === normalizedDomain || host.endsWith(`.${normalizedDomain}`));
  });
  const position = findPosition(text || '', normalizedDomain);
  return {
    mentioned,
    cited,
    position,
    urls,
  };
}

function competitorMentions(text: string, urls: string[], competitors: string[]): string[] {
  if (!competitors.length) return [];
  const lower = text.toLowerCase();
  const urlHosts = urls.map((u) => extractUrlDomain(u));
  return competitors.filter((comp) => {
    if (lower.includes(comp)) return true;
    return urlHosts.some((h) => h === comp || h.endsWith(`.${comp}`));
  });
}

async function runOpenRouterModel(query: string, model: string, modelLabel: string): Promise<TrackingModelResponse> {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  if (!key) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter ${model} returned ${res.status}`);
    }

    const data = await res.json() as any;
    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') {
      throw new Error(`OpenRouter ${model} returned empty content`);
    }

    return {
      model: modelLabel,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runSerpFallback(query: string, domain: string): Promise<TrackingModelResponse> {
  const targetUrl = `https://${normalizeDomain(domain)}`;
  const [bing, ddg] = await Promise.all([
    withTimeout(checkBingSearchPresence(query, domain, targetUrl), MODEL_TIMEOUT_MS, 'bing_web'),
    withTimeout(checkWebSearchPresence(query, domain, targetUrl), MODEL_TIMEOUT_MS, 'ddg_web'),
  ]);

  const lines: string[] = [];
  lines.push(`Bing found=${bing.found} position=${bing.position}`);
  for (const row of bing.top_results.slice(0, 5)) {
    lines.push(`${row.position}. ${row.title} - ${row.url}`);
  }

  lines.push(`DuckDuckGo found=${ddg.found} position=${ddg.position}`);
  for (const row of ddg.top_results.slice(0, 5)) {
    lines.push(`${row.position}. ${row.title} - ${row.url}`);
  }

  return {
    model: 'serp-fallback',
    text: lines.join('\n'),
  };
}

export async function runAcrossModels(query: string, domain: string): Promise<TrackingModelResponse[]> {
  const tasks = [
    withTimeout(runOpenRouterModel(query, 'openai/gpt-4o-mini', 'openrouter-gpt-4o-mini'), MODEL_TIMEOUT_MS, 'openrouter-gpt-4o-mini'),
    withTimeout(runOpenRouterModel(query, 'perplexity/sonar', 'openrouter-perplexity-sonar'), MODEL_TIMEOUT_MS, 'openrouter-perplexity-sonar'),
    withTimeout(runSerpFallback(query, domain), MODEL_TIMEOUT_MS, 'serp-fallback'),
  ];

  const settled = await Promise.allSettled(tasks);
  const successes = settled
    .filter((entry): entry is PromiseFulfilledResult<TrackingModelResponse> => entry.status === 'fulfilled')
    .map((entry) => entry.value);

  if (successes.length === 0) {
    const reasons = settled
      .filter((entry): entry is PromiseRejectedResult => entry.status === 'rejected')
      .map((entry) => entry.reason?.message || String(entry.reason || 'unknown'));
    throw new Error(`All model calls failed: ${reasons.join('; ')}`);
  }

  return successes;
}

export async function mapWithConcurrency<T>(
  list: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, concurrency);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= list.length) break;
      await worker(list[current], current);
    }
  });

  await Promise.all(runners);
}

async function getOrCreateTenantForUser(client: PoolClient, userId: string, tenantId?: string): Promise<string> {
  if (tenantId) {
    const scoped = await client.query(
      `SELECT tenant_id FROM tenant_users WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
      [tenantId, userId],
    );
    if (!scoped.rowCount) {
      throw new Error('Unauthorized tenant access');
    }
    return tenantId;
  }

  const existing = await client.query(
    `SELECT tenant_id FROM tenant_users WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [userId],
  );
  if (existing.rowCount) return String(existing.rows[0].tenant_id);

  const createdTenant = await client.query(
    `INSERT INTO tenants (name) VALUES ($1) RETURNING id`,
    ['Personal tenant'],
  );
  const createdTenantId = String(createdTenant.rows[0].id);

  await client.query(
    `INSERT INTO tenant_users (tenant_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT (tenant_id, user_id) DO NOTHING`,
    [createdTenantId, userId],
  );

  return createdTenantId;
}

export async function createTrackingProjectForUser(userId: string, input: CreateTrackingProjectInput): Promise<{ projectId: string; tenantId: string }> {
  const normalizedDomain = normalizeDomain(input.domain);
  if (!normalizedDomain) throw new Error('Valid domain is required');

  const queries = normalizeQueryList(input.queries || []);
  ensureQueryLimit(queries);

  const competitorDomains = normalizeDomains(input.competitorDomains || []);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const tenantId = await getOrCreateTenantForUser(client, userId, input.tenantId);

    const projectRes = await client.query(
      `INSERT INTO tracking_projects (tenant_id, domain, competitor_domains)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id`,
      [tenantId, normalizedDomain, JSON.stringify(competitorDomains)],
    );

    const projectId = String(projectRes.rows[0].id);

    for (const q of queries) {
      await client.query(
        `INSERT INTO tracking_queries (project_id, query) VALUES ($1, $2)`,
        [projectId, q],
      );
    }

    await client.query('COMMIT');
    return { projectId, tenantId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function assertProjectTenantAccess(userId: string, projectId: string): Promise<{ projectId: string; tenantId: string; domain: string; competitorDomains: string[] }> {
  const result = await getPool().query(
    `SELECT p.id, p.tenant_id, p.domain, COALESCE(p.competitor_domains, '[]'::jsonb) AS competitor_domains
     FROM tracking_projects p
     JOIN tenant_users tu ON tu.tenant_id = p.tenant_id
     WHERE p.id = $1 AND tu.user_id = $2
     LIMIT 1`,
    [projectId, userId],
  );

  if (!result.rowCount) {
    throw new Error('Unauthorized');
  }

  return {
    projectId: String(result.rows[0].id),
    tenantId: String(result.rows[0].tenant_id),
    domain: String(result.rows[0].domain),
    competitorDomains: Array.isArray(result.rows[0].competitor_domains)
      ? result.rows[0].competitor_domains.map((v: unknown) => normalizeDomain(String(v || ''))).filter(Boolean)
      : [],
  };
}

export async function createRunForProject(projectId: string): Promise<{ runId: string; totalQueries: number }> {
  const countRes = await getPool().query(
    `SELECT COUNT(*)::int AS count FROM tracking_queries WHERE project_id = $1`,
    [projectId],
  );
  const totalQueries = Number(countRes.rows[0]?.count || 0);
  if (totalQueries < 1) throw new Error('Project has no queries');

  const inserted = await getPool().query(
    `INSERT INTO tracking_runs (project_id, status, total_queries, completed_queries)
     VALUES ($1, 'queued', $2, 0)
     RETURNING id`,
    [projectId, totalQueries],
  );

  return { runId: String(inserted.rows[0].id), totalQueries };
}

export async function getRunContext(runId: string): Promise<{
  runId: string;
  projectId: string;
  tenantId: string;
  domain: string;
  competitorDomains: string[];
  queries: Array<{ id: string; query: string }>;
}> {
  const runRes = await getPool().query(
    `SELECT r.id, r.project_id, p.domain, p.tenant_id,
            COALESCE(p.competitor_domains, '[]'::jsonb) AS competitor_domains
     FROM tracking_runs r
     JOIN tracking_projects p ON p.id = r.project_id
     WHERE r.id = $1
     LIMIT 1`,
    [runId],
  );

  if (!runRes.rowCount) {
    throw new Error(`Run ${runId} not found`);
  }

  const projectId = String(runRes.rows[0].project_id);
  const queryRes = await getPool().query(
    `SELECT id, query FROM tracking_queries WHERE project_id = $1 ORDER BY created_at ASC`,
    [projectId],
  );

  return {
    runId: String(runRes.rows[0].id),
    projectId,
    tenantId: String(runRes.rows[0].tenant_id),
    domain: String(runRes.rows[0].domain),
    competitorDomains: Array.isArray(runRes.rows[0].competitor_domains)
      ? runRes.rows[0].competitor_domains.map((v: unknown) => normalizeDomain(String(v || ''))).filter(Boolean)
      : [],
    queries: queryRes.rows.map((row: any) => ({ id: String(row.id), query: String(row.query) })),
  };
}

export async function updateRunStatus(runId: string, status: 'queued' | 'running' | 'completed' | 'failed', errorMessage?: string): Promise<void> {
  await getPool().query(
    `UPDATE tracking_runs
     SET status = $2,
         error_message = CASE WHEN $3::text IS NULL THEN error_message ELSE $3 END,
         completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
     WHERE id = $1`,
    [runId, status, errorMessage || null],
  );
}

export async function updateRunProgress(runId: string, completedQueries: number): Promise<void> {
  await getPool().query(
    `UPDATE tracking_runs
     SET completed_queries = GREATEST(0, $2),
         updated_at = NOW()
     WHERE id = $1`,
    [runId, completedQueries],
  );
}

/**
 * Cache key is prefixed with tenantId so two tenants asking the same query
 * never share cached responses (prevents cross-tenant data leaks).
 * Format: sha256(<tenantId>:<query>)<model>
 */
async function getCachedModelResponse(query: string, model: string, tenantId: string): Promise<string | null> {
  const hash = createHash('sha256').update(`${tenantId}:${query.toLowerCase()}`).digest('hex');
  const res = await getPool().query(
    `SELECT raw_response
     FROM tracking_query_cache
     WHERE query_hash = $1 AND model = $2 AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [hash, model],
  );
  if (!res.rowCount) return null;
  return String(res.rows[0].raw_response || '');
}

async function setCachedModelResponse(query: string, model: string, text: string, tenantId: string): Promise<void> {
  const hash = createHash('sha256').update(`${tenantId}:${query.toLowerCase()}`).digest('hex');
  await getPool().query(
    `INSERT INTO tracking_query_cache (query_hash, model, raw_response, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '6 hours')
     ON CONFLICT (query_hash, model) DO UPDATE SET raw_response = EXCLUDED.raw_response, expires_at = EXCLUDED.expires_at`,
    [hash, model, text],
  );
}

export async function runAcrossModelsCached(
  query: string,
  domain: string,
  tenantId: string,
): Promise<TrackingModelResponse[]> {
  const models = [
    {
      model: 'openrouter-gpt-4o-mini',
      fn: () => runOpenRouterModel(query, 'openai/gpt-4o-mini', 'openrouter-gpt-4o-mini'),
    },
    {
      model: 'openrouter-perplexity-sonar',
      fn: () => runOpenRouterModel(query, 'perplexity/sonar', 'openrouter-perplexity-sonar'),
    },
    {
      model: 'serp-fallback',
      fn: () => runSerpFallback(query, domain),
    },
  ];

  const settled = await Promise.allSettled(models.map(async (m) => {
    const cached = await getCachedModelResponse(query, m.model, tenantId);
    if (cached) {
      return { model: m.model, text: cached };
    }
    const live = await withTimeout(m.fn(), MODEL_TIMEOUT_MS, m.model);
    await setCachedModelResponse(query, m.model, live.text, tenantId).catch(() => { });
    return live;
  }));

  const successful = settled
    .filter((entry): entry is PromiseFulfilledResult<TrackingModelResponse> => entry.status === 'fulfilled')
    .map((entry) => entry.value);

  if (!successful.length) {
    throw new Error('All model sources failed for query');
  }

  return successful;
}

export async function saveTrackingResult(params: {
  runId: string;
  queryId: string;
  model: string;
  text: string;
  domain: string;
  competitorDomains: string[];
}): Promise<void> {
  const parsed = extractMentions(params.text, params.domain);
  const competitorHits = competitorMentions(params.text, parsed.urls, params.competitorDomains);

  const inserted = await getPool().query(
    `INSERT INTO tracking_results (
       run_id, query_id, model, mentioned, cited, position, raw_response, competitor_mentions
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id`,
    [
      params.runId,
      params.queryId,
      params.model,
      parsed.mentioned,
      parsed.cited,
      parsed.position,
      params.text,
      JSON.stringify(competitorHits),
    ],
  );

  const resultId = String(inserted.rows[0].id);

  for (const url of parsed.urls) {
    const citationDomain = extractUrlDomain(url);
    if (!citationDomain) continue;
    await getPool().query(
      `INSERT INTO tracking_citations (result_id, url, domain) VALUES ($1, $2, $3)`,
      [resultId, url, citationDomain],
    );
  }
}

export async function getRunForUser(userId: string, runId: string): Promise<any | null> {
  const res = await getPool().query(
    `SELECT r.id, r.project_id, r.status, r.total_queries, r.completed_queries, r.error_message,
            r.created_at, r.updated_at, r.completed_at,
            p.domain, p.tenant_id
     FROM tracking_runs r
     JOIN tracking_projects p ON p.id = r.project_id
     JOIN tenant_users tu ON tu.tenant_id = p.tenant_id
     WHERE r.id = $1 AND tu.user_id = $2
     LIMIT 1`,
    [runId, userId],
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function getRunResultsForUser(userId: string, runId: string, limit = 500): Promise<any[]> {
  const res = await getPool().query(
    `SELECT tr.id, tr.query_id, tq.query, tr.model, tr.mentioned, tr.cited, tr.position,
            tr.raw_response, tr.competitor_mentions, tr.created_at,
            COALESCE(json_agg(json_build_object('url', tc.url, 'domain', tc.domain))
                     FILTER (WHERE tc.id IS NOT NULL), '[]'::json) AS citations
     FROM tracking_results tr
     JOIN tracking_queries tq ON tq.id = tr.query_id
     JOIN tracking_runs r ON r.id = tr.run_id
     JOIN tracking_projects p ON p.id = r.project_id
     JOIN tenant_users tu ON tu.tenant_id = p.tenant_id
     LEFT JOIN tracking_citations tc ON tc.result_id = tr.id
     WHERE tr.run_id = $1 AND tu.user_id = $2
     GROUP BY tr.id, tq.query
     ORDER BY tq.created_at ASC, tr.created_at ASC
     LIMIT $3`,
    [runId, userId, limit],
  );

  return res.rows;
}

export async function computeRunInsightsForUser(userId: string, runId: string): Promise<any> {
  const [run, rows] = await Promise.all([
    getRunForUser(userId, runId),
    getRunResultsForUser(userId, runId, 5000),
  ]);

  if (!run) throw new Error('Run not found');

  const byQuery = new Map<string, {
    query: string;
    mentioned: boolean;
    cited: boolean;
    bestPosition: number | null;
    competitorMentions: string[];
  }>();

  for (const row of rows) {
    const key = String(row.query_id);
    const current = byQuery.get(key) || {
      query: String(row.query),
      mentioned: false,
      cited: false,
      bestPosition: null,
      competitorMentions: [],
    };

    current.mentioned = current.mentioned || !!row.mentioned;
    current.cited = current.cited || !!row.cited;

    if (typeof row.position === 'number' && row.position > 0) {
      current.bestPosition = current.bestPosition == null ? row.position : Math.min(current.bestPosition, row.position);
    }

    if (Array.isArray(row.competitor_mentions)) {
      for (const comp of row.competitor_mentions) {
        const norm = normalizeDomain(String(comp || ''));
        if (norm && !current.competitorMentions.includes(norm)) {
          current.competitorMentions.push(norm);
        }
      }
    }

    byQuery.set(key, current);
  }

  const queryRows = Array.from(byQuery.values());
  const totalQueries = queryRows.length;
  const mentionedCount = queryRows.filter((q) => q.mentioned).length;
  const citedCount = queryRows.filter((q) => q.cited).length;
  const positions = queryRows.map((q) => q.bestPosition).filter((p): p is number => typeof p === 'number');

  const competitorCounts = new Map<string, number>();
  for (const q of queryRows) {
    for (const comp of q.competitorMentions) {
      competitorCounts.set(comp, (competitorCounts.get(comp) || 0) + 1);
    }
  }

  return {
    run,
    metrics: {
      visibility_score: totalQueries ? Number(((mentionedCount / totalQueries) * 100).toFixed(2)) : 0,
      citation_score: totalQueries ? Number(((citedCount / totalQueries) * 100).toFixed(2)) : 0,
      avg_position: positions.length ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(2)) : null,
      query_count: totalQueries,
    },
    missing_queries: queryRows.filter((q) => !q.mentioned).map((q) => q.query),
    cited_queries: queryRows.filter((q) => q.cited).map((q) => q.query),
    competitor_appears: Array.from(competitorCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ─── Competitor Discovery Engine ──────────────────────────────────────────

const COMPETITOR_IGNORE = new Set([
  'wikipedia.org',
  'youtube.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'reddit.com',
  'amazon.com',
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'apple.com',
  'microsoft.com',
  'openai.com',
  'anthropic.com',
  'perplexity.ai',
]);

type CompetitorEntry = {
  mentions: number;
  citations: number;
  positions: number[];
};

function extractAllDomains(text: string): string[] {
  const urls = extractUrls(text);
  return Array.from(new Set(urls.map((u) => extractUrlDomain(u)).filter(Boolean)));
}

function computeCompetitorScore(entry: CompetitorEntry): number {
  const avgPos = entry.positions.length
    ? entry.positions.reduce((a, b) => a + b, 0) / entry.positions.length
    : 10;
  return entry.mentions * 0.5 + entry.citations * 0.4 + (1 / Math.max(avgPos, 1)) * 0.1;
}

async function upsertCompetitorRow(domain: string): Promise<string> {
  const res = await getPool().query(
    `INSERT INTO competitors (domain)
     VALUES ($1)
     ON CONFLICT (domain) DO UPDATE SET domain = EXCLUDED.domain
     RETURNING id`,
    [domain],
  );
  return String(res.rows[0].id);
}

async function upsertProjectCompetitorRow(projectId: string, competitorId: string, score: number): Promise<void> {
  await getPool().query(
    `INSERT INTO project_competitors (project_id, competitor_id, score)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, competitor_id) DO UPDATE SET score = EXCLUDED.score`,
    [projectId, competitorId, score],
  );
}

async function saveCompetitorMetricsRow(params: {
  runId: string;
  competitorId: string;
  mentions: number;
  citations: number;
  avgPosition: number | null;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO competitor_metrics (run_id, competitor_id, mentions, citations, avg_position)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (run_id, competitor_id) DO UPDATE
       SET mentions = EXCLUDED.mentions,
           citations = EXCLUDED.citations,
           avg_position = EXCLUDED.avg_position`,
    [params.runId, params.competitorId, params.mentions, params.citations, params.avgPosition],
  );
}

export async function discoverCompetitorsForRun(runId: string, projectId: string): Promise<void> {
  // Resolve own domain
  const runRes = await getPool().query(
    `SELECT p.domain FROM tracking_runs r JOIN tracking_projects p ON p.id = r.project_id WHERE r.id = $1 LIMIT 1`,
    [runId],
  );
  if (!runRes.rowCount) return;
  const ownDomain = normalizeDomain(String(runRes.rows[0].domain));

  // Fetch all raw results + positions for the run
  const resultsRes = await getPool().query(
    `SELECT tr.raw_response, tr.position
     FROM tracking_results tr
     WHERE tr.run_id = $1`,
    [runId],
  );

  // Aggregate domains across results
  const domainMap = new Map<string, CompetitorEntry>();

  for (const row of resultsRes.rows) {
    const text = String(row.raw_response || '');
    const citedDomains = extractAllDomains(text);
    const textLower = text.toLowerCase();

    for (const d of citedDomains) {
      if (!d || d === ownDomain || COMPETITOR_IGNORE.has(d)) continue;

      if (!domainMap.has(d)) {
        domainMap.set(d, { mentions: 0, citations: 0, positions: [] });
      }
      const entry = domainMap.get(d)!;
      entry.citations += 1;
      if (textLower.includes(d)) entry.mentions += 1;
      if (typeof row.position === 'number' && row.position > 0) {
        entry.positions.push(row.position);
      }
    }

    // Also count text-only mentions (no URL) that pass the minimum threshold
    for (const [d, entry] of domainMap) {
      if (!citedDomains.includes(d) && textLower.includes(d)) {
        entry.mentions += 1;
      }
    }
  }

  // Filter: need at least 2 mentions OR at least 1 citation
  const qualified = Array.from(domainMap.entries()).filter(
    ([, data]) => data.mentions > 1 || data.citations > 0,
  );

  if (!qualified.length) return;

  for (const [domain, data] of qualified) {
    try {
      const score = computeCompetitorScore(data);
      const competitorId = await upsertCompetitorRow(domain);
      await upsertProjectCompetitorRow(projectId, competitorId, score);
      const avgPosition = data.positions.length
        ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length
        : null;
      await saveCompetitorMetricsRow({
        runId,
        competitorId,
        mentions: data.mentions,
        citations: data.citations,
        avgPosition,
      });
    } catch {
      // Soft-fail per competitor — never poison the run
    }
  }
}

export async function getRunCompetitorsForUser(userId: string, runId: string): Promise<any[]> {
  const access = await getPool().query(
    `SELECT r.id FROM tracking_runs r
     JOIN tracking_projects p ON p.id = r.project_id
     JOIN tenant_users tu ON tu.tenant_id = p.tenant_id
     WHERE r.id = $1 AND tu.user_id = $2 LIMIT 1`,
    [runId, userId],
  );
  if (!access.rowCount) throw new Error('Unauthorized');

  const res = await getPool().query(
    `SELECT c.domain, cm.mentions, cm.citations, cm.avg_position, pc.score
     FROM competitor_metrics cm
     JOIN competitors c ON c.id = cm.competitor_id
     JOIN tracking_runs r ON r.id = cm.run_id
     JOIN project_competitors pc ON pc.project_id = r.project_id AND pc.competitor_id = cm.competitor_id
     WHERE cm.run_id = $1
     ORDER BY pc.score DESC
     LIMIT 30`,
    [runId],
  );

  return res.rows;
}

export async function getProjectCompetitorsForUser(userId: string, projectId: string): Promise<any[]> {
  const access = await getPool().query(
    `SELECT p.id FROM tracking_projects p
     JOIN tenant_users tu ON tu.tenant_id = p.tenant_id
     WHERE p.id = $1 AND tu.user_id = $2 LIMIT 1`,
    [projectId, userId],
  );
  if (!access.rowCount) throw new Error('Unauthorized');

  const res = await getPool().query(
    `SELECT c.domain, pc.score, c.first_seen,
            (SELECT cm2.mentions FROM competitor_metrics cm2
             JOIN tracking_runs r2 ON r2.id = cm2.run_id
             WHERE r2.project_id = $1 AND cm2.competitor_id = c.id
             ORDER BY r2.created_at DESC LIMIT 1) AS latest_mentions,
            (SELECT cm2.citations FROM competitor_metrics cm2
             JOIN tracking_runs r2 ON r2.id = cm2.run_id
             WHERE r2.project_id = $1 AND cm2.competitor_id = c.id
             ORDER BY r2.created_at DESC LIMIT 1) AS latest_citations,
            (SELECT cm2.avg_position FROM competitor_metrics cm2
             JOIN tracking_runs r2 ON r2.id = cm2.run_id
             WHERE r2.project_id = $1 AND cm2.competitor_id = c.id
             ORDER BY r2.created_at DESC LIMIT 1) AS latest_avg_position,
            (SELECT COUNT(*) FROM competitor_metrics cm3
             JOIN tracking_runs r3 ON r3.id = cm3.run_id
             WHERE r3.project_id = $1 AND cm3.competitor_id = c.id) AS run_appearances
     FROM project_competitors pc
     JOIN competitors c ON c.id = pc.competitor_id
     WHERE pc.project_id = $1
     ORDER BY pc.score DESC
     LIMIT 30`,
    [projectId],
  );

  return res.rows;
}

// ─── Authority + Entity Clarity Engine ────────────────────────────────────

type EntityExtraction = {
  entity_detected: boolean;
  entity_name: string;
  category: string;
  description: string;
  confidence: number;
};

async function callExtractionLLM(prompt: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter extraction returned ${res.status}`);
    const data = await res.json() as any;
    return String(data?.choices?.[0]?.message?.content || '{}');
  } finally {
    clearTimeout(timeout);
  }
}

async function extractEntityFromText(text: string, domain: string): Promise<EntityExtraction> {
  const prompt = `Extract entity information for "${domain}" from this AI-generated text.

Return JSON with these exact keys:
- entity_detected: boolean (true if the domain/product is mentioned or clearly referenced)
- entity_name: string (the product/company name, or "" if not detected)
- category: string (product category e.g. "AI visibility tool", "SEO analytics", or "" if not detected)
- description: string (1 sentence describing what the entity does, or "" if not detected)
- confidence: number 0-1 (how clearly the model identifies and describes the entity)

Text:
${text.slice(0, 2000)}`;

  try {
    const raw = await callExtractionLLM(prompt);
    const parsed = JSON.parse(raw) as Partial<EntityExtraction>;
    return {
      entity_detected: parsed.entity_detected === true,
      entity_name: String(parsed.entity_name || '').trim(),
      category: String(parsed.category || '').trim(),
      description: String(parsed.description || '').trim(),
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    };
  } catch {
    return { entity_detected: false, entity_name: '', category: '', description: '', confidence: 0 };
  }
}

function validateEntityExtraction(entity: EntityExtraction, domain: string, text: string): EntityExtraction {
  const mentionsDomain = text.toLowerCase().includes(domain.toLowerCase());
  return {
    ...entity,
    entity_detected: entity.entity_detected && mentionsDomain,
    confidence: entity.confidence * (mentionsDomain ? 1 : 0.5),
  };
}

async function saveEntitySnapshot(params: {
  runId: string;
  queryId: string;
  model: string;
  entity: EntityExtraction;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO entity_snapshots (run_id, query_id, model, entity_detected, entity_name, category, description, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (run_id, query_id, model) DO UPDATE
       SET entity_detected = EXCLUDED.entity_detected,
           entity_name = EXCLUDED.entity_name,
           category = EXCLUDED.category,
           description = EXCLUDED.description,
           confidence = EXCLUDED.confidence`,
    [
      params.runId,
      params.queryId,
      params.model,
      params.entity.entity_detected,
      params.entity.entity_name || null,
      params.entity.category || null,
      params.entity.description || null,
      params.entity.confidence,
    ],
  );
}

// Jaccard word similarity — description consistency proxy without embeddings
function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  if (!wordsA.size || !wordsB.size) return 0;
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

function computeCategoryConsistency(categories: string[]): number {
  const valid = categories.filter(Boolean);
  if (!valid.length) return 0;
  const counts: Record<string, number> = {};
  for (const c of valid) {
    const norm = c.toLowerCase().trim();
    counts[norm] = (counts[norm] || 0) + 1;
  }
  const max = Math.max(...Object.values(counts));
  return max / valid.length;
}

function computeDescriptionConsistency(descriptions: string[]): number {
  const valid = descriptions.filter(Boolean);
  if (valid.length < 2) return valid.length === 1 ? 1 : 0;
  let total = 0;
  let count = 0;
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      total += jaccardSimilarity(valid[i], valid[j]);
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

export async function runEntityExtractionForRun(runId: string, _projectId: string): Promise<void> {
  const runRes = await getPool().query(
    `SELECT p.domain FROM tracking_runs r JOIN tracking_projects p ON p.id = r.project_id WHERE r.id = $1 LIMIT 1`,
    [runId],
  );
  if (!runRes.rowCount) return;
  const domain = normalizeDomain(String(runRes.rows[0].domain));

  // Fetch AI-model results (exclude serp-fallback) — cap at 25 for cost control
  const resultsRes = await getPool().query(
    `SELECT id, query_id, model, raw_response
     FROM tracking_results
     WHERE run_id = $1 AND model != 'serp-fallback'
     ORDER BY created_at ASC
     LIMIT 25`,
    [runId],
  );

  for (const row of resultsRes.rows) {
    try {
      const raw = await extractEntityFromText(String(row.raw_response || ''), domain);
      const validated = validateEntityExtraction(raw, domain, String(row.raw_response || ''));
      await saveEntitySnapshot({
        runId,
        queryId: String(row.query_id),
        model: String(row.model),
        entity: validated,
      });
    } catch {
      // soft-fail per result — never poison the run
    }
  }
}

export type EntityClarityResult = {
  entity_clarity_score: number;
  authority_score: number;
  recognition_rate: number;
  category_consistency: number;
  description_consistency: number;
  avg_confidence: number;
  dominant_category: string | null;
  all_categories: Array<{ category: string; count: number }>;
  sample_descriptions: string[];
  total_snapshots: number;
  insights: string[];
};

export async function getEntityClarityForRun(userId: string, runId: string): Promise<EntityClarityResult | null> {
  const access = await getPool().query(
    `SELECT r.id FROM tracking_runs r
     JOIN tracking_projects p ON p.id = r.project_id
     JOIN tenant_users tu ON tu.tenant_id = p.tenant_id
     WHERE r.id = $1 AND tu.user_id = $2 LIMIT 1`,
    [runId, userId],
  );
  if (!access.rowCount) throw new Error('Unauthorized');

  const snapshotsRes = await getPool().query(
    `SELECT entity_detected, category, description, confidence
     FROM entity_snapshots
     WHERE run_id = $1`,
    [runId],
  );
  if (!snapshotsRes.rowCount) return null;

  const snapshots = snapshotsRes.rows;
  const total = snapshots.length;
  const detected = snapshots.filter((s: any) => s.entity_detected);
  const recognition_rate = total > 0 ? detected.length / total : 0;

  const categories = detected.map((s: any) => String(s.category || '').toLowerCase().trim()).filter(Boolean);
  const category_consistency = computeCategoryConsistency(categories);

  const descriptions = detected.map((s: any) => String(s.description || '').trim()).filter(Boolean);
  const description_consistency = computeDescriptionConsistency(descriptions);

  const avg_confidence = detected.length > 0
    ? detected.reduce((sum: number, s: any) => sum + Number(s.confidence || 0), 0) / detected.length
    : 0;

  const entity_clarity_score = Math.round(
    (recognition_rate * 0.4 + category_consistency * 0.3 + description_consistency * 0.2 + avg_confidence * 0.1) * 100,
  );

  // Authority signals from run metrics
  const metricsRes = await getPool().query(
    `SELECT
       COUNT(*) FILTER (WHERE mentioned)::float / NULLIF(COUNT(*), 0) AS mention_rate,
       COUNT(*) FILTER (WHERE cited)::float / NULLIF(COUNT(*), 0) AS citation_rate,
       AVG(CASE WHEN position IS NOT NULL THEN 1.0 / NULLIF(position, 0) ELSE 0 END) AS avg_pos_score
     FROM tracking_results
     WHERE run_id = $1`,
    [runId],
  );
  const m = metricsRes.rows[0] || {};
  const mention_rate = Number(m.mention_rate || 0);
  const citation_rate = Number(m.citation_rate || 0);
  const avg_position_score = Number(m.avg_pos_score || 0);

  // Co-occurrence: ratio of results where other domains are also cited
  const coOccRes = await getPool().query(
    `SELECT COUNT(*) FILTER (WHERE competitor_mentions != '[]'::jsonb)::float / NULLIF(COUNT(*), 0) AS co_occ_rate
     FROM tracking_results
     WHERE run_id = $1`,
    [runId],
  );
  const co_occurrence_score = Number(coOccRes.rows[0]?.co_occ_rate || 0);

  const authority_score = Math.round(
    (mention_rate * 0.4 + citation_rate * 0.4 + avg_position_score * 0.1 + co_occurrence_score * 0.1) * 100,
  );

  // Category breakdown
  const catCounts: Record<string, number> = {};
  for (const c of categories) {
    catCounts[c] = (catCounts[c] || 0) + 1;
  }
  const all_categories = Object.entries(catCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  const dominant_category = all_categories[0]?.category || null;

  // Insight generation
  const insights: string[] = [];

  if (recognition_rate < 0.4) {
    insights.push('AI models fail to recognize your entity in most queries — your brand signal is too weak.');
  } else if (recognition_rate < 0.7) {
    insights.push('AI sometimes recognizes you, but inconsistently — entity clarity needs strengthening.');
  }

  if (all_categories.length >= 3) {
    const top3 = all_categories.slice(0, 3).map((c) => `"${c.category}"`).join(', ');
    insights.push(`AI categorizes you as ${all_categories.length} different things: ${top3} — models are unsure what you are.`);
  } else if (category_consistency < 0.6 && all_categories.length > 1) {
    insights.push(`Your category is split between "${all_categories[0]?.category}" and "${all_categories[1]?.category}" — models disagree on what you do.`);
  }

  if (description_consistency < 0.3) {
    insights.push('Your product description drifts significantly across AI responses — no consistent signal.');
  } else if (description_consistency < 0.6) {
    insights.push('Description consistency is moderate — AI describes you differently depending on the query.');
  }

  if (citation_rate > 0.3 && recognition_rate < 0.5) {
    insights.push('You are being cited, but AI doesn\'t understand what you are — citation without entity clarity.');
  }

  if (mention_rate > 0.6 && citation_rate < 0.2) {
    insights.push('AI mentions you frequently but rarely cites you — you are known but not trusted enough to link.');
  }

  if (entity_clarity_score >= 75) {
    insights.push('Strong entity clarity — models understand and consistently describe your product.');
  } else if (entity_clarity_score >= 50) {
    insights.push('Moderate entity clarity — recognizable but inconsistent. Strengthen structured entity signals.');
  }

  return {
    entity_clarity_score,
    authority_score,
    recognition_rate: Number((recognition_rate * 100).toFixed(1)),
    category_consistency: Number((category_consistency * 100).toFixed(1)),
    description_consistency: Number((description_consistency * 100).toFixed(1)),
    avg_confidence: Number((avg_confidence * 100).toFixed(1)),
    dominant_category,
    all_categories: all_categories.slice(0, 5),
    sample_descriptions: descriptions.slice(0, 3),
    total_snapshots: total,
    insights,
  };
}

// ── SERP-enhanced entity clarity (Alignment+ tiers) ─────────────────────────

export type EntityClarityWithSERP = EntityClarityResult & {
  serp_signals: import('../services/serpService.js').SERPSignals | null;
  serp_boost: import('../services/serpService.js').SERPScoreBoost | null;
  serp_enhanced: boolean;
};

/**
 * Wrapper around getEntityClarityForRun that optionally enriches the result
 * with live SERP signals from SerpAPI. Available for Alignment, Signal, and
 * Score Fix tiers only. Falls back gracefully if SERP API is unavailable.
 *
 * SERP signals add score boosts to entity_clarity_score and authority_score
 * based on: knowledge panel, sitelinks, rich results, featured snippet,
 * organic position, and People Also Ask question count.
 */
export async function getEntityClarityWithSERP(
  userId: string,
  runId: string,
  tier: string,
): Promise<EntityClarityWithSERP | null> {
  const { meetsMinimumTier } = await import('../../../shared/types.js');
  const eligibleForSERP = meetsMinimumTier(tier as any, 'alignment');

  // Base entity clarity (always computed)
  const base = await getEntityClarityForRun(userId, runId);
  if (!base) return null;

  let serp_signals: import('../services/serpService.js').SERPSignals | null = null;
  let serp_boost: import('../services/serpService.js').SERPScoreBoost | null = null;

  if (eligibleForSERP) {
    try {
      const { fetchSERPSignals, saveSERPSnapshot, computeSERPBoosts, getCachedSERPSnapshot, isSERPAvailable } =
        await import('../services/serpService.js');

      if (isSERPAvailable()) {
        // Resolve domain from run
        const runRes = await getPool().query(
          `SELECT tp.domain
           FROM tracking_runs tr
           JOIN tracking_projects tp ON tp.id = tr.project_id
           WHERE tr.id = $1 LIMIT 1`,
          [runId],
        );
        const domain: string = runRes.rows[0]?.domain || '';
        if (domain) {
          const brand = domain.replace(/^www\./, '').replace(/\.[^.]+$/, '').split('.')[0];

          // Check cache first (24h TTL)
          serp_signals = await getCachedSERPSnapshot(userId, domain) ?? await fetchSERPSignals(brand, domain);
          if (serp_signals) {
            // Persist for future requests
            saveSERPSnapshot(userId, serp_signals).catch(() => { });
            serp_boost = computeSERPBoosts(serp_signals);

            // Apply boosts (capped at 100)
            base.entity_clarity_score = Math.min(
              100,
              base.entity_clarity_score + serp_boost.entity_clarity_boost,
            );
            base.authority_score = Math.min(
              100,
              base.authority_score + serp_boost.authority_boost,
            );

            // Prepend SERP insights
            if (serp_boost.reasons.length > 0) {
              base.insights = [...serp_boost.reasons, ...base.insights];
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[Tracking] SERP enrichment failed (non-fatal):', err?.message);
    }
  }

  return {
    ...base,
    serp_signals,
    serp_boost,
    serp_enhanced: Boolean(serp_signals),
  };
}

// ── Named Entity Recognition (NER) ──────────────────────────────────────────

/**
 * Run zero-cost NER on all AI responses for a tracking run.
 * Aggregates entity counts across results and upserts into ner_run_entities.
 */
export async function runNERForRun(runId: string, _projectId: string): Promise<void> {
  // Fetch run metadata for brand/domain context
  const runRes = await getPool().query(
    `SELECT tr.id, tp.domain
     FROM tracking_runs tr
     JOIN tracking_projects tp ON tp.id = tr.project_id
     WHERE tr.id = $1 LIMIT 1`,
    [runId],
  );
  if (!runRes.rowCount) return;

  const domain: string = runRes.rows[0].domain || '';
  const brand = domain.replace(/^www\./, '').replace(/\.[^.]+$/, '');

  // Fetch raw AI responses for this run
  const resultsRes = await getPool().query(
    `SELECT id, raw_response FROM tracking_results WHERE run_id = $1 AND raw_response IS NOT NULL`,
    [runId],
  );
  if (!resultsRes.rowCount) return;

  // Run NER on each result
  const perResult = resultsRes.rows.map((row: any) =>
    extractEntitiesFromText(String(row.raw_response || ''), brand, domain),
  );

  const aggregated = filterEntities(aggregateEntities(perResult));

  if (aggregated.length === 0) return;

  // Upsert into ner_run_entities
  for (const entity of aggregated) {
    await getPool().query(
      `INSERT INTO ner_run_entities (run_id, entity_text, entity_type, total_count, is_target_brand, result_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id, entity_text)
       DO UPDATE SET
         total_count = EXCLUDED.total_count,
         result_count = EXCLUDED.result_count,
         entity_type = EXCLUDED.entity_type,
         is_target_brand = EXCLUDED.is_target_brand`,
      [runId, entity.text, entity.type, entity.count, entity.is_target_brand, entity.result_count],
    );
  }
}

/**
 * Return aggregated NER entities for a run, with run-level summary stats.
 * Throws 'Unauthorized' if the caller doesn't own the run.
 */
export async function getNERForRun(userId: string, runId: string): Promise<NERRunSummary | null> {
  // Auth: ensure caller owns this run via tenant membership
  const access = await getPool().query(
    `SELECT r.id FROM tracking_runs r
     JOIN tracking_projects p ON p.id = r.project_id
     JOIN tenant_users tu ON tu.tenant_id = p.tenant_id
     WHERE r.id = $1 AND tu.user_id = $2 LIMIT 1`,
    [runId, userId],
  );
  if (!access.rowCount) throw new Error('Unauthorized');

  const entitiesRes = await getPool().query(
    `SELECT entity_text, entity_type, total_count, is_target_brand, result_count
     FROM ner_run_entities
     WHERE run_id = $1
     ORDER BY total_count DESC`,
    [runId],
  );
  if (!entitiesRes.rowCount) return null;

  const entities = entitiesRes.rows.map((r: any) => ({
    text: r.entity_text as string,
    type: r.entity_type as 'ORG' | 'PRODUCT' | 'PERSON' | 'LOCATION' | 'BRAND',
    total_count: Number(r.total_count),
    result_count: Number(r.result_count),
    is_target_brand: Boolean(r.is_target_brand),
  }));

  const org_count = entities.filter((e) => e.type === 'ORG').length;
  const product_count = entities.filter((e) => e.type === 'PRODUCT').length;
  const person_count = entities.filter((e) => e.type === 'PERSON').length;
  const location_count = entities.filter((e) => e.type === 'LOCATION').length;
  const co_mentioned_count = entities.filter(
    (e) => !e.is_target_brand && (e.type === 'ORG' || e.type === 'PRODUCT' || e.type === 'BRAND'),
  ).length;

  return {
    run_id: runId,
    entities,
    total_unique_entities: entities.length,
    org_count,
    product_count,
    person_count,
    location_count,
    co_mentioned_count,
  };
}
