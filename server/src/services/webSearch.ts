// server/src/services/webSearch.ts
// DuckDuckGo HTML + Bing web search — completely free, no API keys required.
// Scrapes DDG HTML lite and Bing search with realistic browser headers.

import type { WebSearchPresenceResult, WebSearchResultEntry } from '../../../shared/types.js';
import type { SearchLocaleProfile } from './searchLocale.js';
import { inferSearchLocaleProfile } from './searchLocale.js';

const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

function pickUserAgent(): string {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

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

function parseDDGHtmlResults(html: string): Array<{ title: string; snippet: string; href: string }> {
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

  // Pass 2: result-block patterns
  if (anchors.length === 0) {
    while ((match = resultBlockRegex.exec(html)) !== null) {
      const href = resolveResultUrl(match[1]);
      const title = stripHtml(match[2]);
      if (!href || !title || seen.has(href)) continue;
      if (!/^https?:\/\//i.test(href)) continue;
      if (href.includes('duckduckgo.com')) continue;
      seen.add(href);
      anchors.push({ href, title });
      if (anchors.length >= 20) break;
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
      if (anchors.length >= 20) break;
    }
  }

  return anchors.slice(0, 20).map((a, index) => ({
    title: a.title,
    snippet: snippets[index] || '',
    href: a.href,
  }));
}

/**
 * Query DuckDuckGo HTML search and check if a brand/URL appears in results.
 * Completely free — no API key, no signup.
 * Drop-in replacement for the old checkBraveSearchPresence().
 */
export async function checkWebSearchPresence(
  query: string,
  brandName: string,
  targetUrl: string,
  competitorUrls: string[] = [],
  localeProfile: SearchLocaleProfile = inferSearchLocaleProfile(targetUrl)
): Promise<WebSearchPresenceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=${encodeURIComponent(localeProfile.ddgRegion)}`;

    const res = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': pickUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': `${localeProfile.bingLanguage},en;q=0.8`,
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[WebSearch] DDG returned ${res.status} for query="${query.slice(0, 60)}"`);
      return emptyDDGResult();
    }

    const html = await res.text();
    const parsed = parseDDGHtmlResults(html);

    if (parsed.length === 0 && html.length > 0) {
      console.warn(`[WebSearch] DDG returned HTML (${html.length} chars) but parser found 0 results for query="${query.slice(0, 60)}"`);
    }

    const targetHostname = extractHost(targetUrl);
    const brandLower = brandName.toLowerCase();

    const topResults: WebSearchResultEntry[] = parsed.slice(0, 20).map((r, i) => ({
      title: r.title,
      url: r.href,
      description: r.snippet,
      position: i + 1,
    }));

    // Find brand/target matches
    const matchingResults: WebSearchResultEntry[] = [];
    for (const result of topResults) {
      const resultHost = extractHost(result.url);
      const titleLower = result.title.toLowerCase();
      const descLower = result.description.toLowerCase();

      if (
        resultHost === targetHostname ||
        titleLower.includes(brandLower) ||
        descLower.includes(brandLower) ||
        result.url.toLowerCase().includes(targetHostname)
      ) {
        matchingResults.push(result);
      }
    }

    // Find competitor matches
    const competitorUrlsFound: string[] = [];
    for (const compUrl of competitorUrls) {
      const compHost = extractHost(compUrl);
      const compBrand = compHost.split('.')[0];
      const found = topResults.some(r => {
        const h = extractHost(r.url);
        return (
          h === compHost ||
          r.title.toLowerCase().includes(compBrand) ||
          r.description.toLowerCase().includes(compBrand)
        );
      });
      if (found) competitorUrlsFound.push(compUrl);
    }

    console.log(
      `[WebSearch] query="${query.slice(0, 60)}", results=${topResults.length}, found=${matchingResults.length > 0}, pos=${matchingResults[0]?.position || 0}`
    );

    return {
      found: matchingResults.length > 0,
      position: matchingResults[0]?.position || 0,
      results_checked: topResults.length,
      matching_results: matchingResults,
      competitor_urls_found: competitorUrlsFound,
      top_results: topResults.slice(0, 10),
      source: 'ddg_web',
    };
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'unknown');
    console.warn(`[WebSearch] DDG fetch failed: ${reason} for query="${query.slice(0, 60)}"`);
    return emptyDDGResult();
  } finally {
    clearTimeout(timeout);
  }
}

