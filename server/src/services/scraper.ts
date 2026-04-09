// server/src/services/scraper.ts
/// <reference lib="dom" />
import puppeteer, { Browser, Page } from 'puppeteer';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { URL } from 'url';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';

/* ── capture-size caps (bytes of text kept per field) ────────────────── */
const MAX_HTML_CAPTURE_CHARS  = 250_000;
const MAX_BODY_CAPTURE_CHARS  =  50_000;
const MAX_JSONLD_BLOCK_CHARS  =  80_000;
const MAX_SITEMAP_CHARS       =  50_000;

export type StructuredData = {
  jsonLdCount: number;
  types: Record<string, number>;
  uniqueTypes: string[];
  hasLocalBusiness: boolean;
  hasFAQ: boolean;
  hasService: boolean;
  raw: any[];
};

export type RobotsInfo = {
  fetched: boolean;
  raw?: string;
  allows?: Record<string, boolean>;
  rules?: Record<string, { allow: string[]; disallow: string[] }>;
  sitemapDirectives?: string[];
};

export interface ScrapeResult {
  url: string;
  data: {
    title: string;
    body: string;
    html: string;
    structuredData?: StructuredData;
    robots?: RobotsInfo;
    llmsTxt?: {
      fetched: boolean;
      present: boolean;
      raw?: string;
      parsed?: {
        title?: string;
        description?: string;
        sectionCount: number;
        linkCount: number;
        hasEntityInfo: boolean;
        hasCanonicalPages: boolean;
        hasQA: boolean;
        sections: string[];
      };
    };
    sitemap?: {
      fetched: boolean;
      present: boolean;
      urlCount?: number;
      isIndex?: boolean;
      indexCount?: number;
      hasLastmod?: boolean;
      freshestMod?: string;
      sitemapUrls?: string[];
    };

    questionH2Count?: number;
    questionH2s?: string[];
    hasTldr?: boolean;
    tldrText?: string;
    tldrPosition?: 'top' | 'mid' | 'bottom' | 'none';

    meta?: {
      description?: string;
      keywords?: string;
      ogTitle?: string;
      ogDescription?: string;
      ogImage?: string;
      twitterCard?: string;
      twitterTitle?: string;
      twitterDescription?: string;
    };
    headings?: {
      h1: string[];
      h2: string[];
      h3: string[];
    };
    canonical?: string;
    links?: {
      internal: number;
      external: number;
      internalAnchors?: Array<{ href: string; text: string; context: 'nav' | 'content' | 'footer' | 'header' | 'sidebar' }>;
      descriptiveAnchorRatio?: number;
    };
    images?: number;
    imagesWithAlt?: number;
    /** Extracted image src + alt for OCR processing */
    imageDetails?: Array<{ src: string; alt: string }>;
    wordCount?: number;
    lang?: string;
    hreflang?: string[];

    aiCrawlerAccess?: Record<string, boolean>;

    lcpMs?: number;
    pageLoadMs?: number;

    /** OCR results from page images (populated post-scrape) */
    ocrData?: import('./ocrService.js').OcrPageResult;
  };
}

type EvalData = {
  title: string;
  body: string;
  html: string;
  ldJson: string[];
  meta: {
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    twitterCard: string;
    twitterTitle: string;
    twitterDescription: string;
  };
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  canonical: string;
  links: {
    internal: number;
    external: number;
    internalAnchors?: Array<{ href: string; text: string; context: 'nav' | 'content' | 'footer' | 'header' | 'sidebar' }>;
    descriptiveAnchorRatio?: number;
  };
  images: number;
  imagesWithAlt: number;
  imageDetails: Array<{ src: string; alt: string }>;
  wordCount: number;
  lang: string;
  hreflang: string[];

  robots: RobotsInfo;
  structuredData: StructuredData;

  questionH2Count: number;
  questionH2s: string[];
  hasTldr: boolean;
  tldrText?: string;
  tldrPosition: 'top' | 'mid' | 'bottom' | 'none';

  lcpMs?: number;
  llmsTxt?: {
    fetched: boolean;
    present: boolean;
    raw?: string;
    parsed?: {
      title?: string;
      description?: string;
      sectionCount: number;
      linkCount: number;
      hasEntityInfo: boolean;
      hasCanonicalPages: boolean;
      hasQA: boolean;
      sections: string[];
    };
  };
  sitemap?: {
    fetched: boolean;
    present: boolean;
    urlCount?: number;
    isIndex?: boolean;
    indexCount?: number;
    hasLastmod?: boolean;
    freshestMod?: string;
    sitemapUrls?: string[];
  };
  aiCrawlerAccess?: Record<string, boolean>;
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  if (!ms || ms <= 0) return p;
  let t: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (t) clearTimeout(t);
  }) as Promise<T>;
}

/**
 * Fetch and parse robots.txt for the given origin.
 * Returns a simple structure indicating allow/disallow for common AI crawlers.
 */
