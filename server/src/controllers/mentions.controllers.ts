// server/src/controllers/mentions.controllers.ts
import type { Request, Response } from 'express';
import {
  trackBrandMentions,
  persistMentionScan,
  getMentionHistory,
  getMentionSourceBreakdown,
  getMentionTimeline,
  computeMentionKPIs,
  saveMentionKPISnapshot,
  getMentionKPIHistory,
} from '../services/mentionTracker.js';
import { gateToolAction } from '../services/toolCreditGate.js';

/**
 * POST /api/mentions/scan
 * Run a live mention scan across all free public sources.
 */
export async function runMentionScan(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { brand, domain } = req.body || {};
    if (!brand || typeof brand !== 'string' || brand.trim().length < 2) {
      return res.status(400).json({ error: 'brand is required (min 2 characters)' });
    }

    // Tool credit gate
    const user = (req as any).user;
    let gate: Awaited<ReturnType<typeof gateToolAction>>;
    try {
      gate = await gateToolAction(userId, 'mention_scan', user.tier || 'observer');
    } catch (gateErr: any) {
      console.error('[MentionScan] gateToolAction failed:', gateErr?.message, '\n', gateErr?.stack || gateErr);
      return res.status(500).json({ error: 'Mention scan temporarily unavailable. Please try again.' });
    }
    if (!gate.allowed) {
      return res.status(402).json({
        error: gate.reason,
        code: 'CREDITS_REQUIRED',
        creditCost: gate.creditCost,
        creditsRemaining: gate.creditsRemaining,
      });
    }

    const cleanBrand = brand.trim().slice(0, 100);
    const cleanDomain = (domain || '').trim().slice(0, 200).replace(/^https?:\/\//, '').replace(/\/+$/, '');

    const result = await trackBrandMentions(cleanBrand, cleanDomain);

    // Persist results (non-fatal - scan data is still returned even if persistence fails)
    let persisted = 0;
    if (result.mentions.length > 0) {
      try {
        await persistMentionScan(userId, cleanBrand, cleanDomain, result.mentions);
        persisted = result.mentions.length;
      } catch (persistErr: any) {
        console.warn('[MentionScan] Persistence failed (non-fatal):', persistErr?.message);
      }
    }

    return res.json({
      success: true,
      brand: result.brand,
      domain: result.domain,
      sources_checked: result.sources_checked,
      mentions: result.mentions,
      scanned_at: result.scanned_at,
      persisted,
    });
  } catch (err: any) {
    console.error('[MentionScan] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'Mention scan failed' });
  }
}

/**
 * GET /api/mentions/history?brand=XYZ&limit=100&offset=0
 * Get stored mention history for the current user.
 */
export async function getMentionHistoryHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ error: 'brand query param is required' });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 500);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

    const [history, breakdown] = await Promise.all([
      getMentionHistory(userId, brand, limit, offset),
      getMentionSourceBreakdown(userId, brand),
    ]);

    return res.json({
      success: true,
      mentions: history.mentions,
      total: history.total,
      source_breakdown: breakdown,
    });
  } catch (err: any) {
    console.error('[MentionHistory] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'Failed to fetch mention history' });
  }
}

/**
 * GET /api/mentions/timeline?brand=XYZ&days=30
 * Get daily mention counts for a brand over the past N days.
 */
export async function getMentionTimelineHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ error: 'brand query param is required' });

    const days = Math.min(Math.max(parseInt(String(req.query.days || '30'), 10) || 30, 1), 365);

    const timeline = await getMentionTimeline(userId, brand, days);

    return res.json({
      success: true,
      brand,
      days,
      timeline,
    });
  } catch (err: any) {
    console.error('[MentionTimeline] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'Failed to fetch mention timeline' });
  }
}

/**
 * GET /api/mentions/kpi?brand=XYZ
 * Compute and return live KPI dashboard metrics for a brand.
 * Also saves a daily snapshot for trend history.
 */
export async function getMentionKPIHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ error: 'brand query param is required' });

    const kpis = await computeMentionKPIs(userId, brand);

    // Save daily snapshot (non-fatal)
    saveMentionKPISnapshot(userId, kpis).catch((err: any) =>
      console.warn('[MentionKPI] Snapshot save failed (non-fatal):', err?.message),
    );

    return res.json({ success: true, kpi: kpis });
  } catch (err: any) {
    console.error('[MentionKPI] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'Failed to compute mention KPIs' });
  }
}

/**
 * GET /api/mentions/kpi/history?brand=XYZ&days=30
 * Return historical KPI snapshots for trend charts.
 */
export async function getMentionKPIHistoryHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ error: 'brand query param is required' });

    const days = Math.min(Math.max(parseInt(String(req.query.days || '30'), 10) || 30, 1), 90);

    const history = await getMentionKPIHistory(userId, brand, days);

    return res.json({ success: true, brand, days, history });
  } catch (err: any) {
    console.error('[MentionKPIHistory] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'Failed to fetch KPI history' });
  }
}
