/**
 * External API v1 (Read-Only)
 * Authenticated via API key (Bearer avis_xxx header).
 * Provides read-only access to audits and analytics data for API-entitled tiers.
 */
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { validateApiKey } from '../services/apiKeyService.js';
import { getPool } from '../services/postgresql.js';
import * as cheerio from 'cheerio';
import { normalizePublicHttpUrl, isPrivateOrLocalHost } from '../lib/urlSafety.js';
import { getAllBenchmarks, getBenchmarkForCategory, compareToBenchmarks, recomputeBenchmarks } from '../services/industryBenchmarkService.js';
import { resolveWidgetToken, createWidgetToken, listWidgetTokens, deleteWidgetToken } from '../services/widgetService.js';
import { getTimeline } from '../services/visibilityTimeline.js';

const router = Router();

// ── API Key Auth Middleware ───────────────────────────────────────────────────

async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer avis_')) {
    return res.status(401).json({
      error: 'Missing or invalid API key. Provide: Authorization: Bearer avis_xxx',
      code: 'INVALID_API_KEY',
    });
  }

  const key = authHeader.slice(7); // strip "Bearer "
  const result = await validateApiKey(key);

  if (!result.ok) {
    if (result.reason === 'tier_blocked') {
      return res.status(403).json({
        error: 'API access is not available for the current plan tier',
        code: 'FEATURE_LOCKED',
      });
    }

    if (result.reason === 'expired') {
      return res.status(401).json({ error: 'API key expired', code: 'API_KEY_EXPIRED' });
    }

    return res.status(401).json({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
  }

  // Attach to request
  (req as any).apiKeyId = result.keyId;
  (req as any).apiUserId = result.userId;
  (req as any).apiWorkspaceId = result.workspaceId;
  (req as any).apiScopes = result.scopes;
  next();
}

function meterApiUsage(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    const userId = (req as any).apiUserId as string | undefined;
    const workspaceId = (req as any).apiWorkspaceId as string | undefined;
    const apiKeyId = (req as any).apiKeyId as string | undefined;
    if (!userId || !workspaceId || !apiKeyId) return;

    void (async () => {
      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO api_usage_daily (user_id, workspace_id, api_key_id, date, requests)
           VALUES ($1, $2, $3, CURRENT_DATE, 1)
           ON CONFLICT (user_id, workspace_id, api_key_id, date)
           DO UPDATE SET requests = api_usage_daily.requests + 1`,
          [userId, workspaceId, apiKeyId]
        );
      } catch {
        // non-blocking metering
      }
    })();
  });

  next();
}

function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const scopes: string[] = (req as any).apiScopes || [];
    if (!scopes.includes(scope)) {
      return res.status(403).json({
        error: `API key missing required scope: ${scope}`,
        code: 'INSUFFICIENT_SCOPE',
      });
    }
    next();
  };
}

router.use(apiKeyAuth);

const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const apiKeyId = String((req as any).apiKeyId || '').trim();
    if (apiKeyId) return `api_key:${apiKeyId}`;
    const fallbackIp = req.ip || (req.socket?.remoteAddress ?? '');
    return `ip:${ipKeyGenerator(fallbackIp)}`;
  },
  message: {
    error: 'Too many API requests for this key. Please retry shortly.',
    code: 'RATE_LIMITED',
  },
});

router.use(apiKeyRateLimiter);
router.use(meterApiUsage);

function normalizeValidationUrl(input: string): string {
  const normalized = normalizePublicHttpUrl(input);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }

  return normalized.url;
}

async function runPageValidation(targetUrl: string) {
  const response = await fetch(targetUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'AiVIS-ExternalAPI/1.0 (+https://aivis.biz)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  const html = await response.text();

  const finalUrl = normalizeValidationUrl(response.url);
  if (isPrivateOrLocalHost(new URL(finalUrl).hostname)) {
    throw new Error('Private and localhost redirect targets are not allowed');
  }

  const $ = cheerio.load(html);

  const title = ($('title').first().text() || '').trim();
  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();
  const canonical = ($('link[rel="canonical"]').attr('href') || '').trim();
  const h1Count = $('h1').length;
  const jsonLdCount = $('script[type="application/ld+json"]').length;
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').length : 0;

  const checks = {
    hasTitle: title.length > 0,
    hasMetaDescription: metaDescription.length > 0,
    hasCanonical: canonical.length > 0,
    hasSingleH1: h1Count === 1,
    hasJsonLd: jsonLdCount > 0,
    minWordCount300: wordCount >= 300,
    usesHttps: targetUrl.startsWith('https://'),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;

  return {
    status_code: response.status,
    final_url: finalUrl,
    checks,
    metrics: {
      title_length: title.length,
      meta_description_length: metaDescription.length,
      h1_count: h1Count,
      json_ld_count: jsonLdCount,
      word_count: wordCount,
    },
    summary: {
      passed,
      total,
      score_percent: Math.round((passed / total) * 100),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/usage - External API meter snapshot (current month)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/usage', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId;
    const workspaceId = (req as any).apiWorkspaceId;
    const apiKeyId = (req as any).apiKeyId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const pool = getPool();
    const [keyUsage, workspaceUsage] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(requests), 0)::int AS total
         FROM api_usage_daily
         WHERE user_id = $1 AND workspace_id = $2 AND api_key_id = $3 AND date >= $4 AND date <= $5`,
        [userId, workspaceId, apiKeyId, monthStart, monthEnd]
      ),
      pool.query(
        `SELECT COALESCE(SUM(requests), 0)::int AS total
         FROM api_usage_daily
         WHERE user_id = $1 AND workspace_id = $2 AND date >= $3 AND date <= $4`,
        [userId, workspaceId, monthStart, monthEnd]
      ),
    ]);

    res.json({
      success: true,
      data: {
        monthStart,
        monthEnd,
        apiKeyRequestsThisMonth: Number(keyUsage.rows?.[0]?.total || 0),
        workspaceRequestsThisMonth: Number(workspaceUsage.rows?.[0]?.total || 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/page-validation - Validate one page and persist result
// GET /api/v1/page-validation/:id - Fetch persisted validation result
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/page-validation', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId;
    const workspaceId = (req as any).apiWorkspaceId;
    const apiKeyId = (req as any).apiKeyId;
    const normalizedUrl = normalizeValidationUrl(String(req.body?.url || ''));

    const validationResult = await runPageValidation(normalizedUrl);
    const pool = getPool();

    const { rows } = await pool.query(
      `INSERT INTO api_page_validations (user_id, workspace_id, api_key_id, url, result)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, workspace_id, api_key_id, url, result, created_at`,
      [userId, workspaceId, apiKeyId, normalizedUrl, validationResult]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    const msg = String(err?.message || 'Validation failed');
    const status = /required|supported|allowed|invalid/i.test(msg) ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

router.get('/page-validation/:id', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId;
    const workspaceId = (req as any).apiWorkspaceId;
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, user_id, workspace_id, api_key_id, url, result, created_at
       FROM api_page_validations
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [String(req.params.id), userId, workspaceId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Validation record not found' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/audits - List user audits
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/audits', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId;
    const workspaceId = (req as any).apiWorkspaceId;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, created_at
       FROM audits
       WHERE user_id = $1 AND workspace_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, workspaceId, limit, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM audits WHERE user_id = $1 AND workspace_id = $2`,
      [userId, workspaceId]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0].total,
        limit,
        offset,
        has_more: offset + limit < countRows[0].total,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/audits/:id - Get single audit with full result
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/audits/:id', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId;
    const workspaceId = (req as any).apiWorkspaceId;
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, result, created_at
       FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [req.params.id, userId, workspaceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Audit not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/analytics - Score history
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/analytics', requireScope('read:analytics'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId;
    const workspaceId = (req as any).apiWorkspaceId;
    const days = Math.min(parseInt(req.query.days as string) || 90, 365);
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT url, visibility_score, created_at, result->'ai_platform_scores' AS platform_scores
       FROM audits
       WHERE user_id = $1 AND workspace_id = $2 AND created_at >= NOW() - INTERVAL '1 day' * $3
       ORDER BY created_at DESC`,
      [userId, workspaceId, days]
    );

    const platformAliases: Record<'chatgpt' | 'perplexity' | 'google_ai' | 'claude', string[]> = {
      chatgpt: ['chatgpt'],
      perplexity: ['perplexity'],
      google_ai: ['google_ai', 'gemini_ai', 'google', 'google_ai_overviews'],
      claude: ['claude', 'claude/anthropic', 'anthropic'],
    };
    const platformTotals: Record<'chatgpt' | 'perplexity' | 'google_ai' | 'claude', number[]> = {
      chatgpt: [],
      perplexity: [],
      google_ai: [],
      claude: [],
    };

    // Group by URL
    const byUrl: Record<string, { url: string; scores: { score: number; date: string }[] }> = {};
    for (const row of rows) {
      if (!byUrl[row.url]) {
        byUrl[row.url] = { url: row.url, scores: [] };
      }
      byUrl[row.url].scores.push({
        score: row.visibility_score,
        date: row.created_at,
      });

      const scores = row.platform_scores;
      if (scores && typeof scores === 'object') {
        for (const [canonicalPlatform, aliases] of Object.entries(platformAliases) as Array<[
          keyof typeof platformAliases,
          string[]
        ]>) {
          const candidate = aliases
            .map((alias) => Number((scores as Record<string, unknown>)[alias]))
            .find((score) => Number.isFinite(score));
          if (typeof candidate === 'number') {
            platformTotals[canonicalPlatform].push(candidate);
          }
        }
      }
    }

    const flatScores = rows
      .map((row) => Number(row.visibility_score))
      .filter((score) => Number.isFinite(score));

    const platformAverages = Object.fromEntries(
      Object.entries(platformTotals).map(([platform, vals]) => [
        platform,
        vals.length ? Math.round(vals.reduce((sum, value) => sum + value, 0) / vals.length) : 0,
      ])
    );

    res.json({
      success: true,
      data: Object.values(byUrl),
      summary: {
        total_audits: rows.length,
        avg_score: flatScores.length ? Math.round(flatScores.reduce((sum, value) => sum + value, 0) / flatScores.length) : 0,
        best_score: flatScores.length ? Math.max(...flatScores) : 0,
        worst_score: flatScores.length ? Math.min(...flatScores) : 0,
      },
      platform_averages: platformAverages,
      period_days: days,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/competitors - Competitor tracking data
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/competitors', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId;
    const workspaceId = (req as any).apiWorkspaceId;
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, competitor_url, nickname, latest_score, created_at, updated_at
       FROM competitor_tracking
       WHERE user_id = $1 AND workspace_id = $2
       ORDER BY created_at DESC`,
      [userId, workspaceId]
    );

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/evidence/:auditId - Evidence ledger for an audit
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/evidence/:auditId', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId;
    const workspaceId = (req as any).apiWorkspaceId;
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, url, result, created_at
       FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [req.params.auditId, userId, workspaceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Audit not found' });
    }

    const result = rows[0].result;
    const evidenceFields = result?.evidence_manifest || result?.evidenceManifest || {};
    const contentHighlights = result?.content_highlights || [];
    const recommendations = (result?.recommendations || []).map((r: any) => ({
      title: r.title,
      priority: r.priority,
      category: r.category,
      evidence_ids: r.evidence_ids || [],
    }));

    res.json({
      success: true,
      data: {
        audit_id: rows[0].id,
        url: rows[0].url,
        scanned_at: rows[0].created_at,
        evidence_fields: evidenceFields,
        content_highlights: contentHighlights,
        recommendation_evidence: recommendations,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/benchmarks - Industry visibility benchmarks
// GET /api/v1/benchmarks/:category - Single category benchmark
// GET /api/v1/benchmarks/compare - Compare a score to benchmarks
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/benchmarks', async (req: Request, res: Response) => {
  try {
    // Trigger background recompute (non-blocking)
    void recomputeBenchmarks().catch(() => {});

    const category = req.query.category as string | undefined;

    if (category) {
      const benchmark = await getBenchmarkForCategory(category.trim());
      if (!benchmark) {
        return res.status(404).json({ success: false, error: `No benchmark data for category: ${category}` });
      }
      return res.json({ success: true, data: benchmark });
    }

    const benchmarks = await getAllBenchmarks();
    return res.json({ success: true, data: benchmarks, count: benchmarks.length });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/benchmarks/compare', async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || '').trim();
    const score = parseFloat(String(req.query.score || ''));

    if (!url || isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ success: false, error: 'url and score (0–100) are required' });
    }

    const comparison = await compareToBenchmarks(score, url);
    if (!comparison) {
      return res.status(404).json({ success: false, error: 'Not enough benchmark data to compare. Retry after more audits have been indexed.' });
    }

    return res.json({ success: true, data: comparison });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/project/:projectId/timeline - Score timeline for a portfolio project
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/project/:projectId/timeline', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId as string;
    const workspaceId = (req as any).apiWorkspaceId as string;
    const projectId = String(req.params.projectId || '').trim();
    const days = Math.min(parseInt(String(req.query.days || '30')), 365);

    // Resolve the domain for the portfolio project
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT domain FROM portfolio_projects WHERE id = $1 AND owner_user_id = $2`,
      [projectId, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const url = rows[0].domain as string;
    const timeline = await getTimeline(userId, url, days);
    return res.json({ success: true, data: { project_id: projectId, domain: url, ...timeline } });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/audit - Enqueue an audit via API
// GET  /api/v1/audit/:auditId - Poll audit status
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/audit', requireScope('write:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId as string;
    const workspaceId = (req as any).apiWorkspaceId as string;
    const rawUrl = String(req.body?.url || '').trim();

    if (!rawUrl) {
      return res.status(400).json({ success: false, error: '`url` is required' });
    }

    // Normalise + safety-check the URL
    const normalized = normalizePublicHttpUrl(rawUrl);
    if (!normalized.ok) {
      return res.status(400).json({ success: false, error: normalized.error });
    }

    try {
      const parsed = new URL(normalized.url);
      if (isPrivateOrLocalHost(parsed.hostname)) {
        return res.status(400).json({ success: false, error: 'Private and localhost URLs are not allowed' });
      }
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    // Insert into audit queue
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO agent_tasks (user_id, workspace_id, type, payload, status, created_at, updated_at)
       VALUES ($1, $2, 'api_audit', $3::jsonb, 'pending', NOW(), NOW())
       RETURNING id, status, created_at`,
      [userId, workspaceId, JSON.stringify({ url: normalized.url, triggered_by: 'api_key' })]
    );

    return res.status(202).json({
      success: true,
      data: {
        task_id: rows[0].id,
        status: 'pending',
        url: normalized.url,
        created_at: rows[0].created_at,
        poll_url: `/api/v1/audit/${rows[0].id}`,
      },
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/audit/:taskId', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId as string;
    const taskId = String(req.params.taskId || '').trim();
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, type, status, payload, created_at, updated_at
         FROM agent_tasks
        WHERE id = $1 AND user_id = $2`,
      [taskId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Widget tokens - GET/POST/DELETE /api/v1/widgets
// GET /api/v1/widget/:token - Public (no api key) widget data
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/widgets', requireScope('read:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId as string;
    const workspaceId = (req as any).apiWorkspaceId as string;
    const tokens = await listWidgetTokens(userId, workspaceId);
    return res.json({ success: true, data: tokens, count: tokens.length });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/widgets', requireScope('write:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId as string;
    const workspaceId = (req as any).apiWorkspaceId as string;
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ success: false, error: '`url` is required' });

    const token = await createWidgetToken({
      userId, workspaceId, url,
      label: String(req.body?.label || '').trim() || undefined,
      config: req.body?.config ?? {},
      expiresInDays: req.body?.expires_in_days ? Number(req.body.expires_in_days) : undefined,
    });
    return res.status(201).json({ success: true, data: token });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/widgets/:id', requireScope('write:audits'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).apiUserId as string;
    const workspaceId = (req as any).apiWorkspaceId as string;
    const ok = await deleteWidgetToken(userId, workspaceId, String(req.params.id));
    if (!ok) return res.status(404).json({ success: false, error: 'Widget token not found' });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

// ═══════════════════════════════════════════════════════════════════════════════
// Public (no auth) widget endpoint - served separately by server.ts
// GET /api/widget/:token
// ═══════════════════════════════════════════════════════════════════════════════

export const widgetPublicRouter = Router();

widgetPublicRouter.get('/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token.startsWith('wgt_') || token.length < 20) {
      return res.status(400).json({ success: false, error: 'Invalid widget token format' });
    }

    const data = await resolveWidgetToken(token);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Widget not found or expired' });
    }

    // Cache for 5 minutes in CDN / browser
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.set('Access-Control-Allow-Origin', '*'); // embeddable cross-origin
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

widgetPublicRouter.options('/:token', (_req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

