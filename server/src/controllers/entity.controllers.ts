// server/src/controllers/entity.controllers.ts
// HTTP handlers for entity fingerprint management, blocklist, collision detection.

import { createHash } from 'crypto';
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
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import { scrapeWebsite } from '../services/scraper.js';
import { runAnalysisEngines } from '../services/engines/engineComposer.js';
import { persistAuditRecord } from '../services/auditPersistenceService.js';
import { lookupDomainAgeYears } from '../lib/utils/domainAge.js';
import { getPool } from '../services/postgresql.js';
import {
  getEntity,
  getEntityCollisions,
  getEntityEvidence,
  getEntityVariants,
  getLatestDriftScore,
  getLatestEntityAudit,
  linkAuditToEntity,
  listEntityAudits,
  recordDriftScore,
  resolveEntity,
  searchPotentialEntityConflicts,
  setEntityEmbedding,
  setEntityVariantEmbedding,
  updateEntityMeta,
  updateEntityScores,
  upsertEntityCollision,
  upsertEntityEvidence,
  upsertEntityVariant,
} from '../services/entityService.js';
import { embedText } from '../services/embeddingService.js';
import { runSemanticCollisionAnalysis } from '../services/entityCollisionEngine.js';
import { createOrRefreshPublicReportLink } from '../services/publicReportLinks.js';
import { buildPublicEntitySlug, getPublicEntityNode } from '../services/publicEntityNodes.js';
import { submitToIndexNow } from '../services/indexNowService.js';
import { getTierLimits, uiTierFromCanonical } from '../../../shared/types.js';
import type { BlocklistEntryType, CanonicalTier } from '../../../shared/types.js';

const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');

// ─── Fingerprint ─────────────────────────────────────────────────────────────

function getUserId(req: Request): string | null {
  return String((req as any).user?.id || '').trim() || null;
}

function getUserTier(req: Request): CanonicalTier {
  return uiTierFromCanonical(((req as any).user?.tier || 'observer') as CanonicalTier) as CanonicalTier;
}