async function fetchRobotsForOrigin(origin: string): Promise<RobotsInfo> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);

  const target = `${origin.replace(/\/$/, '')}/robots.txt`;
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ai-visible-engine-bot/1.0' },
    });
    if (!res.ok) return { fetched: false };

    const txt = await res.text();
    const parsed = parseRobotsTxt(txt);

    // Comprehensive AI crawler list covering 30+ answer engines
    const agentsOfInterest = [
      'GPTBot', 'ChatGPT-User', 'OpenAI',             // OpenAI (ChatGPT, SearchGPT)
      'Google-Extended', 'Googlebot',                    // Google (Gemini, AI Overviews)
      'ClaudeBot', 'Anthropic-ai',                       // Anthropic (Claude)
      'PerplexityBot',                                   // Perplexity
      'Applebot-Extended',                               // Apple Intelligence
      'Bytespider',                                      // ByteDance (Doubao)
      'CCBot',                                           // Common Crawl (training data)
      'Amazonbot',                                       // Amazon (Alexa, Rufus)
      'FacebookBot', 'Meta-ExternalAgent',               // Meta AI
      'Cohere-ai',                                       // Cohere (Command)
      'YouBot',                                          // You.com
      'BingPreview', 'bingbot',                          // Microsoft (Copilot)
      'Googlebot-Image',                                 // Google image
      'OAI-SearchBot',                                   // OpenAI search
      'DuckAssistBot',                                   // DuckDuckGo AI Chat
      'PhindBot',                                        // Phind
      '*',                                               // Default wildcard
    ];
    const allows: Record<string, boolean> = {};
    for (const a of agentsOfInterest) allows[a] = evaluateAgentAllowed(parsed, a);

    // Extract Sitemap: directives
    const sitemapDirectives: string[] = [];
    for (const line of txt.split(/\r?\n/)) {
      const sm = line.match(/^sitemap:\s*(\S+)/i);
      if (sm) sitemapDirectives.push(sm[1].trim());
    }

    return { fetched: true, raw: txt, allows, rules: parsed, sitemapDirectives };
  } catch {
    return { fetched: false };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch /llms.txt - the emerging standard for AI crawler guidance.
 * Parses title, description, sections, link count, entity info, Q&A blocks.
 * 4-second timeout; never throws.
 */
async function fetchLlmsTxt(origin: string): Promise<{
  fetched: boolean;
  present: boolean;
  raw?: string;
  parsed?: {
    title?: string;
    description?: string;
    sectionCount: number;
    linkCount: number;
    hasEntityInfo: boolean;
    hasCanonicalPages: boolean;
    hasQA: boolean;
    sections: string[];
  };
}> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  const target = `${origin.replace(/\/$/, '')}/llms.txt`;
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ai-visible-engine-bot/1.0' },
    });
    if (!res.ok) return { fetched: true, present: false };
    const raw = (await res.text()).slice(0, 8000);

    // Parse llms.txt structure
    const lines = raw.split(/\r?\n/);
    const titleMatch = lines[0]?.match(/^#\s+(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Description: lines starting with > after title
    const descLines: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l.startsWith('>')) descLines.push(l.replace(/^>\s*/, ''));
      else if (l === '') continue;
      else break;
    }
    const description = descLines.length > 0 ? descLines.join(' ').trim() : undefined;

    // Sections: ## headings
    const sectionHeadings: string[] = [];
    for (const line of lines) {
      const sm = line.match(/^##\s+(.+)/);
      if (sm) sectionHeadings.push(sm[1].trim());
    }

    // Count links (markdown link syntax or bare URLs)
    const linkMatches = raw.match(/https?:\/\/[^\s)>\]]+/g) || [];
    const linkCount = linkMatches.length;

    // Entity signals: look for identity/entity/name/type/creator/sameAs patterns
    const entityRe = /\b(entity|identity|type:|creator:|founded:|headquarters:|sameAs|organization|company)\b/i;
    const hasEntityInfo = entityRe.test(raw);

    // Canonical page signals
    const canonicalRe = /\b(canonical|preferred|homepage|pricing|methodology|about|faq)\b/i;
    const hasCanonicalPages = canonicalRe.test(raw) && linkCount >= 3;

    // Q&A signals
    const qaRe = /\bQ:\s|^Q:\s|FAQ|frequently asked|question/im;
    const hasQA = qaRe.test(raw);

    return {
      fetched: true,
      present: true,
      raw,
      parsed: {
        title,
        description,
        sectionCount: sectionHeadings.length,
        linkCount,
        hasEntityInfo,
        hasCanonicalPages,
        hasQA,
        sections: sectionHeadings,
      },
    };
  } catch {
    return { fetched: false, present: false };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch /sitemap.xml - check presence, extract URLs, detect sitemap index,
 * extract lastmod dates, and return first 100 URLs for crawl seeding.
 * 4-second timeout; never throws.
 */
async function fetchSitemap(origin: string): Promise<{
  fetched: boolean;
  present: boolean;
  urlCount?: number;
  isIndex?: boolean;
  indexCount?: number;
  hasLastmod?: boolean;
  freshestMod?: string;
  sitemapUrls?: string[];
}> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  const target = `${origin.replace(/\/$/, '')}/sitemap.xml`;
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ai-visible-engine-bot/1.0' },
    });
    if (!res.ok) return { fetched: true, present: false };
    const raw = (await res.text()).slice(0, MAX_SITEMAP_CHARS);

    // Detect sitemap index vs urlset
    const isIndex = /<sitemapindex/i.test(raw);

    if (isIndex) {
      // Extract child sitemap <loc> URLs
      const indexLocs: string[] = [];
      const locRe = /<loc>\s*(.*?)\s*<\/loc>/gi;
      let m: RegExpExecArray | null;
      while ((m = locRe.exec(raw)) !== null) {
        indexLocs.push(m[1].trim());
      }
      return {
        fetched: true,
        present: true,
        urlCount: 0,
        isIndex: true,
        indexCount: indexLocs.length,
        sitemapUrls: indexLocs.slice(0, 20),
      };
    }

    // Standard urlset: extract <loc> URLs and <lastmod> dates
    const urls: string[] = [];
    const lastmods: string[] = [];

    // Extract all <url> entries or just <loc> tags
    const locRe = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = locRe.exec(raw)) !== null) {
      urls.push(m[1].trim());
    }

    const lastmodRe = /<lastmod>\s*(.*?)\s*<\/lastmod>/gi;
    while ((m = lastmodRe.exec(raw)) !== null) {
      lastmods.push(m[1].trim());
    }

    const hasLastmod = lastmods.length > 0;
    let freshestMod: string | undefined;
    if (hasLastmod) {
      // Sort by date descending to find freshest
      const sorted = lastmods
        .filter((d) => /^\d{4}/.test(d))
        .sort((a, b) => b.localeCompare(a));
      freshestMod = sorted[0];
    }

    return {
      fetched: true,
      present: true,
      urlCount: urls.length,
      isIndex: false,
      hasLastmod,
      freshestMod,
      sitemapUrls: urls.slice(0, 100),
    };
  } catch {
    return { fetched: false, present: false };
  } finally {
    clearTimeout(t);
  }
}


