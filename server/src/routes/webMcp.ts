/**
 * WebMCP - Browser-native agent tool surface for AiVIS
 *
 * Exposes structured, typed tools so AI browser agents can discover and
 * invoke AiVIS workflows without relying on DOM scraping.
 *
 * Discovery:  GET  /.well-known/webmcp.json
 * Metadata:   GET  /api/webmcp
 * Tool list:  GET  /api/webmcp/tools
 * Invoke:     POST /api/webmcp/tools/:toolName
 */
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { getPool } from '../services/postgresql.js';
import { validateApiKey } from '../services/apiKeyService.js';
import { getRequestAuthToken } from '../lib/authSession.js';
import { normalizePublicHttpUrl, isPrivateOrLocalHost } from '../lib/urlSafety.js';
import {
  TIER_LIMITS,
  uiTierFromCanonical,
  meetsMinimumTier,
  type CanonicalTier,
  type LegacyTier,
} from '../../../shared/types.js';
import { verifyUserToken } from '../lib/utils/jwt.js';
import { getUserById } from '../models/User.js';
import { enforceEffectiveTier } from '../services/entitlementGuard.js';
import { processQueuedAudit } from '../services/mcpAuditProcessor.js';
import { ensureDefaultWorkspaceForUser } from '../services/tenantService.js';

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────

interface WebMcpTool {
  name: string;
  description: string;
  phase: 1 | 2 | 3;
  minimumTier: CanonicalTier;
  inputSchema: Record<string, unknown>;
  outputDescription: string;
}

type ToolExecutor = (
  params: Record<string, any>,
  userId: string,
  workspaceId: string,
  tier: CanonicalTier,
) => Promise<Record<string, any>>;

// ── Auth (shared pattern with MCP) ───────────────────────────────────────────