function normalizeDomainInput(input: unknown): string {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';
  const withoutProtocol = raw.replace(/^https?:\/\//, '');
  const withoutPath = withoutProtocol.split('/')[0] || '';
  return withoutPath.replace(/^www\./, '').replace(/\.+$/, '').slice(0, 255);
}

function sanitizeOptionalString(input: unknown, maxLength: number): string | null {
  const value = sanitizeHtmlServer(String(input || '').trim()).slice(0, maxLength);
  return value || null;
}

function clampPercent(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getOwnedEntityIdFromDomain(domain: string): string {
  return `ent-${domain.toLowerCase().replace(/^www\./, '')}`;
}

async function loadOwnedEntity(req: Request, entityId: string) {
  const userId = getUserId(req);
  if (!userId) return { userId: null, entity: null };

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, name, canonical_name, normalized_name, domain, description,
            entity_type, collision_score, clarity_score, authority_score,
            status, user_id, created_at, updated_at
     FROM entities
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [entityId, userId],
  );

  return { userId, entity: rows[0] || null };
}

function getAnalysisNumber(result: Record<string, unknown> | null | undefined, key: string): number {
  const value = result?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getAnalysisString(result: Record<string, unknown> | null | undefined, key: string): string {
  const value = result?.[key];
  return typeof value === 'string' ? value : '';
}

function getAnalysisStringArray(result: Record<string, unknown> | null | undefined, key: string): string[] {
  const value = result?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getRecommendations(result: Record<string, unknown> | null | undefined): Array<Record<string, unknown>> {
  const value = result?.recommendations;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
}

function inferEntityType(input: { entityType?: unknown; domain?: string; name?: string }): string {
  const explicit = String(input.entityType || '').trim().toLowerCase();
  if (explicit) return explicit;

  const name = String(input.name || '').toLowerCase();
  if (name.includes('protocol')) return 'protocol';
  if (name.includes('tool') || name.includes('app') || name.includes('software')) return 'tool';
  if (input.domain) return 'organization';
  return 'brand';
}

function buildEntitySeedText(entity: {
  canonical_name?: unknown;
  name?: unknown;
  domain?: unknown;
  entity_type?: unknown;
  description?: unknown;
}, variants: string[]): string {
  return [
    String(entity.canonical_name || entity.name || ''),
    String(entity.domain || ''),
    String(entity.entity_type || ''),
    String(entity.description || ''),
    ...variants,
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' | ')
    .slice(0, 1500);
}

function extractLatestResult(latestAudit: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!latestAudit) return null;
  const result = latestAudit.result;
  return result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
}

function buildBoundaryStatement(entity: Record<string, unknown>, conflicts: Array<Record<string, unknown>>): string {
  const domain = String(entity.domain || '').trim();
  const conflictNames = conflicts
    .map((conflict) => String(conflict.name || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const exclusions = conflictNames.length > 0
    ? ` It should not be conflated with ${conflictNames.join(', ')}.`
    : '';

  return `${String(entity.canonical_name || entity.name || 'This entity')} refers to the canonical web entity anchored to ${domain || 'its declared primary domain'}.${exclusions}`;
}

function buildSchemaOrgJsonLd(entity: Record<string, unknown>): Record<string, unknown> {
  const entityType = String(entity.entity_type || 'organization').toLowerCase();
  const schemaType = entityType === 'person'
    ? 'Person'
    : entityType === 'tool' || entityType === 'saas'
      ? 'SoftwareApplication'
      : entityType === 'concept'
        ? 'DefinedTerm'
        : 'Organization';

  const domain = String(entity.domain || '').trim();
  const url = domain ? `https://${domain}` : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: String(entity.canonical_name || entity.name || ''),
    description: String(entity.description || ''),
    ...(url ? { url } : {}),
    ...(schemaType === 'DefinedTerm'
      ? { inDefinedTermSet: 'https://aivis.biz/entity' }
      : {}),
  };
}

function buildSuggestedExternalPosts(entity: Record<string, unknown>, queries: string[]): Array<Record<string, string>> {
  const canonicalName = String(entity.canonical_name || entity.name || '').trim();
  const defaultQueries = queries.length > 0 ? queries : [
    `${canonicalName} ai visibility`,
    `${canonicalName} citation readiness`,
    `${canonicalName} what is`,
  ];

  return defaultQueries.slice(0, 4).map((query, index) => ({
    title: `${canonicalName}: ${index === 0 ? 'definition' : index === 1 ? 'proof' : index === 2 ? 'comparison' : 'citability'} post`,
    target_query: query,
    angle: index === 0
      ? `Explain what ${canonicalName} is in one canonical, easily-quoted paragraph.`
      : index === 1
        ? `Publish evidence and examples that make ${canonicalName} more citable for answer engines.`
        : index === 2
          ? `Differentiate ${canonicalName} from similarly named entities.`
          : `Turn ${canonicalName} into a concise external reference page with structured facts.`,
  }));
}

function tokenize(input: string): string[] {
  return String(input || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

function extractSchemaTypesFromLatestResult(latestResult: Record<string, unknown> | null): string[] {
  if (!latestResult || typeof latestResult !== 'object') return [];
  const schemaMarkup = latestResult.schema_markup;
  if (!schemaMarkup || typeof schemaMarkup !== 'object') return [];
  const schemaTypes = (schemaMarkup as Record<string, unknown>).schema_types;
  if (!Array.isArray(schemaTypes)) return [];
  return schemaTypes
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 12);
}

function buildReinforcementPlan(entity: Record<string, unknown>, competitors: Array<Record<string, unknown>>) {
  const canonicalName = String(entity.canonical_name || entity.name || '').trim();
  const domain = String(entity.domain || '').trim();
  const topCompetitors = competitors.slice(0, 3).map((competitor) => String(competitor.name || '').trim()).filter(Boolean);

  const redditTemplates = [
    {
      subreddit_hint: 'r/SEO',
      title: `How ${canonicalName} is measured for AI citation readiness`,
      body_template: `We are documenting how ${canonicalName} is represented in answer engines. This post focuses on transparent evidence, schema coverage, and disambiguation with similarly named tools.`,
    },
    {
      subreddit_hint: 'r/marketing',
      title: `Case notes: reducing brand ambiguity for ${canonicalName}`,
      body_template: `If multiple entities share adjacent names, retrieval quality drops. We are publishing canonical definitions, machine-readable schema, and supporting references for ${canonicalName}.`,
    },
  ];

  const directorySubmissions = [
    {
      target: 'G2 profile refresh',
      payload_hint: `Ensure ${canonicalName} description matches canonical definition and links to https://${domain}`,
    },
    {
      target: 'Product Hunt maker profile',
      payload_hint: `Use the same category and one-line differentiation for ${canonicalName}`,
    },
  ];

  const vsPages = topCompetitors.length > 0
    ? topCompetitors.map((name) => ({
      title: `${canonicalName} vs ${name}`,
      target_slug: `${slugify(canonicalName)}-vs-${slugify(name)}`,
      positioning_angle: `Clarify the category boundary between ${canonicalName} and ${name} with verifiable features and citations.`,
    }))
    : [
      {
        title: `${canonicalName} vs alternatives`,
        target_slug: `${slugify(canonicalName)}-vs-alternatives`,
        positioning_angle: `Differentiate ${canonicalName} against adjacent tools in the same discovery intents.`,
      },
    ];

  const faqExpansions = [
    {
      question: `What is ${canonicalName}?`,
      answer_seed: `${canonicalName} is a machine-readable entity anchored to ${domain || 'its canonical domain'} and validated by repeatable audit evidence.`,
    },
    {
      question: `How is ${canonicalName} different from similar tools?`,
      answer_seed: `${canonicalName} should be distinguished by category scope, evidence model, and canonical schema references.`,
    },
  ];

  return {
    reddit_templates: redditTemplates,
    directory_submissions: directorySubmissions,
    vs_competitor_pages: vsPages,
    faq_expansions: faqExpansions,
  };
}

function computeQueryOverlapScore(query: string, entity: Record<string, unknown>): number {
  const queryTokens = new Set(tokenize(query));
  const entityTokens = new Set(tokenize(`${entity.canonical_name || entity.name || ''} ${entity.domain || ''} ${entity.description || ''}`));

  if (queryTokens.size === 0 || entityTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of queryTokens) {
    if (entityTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(1, queryTokens.size);
}

async function checkQuotaAndIncrement(userId: string, tier: CanonicalTier): Promise<{ ok: boolean; status?: number; payload?: Record<string, unknown> }> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const usageResult = await getPool().query(
    `SELECT COALESCE(SUM(requests), 0) AS total_requests
     FROM usage_daily
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, monthStart, monthEnd],
  );

  const used = Number(usageResult.rows?.[0]?.total_requests || 0);
  const limits = getTierLimits(tier);
  if (used >= limits.scansPerMonth) {
    return {
      ok: false,
      status: 429,
      payload: {
        error: 'Monthly audit limit reached',
        tier,
        limit: limits.scansPerMonth,
        used,
        next_reset: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      },
    };
  }

  await getPool().query(
    `INSERT INTO usage_daily (user_id, date, requests)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, date)
     DO UPDATE SET requests = usage_daily.requests + 1`,
    [userId],
  );

  return { ok: true };
}

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

// ─── Entity OS Surface ───────────────────────────────────────────────────────

// POST /api/entity/ingest
export async function ingestEntityHandler(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name,
      domain,
      homepage_url,
      type,
      description,
      variants,
    } = req.body || {};

    const sanitizedName = sanitizeOptionalString(name, 200);
    if (!sanitizedName) {
      return res.status(400).json({ error: 'name is required' });
    }

    const normalizedDomain = normalizeDomainInput(domain || homepage_url);
    if (!normalizedDomain) {
      return res.status(400).json({ error: 'domain or homepage_url is required' });
    }

    const entityId = await resolveEntity(userId, normalizedDomain, sanitizedName);
    const entityType = inferEntityType({ entityType: type, domain: normalizedDomain, name: sanitizedName });
    const sanitizedDescription = sanitizeOptionalString(description, 2000);

    await updateEntityMeta(entityId, {
      entity_type: entityType as any,
      description: sanitizedDescription || undefined,
    });

    const sanitizedVariants = Array.isArray(variants)
      ? variants
        .filter((item): item is string => typeof item === 'string')
        .map((item) => sanitizeHtmlServer(item.trim()).slice(0, 200))
        .filter((item) => item.length >= 2)
        .slice(0, 20)
      : [];

    const primaryVariantId = await upsertEntityVariant(entityId, {
      surface_name: sanitizedName,
      source_url: normalizedDomain ? `https://${normalizedDomain}` : undefined,
      confidence: 1,
      is_conflict: false,
    });

    const variantIds: string[] = [];
    if (primaryVariantId) variantIds.push(primaryVariantId);

    for (const variant of sanitizedVariants) {
      const variantId = await upsertEntityVariant(entityId, {
        surface_name: variant,
        source_url: normalizedDomain ? `https://${normalizedDomain}` : undefined,
        confidence: 0.7,
        is_conflict: false,
      });
      if (variantId) variantIds.push(variantId);
    }

    const entity = await getEntity(entityId);
    const seedSource: {
      canonical_name?: unknown;
      name?: unknown;
      domain?: unknown;
      entity_type?: unknown;
      description?: unknown;
    } = entity ?? {
      canonical_name: sanitizedName,
      name: sanitizedName,
      domain: normalizedDomain,
      description: sanitizedDescription,
      entity_type: entityType,
    };
    const seedText = buildEntitySeedText(seedSource, sanitizedVariants);

    const seedEmbedding = await embedText(seedText);
    await setEntityEmbedding(entityId, seedEmbedding.embedding);

    if (variantIds.length > 0) {
      const variantTexts = [sanitizedName, ...sanitizedVariants];
      const boundedCount = Math.min(variantIds.length, variantTexts.length);
      for (let i = 0; i < boundedCount; i += 1) {
        const variantEmbedding = await embedText(variantTexts[i]);
        await setEntityVariantEmbedding(variantIds[i], variantEmbedding.embedding);
      }
    }

    const potentialConflicts = await searchPotentialEntityConflicts({
      name: sanitizedName,
      domain: normalizedDomain,
      excludeEntityId: entityId,
      limit: 5,
    });

    for (const conflict of potentialConflicts.filter((item) => Number(item.severity || 0) >= 0.6)) {
      await upsertEntityCollision(entityId, String(conflict.id), {
        collision_type: conflict.collision_type,
        severity: Number(conflict.severity || 0),
        shared_signals: {
          name: sanitizedName,
          domain: normalizedDomain,
          conflicting_name: conflict.name,
          conflicting_domain: conflict.domain,
        },
      });
    }

    const semanticCollision = await runSemanticCollisionAnalysis({
      entityId,
      embedding: seedEmbedding.embedding,
      radius: 0.22,
      minClusterSize: 3,
    });

    const baselineClarity = clampPercent(35 + (sanitizedDescription ? 20 : 0) + 15 + Math.min(sanitizedVariants.length * 4, 20));
    const baselineAuthority = clampPercent(20 + (normalizedDomain ? 25 : 0) + (sanitizedDescription ? 10 : 0));
    const lexicalCollisionScore = clampPercent((Number(potentialConflicts[0]?.severity || 0) || 0) * 100);
    const semanticCollisionScore = clampPercent(Math.round((semanticCollision.collision_score || 0) * 100));
    const collisionScore = Math.max(lexicalCollisionScore, semanticCollisionScore);

    await updateEntityScores(entityId, {
      clarity_score: baselineClarity,
      authority_score: baselineAuthority,
      collision_score: collisionScore,
    });

    const hydratedEntity = await getEntity(entityId);

    return res.status(201).json({
      success: true,
      entity: hydratedEntity,
      potential_conflicts: potentialConflicts,
      collision_map: {
        primary_cluster: semanticCollision.primary_cluster,
        conflicting_entities: semanticCollision.conflicting_entities,
        fragmentation: semanticCollision.fragmentation,
      },
      initial_embedding: {
        status: seedEmbedding.fromFallback ? 'fallback' : 'ready',
        dimensions: seedEmbedding.dimensions,
        provider: seedEmbedding.provider,
        model: seedEmbedding.model,
        source_text: seedText,
        seed_hash: createHash('sha256').update(seedText).digest('hex'),
      },
    });
  } catch (err: any) {
    console.error('[Entity] Ingest error:', err);
    return res.status(500).json({ error: 'Failed to ingest entity' });
  }
}

// GET /api/entity/:id/health
export async function getEntityHealthHandler(req: Request, res: Response) {
  try {
    const { entity, userId } = await loadOwnedEntity(req, String(req.params.id || ''));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!entity) return res.status(404).json({ error: 'Entity not found' });

    const [latestAudit, latestDrift, evidence, collisions, audits] = await Promise.all([
      getLatestEntityAudit(String(entity.id)),
      getLatestDriftScore(String(entity.id)),
      getEntityEvidence(String(entity.id), 25),
      getEntityCollisions(String(entity.id)),
      listEntityAudits(String(entity.id), 5),
    ]);

    const result = extractLatestResult(latestAudit);
    const citationReadiness = clampPercent(getAnalysisNumber(result, 'citation_readiness_score'));
    const entityClarity = clampPercent(getAnalysisNumber(result, 'entity_clarity_score') || Number(entity.clarity_score || 0));
    const authorityScore = clampPercent(Number(entity.authority_score || 0));

    return res.json({
      success: true,
      health: {
        entity_id: entity.id,
        entity_clarity_score: entityClarity,
        authority_score: authorityScore,
        drift_score: clampPercent(Number(latestDrift?.score || 0)),
        citation_readiness_score: citationReadiness,
        last_audited_at: latestAudit?.created_at || null,
        evidence_count: evidence.length,
        collisions: collisions.map((collision: any) => ({
          id: collision.id,
          collision_type: collision.collision_type,
          severity: Number(collision.severity || 0),
          shared_signals: collision.shared_signals || {},
        })),
        linked_audits: audits.map((audit) => ({
          id: audit.id,
          url: audit.url,
          visibility_score: audit.visibility_score,
          created_at: audit.created_at,
          tier_at_analysis: audit.tier_at_analysis,
        })),
      },
    });
  } catch (err: any) {
    console.error('[Entity] Health error:', err);
    return res.status(500).json({ error: 'Failed to get entity health' });
  }
}

// POST /api/entity/:id/audit
export async function runEntityAuditHandler(req: Request, res: Response) {
  try {
    const { entity, userId } = await loadOwnedEntity(req, String(req.params.id || ''));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!entity) return res.status(404).json({ error: 'Entity not found' });

    const tier = getUserTier(req);
    const quota = await checkQuotaAndIncrement(userId, tier);
    if (!quota.ok) {
      return res.status(Number(quota.status || 429)).json(quota.payload);
    }

    const fallbackUrl = entity.domain ? `https://${entity.domain}` : '';
    const requestedUrl = sanitizeOptionalString(req.body?.url, 2000) || fallbackUrl;
    const normalized = normalizePublicHttpUrl(requestedUrl, {
      allowPrivate: process.env.NODE_ENV !== 'production',
    });
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error, code: 'URL_VALIDATION_FAILED' });
    }

    const targetUrl = normalized.url;
    const scraped = await scrapeWebsite(targetUrl);
    const html = scraped?.data?.html;
    if (!html) {
      return res.status(400).json({ error: 'Failed to scrape website', code: 'SCRAPE_FAILED' });
    }

    const parsedUrl = new URL(targetUrl);
    const domainAgeYears = await lookupDomainAgeYears(parsedUrl.hostname);
    const analysis = await runAnalysisEngines({
      html,
      url: targetUrl,
      domain: parsedUrl.hostname,
      tier,
      https_enabled: parsedUrl.protocol === 'https:',
      domain_age_years: domainAgeYears,
    });

    const visibilityScore = clampPercent(Number(analysis.overall_ai_visibility_score || 0));
    const auditId = await persistAuditRecord({
      userId,
      workspaceId: (req as any).workspace?.id ?? null,
      url: targetUrl,
      visibilityScore,
      result: analysis as unknown as Record<string, unknown>,
      tierAtAnalysis: tier,
    });

    await linkAuditToEntity(auditId, String(entity.id));

    const entityClarity = clampPercent(Number(analysis.entity_clarity_score || 0), Number(entity.clarity_score || 0));
    const citationReadiness = clampPercent(Number(analysis.citation_readiness_score || 0));
    const authorityScore = clampPercent(
      Math.round((Number(entity.authority_score || 0) * 0.5) + (visibilityScore * 0.3) + (citationReadiness * 0.2)),
      Number(entity.authority_score || 0),
    );

    await updateEntityScores(String(entity.id), {
      clarity_score: entityClarity,
      authority_score: authorityScore,
    });

    const summary = getAnalysisString(analysis as unknown as Record<string, unknown>, 'summary');
    const keyTakeaways = getAnalysisStringArray(analysis as unknown as Record<string, unknown>, 'key_takeaways');
    const recommendations = getRecommendations(analysis as unknown as Record<string, unknown>);

    const evidencePayloads: Array<{
      evidence_type: 'html' | 'llm';
      source: string;
      snippet: string;
      hash: string;
      weight: number;
    }> = [
      {
        evidence_type: 'html' as const,
        source: targetUrl,
        snippet: summary,
        hash: createHash('sha256').update(`${auditId}:summary:${summary}`).digest('hex'),
        weight: 1,
      },
      ...keyTakeaways.slice(0, 3).map((takeaway, index) => ({
        evidence_type: 'llm' as const,
        source: targetUrl,
        snippet: takeaway,
        hash: createHash('sha256').update(`${auditId}:takeaway:${index}:${takeaway}`).digest('hex'),
        weight: 0.7,
      })),
    ].filter((item) => item.snippet && item.snippet.trim().length > 0);

    for (const evidence of evidencePayloads) {
      await upsertEntityEvidence(String(entity.id), evidence);
    }

    await recordDriftScore(String(entity.id), visibilityScore, evidencePayloads.length, 'entity_audit');

    const extractedClaims = keyTakeaways.slice(0, 5);
    const recommendedNextAction = String(
      recommendations[0]?.title || recommendations[0]?.description || recommendations[0]?.action || summary || 'Publish a clearer canonical entity page.',
    ).trim();

    return res.json({
      success: true,
      entity_id: entity.id,
      audit_id: auditId,
      scores: {
        overall_ai_visibility_score: visibilityScore,
        citation_readiness_score: citationReadiness,
        entity_clarity_score: entityClarity,
        authority_score: authorityScore,
      },
      extracted_claims: extractedClaims,
      recommended_next_action: recommendedNextAction,
      raw_analysis: analysis,
    });
  } catch (err: any) {
    console.error('[Entity] Audit error:', err);
    return res.status(500).json({ error: 'Failed to run entity audit' });
  }
}