function parseRobotsTxt(txt: string): Record<string, { allow: string[]; disallow: string[] }> {
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  const groups: Array<{ agents: string[]; allow: string[]; disallow: string[] }> = [];
  let current: { agents: string[]; allow: string[]; disallow: string[] } | null = null;

  for (const rawLine of lines) {
    if (!rawLine || rawLine.startsWith('#')) continue;
    const m = rawLine.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;

    const key = m[1].toLowerCase();
    const val = m[2] || '';

    if (key === 'user-agent') {
      if (current) groups.push(current);
      current = { agents: [val], allow: [], disallow: [] };
    } else if (!current) {
      continue;
    } else if (key === 'allow') {
      current.allow.push(val);
    } else if (key === 'disallow') {
      current.disallow.push(val);
    }
  }
  if (current) groups.push(current);

  const map: Record<string, { allow: string[]; disallow: string[] }> = {};
  for (const g of groups) {
    for (const a of g.agents) {
      map[a.toLowerCase()] = { allow: g.allow.slice(), disallow: g.disallow.slice() };
    }
  }
  return map;
}

function evaluateAgentAllowed(
  rules: Record<string, { allow: string[]; disallow: string[] }>,
  agent: string
): boolean {
  const a = agent.toLowerCase();
  const hasExact = Object.prototype.hasOwnProperty.call(rules, a);
  const hasStar = Object.prototype.hasOwnProperty.call(rules, '*');
  if (!hasExact && !hasStar) return true;

  const g = hasExact ? rules[a] : rules['*'];
  if (g.disallow.some((d) => d.trim() === '/')) return false;

  return true;
}

let browserInstance: Browser | null = null;

/**
 * Resolve Chrome executable path.
 *
 * IMPORTANT: avoid slow shelling-out in production. Render containers can hang on execSync.
 */
function resolveChromePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      console.log(`[Scraper] Using Chrome at: ${p}`);
      return p;
    }
  }

  // Probe Puppeteer cache directory for installed Chrome binary
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || join(homedir(), '.cache', 'puppeteer');
  const chromeCacheDir = join(cacheDir, 'chrome');
  if (existsSync(chromeCacheDir)) {
    try {
      const versions = readdirSync(chromeCacheDir);
      for (const ver of versions) {
        // Linux: chrome-linux64/chrome, Mac: chrome-mac-arm64/...  
        const linuxBin = join(chromeCacheDir, ver, 'chrome-linux64', 'chrome');
        if (existsSync(linuxBin)) {
          console.log(`[Scraper] Using Chrome from Puppeteer cache: ${linuxBin}`);
          return linuxBin;
        }
        const macBin = join(chromeCacheDir, ver, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
        if (existsSync(macBin)) {
          console.log(`[Scraper] Using Chrome from Puppeteer cache: ${macBin}`);
          return macBin;
        }
      }
    } catch (e) {
      console.warn('[Scraper] Failed to scan Chrome cache dir:', e);
    }
  }

  console.warn('[Scraper] Chrome executable not found in system paths or cache; relying on Puppeteer default');
  return undefined;
}