async function webMcpAuth(req: Request, res: Response, next: NextFunction) {
  const token = getRequestAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header. Use Bearer avis_* or avist_*' });
  }
  const pool = getPool();

  if (token.startsWith('avis_')) {
    const result = await validateApiKey(token);
    if (!result.ok) return res.status(result.reason === 'tier_blocked' ? 403 : 401).json({ error: result.reason === 'tier_blocked' ? 'Your plan does not include API access. Upgrade to Alignment or higher.' : 'Invalid API key', code: result.reason });
    (req as any).mcpUserId = result.userId;
    (req as any).mcpWorkspaceId = result.workspaceId;
    (req as any).mcpScopes = result.scopes;

    const { rows } = await pool.query(`SELECT tier FROM users WHERE id = $1`, [result.userId]);
    (req as any).mcpTier = uiTierFromCanonical((rows[0]?.tier || 'observer') as CanonicalTier | LegacyTier);
    return next();
  }

  if (token.startsWith('avist_')) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(
      `SELECT user_id, scopes, expires_at, revoked FROM oauth_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    if (!rows.length || rows[0].revoked || new Date(rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired OAuth token' });
    }

    const { rows: userRows } = await pool.query(`SELECT tier FROM users WHERE id = $1`, [rows[0].user_id]);
    const tier = uiTierFromCanonical((userRows[0]?.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!TIER_LIMITS[tier]?.hasApiAccess) {
      return res.status(403).json({ error: 'Your plan does not include API access. Upgrade to Alignment or higher.' });
    }

    const scopes: string[] = typeof rows[0].scopes === 'string' ? JSON.parse(rows[0].scopes) : rows[0].scopes;
    (req as any).mcpUserId = rows[0].user_id;
    (req as any).mcpScopes = scopes;
    (req as any).mcpTier = tier;

    const { rows: wsRows } = await pool.query(
      `SELECT w.id FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND w.is_default = TRUE LIMIT 1`,
      [rows[0].user_id],
    );
    (req as any).mcpWorkspaceId = wsRows[0]?.id;
    return next();
  }

  try {
    const decoded = verifyUserToken(token);
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found for JWT' });
    }

    const effectiveTier = await enforceEffectiveTier(user);
    const tier = uiTierFromCanonical((effectiveTier || 'observer') as CanonicalTier | LegacyTier);
    if (!TIER_LIMITS[tier]?.hasApiAccess) {
      return res.status(403).json({ error: 'Your plan does not include API access. Upgrade to Alignment or higher.' });
    }

    (req as any).mcpUserId = user.id;
    (req as any).mcpScopes = ['read:audits', 'write:audits', 'read:analytics', 'read:competitors'];
    (req as any).mcpTier = tier;

    const { rows: wsRows } = await pool.query(
      `SELECT w.id FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND w.is_default = TRUE LIMIT 1`,
      [user.id],
    );
    if (wsRows[0]?.id) {
      (req as any).mcpWorkspaceId = wsRows[0].id;
    } else {
      const ctx = await ensureDefaultWorkspaceForUser(user.id, user.name || user.email);
      (req as any).mcpWorkspaceId = ctx.workspaceId;
    }

    return next();
  } catch {
    return res.status(401).json({ error: 'Token must start with avis_ (API key), avist_ (OAuth token), or be a valid session JWT' });
  }
}

// ── Tool registry ────────────────────────────────────────────────────────────

const TOOLS: WebMcpTool[] = [
  // ── Phase 1 ──
  {
    name: 'scan_url',
    description:
      'Run an AI visibility audit on a public URL. Returns audit ID, visibility score, category scores, status, and report URL. Use this as the primary entry point for any visibility analysis.',
    phase: 1,
    minimumTier: 'alignment',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public URL to audit' },
        project_id: { type: 'string', description: 'Workspace ID to scope the audit (optional)' },
        scan_mode: {
          type: 'string',
          enum: ['standard', 'force_refresh'],
          description: 'standard uses cache; force_refresh bypasses it (alignment+ only)',
        },
        findability_goals: {
          type: 'array',
          items: { type: 'string' },
          description: 'Target topics or entities to evaluate against (optional)',
        },
      },
      required: ['url'],
    },
    outputDescription:
      'audit_id, visibility_score, category_scores, status, report_url, triple_check_enabled, model_count',
  },
  {
    name: 'get_audit_report',
    description:
      'Retrieve the full evidence-linked audit report for a completed audit. Includes visibility score, category grades, recommendations with evidence IDs, content analysis, AI platform scores, keyword intelligence, and timestamped metadata.',
    phase: 1,
    minimumTier: 'alignment',
    inputSchema: {
      type: 'object',
      properties: {
        audit_id: { type: 'string', description: 'UUID of the audit to retrieve' },
      },
      required: ['audit_id'],
    },
    outputDescription:
      'Full audit with visibility_score, category_grades, recommendations, content_analysis, ai_platform_scores, keyword_intelligence, technical_signals, schema_markup, evidence_manifest, triple_check_summary, analyzed_at',
  },
  {
    name: 'export_report',
    description:
      'Export an audit report in the specified format. JSON returns the full structured payload. CSV returns tabular recommendation and score data.',
    phase: 1,
    minimumTier: 'alignment',
    inputSchema: {
      type: 'object',
      properties: {
        audit_id: { type: 'string', description: 'UUID of the audit to export' },
        format: {
          type: 'string',
          enum: ['json', 'csv'],
          description: 'Export format (default: json)',
        },
      },
      required: ['audit_id'],
    },
    outputDescription: 'Structured export payload or CSV text with report metadata, scores, and recommendations',
  },

  // ── Phase 2 ──
  {
    name: 'reanalyze_url',
    description:
      'Re-run an audit on a URL, bypassing any cached result. If previous_audit_id is provided, the response includes a delta comparison showing score changes and category movement.',
    phase: 2,
    minimumTier: 'alignment',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public URL to re-audit' },
        previous_audit_id: {
          type: 'string',
          description: 'Prior audit ID for delta comparison (optional)',
        },
      },
      required: ['url'],
    },
    outputDescription:
      'New audit_id, visibility_score, status, plus delta object (score_change, category_changes) if previous_audit_id was provided',
  },
  {
    name: 'get_visibility_history',
    description:
      'Retrieve the audit timeline and score trend for a URL or project. Returns chronological score history, category trends, and any detected score drops.',
    phase: 2,
    minimumTier: 'alignment',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Filter history to this URL (optional)' },
        project_id: { type: 'string', description: 'Filter history to this workspace (optional)' },
        days: { type: 'number', description: 'Lookback window in days (1-365, default 90)' },
      },
    },
    outputDescription:
      'Audit timeline with score_history, category_trends, summary (total, avg, best, worst), drop_alerts',
  },
  {
    name: 'compare_competitors',
    description:
      'Compare a primary URL against tracked competitors. Returns category-level deltas, gap analysis, largest opportunity areas, and prioritized recommendations.',
    phase: 2,
    minimumTier: 'alignment',
    inputSchema: {
      type: 'object',
      properties: {
        primary_url: { type: 'string', description: 'Your URL to compare from' },
        competitor_urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific competitor URLs to compare (optional - defaults to all tracked competitors)',
        },
      },
      required: ['primary_url'],
    },
    outputDescription:
      'your_url, your_score, competitors array with scores and gaps, category_comparison, opportunities, your_advantages',
  },

  // ── Phase 3 ──
  {
    name: 'run_citation_test',
    description:
      'Test whether a URL is cited by AI answer engines. Runs queries across platforms (ChatGPT, Perplexity, Claude, Google AI) and returns a citation presence matrix with evidence.',
    phase: 3,
    minimumTier: 'signal',
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
          description: 'Specific queries to test. If omitted, generate queries automatically.',
        },
      },
      required: ['url'],
    },
    outputDescription:
      'test_id, status, citation results per platform, mention_rate, query evidence, platform matrix',
  },
  {
    name: 'create_remediation_plan',
    description:
      'Generate an ordered implementation plan from audit findings. Tasks are grouped by likely impact and scored by difficulty. Optionally constrain to a target score or specific focus areas.',
    phase: 3,
    minimumTier: 'alignment',
    inputSchema: {
      type: 'object',
      properties: {
        audit_id: { type: 'string', description: 'UUID of the audit to base the plan on' },
        target_score: {
          type: 'number',
          description: 'Desired visibility score to reach (optional, 0-100)',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Focus areas or constraints, e.g. ["schema_markup", "content_depth"] (optional)',
        },
      },
      required: ['audit_id'],
    },
    outputDescription:
      'Ordered task list grouped by impact tier (high/medium/low), each with title, category, difficulty, implementation guidance, projected score lift, and evidence IDs',
  },

  // ── Supporting ──
  {
    name: 'get_methodology',
    description:
      'Retrieve AiVIS scoring methodology, including category weights, grading logic, and interpretation notes. Optionally filter to a specific category.',
    phase: 1,
    minimumTier: 'observer',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Specific category to describe (optional)',
        },
      },
    },
    outputDescription: 'Scoring categories, weights, grade thresholds, interpretation guidance',
  },
  {
    name: 'list_projects',
    description: 'List workspaces (projects) the authenticated user belongs to, with metadata and audit counts.',
    phase: 1,
    minimumTier: 'alignment',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputDescription: 'Array of project objects with id, name, is_default, member_count, audit_count',
  },
];

// ── Tool executors ───────────────────────────────────────────────────────────

const executors: Record<string, ToolExecutor> = {
  // ── Phase 1 ──

  async scan_url(params, userId, workspaceId, tier) {
    const normalized = normalizePublicHttpUrl(String(params.url));
    if (!normalized.ok) throw new Error(normalized.error);
    if (isPrivateOrLocalHost(new URL(normalized.url).hostname)) {
      throw new Error('Private and localhost URLs are not allowed');
    }

    const pool = getPool();
    const auditId = crypto.randomUUID();
    const forceRefresh = params.scan_mode === 'force_refresh';
    const targetWs = params.project_id || workspaceId;

    await pool.query(
      `INSERT INTO audits (id, user_id, workspace_id, url, status, goal, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) ON CONFLICT DO NOTHING`,
      [auditId, userId, targetWs, normalized.url, 'queued', null],
    );

    // Fire off background processing
    processQueuedAudit(auditId, userId, targetWs, normalized.url).catch((err) => {
      console.error(`[webmcp] Background scan_url ${auditId} failed:`, err?.message);
    });

    return {
      audit_id: auditId,
      url: normalized.url,
      status: 'queued',
      status_endpoint: `/api/mcp/async/${auditId}/status`,
      report_url: `/api/webmcp/tools/get_audit_report`,
      estimated_wait_seconds: 30,
      queued_at: new Date().toISOString(),
    };
  },

  async get_audit_report(params, userId, workspaceId) {
    if (!params.audit_id) throw new Error('audit_id is required');
    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, result, created_at FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [params.audit_id, userId, workspaceId],
    );
    if (!rows.length) throw new Error('Audit not found');

    const audit = rows[0];
    const r = audit.result || {};

    return {
      audit_id: audit.id,
      url: audit.url,
      analyzed_at: audit.created_at,
      visibility_score: audit.visibility_score,
      category_grades: r.category_grades || [],
      ai_platform_scores: r.ai_platform_scores || {},
      recommendations: r.recommendations || [],
      content_analysis: r.content_analysis || {},
      keyword_intelligence: r.keyword_intelligence || [],
      technical_signals: r.technical_signals || {},
      schema_markup: r.schema_markup || {},
      evidence_manifest: r.evidence_manifest || {},
      triple_check_enabled: r.triple_check_enabled || false,
      model_count: r.model_count || 1,
      triple_check_summary: r.triple_check_summary || null,
      summary: r.summary || '',
      key_takeaways: r.key_takeaways || [],
      exports_available: ['json', 'csv'],
    };
  },

  async export_report(params, userId, workspaceId) {
    if (!params.audit_id) throw new Error('audit_id is required');
    const format = (params.format || 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') throw new Error('format must be json or csv');

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, result, created_at FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [params.audit_id, userId, workspaceId],
    );
    if (!rows.length) throw new Error('Audit not found');

    const audit = rows[0];
    const r = audit.result || {};

    if (format === 'json') {
      return {
        format: 'json',
        export_timestamp: new Date().toISOString(),
        audit_id: audit.id,
        url: audit.url,
        analyzed_at: audit.created_at,
        visibility_score: audit.visibility_score,
        category_grades: r.category_grades || [],
        ai_platform_scores: r.ai_platform_scores || {},
        recommendations: r.recommendations || [],
        content_analysis: r.content_analysis || {},
        keyword_intelligence: r.keyword_intelligence || [],
        technical_signals: r.technical_signals || {},
        schema_markup: r.schema_markup || {},
        evidence_manifest: r.evidence_manifest || {},
        summary: r.summary || '',
        goal_alignment: r.goal_alignment || null,
      };
    }

    // CSV: tabular recommendations + category scores
    const recs: any[] = r.recommendations || [];
    const grades: any[] = r.category_grades || [];
    const lines: string[] = [
      `"AiVIS Audit Export"`,
      `"URL","${escapeCsv(audit.url)}"`,
      `"Analyzed","${escapeCsv(String(audit.created_at))}"`,
      `"Visibility Score","${audit.visibility_score}"`,
      ``,
      `"Category","Grade","Score","Summary"`,
      ...grades.map((g: any) => `"${escapeCsv(g.label)}","${g.grade}","${g.score}","${escapeCsv(g.summary)}"`),
      ``,
      `"Priority","Category","Title","Description","Difficulty","Impact"`,
      ...recs.map(
        (rec: any) =>
          `"${rec.priority}","${escapeCsv(rec.category)}","${escapeCsv(rec.title)}","${escapeCsv(rec.description)}","${rec.difficulty}","${escapeCsv(rec.impact)}"`,
      ),
    ];

    return {
      format: 'csv',
      export_timestamp: new Date().toISOString(),
      audit_id: audit.id,
      filename: `aivis-audit-${audit.id.slice(0, 8)}.csv`,
      content: lines.join('\n'),
    };
  },

  // ── Phase 2 ──

  async reanalyze_url(params, userId, workspaceId) {
    const normalized = normalizePublicHttpUrl(String(params.url));
    if (!normalized.ok) throw new Error(normalized.error);
    if (isPrivateOrLocalHost(new URL(normalized.url).hostname)) {
      throw new Error('Private and localhost URLs are not allowed');
    }

    const pool = getPool();
    const auditId = crypto.randomUUID();

    await pool.query(
      `INSERT INTO audits (id, user_id, workspace_id, url, status, created_at)
       VALUES ($1, $2, $3, $4, 'queued', NOW()) ON CONFLICT DO NOTHING`,
      [auditId, userId, workspaceId, normalized.url],
    );

    // Fire off background processing
    processQueuedAudit(auditId, userId, workspaceId, normalized.url).catch((err) => {
      console.error(`[webmcp] Background reanalyze_url ${auditId} failed:`, err?.message);
    });

    const result: Record<string, any> = {
      audit_id: auditId,
      url: normalized.url,
      status: 'queued',
      status_endpoint: `/api/mcp/async/${auditId}/status`,
      estimated_wait_seconds: 30,
      queued_at: new Date().toISOString(),
    };

    // If a previous audit was referenced, prepare delta context
    if (params.previous_audit_id) {
      const { rows: prior } = await pool.query(
        `SELECT id, visibility_score, result, created_at FROM audits
         WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
        [params.previous_audit_id, userId, workspaceId],
      );
      if (prior.length) {
        result.previous = {
          audit_id: prior[0].id,
          visibility_score: prior[0].visibility_score,
          analyzed_at: prior[0].created_at,
        };
        result.delta_available = true;
        result.delta_note =
          'Once the new audit completes, call get_audit_report for both audit IDs to compute category-level deltas.';
      }
    }

    return result;
  },

  async get_visibility_history(params, userId, workspaceId) {
    const days = Math.min(Math.max(parseInt(params.days) || 90, 1), 365);
    const pool = getPool();

    let query = `SELECT id, url, visibility_score, result, created_at FROM audits
       WHERE user_id = $1 AND workspace_id = $2 AND created_at >= NOW() - INTERVAL '1 day' * $3`;
    const qParams: any[] = [userId, workspaceId, days];

    if (params.url) {
      const normalized = normalizePublicHttpUrl(String(params.url));
      if (normalized.ok) {
        query += ` AND (url = $4 OR lower(regexp_replace(url, '/+$', '')) = lower(regexp_replace($4, '/+$', '')))`;
        qParams.push(normalized.url);
      }
    }
    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, qParams);

    // Build score history timeline
    const timeline = rows.map((r: any) => ({
      audit_id: r.id,
      url: r.url,
      visibility_score: r.visibility_score,
      analyzed_at: r.created_at,
      category_grades: r.result?.category_grades?.map((g: any) => ({
        label: g.label,
        grade: g.grade,
        score: g.score,
      })) || [],
    }));

    // Detect score drops (>5 point decline between consecutive audits for same URL)
    const dropAlerts: any[] = [];
    const byUrl: Record<string, any[]> = {};
    for (const entry of timeline) {
      if (!byUrl[entry.url]) byUrl[entry.url] = [];
      byUrl[entry.url].push(entry);
    }
    for (const [url, entries] of Object.entries(byUrl)) {
      for (let i = 0; i < entries.length - 1; i++) {
        const delta = entries[i].visibility_score - entries[i + 1].visibility_score;
        if (delta < -5) {
          dropAlerts.push({
            url,
            from_score: entries[i + 1].visibility_score,
            to_score: entries[i].visibility_score,
            change: delta,
            detected_at: entries[i].analyzed_at,
          });
        }
      }
    }

    const flat = rows.map((r: any) => Number(r.visibility_score)).filter(Number.isFinite);

    return {
      timeline,
      summary: {
        total_audits: rows.length,
        avg_score: flat.length ? Math.round(flat.reduce((a: number, b: number) => a + b, 0) / flat.length) : 0,
        best: flat.length ? Math.max(...flat) : 0,
        worst: flat.length ? Math.min(...flat) : 0,
      },
      drop_alerts: dropAlerts,
      period_days: days,
    };
  },

  async compare_competitors(params, userId, workspaceId) {
    const normalized = normalizePublicHttpUrl(String(params.primary_url));
    if (!normalized.ok) throw new Error(normalized.error);

    const pool = getPool();

    // Get your latest audit
    const { rows: yourAudits } = await pool.query(
      `SELECT id, url, visibility_score, result, created_at FROM audits
       WHERE user_id = $1
         AND (url = $2 OR lower(regexp_replace(url, '/+$', '')) = lower(regexp_replace($2, '/+$', '')))
       ORDER BY created_at DESC LIMIT 1`,
      [userId, normalized.url],
    );
    if (!yourAudits.length) throw new Error('No audit found for this URL. Run scan_url first.');

    const yourAudit = yourAudits[0];
    const yourResult = yourAudit.result || {};

    // Get competitors
    let compQuery = `SELECT ct.id, ct.competitor_url, ct.nickname, ct.latest_score, a.result as analysis
       FROM competitor_tracking ct
       LEFT JOIN audits a ON ct.latest_audit_id = a.id
       WHERE ct.user_id = $1`;
    const compParams: any[] = [userId];

    if (params.competitor_urls?.length) {
      const placeholders = params.competitor_urls.map((_: any, i: number) => `$${i + 2}`).join(', ');
      compQuery += ` AND ct.competitor_url IN (${placeholders})`;
      compParams.push(...params.competitor_urls);
    }

    const { rows: competitors } = await pool.query(compQuery, compParams);

    const competitorData = competitors.map((c: any) => ({
      url: c.competitor_url,
      nickname: c.nickname,
      score: c.latest_score || 0,
      gap: (c.latest_score || 0) - (yourAudit.visibility_score || 0),
    }));

    // Category comparison
    const yourCategories: any[] = yourResult.category_grades || [];
    const categoryComparison = yourCategories.map((cat: any) => {
      const compScores: Record<string, number> = {};
      for (const comp of competitors) {
        const compGrades: any[] = comp.analysis?.category_grades || [];
        const match = compGrades.find((g: any) => g.label === cat.label);
        compScores[comp.competitor_url] = match?.score ?? 0;
      }
      return { category: cat.label, your_score: cat.score, competitor_scores: compScores };
    });

    // Identify opportunities (categories where competitors outscore you)
    const opportunities: any[] = [];
    const advantages: any[] = [];
    for (const cat of categoryComparison) {
      const compAvg =
        Object.values(cat.competitor_scores).length > 0
          ? Object.values(cat.competitor_scores).reduce((a, b) => a + b, 0) / Object.values(cat.competitor_scores).length
          : 0;
      if (compAvg > cat.your_score + 5) {
        opportunities.push({ category: cat.category, your_score: cat.your_score, competitor_avg: Math.round(compAvg), gap: Math.round(compAvg - cat.your_score) });
      } else if (cat.your_score > compAvg + 5) {
        advantages.push({ category: cat.category, your_score: cat.your_score, competitor_avg: Math.round(compAvg), lead: Math.round(cat.your_score - compAvg) });
      }
    }

    return {
      your_url: yourAudit.url,
      your_score: yourAudit.visibility_score,
      competitors: competitorData,
      category_comparison: categoryComparison,
      opportunities,
      your_advantages: advantages,
    };
  },

  // ── Phase 3 ──

  async run_citation_test(params, userId, workspaceId) {
    const normalized = normalizePublicHttpUrl(String(params.url));
    if (!normalized.ok) throw new Error(normalized.error);

    const platforms = params.platforms || ['chatgpt', 'perplexity', 'claude', 'google_ai'];
    const queries: string[] = params.queries || [];

    const pool = getPool();

    // If no queries provided, caller should generate them first - but we still accept empty
    // to allow the async test infrastructure to handle query generation
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

  async create_remediation_plan(params, userId, workspaceId) {
    if (!params.audit_id) throw new Error('audit_id is required');

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, url, visibility_score, result, created_at FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [params.audit_id, userId, workspaceId],
    );
    if (!rows.length) throw new Error('Audit not found');

    const audit = rows[0];
    const r = audit.result || {};
    const recommendations: any[] = r.recommendations || [];
    const categoryGrades: any[] = r.category_grades || [];
    const targetScore = params.target_score ?? 100;

    // Build remediation tasks from recommendations, ordered by impact
    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const difficultyWeight: Record<string, number> = { easy: 3, medium: 2, hard: 1 };

    // Filter by constraints if provided
    let filteredRecs = recommendations;
    if (params.constraints?.length) {
      const constraintSet = new Set(params.constraints.map((c: string) => c.toLowerCase()));
      filteredRecs = recommendations.filter(
        (rec: any) =>
          constraintSet.has(rec.category?.toLowerCase()) ||
          constraintSet.has(rec.scorefix_category?.toLowerCase()),
      );
      // If constraints filtered out everything, fall back to all
      if (!filteredRecs.length) filteredRecs = recommendations;
    }

    const tasks = filteredRecs
      .map((rec: any, idx: number) => ({
        order: idx + 1,
        title: rec.title,
        category: rec.category,
        priority: rec.priority,
        difficulty: rec.difficulty,
        impact_score: (priorityWeight[rec.priority] || 1) * (difficultyWeight[rec.difficulty] || 1),
        implementation: rec.implementation || rec.description,
        evidence_ids: rec.evidence_ids || [],
        projected_lift: rec.priority === 'high' ? '3-8 points' : rec.priority === 'medium' ? '1-4 points' : '0-2 points',
      }))
      .sort((a: any, b: any) => b.impact_score - a.impact_score)
      .map((t: any, i: number) => ({ ...t, order: i + 1 }));

    // Group by impact tier
    const high = tasks.filter((t: any) => t.priority === 'high');
    const medium = tasks.filter((t: any) => t.priority === 'medium');
    const low = tasks.filter((t: any) => t.priority === 'low');

    // Weakest categories
    const weakCategories = categoryGrades
      .filter((g: any) => g.score < 70)
      .sort((a: any, b: any) => a.score - b.score)
      .map((g: any) => ({ category: g.label, score: g.score, grade: g.grade }));

    return {
      audit_id: audit.id,
      url: audit.url,
      current_score: audit.visibility_score,
      target_score: targetScore,
      score_gap: Math.max(0, targetScore - (audit.visibility_score || 0)),
      total_tasks: tasks.length,
      impact_groups: {
        high: { count: high.length, tasks: high },
        medium: { count: medium.length, tasks: medium },
        low: { count: low.length, tasks: low },
      },
      weakest_categories: weakCategories,
      constraints_applied: params.constraints || [],
    };
  },

  // ── Supporting ──

  async get_methodology(params) {
    const METHODOLOGY = {
      version: '2.0',
      description:
        'AiVIS scores websites on AI visibility - how readable, extractable, and citation-ready they are for AI answer engines.',
      scoring_range: { min: 0, max: 100 },
      categories: [
        {
          key: 'content_quality',
          label: 'Content Quality & Depth',
          weight: 0.25,
          description:
            'Evaluates topical authority, semantic richness, word count, heading structure, and answer-ready formatting.',
          grades: { A: '90-100', B: '75-89', C: '60-74', D: '40-59', F: '0-39' },
        },
        {
          key: 'technical_signals',
          label: 'Technical SEO & Signals',
          weight: 0.2,
          description:
            'HTTPS, response time, canonical tags, meta descriptions, open graph, mobile readiness, crawlability signals.',
          grades: { A: '90-100', B: '75-89', C: '60-74', D: '40-59', F: '0-39' },
        },
        {
          key: 'schema_markup',
          label: 'Schema & Structured Data',
          weight: 0.2,
          description:
            'JSON-LD presence, schema type coverage, FAQ/HowTo/Article markup, breadcrumbs, entity annotation.',
          grades: { A: '90-100', B: '75-89', C: '60-74', D: '40-59', F: '0-39' },
        },
        {
          key: 'authority_trust',
          label: 'Authority & Trust',
          weight: 0.2,
          description:
            'E-E-A-T signals, author attribution, citation footprint, brand entity recognition, backlink authority indicators.',
          grades: { A: '90-100', B: '75-89', C: '60-74', D: '40-59', F: '0-39' },
        },
        {
          key: 'ai_readability',
          label: 'AI Readability & Extractability',
          weight: 0.15,
          description:
            'How cleanly AI models can parse the page: heading hierarchy, list usage, direct answers, noise ratio, machine-parseable formatting.',
          grades: { A: '90-100', B: '75-89', C: '60-74', D: '40-59', F: '0-39' },
        },
      ],
      interpretation: {
        '90-100': 'Excellent - highly visible and citation-ready across AI platforms.',
        '75-89': 'Good - solid foundation with specific improvement opportunities.',
        '60-74': 'Fair - visible but missing key structured data or authority signals.',
        '40-59': 'Poor - significant gaps in AI readability and extractability.',
        '0-39': 'Critical - largely invisible to AI answer engines.',
      },
    };

    if (params.category) {
      const cat = METHODOLOGY.categories.find(
        (c) => c.key === params.category || c.label.toLowerCase().includes(String(params.category).toLowerCase()),
      );
      if (cat) return { category: cat, scoring_range: METHODOLOGY.scoring_range, interpretation: METHODOLOGY.interpretation };
      throw new Error(`Unknown category: ${params.category}. Available: ${METHODOLOGY.categories.map((c) => c.key).join(', ')}`);
    }

    return METHODOLOGY;
  },

  async list_projects(_params, userId) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT w.id, w.name, w.is_default, w.created_at,
              (SELECT COUNT(*)::int FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count,
              (SELECT COUNT(*)::int FROM audits a WHERE a.workspace_id = w.id) AS audit_count
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.is_default DESC, w.created_at ASC`,
      [userId],
    );
    return { projects: rows };
  },
};

// ── CSV helper ───────────────────────────────────────────────────────────────

function escapeCsv(value: string): string {
  return String(value || '').replace(/"/g, '""');
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Discovery: unauthenticated
router.get('/manifest', (_req: Request, res: Response) => {
  res.json({
    schema_version: '0.1.0',
    name: 'aivis',
    display_name: 'AiVIS.biz -> evidence-backed site analysis for AI answers',
    description:
      'Audit, measure, and improve how AI answer engines see your website. Structured tools for visibility scoring, citation testing, competitor comparison, and remediation planning.',
    logo_url: 'https://aivis.biz/icon-512.png',
    contact_email: 'support@aivis.biz',
    auth: {
      type: 'bearer',
      instructions:
        'Obtain an API key (avis_*) from your AiVIS dashboard under Settings → API Keys, or use an OAuth token (avist_*).',
    },
    tools_endpoint: '/api/webmcp/tools',
    invoke_endpoint: '/api/webmcp/tools/{tool_name}',
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    })),
  });
});

// Authenticated routes below
router.use('/tools', webMcpAuth);

// List tools (filtered by tier)
router.get('/tools', (req: Request, res: Response) => {
  const tier = (req as any).mcpTier as CanonicalTier;
  const available = TOOLS.filter((t) => meetsMinimumTier(tier, t.minimumTier));
  res.json({
    tools: available.map((t) => ({
      name: t.name,
      description: t.description,
      phase: t.phase,
      minimum_tier: t.minimumTier,
      input_schema: t.inputSchema,
      output_description: t.outputDescription,
    })),
    tier,
    total: available.length,
  });
});

// Invoke a tool
router.post('/tools/:toolName', async (req: Request, res: Response) => {
  try {
    const toolName = req.params.toolName as string;
    const tool = TOOLS.find((t) => t.name === toolName);
    if (!tool) return res.status(404).json({ error: `Unknown tool: ${toolName}` });

    const tier = (req as any).mcpTier as CanonicalTier;
    if (!meetsMinimumTier(tier, tool.minimumTier)) {
      return res.status(403).json({
        error: `Tool "${toolName}" requires ${tool.minimumTier} tier or higher. Current tier: ${tier}`,
      });
    }

    const executor = executors[toolName];
    if (!executor) return res.status(501).json({ error: `Tool ${toolName} has no executor` });

    const userId = (req as any).mcpUserId;
    const workspaceId = (req as any).mcpWorkspaceId;
    const result = await executor(req.body || {}, userId, workspaceId, tier);

    return res.json({ tool: toolName, result });
  } catch (err: any) {
    return res.status(err.message?.includes('not found') ? 404 : 500).json({
      error: 'Request failed. Please try again.',
      tool: req.params.toolName,
    });
  }
});

export default router;
