// server/src/services/entityFingerprint.ts
// Entity fingerprint system — per-user brand anchoring, blocklist management,
// collision detection, and entity-aware result filtering.

import { getPool } from './postgresql.js';
import { textMentionsBrand, brandMatchesWordBoundary } from './searchDisambiguation.js';
import { findKGCollisions, resolveEntityFromKG } from './googleKnowledgeGraph.js';
import type { KGEntity } from './googleKnowledgeGraph.js';
import type {
  EntityFingerprint,
  BlocklistEntry,
  BlocklistEntryType,
  CollisionCluster,
  CollisionDetectionResult,
} from '../../../shared/types.js';

// ─── Fingerprint CRUD ────────────────────────────────────────────────────────

export async function getFingerprint(userId: string): Promise<EntityFingerprint | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, user_id, brand_name, canonical_domain, founder_name,
            social_handles, wikidata_id, google_kg_id, schema_org_id,
            product_category, description_keywords, created_at, updated_at
     FROM entity_fingerprints WHERE user_id = $1`,
    [userId],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: row.id,
    user_id: row.user_id,
    brand_name: row.brand_name,
    canonical_domain: row.canonical_domain,
    founder_name: row.founder_name || '',
    social_handles: row.social_handles || {},
    wikidata_id: row.wikidata_id || '',
    google_kg_id: row.google_kg_id || '',
    schema_org_id: row.schema_org_id || '',
    product_category: row.product_category || '',
    description_keywords: Array.isArray(row.description_keywords) ? row.description_keywords : [],
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export interface UpsertFingerprintInput {
  brand_name: string;
  canonical_domain: string;
  founder_name?: string;
  social_handles?: Record<string, string>;
  wikidata_id?: string;
  google_kg_id?: string;
  schema_org_id?: string;
  product_category?: string;
  description_keywords?: string[];
}

export async function upsertFingerprint(
  userId: string,
  data: UpsertFingerprintInput,
): Promise<EntityFingerprint> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO entity_fingerprints (
       user_id, brand_name, canonical_domain, founder_name,
       social_handles, wikidata_id, google_kg_id, schema_org_id,
       product_category, description_keywords
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id) DO UPDATE SET
       brand_name = EXCLUDED.brand_name,
       canonical_domain = EXCLUDED.canonical_domain,
       founder_name = EXCLUDED.founder_name,
       social_handles = EXCLUDED.social_handles,
       wikidata_id = EXCLUDED.wikidata_id,
       google_kg_id = EXCLUDED.google_kg_id,
       schema_org_id = EXCLUDED.schema_org_id,
       product_category = EXCLUDED.product_category,
       description_keywords = EXCLUDED.description_keywords,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      data.brand_name,
      data.canonical_domain,
      data.founder_name || '',
      JSON.stringify(data.social_handles || {}),
      data.wikidata_id || '',
      data.google_kg_id || '',
      data.schema_org_id || '',
      data.product_category || '',
      data.description_keywords || [],
    ],
  );
  const row = rows[0];
  return {
    id: row.id,
    user_id: row.user_id,
    brand_name: row.brand_name,
    canonical_domain: row.canonical_domain,
    founder_name: row.founder_name || '',
    social_handles: row.social_handles || {},
    wikidata_id: row.wikidata_id || '',
    google_kg_id: row.google_kg_id || '',
    schema_org_id: row.schema_org_id || '',
    product_category: row.product_category || '',
    description_keywords: Array.isArray(row.description_keywords) ? row.description_keywords : [],
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// ─── Blocklist CRUD ──────────────────────────────────────────────────────────

export async function getBlocklist(userId: string): Promise<BlocklistEntry[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, user_id, pattern, type, reason, auto_detected, created_at
     FROM entity_blocklists WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    pattern: r.pattern,
    type: r.type as BlocklistEntryType,
    reason: r.reason || '',
    auto_detected: Boolean(r.auto_detected),
    created_at: new Date(r.created_at).toISOString(),
  }));
}

export async function addBlocklistEntry(
  userId: string,
  pattern: string,
  type: BlocklistEntryType,
  reason: string,
  autoDetected = false,
): Promise<BlocklistEntry> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO entity_blocklists (user_id, pattern, type, reason, auto_detected)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, pattern, type, reason, autoDetected],
  );
  const r = rows[0];
  return {
    id: r.id,
    user_id: r.user_id,
    pattern: r.pattern,
    type: r.type as BlocklistEntryType,
    reason: r.reason || '',
    auto_detected: Boolean(r.auto_detected),
    created_at: new Date(r.created_at).toISOString(),
  };
}

export async function removeBlocklistEntry(userId: string, entryId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM entity_blocklists WHERE id = $1 AND user_id = $2`,
    [entryId, userId],
  );
  return (rowCount ?? 0) > 0;
}