// POST /api/entity/:id/clarify
export async function clarifyEntityHandler(req: Request, res: Response) {
  try {
    const { entity, userId } = await loadOwnedEntity(req, String(req.params.id || ''));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!entity) return res.status(404).json({ error: 'Entity not found' });

    const latestAudit = await getLatestEntityAudit(String(entity.id));
    const latestResult = extractLatestResult(latestAudit);
    const conflicts = (await searchPotentialEntityConflicts({
      name: String(entity.canonical_name || entity.name || ''),
      domain: String(entity.domain || ''),
      excludeEntityId: String(entity.id),
      limit: 5,
    })) as Array<Record<string, unknown>>;
    const evidence = await getEntityEvidence(String(entity.id), 8);
    const requestedQueries = Array.isArray(req.body?.queries)
      ? req.body.queries.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    const canonicalDefinition = sanitizeHtmlServer(
      String(entity.description || getAnalysisString(latestResult, 'summary') || `${entity.canonical_name || entity.name} is the canonical entity behind ${entity.domain || 'this web presence'}.`),
    ).slice(0, 1200);

    return res.json({
      success: true,
      clarification: {
        entity_id: entity.id,
        canonical_definition: canonicalDefinition,
        boundary_statement: buildBoundaryStatement(entity, conflicts),
        schema_org_json_ld: buildSchemaOrgJsonLd(entity),
        suggested_external_posts: buildSuggestedExternalPosts(entity, requestedQueries),
        evidence_summary: evidence.map((item: any) => ({
          source: item.source,
          evidence_type: item.evidence_type,
          snippet: item.snippet,
          weight: item.weight,
        })),
      },
    });
  } catch (err: any) {
    console.error('[Entity] Clarify error:', err);
    return res.status(500).json({ error: 'Failed to clarify entity' });
  }
}

