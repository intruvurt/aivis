// server/src/services/platformDirectSearch.ts
// Direct free-API integrations for platforms that expose public JSON endpoints.
// No API keys required. Used by authority check to bypass DDG/Bing scraping
// for Reddit, Hacker News, GitHub, Stack Overflow, Wikipedia, Medium, and Product Hunt.

import type { AuthorityPlatform } from '../../../shared/types.js';

export type PlatformRow = { title: string; snippet: string; href: string };

/** Platforms that have a direct API integration. */
export const DIRECT_API_PLATFORMS: ReadonlySet<AuthorityPlatform> = new Set([
  'reddit',
  'hackernews',
  'github',
  'stackoverflow',
  'wikipedia',
  'medium',
  'producthunt',
  'youtube',
  'substack',
  'techcrunch',
  'trustpilot',
  'blogger',
  'devto',
  'bluesky',
]);

/** Returns true if the platform can be queried via a direct free API. */
export function hasDirectApi(platform: AuthorityPlatform): boolean {
  return DIRECT_API_PLATFORMS.has(platform);
}

const UA = 'AiVIS-AuthorityCheck/1.0 (visibility audit; non-commercial)';
const TIMEOUT_MS = 10_000;

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

// ── Reddit: /search.json (public, no key) ───────────────────────────────

interface RedditSearchResponse {
  data?: {
    children?: Array<{
      data: {
        title: string;
        selftext?: string;
        permalink: string;
        subreddit_name_prefixed?: string;
        score?: number;
        num_comments?: number;
      };
    }>;
  };
}

async function searchReddit(query: string, limit = 12): Promise<PlatformRow[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=${limit}&type=link`;
  const data = await fetchJson<RedditSearchResponse>(url);
  if (!data?.data?.children) return [];
  return data.data.children.map((child) => {
    const d = child.data;
    const snippet = truncate(
      [d.subreddit_name_prefixed, d.selftext?.replace(/\s+/g, ' ')].filter(Boolean).join(' - '),
      300,
    );
    return {
      title: d.title,
      snippet: snippet || d.subreddit_name_prefixed || '',
      href: `https://www.reddit.com${d.permalink}`,
    };
  });
}

// ── Hacker News: Algolia HN Search API (public, no key) ─────────────────

interface HNSearchResponse {
  hits?: Array<{
    title?: string;
    story_title?: string;
    url?: string;
    objectID: string;
    _highlightResult?: { title?: { value?: string }; story_title?: { value?: string } };
    comment_text?: string;
    num_comments?: number;
    points?: number;
  }>;
}

async function searchHackerNews(query: string, limit = 12): Promise<PlatformRow[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${limit}&tags=(story,show_hn,ask_hn)`;
  const data = await fetchJson<HNSearchResponse>(url);
  if (!data?.hits) return [];
  return data.hits
    .filter((h) => h.title || h.story_title)
    .map((h) => {
      const title = h.title || h.story_title || '';
      const meta = [
        h.points != null ? `${h.points} pts` : null,
        h.num_comments != null ? `${h.num_comments} comments` : null,
      ].filter(Boolean).join(', ');
      return {
        title,
        snippet: meta,
        href: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      };
    });
}

// ── GitHub: REST Search API (public, 10 req/min unauthenticated) ────────

interface GHSearchResponse {
  items?: Array<{
    full_name: string;
    html_url: string;
    description?: string | null;
    stargazers_count?: number;
    language?: string | null;
  }>;
}

async function searchGitHub(query: string, limit = 10): Promise<PlatformRow[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}&sort=stars&order=desc`;
  const data = await fetchJson<GHSearchResponse>(url);
  if (!data?.items) return [];
  return data.items.map((item) => {
    const meta = [
      item.stargazers_count != null ? `★ ${item.stargazers_count}` : null,
      item.language,
    ].filter(Boolean).join(' · ');
    return {
      title: item.full_name,
      snippet: truncate([item.description, meta].filter(Boolean).join(' - '), 300),
      href: item.html_url,
    };
  });
}

// ── Stack Overflow: Stack Exchange API (public, no key, 300 req/day) ────

interface SESearchResponse {
  items?: Array<{
    title: string;
    link: string;
    score?: number;
    answer_count?: number;
    is_answered?: boolean;
    tags?: string[];
  }>;
}

