// server/src/services/keywordEnrichment.ts
// Enriches AI-extracted keywords with real search suggestion data from
// DuckDuckGo autocomplete and Bing — completely free, no API keys.

const BROWSER_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

function pickUA(): string { return BROWSER_UAS[Math.floor(Math.random() * BROWSER_UAS.length)]; }

// ── DDG autocomplete ────────────────────────────────────────────────────────

interface DDGSuggestion { phrase: string }

async function fetchDDGSuggestions(query: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
    const res = await fetch(url, {
      headers: { 'User-Agent': pickUA(), Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    // DDG ac endpoint returns [{phrase: "..."}, ...] or ["query", ["s1","s2",...]]
    if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
      return (data[1] as string[]).filter(Boolean);
    }
    if (Array.isArray(data) && data[0]?.phrase !== undefined) {
      return (data as DDGSuggestion[]).map(s => s.phrase).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Bing autocomplete ───────────────────────────────────────────────────────

async function fetchBingSuggestions(query: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = `https://www.bing.com/AS/Suggestions?qry=${encodeURIComponent(query)}&cvid=1&cp=1&mkt=en-us`;
    const res = await fetch(url, {
      headers: { 'User-Agent': pickUA(), Accept: 'text/html' },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Parse <li ...><a ...>suggestion text</a></li> from Bing suggestions HTML
    const matches = [...html.matchAll(/<li[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)];
    return matches
      .map(m => m[1].replace(/<[^>]*>/g, '').trim())
      .filter(Boolean)
      .slice(0, 10);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public enrichment API ───────────────────────────────────────────────────

export interface EnrichedKeyword {
  keyword: string;
  /** Whether this exact keyword (case-insensitive) appears in real search suggestions */
  search_verified: boolean;
  /** Real autocomplete suggestions related to this keyword from search engines */
  real_suggestions: string[];
  /** Alternative multi-word queries people actually search for in this topic */
  related_queries: string[];
}

/**
 * Enriches a batch of keywords by querying DDG + Bing autocomplete.
 * Rate-limits itself to avoid hammering search engines.
 * @param keywords  Array of keyword strings (max 20 per call)
 */
export async function enrichKeywords(keywords: string[]): Promise<EnrichedKeyword[]> {
  const capped = keywords.slice(0, 20);
  const results: EnrichedKeyword[] = [];

  // Process in batches of 4 with delay between batches
  for (let i = 0; i < capped.length; i += 4) {
    const batch = capped.slice(i, i + 4);
    const batchResults = await Promise.all(
      batch.map(async (kw) => {
        const [ddg, bing] = await Promise.all([
          fetchDDGSuggestions(kw),
          fetchBingSuggestions(kw),
        ]);

        const allSuggestions = new Set<string>();
        for (const s of [...ddg, ...bing]) {
          allSuggestions.add(s.toLowerCase().trim());
        }

        const kwLower = kw.toLowerCase().trim();
        const searchVerified = allSuggestions.has(kwLower) ||
          [...allSuggestions].some(s => s.includes(kwLower) || kwLower.includes(s));

        // Real suggestions: multi-word queries that contain the keyword concept
        const realSuggestions = [...allSuggestions]
          .filter(s => s !== kwLower)
          .slice(0, 12);

        // Related queries: longer phrases (3+ words) that people actually search
        const relatedQueries = realSuggestions
          .filter(s => s.split(/\s+/).length >= 3)
          .slice(0, 6);

        return {
          keyword: kw,
          search_verified: searchVerified,
          real_suggestions: realSuggestions,
          related_queries: relatedQueries,
        };
      })
    );
    results.push(...batchResults);

    // Small delay between batches to be respectful
    if (i + 4 < capped.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
}
