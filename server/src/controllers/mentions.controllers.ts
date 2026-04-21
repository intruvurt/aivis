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
import { buildEntityInfluenceGraph } from '../services/entityInfluenceGraph.js';
import { ingestRssDocument } from '../node-workers/rssWorker.js';
import { ingestUrlForReplay } from '../node-workers/urlIngestWorker.js';
import { getInfluenceSummary, getEntityInfluenceTopology } from '../services/citationGraphQueryService.js';
import {
  computeMentionJuice,
  saveMentionJuiceSnapshot,
  getLatestMentionJuiceSnapshot,
  getMentionJuiceHistory,
  type MentionRow,
} from '../services/mentionJuiceService.js';
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
    const entityInfluence = await buildEntityInfluenceGraph(
      cleanBrand,
      result.entity_aliases,
      result.mentions,
    );

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
      entity_aliases: result.entity_aliases,
      entity_influence: entityInfluence,
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

// ─────────────────────────────────────────────────────────────────────────────
// MentionJuice endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/mentions/juice
 * Compute the MentionJuice Score for a brand. Runs a live mention scan
 * internally (or accepts pre-fetched mentions) and applies credibility
 * weighting by source authority.
 *
 * Body: { brand: string, domain?: string }
 */
export async function computeMentionJuiceHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { brand, domain } = req.body || {};
    if (!brand || typeof brand !== 'string' || brand.trim().length < 2) {
      return res.status(400).json({ error: 'brand is required (min 2 characters)' });
    }

    const user = (req as any).user;
    let gate: Awaited<ReturnType<typeof gateToolAction>>;
    try {
      gate = await gateToolAction(userId, 'mention_juice', user.tier || 'observer');
    } catch (gateErr: any) {
      console.error('[MentionJuice] gateToolAction failed:', gateErr?.message);
      return res.status(500).json({ error: 'MentionJuice temporarily unavailable. Please try again.' });
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

    // Run live scan
    const scanResult = await trackBrandMentions(cleanBrand, cleanDomain);

    // Map scan rows to MentionRow shape
    const mentionRows: MentionRow[] = scanResult.mentions.map((m: any) => ({
      source: m.source,
      url: m.url,
      title: m.title || '',
      snippet: m.snippet || m.content || '',
      sentiment: m.sentiment as MentionRow['sentiment'],
      published_at: m.published_at || null,
    }));

    const juiceResult = computeMentionJuice(cleanBrand, cleanDomain, mentionRows);

    // Persist (non-fatal)
    saveMentionJuiceSnapshot(userId, juiceResult).catch((err: any) =>
      console.warn('[MentionJuice] Snapshot save failed (non-fatal):', err?.message),
    );

    return res.json({ success: true, ...juiceResult });
  } catch (err: any) {
    console.error('[MentionJuice] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'MentionJuice computation failed' });
  }
}

/**
 * GET /api/mentions/juice/snapshot?brand=XYZ
 * Return the latest persisted MentionJuice snapshot.
 */
export async function getMentionJuiceSnapshotHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ error: 'brand query param is required' });

    const snapshot = await getLatestMentionJuiceSnapshot(userId, brand);
    if (!snapshot) {
      return res.status(404).json({ error: 'No MentionJuice snapshot found for this brand' });
    }

    return res.json({ success: true, ...snapshot });
  } catch (err: any) {
    console.error('[MentionJuiceSnapshot] Error:', err?.message);
    return res.status(500).json({ error: 'Failed to fetch MentionJuice snapshot' });
  }
}

/**
 * GET /api/mentions/juice/history?brand=XYZ&limit=30
 * Return historical MentionJuice score trend.
 */
export async function getMentionJuiceHistoryHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ error: 'brand query param is required' });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 90);

    const history = await getMentionJuiceHistory(userId, brand, limit);

    return res.json({ success: true, brand, history });
  } catch (err: any) {
    console.error('[MentionJuiceHistory] Error:', err?.message);
    return res.status(500).json({ error: 'Failed to fetch MentionJuice history' });
  }
}

/**
 * POST /api/mentions/ingest/rss
 * Push a normalized RSS-style document into the raw-document ingestion queue.
 */
export async function enqueueRssIngestionHandler(req: Request, res: Response) {
  try {
    const { url, text, html, timestamp } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }
    if ((!text || typeof text !== 'string') && (!html || typeof html !== 'string')) {
      return res.status(400).json({ error: 'text or html is required' });
    }

    const jobId = await ingestRssDocument({
      url: url.trim(),
      text: typeof text === 'string' ? text : undefined,
      html: typeof html === 'string' ? html : undefined,
      timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : undefined,
    });

    return res.json({
      success: true,
      queued: true,
      source: 'rss',
      jobId,
    });
  } catch (err: any) {
    console.error('[MentionRSSIngest] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'Failed to enqueue RSS ingestion event' });
  }
}

/**
 * POST /api/mentions/ingest/url
 * Fetch URL content, enqueue raw-document event, and wait for persistence IDs.
 */
export async function ingestUrlReplayHandler(req: Request, res: Response) {
  try {
    const { url, source, timeoutMs } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }

    const result = await ingestUrlForReplay({
      url: url.trim(),
      source: typeof source === 'string' ? source : undefined,
      timeoutMs: Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : undefined,
    });

    return res.json({
      success: true,
      queued: true,
      replay_ready: true,
      docId: result.docId,
      scanId: result.scanId || null,
      persisted_entity_ids: result.persistedEntityIds,
      persisted_claim_ids: result.persistedClaimIds,
      touched_cluster_ids: result.touchedClusterIds,
      conflict_edges_created: result.conflictEdgesCreated,
      edges_created: result.edgesCreated,
      entities_updated: result.entitiesUpdated,
    });
  } catch (err: any) {
    console.error('[MentionURLIngest] Error:', err?.message, '\n', err?.stack || err);
    const message = String(err?.message || 'Failed to ingest URL for replay');
    const isClientError =
      /url is required|not allowed|no extractable content|http \d{3}/i.test(message);
    return res.status(isClientError ? 400 : 500).json({ error: message });
  }
}

/**
 * GET /api/mentions/influence/summary?limit=20
 * Return persisted entity influence rankings from citation graph tables.
 */
export async function getInfluenceSummaryHandler(req: Request, res: Response) {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const rows = await getInfluenceSummary(limit);
    return res.json({ success: true, limit, entities: rows });
  } catch (err: any) {
    console.error('[InfluenceSummary] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'Failed to load influence summary' });
  }
}

/**
 * GET /api/mentions/influence/entity/:entityId?limit=80
 * Return graph topology for one persisted entity node.
 */
export async function getInfluenceEntityHandler(req: Request, res: Response) {
  try {
    const entityId = String(req.params.entityId || '').trim();
    if (!entityId) return res.status(400).json({ error: 'entityId is required' });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '80'), 10) || 80, 1), 250);
    const graph = await getEntityInfluenceTopology(entityId, limit);
    if (!graph) return res.status(404).json({ error: 'Entity not found or no persisted graph data' });

    return res.json({ success: true, graph });
  } catch (err: any) {
    console.error('[InfluenceEntity] Error:', err?.message, '\n', err?.stack || err);
    return res.status(500).json({ error: 'Failed to load entity influence graph' });
  }
}
