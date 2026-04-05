import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import {
  buildGoogleAuthUrl,
  verifyOAuthState,
  exchangeCodeForTokens,
  getGoogleProfile,
  getGscFrontendSuccessUrl,
  getGscFrontendErrorUrl,
} from '../modules/gsc-intelligence/gsc.oauth.js';
import {
  upsertGscConnection,
  syncPropertiesFromGoogle,
  listUserProperties,
  setSelectedProperty,
  getSelectedProperty,
  snapshotProperty,
  getLatestSnapshotJob,
  getActiveConnectionByUser,
} from '../modules/gsc-intelligence/gsc.service.js';
import { planToolFromPrompt } from '../modules/gsc-intelligence/planner.js';
import { executeGscTool } from '../modules/gsc-intelligence/tools.js';
import type { GscToolName } from '../modules/gsc-intelligence/tools.js';
import {
  planInputSchema,
  executeInputSchema,
} from '../modules/gsc-intelligence/gsc.validators.js';

const router = Router();

// ── OAuth routes (no tier gate - user must auth first to connect) ──

// GET /api/integrations/gsc/oauth/start - redirect user to Google consent
router.get('/oauth/start', authRequired, (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const url = buildGoogleAuthUrl(userId, req);
    res.json({ url });
  } catch (err: unknown) {
    console.error('[gsc-oauth] Failed to build auth URL:', err);
    res.status(500).json({ error: 'GSC OAuth not configured' });
  }
});

// GET /api/integrations/gsc/oauth/callback - Google redirects here with code
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query as Record<string, string | undefined>;

    if (error) {
      console.warn('[gsc-oauth] Google returned error param:', error);
      return res.redirect(getGscFrontendErrorUrl(error, req));
    }

    if (!code || !state) {
      console.warn('[gsc-oauth] Missing code or state in callback');
      return res.redirect(getGscFrontendErrorUrl('Missing code or state', req));
    }

    console.log('[gsc-oauth] Callback received, exchanging code for tokens…');
    const { userId } = verifyOAuthState(state);
    const tokens = await exchangeCodeForTokens(code, req);
    console.log('[gsc-oauth] Token exchange ok, fetching Google profile…');
    const profile = await getGoogleProfile(tokens.accessToken);
    console.log('[gsc-oauth] Profile fetched (%s), upserting connection…', profile.email);

    await upsertGscConnection({
      userId,
      googleEmail: profile.email,
      googleSub: profile.sub,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      tokenExpiresAt: tokens.expiresAt,
    });
    console.log('[gsc-oauth] Connection upserted for user %s', userId);

    // Sync properties - non-fatal: connection is already saved
    try {
      await syncPropertiesFromGoogle(userId);
      console.log('[gsc-oauth] Property sync complete');
    } catch (syncErr) {
      console.error('[gsc-oauth] Property sync failed (non-fatal):', syncErr);
    }

    return res.redirect(getGscFrontendSuccessUrl(req));
  } catch (err: unknown) {
    console.error('[gsc-oauth] Callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.redirect(getGscFrontendErrorUrl(message, req));
  }
});

// ── All remaining GSC routes require auth + Alignment+ tier ──
router.use(authRequired);

router.use((req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      error: 'GSC Intelligence Console requires an Alignment or higher plan.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }
  next();
});

// ── Property management ──

// GET /properties - list user's connected GSC properties
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    // Check for an active GSC connection first - return 404 if not connected
    const connection = await getActiveConnectionByUser(userId);
    if (!connection) {
      return res.status(404).json({ error: 'No GSC connection found', code: 'NOT_CONNECTED' });
    }
    const properties = await listUserProperties(userId);
    res.json({ properties, email: connection.google_account_email });
  } catch (err: unknown) {
    console.error('[gsc] listProperties error:', err);
    res.status(500).json({ error: 'Failed to list GSC properties' });
  }
});

// POST /properties/sync - re-sync properties from Google
router.post('/properties/sync', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    const synced = await syncPropertiesFromGoogle(userId);
    res.json({ synced });
  } catch (err: unknown) {
    console.error('[gsc] syncProperties error:', err);
    res.status(500).json({ error: 'Failed to sync GSC properties' });
  }
});

// POST /properties/:id/select - set active property
router.post('/properties/:id/select', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    const propertyId = String(req.params.id);
    const property = await setSelectedProperty(userId, propertyId);
    res.json({ property });
  } catch (err: unknown) {
    console.error('[gsc] selectProperty error:', err);
    res.status(500).json({ error: 'Failed to select property' });
  }
});

// GET /properties/selected - get currently selected property
router.get('/properties/selected', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    const property = await getSelectedProperty(userId);
    res.json({ property });
  } catch (err: unknown) {
    console.error('[gsc] getSelected error:', err);
    res.status(500).json({ error: 'Failed to get selected property' });
  }
});

// ── Snapshot management ──

// POST /snapshot - capture current GSC data as a snapshot
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    const { propertyId } = req.body as { propertyId?: string };
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId required' });
    }
    const result = await snapshotProperty(userId, propertyId);
    res.json(result);
  } catch (err: unknown) {
    console.error('[gsc] snapshot error:', err);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// GET /snapshot/status - get latest snapshot job status
router.get('/snapshot/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    const { propertyId } = req.query as { propertyId?: string };
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId required' });
    }
    const job = await getLatestSnapshotJob(userId, propertyId);
    res.json({ job });
  } catch (err: unknown) {
    console.error('[gsc] snapshotStatus error:', err);
    res.status(500).json({ error: 'Failed to get snapshot status' });
  }
});

// ── AI planner ──

// POST /plan - natural language → tool selection
router.post('/plan', (req: Request, res: Response) => {
  try {
    const parsed = planInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid plan input', details: parsed.error.flatten() });
    }
    const plan = planToolFromPrompt(parsed.data.prompt);
    res.json({ plan });
  } catch (err: unknown) {
    console.error('[gsc] plan error:', err);
    res.status(500).json({ error: 'Planning failed' });
  }
});

// ── Tool execution ──

// POST /execute - run a specific GSC tool
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const parsed = executeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid execute input', details: parsed.error.flatten() });
    }
    const userId = (req as any).user?.id as string;
    const workspaceId = (req as any).workspace?.id ?? null;
    const { toolName, args } = parsed.data;

    const result = await executeGscTool(
      toolName as GscToolName,
      { userId, workspaceId },
      args,
    );
    res.json(result);
  } catch (err: unknown) {
    console.error('[gsc] execute error:', err);
    res.status(500).json({ error: 'Tool execution failed' });
  }
});

export default router;
