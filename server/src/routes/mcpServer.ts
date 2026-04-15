/**
 * MCP (Model Context Protocol) Server Endpoint
 *
 * Exposes AiVIS audit and analytics tools to AI agents via MCP-style
 * JSON-RPC 2.0 over HTTP. Authentication via Bearer avis_* API key or
 * OAuth avist_* access token.
 *
 * Routes:
 *   GET  /api/mcp           - Server metadata and capabilities
 *   GET  /api/mcp/tools     - List available tools
 *   POST /api/mcp/call      - Execute a tool
 */
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
const uuidv4 = () => crypto.randomUUID();
import { getPool } from '../services/postgresql.js';
import { validateApiKey } from '../services/apiKeyService.js';
import { getRequestAuthToken } from '../lib/authSession.js';
import { normalizePublicHttpUrl, isPrivateOrLocalHost } from '../lib/urlSafety.js';
import { TIER_LIMITS, uiTierFromCanonical, meetsMinimumTier, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';
import { verifyUserToken } from '../lib/utils/jwt.js';
import { getUserById } from '../models/User.js';
import { enforceEffectiveTier } from '../services/entitlementGuard.js';
import { processQueuedAudit } from '../services/mcpAuditProcessor.js';
import { ensureDefaultWorkspaceForUser } from '../services/tenantService.js';
import { computeCitationRankScore } from '../services/citationRankScoreService.js';

const router = Router();

// ── Auth: accept both API key and OAuth token ────────────────────────────────

async function mcpAuth(req: Request, res: Response, next: NextFunction) {
  const token = getRequestAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header. Use Bearer avis_* or avist_*' });
  }
  const pool = getPool();

  // API key path
  if (token.startsWith('avis_')) {
    const result = await validateApiKey(token);
    if (!result.ok) {
      const isTierBlocked = result.reason === 'tier_blocked';
      return res.status(isTierBlocked ? 403 : 401).json({ error: isTierBlocked ? 'MCP Server requires Alignment or higher plan.' : 'Invalid API key', code: result.reason });
    }
    // Alignment+ gate - MCP tooling is an Alignment-tier capability (matches WebMCP)
    const { rows: tierRows } = await pool.query(`SELECT tier FROM users WHERE id = $1`, [result.userId]);
    if (!meetsMinimumTier((tierRows[0]?.tier || 'observer') as CanonicalTier | LegacyTier, 'alignment')) {
      return res.status(403).json({ error: 'MCP Server requires Alignment or higher plan.' });
    }
    (req as any).mcpUserId = result.userId;
    (req as any).mcpWorkspaceId = result.workspaceId;
    (req as any).mcpScopes = result.scopes;
    return next();
  }

  // OAuth token path
  if (token.startsWith('avist_')) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(
      `SELECT user_id, scopes, expires_at, revoked FROM oauth_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (!rows.length || rows[0].revoked || new Date(rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired OAuth token' });
    }
    // Enforce tier gate on OAuth token path - same check as API key validation
    const { rows: userRows } = await pool.query(
      `SELECT tier FROM users WHERE id = $1`, [rows[0].user_id]
    );
    if (!meetsMinimumTier((userRows[0]?.tier || 'observer') as CanonicalTier | LegacyTier, 'alignment')) {
      return res.status(403).json({ error: 'MCP Server requires Alignment or higher plan.' });
    }

    const scopes: string[] = typeof rows[0].scopes === 'string' ? JSON.parse(rows[0].scopes) : rows[0].scopes;
    (req as any).mcpUserId = rows[0].user_id;
    (req as any).mcpScopes = scopes;

    // Look up default workspace for OAuth user (auto-create if missing)
    const { rows: wsRows } = await pool.query(
      `SELECT w.id FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND w.is_default = TRUE
       LIMIT 1`,
      [rows[0].user_id]
    );
    if (wsRows[0]?.id) {
      (req as any).mcpWorkspaceId = wsRows[0].id;
    } else {
      const ctx = await ensureDefaultWorkspaceForUser(rows[0].user_id);
      (req as any).mcpWorkspaceId = ctx.workspaceId;
    }
    return next();
  }

  // JWT path - allows the in-app MCP Console (which sends the session JWT)
  try {
    const decoded = verifyUserToken(token);
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found for JWT' });
    }
    const effectiveTier = await enforceEffectiveTier(user);
    if (!meetsMinimumTier((effectiveTier || 'observer') as CanonicalTier | LegacyTier, 'alignment')) {
      return res.status(403).json({ error: 'MCP Server requires Alignment or higher plan.' });
    }
    (req as any).mcpUserId = user.id;
    (req as any).mcpScopes = ['read:audits', 'write:audits', 'read:analytics', 'read:competitors'];
    const { rows: wsRows } = await pool.query(
      `SELECT w.id FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND w.is_default = TRUE
       LIMIT 1`,
      [user.id]
    );
    if (wsRows[0]?.id) {
      (req as any).mcpWorkspaceId = wsRows[0].id;
    } else {
      const ctx = await ensureDefaultWorkspaceForUser(user.id, user.name || user.email);
      (req as any).mcpWorkspaceId = ctx.workspaceId;
    }
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token. Use avis_* API key, avist_* OAuth token, or a valid session JWT.' });
  }
}

router.use(mcpAuth);

// ── Tool definitions ─────────────────────────────────────────────────────────

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredScope: string;
}

const TOOLS: MCPTool[] = [
  {
    name: 'run_audit',
    description: 'Queue an AI visibility audit for a URL. Returns immediately with audit ID. Poll /api/mcp/async/{audit_id}/status to check completion.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to audit (must be public)' },
        goal: { type: 'string', description: 'Optional goal or context (1-200 chars)' },
        bypass_cache: { type: 'boolean', description: 'Force new audit (skip cache)' },
        platform_focus: {
          type: 'array',
          items: { enum: ['chatgpt', 'claude', 'gemini', 'perplexity'] },
          description: 'Platforms to emphasize in analysis',
        },
      },
      required: ['url'],
    },
    requiredScope: 'write:audits',
  },
  {
    name: 'list_audits',
    description: 'List AI visibility audits with pagination. Returns audit IDs, URLs, scores, and timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Results per page (1–100, default 25)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
    },
    requiredScope: 'read:audits',
  },
  {
    name: 'get_audit',
    description: 'Get the full audit result for a specific audit ID, including visibility score, recommendations, content analysis, and AI platform scores.',
    inputSchema: {
      type: 'object',
      properties: {
        audit_id: { type: 'string', description: 'UUID of the audit to retrieve' },
      },
      required: ['audit_id'],
    },
    requiredScope: 'read:audits',
  },
  {
    name: 'get_analytics',
    description: 'Get score history grouped by URL with platform averages (ChatGPT, Perplexity, Google AI, Claude).',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Lookback window in days (1–365, default 90)' },
      },
    },
    requiredScope: 'read:analytics',
  },
  {
    name: 'get_evidence',
    description: 'Get evidence manifest & recommendation evidence for an audit, including content highlights and AI-graded recommendation strength.',
    inputSchema: {
      type: 'object',
      properties: {
        audit_id: { type: 'string', description: 'UUID of the audit' },
      },
      required: ['audit_id'],
    },
    requiredScope: 'read:audits',
  },
  {
    name: 'run_page_validation',
    description: 'Run a technical page validation check on a URL. Checks title, meta description, canonical, H1, JSON-LD, word count, and HTTPS.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public URL to validate' },
      },
      required: ['url'],
    },
    requiredScope: 'read:audits',
  },
  {
    name: 'list_competitors',
    description: 'List all tracked competitors with their latest visibility scores.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    requiredScope: 'read:audits',
  },
  {
    name: 'get_usage',
    description: 'Get current-month metered API usage for this key and workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    requiredScope: 'read:audits',
  },
  {
    name: 'run_citation_test',
    description: 'Test whether a URL is cited by AI answer engines. Runs queries across platforms (ChatGPT, Perplexity, Claude, Google AI) and returns a citation presence matrix.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Brand URL to test citation presence for' },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['chatgpt', 'perplexity', 'claude', 'google_ai'] },
          description: 'Platforms to test (default: all four)',
        },
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific queries to test. If omitted, queries must be provided via the citation test API.',
        },
      },
      required: ['url'],
    },
    requiredScope: 'write:audits',
  },
  {
    name: 'validate_queries_evidence',
    description: 'Run a set of queries against live AI models and extract evidence IDs showing exactly where a brand appears (or doesn\'t) in each model response. Returns a probabilistic CitationRankScore, per-query model coverage, ranked positions, and signed evidence IDs for audit trails. Signal tier required.',
    inputSchema: {
      type: 'object',
      properties: {
        brand: {
          type: 'string',
          description: 'Brand name to search for in AI model responses (e.g. \'Acme Corp\')',
        },
        url: {
          type: 'string',
          description: 'Canonical brand URL — used for snapshot persistence and identity matching',
        },
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Test queries to run across AI models (1–20). Example: ["best project management tools", "alternatives to Notion"]',
        },
      },
      required: ['brand', 'url', 'queries'],
    },
    requiredScope: 'write:audits',
  },
];

// ── Tool executors ───────────────────────────────────────────────────────────

type ToolExecutor = (params: Record<string, any>, userId: string, workspaceId: string) => Promise<any>;

const executors: Record<string, ToolExecutor> = {
  async run_audit(params, userId, workspaceId) {
    if (!workspaceId) throw new Error('No workspace found. Please sign out and back in, or contact support.');
    const { url, goal, bypass_cache, platform_focus } = params;

    // Validate and normalize URL
    const normalized = normalizePublicHttpUrl(String(url));
    if (!normalized.ok) throw new Error(normalized.error);
    if (isPrivateOrLocalHost(new URL(normalized.url).hostname)) {
      throw new Error('Private and localhost URLs are not allowed');
    }

    // Create audit record with queued status
    const auditId = uuidv4();
    const pool = getPool();

    // Insert with core columns first, then try adding goal/platform_focus if columns exist
    await pool.query(
      `INSERT INTO audits (id, user_id, workspace_id, url, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [auditId, userId, workspaceId, normalized.url, 'queued'],
    );
    // Best-effort: update goal/platform_focus if migration has added those columns
    if (goal || (platform_focus && platform_focus.length)) {
      pool.query(
        `UPDATE audits SET goal = COALESCE($2, goal), platform_focus = COALESCE($3, platform_focus) WHERE id = $1`,
        [auditId, goal || null, JSON.stringify(platform_focus || [])],
      ).catch(() => { /* columns may not exist yet — safe to ignore */ });
    }

    // Fire off background processing (don't await - return immediately)
    processQueuedAudit(auditId, userId, workspaceId, normalized.url).catch((err) => {
      console.error(`[mcp] Background audit ${auditId} failed:`, err?.message);
    });

    return {
      audit_id: auditId,
      status: 'queued',
      status_endpoint: `/api/mcp/async/${auditId}/status`,
      estimated_wait_seconds: 30,
      queued_at: new Date().toISOString(),
    };
  },

  async list_audits(params, userId, workspaceId) {
    const limit = Math.min(Math.max(parseInt(params.limit) || 25, 1), 100);
    const offset = Math.max(parseInt(params.offset) || 0, 0);
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, created_at FROM audits
       WHERE user_id = $1 AND workspace_id = $2
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [userId, workspaceId, limit, offset]
    );
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM audits WHERE user_id = $1 AND workspace_id = $2`,
      [userId, workspaceId]
    );
    return { audits: rows, total: countRows[0]?.total || 0, limit, offset };
  },

  async get_audit(params, userId, workspaceId) {
    if (!params.audit_id) throw new Error('audit_id is required');
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, result, created_at FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [params.audit_id, userId, workspaceId]
    );
    if (!rows.length) throw new Error('Audit not found');
    return rows[0];
  },

  async get_analytics(params, userId, workspaceId) {
    const days = Math.min(Math.max(parseInt(params.days) || 90, 1), 365);
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT url, visibility_score, created_at FROM audits
       WHERE user_id = $1 AND workspace_id = $2 AND created_at >= NOW() - INTERVAL '1 day' * $3
       ORDER BY created_at DESC`,
      [userId, workspaceId, days]
    );

    const byUrl: Record<string, { url: string; scores: { score: number; date: string }[] }> = {};
    for (const row of rows) {
      if (!byUrl[row.url]) byUrl[row.url] = { url: row.url, scores: [] };
      byUrl[row.url].scores.push({ score: row.visibility_score, date: row.created_at });
    }
    const flat = rows.map((r) => Number(r.visibility_score)).filter(Number.isFinite);
    return {
      urls: Object.values(byUrl),
      summary: {
        total: rows.length,
        avg_score: flat.length ? Math.round(flat.reduce((a, b) => a + b, 0) / flat.length) : 0,
        best: flat.length ? Math.max(...flat) : 0,
        worst: flat.length ? Math.min(...flat) : 0,
      },
      period_days: days,
    };
  },

  async get_evidence(params, userId, workspaceId) {
    if (!params.audit_id) throw new Error('audit_id is required');
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, url, result, created_at FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [params.audit_id, userId, workspaceId]
    );
    if (!rows.length) throw new Error('Audit not found');
    const result = rows[0].result;
    return {
      audit_id: rows[0].id,
      url: rows[0].url,
      scanned_at: rows[0].created_at,
      evidence_fields: result?.evidence_manifest || result?.evidenceManifest || {},
      content_highlights: result?.content_highlights || [],
      recommendations: (result?.recommendations || []).map((r: any) => ({
        title: r.title,
        priority: r.priority,
        category: r.category,
      })),
    };
  },

  async run_page_validation(params, userId, workspaceId) {
    const urlInput = String(params.url || '');
    const normalized = normalizePublicHttpUrl(urlInput);
    if (!normalized.ok) throw new Error(normalized.error);

    if (isPrivateOrLocalHost(new URL(normalized.url).hostname)) {
      throw new Error('Private and localhost URLs are not allowed');
    }

    const response = await fetch(normalized.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'AiVIS-MCP/1.0 (+https://aivis.biz)', Accept: 'text/html' },
    });
    const html = await response.text();

    // Dynamic import cheerio
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    const title = ($('title').first().text() || '').trim();
    const meta = ($('meta[name="description"]').attr('content') || '').trim();
    const canonical = ($('link[rel="canonical"]').attr('href') || '').trim();
    const h1Count = $('h1').length;
    const jsonLdCount = $('script[type="application/ld+json"]').length;
    const words = ($('body').text().replace(/\s+/g, ' ').trim()).split(' ').length;

    const checks = {
      hasTitle: title.length > 0,
      hasMetaDescription: meta.length > 0,
      hasCanonical: canonical.length > 0,
      hasSingleH1: h1Count === 1,
      hasJsonLd: jsonLdCount > 0,
      minWordCount300: words >= 300,
      usesHttps: normalized.url.startsWith('https://'),
    };
    const passed = Object.values(checks).filter(Boolean).length;

    // Persist result
    const pool = getPool();
    const validationResult = { checks, metrics: { title_length: title.length, meta_description_length: meta.length, h1_count: h1Count, json_ld_count: jsonLdCount, word_count: words }, summary: { passed, total: 7, score_percent: Math.round((passed / 7) * 100) } };
    await pool.query(
      `INSERT INTO api_page_validations (user_id, workspace_id, url, result)
       VALUES ($1, $2, $3, $4)`,
      [userId, workspaceId, normalized.url, validationResult]
    );

    return {
      url: normalized.url,
      checks,
      score_percent: Math.round((passed / 7) * 100),
      metrics: { title_length: title.length, meta_description_length: meta.length, h1_count: h1Count, json_ld_count: jsonLdCount, word_count: words },
    };
  },

  async list_competitors(_params, userId, workspaceId) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, competitor_url, nickname, latest_score, created_at, updated_at
       FROM competitor_tracking WHERE user_id = $1 AND workspace_id = $2 ORDER BY created_at DESC`,
      [userId, workspaceId]
    );
    return { competitors: rows };
  },

  async get_usage(_params, userId, workspaceId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(requests), 0)::int AS total FROM api_usage_daily
       WHERE user_id = $1 AND workspace_id = $2 AND date >= $3 AND date <= $4`,
      [userId, workspaceId, monthStart, monthEnd]
    );
    return { month_start: monthStart, month_end: monthEnd, requests_this_month: Number(rows[0]?.total || 0) };
  },

  async run_citation_test(params, userId, _workspaceId) {
    const normalized = normalizePublicHttpUrl(String(params.url));
    if (!normalized.ok) throw new Error(normalized.error);

    const platforms = params.platforms || ['chatgpt', 'perplexity', 'claude', 'google_ai'];
    const queries: string[] = params.queries || [];
    const pool = getPool();

    const { rows: created } = await pool.query(
      `INSERT INTO citation_tests (user_id, url, queries, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [userId, normalized.url, JSON.stringify(queries)],
    );

    const testId = created[0].id;

    return {
      test_id: testId,
      url: normalized.url,
      status: 'pending',
      platforms,
      query_count: queries.length,
      status_endpoint: `/api/citations/test/${testId}`,
      message: queries.length
        ? 'Citation test started. Poll the status_endpoint for results.'
        : 'Citation test created. Provide queries via the citation test API to execute.',
    };
  },

  async validate_queries_evidence(params, userId, _workspaceId) {
    const { brand, url: rawUrl, queries } = params;

    if (!brand || typeof brand !== 'string' || brand.trim().length < 2) {
      throw new Error('brand is required (min 2 characters)');
    }
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error('queries array is required (min 1 item)');
    }
    if (queries.length > 20) throw new Error('Maximum 20 queries per call');

    const normalized = normalizePublicHttpUrl(String(rawUrl));
    if (!normalized.ok) throw new Error(normalized.error);

    const pool = getPool();
    const { rows: userRows } = await pool.query(
      `SELECT tier FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const tier = userRows[0]?.tier || 'alignment';
    const rankTier: 'alignment' | 'signal' = tier === 'signal' || tier === 'scorefix' ? 'signal' : 'alignment';

    const apiKey =
      process.env.OPENROUTER_API_KEY ||
      process.env.OPEN_ROUTER_API_KEY ||
      null;
    if (!apiKey) throw new Error('AI provider not configured on the server');

    const cleanBrand = brand.trim().slice(0, 100);
    const cleanQueries: string[] = queries
      .map((q: any) => String(q || '').trim().slice(0, 200))
      .filter((q: string) => q.length > 3)
      .slice(0, 20);

    const result = await computeCitationRankScore(
      cleanBrand,
      normalized.url,
      cleanQueries,
      rankTier,
      apiKey,
    );

    return {
      brand: cleanBrand,
      url: normalized.url,
      citation_rank_score: result.citation_rank_score,
      tier_label: result.tier_label,
      queries_tested: result.queries_tested,
      models_tested: result.models_tested,
      found_count: result.found_count,
      evidence_results: result.evidence_results,
      computed_at: result.computed_at,
    };
  },
};

