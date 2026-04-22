/**
 * Simulation Routes — /api/simulate
 *
 * Exposes the AI Answer Simulation Engine (AVP) as an authenticated API.
 *
 * POST /api/simulate
 *   Body: { url, primaryEntity, aliases?, queries?, scanId?, workspaceId? }
 *   Returns: SimulationRunResult
 *
 * GET  /api/simulate/drift
 *   Query: url, days?
 *   Returns: TemporalDriftPoint[] — unified audit score + AVP timeline
 *
 * Security: authRequired on all routes. userId from JWT — no client trust.
 * Rate limiting: simulation honours tier query caps internally.
 */

import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import { runSimulation } from '../services/aiAnswerSimulationEngine.js';
import { getTemporalDriftWithAVP } from '../services/visibilityTimeline.js';
import { sanitizeInput } from '../utils/sanitize.js';
import { uiTierFromCanonical, type CanonicalTier, type UiTier } from '../../../shared/types.js';

const router = Router();
router.use(authRequired);
router.use(workspaceRequired);

function toSimulationTier(tier: UiTier): 'observer' | 'starter' | 'alignment' | 'signal' {
    if (tier === 'signal' || tier === 'scorefix' || tier === 'agency') return 'signal';
    if (tier === 'alignment') return 'alignment';
    if (tier === 'starter') return 'starter';
    return 'observer';
}

// ── POST /api/simulate ────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = String(req.user?.id ?? '').trim();
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const rawUrl = req.body?.url;
        const rawEntity = req.body?.primaryEntity ?? req.body?.primary_entity ?? '';
        const rawAliases: unknown[] = Array.isArray(req.body?.aliases) ? req.body.aliases : [];
        const rawQueries: unknown[] = Array.isArray(req.body?.queries) ? req.body.queries : [];
        const scanId: string | null = typeof req.body?.scanId === 'string' ? req.body.scanId : null;
        const workspaceId: string | null = String(req.workspace?.id || '').trim() || null;

        if (!rawUrl || typeof rawUrl !== 'string') {
            res.status(400).json({ success: false, error: 'url is required' });
            return;
        }

        const normalized = normalizePublicHttpUrl(sanitizeInput(rawUrl as string).slice(0, 500));
        if (!normalized.ok) {
            res.status(400).json({ success: false, error: normalized.error });
            return;
        }
        const url = normalized.url;
        const primaryEntity = sanitizeInput(String(rawEntity)).slice(0, 200);
        const aliases = rawAliases
            .filter((a): a is string => typeof a === 'string')
            .map((a) => sanitizeInput(a).slice(0, 100))
            .slice(0, 10);
        const queries = rawQueries
            .filter((q): q is string => typeof q === 'string')
            .map((q) => sanitizeInput(q).slice(0, 300))
            .filter(Boolean);

        // Resolve tier from JWT
        const canonicalTier = (req.user?.tier ?? 'observer') as CanonicalTier;
        const uiTier = uiTierFromCanonical(canonicalTier);
        const tier = toSimulationTier(uiTier);

        // Fall back to entity name derived from URL if not provided
        const resolvedEntity = primaryEntity || normalized.hostname.replace(/^www\./, '');

        // Fall back to a minimal default query set if none provided
        const resolvedQueries =
            queries.length > 0
                ? queries
                : [
                    `What is ${resolvedEntity}?`,
                    `Who are the top tools for ${resolvedEntity}?`,
                ];

        const result = await runSimulation({
            primaryEntity: resolvedEntity,
            aliases,
            queries: resolvedQueries,
            url,
            scanId,
            userId,
            workspaceId,
            tier,
        });

        res.json({ success: true, data: result });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Simulation failed';
        const status = /unavailable|all model calls failed/i.test(message) ? 503 : 500;
        res.status(status).json({ success: false, error: message });
    }
});

// ── GET /api/simulate/drift ───────────────────────────────────────────────────

router.get('/drift', async (req: Request, res: Response) => {
    try {
        const userId = String(req.user?.id ?? '').trim();
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const rawUrl = req.query?.url;
        if (!rawUrl || typeof rawUrl !== 'string') {
            res.status(400).json({ success: false, error: 'url query param is required' });
            return;
        }

        const normalized = normalizePublicHttpUrl(sanitizeInput(rawUrl).slice(0, 500));
        if (!normalized.ok) {
            res.status(400).json({ success: false, error: normalized.error });
            return;
        }
        const url = normalized.url;
        const days = Math.min(365, Math.max(1, Number(req.query?.days ?? 30)));

        const workspaceId = String(req.workspace?.id || '').trim() || null;
        const points = await getTemporalDriftWithAVP(userId, url, days, workspaceId);

        res.json({ success: true, data: points });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Drift fetch failed';
        res.status(500).json({ success: false, error: message });
    }
});

export default router;
