/**
 * Organization Routes (Level 5 — VaaS)
 *
 * Org management, org-level branding config, widget token management,
 * and industry benchmark access.  All routes require authentication.
 * Branding + widget endpoints additionally require agency-tier or higher.
 */
import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import { getPool } from '../services/postgresql.js';
import { getBranding, upsertBranding } from '../services/brandingService.js';
import {
  createWidgetToken,
  listWidgetTokens,
  deleteWidgetToken,
} from '../services/widgetService.js';
import {
  getAllBenchmarks,
  compareToBenchmarks,
  recomputeBenchmarks,
} from '../services/industryBenchmarkService.js';

const router = Router();
router.use(authRequired);

// ── Tier helpers ──────────────────────────────────────────────────────────────

function userTier(req: Request): CanonicalTier | LegacyTier {
  return ((req as any).user?.tier || 'observer') as CanonicalTier | LegacyTier;
}

function requireAgency(req: Request, res: Response): boolean {
  if (!meetsMinimumTier(userTier(req), 'agency')) {
    res.status(403).json({
      success: false,
      error: 'This feature requires Agency tier or higher.',
      requiredTier: 'agency',
    });
    return false;
  }
  return true;
}

function requireSignal(req: Request, res: Response): boolean {
  if (!meetsMinimumTier(userTier(req), 'signal')) {
    res.status(403).json({
      success: false,
      error: 'This feature requires Signal tier or higher.',
      requiredTier: 'signal',
    });
    return false;
  }
  return true;
}

// ── GET /api/orgs — List orgs the user belongs to ────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT o.id, o.name, o.slug, o.is_personal, o.created_at,
              wm.role AS user_role,
              (SELECT COUNT(*) FROM workspaces w2 WHERE w2.organization_id = o.id)::int AS workspace_count
         FROM organizations o
         JOIN workspace_members wm ON wm.workspace_id IN (
           SELECT id FROM workspaces WHERE organization_id = o.id
         )
         WHERE wm.user_id = $1
         GROUP BY o.id, wm.role
         ORDER BY o.created_at ASC`,
      [user.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list organizations' });
  }
});

// ── GET /api/orgs/:orgId — Org details ───────────────────────────────────────

router.get('/:orgId', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const orgId = String(req.params.orgId || '').trim();
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT o.id, o.name, o.slug, o.is_personal, o.owner_user_id, o.created_at,
              o.updated_at,
              (SELECT COUNT(*) FROM workspaces w WHERE w.organization_id = o.id)::int AS workspace_count,
              (SELECT COUNT(DISTINCT wm.user_id) FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id WHERE w.organization_id = o.id)::int AS member_count
         FROM organizations o
        WHERE o.id = $1
          AND (o.owner_user_id = $2 OR EXISTS (
            SELECT 1 FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id
             WHERE w.organization_id = o.id AND wm.user_id = $2
          ))`,
      [orgId, user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Organization not found' });
    return res.json({ success: true, data: rows[0] });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET/PUT /api/orgs/:orgId/branding — Org-level white-label config ─────────

router.get('/:orgId/branding', workspaceRequired, async (req: Request, res: Response) => {
  if (!requireSignal(req, res)) return;
  const workspaceId = String((req as any).workspace?.id || '').trim();
  const userId = String((req as any).user?.id || '').trim();
  try {
    const branding = await getBranding(userId, workspaceId);
    return res.json({ success: true, data: branding ?? null });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/:orgId/branding', workspaceRequired, async (req: Request, res: Response) => {
  if (!requireSignal(req, res)) return;
  const workspaceId = String((req as any).workspace?.id || '').trim();
  const userId = String((req as any).user?.id || '').trim();
  try {
    const branding = await upsertBranding(userId, workspaceId, {
      company_name: req.body.company_name,
      logo_url: req.body.logo_url,
      logo_base64: req.body.logo_base64,
      primary_color: req.body.primary_color,
      accent_color: req.body.accent_color,
      footer_text: req.body.footer_text,
      tagline: req.body.tagline,
      contact_email: req.body.contact_email,
      website_url: req.body.website_url,
      show_cover_page: req.body.show_cover_page,
    });
    return res.json({ success: true, data: branding });
  } catch (err: any) {
    const msg = String(err?.message || 'Failed to save branding');
    const status = /invalid|required|size/i.test(msg) ? 400 : 500;
    return res.status(status).json({ success: false, error: msg });
  }
});

// ── GET /api/orgs/:orgId/members — List org members ──────────────────────────

router.get('/:orgId/members', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const orgId = String(req.params.orgId || '').trim();
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT DISTINCT u.id, u.email, u.tier, u.created_at,
              wm.role, wm.joined_at
         FROM workspace_members wm
         JOIN workspaces w ON w.id = wm.workspace_id
         JOIN users u ON u.id = wm.user_id
        WHERE w.organization_id = $1
          AND (
            SELECT COUNT(*) FROM workspaces wx JOIN workspace_members wm2 ON wm2.workspace_id = wx.id
             WHERE wx.organization_id = $1 AND wm2.user_id = $2
          ) > 0`,
      [orgId, user.id]
    );
    return res.json({ success: true, data: rows });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── Widget tokens — Agency + ──────────────────────────────────────────────────

router.get('/:orgId/widgets', workspaceRequired, async (req: Request, res: Response) => {
  if (!requireAgency(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const workspaceId = String((req as any).workspace?.id || '').trim();
  try {
    const tokens = await listWidgetTokens(userId, workspaceId);
    return res.json({ success: true, data: tokens });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/:orgId/widgets', workspaceRequired, async (req: Request, res: Response) => {
  if (!requireAgency(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const workspaceId = String((req as any).workspace?.id || '').trim();
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ success: false, error: '`url` is required' });

  try {
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

router.delete('/:orgId/widgets/:tokenId', workspaceRequired, async (req: Request, res: Response) => {
  if (!requireAgency(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const workspaceId = String((req as any).workspace?.id || '').trim();
  const tokenId = String(req.params.tokenId || '').trim();
  try {
    const deleted = await deleteWidgetToken(userId, workspaceId, tokenId);
    if (!deleted) return res.status(404).json({ success: false, error: 'Widget not found' });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── Industry benchmarks — Signal+ ────────────────────────────────────────────

router.get('/benchmarks', async (req: Request, res: Response) => {
  if (!requireSignal(req, res)) return;
  try {
    void recomputeBenchmarks().catch(() => {});
    const benchmarks = await getAllBenchmarks();
    return res.json({ success: true, data: benchmarks });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/benchmarks/compare', async (req: Request, res: Response) => {
  if (!requireSignal(req, res)) return;
  try {
    const url = String(req.query.url || '').trim();
    const score = parseFloat(String(req.query.score || ''));
    if (!url || isNaN(score)) {
      return res.status(400).json({ success: false, error: 'url and score are required' });
    }
    const comparison = await compareToBenchmarks(score, url);
    return res.json({ success: true, data: comparison });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
