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

const BASE_URL = 'https://api.geekflare.com';
const TIMEOUT_MS = 15_000;

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
  try {
    const raw = await gfPost<LighthouseAPIResponse>('/lighthouse', {
      url,
      strategy: 'mobile',
      categories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });

    const cats = raw?.data?.categories;
    const audits = raw?.data?.audits;
    if (!cats) return null;

    return {
      performance:    Math.round((cats.performance?.score ?? 0) * 100),
      accessibility:  Math.round((cats.accessibility?.score ?? 0) * 100),
      best_practices: Math.round((cats['best-practices']?.score ?? 0) * 100),
      seo:            Math.round((cats.seo?.score ?? 0) * 100),
      first_contentful_paint_ms: Math.round(audits?.['first-contentful-paint']?.numericValue ?? 0),
      largest_contentful_paint_ms: Math.round(audits?.['largest-contentful-paint']?.numericValue ?? 0),
      total_blocking_time_ms: Math.round(audits?.['total-blocking-time']?.numericValue ?? 0),
      cumulative_layout_shift: audits?.['cumulative-layout-shift']?.numericValue ?? 0,
    };
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
      total_ms:    Math.round(d.total ?? 0),
      ttfb_ms:     Math.round(d.ttfb ?? 0),
      dns_ms:      Math.round(d.dns ?? 0),
      connect_ms:  Math.round(d.connect ?? 0),
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
      valid:         d.valid ?? false,
      issuer:        d.issuer ?? '',
      subject:       d.subject ?? '',
      expires_at:    d.validTo ?? '',
      days_remaining: d.daysRemaining ?? 0,
      protocol:      d.protocol ?? '',
      cipher:        d.cipher ?? '',
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
      broken_count:   broken.length,
      total_checked:  d.total ?? 0,
      // keep only first 10 to avoid bloating the evidence payload
      broken_urls:    broken.slice(0, 10).map(b => b.url),
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
    lighthouse:   lhResult.status  === 'fulfilled' ? (lhResult.value  ?? undefined) : undefined,
    loadtime:     ltResult.status  === 'fulfilled' ? (ltResult.value  ?? undefined) : undefined,
    tls:          tlsResult.status === 'fulfilled' ? (tlsResult.value ?? undefined) : undefined,
    broken_links: blResult.status  === 'fulfilled' ? (blResult.value  ?? undefined) : undefined,
  };
}