// ── MCP Endpoints ────────────────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'aivis',
    version: '1.0.0',
    description: 'AiVIS Evidence-backed site analysis for AI answers Platform - audit, evidence, analytics, and competitor tools for AI agents.',
    protocol: 'mcp-http-v1',
    auth: ['Bearer avis_* (API key)', 'Bearer avist_* (OAuth token)'],
    endpoints: {
      tools: '/api/mcp/tools',
      call: '/api/mcp/call',
    },
  });
});

router.get('/tools', (_req: Request, res: Response) => {
  const scopes: string[] = ((_req as any).mcpScopes) || [];
  const available = TOOLS.filter((t) => scopes.includes(t.requiredScope));
  res.json({
    tools: available.map(({ requiredScope, ...t }) => t),
  });
});

router.post('/call', async (req: Request, res: Response) => {
  try {
    const { name, arguments: args } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Tool name is required in body.name' });
    }

    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      return res.status(404).json({ error: `Unknown tool: ${name}` });
    }

    const scopes: string[] = ((req as any).mcpScopes) || [];
    if (!scopes.includes(tool.requiredScope)) {
      return res.status(403).json({ error: `Missing scope: ${tool.requiredScope}` });
    }

    const executor = executors[name];
    if (!executor) {
      return res.status(501).json({ error: `Tool ${name} has no executor` });
    }

    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;

    // Audit log for MCP tool invocations
    const xff = req.headers['x-forwarded-for'];
    const clientIp = typeof xff === 'string' ? xff.split(',')[0]?.trim() : req.ip || '';
    const authHeader = req.headers.authorization || '';
    let authType = 'unknown';
    if (authHeader.startsWith('Bearer avis_')) authType = 'api_key';
    else if (authHeader.startsWith('Bearer avist_')) authType = 'oauth';
    else if (authHeader.startsWith('Bearer ')) authType = 'jwt';
    console.log(`[mcp-audit] tool=${name} uid=${userId} ws=${workspaceId} auth=${authType} ip=${clientIp} ua="${(req.headers['user-agent'] || '').slice(0, 120)}"`);

    const result = await executor(args || {}, userId, workspaceId);

    return res.json({
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    });
  } catch (err: any) {
    console.error('[mcp] /call error:', err?.message, err?.stack);
    return res.status(500).json({
      error: err?.message || 'Request failed. Please try again.',
      isError: true,
    });
  }
});

