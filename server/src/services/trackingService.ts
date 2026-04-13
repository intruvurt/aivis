import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from './postgresql.js';
import { checkBingSearchPresence, checkWebSearchPresence } from './webSearch.js';

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
  domain: string;
  competitorDomains: string[];
  queries: Array<{ id: string; query: string }>;
}> {
  const runRes = await getPool().query(
    `SELECT r.id, r.project_id, p.domain, COALESCE(p.competitor_domains, '[]'::jsonb) AS competitor_domains
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

async function getCachedModelResponse(query: string, model: string): Promise<string | null> {
  const hash = createHash('sha256').update(query.toLowerCase()).digest('hex');
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

async function setCachedModelResponse(query: string, model: string, text: string): Promise<void> {
  const hash = createHash('sha256').update(query.toLowerCase()).digest('hex');
  await getPool().query(
    `INSERT INTO tracking_query_cache (query_hash, model, raw_response, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '6 hours')`,
    [hash, model, text],
  );
}

export async function runAcrossModelsCached(query: string, domain: string): Promise<TrackingModelResponse[]> {
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
    const cached = await getCachedModelResponse(query, m.model);
    if (cached) {
      return { model: m.model, text: cached };
    }
    const live = await withTimeout(m.fn(), MODEL_TIMEOUT_MS, m.model);
    await setCachedModelResponse(query, m.model, live.text).catch(() => {});
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