function emptyDDGResult(): WebSearchPresenceResult {
  return {
    found: false,
    position: 0,
    results_checked: 0,
    matching_results: [],
    competitor_urls_found: [],
    top_results: [],
    source: 'ddg_web',
  };
}

// ── Bing Web Search (HTML scrape) ────────────────────────────────────────────

function parseBingHtmlResults(html: string): Array<{ title: string; snippet: string; href: string }> {
  // Bing organic results live inside <li class="b_algo"> blocks
  const algoBlockRegex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
  const anchorRegex = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
  const snippetRegex = /<p[^>]*>([\s\S]*?)<\/p>/i;

  const results: Array<{ title: string; snippet: string; href: string }> = [];
  let block: RegExpExecArray | null;

  while ((block = algoBlockRegex.exec(html)) !== null) {
    const inner = block[1];
    const aMatch = anchorRegex.exec(inner);
    if (!aMatch) continue;

    const href = decodeHtmlEntities(aMatch[1]);
    if (!/^https?:\/\//i.test(href)) continue;
    if (href.includes('bing.com') || href.includes('microsoft.com/bing')) continue;

    const title = stripHtml(aMatch[2]);
    const sMatch = snippetRegex.exec(inner);
    const snippet = sMatch ? stripHtml(sMatch[1]) : '';

    if (!title) continue;
    results.push({ title, snippet, href });
    if (results.length >= 20) break;
  }

  // Fallback: broader <cite> + next-sibling anchor pattern
  if (results.length === 0) {
    const citeRegex = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = citeRegex.exec(html)) !== null) {
      const href = decodeHtmlEntities(cMatch[1]);
      if (!/^https?:\/\//i.test(href)) continue;
      if (href.includes('bing.com')) continue;
      const title = stripHtml(cMatch[2]);
      if (!title) continue;
      results.push({ title, snippet: '', href });
      if (results.length >= 20) break;
    }
  }

  return results;
}

/**
 * Query Bing web search and check if a brand/URL appears in results.
 * Completely free — no API key, scrapes bing.com/search HTML.
 */