export async function addAutoBlocklistEntries(
  userId: string,
  entries: Array<{ pattern: string; type: BlocklistEntryType; reason: string }>,
): Promise<number> {
  if (!entries.length) return 0;
  const pool = getPool();
  let added = 0;
  for (const entry of entries) {
    try {
      await pool.query(
        `INSERT INTO entity_blocklists (user_id, pattern, type, reason, auto_detected)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT DO NOTHING`,
        [userId, entry.pattern, entry.type, entry.reason],
      );
      added++;
    } catch { /* skip duplicates */ }
  }
  return added;
}

// ─── Entity-Aware Filtering ──────────────────────────────────────────────────

/** Check if text matches any blocklist entry */
export function matchesBlocklist(
  text: string,
  blocklist: BlocklistEntry[],
): { blocked: boolean; matchedPattern?: string } {
  const lower = text.toLowerCase();
  for (const entry of blocklist) {
    const pattern = entry.pattern.toLowerCase();
    switch (entry.type) {
      case 'name':
        if (brandMatchesWordBoundary(text, entry.pattern)) {
          return { blocked: true, matchedPattern: entry.pattern };
        }
        break;
      case 'domain':
        if (lower.includes(pattern)) {
          return { blocked: true, matchedPattern: entry.pattern };
        }
        break;
      case 'keyword':
        if (lower.includes(pattern)) {
          return { blocked: true, matchedPattern: entry.pattern };
        }
        break;
      case 'entity_type':
        if (lower.includes(pattern)) {
          return { blocked: true, matchedPattern: entry.pattern };
        }
        break;
    }
  }
  return { blocked: false };
}

/** Count how many entity fingerprint signals match in a result */
export function countEntitySignals(
  result: { title: string; snippet: string; url: string },
  fingerprint: EntityFingerprint,
): { total: number; signals: string[] } {
  const text = `${result.title} ${result.snippet} ${result.url}`;
  const lower = text.toLowerCase();
  const signals: string[] = [];

  // 1. Domain co-occurrence (strongest signal)
  if (fingerprint.canonical_domain && lower.includes(fingerprint.canonical_domain.toLowerCase())) {
    signals.push('domain');
  }

  // 2. Founder co-mention
  if (fingerprint.founder_name && textMentionsBrand(text, fingerprint.founder_name)) {
    signals.push('founder');
  }

  // 3. Social handle presence
  for (const [platform, handle] of Object.entries(fingerprint.social_handles)) {
    if (handle && lower.includes(handle.toLowerCase())) {
      signals.push(`social:${platform}`);
      break; // one social match is enough
    }
  }

  // 4. Schema.org / Knowledge Graph ID
  if (fingerprint.schema_org_id && lower.includes(fingerprint.schema_org_id.toLowerCase())) {
    signals.push('schema_org_id');
  }

  // 5. Description keyword overlap
  const kwHits = (fingerprint.description_keywords || []).filter(
    (kw) => kw.length >= 3 && lower.includes(kw.toLowerCase()),
  ).length;
  if (kwHits >= 2) signals.push('keywords');

  return { total: signals.length, signals };
}

