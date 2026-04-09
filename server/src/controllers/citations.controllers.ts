import type { Request, Response } from 'express';
import { createHash } from 'crypto';
import { getPool } from '../services/postgresql.js';
import { sanitizeHtmlServer } from '../middleware/securityMiddleware.js';
import { generateQueries, prioritizeQueries } from '../services/queryGenerator.js';
import { testMultipleQueries, calculateCitationSummary, buildCitationPrompt } from '../services/citationTester.js';
import type { CitationTest, AICitationResult } from '../../../shared/types.js';
import {
  runNicheRanking,
  getNicheRankingById,
  getLatestNicheRanking,
  listNicheRankings,
} from '../services/citationRankingEngine.js';
import {
  createScheduledJob,
  listScheduledJobs,
  getScheduledJob,
  toggleScheduledJob,
  deleteScheduledJob,
  updateScheduledJobInterval,
} from '../services/citationScheduler.js';
import type {
  AuthorityCheckResponse,
  AuthorityCitationItem,
  AuthorityPlatform,
  CitationIdentityResponse,
  ContentNature,
} from '../../../shared/types.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';

/** Safe JSON.parse with fallback — prevents one corrupted record from crashing entire response */
function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

import { scrapeBingRaw } from '../services/webSearch.js';
import { hasDirectApi, searchPlatformDirect } from '../services/platformDirectSearch.js';
import { gateToolAction } from '../services/toolCreditGate.js';
import { checkCitationMilestones } from '../services/milestoneService.js';
import {
  getMentionTrendHistory,
  aggregateCompetitorShare,
  buildConsistencyMatrix,
  detectAndStoreDropAlert,
  checkAndStoreCoOccurrences,
  getStoredCoOccurrences,
  recordMentionTrendSnapshot,
  computeMentionQuality,
} from '../services/citationIntelligenceService.js';
import type {
  CitationMentionTrend,
  CitationCompetitorShareEntry,
  CitationDropAlert,
  CitationCoOccurrence,
  ConsistencyMatrixCell,
} from '../../../shared/types.js';

function getServerApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || null;
}

const CITATION_QUERY_LIMITS: Record<string, number> = {
  observer: 10,
  alignment: 100,
  signal: 200,
  scorefix: 400,
};

const ALL_CITATION_PLATFORMS = ['chatgpt', 'perplexity', 'claude', 'google_ai'] as const;
type CitationPlatformKey = (typeof ALL_CITATION_PLATFORMS)[number];

function normalizeAuditTargetKey(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.startsWith('upload://')) return raw.toLowerCase();

  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return normalized.toLowerCase();
  }
}

function shortenSiteTitle(input: string): string {
  const raw = String(input || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const [short] = raw.split(/\s[|\-–-•]\s|\| | - | – | - | • /).filter(Boolean);
  return String(short || raw).trim().slice(0, 80);
}

function extractDomainLabel(input: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const host = parsed.hostname.replace(/^www\./i, '').split('.')[0] || '';
    return host ? host.charAt(0).toUpperCase() + host.slice(1) : '';
  } catch {
    return '';
  }
}

async function findLatestAuditForTarget(userId: string, rawUrl: string) {
  const targetKey = normalizeAuditTargetKey(rawUrl);
  if (!targetKey) return null;

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT url, result, created_at
     FROM audits
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 250`,
    [userId]
  );

  return rows.find((row: any) => normalizeAuditTargetKey(String(row.url || '')) === targetKey) || null;
}

interface PageBrandSignals {
  title: string;
  ogSiteName: string;
  schemaOrgName: string;
}

async function fetchPageBrandSignals(targetUrl: string): Promise<PageBrandSignals> {
  const empty: PageBrandSignals = { title: '', ogSiteName: '', schemaOrgName: '' };
  try {
    const response = await fetchWithTimeout(targetUrl, 6000);
    if (!response.ok) return empty;
    const html = await response.text();

    const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();

    // og:site_name - attribute order may vary
    const ogSiteName = (
      html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1] ||
      ''
    ).trim();

    // JSON-LD Organization or WebSite name
    let schemaOrgName = '';
    const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of jsonLdMatches) {
      try {
        const parsed = JSON.parse(m[1].trim());
        const items: any[] = Array.isArray(parsed) ? parsed : parsed?.['@graph'] ? parsed['@graph'] : [parsed];
        for (const item of items) {
          if (typeof item?.name !== 'string') continue;
          if (item['@type'] === 'Organization') { schemaOrgName = item.name.trim(); break; }
          if (item['@type'] === 'WebSite' && !schemaOrgName) schemaOrgName = item.name.trim();
        }
        if (schemaOrgName) break;
      } catch {}
    }

    return { title, ogSiteName, schemaOrgName };
  } catch {
    return empty;
  }
}

/** True if a name looks like a short acronym/abbreviation rather than a full business name. */
function isShortAcronym(name: string): boolean {
  return name.length <= 12 && !name.includes(' ');
}

async function resolveCitationIdentity(userId: string, rawUrl: string): Promise<CitationIdentityResponse | null> {
  const normalized = normalizePublicHttpUrl(rawUrl);
  if (!normalized.ok) return null;

  const recentAudit = await findLatestAuditForTarget(userId, normalized.url);
  const audit = recentAudit?.result;
  const auditBrand = String(audit?.brand_entities?.[0] || '').trim();
  const auditTitle = String(audit?.domain_intelligence?.page_title || audit?.summary || '').replace(/\s+/g, ' ').trim();
  const derivedDomain = extractDomainLabel(normalized.url);

  // If the audit brand looks like a full name (has spaces, > 12 chars), trust it directly
  if (auditBrand && !isShortAcronym(auditBrand)) {
    return {
      normalized_url: normalized.url,
      business_name: auditBrand,
      business_name_source: 'audit_evidence',
      page_title: auditTitle || undefined,
      evidence_updated_at: recentAudit?.created_at ? new Date(recentAudit.created_at).toISOString() : undefined,
      evidence_url: recentAudit?.url ? String(recentAudit.url) : normalized.url,
      recent_audit_found: true,
    };
  }

  // Fetch live page signals for explicit brand metadata
  const live = await fetchPageBrandSignals(normalized.url);

  // Priority: schema.org org name > og:site_name > full page title > audit brand > domain
  let businessName = '';
  let businessNameSource: CitationIdentityResponse['business_name_source'] = 'domain';

  if (live.schemaOrgName) {
    businessName = live.schemaOrgName;
    businessNameSource = 'schema_org';
  } else if (live.ogSiteName) {
    businessName = live.ogSiteName;
    businessNameSource = 'og_site_name';
  } else if (auditTitle) {
    businessName = shortenSiteTitle(auditTitle);
    businessNameSource = 'page_title';
  } else if (live.title) {
    businessName = shortenSiteTitle(live.title);
    businessNameSource = 'page_title';
  } else if (auditBrand) {
    businessName = auditBrand;
    businessNameSource = 'audit_evidence';
  } else {
    businessName = derivedDomain;
    businessNameSource = 'domain';
  }

  return {
    normalized_url: normalized.url,
    business_name: businessName,
    business_name_source: businessNameSource,
    page_title: auditTitle || live.title || undefined,
    evidence_updated_at: recentAudit?.created_at ? new Date(recentAudit.created_at).toISOString() : undefined,
    evidence_url: recentAudit?.url ? String(recentAudit.url) : normalized.url,
    recent_audit_found: Boolean(recentAudit),
  };
}

function normalizeQueries(input: unknown, maxQueries: number): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  for (const raw of input) {
    const next = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!next) continue;
    if (next.length < 3 || next.length > 220) continue;
    unique.add(next);
    if (unique.size >= maxQueries) break;
  }
  return Array.from(unique);
}

const PLATFORM_DOMAINS: Record<AuthorityPlatform, string> = {
  reddit: 'reddit.com',
  linkedin: 'linkedin.com',
  substack: 'substack.com',
  medium: 'medium.com',
  github: 'github.com',
  stackoverflow: 'stackoverflow.com',
  wikipedia: 'wikipedia.org',
  youtube: 'youtube.com',
  g2: 'g2.com',
  trustpilot: 'trustpilot.com',
  crunchbase: 'crunchbase.com',
  producthunt: 'producthunt.com',
  techcrunch: 'techcrunch.com',
  blogger: 'blogger.com',
  facebook: 'facebook.com',
  devpost: 'devpost.com',
  hackernews: 'news.ycombinator.com',
  chrome_web_store: 'chrome.google.com/webstore',
};

const PLATFORM_BASE_AUTHORITY: Record<AuthorityPlatform, number> = {
  reddit: 75,
  linkedin: 80,
  substack: 70,
  medium: 72,
  github: 88,
  stackoverflow: 86,
  wikipedia: 92,
  youtube: 82,
  g2: 84,
  trustpilot: 80,
  crunchbase: 85,
  producthunt: 83,
  techcrunch: 87,
  blogger: 78,
  facebook: 76,
  devpost: 81,
  hackernews: 89,
  chrome_web_store: 86,
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractOfficialDomain(input: string): string | null {
  try {
    const normalized = input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
    return new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function isUrlLike(input: string): boolean {
  return /^https?:\/\//i.test(input) || /^www\./i.test(input) || /\.[a-z]{2,}(\/|$)/i.test(input);
}

function normalizeUrl(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const normalized = normalizePublicHttpUrl(input);
  return normalized.ok ? normalized.url : null;
}

function extractMetaContent(html: string, attr: 'name' | 'property', value: string): string {
  const regex = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const reverseRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value}["'][^>]*>`, 'i');
  const direct = html.match(regex)?.[1] || html.match(reverseRegex)?.[1] || '';
  return stripHtml(direct).trim();
}

function extractTagText(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const text = stripHtml(match[1] || '');
    if (text) values.push(text);
  }
  return values;
}

function deriveSearchPhrases(input: {
  target: string;
  domain?: string | null;
  html?: string;
}): { title: string; description: string; headline: string; phrases: string[]; quoteables: string[] } {
  const html = String(input.html || '');
  const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const description = extractMetaContent(html, 'name', 'description') || extractMetaContent(html, 'property', 'og:description');
  const headline = extractTagText(html, 'h1')[0] || '';
  const headings = [...extractTagText(html, 'h2'), ...extractTagText(html, 'h3')].slice(0, 6);
  const quoteables = [headline, ...headings]
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 18 && item.length <= 110)
    .slice(0, 4);

  const candidates = [input.target, title, headline, description, ...headings]
    .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((item) => item.replace(/[|•·–-]+/g, ' ').trim());

  const phrases: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const normalized = raw.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (raw.length < 3) continue;
    if (input.domain && normalized.includes(String(input.domain).toLowerCase())) {
      phrases.push(raw);
      continue;
    }
    if (raw.length <= 80) phrases.push(raw);
    if (phrases.length >= 6) break;
  }

  return {
    title,
    description,
    headline,
    phrases: phrases.slice(0, 6),
    quoteables,
  };
}

