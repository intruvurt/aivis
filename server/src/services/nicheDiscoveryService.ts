/**
 * Niche URL Discovery Service
 *
 * Uses real web search engines (DDG + Bing) to discover business URLs for a
 * given niche + location query, validates each URL with an HTTP HEAD probe,
 * deduplicates against existing scheduled rescans & competitor tracking, then
 * optionally adds them to the scheduled rescan list.
 *
 * AI is used only to label/describe results — never to generate URLs.
 */
import { getPool } from './postgresql.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import { scrapeDDGRaw, scrapeBingRaw } from './webSearch.js';
import { createScheduledRescan } from './scheduledRescanService.js';
import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredUrl {
  url: string;
  name: string;
  reason: string;
  valid: boolean;
  duplicate: boolean;
  httpStatus: number | null;
}

export interface DiscoveryJob {
  id: string;
  user_id: string;
  workspace_id: string;
  query: string;
  location: string;
  status: 'pending' | 'discovering' | 'validating' | 'scheduling' | 'auditing' | 'completed' | 'failed';
  discovered_urls: DiscoveredUrl[];
  scheduled_count: number;
  audited_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ── DB migration (called from postgresql.ts) ─────────────────────────────────

export const NICHE_DISCOVERY_MIGRATION = `
CREATE TABLE IF NOT EXISTS niche_discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  query TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  discovered_urls JSONB DEFAULT '[]'::jsonb,
  scheduled_count INTEGER DEFAULT 0,
  audited_count INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_niche_discovery_user ON niche_discovery_jobs(user_id);
`;

// ── Web-search-powered URL discovery ─────────────────────────────────────────

/** Domains that are directories/aggregators — not actual businesses */
const DIRECTORY_HOSTS = new Set([
  'yelp.com', 'yellowpages.com', 'bbb.org', 'angi.com', 'angieslist.com',
  'thumbtack.com', 'homeadvisor.com', 'nextdoor.com', 'mapquest.com',
  'manta.com', 'chamberofcommerce.com', 'buildzoom.com', 'houzz.com',
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'tiktok.com', 'youtube.com', 'pinterest.com', 'reddit.com',
  'google.com', 'bing.com', 'duckduckgo.com', 'wikipedia.org',
  'amazon.com', 'ebay.com', 'craigslist.org',
]);

function extractHostForFilter(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    // Get root domain (last two segments)
    const parts = hostname.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
  } catch {
    return '';
  }
}

function isBusinessUrl(href: string): boolean {
  const rootDomain = extractHostForFilter(href);
  if (!rootDomain) return false;
  if (DIRECTORY_HOSTS.has(rootDomain)) return false;
  if (!/^https?:\/\//i.test(href)) return false;
  return true;
}

/**
 * Build multiple search queries to maximize coverage.
 * Combines niche + location with business-oriented modifiers.
 */
function buildSearchQueries(niche: string, location: string): string[] {
  const base = location ? `${niche} ${location}` : niche;
  const queries = [base];
  if (location) {
    queries.push(`best ${niche} companies ${location}`);
    queries.push(`${niche} near ${location}`);
  } else {
    queries.push(`top ${niche} companies`);
    queries.push(`best ${niche} businesses`);
  }
  return queries;
}

/**
 * Discovers real business URLs by scraping DDG + Bing search results.
 * Deduplicates by root domain, filters out directories/social media,
 * and returns real URLs that appeared in search engine results.
 */
async function discoverUrlsViaWebSearch(
  niche: string,
  location: string,
): Promise<Array<{ name: string; url: string; reason: string }>> {
  const queries = buildSearchQueries(niche, location);
  const seenDomains = new Set<string>();
  const results: Array<{ name: string; url: string; reason: string }> = [];

  // Run DDG + Bing searches in parallel for each query (up to 2 queries to avoid rate limits)
  for (const query of queries.slice(0, 2)) {
    const [ddgResults, bingResults] = await Promise.all([
      scrapeDDGRaw(query, 20).catch(() => []),
      scrapeBingRaw(query, 15).catch(() => []),
    ]);

    const merged = [...ddgResults, ...bingResults];

    for (const r of merged) {
      if (!isBusinessUrl(r.href)) continue;

      const rootDomain = extractHostForFilter(r.href);
      if (seenDomains.has(rootDomain)) continue;
      seenDomains.add(rootDomain);

      results.push({
        name: r.title.replace(/\s*[-|–—].*$/, '').trim() || rootDomain,
        url: r.href,
        reason: r.snippet || `Found in search results for "${query}"`,
      });

      if (results.length >= 25) break;
    }

    if (results.length >= 25) break;
  }

  // If first two queries yielded very few results, try remaining queries
  if (results.length < 5 && queries.length > 2) {
    for (const query of queries.slice(2)) {
      const [ddgResults, bingResults] = await Promise.all([
        scrapeDDGRaw(query, 20).catch(() => []),
        scrapeBingRaw(query, 15).catch(() => []),
      ]);

      for (const r of [...ddgResults, ...bingResults]) {
        if (!isBusinessUrl(r.href)) continue;
        const rootDomain = extractHostForFilter(r.href);
        if (seenDomains.has(rootDomain)) continue;
        seenDomains.add(rootDomain);

        results.push({
          name: r.title.replace(/\s*[-|–—].*$/, '').trim() || rootDomain,
          url: r.href,
          reason: r.snippet || `Found in search results for "${query}"`,
        });

        if (results.length >= 25) break;
      }
      if (results.length >= 10) break;
    }
  }

  if (results.length === 0) {
    throw new Error(
      `No business URLs found for "${niche}"${location ? ` in "${location}"` : ''}. ` +
      'Try broadening the industry term or simplifying the location.'
    );
  }

  return results;
}

// ── HTTP validation ──────────────────────────────────────────────────────────

async function validateUrl(rawUrl: string): Promise<{ valid: boolean; httpStatus: number | null; normalizedUrl: string | null }> {
  const normalized = normalizePublicHttpUrl(rawUrl);
  if (!normalized.ok) {
    return { valid: false, httpStatus: null, normalizedUrl: null };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const resp = await fetch(normalized.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'AiVIS-NicheDiscovery/1.0' },
    });

    clearTimeout(timer);
    return { valid: resp.ok || resp.status === 403, httpStatus: resp.status, normalizedUrl: normalized.url };
  } catch {
    // Try GET as fallback (some servers block HEAD)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);

      const resp = await fetch(normalized.url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'AiVIS-NicheDiscovery/1.0', 'Range': 'bytes=0-0' },
      });

      clearTimeout(timer);
      return { valid: resp.ok || resp.status === 403 || resp.status === 206, httpStatus: resp.status, normalizedUrl: normalized.url };
    } catch {
      return { valid: false, httpStatus: null, normalizedUrl: normalized.url };
    }
  }
}

