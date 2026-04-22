/**
 * geekflareService.ts — Geekflare API client for technical signal enrichment.
 *
 * APIs used (all Alignment+ tier, run in parallel alongside SERP/KG):
 *
 *   1. Lighthouse  → performance/SEO/accessibility scores → technical_score dimension
 *   2. Loadtime    → TTFB/DNS/connection timing → crawlability latency signal
 *   3. TLS Scan    → cert validity/expiry → trust gate (invalid cert = AI crawlers refuse)
 *   4. Broken Link → internal broken link count → content integrity signal
 *
 * All calls are non-blocking and degrade gracefully on timeout or API error.
 * Requires: GEEKFLARE_API_KEY environment variable.
 */

import { getRedis } from '../infra/redis.js';

const BASE_URL = 'https://api.geekflare.com';
const TIMEOUT_MS = 15_000;

const SEARCH_CACHE_TTL = 60 * 30;
const SCRAPE_CACHE_TTL = 60 * 60;
const LIGHTHOUSE_CACHE_TTL = 60 * 60 * 4;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeekflareLighthouseResult {
  performance: number;   // 0–100
  accessibility: number; // 0–100
  best_practices: number;// 0–100
  seo: number;           // 0–100
  first_contentful_paint_ms: number;
  largest_contentful_paint_ms: number;
  total_blocking_time_ms: number;
  cumulative_layout_shift: number;
}

export interface GeekflareLoadtimeResult {
  total_ms: number;
  ttfb_ms: number;
  dns_ms: number;
  connect_ms: number;
  download_ms: number;
  http_status: number;
}

export interface GeekflareTLSResult {
  valid: boolean;
  issuer: string;
  subject: string;
  expires_at: string;      // ISO date
  days_remaining: number;
  protocol: string;        // e.g. "TLS 1.3"
  cipher: string;
}

export interface GeekflareBrokenLinkResult {
  broken_count: number;
  total_checked: number;
  broken_urls: string[];
}

export interface GeekflareEnrichment {
  lighthouse?: GeekflareLighthouseResult;
  loadtime?: GeekflareLoadtimeResult;
  tls?: GeekflareTLSResult;
  broken_links?: GeekflareBrokenLinkResult;
}

// ── Auth / availability ───────────────────────────────────────────────────────

export function isGeekflareAvailable(): boolean {
  return !!getKey();
}

function getKey(): string {
  return (
    process.env.GEEKFLARE_API_KEY?.trim() ||
    process.env.GEEKFLARE_KEY?.trim() ||
    ''
  );
}

function cacheKey(kind: string, key: string): string {
  return `geekflare:${kind}:${key}`;
}

