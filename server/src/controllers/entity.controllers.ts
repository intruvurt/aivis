// server/src/controllers/entity.controllers.ts
// HTTP handlers for entity fingerprint management, blocklist, collision detection.

import type { Request, Response } from 'express';
import {
  getFingerprint,
  upsertFingerprint,
  getBlocklist,
  addBlocklistEntry,
  removeBlocklistEntry,
  detectCollisions,
  computeAnchorScore,
  getAuditRunHistory,
  addAutoBlocklistEntries,
} from '../services/entityFingerprint.js';
import { sanitizeHtmlServer } from '../middleware/securityMiddleware.js';
import type { BlocklistEntryType } from '../../../shared/types.js';

// ─── Fingerprint ─────────────────────────────────────────────────────────────

// GET /api/entity/fingerprint
export async function getFingerprintHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fp = await getFingerprint(userId);
    if (!fp) {
      return res.json({ success: true, fingerprint: null, anchor_score: 0 });
    }

    return res.json({
      success: true,
      fingerprint: fp,
      anchor_score: computeAnchorScore(fp),
    });
  } catch (err: any) {
    console.error('[Entity] Get fingerprint error:', err);
    return res.status(500).json({ error: 'Failed to get entity fingerprint' });
  }
}

// PUT /api/entity/fingerprint
export async function upsertFingerprintHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      brand_name, canonical_domain, founder_name, social_handles,
      wikidata_id, google_kg_id, schema_org_id, product_category,
      description_keywords,
    } = req.body || {};

    if (!brand_name || typeof brand_name !== 'string' || brand_name.trim().length < 1) {
      return res.status(400).json({ error: 'brand_name is required' });
    }
    if (!canonical_domain || typeof canonical_domain !== 'string' || canonical_domain.trim().length < 3) {
      return res.status(400).json({ error: 'canonical_domain is required (e.g. yourdomain.com)' });
    }

    // Sanitize all string inputs
    const sanitized = {
      brand_name: sanitizeHtmlServer(brand_name.trim()).slice(0, 200),
      canonical_domain: canonical_domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').slice(0, 255),
      founder_name: sanitizeHtmlServer(String(founder_name || '').trim()).slice(0, 200),
      social_handles: sanitizeSocialHandles(social_handles),
      wikidata_id: sanitizeHtmlServer(String(wikidata_id || '').trim()).slice(0, 40),
      google_kg_id: sanitizeHtmlServer(String(google_kg_id || '').trim()).slice(0, 60),
      schema_org_id: sanitizeHtmlServer(String(schema_org_id || '').trim()).slice(0, 500),
      product_category: sanitizeHtmlServer(String(product_category || '').trim()).slice(0, 120),
      description_keywords: sanitizeKeywords(description_keywords),
    };

    const fp = await upsertFingerprint(userId, sanitized);

    return res.json({
      success: true,
      fingerprint: fp,
      anchor_score: computeAnchorScore(fp),
    });
  } catch (err: any) {
    console.error('[Entity] Upsert fingerprint error:', err);
    return res.status(500).json({ error: 'Failed to save entity fingerprint' });
  }
}

function sanitizeSocialHandles(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const result: Record<string, string> = {};
  const allowed = ['linkedin', 'twitter', 'github', 'youtube', 'facebook', 'bluesky', 'devto', 'producthunt', 'crunchbase'];
  for (const key of allowed) {
    const val = (input as any)[key];
    if (val && typeof val === 'string') {
      result[key] = sanitizeHtmlServer(val.trim()).slice(0, 255);
    }
  }
  return result;
}

function sanitizeKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === 'string')
    .map((kw) => sanitizeHtmlServer(kw.trim()).slice(0, 80))
    .filter((kw) => kw.length >= 2)
    .slice(0, 20);
}

// ─── Blocklist ───────────────────────────────────────────────────────────────

// GET /api/entity/blocklist
export async function getBlocklistHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const entries = await getBlocklist(userId);
    return res.json({ success: true, blocklist: entries });
  } catch (err: any) {
    console.error('[Entity] Get blocklist error:', err);
    return res.status(500).json({ error: 'Failed to get blocklist' });
  }
}