// ── Async audit status endpoint ──────────────────────────────────────────────

router.get('/async/:auditId/status', async (req: Request, res: Response) => {
  try {
    const { auditId } = req.params;
    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;

    if (!auditId) {
      return res.status(400).json(envFail('Audit ID is required'));
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, status, created_at, updated_at FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [auditId, userId, workspaceId]
    );

    if (!rows.length) {
      return res.status(404).json(envFail('Audit not found'));
    }

    const audit = rows[0];
    const createdAt = new Date(audit.created_at);
    const updatedAt = new Date(audit.updated_at || audit.created_at);
    const elapsedMs = updatedAt.getTime() - createdAt.getTime();

    let estimatedRemainingSecs = 30;
    if (audit.status === 'scanning') estimatedRemainingSecs = 15;
    else if (audit.status === 'analyzing') estimatedRemainingSecs = 8;
    else if (audit.status === 'complete') estimatedRemainingSecs = 0;

    return res.json(envOk({
      audit_id: audit.id,
      status: audit.status,
      progress_percent:
        audit.status === 'queued'
          ? 10
          : audit.status === 'scanning'
            ? 40
            : audit.status === 'analyzing'
              ? 80
              : audit.status === 'complete'
                ? 100
                : 0,
      started_at: audit.created_at,
      estimated_completion_seconds: Math.max(0, estimatedRemainingSecs - Math.round(elapsedMs / 1000)),
      error: audit.status === 'error' ? 'Audit failed (see logs)' : null,
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Envelope-based dedicated endpoints (v2)
//
// These are called by the standalone MCP server (server/src/mcp/index.ts) and
// return stable { ok, data, meta, error } envelopes.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Envelope helpers ─────────────────────────────────────────────────────────

function envOk<T>(data: T, meta: Record<string, unknown> = {}) {
  return { ok: true, data, meta: { ts: new Date().toISOString(), ...meta }, error: null };
}

function envFail(error: string, meta: Record<string, unknown> = {}) {
  return { ok: false, data: null, meta: { ts: new Date().toISOString(), ...meta }, error };
}

// ── POST /api/mcp/scan-url ──────────────────────────────────────────────────

router.post('/scan-url', async (req: Request, res: Response) => {
  try {
    const { url, goal, bypass_cache, platform_focus } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json(envFail('url is required'));
    }

    const normalized = normalizePublicHttpUrl(url);
    if (!normalized.ok) {
      return res.status(400).json(envFail(normalized.error));
    }
    if (isPrivateOrLocalHost(new URL(normalized.url).hostname)) {
      return res.status(400).json(envFail('Private and localhost URLs are not allowed'));
    }

    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;
    const auditId = crypto.randomUUID();
    const pool = getPool();

    // Insert with core columns first, then try adding goal/platform_focus if columns exist
    await pool.query(
      `INSERT INTO audits (id, user_id, workspace_id, url, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [auditId, userId, workspaceId, normalized.url, 'queued'],
    );
    if (goal || (platform_focus && platform_focus.length)) {
      pool.query(
        `UPDATE audits SET goal = COALESCE($2, goal), platform_focus = COALESCE($3, platform_focus) WHERE id = $1`,
        [auditId, goal || null, JSON.stringify(platform_focus || [])],
      ).catch(() => { /* columns may not exist yet */ });
    }

    // Fire off background processing
    processQueuedAudit(auditId, userId, workspaceId, normalized.url).catch((err) => {
      console.error(`[mcp] Background scan-url ${auditId} failed:`, err?.message);
    });

    return res.json(envOk({
      audit_id: auditId,
      status: 'queued',
      poll_url: `/api/mcp/async/${auditId}/status`,
      estimated_wait_seconds: 30,
      queued_at: new Date().toISOString(),
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ── GET /api/mcp/audits/:auditId ────────────────────────────────────────────

router.get('/audits/:auditId', async (req: Request, res: Response) => {
  try {
    const { auditId } = req.params;
    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, result, status, goal, created_at, updated_at
       FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [auditId, userId, workspaceId],
    );

    if (!rows.length) {
      return res.status(404).json(envFail('Audit not found'));
    }

    const audit = rows[0];
    if (audit.status !== 'complete') {
      return res.json(envOk({
        audit_id: audit.id,
        status: audit.status,
        message: 'Audit is not yet complete. Poll /api/mcp/async/:auditId/status for progress.',
      }, { complete: false }));
    }

    const result = audit.result || {};
    const recommendations = (result.recommendations || []).map((r: any, i: number) => ({
      code: r.code || `REC-${String(i + 1).padStart(3, '0')}`,
      title: r.title,
      priority: r.priority,
      category: r.category,
      description: r.description || r.details || null,
      finding_codes: r.finding_codes || [],
    }));

    const findings = (result.findings || result.evidence_manifest || []).map((f: any, i: number) => ({
      code: f.code || `FND-${String(i + 1).padStart(3, '0')}`,
      category: f.category,
      severity: f.severity || f.status || 'info',
      title: f.title || f.label || f.key,
      detail: f.detail || f.notes || null,
      evidence: f.evidence || f.value || null,
    }));

    return res.json(envOk({
      audit_id: audit.id,
      url: audit.url,
      visibility_score: audit.visibility_score,
      goal: audit.goal,
      scanned_at: audit.created_at,
      category_scores: {
        content: result.content_analysis?.score ?? result.category_scores?.content ?? null,
        technical: result.technical_signals?.score ?? result.category_scores?.technical ?? null,
        schema: result.schema_markup?.score ?? result.category_scores?.schema ?? null,
        trust: result.trust_signals?.score ?? result.category_scores?.trust ?? null,
        performance: result.performance?.score ?? result.category_scores?.performance ?? null,
      },
      findings,
      recommendations,
      ai_platform_scores: result.ai_platform_scores || null,
      content_analysis: result.content_analysis || null,
      technical_signals: result.technical_signals || null,
      schema_markup: result.schema_markup || null,
    }, { complete: true, model_count: result.model_count || 1 }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ── POST /api/mcp/export-report ─────────────────────────────────────────────

router.post('/export-report', async (req: Request, res: Response) => {
  try {
    const { audit_id, format } = req.body || {};
    if (!audit_id) return res.status(400).json(envFail('audit_id is required'));
    if (!format || !['json', 'pdf'].includes(format)) {
      return res.status(400).json(envFail('format must be "json" or "pdf"'));
    }

    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, result, created_at FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3 AND status = 'complete'`,
      [audit_id, userId, workspaceId],
    );

    if (!rows.length) {
      return res.status(404).json(envFail('Completed audit not found'));
    }

    const audit = rows[0];
    // Generate a short-lived signed token for the download
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      `INSERT INTO mcp_export_tokens (token, audit_id, user_id, format, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [token, audit_id, userId, format, expiresAt],
    );

    return res.json(envOk({
      download_url: `/api/mcp/exports/${token}`,
      format,
      expires_at: expiresAt.toISOString(),
      audit_id: audit.id,
      url: audit.url,
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ── GET /api/mcp/exports/:token (unauthenticated, token-gated) ─────────────

router.get('/exports/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT et.audit_id, et.format, et.expires_at, a.url, a.visibility_score, a.result, a.created_at
       FROM mcp_export_tokens et
       JOIN audits a ON a.id = et.audit_id
       WHERE et.token = $1`,
      [token],
    );

    if (!rows.length) {
      return res.status(404).json(envFail('Export not found'));
    }

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json(envFail('Export link has expired'));
    }

    if (row.format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="aivis-audit-${row.audit_id}.json"`);
      return res.json({
        audit_id: row.audit_id,
        url: row.url,
        visibility_score: row.visibility_score,
        scanned_at: row.created_at,
        exported_at: new Date().toISOString(),
        result: row.result,
      });
    }

    // PDF: return structured JSON as fallback (PDF generation can be added later)
    res.setHeader('Content-Type', 'application/json');
    return res.json(envOk({
      message: 'PDF export is not yet available via MCP. Use JSON format instead.',
      fallback_format: 'json',
      audit_id: row.audit_id,
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ── GET /api/mcp/history ────────────────────────────────────────────────────

router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;
    const url = String(req.query.url || '');
    const days = Math.min(Math.max(parseInt(String(req.query.days)) || 90, 1), 365);

    if (!url) {
      return res.status(400).json(envFail('url query parameter is required'));
    }

    const normalized = normalizePublicHttpUrl(url);
    if (!normalized.ok) {
      return res.status(400).json(envFail(normalized.error));
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, visibility_score, created_at FROM audits
       WHERE user_id = $1 AND workspace_id = $2 AND url = $3
         AND created_at >= NOW() - INTERVAL '1 day' * $4
       ORDER BY created_at DESC`,
      [userId, workspaceId, normalized.url, days],
    );

    const scores = rows.map((r: any) => Number(r.visibility_score)).filter(Number.isFinite);
    return res.json(envOk({
      url: normalized.url,
      period_days: days,
      data_points: rows.map((r: any) => ({
        audit_id: r.id,
        score: r.visibility_score,
        scanned_at: r.created_at,
      })),
      summary: {
        count: rows.length,
        avg_score: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null,
        best: scores.length ? Math.max(...scores) : null,
        worst: scores.length ? Math.min(...scores) : null,
        trend: scores.length >= 2 ? (scores[0] > scores[scores.length - 1] ? 'improving' : scores[0] < scores[scores.length - 1] ? 'declining' : 'stable') : null,
      },
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ── POST /api/mcp/compare ───────────────────────────────────────────────────

router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { urls } = req.body || {};
    if (!Array.isArray(urls) || urls.length < 2 || urls.length > 10) {
      return res.status(400).json(envFail('urls must be an array of 2-10 URLs'));
    }

    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;
    const pool = getPool();

    const results: any[] = [];
    for (const rawUrl of urls) {
      const normalized = normalizePublicHttpUrl(String(rawUrl));
      if (!normalized.ok) {
        results.push({ url: rawUrl, error: normalized.error, visibility_score: null });
        continue;
      }

      const { rows } = await pool.query(
        `SELECT url, visibility_score, result, created_at FROM audits
         WHERE user_id = $1 AND workspace_id = $2 AND url = $3
         ORDER BY created_at DESC LIMIT 1`,
        [userId, workspaceId, normalized.url],
      );

      if (!rows.length) {
        results.push({ url: normalized.url, error: 'No audit found for this URL', visibility_score: null });
        continue;
      }

      const row = rows[0];
      const r = row.result || {};
      results.push({
        url: row.url,
        visibility_score: row.visibility_score,
        scanned_at: row.created_at,
        category_scores: {
          content: r.content_analysis?.score ?? r.category_scores?.content ?? null,
          technical: r.technical_signals?.score ?? r.category_scores?.technical ?? null,
          schema: r.schema_markup?.score ?? r.category_scores?.schema ?? null,
          trust: r.trust_signals?.score ?? r.category_scores?.trust ?? null,
        },
      });
    }

    // Sort by visibility score descending for ranking
    const ranked = [...results]
      .filter((r) => r.visibility_score != null)
      .sort((a, b) => (b.visibility_score || 0) - (a.visibility_score || 0))
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return res.json(envOk({
      compared: ranked.length,
      results: ranked,
      errors: results.filter((r) => r.error),
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ── POST /api/mcp/citation-test ─────────────────────────────────────────────

router.post('/citation-test', async (req: Request, res: Response) => {
  try {
    const { url, queries, platforms } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json(envFail('url is required'));
    }
    if (!Array.isArray(queries) || queries.length < 1 || queries.length > 10) {
      return res.status(400).json(envFail('queries must be an array of 1-10 strings'));
    }

    const normalized = normalizePublicHttpUrl(url);
    if (!normalized.ok) {
      return res.status(400).json(envFail(normalized.error));
    }

    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;
    const testId = crypto.randomUUID();
    const pool = getPool();

    // Check tier for citation access (Signal+)
    const { rows: userRows } = await pool.query(`SELECT tier FROM users WHERE id = $1`, [userId]);
    const userTier = userRows[0]?.tier || 'observer';
    const validPlatforms = ['chatgpt', 'claude', 'gemini', 'perplexity'];
    const requestedPlatforms = (platforms || validPlatforms).filter((p: string) => validPlatforms.includes(p));

    // Create the citation test record
    await pool.query(
      `INSERT INTO citation_tests (id, user_id, workspace_id, url, queries, platforms, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT DO NOTHING`,
      [testId, userId, workspaceId, normalized.url, JSON.stringify(queries), JSON.stringify(requestedPlatforms), 'pending'],
    );

    return res.json(envOk({
      test_id: testId,
      status: 'pending',
      url: normalized.url,
      query_count: queries.length,
      platforms: requestedPlatforms,
      message: 'Citation test queued. Results typically available within 30-60 seconds.',
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ── POST /api/mcp/remediation-plan ──────────────────────────────────────────

router.post('/remediation-plan', async (req: Request, res: Response) => {
  try {
    const { audit_id, focus_categories } = req.body || {};
    if (!audit_id) {
      return res.status(400).json(envFail('audit_id is required'));
    }

    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, result FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3 AND status = 'complete'`,
      [audit_id, userId, workspaceId],
    );

    if (!rows.length) {
      return res.status(404).json(envFail('Completed audit not found'));
    }

    const audit = rows[0];
    const result = audit.result || {};
    const recommendations = result.recommendations || [];
    const findings = result.findings || result.evidence_manifest || [];
    const validCategories = ['schema', 'content', 'technical', 'performance', 'trust'];
    const focusSet = new Set(
      (focus_categories || []).filter((c: string) => validCategories.includes(c))
    );

    // Build remediation plan from findings and recommendations
    const plan = recommendations.map((rec: any, i: number) => {
      const code = rec.code || `REC-${String(i + 1).padStart(3, '0')}`;
      const relatedFindings = findings.filter(
        (f: any) => f.category === rec.category || (rec.finding_codes || []).includes(f.code)
      );

      return {
        code,
        title: rec.title,
        priority: rec.priority,
        category: rec.category,
        description: rec.description || rec.details || null,
        effort: rec.effort || 'medium',
        related_findings: relatedFindings.map((f: any, fi: number) => ({
          code: f.code || `FND-${String(fi + 1).padStart(3, '0')}`,
          title: f.title || f.label || f.key,
          severity: f.severity || f.status || 'info',
        })),
        implementation_hint: rec.implementation_hint || rec.how_to_fix || null,
      };
    });

    // If focus_categories provided, filter and sort accordingly
    const filtered = focusSet.size > 0
      ? plan.filter((p: any) => focusSet.has(p.category))
      : plan;

    // Sort by priority: critical > high > medium > low
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    filtered.sort((a: any, b: any) =>
      (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
    );

    return res.json(envOk({
      audit_id: audit.id,
      url: audit.url,
      current_score: audit.visibility_score,
      total_recommendations: plan.length,
      filtered_count: filtered.length,
      focus_categories: focusSet.size > 0 ? [...focusSet] : null,
      steps: filtered,
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

// ── GET /api/mcp/methodology ────────────────────────────────────────────────

router.get('/methodology', async (_req: Request, res: Response) => {
  return res.json(envOk({
    name: 'AiVIS Visibility Score',
    version: '2.0',
    description: 'Measures how well a webpage is structured for AI answer engine extraction, citation, and recommendation.',
    categories: {
      content: {
        weight: 0.30,
        description: 'Word count, readability, topical depth, heading structure, FAQ presence, TL;DR blocks',
      },
      technical: {
        weight: 0.25,
        description: 'HTTPS, response time, canonical tags, robots.txt, sitemap.xml, mobile-friendly, LCP',
      },
      schema: {
        weight: 0.25,
        description: 'JSON-LD structured data, Open Graph tags, meta descriptions, completeness of schema markup',
      },
      trust: {
        weight: 0.15,
        description: 'Domain authority signals, author attribution, citation readiness, entity clarity',
      },
      performance: {
        weight: 0.05,
        description: 'Page load speed, core web vitals proxies, asset optimization',
      },
    },
    score_range: { min: 0, max: 100 },
    interpretation: {
      '0-30': 'Poor - unlikely to be extracted or cited by AI engines',
      '31-55': 'Below average - missing key structural elements',
      '56-75': 'Average - meets basic requirements but has optimization opportunities',
      '76-90': 'Good - well-structured for AI extraction',
      '91-100': 'Excellent - fully optimized for AI visibility and citation',
    },
  }));
});

// ── GET /api/mcp/usage ──────────────────────────────────────────────────────

router.get('/usage', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;
    const pool = getPool();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const { rows: usageRows } = await pool.query(
      `SELECT COALESCE(SUM(requests), 0)::int AS total FROM api_usage_daily
       WHERE user_id = $1 AND workspace_id = $2 AND date >= $3 AND date <= $4`,
      [userId, workspaceId, monthStart, monthEnd],
    );

    const { rows: userRows } = await pool.query(
      `SELECT tier FROM users WHERE id = $1`,
      [userId],
    );

    const tier = (userRows[0]?.tier || 'observer') as CanonicalTier;
    const limits = TIER_LIMITS[uiTierFromCanonical(tier)];
    const used = Number(usageRows[0]?.total || 0);

    return res.json(envOk({
      tier,
      month: monthStart,
      scans_used: used,
      scans_limit: limits?.scansPerMonth ?? 0,
      scans_remaining: Math.max(0, (limits?.scansPerMonth ?? 0) - used),
      has_api_access: limits?.hasApiAccess ?? false,
    }));
  } catch (err: any) {
    return res.status(500).json(envFail(err.message));
  }
});

export default router;