// POST /api/entity/:id/simulate
export async function simulateEntityHandler(req: Request, res: Response) {
  try {
    const { entity, userId } = await loadOwnedEntity(req, String(req.params.id || ''));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!entity) return res.status(404).json({ error: 'Entity not found' });

    const queries = Array.isArray(req.body?.queries)
      ? req.body.queries.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 10)
      : [];
    if (queries.length === 0) {
      return res.status(400).json({ error: 'queries array is required' });
    }

    const latestAudit = await getLatestEntityAudit(String(entity.id));
    const latestResult = extractLatestResult(latestAudit);
    const competitors = await searchPotentialEntityConflicts({
      name: String(entity.canonical_name || entity.name || ''),
      domain: String(entity.domain || ''),
      excludeEntityId: String(entity.id),
      limit: 5,
    });

    const citationReadiness = clampPercent(getAnalysisNumber(latestResult, 'citation_readiness_score'));
    const clarityScore = clampPercent(getAnalysisNumber(latestResult, 'entity_clarity_score') || Number(entity.clarity_score || 0));
    const authorityScore = clampPercent(Number(entity.authority_score || 0));
    const baseLikelihood = clampPercent(Math.round((citationReadiness * 0.45) + (clarityScore * 0.35) + (authorityScore * 0.2)));
    const topCollisionSeverity = Number(competitors[0]?.severity || 0);

    const results = queries.map((query) => {
      const overlapScore = computeQueryOverlapScore(query, entity);
      const citedLikelihood = clampPercent(baseLikelihood + Math.round((overlapScore - 0.5) * 20));
      const confusionPenalty = Math.round(topCollisionSeverity * 35);
      const misclassificationRisk = clampPercent((100 - clarityScore) * 0.45 + confusionPenalty + (overlapScore < 0.25 ? 10 : 0));

      return {
        query,
        cited_likelihood: citedLikelihood,
        misclassification_risk: misclassificationRisk,
        explanation: overlapScore >= 0.5
          ? 'The query strongly overlaps with the entity name, domain, and current evidence footprint.'
          : 'The query is weakly anchored to the entity, so collisions or generic competitors are more likely.',
        top_competing_entities: competitors.slice(0, 3).map((competitor) => ({
          id: competitor.id,
          name: competitor.name,
          domain: competitor.domain,
          severity: Number(competitor.severity || 0),
        })),
      };
    });

    return res.json({
      success: true,
      simulation: {
        entity_id: entity.id,
        aggregate: {
          average_cited_likelihood: clampPercent(results.reduce((sum, item) => sum + item.cited_likelihood, 0) / results.length),
          average_misclassification_risk: clampPercent(results.reduce((sum, item) => sum + item.misclassification_risk, 0) / results.length),
        },
        results,
      },
    });
  } catch (err: any) {
    console.error('[Entity] Simulate error:', err);
    return res.status(500).json({ error: 'Failed to simulate entity retrieval' });
  }
}

