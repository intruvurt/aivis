import type { WebSearchPresenceResult, WebSearchResultEntry } from '../../../shared/types.js';
import type { SearchLocaleProfile } from './searchLocale.js';
import { inferSearchLocaleProfile } from './searchLocale.js';

interface WikiOpenSearchResponse {
  0: string;
  1: string[];
  2: string[];
  3: string[];
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function checkWikipediaPresence(
  query: string,
  brandName: string,
  targetUrl: string,
  competitorUrls: string[] = [],
  localeProfile: SearchLocaleProfile = inferSearchLocaleProfile(targetUrl),
): Promise<WebSearchPresenceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const endpoint = `https://${localeProfile.wikipediaLanguage}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&namespace=0&format=json`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AiVIS-CitationTester/1.0 (+https://aivis.biz)',
      },
      signal: controller.signal,
    });

    if (!res.ok) return emptyWikipediaResult();

    const data = (await res.json()) as WikiOpenSearchResponse;
    const titles = Array.isArray(data?.[1]) ? data[1] : [];
    const snippets = Array.isArray(data?.[2]) ? data[2] : [];
    const urls = Array.isArray(data?.[3]) ? data[3] : [];

    const topResults: WebSearchResultEntry[] = urls.map((url, idx) => ({
      title: String(titles[idx] || '').trim() || 'Wikipedia',
      url: String(url || '').trim(),
      description: String(snippets[idx] || '').trim(),
      position: idx + 1,
    }))
      .filter((r) => !!r.url)
      .slice(0, 10);

    const targetHost = extractHost(targetUrl);
    const brandLower = brandName.toLowerCase();

    const matching_results = topResults.filter((r) => {
      const t = r.title.toLowerCase();
      const d = r.description.toLowerCase();
      return t.includes(brandLower) || d.includes(brandLower) || r.url.toLowerCase().includes(targetHost);
    });

    const competitor_urls_found = competitorUrls.filter((compUrl) => {
      const host = extractHost(compUrl);
      const label = host.split('.')[0]?.toLowerCase() || '';
      return topResults.some((r) => r.title.toLowerCase().includes(label) || r.description.toLowerCase().includes(label));
    });

    return {
      found: matching_results.length > 0,
      position: matching_results[0]?.position || 0,
      results_checked: topResults.length,
      matching_results,
      competitor_urls_found,
      top_results: topResults,
      source: 'wikipedia_web',
    };
  } catch {
    return emptyWikipediaResult();
  } finally {
    clearTimeout(timeout);
  }
}

function emptyWikipediaResult(): WebSearchPresenceResult {
  return {
    found: false,
    position: 0,
    results_checked: 0,
    matching_results: [],
    competitor_urls_found: [],
    top_results: [],
    source: 'wikipedia_web',
  };
}