export async function checkBingSearchPresence(
  query: string,
  brandName: string,
  targetUrl: string,
  competitorUrls: string[] = [],
  localeProfile: SearchLocaleProfile = inferSearchLocaleProfile(targetUrl)
): Promise<WebSearchPresenceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&cc=${encodeURIComponent(localeProfile.region.toUpperCase())}&setlang=${encodeURIComponent(localeProfile.bingLanguage)}&mkt=${encodeURIComponent(localeProfile.bingMarket)}`;

    const res = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': pickUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': `${localeProfile.bingLanguage},en;q=0.8`,
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[WebSearch] Bing returned ${res.status} for query="${query.slice(0, 60)}"`);
      return emptyBingResult();
    }

    const html = await res.text();
    const parsed = parseBingHtmlResults(html);

    if (parsed.length === 0 && html.length > 0) {
      console.warn(`[WebSearch] Bing returned HTML (${html.length} chars) but parser found 0 results for query="${query.slice(0, 60)}"`);
    }

    const targetHostname = extractHost(targetUrl);
    const brandLower = brandName.toLowerCase();

    const topResults: WebSearchResultEntry[] = parsed.slice(0, 20).map((r, i) => ({
      title: r.title,
      url: r.href,
      description: r.snippet,
      position: i + 1,
    }));

    const matchingResults: WebSearchResultEntry[] = [];
    for (const result of topResults) {
      const resultHost = extractHost(result.url);
      const titleLower = result.title.toLowerCase();
      const descLower = result.description.toLowerCase();

      if (
        resultHost === targetHostname ||
        titleLower.includes(brandLower) ||
        descLower.includes(brandLower) ||
        result.url.toLowerCase().includes(targetHostname)
      ) {
        matchingResults.push(result);
      }
    }

    const competitorUrlsFound: string[] = [];
    for (const compUrl of competitorUrls) {
      const compHost = extractHost(compUrl);
      const compBrand = compHost.split('.')[0];
      const found = topResults.some(r => {
        const h = extractHost(r.url);
        return (
          h === compHost ||
          r.title.toLowerCase().includes(compBrand) ||
          r.description.toLowerCase().includes(compBrand)
        );
      });
      if (found) competitorUrlsFound.push(compUrl);
    }

    console.log(
      `[WebSearch] Bing query="${query.slice(0, 60)}", results=${topResults.length}, found=${matchingResults.length > 0}, pos=${matchingResults[0]?.position || 0}`
    );

    return {
      found: matchingResults.length > 0,
      position: matchingResults[0]?.position || 0,
      results_checked: topResults.length,
      matching_results: matchingResults,
      competitor_urls_found: competitorUrlsFound,
      top_results: topResults.slice(0, 10),
      source: 'bing_web',
    };
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'unknown');
    console.warn(`[WebSearch] Bing fetch failed: ${reason} for query="${query.slice(0, 60)}"`);
    return emptyBingResult();
  } finally {
    clearTimeout(timeout);
  }
}

function emptyBingResult(): WebSearchPresenceResult {
  return {
    found: false,
    position: 0,
    results_checked: 0,
    matching_results: [],
    competitor_urls_found: [],
    top_results: [],
    source: 'bing_web',
  };
}

/**
 * Raw Bing HTML scrape — returns parsed {title, snippet, href}[] without
 * any brand-matching logic. Used as fallback for authority checks when DDG
 * is rate-limited.
 */