// Launch mutex to prevent concurrent browser launches
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;

  // If another launch is already in flight, wait for it
  if (browserLaunchPromise) return browserLaunchPromise;

  browserLaunchPromise = (async () => {
    try {
      // Re-check after acquiring the "lock" - another caller may have resolved
      if (browserInstance && browserInstance.connected) return browserInstance;

      console.log('[Scraper] Launching Puppeteer browser...');
      const executablePath = resolveChromePath();
      const launchTimeoutMs = Number(process.env.PUPPETEER_LAUNCH_TIMEOUT_MS || 4500);

      const browser = await withTimeout(
        puppeteer.launch({
          headless: true,
          ...(executablePath ? { executablePath } : {}),
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
            '--disable-blink-features=AutomationControlled',
          ],
        }),
        launchTimeoutMs,
        'Puppeteer launch'
      );

      // Handle unexpected browser disconnection (crash, OOM) - clear stale ref
      browser.on('disconnected', () => {
        console.warn('[Scraper] Browser disconnected unexpectedly - clearing instance');
        if (browserInstance === browser) browserInstance = null;
      });

      browserInstance = browser;
      return browser;
    } finally {
      browserLaunchPromise = null;
    }
  })();

  return browserLaunchPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log('[Scraper] Browser closed');
  }
}

/** Extract structured data from raw HTML string (used by the fetch fallback) */
function parseHtml(html: string, baseUrl: string): ScrapeResult['data'] {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    : '';

  const getMeta = (attr: string, val: string) => {
    const r = new RegExp(`<meta[^>]+${attr}=["']${val}["'][^>]+content=["']([^"']+)["']`, 'i');
    const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${val}["']`, 'i');
    return (html.match(r) || html.match(r2) || [])[1] || '';
  };

  const description = getMeta('name', 'description');
  const keywords = getMeta('name', 'keywords');
  const ogTitle = getMeta('property', 'og:title');
  const ogDesc = getMeta('property', 'og:description');
  const ogImage = getMeta('property', 'og:image');
  const twitterCard = getMeta('name', 'twitter:card');
  const twitterTitle = getMeta('name', 'twitter:title');
  const twitterDescription = getMeta('name', 'twitter:description');

  const canonicalRe1 = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;
  const canonicalRe2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i;
  const canonical = (html.match(canonicalRe1) || html.match(canonicalRe2) || [])[1] || '';

  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const body = noScript.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, MAX_BODY_CAPTURE_CHARS);

  const extractHeadings = (tag: string) => {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const results: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text) results.push(text);
    }
    return results;
  };

  const h1 = extractHeadings('h1').slice(0, 10);
  const h2 = extractHeadings('h2').slice(0, 20);
  const h3 = extractHeadings('h3').slice(0, 30);

  const hostname = new URL(baseUrl).hostname;
  // Enhanced link extraction: collect anchor text and classify context
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let internal = 0;
  let external = 0;
  const internalAnchors: Array<{ href: string; text: string; context: 'nav' | 'content' | 'footer' | 'header' | 'sidebar' }> = [];
  let lm: RegExpExecArray | null;

  while ((lm = anchorRe.exec(html)) !== null) {
    const href = lm[1];
    const anchorText = lm[2].replace(/<[^>]+>/g, '').trim();
    if (href.startsWith('/') || href.includes(hostname)) {
      internal++;
      if (internalAnchors.length < 50) {
        internalAnchors.push({ href, text: anchorText.slice(0, 120), context: 'content' });
      }
    } else if (href.startsWith('http')) external++;
  }

  // Descriptive anchor ratio: non-generic anchors / total internal
  const genericAnchors = /^(click here|here|read more|learn more|link|more|this|go|see more|view|details)$/i;
  const descriptiveCount = internalAnchors.filter((a) => a.text.length > 2 && !genericAnchors.test(a.text)).length;
  const descriptiveAnchorRatio = internalAnchors.length > 0 ? descriptiveCount / internalAnchors.length : 0;

  const images = (html.match(/<img[\s\S]*?>/gi) || []).length;
  const imagesWithAlt = (html.match(/<img[^>]+alt=["'][^"']+["'][^>]*>/gi) || []).length;
  const wordCount = body.split(/\s+/).filter((w) => w.length > 0).length;

  // Extract lang attribute from <html lang="...">
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const lang = langMatch ? langMatch[1].trim() : undefined;

  // Extract hreflang alternate links
  const hreflangRe = /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]*>/gi;
  const hreflangs: string[] = [];
  let hlMatch: RegExpExecArray | null;
  while ((hlMatch = hreflangRe.exec(html)) !== null) {
    hreflangs.push(hlMatch[1]);
  }

  const jsonLdRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jlMatch: RegExpExecArray | null;
  const rawJsonLdStrings: string[] = [];
  while ((jlMatch = jsonLdRe.exec(html)) !== null) {
    const txt = (jlMatch[1] || '').trim();
    if (txt) rawJsonLdStrings.push(txt);
  }

  const structured = parseJsonLdStrings(rawJsonLdStrings);

  const questionRe = /\?|^(who|what|when|where|why|how|is|are|does|do|can|should|which)\b/i;
  const questionH2s = h2.filter((t) => questionRe.test(t));

  function detectTldrFromBody(b: string) {
    if (!b || b.length < 30) return null;
    const markerRe = /\btl;?dr\b|\bsummary[:-]|\bin short\b|\bto summarize\b|\bkey takeaways\b/i;
    const markerMatch = b.match(markerRe);
    if (markerMatch) {
      const idx = markerMatch.index || 0;
      const slice = b.substring(idx, idx + 400);
      const end = slice.search(/\n\s*\n/);
      const txt = end >= 0 ? slice.substring(0, end) : slice.substring(0, 200);
      return txt.trim();
    }
    const firstPara = b.split(/\n\s*\n/)[0] || b.substring(0, 400);
    const words = firstPara.split(/\s+/).filter(Boolean);
    if (words.length > 5 && words.length <= 40) return firstPara.trim();
    return null;
  }

  const tldrText = detectTldrFromBody(body);
  const hasTldr = !!tldrText;
  const tldrPosition: 'top' | 'mid' | 'bottom' | 'none' = hasTldr ? 'top' : 'none';

  return {
    title,
    body,
    html: html.substring(0, MAX_HTML_CAPTURE_CHARS),
    structuredData: structured,
    questionH2Count: questionH2s.length,
    questionH2s,
    hasTldr,
    tldrText: tldrText || undefined,
    tldrPosition,
    meta: { description, keywords, ogTitle, ogDescription: ogDesc, ogImage, twitterCard, twitterTitle, twitterDescription },
    headings: { h1, h2, h3 },
    canonical,
    links: { internal, external, internalAnchors, descriptiveAnchorRatio },
    images,
    imagesWithAlt,
    wordCount,
    lang,
    hreflang: hreflangs.length > 0 ? hreflangs : undefined,
  };
}