async function analyzeTargetTrustSignals(targetUrl: string | null) {
  if (!targetUrl) {
    return {
      security: undefined,
      phishingRisk: undefined,
      compliance: undefined,
      searchProfile: deriveSearchPhrases({ target: '' }),
      brandSignals: { title: '', ogSiteName: '', schemaOrgName: '', description: '', schemaDescription: '' },
    };
  }

  let response: globalThis.Response | null = null;
  let html = '';
  try {
    response = await fetchWithTimeout(targetUrl, 7000);
    if (response.ok) {
      html = await response.text();
    }
  } catch {
    response = null;
  }

  const urlObj = (() => {
    try {
      return new URL(targetUrl);
    } catch {
      return null;
    }
  })();

  const host = urlObj?.hostname || '';
  const lowerHtml = html.toLowerCase();

  const headerPresent = {
    hsts: Boolean(response?.headers.get('strict-transport-security')),
    csp: Boolean(response?.headers.get('content-security-policy')),
    x_content_type_options: Boolean(response?.headers.get('x-content-type-options')),
    x_frame_options: Boolean(response?.headers.get('x-frame-options')),
    referrer_policy: Boolean(response?.headers.get('referrer-policy')),
  };

  const missingHeaderCount = Object.values(headerPresent).filter((value) => !value).length;
  const hardeningScore = Math.max(0, Math.min(100, (urlObj?.protocol === 'https:' ? 20 : 0) + ((5 - missingHeaderCount) * 16)));

  const phishingReasons: string[] = [];
  if (/^xn--/i.test(host)) phishingReasons.push('Punycode domain detected');
  if ((host.match(/-/g) || []).length >= 3) phishingReasons.push('High-hyphen domain pattern');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) phishingReasons.push('Raw IP domain used');
  if (/(secure|verify|wallet|login|update|account)/i.test(host) && /(now|free|bonus|gift)/i.test(host)) {
    phishingReasons.push('Suspicious brandless credential lure pattern');
  }

  // Niche detection requires ≥2 distinct keyword hits to avoid false positives
  // (e.g. a single mention of "patient" shouldn't flag Healthcare)
  const nicheKeywords = {
    healthcare: ['hipaa', 'patient portal', 'medical record', 'clinic', 'healthcare', 'ehr', 'telemedicine', 'diagnosis'],
    finance: ['finra', 'sec filing', 'investment', 'trading platform', 'bank account', 'financial advisor', 'portfolio'],
    legal: ['attorney', 'law firm', 'legal advice', 'case law', 'jurisdiction', 'litigation'],
    ecommerce: ['add to cart', 'checkout', 'shipping policy', 'refund policy', 'return policy', 'payment method'],
  } as const;

  const NICHE_MIN_HITS = 2;
  let detectedNiche: 'healthcare' | 'finance' | 'legal' | 'ecommerce' | 'general' = 'general';
  let bestNicheHits = 0;
  for (const [niche, terms] of Object.entries(nicheKeywords) as Array<[typeof detectedNiche, readonly string[]]>) {
    const hits = terms.filter((term) => lowerHtml.includes(term)).length;
    if (hits >= NICHE_MIN_HITS && hits > bestNicheHits) {
      detectedNiche = niche;
      bestNicheHits = hits;
    }
  }

  const baseSignals = ['privacy policy', 'terms', 'contact'];
  const nicheRequiredSignals: Record<'general' | 'healthcare' | 'finance' | 'legal' | 'ecommerce', string[]> = {
    general: baseSignals,
    healthcare: [...baseSignals, 'hipaa', 'disclaimer'],
    finance: [...baseSignals, 'risk disclosure', 'disclaimer'],
    legal: [...baseSignals, 'disclaimer', 'jurisdiction'],
    ecommerce: [...baseSignals, 'refund policy', 'shipping'],
  };

  const requiredSignals = nicheRequiredSignals[detectedNiche];
  const presentSignals = requiredSignals.filter((signal) => lowerHtml.includes(signal));
  const missingSignals = requiredSignals.filter((signal) => !presentSignals.includes(signal));

  const phishingLevel: 'low' | 'medium' | 'high' = phishingReasons.length >= 3
    ? 'high'
    : phishingReasons.length >= 1
      ? 'medium'
      : 'low';

  return {
    security: {
      https: urlObj?.protocol === 'https:',
      hardening_score: hardeningScore,
      missing_header_count: missingHeaderCount,
    },
    phishingRisk: {
      level: phishingLevel,
      reasons: phishingReasons,
    },
    compliance: {
      detected_niche: detectedNiche,
      required_signals: requiredSignals,
      present_signals: presentSignals,
      missing_signals: missingSignals,
    },
    searchProfile: deriveSearchPhrases({
      target: targetUrl,
      domain: host.replace(/^www\./i, '').toLowerCase(),
      html,
    }),
    brandSignals: extractBrandSignalsFromHtml(html),
  };
}

function resolveResultUrl(rawHref: string): string {
  const cleaned = decodeHtmlEntities(rawHref);
  try {
    const withBase = cleaned.startsWith('http') ? cleaned : `https://duckduckgo.com${cleaned}`;
    const parsed = new URL(withBase);
    const redirect = parsed.searchParams.get('uddg');
    if (redirect) return decodeURIComponent(redirect);
    return withBase;
  } catch {
    return cleaned;
  }
}

// ── Brand signal extraction & multi-signal relevance filtering ────────

interface BrandSignals {
  title: string;
  ogSiteName: string;
  schemaOrgName: string;
  description: string;
  schemaDescription: string;
}

function extractBrandSignalsFromHtml(html: string): BrandSignals {
  const empty: BrandSignals = { title: '', ogSiteName: '', schemaOrgName: '', description: '', schemaDescription: '' };
  if (!html) return empty;
  const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const ogSiteName = (
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1] ||
    ''
  ).trim();
  const description = (
    extractMetaContent(html, 'name', 'description') ||
    extractMetaContent(html, 'property', 'og:description') ||
    ''
  );
  let schemaOrgName = '';
  let schemaDescription = '';
  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items: any[] = Array.isArray(parsed) ? parsed : parsed?.['@graph'] ? parsed['@graph'] : [parsed];
      for (const item of items) {
        if (typeof item?.name !== 'string') continue;
        if (item['@type'] === 'Organization') {
          schemaOrgName = item.name.trim();
          if (typeof item?.description === 'string') schemaDescription = item.description.trim();
          break;
        }
        if (item['@type'] === 'WebSite' && !schemaOrgName) {
          schemaOrgName = item.name.trim();
          if (typeof item?.description === 'string' && !schemaDescription) schemaDescription = item.description.trim();
        }
      }
      if (schemaOrgName) break;
    } catch { /* malformed JSON-LD */ }
  }
  return { title, ogSiteName, schemaOrgName, description, schemaDescription };
}

interface BrandContext {
  /** Primary brand name as it appears on the site (e.g. "AiVIS") */
  primaryName: string;
  /** Domain of the brand's website (e.g. "aivis.biz") */
  domain: string | null;
  /** Domain label without TLD (e.g. "aivis") */
  domainLabel: string | null;
  /** All valid name forms: exact, uppercase, full expansion, title segments */
  nameVariants: string[];
  /** Niche/context keywords extracted from title, description, schema - what the brand DOES */
  nicheKeywords: string[];
  /** Whether the brand name requires strict (case-sensitive) matching */
  strictMatch: boolean;
}

function buildBrandContext(
  target: string,
  mode: 'url' | 'entity',
  domain: string | null,
  brandSignals: BrandSignals,
  searchProfile?: { title: string; description: string; headline: string },
): BrandContext {
  // ─── Derive primary brand name ───────────────────────────────────────
  let primaryName = target.trim();
  if (mode === 'url' && domain) {
    primaryName = brandSignals.schemaOrgName || brandSignals.ogSiteName || '';
    if (!primaryName) {
      const titleBrand = brandSignals.title.split(/[\-|–·•:]/)[0].trim();
      if (titleBrand && titleBrand.length >= 2 && titleBrand.length < 50) {
        primaryName = titleBrand;
      } else {
        primaryName = domain.split('.')[0];
      }
    }
  }

  const domainLabel = domain ? domain.split('.')[0].toLowerCase() : null;

  // ─── Strict matching for short or mixed-case brand names ─────────────
  const hasMixedCase = /[a-z][A-Z]/.test(primaryName) ||
    (/[A-Z]{2,}/.test(primaryName) && /[a-z]/.test(primaryName));
  const isShort = primaryName.length <= 12 && !primaryName.includes(' ');
  const strictMatch = hasMixedCase || (isShort && /[A-Z]/.test(primaryName));

  // ─── Build all valid name variants ───────────────────────────────────
  const nameVariants: string[] = [];
  nameVariants.push(primaryName);               // exact: "AiVIS"
  nameVariants.push(primaryName.toUpperCase());  // ALLCAPS: "AIVIS"
  if (domain) nameVariants.push(domain);         // domain: "aivis.biz"
  if (brandSignals.schemaOrgName && brandSignals.schemaOrgName !== primaryName) {
    nameVariants.push(brandSignals.schemaOrgName);
  }
  if (brandSignals.ogSiteName && brandSignals.ogSiteName !== primaryName) {
    nameVariants.push(brandSignals.ogSiteName);
  }
  // Title segments (e.g. "AI Visibility Intelligence Platform" from "AiVIS - AI Visibility Intelligence Platform")
  if (brandSignals.title) {
    const parts = brandSignals.title.split(/[\-|–·•:]/).map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.length >= 10 && part.length <= 80) nameVariants.push(part);
    }
  }

  // ─── Extract niche/context keywords that describe what the brand DOES ─
  // These are used to verify that a result is about the RIGHT entity, not
  // just any entity with the same name.
  const nicheKeywords: string[] = [];
  const nicheSource = [
    brandSignals.description,
    brandSignals.schemaDescription,
    brandSignals.title,
    searchProfile?.description || '',
    searchProfile?.headline || '',
  ].join(' ').toLowerCase();

  // Extract meaningful 2+ char words, skip stop words and the brand name itself
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are',
    'has', 'have', 'will', 'can', 'not', 'all', 'its', 'our', 'was', 'were',
    'been', 'being', 'how', 'what', 'which', 'who', 'when', 'where', 'why',
    'get', 'got', 'more', 'most', 'also', 'just', 'than', 'into', 'about',
    'over', 'out', 'one', 'two', 'new', 'now', 'way', 'may', 'let', 'but',
  ]);
  const brandLower = primaryName.toLowerCase();
  const domainLower = domainLabel || '';
  const wordRegex = /[a-z]{3,}/gi;
  let wm: RegExpExecArray | null;
  const kwSeen = new Set<string>();
  while ((wm = wordRegex.exec(nicheSource)) !== null) {
    const w = wm[0].toLowerCase();
    if (stopWords.has(w) || w === brandLower || w === domainLower || kwSeen.has(w)) continue;
    kwSeen.add(w);
    nicheKeywords.push(w);
  }
  // Also extract multi-word phrases (2-3 word combinations)
  const phraseRegex = /\b([a-z]{3,}\s+[a-z]{3,}(?:\s+[a-z]{3,})?)\b/gi;
  let pm: RegExpExecArray | null;
  while ((pm = phraseRegex.exec(nicheSource)) !== null) {
    const phrase = pm[1].toLowerCase().trim();
    if (phrase.length >= 6 && !kwSeen.has(phrase)) {
      kwSeen.add(phrase);
      nicheKeywords.push(phrase);
    }
  }

  return {
    primaryName,
    domain,
    domainLabel,
    nameVariants: [...new Set(nameVariants.filter(Boolean))],
    nicheKeywords: nicheKeywords.slice(0, 40),
    strictMatch,
  };
}