/**
 * Entity-aware result filter. Returns true if the result is relevant to the
 * user's entity (not a false positive from a naming collision).
 *
 * Strategy:
 * - If blocked by blocklist → reject
 * - If on the user's own domain → accept
 * - If off-domain: need at least one co-occurrence signal (founder, social, keyword overlap)
 * - Brand name must appear via word-boundary match
 */
export function isEntityRelevant(
  result: { title: string; snippet: string; url: string },
  fingerprint: EntityFingerprint,
  blocklist: BlocklistEntry[],
): { relevant: boolean; reason: string; signals: string[] } {
  const text = `${result.title} ${result.snippet}`;
  const urlLower = result.url.toLowerCase();

  // Step 1: Blocklist check
  const block = matchesBlocklist(`${text} ${result.url}`, blocklist);
  if (block.blocked) {
    return { relevant: false, reason: `Blocked: "${block.matchedPattern}"`, signals: [] };
  }

  // Step 2: Brand name must appear in text
  if (!textMentionsBrand(text, fingerprint.brand_name)) {
    return { relevant: false, reason: 'Brand name not found in result', signals: [] };
  }

  // Step 3: On own domain → always relevant
  if (fingerprint.canonical_domain && urlLower.includes(fingerprint.canonical_domain.toLowerCase())) {
    return { relevant: true, reason: 'On canonical domain', signals: ['domain'] };
  }

  // Step 4: Off-domain — need entity co-occurrence signals
  const { signals } = countEntitySignals(result, fingerprint);

  if (signals.length > 0) {
    return { relevant: true, reason: `Entity signals: ${signals.join(', ')}`, signals };
  }

  // Step 5: No co-occurrence signals — check description keyword overlap as softer gate
  const lower = `${text} ${result.url}`.toLowerCase();
  const kwHits = (fingerprint.description_keywords || []).filter(
    (kw) => kw.length >= 3 && lower.includes(kw.toLowerCase()),
  ).length;
  if (kwHits >= 1) {
    return { relevant: true, reason: 'Keyword context overlap', signals: ['keyword_context'] };
  }

  return { relevant: false, reason: 'No entity co-occurrence signals found', signals: [] };
}

/**
 * Filter an array of results through entity fingerprint + blocklist.
 * Returns results annotated with relevance info.
 */
export function filterResultsByEntity<T extends { title: string; snippet: string; url: string }>(
  results: T[],
  fingerprint: EntityFingerprint,
  blocklist: BlocklistEntry[],
): { relevant: T[]; blocked: T[]; stats: { total: number; kept: number; blocked: number } } {
  const relevant: T[] = [];
  const blocked: T[] = [];

  for (const result of results) {
    const check = isEntityRelevant(result, fingerprint, blocklist);
    if (check.relevant) {
      relevant.push(result);
    } else {
      blocked.push(result);
    }
  }

  return {
    relevant,
    blocked,
    stats: { total: results.length, kept: relevant.length, blocked: blocked.length },
  };
}

// ─── Entity-Aware Query Building ─────────────────────────────────────────────

/**
 * Build entity-anchored search queries using fingerprint signals.
 * These queries use domain co-occurrence and founder/social anchoring
 * to find only results about THIS specific entity.
 */
export function buildEntityQueries(fingerprint: EntityFingerprint): string[] {
  const queries: string[] = [];
  const brand = fingerprint.brand_name;
  const domain = fingerprint.canonical_domain;

  // Domain co-mention (strongest signal)
  if (domain) {
    queries.push(`"${brand}" site:${domain}`);
    queries.push(`"${brand}" "${domain}"`);
  }

  // Social handle anchored
  for (const handle of Object.values(fingerprint.social_handles)) {
    if (handle) {
      queries.push(`"${brand}" "${handle}"`);
      break; // one is enough for search diversification
    }
  }

  // Founder + brand (person-org entity link)
  if (fingerprint.founder_name) {
    queries.push(`"${fingerprint.founder_name}" "${brand}"`);
  }

  // Product category context
  if (fingerprint.product_category) {
    queries.push(`"${brand}" ${fingerprint.product_category}`);
  }

  return queries;
}