// ── Deduplication check ──────────────────────────────────────────────────────

async function getExistingUrls(userId: string, workspaceId: string): Promise<Set<string>> {
  const pool = getPool();
  const existing = new Set<string>();

  const [rescans, competitors] = await Promise.all([
    pool.query('SELECT url FROM scheduled_rescans WHERE user_id = $1 AND workspace_id = $2', [userId, workspaceId]),
    pool.query('SELECT competitor_url FROM competitor_tracking WHERE user_id = $1', [userId]),
  ]);

  for (const row of rescans.rows) existing.add(String(row.url).toLowerCase().trim());
  for (const row of competitors.rows) existing.add(String(row.competitor_url).toLowerCase().trim());

  return existing;
}

// ── Job persistence ──────────────────────────────────────────────────────────

async function createJob(userId: string, workspaceId: string, query: string, location: string): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO niche_discovery_jobs (user_id, workspace_id, query, location, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [userId, workspaceId, query, location],
  );
  return rows[0].id;
}

async function updateJob(jobId: string, updates: Partial<DiscoveryJob>) {
  const pool = getPool();
  const sets: string[] = ['updated_at = NOW()'];
  const vals: any[] = [];
  let i = 1;

  if (updates.status) { sets.push(`status = $${i}`); vals.push(updates.status); i++; }
  if (updates.discovered_urls !== undefined) { sets.push(`discovered_urls = $${i}`); vals.push(updates.discovered_urls); i++; }
  if (updates.scheduled_count !== undefined) { sets.push(`scheduled_count = $${i}`); vals.push(updates.scheduled_count); i++; }
  if (updates.audited_count !== undefined) { sets.push(`audited_count = $${i}`); vals.push(updates.audited_count); i++; }
  if (updates.error !== undefined) { sets.push(`error = $${i}`); vals.push(updates.error); i++; }

  vals.push(jobId);
  await pool.query(`UPDATE niche_discovery_jobs SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

export async function getJob(jobId: string, userId: string): Promise<DiscoveryJob | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM niche_discovery_jobs WHERE id = $1 AND user_id = $2',
    [jobId, userId],
  );
  return rows[0] || null;
}

export async function listJobs(userId: string, workspaceId: string, limit = 20): Promise<DiscoveryJob[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM niche_discovery_jobs WHERE user_id = $1 AND workspace_id = $2 ORDER BY created_at DESC LIMIT $3',
    [userId, workspaceId, limit],
  );
  return rows;
}

// ── Main discovery pipeline ──────────────────────────────────────────────────

/**
 * Runs the full niche discovery pipeline:
 *   1) AI discovers URLs for niche + location
 *   2) Each URL is validated via HTTP
 *   3) Duplicates are flagged against existing rescans & competitors
 *   4) Results are persisted to the job record
 *
 * Returns the job with enriched discovered_urls.
 * Does NOT auto-schedule — the caller must explicitly add URLs via addDiscoveredToSchedule().
 */
export async function runDiscovery(
  userId: string,
  workspaceId: string,
  query: string,
  location: string,
): Promise<DiscoveryJob> {
  const jobId = await createJob(userId, workspaceId, query, location);

  try {
    // Phase 1: Web search discovery (DDG + Bing)
    await updateJob(jobId, { status: 'discovering' });
    const rawResults = await discoverUrlsViaWebSearch(query, location);

    if (rawResults.length === 0) {
      await updateJob(jobId, { status: 'failed', error: 'No URLs found for this niche and location' });
      return (await getJob(jobId, userId))!;
    }

    // Phase 2: Validate + deduplicate
    await updateJob(jobId, { status: 'validating' });

    const existingUrls = await getExistingUrls(userId, workspaceId);
    const discovered: DiscoveredUrl[] = [];

    // Validate URLs sequentially to avoid hammering targets
    for (const item of rawResults) {
      const { valid, httpStatus, normalizedUrl } = await validateUrl(item.url);
      const finalUrl = normalizedUrl || item.url;
      const isDuplicate = existingUrls.has(finalUrl.toLowerCase().trim());

      discovered.push({
        url: finalUrl,
        name: item.name,
        reason: item.reason,
        valid,
        duplicate: isDuplicate,
        httpStatus,
      });
    }

    await updateJob(jobId, {
      status: 'completed',
      discovered_urls: discovered,
    });

    return (await getJob(jobId, userId))!;
  } catch (err: any) {
    console.error(`[NicheDiscovery] Job ${jobId} failed:`, err.message);
    await updateJob(jobId, { status: 'failed', error: err.message || 'Discovery failed' });
    return (await getJob(jobId, userId))!;
  }
}

// ── Add discovered URLs to scheduled rescans ─────────────────────────────────

/**
 * Takes a subset of discovered URLs from a job, adds them to scheduled_rescans,
 * and returns the count added. Respects tier limits. Skips invalid/duplicate URLs.
 */
export async function addDiscoveredToSchedule(
  userId: string,
  workspaceId: string,
  jobId: string,
  selectedUrls: string[],
  frequency: string = 'weekly',
): Promise<{ added: number; skipped: number; errors: string[] }> {
  const pool = getPool();
  const errors: string[] = [];
  let added = 0;
  let skipped = 0;

  // Load the job
  const job = await getJob(jobId, userId);
  if (!job) throw new Error('Discovery job not found');
  if (job.status !== 'completed') throw new Error('Discovery job is not completed');

  // Check tier limits
  const { rows: userRows } = await pool.query('SELECT tier FROM users WHERE id = $1', [userId]);
  const tier = uiTierFromCanonical((userRows[0]?.tier || 'observer') as CanonicalTier | LegacyTier);
  const limits = TIER_LIMITS[tier];

  if (!limits.hasScheduledRescans) {
    throw new Error('Scheduled rescans not available on your plan');
  }

  const allowedFreqs = limits.allowedRescanFrequencies;
  const effectiveFreq = allowedFreqs.includes(frequency) ? frequency : (allowedFreqs[0] || 'weekly');

  // Count existing schedules
  const { rows: existing } = await pool.query(
    'SELECT COUNT(*) as count FROM scheduled_rescans WHERE user_id = $1 AND workspace_id = $2',
    [userId, workspaceId],
  );
  let currentCount = parseInt(existing[0]?.count || '0', 10);
  const maxRescans = limits.maxScheduledRescans;

  const discoveredMap = new Map<string, DiscoveredUrl>();
  const urls: DiscoveredUrl[] = Array.isArray(job.discovered_urls)
    ? (typeof job.discovered_urls === 'string' ? JSON.parse(job.discovered_urls as any) : job.discovered_urls)
    : [];
  for (const d of urls) discoveredMap.set(d.url.toLowerCase().trim(), d);

  const selectedSet = new Set(selectedUrls.map(u => u.toLowerCase().trim()));

  for (const url of selectedSet) {
    const entry = discoveredMap.get(url);
    if (!entry) { skipped++; errors.push(`URL not in discovery results: ${url}`); continue; }
    if (!entry.valid) { skipped++; errors.push(`Invalid URL skipped: ${entry.url}`); continue; }
    if (entry.duplicate) { skipped++; errors.push(`Duplicate skipped: ${entry.url}`); continue; }

    if (currentCount >= maxRescans) {
      skipped++;
      errors.push(`Tier limit reached (${maxRescans}). Cannot add: ${entry.url}`);
      continue;
    }

    try {
      await createScheduledRescan(userId, workspaceId, entry.url, effectiveFreq);
      added++;
      currentCount++;
    } catch (err: any) {
      skipped++;
      errors.push(`Failed to schedule ${entry.url}: ${err.message}`);
    }
  }

  await updateJob(jobId, { scheduled_count: added });

  return { added, skipped, errors };
}