/**
 * Multi-signal relevance scoring for authority check results.
 *
 * Each result is scored across 5 dimensions:
 *   - Domain match (URL contains the brand's domain)
 *   - Exact name match (case-sensitive brand name in text)
 *   - Name variant match (ALLCAPS, full expansion, schema name)
 *   - Niche keyword overlap (does the result context match what the brand does?)
 *   - URL path context (does the URL path suggest a company/product page vs personal profile?)
 *
 * A result needs to clear a minimum combined score to be accepted.
 */
const BRAND_RELEVANCE_THRESHOLD = 3;

function scoreBrandRelevance(
  result: { title: string; snippet: string; href: string },
  ctx: BrandContext,
): number {
  const blob = `${result.title} ${result.snippet}`;
  const blobLower = blob.toLowerCase();
  const hrefLower = result.href.toLowerCase();
  let score = 0;

  // ─── Signal 1: Domain in URL or text (strong - confirms identity) ──
  if (ctx.domain) {
    if (hrefLower.includes(ctx.domain)) score += 5;
    else if (blobLower.includes(ctx.domain)) score += 4;
  }

  // ─── Signal 2: Exact primary name (case-sensitive) ─────────────────
  if (blob.includes(ctx.primaryName)) score += 3;
  // ─── Signal 2b: Case-insensitive primary name match (weaker) ───────
  // Catches "aivis" when brand is "AiVIS" — common in user-generated content
  else if (ctx.primaryName.length >= 3 && blobLower.includes(ctx.primaryName.toLowerCase())) score += 2;

  // ─── Signal 3: Name variant match ─────────────────────────────────
  for (const variant of ctx.nameVariants) {
    if (variant === ctx.primaryName) continue; // already checked above
    if (variant.length > 15) {
      // Long variants (full name expansions): case-insensitive is safe
      if (blobLower.includes(variant.toLowerCase())) { score += 3; break; }
    } else {
      // Short variants: try case-sensitive first, fall back to case-insensitive
      if (blob.includes(variant)) {
        const isAllCapsOnly = ctx.strictMatch && variant === ctx.primaryName.toUpperCase();
        score += isAllCapsOnly ? 1 : 2;
        break;
      }
      // Case-insensitive fallback for short variants (weaker signal)
      if (blobLower.includes(variant.toLowerCase())) {
        score += 1;
        break;
      }
    }
  }

  // ─── Signal 4: URL path context ────────────────────────────────────
  // Company/product pages vs personal profiles
  try {
    const urlPath = new URL(result.href).pathname.toLowerCase();
    // Brand name in URL path (e.g. /r/aivis/, /repos/aivis/, /posts/aivis-review)
    if (ctx.domainLabel && urlPath.includes(ctx.domainLabel)) score += 2;
    // Positive: company pages, products, apps
    if (/\/(company|organization|product|app|software|tool|startup)\//i.test(urlPath)) score += 1;
    // Negative: personal profile patterns (people/in/users followed by a name)
    if (/^\/(in|people|user|users|profile)\//i.test(urlPath)) {
      // Only penalize if the domain label isn't in the URL path
      if (!ctx.domainLabel || !urlPath.includes(ctx.domainLabel)) score -= 1;
    }
  } catch { /* invalid URL, skip */ }

  // ─── Signal 5: Niche keyword overlap ───────────────────────────────
  // If the result mentions terms related to what the brand actually does,
  // it's more likely about the right entity - critical for disambiguation.
  if (ctx.nicheKeywords.length > 0) {
    let nicheHits = 0;
    for (const kw of ctx.nicheKeywords) {
      if (blobLower.includes(kw)) nicheHits++;
      if (nicheHits >= 4) break;
    }
    if (nicheHits >= 3) score += 3;
    else if (nicheHits >= 2) score += 2;
    else if (nicheHits >= 1) score += 1;
  }

  // ─── Signal 6: Person-name heuristic (negative) ────────────────────
  // If a result title looks like "Firstname Lastname - Platform", it's
  // likely a personal profile, not a product mention.
  const personProfilePattern = /^#?\d*\s*[A-Z][a-zāčēģīķļņšūž]+\s+[A-Z][a-zāčēģīķļņšūž]+\s*[-–-]\s*(Facebook|LinkedIn|Twitter|Instagram)/i;
  if (personProfilePattern.test(result.title.trim())) score -= 2;

  return score;
}

function isBrandRelevantResult(
  result: { title: string; snippet: string; href: string },
  ctx: BrandContext,
): boolean {
  const score = scoreBrandRelevance(result, ctx);
  // Results on the brand's own domain need minimal proof
  const isOnOwnDomain = ctx.domain ? result.href.toLowerCase().includes(ctx.domain) : false;
  if (isOnOwnDomain) return score >= 2;

  // When brand has niche context, require at least 1 niche keyword hit for
  // off-domain results — prevents false positives from unrelated entities
  // that share a similar name (e.g. "AiVIS" visibility vs "Aivis" voice software)
  if (ctx.nicheKeywords.length >= 3) {
    const blob = `${result.title} ${result.snippet}`.toLowerCase();
    const nicheHits = ctx.nicheKeywords.filter(kw => blob.includes(kw)).length;
    // Domain match in URL gives a pass even without niche hits
    const hasDomainInUrl = ctx.domain ? result.href.toLowerCase().includes(ctx.domain) : false;
    if (nicheHits === 0 && !hasDomainInUrl) {
      // No niche overlap and no domain proof → very likely wrong entity
      return false;
    }
  }

  // Third-party sites with ambiguous/short brand names need stronger evidence:
  // name-letter matching alone isn't enough - need niche context or domain proof
  const threshold = ctx.strictMatch ? 4 : BRAND_RELEVANCE_THRESHOLD;
  return score >= threshold;
}

function classifyContentNature(text: string): { nature: ContentNature; confidence: number } {
  const lower = text.toLowerCase();
  const spamSignals = [
    'guaranteed', '100%', 'bot traffic', 'blackhat', 'click here', 'dm now', 'scam', 'fake review', 'buy followers',
  ];
  const promoSignals = [
    'buy now', 'limited time', 'promo code', 'discount', 'sign up', 'affiliate', 'free trial', 'sales', 'book a demo',
  ];
  const organicSignals = [
    'how do i', 'anyone else', 'struggling', 'problem', 'issue', 'need help', 'worked for me', 'solution', 'recommend', 'pain point',
  ];

  const spamScore = spamSignals.reduce((sum, signal) => sum + (lower.includes(signal) ? 1 : 0), 0);
  const promoScore = promoSignals.reduce((sum, signal) => sum + (lower.includes(signal) ? 1 : 0), 0);
  const organicScore = organicSignals.reduce((sum, signal) => sum + (lower.includes(signal) ? 1 : 0), 0);

  const topScore = Math.max(spamScore, promoScore, organicScore);
  if (topScore <= 0) return { nature: 'neutral', confidence: 0.35 };
  const confidence = Math.min(0.95, 0.45 + topScore * 0.18);

  if (spamScore >= promoScore && spamScore >= organicScore) return { nature: 'spammy', confidence };
  if (promoScore >= spamScore && promoScore >= organicScore) return { nature: 'direct_promo', confidence };
  return { nature: 'organic_pain_solution', confidence };
}

function scoreAuthority(platform: AuthorityPlatform, rank: number, snippet: string, title: string): number {
  const base = PLATFORM_BASE_AUTHORITY[platform];
  const rankBoost = Math.max(0, 22 - rank * 3);
  const hintText = `${title} ${snippet}`.toLowerCase();
  const engagementHints = ['comments', 'discussion', 'case study', 'analysis', 'community', 'thread'];
  const hintBoost = engagementHints.reduce((sum, hint) => sum + (hintText.includes(hint) ? 1 : 0), 0) * 2;
  return Math.max(0, Math.min(100, base + rankBoost + hintBoost));
}

function parseDuckDuckGoResults(html: string): Array<{ title: string; snippet: string; href: string }> {
  // DDG HTML lite page uses class="result__a" for result links.
  // Also try obfuscated class names DDG sometimes uses, and broader result-block patterns.
  const scopedAnchorRegex = /<a[^>]*class="[^"]*(?:result__a|eVNpHGjtxRBq_gLOfGDr)[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const resultBlockRegex = /<div[^>]*class="[^"]*(?:result__|links_main|web-result)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const genericAnchorRegex = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<(?:a|div|span|p)[^>]*class="[^"]*(?:result__snippet|result-snippet)[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span|p)>/gi;

  const anchors: Array<{ href: string; title: string }> = [];
  const snippets: string[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;

  // Pass 1: scoped DDG result anchors
  while ((match = scopedAnchorRegex.exec(html)) !== null) {
    const href = resolveResultUrl(match[1]);
    const title = stripHtml(match[2]);
    if (!href || !title || seen.has(href)) continue;
    seen.add(href);
    anchors.push({ href, title });
  }

  // Pass 2: result-block patterns (broader catch)
  if (anchors.length === 0) {
    while ((match = resultBlockRegex.exec(html)) !== null) {
      const href = resolveResultUrl(match[1]);
      const title = stripHtml(match[2]);
      if (!href || !title || seen.has(href)) continue;
      if (!/^https?:\/\//i.test(href)) continue;
      if (href.includes('duckduckgo.com')) continue;
      seen.add(href);
      anchors.push({ href, title });
      if (anchors.length >= 15) break;
    }
  }

  // Collect snippets
  while ((match = snippetRegex.exec(html)) !== null) {
    const snippet = stripHtml(match[1] || '');
    if (snippet) snippets.push(snippet);
  }

  // Pass 3: generic anchor fallback
  if (anchors.length === 0) {
    while ((match = genericAnchorRegex.exec(html)) !== null) {
      const href = resolveResultUrl(match[1]);
      const title = stripHtml(match[2]);
      if (!href || !title || seen.has(href)) continue;
      if (!/^https?:\/\//i.test(href)) continue;
      if (href.includes('duckduckgo.com') || href.includes('/y.js') || href.includes('/about')) continue;
      seen.add(href);
      anchors.push({ href, title });
      if (anchors.length >= 15) break;
    }
  }

  return anchors.slice(0, 10).map((a, index) => ({
    title: a.title,
    snippet: snippets[index] || '',
    href: a.href,
  }));
}

const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

function pickUserAgent(): string {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': pickUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// POST /api/citations/authority-check - Paid-tier granular authority/citation/backlink check
export async function authorityGranularCheck(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { target, officialUrl, platforms: requestedPlatforms } = req.body || {};
    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'target is required (URL or org/app name)' });
    }

    const trimmedTarget = target.trim();
    const mode: 'url' | 'entity' = isUrlLike(trimmedTarget) ? 'url' : 'entity';

    let inspectTargetUrl: string | null = null;
    if (mode === 'url') {
      const normalizedTarget = normalizePublicHttpUrl(trimmedTarget);
      if (!normalizedTarget.ok) {
        return res.status(400).json({ error: normalizedTarget.error, code: 'INVALID_TARGET_URL' });
      }
      inspectTargetUrl = normalizedTarget.url;
    } else if (officialUrl) {
      const normalizedOfficial = normalizePublicHttpUrl(String(officialUrl));
      if (!normalizedOfficial.ok) {
        return res.status(400).json({ error: normalizedOfficial.error, code: 'INVALID_OFFICIAL_URL' });
      }
      inspectTargetUrl = normalizedOfficial.url;
    }

    const officialDomain = extractOfficialDomain(inspectTargetUrl || '');
    const targetDomain = mode === 'url' ? extractOfficialDomain(inspectTargetUrl || trimmedTarget) : officialDomain;

    const normalizedRequestedPlatforms = Array.isArray(requestedPlatforms)
      ? requestedPlatforms
          .map((item) => String(item || '').trim().toLowerCase())
          .filter((item): item is AuthorityPlatform => (Object.keys(PLATFORM_DOMAINS) as AuthorityPlatform[]).includes(item as AuthorityPlatform))
      : [];

    const platforms = normalizedRequestedPlatforms.length > 0
      ? normalizedRequestedPlatforms
      : (Object.keys(PLATFORM_DOMAINS) as AuthorityPlatform[]);

    // ── Cache lookup (valid for 6 hours) ────────────────────────────────
    const AUTHORITY_CACHE_TTL_HOURS = 6;
    const cacheKey = createHash('sha256')
      .update(`${trimmedTarget.toLowerCase()}|${platforms.sort().join(',')}`)
      .digest('hex');

    try {
      const pool = getPool();
      const cached = await pool.query(
        `SELECT result FROM authority_check_cache
         WHERE user_id = $1 AND cache_key = $2 AND created_at > NOW() - make_interval(hours => $3)
         ORDER BY created_at DESC LIMIT 1`,
        [userId, cacheKey, AUTHORITY_CACHE_TTL_HOURS]
      );
      if (cached.rows.length > 0) {
        console.log(`[AuthorityCheck] Cache hit for target="${trimmedTarget.slice(0, 40)}" user=${userId}`);
        return res.json({ success: true, report: cached.rows[0].result, cached: true });
      }
    } catch (cacheErr: any) {
      console.warn('[AuthorityCheck] Cache lookup failed, proceeding with live check:', cacheErr?.message);
    }

    const trustSignals = await analyzeTargetTrustSignals(inspectTargetUrl);
    const searchProfile = trustSignals.searchProfile || deriveSearchPhrases({ target: trimmedTarget, domain: targetDomain || undefined });
    const brandCtx = buildBrandContext(trimmedTarget, mode, targetDomain, trustSignals.brandSignals, searchProfile);
    console.log(`[AuthorityCheck] Brand context: primary="${brandCtx.primaryName}" domain=${brandCtx.domain} strict=${brandCtx.strictMatch} variants=${brandCtx.nameVariants.length} nicheKW=${brandCtx.nicheKeywords.length}`);

    type PlatformSummary = {
      platform: AuthorityPlatform;
      authority_score: number;
      citation_count: number;
      backlink_count: number;
      content_breakdown: Record<ContentNature, number>;
      items: AuthorityCitationItem[];
    };

    const platformSummaries = await (async () => {
      const BATCH_SIZE = 3;
      const BATCH_DELAY_MS = 800;
      const results: PlatformSummary[] = [];

      for (let batchStart = 0; batchStart < platforms.length; batchStart += BATCH_SIZE) {
        if (batchStart > 0) await sleep(BATCH_DELAY_MS);
        const batch = platforms.slice(batchStart, batchStart + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (platform) => {
            const domain = PLATFORM_DOMAINS[platform];
            // Build probe queries — include niche context keywords for disambiguation
            // so that a brand like "AiVIS" (AI visibility) doesn't match unrelated
            // projects like "AivisSpeech" (AI voice).
            const topNicheKw = brandCtx.nicheKeywords.slice(0, 2).join(' ');
            const primaryTerm = mode === 'url' ? (targetDomain || trimmedTarget) : trimmedTarget;
            const probeQueries = Array.from(new Set([
              // Primary: brand + niche context for disambiguation
              topNicheKw ? `site:${domain} "${primaryTerm}" ${topNicheKw}` : `site:${domain} "${primaryTerm}"`,
              // Fallback: brand only (no niche context)
              `site:${domain} "${primaryTerm}"`,
              ...searchProfile.phrases.slice(0, 3).map((phrase) => `site:${domain} "${phrase}"`),
              ...searchProfile.quoteables.slice(0, 2).map((phrase) => `site:${domain} "${phrase}"`),
            ].filter(Boolean)));

            const parsedRows: Array<{ title: string; snippet: string; href: string }> = [];
            const seenHref = new Set<string>();

            // ── Direct API path for platforms that expose free JSON endpoints ──
            if (hasDirectApi(platform)) {
              try {
                // Search by domain first, then by brand name if different
                const directQueries = [targetDomain || trimmedTarget];
                if (brandCtx.primaryName && brandCtx.primaryName.toLowerCase() !== (targetDomain || '').toLowerCase()) {
                  directQueries.push(brandCtx.primaryName);
                }
                for (const directQuery of directQueries) {
                  const directRows = await searchPlatformDirect(platform, directQuery, 10);
                  for (const row of directRows) {
                    if (!row.href || seenHref.has(row.href)) continue;
                    seenHref.add(row.href);
                    parsedRows.push(row);
                  }
                  if (parsedRows.length >= 5) break;
                }
                console.log(`[AuthorityCheck] platform=${platform} direct API found ${parsedRows.length} results`);
              } catch (directErr: any) {
                console.warn(`[AuthorityCheck] direct API failed for platform=${platform}: ${directErr?.message}`);
              }
            }

            // ── DDG + Bing scrape path for platforms without a direct API ──
            if (parsedRows.length === 0) {
              // Strategy: run DDG and Bing in parallel with the primary site: probe.
              // If both return nothing, try additional probe queries sequentially.
              // Final fallback: branded non-site: query filtered to platform domain.
              const primaryProbe = probeQueries[0];

              const [ddgParsed, bingParsed] = await Promise.all([
                (async () => {
                  try {
                    const ddgSearchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(primaryProbe)}`;
                    const response = await fetchWithTimeout(ddgSearchUrl, 8000);
                    if (!response.ok) {
                      console.warn(`[AuthorityCheck] DDG returned ${response.status} for platform=${platform}`);
                      return [];
                    }
                    return parseDuckDuckGoResults(await response.text());
                  } catch (err: any) {
                    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'unknown');
                    console.warn(`[AuthorityCheck] DDG fetch failed for platform=${platform}: ${reason}`);
                    return [];
                  }
                })(),
                (async () => {
                  try {
                    return await scrapeBingRaw(primaryProbe, 10);
                  } catch (bingErr: any) {
                    console.warn(`[AuthorityCheck] Bing failed for platform=${platform}: ${bingErr?.message}`);
                    return [];
                  }
                })(),
              ]);

              for (const row of [...ddgParsed, ...bingParsed]) {
                if (!row.href || seenHref.has(row.href)) continue;
                seenHref.add(row.href);
                parsedRows.push(row);
              }

              // Try additional site: probes if primary returned nothing
              if (parsedRows.length === 0 && probeQueries.length > 1) {
                for (const altProbe of probeQueries.slice(1, 3)) {
                  try {
                    const altResults = await scrapeBingRaw(altProbe, 10);
                    for (const row of altResults) {
                      if (!row.href || seenHref.has(row.href)) continue;
                      seenHref.add(row.href);
                      parsedRows.push(row);
                    }
                    if (parsedRows.length > 0) break;
                  } catch { /* skip */ }
                }
              }

              // Final fallback: branded query WITHOUT site: operator, then filter to domain
              if (parsedRows.length === 0) {
                const brandQueries = [
                  `"${targetDomain || trimmedTarget}" ${domain}`,
                  ...(brandCtx.primaryName && brandCtx.primaryName.toLowerCase() !== (targetDomain || '').toLowerCase()
                    ? [`"${brandCtx.primaryName}" ${domain}`]
                    : []),
                ];
                for (const brandedQuery of brandQueries) {
                  try {
                    const brandedResults = await scrapeBingRaw(brandedQuery, 15);
                    const platformHost = domain.replace(/^www\./, '').toLowerCase();
                    for (const row of brandedResults) {
                      if (!row.href || seenHref.has(row.href)) continue;
                      try {
                        const resultHost = new URL(row.href).hostname.replace(/^www\./, '').toLowerCase();
                        if (!resultHost.includes(platformHost) && !platformHost.includes(resultHost)) continue;
                      } catch { continue; }
                      seenHref.add(row.href);
                      parsedRows.push(row);
                    }
                    if (parsedRows.length > 0) {
                      console.log(`[AuthorityCheck] Branded fallback for platform=${platform} found ${parsedRows.length} results`);
                      break;
                    }
                  } catch { /* skip */ }
                }
              }
            }

            // ── Google News RSS universal fallback (covers all 18 platforms) ──
            if (parsedRows.length === 0) {
              const rssQueries = [
                `site:${domain} ${targetDomain || trimmedTarget}`,
                ...(brandCtx.primaryName && brandCtx.primaryName.toLowerCase() !== (targetDomain || '').toLowerCase()
                  ? [`site:${domain} ${brandCtx.primaryName}`]
                  : []),
              ];
              for (const rssQuery of rssQueries) {
              try {
                const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(rssQuery)}&hl=en-US&gl=US&ceid=US:en`;
                const rssResp = await fetchWithTimeout(rssUrl, 8000);
                if (rssResp.ok) {
                  const xml = await rssResp.text();
                  const rssBlockRegex = /<item>([\s\S]*?)<\/item>/gi;
                  let rssBlock: RegExpExecArray | null;
                  const platformHost = domain.replace(/^www\./, '').toLowerCase();
                  while ((rssBlock = rssBlockRegex.exec(xml)) !== null) {
                    const block = rssBlock[1];
                    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
                    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
                    // Try to extract actual article URL from description <a href="">
                    const descHrefMatch = block.match(/<description>[\s\S]*?href="(https?:\/\/[^"]+)"/i);

                    const rssTitle = titleMatch?.[1]?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || '';
                    const rawLink = linkMatch?.[1]?.trim() || '';

                    // Prefer real platform URL from description over Google News redirect
                    let rssHref = rawLink;
                    if (descHrefMatch?.[1]) {
                      try {
                        const descHost = new URL(descHrefMatch[1]).hostname.replace(/^www\./, '').toLowerCase();
                        if (descHost.includes(platformHost) || platformHost.includes(descHost)) {
                          rssHref = descHrefMatch[1];
                        }
                      } catch { /* keep rawLink */ }
                    }

                    if (!rssTitle || !rssHref || seenHref.has(rssHref)) continue;
                    seenHref.add(rssHref);
                    parsedRows.push({ title: rssTitle, snippet: '', href: rssHref });
                  }
                  if (parsedRows.length > 0) {
                    console.log(`[AuthorityCheck] Google News RSS fallback for platform=${platform} found ${parsedRows.length} results`);
                  }
                }
              } catch { /* skip */ }
              if (parsedRows.length > 0) break;
              }
            }

            // ── Filter results for brand relevance ──────────────────────
            const relevantRows = parsedRows.filter(row => {
              const accepted = isBrandRelevantResult(row, brandCtx);
              if (!accepted) {
                const s = scoreBrandRelevance(row, brandCtx);
                console.log(`[AuthorityCheck] REJECTED platform=${platform} score=${s} title="${row.title.slice(0, 60)}" url=${row.href.slice(0, 80)}`);
              }
              return accepted;
            });
            if (relevantRows.length < parsedRows.length) {
              console.log(`[AuthorityCheck] platform=${platform} filtered ${parsedRows.length} -> ${relevantRows.length} relevant results`);
            } else {
              console.log(`[AuthorityCheck] platform=${platform} found ${relevantRows.length} results (all relevant)`);
            }

            const items: AuthorityCitationItem[] = [];
            for (let index = 0; index < relevantRows.length; index++) {
              const row = relevantRows[index];
              const blob = `${row.title} ${row.snippet}`;
              const { nature, confidence } = classifyContentNature(blob);
              const authorityScore = scoreAuthority(platform, index + 1, row.snippet, row.title);

              const backlinkFound = !!targetDomain && (
                row.href.toLowerCase().includes(targetDomain) ||
                row.snippet.toLowerCase().includes(targetDomain) ||
                row.title.toLowerCase().includes(targetDomain)
              );

              items.push({
                platform,
                rank: index + 1,
                title: row.title,
                snippet: row.snippet,
                source_url: row.href,
                backlink_found: backlinkFound,
                authority_score: authorityScore,
                content_nature: nature,
                confidence: Number(confidence.toFixed(2)),
              });
            }

            const contentBreakdown: Record<ContentNature, number> = {
              spammy: 0,
              direct_promo: 0,
              organic_pain_solution: 0,
              neutral: 0,
            };
            items.forEach((item) => {
              contentBreakdown[item.content_nature] += 1;
            });

            const authorityScore = items.length
              ? Math.round(items.reduce((sum, item) => sum + item.authority_score, 0) / items.length)
              : 0;

            return {
              platform,
              authority_score: authorityScore,
              citation_count: items.length,
              backlink_count: items.filter((item) => item.backlink_found).length,
              content_breakdown: contentBreakdown,
              items,
            };
          })
        );

        results.push(...batchResults);
      }

      return results;
    })();

    const allItems = platformSummaries.flatMap((p) => p.items);
    const overall = {
      authority_index: platformSummaries.length
        ? Math.round(platformSummaries.reduce((sum, p) => sum + p.authority_score, 0) / platformSummaries.length)
        : 0,
      total_citations: allItems.length,
      total_backlinks: allItems.filter((item) => item.backlink_found).length,
      spammy_count: allItems.filter((item) => item.content_nature === 'spammy').length,
      direct_promo_count: allItems.filter((item) => item.content_nature === 'direct_promo').length,
      organic_pain_solution_count: allItems.filter((item) => item.content_nature === 'organic_pain_solution').length,
    };

    const payload: AuthorityCheckResponse = {
      target: trimmedTarget,
      mode,
      official_domain: targetDomain || undefined,
      checked_at: new Date().toISOString(),
      platforms: platformSummaries,
      overall,
      audit: {
        policy: 'brag-style-citation-granular-v1',
        citation_density: Number(((overall.total_citations || 0) / Math.max(1, platforms.length)).toFixed(2)),
        refusal: overall.total_citations === 0,
        refusal_reason: overall.total_citations === 0 ? 'insufficient_evidence' : undefined,
        notes: [
          'Only externally discoverable evidence is scored.',
          'Search probes include direct entity/domain checks plus live product, service, and quotable-phrase lenses from the audited page.',
          'Each item is classified as spammy, direct promo, organic pain/solution, or neutral.',
          'Backlink signals are heuristic and should be confirmed manually for legal/compliance workflows.',
        ],
      },
      security: trustSignals.security,
      phishing_risk: trustSignals.phishingRisk,
      compliance: trustSignals.compliance,
    };

    // ── Cache write (fire-and-forget) ────────────────────────────────────
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO authority_check_cache (user_id, cache_key, result) VALUES ($1, $2, $3)`,
        [userId, cacheKey, JSON.stringify(payload)]
      );
    } catch (cacheWriteErr: any) {
      console.warn('[AuthorityCheck] Cache write failed:', cacheWriteErr?.message);
    }

    return res.json({ success: true, report: payload });
  } catch (err: any) {
    console.error('[Citations] Authority granular check error:', err);
    return res.status(500).json({ error: 'Failed to run authority granular check' });
  }
}

// POST /api/citations/generate-queries - Generate test queries for a URL
export async function generateTestQueries(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { url, count = 50 } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const apiKey = getServerApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'AI provider key not configured' });
    }

    const identity = await resolveCitationIdentity(userId, String(url));
    if (!identity) {
      return res.status(400).json({ error: 'URL is invalid or cannot be normalized' });
    }

    const auditRecord = await findLatestAuditForTarget(userId, identity.normalized_url);
    const audit = auditRecord?.result;
    const content = {
      title: audit?.domain_intelligence?.page_title || '',
      description: audit?.domain_intelligence?.page_description || '',
      keywords: audit?.topical_keywords || [],
      topics: audit?.primary_topics || audit?.domain_intelligence?.primary_topics || [],
      brandName: identity.business_name || extractDomainLabel(identity.normalized_url),
      entities: Array.isArray(audit?.brand_entities) ? audit.brand_entities : [],
      contentHighlights: Array.isArray(audit?.content_highlights) ? audit.content_highlights : [],
      recommendations: Array.isArray(audit?.recommendations) ? audit.recommendations : [],
      keywordIntelligence: Array.isArray(audit?.keyword_intelligence) ? audit.keyword_intelligence : [],
      faqCount: Number(audit?.faq_count || audit?.content_analysis?.faq_count || 0),
    };

    const generated = await generateQueries(identity.normalized_url, content, count, apiKey);
    const prioritized = prioritizeQueries(generated.queries, content.brandName || extractDomainLabel(identity.normalized_url));

    return res.json({
      success: true,
      identity,
      queries: prioritized,
      industry: generated.industry,
      topics: generated.topics,
    });
  } catch (err: any) {
    console.error('[Citations] Generate queries error:', err);
    return res.status(500).json({ error: 'Failed to generate queries' });
  }
}

// POST /api/citations/test - Start a citation test
export async function startCitationTest(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { url, queries, platforms } = req.body;

    if (!url || !queries || !Array.isArray(queries)) {
      return res.status(400).json({ error: 'URL and queries array required' });
    }

    const normalizedUrl = normalizePublicHttpUrl(String(url));
    if (!normalizedUrl.ok) {
      return res.status(400).json({ error: normalizedUrl.error, code: 'INVALID_URL' });
    }

    const user = (req as any).user;
    const maxQueries = CITATION_QUERY_LIMITS[user.tier] || CITATION_QUERY_LIMITS.observer;
    const normalizedQueries = normalizeQueries(queries, maxQueries);

    if (!normalizedQueries.length) {
      return res.status(400).json({
        error: 'At least one valid query is required (3-220 chars each).',
        code: 'INVALID_QUERIES',
      });
    }

    if (normalizedQueries.length > maxQueries) {
      return res.status(403).json({
        error: `Your ${user.tier} plan allows ${maxQueries} queries per test. Upgrade for more.`,
        code: 'QUERY_LIMIT_EXCEEDED',
      });
    }

    // Tool credit gate - deducts credits if free monthly allowance exhausted
    const gate = await gateToolAction(userId, 'citation_query', user.tier || 'observer');
    if (!gate.allowed) {
      return res.status(402).json({
        error: gate.reason,
        code: 'CREDITS_REQUIRED',
        creditCost: gate.creditCost,
        creditsRemaining: gate.creditsRemaining,
      });
    }

    const apiKey = getServerApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'AI provider key not configured' });
    }

    const pool = getPool();

    // Create citation test record
    const { rows: created } = await pool.query(
      `INSERT INTO citation_tests (user_id, url, queries, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [userId, normalizedUrl.url, JSON.stringify(normalizedQueries)]
    );

    const testId = created[0].id;

    // Start test asynchronously (don't wait for completion)
    runCitationTestAsync(testId, userId, normalizedUrl.url, normalizedQueries, platforms || ['chatgpt', 'perplexity', 'claude', 'google_ai'], apiKey);

    // Check citation milestones in background
    checkCitationMilestones(userId).catch(() => {});

    return res.json({
      success: true,
      test_id: testId,
      status: 'pending',
      message: 'Citation test started. Check status at /api/citations/test/:id',
      creditInfo: gate.creditCost > 0
        ? { creditCost: gate.creditCost, creditsRemaining: gate.creditsRemaining }
        : { freeUsesRemaining: gate.freeUsesRemaining },
    });
  } catch (err: any) {
    console.error('[Citations] Start test error:', err);
    return res.status(500).json({ error: 'Failed to start citation test' });
  }
}