async function searchStackOverflow(query: string, limit = 10): Promise<PlatformRow[]> {
  const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=${limit}&filter=default`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SESearchResponse;
    if (!data?.items) return [];
    return data.items.map((item) => {
      const meta = [
        item.score != null ? `score ${item.score}` : null,
        item.answer_count != null ? `${item.answer_count} answers` : null,
        item.is_answered ? 'accepted' : null,
        ...(item.tags || []).slice(0, 3),
      ].filter(Boolean).join(' · ');
      return {
        title: decodeHtml(item.title),
        snippet: meta,
        href: item.link,
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Wikipedia: MediaWiki API (public, no key) ───────────────────────────

interface WikiSearchResponse {
  query?: {
    search?: Array<{
      title: string;
      pageid: number;
      snippet: string;
      wordcount?: number;
    }>;
  };
}

async function searchWikipedia(query: string, limit = 8): Promise<PlatformRow[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`;
  const data = await fetchJson<WikiSearchResponse>(url);
  if (!data?.query?.search) return [];
  return data.query.search.map((item) => ({
    title: item.title,
    snippet: truncate(stripHtml(item.snippet), 300),
    href: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
  }));
}

// ── Dispatcher ──────────────────────────────────────────────────────────

/**
 * Query a platform's free public JSON API directly.
 * Returns the same `{ title, snippet, href }[]` shape used by the
 * DDG/Bing scraper path so the authority check can consume it uniformly.
 *
 * @param platform  One of the DIRECT_API_PLATFORMS
 * @param query     The search term (brand name, domain, or phrase)
 * @param limit     Max results to return
 */
export async function searchPlatformDirect(
  platform: AuthorityPlatform,
  query: string,
  limit = 10,
): Promise<PlatformRow[]> {
  switch (platform) {
    case 'reddit':
      return searchReddit(query, limit);
    case 'hackernews':
      return searchHackerNews(query, limit);
    case 'github':
      return searchGitHub(query, limit);
    case 'stackoverflow':
      return searchStackOverflow(query, limit);
    case 'wikipedia':
      return searchWikipedia(query, Math.min(limit, 8));
    case 'medium':
      return searchMedium(query, limit);
    case 'producthunt':
      return searchProductHunt(query, limit);
    case 'youtube':
      return searchYouTube(query, limit);
    case 'substack':
      return searchSubstack(query, limit);
    case 'techcrunch':
      return searchTechCrunch(query, limit);
    case 'trustpilot':
      return searchTrustpilot(query, limit);
    case 'blogger':
      return searchBlogger(query, limit);
    case 'devto':
      return searchDevTo(query, limit);
    case 'bluesky':
      return searchBluesky(query, limit);
    default:
      return [];
  }
}

// ── Medium: Tag search + Google RSS feed (public, no key) ───────────────

async function searchMedium(query: string, limit = 10): Promise<PlatformRow[]> {
  // Medium's tag pages expose an RSS/XML feed we can parse for articles
  // Also try the search endpoint which returns HTML we can scrape
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  // Path 1: Medium search HTML scrape
  try {
    const searchUrl = `https://medium.com/search?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const html = await res.text();
        // Medium article links contain /@author/title or /p/ patterns
        const articleRegex = /<a[^>]*href="(https:\/\/[^"]*medium\.com[^"]*\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;
        while ((match = articleRegex.exec(html)) !== null && results.length < limit) {
          const href = match[1];
          const title = stripHtml(match[2]);
          if (!title || title.length < 10 || seen.has(href)) continue;
          if (href.includes('/search?') || href.includes('/tag/') || href.includes('/topic/')) continue;
          seen.add(href);
          results.push({ title: truncate(title, 200), snippet: '', href });
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch { /* skip */ }

  // Path 2: Google RSS fallback - "site:medium.com query" via Google News RSS
  if (results.length === 0) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`site:medium.com ${query}`)}&hl=en-US&gl=US&ceid=US:en`;
      const data = await fetchText(rssUrl);
      if (data) {
        const itemRegex = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/gi;
        let match: RegExpExecArray | null;
        while ((match = itemRegex.exec(data)) !== null && results.length < limit) {
          const title = stripHtml(match[1]);
          const href = match[2].trim();
          if (!title || !href || seen.has(href)) continue;
          seen.add(href);
          results.push({ title: truncate(title, 200), snippet: '', href });
        }
      }
    } catch { /* skip */ }
  }

  return results.slice(0, limit);
}

// ── Product Hunt: public GraphQL / web scrape (no key for basic search) ─