// POST /api/entity/:id/publish
export async function publishEntityHandler(req: Request, res: Response) {
  try {
    const { entity, userId } = await loadOwnedEntity(req, String(req.params.id || ''));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!entity) return res.status(404).json({ error: 'Entity not found' });

    const latestAudit = await getLatestEntityAudit(String(entity.id));
    if (!latestAudit?.id || !latestAudit?.url) {
      return res.status(400).json({ error: 'Run an entity audit before publishing' });
    }

    const shareLink = await createOrRefreshPublicReportLink({
      auditId: String(latestAudit.id),
      userId,
      workspaceId: (req as any).workspace?.id ?? null,
      targetUrl: String(latestAudit.url),
    });

    const entitySlug = buildPublicEntitySlug(String(latestAudit.url));
    const publicNode = await getPublicEntityNode(entitySlug);
    const entityUrl = `${FRONTEND_URL}/entity/${entitySlug}`;
    const entityAuditUrl = publicNode?.latest_snapshot?.share_slug
      ? `${FRONTEND_URL}/entity/${entitySlug}/audit/${publicNode.latest_snapshot.share_slug}`
      : `${FRONTEND_URL}/entity/${entitySlug}`;
    const sitemapSubmission = await submitToIndexNow([
      shareLink.publicUrl,
      entityUrl,
      entityAuditUrl,
    ]);

    const clarifyQueries = Array.isArray(req.body?.queries)
      ? req.body.queries.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const externalSnippets = buildSuggestedExternalPosts(entity, clarifyQueries);
    const jsonLd = buildSchemaOrgJsonLd(entity);

    return res.json({
      success: true,
      publish: {
        entity_id: entity.id,
        public_report_url: shareLink.publicUrl,
        entity_page_url: entityUrl,
        entity_audit_url: entityAuditUrl,
        seo_page: {
          title: `${entity.canonical_name || entity.name} | AI Visibility Entity Node`,
          description: String(entity.description || publicNode?.definition || '').slice(0, 160),
          canonical_url: entityUrl,
        },
        json_ld: jsonLd,
        sitemap_ping: {
          submitted: sitemapSubmission.submitted,
          batches: sitemapSubmission.batches,
          sitemap_pinged: sitemapSubmission.sitemapPinged,
          errors: sitemapSubmission.errors,
        },
        external_snippets: externalSnippets,
      },
    });
  } catch (err: any) {
    console.error('[Entity] Publish error:', err);
    return res.status(500).json({ error: 'Failed to publish entity node' });
  }
}