function parseJsonLdStrings(raws: string[]): StructuredData {
  const rawParsed: any[] = [];
  const typesCount: Record<string, number> = {};

  function collectTypes(node: any) {
    if (!node || typeof node !== 'object') return;
    const t = node['@type'] || node['type'] || null;
    if (t) {
      if (Array.isArray(t)) {
        t.forEach((tt: string) => {
          typesCount[tt] = (typesCount[tt] || 0) + 1;
        });
      } else if (typeof t === 'string') {
        typesCount[t] = (typesCount[t] || 0) + 1;
      }
    }
    if (Array.isArray(node['@graph'])) node['@graph'].forEach(collectTypes);
    Object.values(node).forEach((v) => {
      if (Array.isArray(v)) v.forEach(collectTypes);
      else if (v && typeof v === 'object') collectTypes(v);
    });
  }

  for (const s of raws) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => {
          rawParsed.push(p);
          collectTypes(p);
        });
      } else {
        rawParsed.push(parsed);
        collectTypes(parsed);
      }
    } catch {
      const objMatch = s.match(/(\{[\s\S]*\})/);
      if (objMatch) {
        try {
          const p2 = JSON.parse(objMatch[1]);
          if (Array.isArray(p2)) {
            p2.forEach((p) => {
              rawParsed.push(p);
              collectTypes(p);
            });
          } else {
            rawParsed.push(p2);
            collectTypes(p2);
          }
        } catch {}
      }
    }
  }

  const uniqueTypes = Object.keys(typesCount);
  return {
    jsonLdCount: rawParsed.length,
    types: typesCount,
    uniqueTypes,
    hasLocalBusiness: !!uniqueTypes.find((t) => /LocalBusiness/i.test(t)),
    hasFAQ: !!uniqueTypes.find((t) => /FAQPage|FAQ/i.test(t)),
    hasService: !!uniqueTypes.find((t) => /Service/i.test(t)),
    raw: rawParsed.map((r) => (r && typeof r === 'object' ? r : null)).filter(Boolean),
  };
}

async function fetchFallback(url: string, timeoutMs: number): Promise<ScrapeResult> {
  console.log(`[Scraper] HTTP fetch fallback for ${url}`);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
    });

    const html = await res.text();
    console.log(`[Scraper] Fetch got ${html.length} chars from ${url}`);

    const data = parseHtml(html, url);

    try {
      const [robotsResult, llmsResult, sitemapResult] = await Promise.all([
        fetchRobotsForOrigin(new URL(url).origin),
        fetchLlmsTxt(new URL(url).origin),
        fetchSitemap(new URL(url).origin),
      ]);
      data.robots = robotsResult;
      data.llmsTxt = llmsResult;
      data.sitemap = sitemapResult;

      // Compute per-crawler access from robots data
      if (robotsResult.fetched && robotsResult.rules) {
        const crawlers = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Anthropic-ai', 'Google-Extended', 'PerplexityBot', 'Applebot-Extended', 'Amazonbot', 'CCBot', 'Bytespider', 'FacebookBot', 'Meta-ExternalAgent', 'Cohere-ai', 'YouBot', 'BingPreview', 'bingbot', 'OAI-SearchBot', 'DuckAssistBot', 'PhindBot'];
        const access: Record<string, boolean> = {};
        for (const crawler of crawlers) {
          access[crawler] = evaluateAgentAllowed(robotsResult.rules, crawler);
        }
        data.aiCrawlerAccess = access;
      }
    } catch {}

    return { url, data };
  } finally {
    clearTimeout(t);
  }
}