async function searchProductHunt(query: string, limit = 10): Promise<PlatformRow[]> {
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  // Product Hunt search HTML scrape
  try {
    const searchUrl = `https://www.producthunt.com/search?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const html = await res.text();
        // PH product links are /posts/slug pattern
        const productRegex = /<a[^>]*href="(\/posts\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;
        while ((match = productRegex.exec(html)) !== null && results.length < limit) {
          const href = `https://www.producthunt.com${match[1]}`;
          const title = stripHtml(match[2]);
          if (!title || title.length < 3 || seen.has(href)) continue;
          seen.add(href);
          results.push({ title: truncate(title, 200), snippet: '', href });
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch { /* skip */ }

  return results.slice(0, limit);
}

// ── YouTube: ytInitialData JSON extraction (public, no key) ─────────────

async function searchYouTube(query: string, limit = 10): Promise<PlatformRow[]> {
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const html = await res.text();
        // YouTube embeds all search results as JSON in ytInitialData
        const dataMatch = html.match(/var\s+ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
        if (dataMatch) {
          try {
            const data = JSON.parse(dataMatch[1]);
            const sections = data?.contents?.twoColumnSearchResultsRenderer
              ?.primaryContents?.sectionListRenderer?.contents;
            if (Array.isArray(sections)) {
              for (const section of sections) {
                const items = section?.itemSectionRenderer?.contents;
                if (!Array.isArray(items)) continue;
                for (const item of items) {
                  const video = item?.videoRenderer;
                  if (!video?.videoId) continue;
                  const title = Array.isArray(video.title?.runs)
                    ? (video.title.runs as Array<{ text: string }>).map(r => r.text).join('')
                    : '';
                  const snippet = Array.isArray(video.descriptionSnippet?.runs)
                    ? (video.descriptionSnippet.runs as Array<{ text: string }>).map(r => r.text).join('')
                    : '';
                  const href = `https://www.youtube.com/watch?v=${video.videoId}`;
                  if (seen.has(href) || !title) continue;
                  seen.add(href);
                  results.push({ title: truncate(title, 200), snippet: truncate(snippet, 300), href });
                  if (results.length >= limit) return results;
                }
              }
            }
          } catch { /* ytInitialData JSON parse failure */ }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch { /* skip */ }

  // Fallback: Google News RSS for youtube.com
  if (results.length === 0) {
    const rssItems = await fetchGoogleNewsRss('youtube.com', query, limit);
    for (const item of rssItems) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        results.push(item);
      }
    }
  }

  return results.slice(0, limit);
}

// ── Substack: search scrape + Google News RSS fallback (no key) ─────────

async function searchSubstack(query: string, limit = 10): Promise<PlatformRow[]> {
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  // Path 1: Substack search HTML scrape
  try {
    const searchUrl = `https://substack.com/search/${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const html = await res.text();
        const linkRegex = /<a[^>]*href="(https:\/\/[^"]*\.substack\.com[^"]*\/p\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;
        while ((match = linkRegex.exec(html)) !== null && results.length < limit) {
          const href = match[1].split('?')[0];
          const title = stripHtml(match[2]);
          if (!title || title.length < 10 || seen.has(href)) continue;
          seen.add(href);
          results.push({ title: truncate(title, 200), snippet: '', href });
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch { /* skip */ }

  // Path 2: Google News RSS fallback
  if (results.length === 0) {
    const rssItems = await fetchGoogleNewsRss('substack.com', query, limit);
    for (const item of rssItems) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        results.push(item);
      }
    }
  }

  return results.slice(0, limit);
}

// ── TechCrunch: WordPress RSS search + Google News fallback ─────────────

async function searchTechCrunch(query: string, limit = 10): Promise<PlatformRow[]> {
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  // Path 1: WordPress search RSS feed
  try {
    const rssUrl = `https://techcrunch.com/feed/?s=${encodeURIComponent(query)}`;
    const xml = await fetchText(rssUrl);
    if (xml) {
      for (const item of parseRssItems(xml)) {
        if (seen.has(item.href)) continue;
        seen.add(item.href);
        results.push(item);
        if (results.length >= limit) break;
      }
    }
  } catch { /* skip */ }

  // Path 2: Google News RSS fallback
  if (results.length === 0) {
    const rssItems = await fetchGoogleNewsRss('techcrunch.com', query, limit);
    for (const item of rssItems) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        results.push(item);
      }
    }
  }

  return results.slice(0, limit);
}

// ── Trustpilot: search page scrape (no key) ────────────────────────────