// POST /api/entity/:id/diagnose
export async function diagnoseEntityHandler(req: Request, res: Response) {
  try {
    const { entity, userId } = await loadOwnedEntity(req, String(req.params.id || ''));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!entity) return res.status(404).json({ error: 'Entity not found' });

    const latestAudit = await getLatestEntityAudit(String(entity.id));
    const latestResult = extractLatestResult(latestAudit);
    const schemaTypes = extractSchemaTypesFromLatestResult(latestResult);
    const variants = await getEntityVariants(String(entity.id));
    const lexicalConflicts = await searchPotentialEntityConflicts({
      name: String(entity.canonical_name || entity.name || ''),
      domain: String(entity.domain || ''),
      excludeEntityId: String(entity.id),
      limit: 8,
    });

    const embeddingText = buildEntitySeedText(entity, variants.map((variant: any) => String(variant.surface_name || '')).filter(Boolean));
    const embeddingResult = await embedText(embeddingText);
    await setEntityEmbedding(String(entity.id), embeddingResult.embedding);

    const semanticCollision = await runSemanticCollisionAnalysis({
      entityId: String(entity.id),
      embedding: embeddingResult.embedding,
      radius: 0.22,
      minClusterSize: 3,
    });

    const collisions = semanticCollision.conflicting_entities.slice(0, 6).map((targetId) => {
      const lexical = lexicalConflicts.find((candidate) => String(candidate.id) === targetId);
      const vectorMatch = semanticCollision.points.find((point) => point.entity_id === targetId);
      return {
        id: targetId,
        name: String(lexical?.name || vectorMatch?.metadata?.name || targetId),
        domain: lexical?.domain || (vectorMatch?.metadata?.domain as string | null | undefined) || null,
        confidence: Number(vectorMatch?.similarity || lexical?.severity || 0),
        source: lexical ? 'lexical+vector' : 'vector',
      };
    });

    const confusionCount = collisions.length;
    const diagnosisMessage = confusionCount > 0
      ? `You are being confused with ${confusionCount} other visibility tools.`
      : 'No strong confusion cluster detected for this entity.';

    const llmClassification = {
      predicted_category: String(entity.entity_type || inferEntityType({ domain: String(entity.domain || ''), name: String(entity.canonical_name || entity.name || '') })),
      ambiguity_level: confusionCount >= 3 ? 'high' : confusionCount >= 1 ? 'medium' : 'low',
      rationale: confusionCount > 0
        ? 'Nearest-neighbor clusters and lexical overlaps indicate adjacent entities in similar retrieval intents.'
        : 'Current variant and evidence profile does not show close collision neighbors.',
    };

    const evidenceSignals = semanticCollision.points
      .filter((item) => item.type === 'evidence')
      .slice(0, 5)
      .map((item) => ({
        source: String(item.metadata?.source || ''),
        snippet: String(item.metadata?.snippet || ''),
        similarity: Number(item.similarity || 0),
      }));

    const collisionScore = clampPercent(Math.round((semanticCollision.collision_score || 0) * 100), Number(entity.collision_score || 0));
    const clarityPenalty = clampPercent(confusionCount * 8);
    const nextClarity = clampPercent(Number(entity.clarity_score || 0) - clarityPenalty, Number(entity.clarity_score || 0));

    await updateEntityScores(String(entity.id), {
      collision_score: collisionScore,
      clarity_score: nextClarity,
    });

    return res.json({
      success: true,
      diagnosis: {
        entity_id: entity.id,
        message: diagnosisMessage,
        embedding_clustering: {
          vector_neighbors: semanticCollision.points.filter((point) => point.type !== 'evidence').slice(0, 20),
          lexical_neighbors: lexicalConflicts,
          clusters: semanticCollision.clusters.map((cluster) => ({
            id: cluster.id,
            size: cluster.points.length,
            entity_ids: Array.from(new Set(cluster.points.map((point) => point.entity_id))),
          })),
          primary_cluster: semanticCollision.primary_cluster,
          fragmentation: semanticCollision.fragmentation,
          merged_collisions: collisions,
        },
        llm_classification: llmClassification,
        schema_extraction: {
          schema_types: schemaTypes,
          schema_count: schemaTypes.length,
        },
        evidence_overlap: evidenceSignals,
        updated_scores: {
          collision_score: collisionScore,
          clarity_score: nextClarity,
        },
      },
    });
  } catch (err: any) {
    console.error('[Entity] Diagnose error:', err);
    return res.status(500).json({ error: 'Failed to diagnose entity clarity' });
  }
}

