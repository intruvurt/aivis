// server/src/routes/reverseEngineerApi.ts
import express, { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { usageGate } from '../middleware/usageGate.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import {
  decompileAnswer,
  generateCompetitorGhost,
  analyzeModelPreferences,
  simulateVisibility,
  rewriteContentVoice,
} from './reverseEngineerRoutes.js';
import { scrapeWebsite } from '../services/scraper.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import { gateToolAction } from '../services/toolCreditGate.js';

const router = express.Router();

/** Route-level safety deadline (ms) — kills request if handler runs too long */
const ROUTE_DEADLINE_MS = 45_000;

// All reverse-engineer routes require authentication + usage gate
router.use(authRequired);
router.use(usageGate);

// Tier gate: Alignment+ only (reverse engineer uses paid AI models)
router.use((req: Request, res: Response, next) => {
  const user = (req as any).user;
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      success: false,
      error: 'Reverse Engineer tools require an Alignment or Signal plan.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }
  next();
});

// Tool credit gate — deducts credits after free monthly allowance
router.use(async (req: Request, res: Response, next) => {
  const user = (req as any).user;
  if (!user?.id) return next();
  try {
    const gate = await gateToolAction(user.id, 'reverse_engineer', user.tier || 'observer');
    if (!gate.allowed) {
      return res.status(402).json({
        success: false,
        error: gate.reason,
        code: 'CREDITS_REQUIRED',
        creditCost: gate.creditCost,
        creditsRemaining: gate.creditsRemaining,
      });
    }
    (req as any).creditInfo = gate;
  } catch (gateErr: any) {
    // Credit gate DB error — fail-open so users aren't blocked from using a paid feature
    console.error('[ReverseEngineer] Credit gate error (fail-open):', gateErr?.message);
  }
  next();
});

/** Wrap an async handler with a hard deadline so the client always gets a response */
function withRouteDeadline(
  label: string,
  handler: (req: Request, res: Response) => Promise<any>,
) {
  return async (req: Request, res: Response) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`[ReverseEngineer] ${label} route deadline exceeded (${ROUTE_DEADLINE_MS / 1000}s)`);
        res.status(504).json({ success: false, error: `${label} took too long. Please try again.` });
      }
    }, ROUTE_DEADLINE_MS);

    try {
      await handler(req, res);
    } catch (err: any) {
      if (!res.headersSent) {
        console.error(`[ReverseEngineer] ${label} error:`, err.message);
        res.status(500).json({ success: false, error: 'Analysis failed' });
      }
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * POST /api/reverse-engineer/decompile
 * Reverse-engineer an AI answer into structural patterns
 * Body: { answer: string }
 */
router.post('/decompile', withRouteDeadline('Decompile', async (req: Request, res: Response) => {
  const { answer } = req.body;
  if (!answer || typeof answer !== 'string' || answer.trim().length < 20) {
    return res.status(400).json({
      success: false,
      error: 'Provide an AI answer to analyze (min 20 characters)',
    });
  }

  const result = await decompileAnswer(answer.trim());
  return res.json({ success: true, data: result });
}));

/**
 * POST /api/reverse-engineer/ghost
 * Generate ideal AI-optimized page blueprint for a query
 * Body: { query: string }
 */
router.post('/ghost', withRouteDeadline('Blueprint', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Provide a search query (min 3 characters)',
    });
  }

  const result = await generateCompetitorGhost(query.trim());
  return res.json({ success: true, data: result });
}));

/**
 * POST /api/reverse-engineer/model-diff
 * Compare how different AI models answer the same query
 * Body: { query: string, contentSummary?: string }
 */
router.post('/model-diff', withRouteDeadline('Model Diff', async (req: Request, res: Response) => {
  const { query, contentSummary } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Provide a search query (min 3 characters)',
    });
  }

  const result = await analyzeModelPreferences(query.trim(), contentSummary);
  return res.json({ success: true, data: result });
}));

/**
 * POST /api/reverse-engineer/simulate
 * Simulate visibility probability changes from content modifications
 * Body: { url: string, targetQuery?: string }
 */
router.post('/simulate', withRouteDeadline('Simulator', async (req: Request, res: Response) => {
  const { url, targetQuery } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Provide a URL to analyze',
    });
  }

  const normalized = normalizePublicHttpUrl(url);
  if (!normalized.ok) {
    return res.status(400).json({ success: false, error: normalized.error });
  }

  // Scrape the page content first
  const scraped = await scrapeWebsite(normalized.url);
  const result = await simulateVisibility(normalized.url, scraped, targetQuery);
  return res.json({ success: true, data: result });
}));

/**
 * POST /api/reverse-engineer/rewrite
 * Rewrites content in a selected AI-citation voice preset
 * Body: { content: string, voicePreset: string, targetQuery?: string }
 */
router.post('/rewrite', withRouteDeadline('Rewrite', async (req: Request, res: Response) => {
  const { content, voicePreset, targetQuery } = req.body as {
    content?: string;
    voicePreset?: string;
    targetQuery?: string;
  };

  if (!content || typeof content !== 'string' || content.trim().length < 30) {
    return res.status(400).json({ success: false, error: 'Provide content to rewrite (min 30 characters)' });
  }

  const VALID_PRESETS = ['authoritative', 'conversational', 'data_driven', 'how_to', 'faq'];
  const preset = voicePreset && VALID_PRESETS.includes(voicePreset) ? voicePreset : 'authoritative';

  const result = await rewriteContentVoice(content.trim(), preset, targetQuery?.trim());
  return res.json({ success: true, data: result });
}));

export default router;