export async function getCitationIdentity(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rawUrl = String(req.query.url || req.body?.url || '').trim();
    if (!rawUrl) return res.status(400).json({ error: 'URL is required' });

    const identity = await resolveCitationIdentity(userId, rawUrl);
    if (!identity) {
      return res.status(400).json({ error: 'URL is invalid or cannot be normalized', code: 'INVALID_URL' });
    }

    return res.json({ success: true, identity });
  } catch (err: any) {
    console.error('[Citations] Identity error:', err);
    return res.status(500).json({ error: 'Failed to resolve citation identity' });
  }
}

export async function exportCitationTestCsv(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const testId = req.params.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id, url, status, summary, results, created_at, completed_at FROM citation_tests WHERE id = $1 AND user_id = $2',
      [testId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Citation test not found' });

    const test = rows[0] as any;
    let parsedResults = test.results;
    if (typeof parsedResults === 'string') {
      try { parsedResults = JSON.parse(parsedResults); } catch { parsedResults = []; }
    }
    const results = parsedResults && !Array.isArray(parsedResults) && parsedResults.citations
      ? parsedResults.citations
      : Array.isArray(parsedResults) ? parsedResults : [];
    const summary = (test.summary && typeof test.summary === 'object') ? test.summary : {};

    const escapeCsv = (value: unknown) => {
      const raw = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };

    const lines: string[] = [];
    lines.push(['test_id', test.id].map(escapeCsv).join(','));
    lines.push(['url', test.url].map(escapeCsv).join(','));
    lines.push(['status', test.status].map(escapeCsv).join(','));
    lines.push(['created_at', test.created_at].map(escapeCsv).join(','));
    lines.push(['completed_at', test.completed_at || ''].map(escapeCsv).join(','));
    lines.push(['total_queries', summary.total_queries ?? ''].map(escapeCsv).join(','));
    lines.push(['mention_rate', summary.mention_rate ?? ''].map(escapeCsv).join(','));
    lines.push(['avg_position', summary.avg_position ?? ''].map(escapeCsv).join(','));
    lines.push('');
    lines.push(['query', 'platform', 'mentioned', 'position', 'excerpt', 'competitors_mentioned'].join(','));

    for (const row of results) {
      lines.push([
        row?.query || '',
        row?.platform || '',
        row?.mentioned ? 'true' : 'false',
        row?.position ?? '',
        row?.excerpt || '',
        Array.isArray(row?.competitors_mentioned) ? row.competitors_mentioned.join(' | ') : '',
      ].map(escapeCsv).join(','));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=aivis-citation-test-${test.id}-${stamp}.csv`);
    return res.status(200).send(lines.join('\n'));
  } catch (err: any) {
    console.error('[Citations] Export CSV error:', err);
    return res.status(500).json({ error: 'Failed to export citation test CSV' });
  }
}

export async function listCitationPromptLedger(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const testId = String(req.query.test_id || '').trim() || null;
    const rawUrl = String(req.query.url || '').trim();
    const normalizedUrl = rawUrl ? normalizePublicHttpUrl(rawUrl) : null;

    if (rawUrl && (!normalizedUrl || !normalizedUrl.ok)) {
      return res.status(400).json({ error: 'Invalid URL filter', code: 'INVALID_URL' });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, citation_test_id, url, query, validation_status, platform, model_used, model_role,
              mentioned, position, evidence_excerpt, metadata, created_at, updated_at
       FROM citation_prompt_ledger
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR citation_test_id = $2::uuid)
         AND ($3::text IS NULL OR url = $3::text)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [userId, testId, normalizedUrl?.ok ? normalizedUrl.url : null, limit, offset]
    );

    return res.json({
      success: true,
      prompts: rows,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('[Citations] Prompt ledger list error:', err);
    return res.status(500).json({ error: 'Failed to fetch prompt ledger' });
  }
}

// Async test runner
async function runCitationTestAsync(
  testId: string,
  userId: string,
  url: string,
  queries: string[],
  platforms: Array<'chatgpt' | 'perplexity' | 'claude' | 'google_ai'>,
  apiKey: string
) {
  const pool = getPool();

  try {
    // Update status to running
    await pool.query(
      'UPDATE citation_tests SET status = $1 WHERE id = $2',
      ['running', testId]
    );

    // Get brand name
    const auditRecord = await findLatestAuditForTarget(userId, url);
    const audit = auditRecord?.result;
    const identity = await resolveCitationIdentity(userId, url);
    const brandName = identity?.business_name || audit?.brand_entities?.[0] || extractDomainLabel(url);

    // Get competitor URLs
    const { rows: competitors } = await pool.query(
      'SELECT competitor_url FROM competitor_tracking WHERE user_id = $1',
      [userId]
    );
    const competitorUrls = competitors.map((c: any) => c.competitor_url);

    const requestedPlatforms = Array.from(new Set((platforms || ALL_CITATION_PLATFORMS).filter((p): p is CitationPlatformKey =>
      (ALL_CITATION_PLATFORMS as readonly string[]).includes(String(p))
    )));
    const activePlatforms = requestedPlatforms.length > 0 ? requestedPlatforms : [...ALL_CITATION_PLATFORMS];

    // Run tests
    let results = await testMultipleQueries(
      queries,
      brandName,
      url,
      activePlatforms,
      competitorUrls,
      apiKey,
      (current, total) => {
        console.log(`[CitationTest ${testId}] Progress: ${current}/${total}`);
      }
    );

    let summary = calculateCitationSummary(results);

    if (summary.mention_rate < 50) {
      const missingPlatforms = ALL_CITATION_PLATFORMS.filter((p) => !activePlatforms.includes(p));
      if (missingPlatforms.length > 0) {
        const expandedResults = await testMultipleQueries(
          queries,
          brandName,
          url,
          missingPlatforms,
          competitorUrls,
          apiKey
        );
        results = [...results, ...expandedResults];
        summary = calculateCitationSummary(results);
      }
    }

    // Store results
    const allCitationResults: AICitationResult[] = results.flatMap(r => r.results);

    // Collect web search presence data keyed by query
    const webSearchByQuery: Record<string, any> = {};
    const bingSearchByQuery: Record<string, any> = {};
    const ddgSearchByQuery: Record<string, any> = {};
    const braveSearchByQuery: Record<string, any> = {};
    const wikipediaSearchByQuery: Record<string, any> = {};
    const yahooSearchByQuery: Record<string, any> = {};
    for (const r of results) {
      if (r.web_search) {
        webSearchByQuery[r.query] = r.web_search;
      }
      if (r.bing_search) {
        bingSearchByQuery[r.query] = r.bing_search;
      }
      if (r.ddg_search) {
        ddgSearchByQuery[r.query] = r.ddg_search;
      }
      if (r.brave_search) {
        braveSearchByQuery[r.query] = r.brave_search;
      }
      if ((r as any).wikipedia_search) {
        wikipediaSearchByQuery[r.query] = (r as any).wikipedia_search;
      }
      if ((r as any).yahoo_search) {
        yahooSearchByQuery[r.query] = (r as any).yahoo_search;
      }
    }

    for (const citationResult of allCitationResults) {
      await pool.query(
        `INSERT INTO citation_results (citation_test_id, query, platform, mentioned, position, excerpt, competitors_mentioned, mention_quality_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          testId,
          citationResult.query,
          citationResult.platform,
          citationResult.mentioned,
          citationResult.position,
          citationResult.excerpt,
          JSON.stringify(citationResult.competitors_mentioned),
         computeMentionQuality(Boolean(citationResult.mentioned), Number(citationResult.position || 0), String(citationResult.excerpt || '')),
        ]
      );
    }

    for (const citationResult of allCitationResults) {
      const promptText = buildCitationPrompt(citationResult.query);
      const promptHash = createHash('sha256')
        .update(`${url}::${citationResult.query}::${promptText}`)
        .digest('hex');

      await pool.query(
        `INSERT INTO citation_prompt_ledger (
           user_id, citation_test_id, url, query, prompt_text, prompt_hash, validation_status,
           platform, model_used, model_role, mentioned, position, evidence_excerpt, metadata
         ) VALUES (
           $1, $2, $3, $4, $5, $6, 'validated',
           $7, $8, $9, $10, $11, $12, $13
         )
         ON CONFLICT (citation_test_id, prompt_hash, platform)
         DO UPDATE SET
           model_used = EXCLUDED.model_used,
           model_role = EXCLUDED.model_role,
           mentioned = EXCLUDED.mentioned,
           position = EXCLUDED.position,
           evidence_excerpt = EXCLUDED.evidence_excerpt,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          userId,
          testId,
          url,
          citationResult.query,
          promptText,
          promptHash,
          citationResult.platform,
          citationResult.model_used || null,
          citationResult.model_role || null,
          Boolean(citationResult.mentioned),
          Number(citationResult.position || 0),
          String(citationResult.excerpt || '').slice(0, 2000),
          JSON.stringify({
            competitors_mentioned: Array.isArray(citationResult.competitors_mentioned)
              ? citationResult.competitors_mentioned
              : [],
            created_at: citationResult.created_at || new Date().toISOString(),
            mention_rate_at_write: summary.mention_rate,
          }),
        ]
      );
    }

    // Update test as completed
    const storedPayload = {
      citations: allCitationResults,
      web_search_by_query: Object.keys(webSearchByQuery).length > 0 ? webSearchByQuery : undefined,
      bing_search_by_query: Object.keys(bingSearchByQuery).length > 0 ? bingSearchByQuery : undefined,
      ddg_search_by_query: Object.keys(ddgSearchByQuery).length > 0 ? ddgSearchByQuery : undefined,
      brave_search_by_query: Object.keys(braveSearchByQuery).length > 0 ? braveSearchByQuery : undefined,
      wikipedia_search_by_query: Object.keys(wikipediaSearchByQuery).length > 0 ? wikipediaSearchByQuery : undefined,
      yahoo_search_by_query: Object.keys(yahooSearchByQuery).length > 0 ? yahooSearchByQuery : undefined,
    };
    await pool.query(
      `UPDATE citation_tests SET status = $1, results = $2, summary = $3, completed_at = NOW() WHERE id = $4`,
      ['completed', JSON.stringify(storedPayload), JSON.stringify(summary), testId]
    );

    console.log(`[CitationTest ${testId}] Completed successfully`);

      // Record trend snapshot for sparkline (non-fatal)
      try {
        const mentionedCount = allCitationResults.filter(r => r.mentioned).length;
        await recordMentionTrendSnapshot(
          userId, url, testId,
          summary.mention_rate,
          allCitationResults.length,
          mentionedCount,
          summary.platforms
        );
      } catch (trendErr: any) {
        console.warn('[CitationTest] Trend snapshot failed (non-fatal):', trendErr?.message);
      }
  } catch (err: any) {
    console.error(`[CitationTest ${testId}] Error:`, err);

    // Update test as failed
    await pool.query(
      `UPDATE citation_tests SET status = $1, results = $2 WHERE id = $3`,
      ['failed', JSON.stringify({ error: err.message }), testId]
    );
  }
}

// GET /api/citations/test/:id - Get citation test status/results
export async function getCitationTest(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const testId = req.params.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM citation_tests WHERE id = $1 AND user_id = $2',
      [testId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Citation test not found' });
    }

    const test = rows[0];

    // Backward-compat: results can be either the new {citations, web_search_by_query} envelope
    // or the legacy flat AICitationResult[] array.
    let parsedResults = test.results;
    if (typeof parsedResults === 'string') {
      try { parsedResults = JSON.parse(parsedResults); } catch { parsedResults = []; }
    }

    let citations: any[];
    let webSearchByQuery: Record<string, any> | undefined;
    let bingSearchByQuery: Record<string, any> | undefined;
    let ddgSearchByQuery: Record<string, any> | undefined;
    let braveSearchByQuery: Record<string, any> | undefined;
    let wikipediaSearchByQuery: Record<string, any> | undefined;
    let yahooSearchByQuery: Record<string, any> | undefined;
    if (parsedResults && !Array.isArray(parsedResults) && parsedResults.citations) {
      citations = parsedResults.citations;
      webSearchByQuery = parsedResults.web_search_by_query;
      bingSearchByQuery = parsedResults.bing_search_by_query;
      ddgSearchByQuery = parsedResults.ddg_search_by_query;
      braveSearchByQuery = parsedResults.brave_search_by_query;
      wikipediaSearchByQuery = parsedResults.wikipedia_search_by_query;
      yahooSearchByQuery = parsedResults.yahoo_search_by_query;
    } else {
      citations = Array.isArray(parsedResults) ? parsedResults : [];
      webSearchByQuery = undefined;
      bingSearchByQuery = undefined;
      ddgSearchByQuery = undefined;
      braveSearchByQuery = undefined;
      wikipediaSearchByQuery = undefined;
      yahooSearchByQuery = undefined;
    }

    return res.json({
      success: true,
      test: {
        id: test.id,
        url: test.url,
        queries: test.queries,
        status: test.status,
        results: citations,
        web_search_by_query: webSearchByQuery,
        bing_search_by_query: bingSearchByQuery,
        ddg_search_by_query: ddgSearchByQuery,
        brave_search_by_query: braveSearchByQuery,
        wikipedia_search_by_query: wikipediaSearchByQuery,
        yahoo_search_by_query: yahooSearchByQuery,
        summary: test.summary,
        created_at: test.created_at,
        completed_at: test.completed_at,
      },
    });
  } catch (err: any) {
    console.error('[Citations] Get test error:', err);
    return res.status(500).json({ error: 'Failed to fetch citation test' });
  }
}

// GET /api/citations/tests - List all citation tests for user
export async function listCitationTests(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, url, status, summary, created_at, completed_at
       FROM citation_tests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const { rows: countResult } = await pool.query(
      'SELECT COUNT(*) as total FROM citation_tests WHERE user_id = $1',
      [userId]
    );

    return res.json({
      success: true,
      tests: rows,
      total: Number(countResult[0]?.total || 0),
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('[Citations] List tests error:', err);
    return res.status(500).json({ error: 'Failed to list citation tests' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY PACK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export async function createQueryPack(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description, queries, tags = [], client_name } = req.body;

    if (!name || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        error: 'name and non-empty queries array required',
        code: 'INVALID_PACK',
      });
    }

    const normalizedQueries = normalizeQueries(queries, 500);

    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO query_packs (user_id, name, description, queries, tags, client_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, name, description || null, JSON.stringify(normalizedQueries), tags, client_name || null]
    );

    const pack = rows[0];

    return res.json({
      success: true,
      pack: {
        id: pack.id,
        name: pack.name,
        description: pack.description,
        queries: safeParseJson(pack.queries, []),
        tags: pack.tags,
        client_name: pack.client_name,
        execution_count: pack.execution_count,
        created_at: pack.created_at,
      },
    });
  } catch (err: any) {
    console.error('[Citations] Create pack error:', err);
    return res.status(500).json({ error: 'Failed to create query pack' });
  }
}

export async function listQueryPacks(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, name, description, queries, tags, client_name, execution_count, last_executed_at, created_at, updated_at
       FROM query_packs
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const { rows: countResult } = await pool.query(
      'SELECT COUNT(*) as total FROM query_packs WHERE user_id = $1',
      [userId]
    );

    const packs = rows.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      queries: safeParseJson(p.queries, []),
      tags: p.tags,
      client_name: p.client_name,
      execution_count: p.execution_count,
      last_executed_at: p.last_executed_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    return res.json({
      success: true,
      packs,
      total: Number(countResult[0]?.total || 0),
    });
  } catch (err: any) {
    console.error('[Citations] List packs error:', err);
    return res.status(500).json({ error: 'Failed to list query packs' });
  }
}

export async function getQueryPack(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const packId = req.params.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM query_packs WHERE id = $1 AND user_id = $2',
      [packId, userId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Query pack not found' });

    const p = rows[0];

    return res.json({
      success: true,
      pack: {
        id: p.id,
        name: p.name,
        description: p.description,
        queries: safeParseJson(p.queries, []),
        tags: p.tags,
        client_name: p.client_name,
        execution_count: p.execution_count,
        last_executed_at: p.last_executed_at,
        created_at: p.created_at,
        updated_at: p.updated_at,
      },
    });
  } catch (err: any) {
    console.error('[Citations] Get pack error:', err);
    return res.status(500).json({ error: 'Failed to get query pack' });
  }
}

export async function updateQueryPack(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const packId = req.params.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description, queries, tags, client_name } = req.body;
    const pool = getPool();

    const { rows: existing } = await pool.query(
      'SELECT id FROM query_packs WHERE id = $1 AND user_id = $2',
      [packId, userId]
    );

    if (!existing.length) return res.status(404).json({ error: 'Query pack not found' });

    const normalizedQueries = queries ? normalizeQueries(queries, 500) : undefined;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(sanitizeHtmlServer(String(name)));
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description ? sanitizeHtmlServer(String(description)) : null);
    }
    if (normalizedQueries) {
      updates.push(`queries = $${paramIndex++}`);
      values.push(JSON.stringify(normalizedQueries));
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(tags);
    }
    if (client_name !== undefined) {
      updates.push(`client_name = $${paramIndex++}`);
      values.push(client_name ? sanitizeHtmlServer(String(client_name)) : null);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(packId, userId);

    const { rows } = await pool.query(
      `UPDATE query_packs SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`,
      values
    );

    const p = rows[0];

    return res.json({
      success: true,
      pack: {
        id: p.id,
        name: p.name,
        description: p.description,
        queries: safeParseJson(p.queries, []),
        tags: p.tags,
        client_name: p.client_name,
        execution_count: p.execution_count,
        updated_at: p.updated_at,
      },
    });
  } catch (err: any) {
    console.error('[Citations] Update pack error:', err);
    return res.status(500).json({ error: 'Failed to update query pack' });
  }
}

export async function deleteQueryPack(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const packId = req.params.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    const { rows } = await pool.query(
      'DELETE FROM query_packs WHERE id = $1 AND user_id = $2 RETURNING id',
      [packId, userId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Query pack not found' });

    return res.json({ success: true, message: 'Query pack deleted' });
  } catch (err: any) {
    console.error('[Citations] Delete pack error:', err);
    return res.status(500).json({ error: 'Failed to delete query pack' });
  }
}

export async function executeQueryPack(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const packId = req.params.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { url, platforms } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const normalizedUrl = normalizePublicHttpUrl(String(url));
    if (!normalizedUrl.ok) {
      return res.status(400).json({ error: normalizedUrl.error, code: 'INVALID_URL' });
    }

    const pool = getPool();

    // Verify pack ownership
    const { rows: packRows } = await pool.query(
      'SELECT queries, execution_count FROM query_packs WHERE id = $1 AND user_id = $2',
      [packId, userId]
    );

    if (!packRows.length) return res.status(404).json({ error: 'Query pack not found' });

    const pack = packRows[0];
    const queries = safeParseJson(pack.queries, [] as string[]);

    // Start citation test with pack queries
    const user = (req as any).user;
    const maxQueries = CITATION_QUERY_LIMITS[user.tier] || CITATION_QUERY_LIMITS.observer;
    const normalizedQueries = normalizeQueries(queries, maxQueries);

    if (!normalizedQueries.length) {
      return res.status(400).json({ error: 'Pack has no valid queries', code: 'INVALID_QUERIES' });
    }

    const apiKey = getServerApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'AI provider key not configured' });
    }

    // Create citation test
    const { rows: created } = await pool.query(
      `INSERT INTO citation_tests (user_id, url, queries, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [userId, normalizedUrl.url, JSON.stringify(normalizedQueries)]
    );

    const testId = created[0].id;

    // Record pack execution
    await pool.query(
      `INSERT INTO query_pack_executions (query_pack_id, citation_test_id)
       VALUES ($1, $2)`,
      [packId, testId]
    );

    // Update pack execution count
    await pool.query(
      `UPDATE query_packs SET execution_count = execution_count + 1, last_executed_at = NOW() WHERE id = $1`,
      [packId]
    );

    // Start test asynchronously
    runCitationTestAsync(
      testId,
      userId,
      normalizedUrl.url,
      normalizedQueries,
      platforms || ['chatgpt', 'perplexity', 'claude', 'google_ai'],
      apiKey
    );

    return res.json({
      success: true,
      test_id: testId,
      status: 'pending',
      message: 'Query pack test started',
    });
  } catch (err: any) {
    console.error('[Citations] Execute pack error:', err);
    return res.status(500).json({ error: 'Failed to execute query pack' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CITATION EVIDENCE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export async function getCitationEvidence(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const testId = req.params.testId;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();

    // Verify test ownership
    const { rows: testRows } = await pool.query(
      'SELECT id FROM citation_tests WHERE id = $1 AND user_id = $2',
      [testId, userId]
    );

    if (!testRows.length) return res.status(404).json({ error: 'Citation test not found' });

    // Get high-confidence evidences (only mentioned citations, position <= 5)
    const { rows: evidences } = await pool.query(
      `SELECT e.*, cr.query, cr.platform, cr.position, cr.excerpt, cr.mentioned
       FROM citation_evidences e
       JOIN citation_results cr ON cr.id = e.citation_result_id
       WHERE cr.citation_test_id = $1 AND cr.mentioned = true AND cr.position <= 5
       ORDER BY e.confidence_score DESC, cr.position ASC`,
      [testId]
    );

    const results = evidences.map((e: any) => ({
      id: e.id,
      evidence_key: e.evidence_key,
      query: e.query,
      platform: e.platform,
      position: e.position,
      excerpt: e.excerpt,
      confidence_score: Number(e.confidence_score),
      curated: e.curated,
      curation_note: e.curation_note,
      starred: e.starred,
      rev_cite_suggestions: safeParseJson(e.rev_cite_suggestions, []),
    }));

    return res.json({
      success: true,
      evidences: results,
      total: results.length,
    });
  } catch (err: any) {
    console.error('[Citations] Get evidence error:', err);
    return res.status(500).json({ error: 'Failed to fetch citation evidence' });
  }
}

export async function curateEvidence(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const evidenceId = req.params.id;
    const { starred, curated, curation_note } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();

    // Verify evidence ownership via test ownership
    const { rows: verify } = await pool.query(
      `SELECT e.id FROM citation_evidences e
       JOIN citation_results cr ON cr.id = e.citation_result_id
       JOIN citation_tests ct ON ct.id = cr.citation_test_id
       WHERE e.id = $1 AND ct.user_id = $2`,
      [evidenceId, userId]
    );

    if (!verify.length) return res.status(404).json({ error: 'Evidence not found' });

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (starred !== undefined) {
      updates.push(`starred = $${paramIndex++}`);
      values.push(starred);
    }
    if (curated !== undefined) {
      updates.push(`curated = $${paramIndex++}`);
      values.push(curated);
    }
    if (curation_note !== undefined) {
      updates.push(`curation_note = $${paramIndex++}`);
      values.push(curation_note ? sanitizeHtmlServer(String(curation_note)) : null);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(evidenceId);

    const { rows } = await pool.query(
      `UPDATE citation_evidences SET ${updates.join(', ')} WHERE id = $${paramIndex++} RETURNING *`,
      values
    );

    return res.json({
      success: true,
      evidence: rows[0],
    });
  } catch (err: any) {
    console.error('[Citations] Curate evidence error:', err);
    return res.status(500).json({ error: 'Failed to curate evidence' });
  }
}

export async function getRevCiteSuggestions(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const evidenceId = req.params.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();

    // Get evidence with original query
    const { rows: evidence } = await pool.query(
      `SELECT e.*, cr.query, cr.excerpt
       FROM citation_evidences e
       JOIN citation_results cr ON cr.id = e.citation_result_id
       JOIN citation_tests ct ON ct.id = cr.citation_test_id
       WHERE e.id = $1 AND ct.user_id = $2`,
      [evidenceId, userId]
    );

    if (!evidence.length) return res.status(404).json({ error: 'Evidence not found' });

    const ev = evidence[0];
    const originalQuery = ev.query;
    const excerpt = ev.excerpt;

    // Generate Rev-Cite suggestions (alternative queries with similar intent but less competitive)
    const suggestions = generateRevCiteSuggestions(originalQuery, excerpt);

    // Store suggestions
    await pool.query(
      'UPDATE citation_evidences SET rev_cite_suggestions = $1 WHERE id = $2',
      [JSON.stringify(suggestions), evidenceId]
    );

    return res.json({
      success: true,
      original_query: originalQuery,
      suggestions,
    });
  } catch (err: any) {
    console.error('[Citations] Get Rev-Cite error:', err);
    return res.status(500).json({ error: 'Failed to generate Rev-Cite suggestions' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function generateRevCiteSuggestions(
  originalQuery: string,
  excerpt: string
): Array<{ query: string; rationale: string; expected_competition: 'low' | 'medium' | 'high'; intent_alignment: number }> {
  const suggestions: Array<{ query: string; rationale: string; expected_competition: 'low' | 'medium' | 'high'; intent_alignment: number }> = [];

  // Variation 1: Focus on specific problem/pain point (less competitive)
  const problemVariation = `how to ${originalQuery.replace(/^(how|what|why|when)\s+/i, '').toLowerCase()}`;
  suggestions.push({
    query: problemVariation,
    rationale: 'Problem-focused variation targets users seeking solutions',
    expected_competition: 'low',
    intent_alignment: 0.85,
  });

  // Variation 2: Long-tail, conversational version
  const conversationalVariation = `${originalQuery.toLowerCase()} for beginners`;
  suggestions.push({
    query: conversationalVariation,
    rationale: 'Long-tail version attracts learners with less competition',
    expected_competition: 'low',
    intent_alignment: 0.8,
  });

  // Variation 3: Use domain-specific terminology from excerpt
  const domainTerms = extractDomainTerms(excerpt);
  if (domainTerms.length > 0) {
    const domainVariation = `${originalQuery} ${domainTerms[0]}`.toLowerCase();
    suggestions.push({
      query: domainVariation,
      rationale: `Incorporates domain terminology (${domainTerms[0]}) for niche targeting`,
      expected_competition: 'medium',
      intent_alignment: 0.88,
    });
  }

  // Variation 4: Question-format for FAQ/PAA targeting
  if (!originalQuery.toLowerCase().startsWith('what') && !originalQuery.toLowerCase().startsWith('how')) {
    const questionVariation = `what is ${originalQuery.toLowerCase()}?`;
    suggestions.push({
      query: questionVariation,
      rationale: 'Question format targets People Also Ask and FAQ snippets',
      expected_competition: 'medium',
      intent_alignment: 0.75,
    });
  }

  return suggestions.slice(0, 4);
}

function extractDomainTerms(excerpt: string): string[] {
  // Extract capitalized terms (likely domain-specific)
  const matches = excerpt.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g);
  return matches ? matches.slice(0, 2) : [];
}

// ═══════════════════════════════════════════════════════════════════════════
// NICHE COMPETITIVE RANKING  (Signal+)
// ═══════════════════════════════════════════════════════════════════════════

export async function runNicheRankingHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = getServerApiKey();
  if (!apiKey) return res.status(503).json({ error: 'AI service unavailable' });

  const { url, brand_name, niche, niche_keywords } = req.body as {
    url: string;
    brand_name?: string;
    niche?: string;
    niche_keywords?: string[];
  };

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const targetUrl = normalizeUrl(url);
  if (!targetUrl) return res.status(400).json({ error: 'Invalid URL' });

  // Derive brand name from provided value or audit history
  let resolvedBrand = String(brand_name || '').trim();
  if (!resolvedBrand) {
    const identity = await resolveCitationIdentity(user.id, targetUrl).catch(() => null);
    resolvedBrand = identity?.business_name || extractDomainLabel(targetUrl);
  }

  const resolvedNiche = String(niche || '').trim() || 'SaaS tools and productivity software';
  const resolvedKeywords: string[] = Array.isArray(niche_keywords)
    ? niche_keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12)
    : [];

  const result = await runNicheRanking({
    targetUrl,
    brandName: resolvedBrand,
    niche: resolvedNiche,
    nicheKeywords: resolvedKeywords,
    apiKey,
    userId: user.id,
  });

  if (!result) {
    return res.status(503).json({ error: 'Niche ranking failed - all AI models unavailable' });
  }

  return res.json({ ranking: result });
}

export async function getNicheRankingHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params as { id: string };
  const result = await getNicheRankingById(id, user.id).catch(() => null);
  if (!result) return res.status(404).json({ error: 'Ranking not found' });
  return res.json({ ranking: result });
}

export async function getLatestNicheRankingHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const rawUrl = String(req.query.url || '');
  if (!rawUrl) return res.status(400).json({ error: 'url query param required' });

  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) return res.status(400).json({ error: 'Invalid URL' });

  const result = await getLatestNicheRanking(user.id, targetUrl).catch(() => null);
  return res.json({ ranking: result ?? null });
}

export async function listNicheRankingsHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
  const results = await listNicheRankings(user.id, limit).catch(() => []);
  return res.json({ rankings: results });
}

