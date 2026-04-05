// server/src/services/duckDuckGoSearch.ts
// DuckDuckGo Instant Answer API - completely free, no API key required.
// Used to verify web presence via DuckDuckGo's knowledge graph and instant answers.

import type { WebSearchPresenceResult, WebSearchResultEntry } from '../../../shared/types.js';

/**
 * DuckDuckGo Instant Answer API response shape (partial).
 * See https://api.duckduckgo.com/api
 */
interface DDGInstantAnswer {
  Abstract?: string;
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  Heading?: string;
  Answer?: string;
  AnswerType?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
    Result?: string;
    Topics?: Array<{ Text?: string; FirstURL?: string; Result?: string }>;
  }>;
  Results?: Array<{
    Text?: string;
    FirstURL?: string;
    Result?: string;
  }>;
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Query DuckDuckGo Instant Answer API and check if a brand/URL appears.
 * Completely free - no API key, no signup, no rate limit published.
 * Returns a WebSearchPresenceResult with source: 'ddg_instant'.
 */
export async function checkDDGPresence(
  query: string,
  brandName: string,
  targetUrl: string,
  competitorUrls: string[] = []
): Promise<WebSearchPresenceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      no_html: '1',
      skip_disambig: '1',
    });

    const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`DDG API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as DDGInstantAnswer;

    // Collect all textual entries from DDG's response as searchable "results"
    const entries: WebSearchResultEntry[] = [];
    let pos = 1;

    // Abstract (main answer)
    if (data.AbstractText && data.AbstractURL) {
      entries.push({
        title: data.Heading || data.AbstractSource || 'Abstract',
        url: data.AbstractURL,
        description: data.AbstractText.slice(0, 300),
        position: pos++,
      });
    }

    // Direct results
    if (Array.isArray(data.Results)) {
      for (const r of data.Results) {
        if (r.FirstURL && r.Text) {
          entries.push({
            title: stripHtml(r.Result || r.Text),
            url: r.FirstURL,
            description: r.Text.slice(0, 300),
            position: pos++,
          });
        }
      }
    }

    // Related topics (flatten nested topic groups)
    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics) {
        if (topic.FirstURL && topic.Text) {
          entries.push({
            title: stripHtml(topic.Result || topic.Text),
            url: topic.FirstURL,
            description: topic.Text.slice(0, 300),
            position: pos++,
          });
        }
        // Nested topic groups
        if (Array.isArray(topic.Topics)) {
          for (const sub of topic.Topics) {
            if (sub.FirstURL && sub.Text) {
              entries.push({
                title: stripHtml(sub.Result || sub.Text),
                url: sub.FirstURL,
                description: sub.Text.slice(0, 300),
                position: pos++,
              });
            }
          }
        }
      }
    }

    // Inline answer text
    if (data.Answer) {
      entries.push({
        title: 'Instant Answer',
        url: '',
        description: data.Answer.slice(0, 300),
        position: pos++,
      });
    }

    const targetHostname = extractHost(targetUrl);
    const brandLower = brandName.toLowerCase();

    // Find brand/URL matches
    const matchingResults: WebSearchResultEntry[] = [];
    for (const entry of entries) {
      const entryHost = entry.url ? extractHost(entry.url) : '';
      const titleLower = entry.title.toLowerCase();
      const descLower = entry.description.toLowerCase();

      if (
        entryHost === targetHostname ||
        titleLower.includes(brandLower) ||
        descLower.includes(brandLower) ||
        (entry.url && entry.url.toLowerCase().includes(targetHostname))
      ) {
        matchingResults.push(entry);
      }
    }

    // Find competitor matches
    const competitorUrlsFound: string[] = [];
    for (const compUrl of competitorUrls) {
      const compHost = extractHost(compUrl);
      const compBrand = compHost.split('.')[0];
      const found = entries.some(e => {
        const h = e.url ? extractHost(e.url) : '';
        return (
          h === compHost ||
          e.title.toLowerCase().includes(compBrand) ||
          e.description.toLowerCase().includes(compBrand)
        );
      });
      if (found) competitorUrlsFound.push(compUrl);
    }

    console.log(
      `[DDGSearch] query="${query.slice(0, 60)}", entries=${entries.length}, found=${matchingResults.length > 0}, pos=${matchingResults[0]?.position || 0}`
    );

    return {
      found: matchingResults.length > 0,
      position: matchingResults[0]?.position || 0,
      results_checked: entries.length,
      matching_results: matchingResults,
      competitor_urls_found: competitorUrlsFound,
      top_results: entries.slice(0, 10),
      source: 'ddg_instant',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Strip basic HTML tags from DDG result strings */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