async function searchTrustpilot(query: string, limit = 10): Promise<PlatformRow[]> {
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  try {
    const searchUrl = `https://www.trustpilot.com/search?query=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const html = await res.text();
        const reviewRegex = /<a[^>]*href="(\/review\/[^"?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;
        while ((match = reviewRegex.exec(html)) !== null && results.length < limit) {
          const href = `https://www.trustpilot.com${match[1]}`;
          const title = stripHtml(match[2]);
          if (!title || title.length < 3 || seen.has(href)) continue;
          seen.add(href);
          results.push({ title: truncate(title, 200), snippet: '', href });
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch { /* skip */ }

  return results.slice(0, limit);
}

// ── Blogger: Google News RSS for blogspot.com (no key) ──────────────────

async function searchBlogger(query: string, limit = 10): Promise<PlatformRow[]> {
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  // Blogspot blogs live on *.blogspot.com
  const rssItems = await fetchGoogleNewsRss('blogspot.com', query, limit);
  for (const item of rssItems) {
    if (!seen.has(item.href)) {
      seen.add(item.href);
      results.push(item);
    }
  }

  // Also try blogger.com domain
  if (results.length === 0) {
    const bloggerItems = await fetchGoogleNewsRss('blogger.com', query, limit);
    for (const item of bloggerItems) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        results.push(item);
      }
    }
  }

  return results.slice(0, limit);
}

// ── dev.to: Forem search feed API (public, no key) ─────────────────────

interface DevToSearchItem {
  class_name: string;
  id: number;
  title?: string;
  path?: string;
  tag_list?: string[];
  user_id?: number;
  user?: { username?: string; name?: string };
  readable_publish_date?: string;
}

interface DevToSearchResponse {
  result?: DevToSearchItem[];
}

async function searchDevTo(query: string, limit = 10): Promise<PlatformRow[]> {
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  // Path 1: dev.to internal search API (JSON)
  try {
    const searchUrl = `https://dev.to/search/feed_content?per_page=${limit}&page=0&search_fields=${encodeURIComponent(query)}&class_name=Article`;
    const data = await fetchJson<DevToSearchResponse>(searchUrl);
    if (data?.result) {
      for (const item of data.result) {
        if (!item.title || !item.path) continue;
        const href = `https://dev.to${item.path}`;
        if (seen.has(href)) continue;
        seen.add(href);
        const snippet = [
          item.user?.name || item.user?.username || '',
          item.readable_publish_date || '',
          ...(item.tag_list || []).slice(0, 4),
        ].filter(Boolean).join(' · ');
        results.push({ title: truncate(item.title, 200), snippet, href });
        if (results.length >= limit) break;
      }
    }
  } catch { /* skip */ }

  // Path 2: Google News RSS fallback
  if (results.length === 0) {
    const rssItems = await fetchGoogleNewsRss('dev.to', query, limit);
    for (const item of rssItems) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        results.push(item);
      }
    }
  }

  return results.slice(0, limit);
}

// ── Bluesky: AT Protocol public search (no auth required) ───────────────

interface BlueskySearchResponse {
  posts?: Array<{
    uri: string;
    cid: string;
    author: {
      handle: string;
      displayName?: string;
    };
    record: {
      text?: string;
      createdAt?: string;
    };
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
  }>;
}

async function searchBluesky(query: string, limit = 10): Promise<PlatformRow[]> {
  const results: PlatformRow[] = [];
  const seen = new Set<string>();

  try {
    const searchUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 25)}`;
    const data = await fetchJson<BlueskySearchResponse>(searchUrl);
    if (data?.posts) {
      for (const post of data.posts) {
        const text = post.record?.text || '';
        if (!text) continue;
        // Build a web URL from the AT URI: at://did:plc:xxx/app.bsky.feed.post/yyy
        const uriParts = post.uri.split('/');
        const postId = uriParts[uriParts.length - 1];
        const href = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
        if (seen.has(href)) continue;
        seen.add(href);
        const title = truncate(text.split('\n')[0], 200);
        const meta = [
          post.author.displayName || post.author.handle,
          post.likeCount ? `${post.likeCount} likes` : null,
          post.repostCount ? `${post.repostCount} reposts` : null,
        ].filter(Boolean).join(' · ');
        results.push({ title, snippet: meta, href });
        if (results.length >= limit) break;
      }
    }
  } catch { /* skip */ }

  return results.slice(0, limit);
}

// ── Shared RSS helpers ──────────────────────────────────────────────────

function parseRssItems(xml: string): PlatformRow[] {
  const items: PlatformRow[] = [];
  const itemRegex = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const title = stripHtml(match[1]).trim();
    const href = match[2].trim();
    if (!title || !href) continue;
    items.push({ title: truncate(title, 200), snippet: '', href });
  }
  return items;
}

async function fetchGoogleNewsRss(siteDomain: string, query: string, limit: number): Promise<PlatformRow[]> {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${siteDomain} ${query}`)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetchText(rssUrl);
    if (!xml) return [];
    return parseRssItems(xml).slice(0, limit);
  } catch {
    return [];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xml,text/xml,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(input: string): string {
  return decodeHtml(input.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