// ─── Collision Detection ─────────────────────────────────────────────────────

/** Classify a KG entity type into the collision entity type taxonomy */
function classifyKGEntity(
  entity: KGEntity,
): 'person' | 'company' | 'project' | 'unknown' {
  const types = (Array.isArray(entity.types) ? entity.types : []).map(t => t.toLowerCase());
  if (types.some(t => t.includes('person') || t.includes('author') || t.includes('artist'))) return 'person';
  if (types.some(t => t.includes('organization') || t.includes('corporation') || t.includes('company'))) return 'company';
  if (types.some(t => t.includes('softwareapplication') || t.includes('website') || t.includes('product'))) return 'project';
  // Fall back to description-based classification
  const desc = `${entity.description} ${entity.detailed_description}`.toLowerCase();
  if (PERSON_INDICATORS.some(p => desc.includes(p))) return 'person';
  if (COMPANY_INDICATORS.some(p => desc.includes(p))) return 'company';
  if (PROJECT_INDICATORS.some(p => desc.includes(p))) return 'project';
  return 'unknown';
}

/** Patterns that indicate person entities */
const PERSON_INDICATORS = [
  'linkedin.com/in/', 'professor', 'phd', 'researcher', 'senior', 'director',
  'manager', 'scientist', 'dr.', 'engineer at', 'works at', 'expert at',
];

/** Patterns that indicate company/product entities different from the target */
const COMPANY_INDICATORS = [
  'biotech', 'biomarker', 'pharmaceutical', 'clinical trial', 'fda',
  'inc.', 'ltd.', 'corporation', 'partnership', 'venture',
];

/** Patterns that indicate open-source project entities */
const PROJECT_INDICATORS = [
  'github.com/', 'npm', 'pypi', 'open source', 'repository', 'npm install',
  'speech', 'voice', 'tts', 'text to speech', 'engine',
];

function classifyCollisionEntity(
  text: string,
): 'person' | 'company' | 'project' | 'unknown' {
  const lower = text.toLowerCase();
  const personScore = PERSON_INDICATORS.filter((p) => lower.includes(p)).length;
  const companyScore = COMPANY_INDICATORS.filter((p) => lower.includes(p)).length;
  const projectScore = PROJECT_INDICATORS.filter((p) => lower.includes(p)).length;

  const max = Math.max(personScore, companyScore, projectScore);
  if (max === 0) return 'unknown';
  if (personScore === max) return 'person';
  if (companyScore === max) return 'company';
  return 'project';
}

/**
 * Detect entity collisions for a given brand name by searching the web
 * and clustering results that clearly belong to different entities.
 *
 * Uses free search APIs (Bing HTML scraping) and optionally the Google
 * Knowledge Graph API (if GOOGLE_KG_KEY is set) for authoritative disambiguation.
 */