// ═══════════════════════════════════════════════════════════════════════════
// CITATION SCHEDULED JOBS  (Signal+)
// ═══════════════════════════════════════════════════════════════════════════

export async function createScheduledJobHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { url, niche, niche_keywords, interval_hours } = req.body as {
    url: string;
    niche?: string;
    niche_keywords?: string[];
    interval_hours?: number;
  };

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const targetUrl = normalizeUrl(url);
  if (!targetUrl) return res.status(400).json({ error: 'Invalid URL' });

  const hours = typeof interval_hours === 'number' ? interval_hours : 24;
  if (hours < 1 || hours > 8760) {
    return res.status(400).json({ error: 'interval_hours must be between 1 and 8760' });
  }

  const keywords: string[] = Array.isArray(niche_keywords)
    ? niche_keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12)
    : [];

  const job = await createScheduledJob({
    userId: user.id,
    targetUrl,
    niche: typeof niche === 'string' ? niche.trim() : undefined,
    nicheKeywords: keywords,
    intervalHours: hours,
  }).catch((err: Error) => {
    console.error('[Citations] createScheduledJob failed:', err.message);
    return null;
  });

  if (!job) return res.status(500).json({ error: 'Failed to create scheduled job' });
  return res.status(201).json({ job });
}

export async function listScheduledJobsHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const jobs = await listScheduledJobs(user.id).catch(() => []);
  return res.json({ jobs });
}