// POST /api/entity/blocklist
export async function addBlocklistEntryHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { pattern, type, reason } = req.body || {};

    if (!pattern || typeof pattern !== 'string' || pattern.trim().length < 1) {
      return res.status(400).json({ error: 'pattern is required' });
    }

    const validTypes: BlocklistEntryType[] = ['name', 'domain', 'keyword', 'entity_type'];
    const entryType = validTypes.includes(type) ? type : 'keyword';

    const entry = await addBlocklistEntry(
      userId,
      sanitizeHtmlServer(pattern.trim()).slice(0, 200),
      entryType,
      sanitizeHtmlServer(String(reason || '').trim()).slice(0, 500),
      false,
    );

    return res.status(201).json({ success: true, entry });
  } catch (err: any) {
    console.error('[Entity] Add blocklist entry error:', err);
    return res.status(500).json({ error: 'Failed to add blocklist entry' });
  }
}

// DELETE /api/entity/blocklist/:id
export async function removeBlocklistEntryHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const entryId = String(req.params.id);
    const removed = await removeBlocklistEntry(userId, entryId);
    if (!removed) {
      return res.status(404).json({ error: 'Blocklist entry not found' });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Entity] Remove blocklist entry error:', err);
    return res.status(500).json({ error: 'Failed to remove blocklist entry' });
  }
}

// ─── Collision Detection ─────────────────────────────────────────────────────

// POST /api/entity/detect-collisions
export async function detectCollisionsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { brand_name, canonical_domain } = req.body || {};

    if (!brand_name || !canonical_domain) {
      return res.status(400).json({ error: 'brand_name and canonical_domain are required' });
    }

    const fingerprint = await getFingerprint(userId);
    const result = await detectCollisions(
      String(brand_name).trim(),
      String(canonical_domain).trim().toLowerCase(),
      fingerprint || undefined,
    );

    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Entity] Collision detection error:', err);
    return res.status(500).json({ error: 'Failed to detect collisions' });
  }
}

// POST /api/entity/accept-blocklist
export async function acceptBlocklistSuggestionsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { suggestions } = req.body || {};
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(400).json({ error: 'suggestions array is required' });
    }

    const sanitized = suggestions
      .filter((s: any) => s?.pattern && typeof s.pattern === 'string')
      .map((s: any) => ({
        pattern: sanitizeHtmlServer(String(s.pattern).trim()).slice(0, 200),
        type: (['name', 'domain', 'keyword', 'entity_type'].includes(s.type) ? s.type : 'keyword') as BlocklistEntryType,
        reason: sanitizeHtmlServer(String(s.reason || '').trim()).slice(0, 500),
      }))
      .slice(0, 50);

    const added = await addAutoBlocklistEntries(userId, sanitized);

    return res.json({ success: true, added });
  } catch (err: any) {
    console.error('[Entity] Accept blocklist error:', err);
    return res.status(500).json({ error: 'Failed to accept blocklist suggestions' });
  }
}

// ─── Anchor Score & Audit Runs ───────────────────────────────────────────────

// GET /api/entity/anchor-score
export async function getAnchorScoreHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fp = await getFingerprint(userId);
    const score = computeAnchorScore(fp);

    // Break down the score components
    const breakdown: Record<string, { present: boolean; points: number }> = {
      canonical_domain: { present: Boolean(fp?.canonical_domain), points: fp?.canonical_domain ? 15 : 0 },
      founder_name: { present: Boolean(fp?.founder_name), points: fp?.founder_name ? 10 : 0 },
      social_handles: { present: Object.values(fp?.social_handles || {}).filter(Boolean).length >= 1, points: Math.min(Object.values(fp?.social_handles || {}).filter(Boolean).length * 5, 15) },
      wikidata_id: { present: Boolean(fp?.wikidata_id), points: fp?.wikidata_id ? 20 : 0 },
      google_kg_id: { present: Boolean(fp?.google_kg_id), points: fp?.google_kg_id ? 15 : 0 },
      schema_org_id: { present: Boolean(fp?.schema_org_id), points: fp?.schema_org_id ? 10 : 0 },
      product_category: { present: Boolean(fp?.product_category), points: fp?.product_category ? 5 : 0 },
      description_keywords: { present: (fp?.description_keywords || []).filter(Boolean).length >= 1, points: Math.min((fp?.description_keywords || []).filter(Boolean).length * 3, 10) },
    };

    return res.json({ success: true, anchor_score: score, breakdown });
  } catch (err: any) {
    console.error('[Entity] Anchor score error:', err);
    return res.status(500).json({ error: 'Failed to compute anchor score' });
  }
}

// GET /api/entity/audit-runs
export async function getAuditRunsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10), 1), 100);
    const runs = await getAuditRunHistory(userId, limit);

    return res.json({ success: true, runs });
  } catch (err: any) {
    console.error('[Entity] Audit runs error:', err);
    return res.status(500).json({ error: 'Failed to get audit runs' });
  }
}