// POST /api/entity/:id/reinforce
export async function reinforceEntityHandler(req: Request, res: Response) {
  try {
    const { entity, userId } = await loadOwnedEntity(req, String(req.params.id || ''));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!entity) return res.status(404).json({ error: 'Entity not found' });

    const conflicts = await searchPotentialEntityConflicts({
      name: String(entity.canonical_name || entity.name || ''),
      domain: String(entity.domain || ''),
      excludeEntityId: String(entity.id),
      limit: 6,
    });

    const reinforcement = buildReinforcementPlan(entity, conflicts as Array<Record<string, unknown>>);

    const actionsLogged = [
      ...reinforcement.reddit_templates.map((item) => ({
        type: 'reddit' as const,
        source: `template://${item.subreddit_hint}`,
        snippet: `${item.title}\n${item.body_template}`,
        weight: 0.5,
      })),
      ...reinforcement.directory_submissions.map((item) => ({
        type: 'directory' as const,
        source: `directory://${item.target}`,
        snippet: item.payload_hint,
        weight: 0.6,
      })),
      ...reinforcement.vs_competitor_pages.map((item) => ({
        type: 'mention' as const,
        source: `vs://${item.target_slug}`,
        snippet: item.positioning_angle,
        weight: 0.7,
      })),
      ...reinforcement.faq_expansions.map((item) => ({
        type: 'schema' as const,
        source: 'faq://entity',
        snippet: `${item.question} ${item.answer_seed}`,
        weight: 0.55,
      })),
    ];

    for (const item of actionsLogged) {
      await upsertEntityEvidence(String(entity.id), {
        evidence_type: item.type,
        source: item.source,
        snippet: item.snippet,
        hash: createHash('sha256').update(`${entity.id}:${item.type}:${item.source}:${item.snippet}`).digest('hex'),
        weight: item.weight,
      });
    }

    const authorityGain = clampPercent(Math.round(actionsLogged.length * 3));
    const collisionRelief = clampPercent(Math.round(actionsLogged.length * 1.5));
    const currentAuthority = Number(entity.authority_score || 0);
    const currentCollision = Number(entity.collision_score || 0);
    const nextAuthority = clampPercent(currentAuthority + authorityGain, currentAuthority);
    const nextCollision = clampPercent(currentCollision - collisionRelief, currentCollision);
    const nextClarity = clampPercent(Number(entity.clarity_score || 0) + Math.round(actionsLogged.length * 1.8), Number(entity.clarity_score || 0));

    await updateEntityScores(String(entity.id), {
      authority_score: nextAuthority,
      collision_score: nextCollision,
      clarity_score: nextClarity,
    });

    await recordDriftScore(String(entity.id), nextClarity, actionsLogged.length, 'reinforcement_loop');

    return res.json({
      success: true,
      reinforcement: {
        entity_id: entity.id,
        plan: reinforcement,
        evidence_logged: actionsLogged.length,
        updated_scores: {
          clarity_score: nextClarity,
          collision_score: nextCollision,
          authority_score: nextAuthority,
        },
      },
    });
  } catch (err: any) {
    console.error('[Entity] Reinforce error:', err);
    return res.status(500).json({ error: 'Failed to generate reinforcement loop actions' });
  }
}