export async function getScheduledJobHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id || '');
  const job = await getScheduledJob(id, user.id).catch(() => null);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json({ job });
}

export async function toggleScheduledJobHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const id = String(req.params.id || '');
  const isActive = Boolean((req.body as any)?.is_active);
  const job = await toggleScheduledJob(id, user.id, isActive).catch(() => null);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json({ job });
}

export async function deleteScheduledJobHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id || '');
  const deleted = await deleteScheduledJob(id, user.id).catch(() => false);
  if (!deleted) return res.status(404).json({ error: 'Job not found' });
  return res.status(204).send();
}

export async function updateScheduledJobIntervalHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const id = String(req.params.id || '');
  const hours = Number((req.body as any)?.interval_hours);
  if (!Number.isFinite(hours) || hours < 1 || hours > 8760) {
    return res.status(400).json({ error: 'interval_hours must be between 1 and 8760' });
  }

  const job = await updateScheduledJobInterval(id, user.id, hours).catch(() => null);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json({ job });
}

// ─── Citation Intelligence Handlers ──────────────────────────────────────────

/** GET /citations/trend?url= - mention-rate sparkline history (alignment+) */
export async function getMentionTrendHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const rawUrl = String((req.query as any).url || '');
  if (!rawUrl) return res.status(400).json({ error: 'url query param required' });
  const url = normalizeAuditTargetKey(rawUrl);

  const limit = Math.min(Number((req.query as any).limit) || 30, 90);
  const trends: CitationMentionTrend[] = await getMentionTrendHistory(user.id, url, limit).catch(() => []);
  return res.json({ trends });
}