export async function scrapeWebsite(inputUrl: string): Promise<ScrapeResult> {
  const startTime = Date.now();

  // Defense-in-depth: reject private/local hosts even if caller forgot
  if (process.env.NODE_ENV === 'production') {
    const urlCheck = normalizePublicHttpUrl(inputUrl);
    if (!urlCheck.ok) {
      throw new Error(`[Scraper] Blocked URL: ${urlCheck.error}`);
    }
  }

  const parsedUrl = new URL(inputUrl);
  console.log(`[Scraper] Starting scrape: ${parsedUrl.href}`);

  // Budget tuned to keep /api/analyze under proxy limits.
  const SCRAPE_BUDGET_MS = Number(process.env.SCRAPE_BUDGET_MS || 12_000);

  // 1) Try fast HTTP fetch first (most sites)
  let fetchResult: ScrapeResult | null = null;
  try {
    const httpTimeout = Math.min(8000, Math.max(3000, Math.floor(SCRAPE_BUDGET_MS * 0.6)));
    const result = await fetchFallback(parsedUrl.href, httpTimeout);

    const wc = result.data.wordCount || 0;
    const hasHeadings =
      (result.data.headings?.h1?.length || 0) > 0 || (result.data.headings?.h2?.length || 0) > 0;

    if (wc >= 50 && (result.data.title || hasHeadings)) {
      const pageLoadMs = Date.now() - startTime;
      console.log(
        `[Scraper]  HTTP fetch succeeded in ${pageLoadMs}ms (${wc} words, title="${result.data.title}")`
      );
      return {
        ...result,
        data: {
          ...result.data,
          pageLoadMs,
        },
      };
    }

    fetchResult = result;
    console.log(`[Scraper] HTTP fetch returned thin content (${wc} words) - trying Puppeteer`);
  } catch (fetchErr: any) {
    console.log(`[Scraper] HTTP fetch failed (${fetchErr.message}) - trying Puppeteer`);
  }

  // 2) If there’s no time left, return the thin fetch result (or fail)
  const elapsed = Date.now() - startTime;
  const remainingBudget = SCRAPE_BUDGET_MS - elapsed;
  if (remainingBudget <= 4500) {
    if (fetchResult) {
      const pageLoadMs = Date.now() - startTime;
      console.warn(`[Scraper] No budget for Puppeteer, using thin HTTP fetch (${fetchResult.data.wordCount || 0} words)`);
      return {
        ...fetchResult,
        data: {
          ...fetchResult.data,
          pageLoadMs,
        },
      };
    }
    throw new Error(`Scrape budget exhausted (${elapsed}ms elapsed, budget=${SCRAPE_BUDGET_MS}ms)`);
  }

  // 3) Puppeteer render (bounded)
  const puppeteerBudgetMs = Math.min(10_000, remainingBudget - 500);
  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    page = await withTimeout(browser.newPage(), 1500, 'Puppeteer newPage');

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.evaluateOnNewDocument(() => {
      try {
        (window as any).__aivis_lcp = 0;
        const po = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              if (entry && (entry as any).entryType === 'largest-contentful-paint') {
                const v = (entry as any).renderTime || (entry as any).startTime || 0;
                (window as any).__aivis_lcp = Math.max((window as any).__aivis_lcp || 0, v);
              }
            }
          } catch {}
        });
        po.observe({ type: 'largest-contentful-paint', buffered: true } as any);
      } catch {}
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setDefaultNavigationTimeout(puppeteerBudgetMs);
    await page.setDefaultTimeout(puppeteerBudgetMs);

    await withTimeout(
      page.goto(parsedUrl.href, { waitUntil: 'domcontentloaded', timeout: puppeteerBudgetMs }),
      puppeteerBudgetMs + 250,
      'Puppeteer goto'
    );

    // Quick settle for static sites
    await new Promise((r) => setTimeout(r, 350));

    // Content-aware wait: poll for body text in case the site is SPA / JS-rendered.
    // If body is still thin after initial settle, keep checking up to ~2.5s more.
    const THIN_WORD_THRESHOLD = 30;
    const POLL_INTERVAL_MS = 300;
    const MAX_EXTRA_WAIT_MS = Math.min(2500, puppeteerBudgetMs - 1500);
    if (MAX_EXTRA_WAIT_MS > 0) {
      let waited = 0;
      while (waited < MAX_EXTRA_WAIT_MS) {
        const wc = await page.evaluate(() => {
          const clone = document.body?.cloneNode(true) as HTMLElement;
          if (!clone) return 0;
          clone.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
          const text = (clone.innerText || clone.textContent || '').trim();
          return text.split(/\s+/).filter((w: string) => w.length > 0).length;
        }).catch(() => 0);
        if (wc >= THIN_WORD_THRESHOLD) break;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        waited += POLL_INTERVAL_MS;
      }
    }

    const data = (await withTimeout(
      page.evaluate(() => {
        const title = document.title || '';
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
        const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
        const twitterCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || '';
        const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '';
        const twitterDescription = document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '';
        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';

        const bodyClone = document.body.cloneNode(true) as HTMLElement;
        bodyClone.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
        const body = (bodyClone.innerText || bodyClone.textContent || '').substring(0, 15000);

        const h1 = Array.from(document.querySelectorAll('h1'))
          .map((el) => el.textContent?.trim() || '')
          .slice(0, 10);
        const h2 = Array.from(document.querySelectorAll('h2'))
          .map((el) => el.textContent?.trim() || '')
          .slice(0, 20);
        const h3 = Array.from(document.querySelectorAll('h3'))
          .map((el) => el.textContent?.trim() || '')
          .slice(0, 30);

        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        const currentHost = window.location.hostname;
        let internal = 0;
        let external = 0;
        const internalAnchors: Array<{ href: string; text: string; context: 'nav' | 'content' | 'footer' | 'header' | 'sidebar' }> = [];
        const genericAnchors = /^(click here|here|read more|learn more|link|more|this|go|see more|view|details)$/i;

        allLinks.forEach((link) => {
          const href = link.getAttribute('href') || '';
          const anchorText = (link.textContent || '').trim();
          if (href.startsWith('/') || href.includes(currentHost)) {
            internal++;
            if (internalAnchors.length < 50) {
              // Classify context by nearest semantic parent
              let context: 'nav' | 'content' | 'footer' | 'header' | 'sidebar' = 'content';
              const closest = link.closest('nav, footer, header, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]');
              if (closest) {
                const tag = closest.tagName.toLowerCase();
                const role = closest.getAttribute('role') || '';
                if (tag === 'nav' || role === 'navigation') context = 'nav';
                else if (tag === 'footer' || role === 'contentinfo') context = 'footer';
                else if (tag === 'header' || role === 'banner') context = 'header';
                else if (tag === 'aside' || role === 'complementary') context = 'sidebar';
              }
              internalAnchors.push({ href, text: anchorText.slice(0, 120), context });
            }
          } else if (href.startsWith('http')) external++;
        });

        const descriptiveCount = internalAnchors.filter((a: any) => a.text.length > 2 && !genericAnchors.test(a.text)).length;
        const descriptiveAnchorRatio = internalAnchors.length > 0 ? descriptiveCount / internalAnchors.length : 0;

        const allImages = Array.from(document.querySelectorAll('img'));
        const images = allImages.length;
        const imagesWithAlt = allImages.filter((img) => {
          const alt = img.getAttribute('alt');
          return alt !== null && alt.trim().length > 0;
        }).length;

        // Extract image src + alt for OCR processing (first 15 meaningful images)
        const imageDetails = allImages
          .map((img) => ({
            src: img.getAttribute('src') || img.getAttribute('data-src') || '',
            alt: (img.getAttribute('alt') || '').trim(),
          }))
          .filter((img) => img.src.length > 0)
          .slice(0, 15);
        const wordCount = body.split(/\s+/).filter((w) => w.length > 0).length;
        const html = document.documentElement.outerHTML.substring(0, 100000);
        const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
          .map((s) => (s.textContent || '').substring(0, 80_000))
          .filter(Boolean)
          .slice(0, 15);

        // Extract lang attribute
        const lang = document.documentElement.getAttribute('lang') || undefined;

        // Extract hreflang alternate links
        const hreflangEls = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'));
        const hreflang = hreflangEls.map((el) => el.getAttribute('hreflang') || '').filter(Boolean);

        return {
          title,
          body,
          html,
          ldJson: ld,
          meta: { description, keywords, ogTitle, ogDescription, ogImage, twitterCard, twitterTitle, twitterDescription },
          headings: { h1, h2, h3 },
          canonical,
          links: { internal, external, internalAnchors, descriptiveAnchorRatio },
          images,
          imagesWithAlt,
          imageDetails,
          wordCount,
          lang,
          hreflang: hreflang.length > 0 ? hreflang : undefined,

          robots: { fetched: false },

          structuredData: {
            jsonLdCount: 0,
            types: {},
            uniqueTypes: [],
            hasLocalBusiness: false,
            hasFAQ: false,
            hasService: false,
            raw: [],
          },

          questionH2Count: 0,
          questionH2s: [],
          hasTldr: false,
          tldrText: undefined,
          tldrPosition: 'none' as const,
        };
      }),
      puppeteerBudgetMs,
      'Puppeteer evaluate'
    )) as unknown as EvalData;

    try {
      const lcpMs = await withTimeout(page.evaluate(() => (window as any).__aivis_lcp || 0), 800, 'LCP eval');
      data.lcpMs = typeof lcpMs === 'number' ? Math.round(lcpMs) : 0;
    } catch {}

    // Close page early
    try {
      await withTimeout(page.close(), 800, 'Puppeteer close');
    } catch {}
    page = null;

    try {
      if (Array.isArray(data.ldJson) && data.ldJson.length > 0) data.structuredData = parseJsonLdStrings(data.ldJson);
    } catch (e: any) {
      console.warn('[Scraper] JSON-LD parse error', e?.message || e);
    }

    try {
      const [robotsResult, llmsResult, sitemapResult] = await Promise.all([
        fetchRobotsForOrigin(parsedUrl.origin),
        fetchLlmsTxt(parsedUrl.origin),
        fetchSitemap(parsedUrl.origin),
      ]);
      data.robots = robotsResult;
      data.llmsTxt = llmsResult;
      data.sitemap = sitemapResult;

      // Compute per-crawler access from robots data
      if (robotsResult.fetched && robotsResult.rules) {
        const crawlers = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Anthropic-ai', 'Google-Extended', 'PerplexityBot', 'Applebot-Extended', 'Amazonbot', 'CCBot', 'Bytespider', 'FacebookBot', 'Meta-ExternalAgent', 'Cohere-ai', 'YouBot', 'BingPreview', 'bingbot', 'OAI-SearchBot', 'DuckAssistBot', 'PhindBot'];
        const access: Record<string, boolean> = {};
        for (const crawler of crawlers) {
          access[crawler] = evaluateAgentAllowed(robotsResult.rules, crawler);
        }
        data.aiCrawlerAccess = access;
      }
    } catch {}

    try {
      const h2s: string[] = data.headings?.h2 || [];
      const questionRe = /\?|^(who|what|when|where|why|how|is|are|does|do|can|should|which)\b/i;
      const questionH2s = h2s.filter((t) => questionRe.test(t));
      data.questionH2Count = questionH2s.length;
      data.questionH2s = questionH2s;

      const tldrText = (() => {
        if (!data.body) return null;
        const b = data.body as string;
        const markerRe = /\btl;dr\b|\bsummary[:-]|\bin short\b|\bto summarize\b|\bkey takeaways\b/i;
        const markerMatch = b.match(markerRe);
        if (markerMatch) {
          const idx = markerMatch.index || 0;
          const slice = b.substring(idx, idx + 400);
          const end = slice.search(/\n\s*\n/);
          const txt = end >= 0 ? slice.substring(0, end) : slice.substring(0, 200);
          return txt.trim();
        }
        const firstPara = (b.split(/\n\s*\n/)[0] || b.substring(0, 400)).trim();
        const words = firstPara.split(/\s+/).filter(Boolean);
        if (words.length > 5 && words.length <= 40) return firstPara;
        return null;
      })();

      data.hasTldr = !!tldrText;
      data.tldrText = tldrText || undefined;
      data.tldrPosition = tldrText ? 'top' : 'none';
    } catch {}

    console.log(`[Scraper]  Puppeteer scraped in ${Date.now() - startTime}ms`);

    // ── OCR: extract text from page images (non-blocking, best-effort) ──
    let ocrData: import('./ocrService.js').OcrPageResult | undefined;
    if (data.imageDetails && data.imageDetails.length > 0) {
      try {
        const { ocrPageImages } = await import('./ocrService.js');
        ocrData = await ocrPageImages(data.imageDetails, parsedUrl.href);
        if (ocrData.images.length > 0) {
          console.log(`[Scraper]  OCR: ${ocrData.images.length}/${data.imageDetails.length} images yielded text (${ocrData.totalOcrWords} words, ${ocrData.processingTimeMs}ms)`);
        }
      } catch (ocrErr: any) {
        console.warn(`[Scraper] OCR failed (non-fatal):`, ocrErr?.message);
      }
    }

    const { ldJson: _ldJson, ...rest } = data;
    const pageLoadMs = Date.now() - startTime;
    return {
      url: parsedUrl.href,
      data: {
        ...(rest as unknown as ScrapeResult['data']),
        pageLoadMs,
        ...(ocrData ? { ocrData } : {}),
      },
    };
  } catch (error: any) {
    console.error('[Scraper] Puppeteer error:', error?.message || error);

    if (fetchResult) {
      const pageLoadMs = Date.now() - startTime;
      console.log(`[Scraper] Falling back to thin HTTP fetch result (${fetchResult.data.wordCount || 0} words)`);
      return {
        ...fetchResult,
        data: {
          ...fetchResult.data,
          pageLoadMs,
        },
      };
    }

    throw new Error(`Failed to scrape website: ${error?.message || String(error)}`);
  } finally {
    // Ensure page is always closed to prevent Puppeteer page leaks
    if (page) {
      try { await page.close(); } catch {}
      page = null;
    }
  }
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);