export async function detectCollisions(
  brandName: string,
  canonicalDomain: string,
  fingerprint?: EntityFingerprint,
): Promise<CollisionDetectionResult> {
  const collisions: CollisionCluster[] = [];
  const suggestedBlocks: Array<{ pattern: string; type: BlocklistEntryType; reason: string }> = [];

  try {
    // Phase 1: Google Knowledge Graph collision detection (if API key is set)
    const kgCollisions = await findKGCollisions(brandName, canonicalDomain);
    for (const kgEntity of kgCollisions) {
      const entityType = classifyKGEntity(kgEntity);
      const blocks: Array<{ pattern: string; type: BlocklistEntryType; reason: string }> = [];

      if (kgEntity.url) {
        try {
          const host = new URL(kgEntity.url).hostname.replace(/^www\./, '');
          blocks.push({
            pattern: host,
            type: 'domain',
            reason: `KG entity "${kgEntity.name}" (${kgEntity.description}) has official site "${host}"`,
          });
        } catch { /* skip */ }
      }

      // Extract distinctive keywords from KG description
      const kgText = `${kgEntity.description} ${kgEntity.detailed_description}`;
      const kgDistinctive = extractDistinctiveTermsFromText(kgText, brandName);
      for (const term of kgDistinctive.slice(0, 2)) {
        blocks.push({
          pattern: term,
          type: 'keyword',
          reason: `Keyword "${term}" is associated with KG entity "${kgEntity.name}"`,
        });
      }

      collisions.push({
        entity_type: entityType,
        name: kgEntity.name.slice(0, 120),
        description: (kgEntity.description || kgEntity.detailed_description).slice(0, 300),
        source_urls: kgEntity.url ? [kgEntity.url] : [],
        suggested_blocks: blocks,
      });
      suggestedBlocks.push(...blocks);
    }

    // Phase 2: Web search collision detection (always runs — free, no key)
    const { scrapeBingRaw } = await import('./webSearch.js');
    const searchResults = await scrapeBingRaw(`"${brandName}"`, 15);

    // Cluster results by whether they're on our domain or not
    const offDomainResults = searchResults.filter(
      (r) => !r.href.toLowerCase().includes(canonicalDomain.toLowerCase()),
    );

    // Group off-domain results by their root domain
    const domainClusters = new Map<string, typeof offDomainResults>();
    for (const result of offDomainResults) {
      try {
        const host = new URL(result.href).hostname.replace(/^www\./, '');
        const existing = domainClusters.get(host) || [];
        existing.push(result);
        domainClusters.set(host, existing);
      } catch { /* skip malformed URLs */ }
    }

    // Analyze each cluster for entity type
    for (const [domain, results] of domainClusters) {
      const combinedText = results.map((r) => `${r.title} ${r.snippet}`).join(' ');

      // Skip if the combined text mentions our domain (co-occurrence = likely us)
      if (canonicalDomain && combinedText.toLowerCase().includes(canonicalDomain.toLowerCase())) {
        continue;
      }

      // Skip if fingerprint founder name appears (likely about us)
      if (fingerprint?.founder_name && textMentionsBrand(combinedText, fingerprint.founder_name)) {
        continue;
      }

      const entityType = classifyCollisionEntity(combinedText);
      if (entityType === 'unknown' && results.length < 2) continue;

      // Extract a descriptive name from the results
      const bestTitle = results[0]?.title || domain;
      const bestSnippet = results[0]?.snippet || '';

      // Generate blocklist suggestions based on entity type
      const blocks: Array<{ pattern: string; type: BlocklistEntryType; reason: string }> = [];
      if (entityType === 'person') {
        // Try to extract the person's name from the title
        const nameMatch = bestTitle.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/);
        if (nameMatch) {
          blocks.push({
            pattern: nameMatch[1],
            type: 'name',
            reason: `Person entity "${nameMatch[1]}" shares the brand name`,
          });
        }
      }
      blocks.push({
        pattern: domain,
        type: 'domain',
        reason: `Domain "${domain}" contains a different "${brandName}" entity (${entityType})`,
      });

      // Extract distinctive keywords from this collision cluster
      const distinctiveTerms = extractDistinctiveTerms(combinedText, brandName);
      for (const term of distinctiveTerms.slice(0, 2)) {
        blocks.push({
          pattern: term,
          type: 'keyword',
          reason: `Keyword "${term}" is associated with a different "${brandName}" entity`,
        });
      }

      collisions.push({
        entity_type: entityType,
        name: bestTitle.slice(0, 120),
        description: bestSnippet.slice(0, 300),
        source_urls: results.map((r) => r.href).slice(0, 5),
        suggested_blocks: blocks,
      });
      suggestedBlocks.push(...blocks);
    }
  } catch (err) {
    console.warn('[EntityFingerprint] Collision detection failed:', (err as Error).message);
  }

  const anchorScore = computeAnchorScore(fingerprint || null);

  return {
    brand_name: brandName,
    collisions,
    anchor_score: anchorScore,
    suggested_blocklist: suggestedBlocks,
  };
}

/** Extract terms that are distinctive to a collision cluster (not shared with our entity) */
function extractDistinctiveTerms(text: string, brandName: string): string[] {
  return extractDistinctiveTermsFromText(text, brandName);
}