/** GET /citations/competitor-share?url= - competitor citation share table (alignment+) */
export async function getCompetitorShareHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const rawUrl = String((req.query as any).url || '');
  if (!rawUrl) return res.status(400).json({ error: 'url query param required' });
  const url = normalizeAuditTargetKey(rawUrl);

  const windowDays = Math.min(Number((req.query as any).window_days) || 30, 90);
  const share: CitationCompetitorShareEntry[] = await aggregateCompetitorShare(user.id, url, windowDays).catch(() => []);
  return res.json({ share });
}

/** GET /citations/consistency-matrix?url= - per-platform × per-query matrix (alignment+) */
export async function getConsistencyMatrixHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const rawUrl = String((req.query as any).url || '');
  if (!rawUrl) return res.status(400).json({ error: 'url query param required' });
  const url = normalizeAuditTargetKey(rawUrl);

  const matrix: ConsistencyMatrixCell[] = await buildConsistencyMatrix(user.id, url).catch(() => []);
  return res.json({ matrix });
}

/** GET /citations/drop-alerts?url= - citation drop alerts (signal) */
export async function getDropAlertsHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const rawUrl = String((req.query as any).url || '');
  const pool = getPool();

  const query = rawUrl
    ? `SELECT * FROM citation_drop_alerts
       WHERE user_id = $1 AND url = $2
       ORDER BY dismissed ASC, created_at DESC LIMIT 50`
    : `SELECT * FROM citation_drop_alerts
       WHERE user_id = $1
       ORDER BY dismissed ASC, created_at DESC LIMIT 50`;

  const params = rawUrl ? [user.id, normalizeAuditTargetKey(rawUrl)] : [user.id];
  const { rows } = await pool.query<CitationDropAlert>(query, params).catch(() => ({ rows: [] as CitationDropAlert[] }));
  return res.json({ alerts: rows });
}

