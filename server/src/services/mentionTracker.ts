// server/src/services/mentionTracker.ts
// Brand mention tracker — scans free public sources for brand/domain mentions.
// No API keys required from the user. All sources are free public endpoints.

import { getPool } from './postgresql.js';

export interface MentionRow {
  source: string;
  url: string;
  title: string;
  snippet: string;
  detected_at: string;
}

export interface MentionScanResult {
  brand: string;
  domain: string;
  sources_checked: string[];
  mentions: MentionRow[];
  scanned_at: string;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 12_000;

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/json,application/xml,text/xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Source: Reddit JSON ─────────────────────────────────────────────────────

async function scanReddit(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(brand)}&sort=new&limit=25&type=link`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const data = await res.json() as any;
    for (const child of data?.data?.children || []) {
      const d = child.data;
      if (!d?.title) continue;
      rows.push({
        source: 'reddit',
        url: `https://www.reddit.com${d.permalink}`,
        title: d.title,
        snippet: truncate(d.selftext?.replace(/\s+/g, ' ') || d.subreddit_name_prefixed || '', 300),
        detected_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Hacker News Algolia ─────────────────────────────────────────────

async function scanHackerNews(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(brand)}&tags=(story,show_hn,ask_hn,comment)&hitsPerPage=25`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const data = await res.json() as any;
    for (const hit of data?.hits || []) {
      const title = hit.title || hit.story_title || '';
      const snippet = hit.comment_text
        ? truncate(stripHtml(hit.comment_text), 300)
        : [hit.points != null ? `${hit.points} pts` : '', hit.num_comments != null ? `${hit.num_comments} comments` : ''].filter(Boolean).join(', ');
      rows.push({
        source: 'hackernews',
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        title: title || 'HN Comment',
        snippet,
        detected_at: hit.created_at || new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Mastodon public API ─────────────────────────────────────────────

async function scanMastodon(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://mastodon.social/api/v2/search?q=${encodeURIComponent(brand)}&type=statuses&limit=20`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const data = await res.json() as any;
    for (const status of data?.statuses || []) {
      const content = stripHtml(status.content || '');
      if (!content) continue;
      rows.push({
        source: 'mastodon',
        url: status.url || status.uri || '',
        title: `@${status.account?.acct || 'unknown'}`,
        snippet: truncate(content, 300),
        detected_at: status.created_at || new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: DuckDuckGo HTML dork ────────────────────────────────────────────

async function scanDuckDuckGoDork(brand: string, domain: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const query = `"${brand}" -site:${domain}`;
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = resultRegex.exec(html)) !== null && rows.length < 20) {
      const href = decodeURIComponent(match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0]);
      const title = stripHtml(match[2]);
      const snippet = stripHtml(match[3]);
      if (!href || href.includes(domain)) continue;
      rows.push({
        source: 'ddg_dork',
        url: href,
        title: truncate(title, 200),
        snippet: truncate(snippet, 300),
        detected_at: new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Bing HTML dork ──────────────────────────────────────────────────

async function scanBingDork(brand: string, domain: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const query = `"${brand}" -site:${domain}`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    const blockRegex = /<li\s+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let block: RegExpExecArray | null;
    while ((block = blockRegex.exec(html)) !== null && rows.length < 20) {
      const inner = block[1];
      const linkMatch = inner.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (!linkMatch) continue;
      const href = linkMatch[1];
      if (href.includes(domain)) continue;
      rows.push({
        source: 'bing_dork',
        url: href,
        title: truncate(stripHtml(linkMatch[2]), 200),
        snippet: truncate(stripHtml(snippetMatch?.[1] || ''), 300),
        detected_at: new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Google News RSS ─────────────────────────────────────────────────

async function scanGoogleNewsRss(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(brand)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const xml = await res.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let item: RegExpExecArray | null;
    while ((item = itemRegex.exec(xml)) !== null && rows.length < 20) {
      const block = item[1];
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const title = stripHtml(titleMatch?.[1] || '');
      const href = linkMatch?.[1]?.trim() || '';
      if (!title || !href) continue;
      rows.push({
        source: 'google_news',
        url: href,
        title: truncate(title, 200),
        snippet: '',
        detected_at: pubDateMatch?.[1] ? new Date(pubDateMatch[1].trim()).toISOString() : new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: GitHub search ───────────────────────────────────────────────────

async function scanGitHub(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  // Search repositories, issues, and discussions
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(brand)}&per_page=10&sort=updated&order=desc`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AiVIS-MentionTracker/1.0', Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!res.ok) return rows;
    const data = await res.json() as any;
    for (const repo of data?.items || []) {
      rows.push({
        source: 'github',
        url: repo.html_url,
        title: repo.full_name,
        snippet: truncate(repo.description || '', 300),
        detected_at: repo.updated_at || new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  finally { clearTimeout(timer); }
  return rows;
}

// ── Source: Quora via Bing site dork ────────────────────────────────────────

async function scanQuora(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const query = `site:quora.com "${brand}"`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    const blockRegex = /<li\s+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let block: RegExpExecArray | null;
    while ((block = blockRegex.exec(html)) !== null && rows.length < 10) {
      const inner = block[1];
      const linkMatch = inner.match(/<a[^>]*href="(https?:\/\/[^"]*quora\.com[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      const snippetMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      rows.push({
        source: 'quora',
        url: linkMatch[1],
        title: truncate(stripHtml(linkMatch[2]), 200),
        snippet: truncate(stripHtml(snippetMatch?.[1] || ''), 300),
        detected_at: new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Product Hunt search ─────────────────────────────────────────────

async function scanProductHunt(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://www.producthunt.com/search?q=${encodeURIComponent(brand)}`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    const linkRegex = /<a[^>]*href="(\/posts\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null && rows.length < 10) {
      const title = stripHtml(match[2]);
      if (!title || title.length < 3) continue;
      rows.push({
        source: 'producthunt',
        url: `https://www.producthunt.com${match[1]}`,
        title: truncate(title, 200),
        snippet: '',
        detected_at: new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Stack Overflow via Bing site dork ────────────────────────────────

async function scanStackOverflow(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const query = `site:stackoverflow.com "${brand}"`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    const blockRegex = /<li\s+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let block: RegExpExecArray | null;
    while ((block = blockRegex.exec(html)) !== null && rows.length < 10) {
      const inner = block[1];
      const linkMatch = inner.match(/<a[^>]*href="(https?:\/\/[^"]*stackoverflow\.com[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      const snippetMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      rows.push({
        source: 'stackoverflow',
        url: linkMatch[1],
        title: truncate(stripHtml(linkMatch[2]), 200),
        snippet: truncate(stripHtml(snippetMatch?.[1] || ''), 300),
        detected_at: new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Wikipedia via MediaWiki API ──────────────────────────────────────

async function scanWikipedia(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(brand)}&srlimit=10&format=json&origin=*`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const data = await res.json() as any;
    for (const item of data?.query?.search || []) {
      rows.push({
        source: 'wikipedia',
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        title: item.title,
        snippet: truncate(stripHtml(item.snippet || ''), 300),
        detected_at: item.timestamp || new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Dev.to public API ───────────────────────────────────────────────

async function scanDevTo(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://dev.to/api/articles?per_page=10&tag=${encodeURIComponent(brand.toLowerCase().replace(/\s+/g, ''))}&state=rising`;
  const tagRes = await fetchWithTimeout(url);
  // Also try freeform search via Bing site dork (tag search may be too narrow)
  const dorkUrl = `https://www.bing.com/search?q=${encodeURIComponent(`site:dev.to "${brand}"`)}&count=10`;
  const dorkRes = await fetchWithTimeout(dorkUrl);

  // Merge tag results
  if (tagRes?.ok) {
    try {
      const articles = await tagRes.json() as any[];
      for (const a of articles || []) {
        if (!a?.url) continue;
        rows.push({
          source: 'devto',
          url: a.url,
          title: truncate(a.title || '', 200),
          snippet: truncate(a.description || '', 300),
          detected_at: a.published_at || new Date().toISOString(),
        });
      }
    } catch { /* skip */ }
  }

  // Merge Bing site dork results
  if (dorkRes?.ok) {
    try {
      const html = await dorkRes.text();
      const blockRegex = /<li\s+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
      let block: RegExpExecArray | null;
      const seenUrls = new Set(rows.map(r => r.url));
      while ((block = blockRegex.exec(html)) !== null && rows.length < 15) {
        const inner = block[1];
        const linkMatch = inner.match(/<a[^>]*href="(https?:\/\/[^"]*dev\.to[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch || seenUrls.has(linkMatch[1])) continue;
        seenUrls.add(linkMatch[1]);
        const snippetMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        rows.push({
          source: 'devto',
          url: linkMatch[1],
          title: truncate(stripHtml(linkMatch[2]), 200),
          snippet: truncate(stripHtml(snippetMatch?.[1] || ''), 300),
          detected_at: new Date().toISOString(),
        });
      }
    } catch { /* skip */ }
  }

  return rows;
}

// ── Source: Medium via Bing site dork ────────────────────────────────────────

async function scanMedium(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const query = `site:medium.com "${brand}"`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    const blockRegex = /<li\s+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let block: RegExpExecArray | null;
    while ((block = blockRegex.exec(html)) !== null && rows.length < 10) {
      const inner = block[1];
      const linkMatch = inner.match(/<a[^>]*href="(https?:\/\/[^"]*medium\.com[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      const snippetMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      rows.push({
        source: 'medium',
        url: linkMatch[1],
        title: truncate(stripHtml(linkMatch[2]), 200),
        snippet: truncate(stripHtml(snippetMatch?.[1] || ''), 300),
        detected_at: new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: YouTube via Bing site dork ───────────────────────────────────────

async function scanYouTube(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const query = `site:youtube.com "${brand}"`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    const blockRegex = /<li\s+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let block: RegExpExecArray | null;
    while ((block = blockRegex.exec(html)) !== null && rows.length < 10) {
      const inner = block[1];
      const linkMatch = inner.match(/<a[^>]*href="(https?:\/\/[^"]*youtube\.com\/watch[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      const snippetMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      rows.push({
        source: 'youtube',
        url: linkMatch[1],
        title: truncate(stripHtml(linkMatch[2]), 200),
        snippet: truncate(stripHtml(snippetMatch?.[1] || ''), 300),
        detected_at: new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Lobsters RSS ────────────────────────────────────────────────────

async function scanLobsters(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://lobste.rs/search?q=${encodeURIComponent(brand)}&what=stories&order=newest`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    // Lobsters search results: <span class="link">...<a href="...">title</a>...</span>
    const storyRegex = /<div[^>]*class="story[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(https?:\/\/[^"]+)"[^>]*class="u-url"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = storyRegex.exec(html)) !== null && rows.length < 10) {
      const title = stripHtml(match[2]);
      if (!title || title.length < 3) continue;
      rows.push({
        source: 'lobsters',
        url: match[1],
        title: truncate(title, 200),
        snippet: '',
        detected_at: new Date().toISOString(),
      });
    }
    // Fallback: try simpler link extraction if the structured regex found nothing
    if (rows.length === 0) {
      const fallbackRegex = /<a[^>]*href="(https?:\/\/lobste\.rs\/s\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = fallbackRegex.exec(html)) !== null && rows.length < 10) {
        const title = stripHtml(match[2]);
        if (!title || title.length < 3) continue;
        rows.push({
          source: 'lobsters',
          url: match[1],
          title: truncate(title, 200),
          snippet: '',
          detected_at: new Date().toISOString(),
        });
      }
    }
  } catch { /* skip */ }
  return rows;
}

// ── Main tracker ────────────────────────────────────────────────────────────

const ALL_SOURCES = [
  { name: 'reddit', fn: (b: string, _d: string) => scanReddit(b) },
  { name: 'hackernews', fn: (b: string, _d: string) => scanHackerNews(b) },
  { name: 'mastodon', fn: (b: string, _d: string) => scanMastodon(b) },
  { name: 'ddg_dork', fn: (b: string, d: string) => scanDuckDuckGoDork(b, d) },
  { name: 'bing_dork', fn: (b: string, d: string) => scanBingDork(b, d) },
  { name: 'google_news', fn: (b: string, _d: string) => scanGoogleNewsRss(b) },
  { name: 'github', fn: (b: string, _d: string) => scanGitHub(b) },
  { name: 'quora', fn: (b: string, _d: string) => scanQuora(b) },
  { name: 'producthunt', fn: (b: string, _d: string) => scanProductHunt(b) },
  { name: 'stackoverflow', fn: (b: string, _d: string) => scanStackOverflow(b) },
  { name: 'wikipedia', fn: (b: string, _d: string) => scanWikipedia(b) },
  { name: 'devto', fn: (b: string, _d: string) => scanDevTo(b) },
  { name: 'medium', fn: (b: string, _d: string) => scanMedium(b) },
  { name: 'youtube', fn: (b: string, _d: string) => scanYouTube(b) },
  { name: 'lobsters', fn: (b: string, _d: string) => scanLobsters(b) },
] as const;

export type MentionSource = typeof ALL_SOURCES[number]['name'];

/**
 * Scan all free public sources for brand mentions.
 * Returns deduplicated results across all sources.
 */
export async function trackBrandMentions(
  brand: string,
  domain: string,
  sources?: MentionSource[],
): Promise<MentionScanResult> {
  const activeSources = sources
    ? ALL_SOURCES.filter((s) => sources.includes(s.name))
    : [...ALL_SOURCES];

  const settled = await Promise.allSettled(
    activeSources.map(async (s) => {
      try {
        const rows = await s.fn(brand, domain);
        return { source: s.name, rows };
      } catch {
        return { source: s.name, rows: [] };
      }
    }),
  );

  const mentions: MentionRow[] = [];
  const seenUrls = new Set<string>();
  const sourcesChecked: string[] = [];

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    const { source, rows } = result.value;
    sourcesChecked.push(source);
    for (const row of rows) {
      if (!row.url || seenUrls.has(row.url)) continue;
      seenUrls.add(row.url);
      mentions.push(row);
    }
  }

  // Sort by detected_at descending
  mentions.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());

  return {
    brand,
    domain,
    sources_checked: sourcesChecked,
    mentions,
    scanned_at: new Date().toISOString(),
  };
}

/**
 * Store mention scan results in the database.
 */
export async function persistMentionScan(
  userId: string,
  brand: string,
  domain: string,
  mentions: MentionRow[],
): Promise<void> {
  const pool = getPool();
  if (mentions.length === 0) return;

  // Batch insert with ON CONFLICT skip for duplicate source+url per user
  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const m of mentions) {
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    values.push(userId, brand, domain, m.source, m.url, m.title, m.snippet);
  }

  await pool.query(
    `INSERT INTO brand_mentions (user_id, brand, domain, source, url, title, snippet)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (user_id, source, url) DO UPDATE SET title = EXCLUDED.title, snippet = EXCLUDED.snippet`,
    values,
  );
}

/**
 * Get stored mention history for a user+brand.
 */
export async function getMentionHistory(
  userId: string,
  brand: string,
  limit = 100,
  offset = 0,
): Promise<{ mentions: any[]; total: number }> {
  const pool = getPool();

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM brand_mentions WHERE user_id = $1 AND LOWER(brand) = LOWER($2)`,
    [userId, brand],
  );
  const total = parseInt(countResult.rows[0]?.count || '0', 10);

  const result = await pool.query(
    `SELECT id, brand, domain, source, url, title, snippet, detected_at
     FROM brand_mentions
     WHERE user_id = $1 AND LOWER(brand) = LOWER($2)
     ORDER BY detected_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, brand, limit, offset],
  );

  return { mentions: result.rows, total };
}

/**
 * Get mention counts grouped by source for a user+brand.
 */
export async function getMentionSourceBreakdown(
  userId: string,
  brand: string,
): Promise<Array<{ source: string; count: number; latest: string }>> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT source, COUNT(*) as count, MAX(detected_at) as latest
     FROM brand_mentions
     WHERE user_id = $1 AND LOWER(brand) = LOWER($2)
     GROUP BY source
     ORDER BY count DESC`,
    [userId, brand],
  );
  return result.rows.map((r: any) => ({
    source: r.source,
    count: parseInt(r.count, 10),
    latest: r.latest,
  }));
}

/**
 * Get a timeline of mention counts per day.
 */
export async function getMentionTimeline(
  userId: string,
  brand: string,
  days = 30,
): Promise<Array<{ date: string; count: number }>> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT DATE(detected_at) as date, COUNT(*) as count
     FROM brand_mentions
     WHERE user_id = $1 AND LOWER(brand) = LOWER($2)
       AND detected_at > NOW() - INTERVAL '1 day' * $3
     GROUP BY DATE(detected_at)
     ORDER BY date ASC`,
    [userId, brand, days],
  );
  return result.rows.map((r: any) => ({
    date: r.date,
    count: parseInt(r.count, 10),
  }));
}