export async function scrapeBingRaw(
  query: string,
  maxResults = 10
): Promise<Array<{ title: string; snippet: string; href: string }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&setlang=en`;
    const res = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': pickUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseBingHtmlResults(html).slice(0, maxResults);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Raw DuckDuckGo HTML scrape — returns parsed {title, snippet, href}[] without
 * any brand-matching logic. Mirrors scrapeBingRaw() interface.
 */
export async function scrapeDDGRaw(
  query: string,
  maxResults = 20
): Promise<Array<{ title: string; snippet: string; href: string }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': pickUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseDDGHtmlResults(html).slice(0, maxResults);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Brave Web Search (HTML scrape) ──────────────────────────────────────────

function parseBraveHtmlResults(html: string): Array<{ title: string; snippet: string; href: string }> {
  // Brave organic results live inside <div class="snippet" data-type="web"> blocks
  // Each has an <a class="result-header"> and <p class="snippet-description">
  const snippetBlockRegex = /<div[^>]*class="[^"]*snippet[^"]*"[^>]*data-type="web"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  const headerAnchorRegex = /<a[^>]*class="[^"]*(?:result-header|heading)[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
  const descRegex = /<p[^>]*class="[^"]*(?:snippet-description|snippet-content)[^"]*"[^>]*>([\s\S]*?)<\/p>/i;

  const results: Array<{ title: string; snippet: string; href: string }> = [];
  let block: RegExpExecArray | null;

  while ((block = snippetBlockRegex.exec(html)) !== null) {
    const inner = block[1];
    const aMatch = headerAnchorRegex.exec(inner);
    if (!aMatch) continue;

    const href = decodeHtmlEntities(aMatch[1]);
    if (!/^https?:\/\//i.test(href)) continue;
    if (href.includes('brave.com/search') || href.includes('search.brave.com')) continue;

    const title = stripHtml(aMatch[2]);
    const dMatch = descRegex.exec(inner);
    const snippet = dMatch ? stripHtml(dMatch[1]) : '';

    if (!title) continue;
    results.push({ title, snippet, href });
    if (results.length >= 20) break;
  }

  // Fallback: broader <a> with href + <span class="url"> pattern
  if (results.length === 0) {
    const altRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>\s*<span[^>]*class="[^"]*url[^"]*"[^>]*>[\s\S]*?<\/span>\s*<\/a>\s*<a[^>]*>([\s\S]*?)<\/a>/gi;
    let aMatch: RegExpExecArray | null;
    while ((aMatch = altRegex.exec(html)) !== null) {
      const href = decodeHtmlEntities(aMatch[1]);
      if (href.includes('brave.com')) continue;
      const title = stripHtml(aMatch[2]);
      if (!title) continue;
      results.push({ title, snippet: '', href });
      if (results.length >= 20) break;
    }
  }

  return results;
}

/**
 * Query Brave Search and check if a brand/URL appears in results.
 * Completely free — no API key, scrapes search.brave.com HTML.
 */
export async function checkBraveSearchPresence(
  query: string,
  brandName: string,
  targetUrl: string,
  competitorUrls: string[] = [],
  localeProfile: SearchLocaleProfile = inferSearchLocaleProfile(targetUrl)
): Promise<WebSearchPresenceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web&country=${encodeURIComponent(localeProfile.braveCountry)}`;

    const res = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': pickUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': `${localeProfile.bingLanguage},en;q=0.8`,
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[WebSearch] Brave returned ${res.status} for query="${query.slice(0, 60)}"`);
      return emptyBraveResult();
    }

    const html = await res.text();
    const parsed = parseBraveHtmlResults(html);

    if (parsed.length === 0 && html.length > 0) {
      console.warn(`[WebSearch] Brave returned HTML (${html.length} chars) but parser found 0 results for query="${query.slice(0, 60)}"`);
    }

    const targetHostname = extractHost(targetUrl);
    const brandLower = brandName.toLowerCase();

    const topResults: WebSearchResultEntry[] = parsed.slice(0, 20).map((r, i) => ({
      title: r.title,
      url: r.href,
      description: r.snippet,
      position: i + 1,
    }));

    const matchingResults: WebSearchResultEntry[] = [];
    for (const result of topResults) {
      const resultHost = extractHost(result.url);
      const titleLower = result.title.toLowerCase();
      const descLower = result.description.toLowerCase();

      if (
        resultHost === targetHostname ||
        titleLower.includes(brandLower) ||
        descLower.includes(brandLower) ||
        result.url.toLowerCase().includes(targetHostname)
      ) {
        matchingResults.push(result);
      }
    }

    const competitorUrlsFound: string[] = [];
    for (const compUrl of competitorUrls) {
      const compHost = extractHost(compUrl);
      const compBrand = compHost.split('.')[0];
      const found = topResults.some(r => {
        const h = extractHost(r.url);
        return (
          h === compHost ||
          r.title.toLowerCase().includes(compBrand) ||
          r.description.toLowerCase().includes(compBrand)
        );
      });
      if (found) competitorUrlsFound.push(compUrl);
    }

    console.log(
      `[WebSearch] Brave query="${query.slice(0, 60)}", results=${topResults.length}, found=${matchingResults.length > 0}, pos=${matchingResults[0]?.position || 0}`
    );

    return {
      found: matchingResults.length > 0,
      position: matchingResults[0]?.position || 0,
      results_checked: topResults.length,
      matching_results: matchingResults,
      competitor_urls_found: competitorUrlsFound,
      top_results: topResults.slice(0, 10),
      source: 'brave_web',
    };
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'unknown');
    console.warn(`[WebSearch] Brave fetch failed: ${reason} for query="${query.slice(0, 60)}"`);
    return emptyBraveResult();
  } finally {
    clearTimeout(timeout);
  }
}

function emptyBraveResult(): WebSearchPresenceResult {
  return {
    found: false,
    position: 0,
    results_checked: 0,
    matching_results: [],
    competitor_urls_found: [],
    top_results: [],
    source: 'brave_web',
  };
}

function parseYahooHtmlResults(html: string): Array<{ title: string; snippet: string; href: string }> {
  const resultBlockRegex = /<div[^>]*class="[^"]*(?:algo|dd\s+algo)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  const headingRegex = /<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
  const snippetRegex = /<p[^>]*class="[^"]*(?:compText|lh-16)[^"]*"[^>]*>([\s\S]*?)<\/p>/i;
  const results: Array<{ title: string; snippet: string; href: string }> = [];
  let block: RegExpExecArray | null;

  while ((block = resultBlockRegex.exec(html)) !== null) {
    const inner = block[1];
    const heading = headingRegex.exec(inner);
    if (!heading) continue;
    const href = decodeHtmlEntities(heading[1]);
    if (!/^https?:\/\//i.test(href) || href.includes('search.yahoo.com')) continue;
    const title = stripHtml(heading[2]);
    if (!title) continue;
    const snippet = stripHtml(snippetRegex.exec(inner)?.[1] || '');
    results.push({ title, snippet, href });
    if (results.length >= 20) break;
  }

  if (results.length === 0) {
    const genericRegex = /<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = genericRegex.exec(html)) !== null) {
      const href = decodeHtmlEntities(match[1]);
      if (!/^https?:\/\//i.test(href) || href.includes('search.yahoo.com')) continue;
      const title = stripHtml(match[2]);
      if (!title) continue;
      results.push({ title, snippet: '', href });
      if (results.length >= 20) break;
    }
  }

  return results;
}

export async function checkYahooSearchPresence(
  query: string,
  brandName: string,
  targetUrl: string,
  competitorUrls: string[] = [],
  localeProfile: SearchLocaleProfile = inferSearchLocaleProfile(targetUrl)
): Promise<WebSearchPresenceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&vl=${encodeURIComponent(localeProfile.language)}`;

    const res = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': pickUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': `${localeProfile.bingLanguage},en;q=0.8`,
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return emptyYahooResult();
    }

    const html = await res.text();
    const parsed = parseYahooHtmlResults(html);
    const targetHostname = extractHost(targetUrl);
    const brandLower = brandName.toLowerCase();

    const topResults: WebSearchResultEntry[] = parsed.slice(0, 20).map((result, index) => ({
      title: result.title,
      url: result.href,
      description: result.snippet,
      position: index + 1,
    }));

    const matchingResults = topResults.filter((result) => {
      const resultHost = extractHost(result.url);
      const titleLower = result.title.toLowerCase();
      const descLower = result.description.toLowerCase();

      return (
        resultHost === targetHostname ||
        titleLower.includes(brandLower) ||
        descLower.includes(brandLower) ||
        result.url.toLowerCase().includes(targetHostname)
      );
    });

    const competitorUrlsFound = competitorUrls.filter((compUrl) => {
      const compHost = extractHost(compUrl);
      const compBrand = compHost.split('.')[0];
      return topResults.some((result) => {
        const resultHost = extractHost(result.url);
        return (
          resultHost === compHost ||
          result.title.toLowerCase().includes(compBrand) ||
          result.description.toLowerCase().includes(compBrand)
        );
      });
    });

    return {
      found: matchingResults.length > 0,
      position: matchingResults[0]?.position || 0,
      results_checked: topResults.length,
      matching_results: matchingResults,
      competitor_urls_found: competitorUrlsFound,
      top_results: topResults.slice(0, 10),
      source: 'yahoo_web',
    };
  } catch {
    return emptyYahooResult();
  } finally {
    clearTimeout(timeout);
  }
}

function emptyYahooResult(): WebSearchPresenceResult {
  return {
    found: false,
    position: 0,
    results_checked: 0,
    matching_results: [],
    competitor_urls_found: [],
    top_results: [],
    source: 'yahoo_web',
  };
}