/** POST /citations/drop-alerts/:id/dismiss - dismiss an alert (signal) */
export async function dismissDropAlertHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const id = String(req.params.id || '');
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE citation_drop_alerts
     SET dismissed = TRUE, dismissed_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [id, user.id]
  ).catch(() => ({ rowCount: 0 }));

  if (!rowCount) return res.status(404).json({ error: 'Alert not found' });
  return res.json({ ok: true });
}

/** GET /citations/co-occurrences?url= - stored unlinked brand mentions (signal) */
export async function getCoOccurrencesHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const rawUrl = String((req.query as any).url || '');
  if (!rawUrl) return res.status(400).json({ error: 'url query param required' });
  const url = normalizeAuditTargetKey(rawUrl);

  const occurrences: CitationCoOccurrence[] = await getStoredCoOccurrences(user.id, url).catch(() => []);
  return res.json({ occurrences });
}

/** POST /citations/co-occurrences - run a fresh co-occurrence scan (signal) */
export async function runCoOccurrenceCheckHandler(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body as any;
  const rawUrl = String(body?.url || '');
  const brandName = String(body?.brand_name || '').trim();

  if (!rawUrl) return res.status(400).json({ error: 'url is required' });
  if (!brandName) return res.status(400).json({ error: 'brand_name is required' });

  const url = normalizeAuditTargetKey(rawUrl);

  try {
    const found: CitationCoOccurrence[] = await checkAndStoreCoOccurrences(user.id, url, brandName);
    return res.json({ found, count: found.length });
  } catch (err: any) {
    console.error('[CoOccurrence] Scan failed:', err.message);
    return res.status(500).json({ error: 'Co-occurrence scan failed' });
  }
}