/**
 * Extract distinctive terms from any text block, not limited to hardcoded lists.
 * Finds multi-word phrases and single words that appear in the text but are
 * unrelated to the brand name, suitable for blocklist keyword suggestions.
 */
function extractDistinctiveTermsFromText(text: string, brandName: string): string[] {
  if (!text || typeof text !== 'string') return [];
  if (!brandName || typeof brandName !== 'string') return [];
  const lower = text.toLowerCase();
  const brandLower = brandName.toLowerCase();
  const brandWords = new Set(brandLower.split(/\s+/));

  // Common stopwords to skip
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'and', 'but', 'or', 'if', 'it',
    'its', 'this', 'that', 'which', 'who', 'whom', 'what', 'about',
  ]);

  // Extract words (3+ chars) that aren't stopwords or brand words
  const words = lower.match(/\b[a-z]{3,}\b/g) || [];
  const wordFreq = new Map<string, number>();
  for (const w of words) {
    if (stopwords.has(w) || brandWords.has(w) || brandLower.includes(w)) continue;
    wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
  }

  // Return top distinctive terms by frequency (appear 2+ times)
  return [...wordFreq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

// ─── Entity Anchor Score ─────────────────────────────────────────────────────

/**
 * Compute entity anchor score (0-100) based on how well the entity is
 * disambiguated. Higher = less likely to get false positives.
 *
 * Scoring:
 * - canonical_domain set: +15
 * - founder_name set: +10
 * - social_handles (3+): +15
 * - wikidata_id set: +20
 * - google_kg_id set: +15
 * - schema_org_id set: +10
 * - product_category set: +5
 * - description_keywords (3+): +10
 */
export function computeAnchorScore(fingerprint: EntityFingerprint | null): number {
  if (!fingerprint) return 0;
  let score = 0;

  if (fingerprint.canonical_domain) score += 15;
  if (fingerprint.founder_name) score += 10;

  const socialCount = Object.values(fingerprint.social_handles || {}).filter(Boolean).length;
  if (socialCount >= 3) score += 15;
  else if (socialCount >= 1) score += Math.min(socialCount * 5, 15);

  if (fingerprint.wikidata_id) score += 20;
  if (fingerprint.google_kg_id) score += 15;
  if (fingerprint.schema_org_id) score += 10;
  if (fingerprint.product_category) score += 5;

  const kwCount = (fingerprint.description_keywords || []).filter(Boolean).length;
  if (kwCount >= 3) score += 10;
  else if (kwCount >= 1) score += kwCount * 3;

  return Math.min(100, score);
}

// ─── Audit Run Tracking ──────────────────────────────────────────────────────

export async function recordAuditRun(
  userId: string,
  triggeredBy: string,
  queriesRun: number,
  citationsFound: number,
  falsePositivesBlocked: number,
  anchorScore: number,
  durationMs: number,
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO entity_audit_runs (user_id, triggered_by, queries_run, citations_found,
       false_positives_blocked, anchor_score, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, triggeredBy, queriesRun, citationsFound, falsePositivesBlocked, anchorScore, durationMs],
    );
  } catch { /* non-fatal */ }
}

export async function getAuditRunHistory(
  userId: string,
  limit = 20,
): Promise<Array<{
  id: string;
  triggered_by: string;
  queries_run: number;
  citations_found: number;
  false_positives_blocked: number;
  anchor_score: number;
  duration_ms: number;
  created_at: string;
}>> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, triggered_by, queries_run, citations_found,
            false_positives_blocked, anchor_score, duration_ms, created_at
     FROM entity_audit_runs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r: any) => ({
    id: r.id,
    triggered_by: r.triggered_by,
    queries_run: r.queries_run,
    citations_found: r.citations_found,
    false_positives_blocked: r.false_positives_blocked,
    anchor_score: r.anchor_score,
    duration_ms: r.duration_ms,
    created_at: new Date(r.created_at).toISOString(),
  }));
}