async function cacheGet<T>(kind: string, key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(cacheKey(kind, key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function cacheSet<T>(kind: string, key: string, value: T, ttl: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.setex(cacheKey(kind, key), ttl, JSON.stringify(value));
  } catch {
    // no-op
  }
}

// ── Internal fetch helper ─────────────────────────────────────────────────────

async function gfPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const key = getKey();
  if (!key) throw new Error('GEEKFLARE_API_KEY not set');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Geekflare ${path} → HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

// ── 1. Lighthouse ─────────────────────────────────────────────────────────────

interface LighthouseAPIResponse {
  data?: {
    categories?: {
      performance?: { score: number };
      accessibility?: { score: number };
      'best-practices'?: { score: number };
      seo?: { score: number };
    };
    audits?: {
      'first-contentful-paint'?: { numericValue: number };
      'largest-contentful-paint'?: { numericValue: number };
      'total-blocking-time'?: { numericValue: number };
      'cumulative-layout-shift'?: { numericValue: number };
    };
  };
}

export async function fetchLighthouseScores(url: string): Promise<GeekflareLighthouseResult | null> {
  const ck = url.trim().toLowerCase();
  const cached = await cacheGet<GeekflareLighthouseResult | null>('lighthouse', ck);
  if (cached) return cached;
  try {
    const raw = await gfPost<LighthouseAPIResponse>('/lighthouse', {
      url,
      strategy: 'mobile',
      categories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });

    const cats = raw?.data?.categories;
    const audits = raw?.data?.audits;
    if (!cats) return null;

    const value = {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      best_practices: Math.round((cats['best-practices']?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
      first_contentful_paint_ms: Math.round(audits?.['first-contentful-paint']?.numericValue ?? 0),
      largest_contentful_paint_ms: Math.round(audits?.['largest-contentful-paint']?.numericValue ?? 0),
      total_blocking_time_ms: Math.round(audits?.['total-blocking-time']?.numericValue ?? 0),
      cumulative_layout_shift: audits?.['cumulative-layout-shift']?.numericValue ?? 0,
    };
    await cacheSet('lighthouse', ck, value, LIGHTHOUSE_CACHE_TTL);
    return value;
  } catch {
    return null;
  }
}

// ── 2. Loadtime ───────────────────────────────────────────────────────────────

interface LoadtimeAPIResponse {
  data?: {
    total?: number;
    ttfb?: number;
    dns?: number;
    connect?: number;
    download?: number;
    status?: number;
  };
}

export async function fetchLoadtime(url: string): Promise<GeekflareLoadtimeResult | null> {
  try {
    const raw = await gfPost<LoadtimeAPIResponse>('/loadtime', { url });
    const d = raw?.data;
    if (!d) return null;

    return {
      total_ms: Math.round(d.total ?? 0),
      ttfb_ms: Math.round(d.ttfb ?? 0),
      dns_ms: Math.round(d.dns ?? 0),
      connect_ms: Math.round(d.connect ?? 0),
      download_ms: Math.round(d.download ?? 0),
      http_status: d.status ?? 200,
    };
  } catch {
    return null;
  }
}

// ── 3. TLS Scan ───────────────────────────────────────────────────────────────

interface TLSAPIResponse {
  data?: {
    valid?: boolean;
    issuer?: string;
    subject?: string;
    validTo?: string;
    daysRemaining?: number;
    protocol?: string;
    cipher?: string;
  };
}

export async function fetchTLSScan(url: string): Promise<GeekflareTLSResult | null> {
  try {
    const raw = await gfPost<TLSAPIResponse>('/tlsscan', { url });
    const d = raw?.data;
    if (!d) return null;

    return {
      valid: d.valid ?? false,
      issuer: d.issuer ?? '',
      subject: d.subject ?? '',
      expires_at: d.validTo ?? '',
      days_remaining: d.daysRemaining ?? 0,
      protocol: d.protocol ?? '',
      cipher: d.cipher ?? '',
    };
  } catch {
    return null;
  }
}

// ── 4. Broken Link ────────────────────────────────────────────────────────────

interface BrokenLinkAPIResponse {
  data?: {
    dead?: Array<{ url: string }>;
    total?: number;
  };
}

export async function fetchBrokenLinks(url: string): Promise<GeekflareBrokenLinkResult | null> {
  try {
    const raw = await gfPost<BrokenLinkAPIResponse>('/brokenlink', { url });
    const d = raw?.data;
    if (!d) return null;

    const broken = d.dead ?? [];
    return {
      broken_count: broken.length,
      total_checked: d.total ?? 0,
      // keep only first 10 to avoid bloating the evidence payload
      broken_urls: broken.slice(0, 10).map(b => b.url),
    };
  } catch {
    return null;
  }
}

// ── Composite fetch (run all 4 in parallel) ───────────────────────────────────

export async function fetchGeekflareEnrichment(url: string): Promise<GeekflareEnrichment> {
  const [lhResult, ltResult, tlsResult, blResult] = await Promise.allSettled([
    fetchLighthouseScores(url),
    fetchLoadtime(url),
    fetchTLSScan(url),
    fetchBrokenLinks(url),
  ]);

  return {
    lighthouse: lhResult.status === 'fulfilled' ? (lhResult.value ?? undefined) : undefined,
    loadtime: ltResult.status === 'fulfilled' ? (ltResult.value ?? undefined) : undefined,
    tls: tlsResult.status === 'fulfilled' ? (tlsResult.value ?? undefined) : undefined,
    broken_links: blResult.status === 'fulfilled' ? (blResult.value ?? undefined) : undefined,
  };
}

// ── Search + Scrape primitives for RAG pipeline ─────────────────────────────

export type GeekflareScrapeFormat = 'markdown-llm' | 'text-llm' | 'html-llm';

export interface GeekflareSearchItem {
  url: string;
  title: string;
  description: string;
  rank: number;
  published_ms?: number;
}

export interface GeekflareScrapePayload {
  url: string;
  format: GeekflareScrapeFormat;
  content: string;
  title?: string;
  description?: string;
}

export interface LighthouseQualityGate {
  source_quality_score: number;  // 0-1
  structure_stability: number;   // 0-1
  scrape_reliability: number;    // 0-1
  seo_integrity: number;         // 0-1
  eligible: boolean;
}

async function gfPostFirst<T>(
  paths: string[],
  body: Record<string, unknown>,
): Promise<T> {
  let lastErr: unknown = null;
  for (const path of paths) {
    try {
      return await gfPost<T>(path, body);
    } catch (err) {
      lastErr = err;
    }
  }
  throw (lastErr ?? new Error('Geekflare request failed'));
}

function firstString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseSearchRows(raw: any): any[] {
  if (Array.isArray(raw?.data?.results)) return raw.data.results;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export async function searchGeekflare(query: string, limit = 20): Promise<GeekflareSearchItem[]> {
  const ck = `${query.trim().toLowerCase()}::${limit}`;
  const cached = await cacheGet<GeekflareSearchItem[]>('search', ck);
  if (cached && cached.length > 0) return cached;
  try {
    const raw = await gfPostFirst<any>(
      ['/search', '/v1/search', '/web/search'],
      {
        query,
        q: query,
        limit,
      },
    );

    const rows = parseSearchRows(raw);
    const value = rows.slice(0, limit).map((row: any, i: number): GeekflareSearchItem => {
      const url = firstString(row.url || row.link || row.href);
      const title = firstString(row.title || row.name || row.heading);
      const description = firstString(row.description || row.snippet || row.summary);
      const published = firstString(row.published_at || row.publishedAt || row.date || row.timestamp);
      return {
        url,
        title,
        description,
        rank: i + 1,
        published_ms: published ? Date.parse(published) : undefined,
      };
    }).filter((r: GeekflareSearchItem) => !!r.url);
    await cacheSet('search', ck, value, SEARCH_CACHE_TTL);
    return value;
  } catch {
    return [];
  }
}

function parseScrapeContent(raw: any): { content: string; title?: string; description?: string } {
  const data = raw?.data ?? raw;
  const content =
    firstString(data?.content) ||
    firstString(data?.text) ||
    firstString(data?.markdown) ||
    firstString(data?.html) ||
    firstString(raw?.content) ||
    firstString(raw?.text);

  const title = firstString(data?.title || raw?.title);
  const description = firstString(data?.description || data?.meta_description || raw?.description);

  return { content, title: title || undefined, description: description || undefined };
}

export async function scrapeGeekflare(
  url: string,
  format: GeekflareScrapeFormat,
): Promise<GeekflareScrapePayload | null> {
  const ck = `${url.trim().toLowerCase()}::${format}`;
  const cached = await cacheGet<GeekflareScrapePayload | null>('scrape', ck);
  if (cached && cached.content) return cached;
  try {
    const raw = await gfPostFirst<any>(
      ['/web-scraping', '/scrape', '/v1/scrape'],
      {
        url,
        format,
        js_rendering: true,
      },
    );
    const parsed = parseScrapeContent(raw);
    if (!parsed.content) return null;
    const value = {
      url,
      format,
      content: parsed.content,
      title: parsed.title,
      description: parsed.description,
    };
    await cacheSet('scrape', ck, value, SCRAPE_CACHE_TTL);
    return value;
  } catch {
    return null;
  }
}

export async function assessLighthouseQuality(url: string): Promise<LighthouseQualityGate> {
  const lh = await fetchLighthouseScores(url);
  if (!lh) {
    return {
      source_quality_score: 0.45,
      structure_stability: 0.45,
      scrape_reliability: 0.45,
      seo_integrity: 0.45,
      // If Lighthouse is unavailable, degrade gracefully and allow ingestion.
      eligible: true,
    };
  }

  const seo_integrity = lh.seo / 100;
  const structure_stability = Math.max(0, Math.min(1,
    (lh.accessibility * 0.5 + lh.best_practices * 0.5) / 100,
  ));
  const perfPenalty = lh.total_blocking_time_ms > 600 ? 0.15 : 0;
  const scrape_reliability = Math.max(0, Math.min(1,
    ((lh.performance / 100) * 0.7 + (lh.cumulative_layout_shift < 0.15 ? 0.3 : 0.15)) - perfPenalty,
  ));

  const source_quality_score = Math.max(0, Math.min(1,
    seo_integrity * 0.40 + structure_stability * 0.35 + scrape_reliability * 0.25,
  ));

  return {
    source_quality_score,
    structure_stability,
    scrape_reliability,
    seo_integrity,
    eligible: source_quality_score >= 0.42,
  };
}
