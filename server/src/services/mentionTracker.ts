// server/src/services/mentionTracker.ts
// Brand mention tracker - scans free public sources for brand/domain mentions.
// No API keys required from the user. All sources are free public endpoints.

import { getPool } from './postgresql.js';
import { textMentionsBrand } from './searchDisambiguation.js';

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

// ── Source: Bluesky (AT Protocol public search) ─────────────────────────────

async function scanBluesky(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(brand)}&limit=20`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const data = await res.json() as any;
    for (const item of data?.posts || []) {
      const text = item.record?.text || '';
      if (!text) continue;
      const author = item.author?.handle || 'unknown';
      const postUri = item.uri || '';
      // Convert AT URI to web URL: at://did:plc:xxx/app.bsky.feed.post/yyy → https://bsky.app/profile/handle/post/yyy
      let webUrl = '';
      const uriMatch = postUri.match(/at:\/\/[^/]+\/app\.bsky\.feed\.post\/(\w+)/);
      if (uriMatch) {
        webUrl = `https://bsky.app/profile/${author}/post/${uriMatch[1]}`;
      }
      rows.push({
        source: 'bluesky',
        url: webUrl || postUri,
        title: `@${author}`,
        snippet: truncate(text, 300),
        detected_at: item.record?.createdAt || item.indexedAt || new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Twitter/X via Bing site dork ─────────────────────────────────────

async function scanTwitter(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  // Search both x.com and legacy twitter.com
  const query = `("${brand}") (site:x.com OR site:twitter.com)`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=15`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const html = await res.text();
    const blockRegex = /<li\s+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let block: RegExpExecArray | null;
    const seenUrls = new Set<string>();
    while ((block = blockRegex.exec(html)) !== null && rows.length < 15) {
      const inner = block[1];
      const linkMatch = inner.match(/<a[^>]*href="(https?:\/\/[^"]*(?:x\.com|twitter\.com)[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      const href = linkMatch[1];
      if (seenUrls.has(href)) continue;
      seenUrls.add(href);
      const snippetMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      rows.push({
        source: 'twitter',
        url: href,
        title: truncate(stripHtml(linkMatch[2]), 200),
        snippet: truncate(stripHtml(snippetMatch?.[1] || ''), 300),
        detected_at: new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: Lemmy (federated link aggregator) ─────────────────────────────────

async function scanLemmy(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  // Query a large, stable Lemmy instance (lemmy.world) for post mentions
  const url = `https://lemmy.world/api/v3/search?q=${encodeURIComponent(brand)}&type_=Posts&sort=New&limit=20`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return rows;
  try {
    const data = await res.json() as any;
    for (const item of data?.posts || []) {
      const post = item.post;
      if (!post?.name) continue;
      rows.push({
        source: 'lemmy',
        url: post.ap_id || `https://lemmy.world/post/${post.id}`,
        title: post.name,
        snippet: truncate(post.body || post.url || '', 300),
        detected_at: post.published || new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  return rows;
}

// ── Source: GitHub Discussions search ────────────────────────────────────────

async function scanGitHubDiscussions(brand: string): Promise<MentionRow[]> {
  const rows: MentionRow[] = [];
  // GitHub REST search API works without auth for public content (60 req/hr)
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(`${brand} in:title,body type:discussion`)}&per_page=10&sort=updated&order=desc`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AiVIS-MentionTracker/1.0',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });
    if (!res.ok) return rows;
    const data = await res.json() as any;
    for (const item of data?.items || []) {
      if (!item?.html_url) continue;
      rows.push({
        source: 'github_discussions',
        url: item.html_url,
        title: truncate(item.title || '', 200),
        snippet: truncate(item.body ? item.body.slice(0, 300) : '', 300),
        detected_at: item.updated_at || item.created_at || new Date().toISOString(),
      });
    }
  } catch { /* skip */ }
  finally { clearTimeout(timer); }
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
  { name: 'bluesky', fn: (b: string, _d: string) => scanBluesky(b) },
  { name: 'twitter', fn: (b: string, _d: string) => scanTwitter(b) },
  { name: 'lemmy', fn: (b: string, _d: string) => scanLemmy(b) },
  { name: 'github_discussions', fn: (b: string, _d: string) => scanGitHubDiscussions(b) },
] as const;

export type MentionSource = typeof ALL_SOURCES[number]['name'];

/**
 * Check if a mention result is genuinely about the brand.
 * Uses word-boundary matching and compound-word rejection from searchDisambiguation.
 */
function isMentionRelevant(row: MentionRow, brand: string, domain: string): boolean {
  // Results from the brand's own domain are always relevant
  if (domain && row.url.toLowerCase().includes(domain.toLowerCase())) return true;
  // Check title + snippet using word-boundary matching
  return textMentionsBrand(row.title, brand) || textMentionsBrand(row.snippet, brand);
}

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
      // Disambiguate: reject results where the brand only appears as a compound substring
      if (!isMentionRelevant(row, brand, domain)) continue;
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

// ── Sentiment Classification ────────────────────────────────────────────────

const POSITIVE_SIGNALS = [
  'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'love', 'loved', 'best',
  'incredible', 'outstanding', 'perfect', 'brilliant', 'superb', 'wonderful',
  'helpful', 'useful', 'solid', 'impressive', 'highly recommend', 'recommend',
  'worth', 'easy to use', 'powerful', 'innovative', 'fast', 'reliable',
  'featured', 'launched', 'released', 'shipped', 'new feature', 'exciting',
  'congratulations', 'congrats', 'kudos', 'interesting', 'nice', 'cool',
];

const NEGATIVE_SIGNALS = [
  'bad', 'terrible', 'awful', 'horrible', 'worst', 'broken', 'fail', 'failed',
  'failing', 'useless', 'waste', 'disappointing', 'disappointed', 'bug', 'buggy',
  'crash', 'crashed', 'error', 'problem', 'issue', 'issues', 'slow',
  'expensive', 'overpriced', 'scam', 'fraud', 'misleading', 'hate', 'hated',
  'avoid', 'not worth', 'poor', 'mediocre', 'frustrating', 'annoying',
  'broken', 'outage', 'down', 'unreliable', 'warning', 'beware',
];

/**
 * Fast rule-based sentiment classifier. Returns 'positive', 'negative', or 'neutral'.
 * Checks title and snippet text against positive/negative word/phrase lists.
 */
export function classifySentiment(title: string, snippet: string): 'positive' | 'negative' | 'neutral' {
  const text = `${title} ${snippet}`.toLowerCase();
  let posScore = 0;
  let negScore = 0;
  for (const p of POSITIVE_SIGNALS) {
    if (text.includes(p)) posScore++;
  }
  for (const n of NEGATIVE_SIGNALS) {
    if (text.includes(n)) negScore++;
  }
  if (posScore === negScore) return 'neutral';
  return posScore > negScore ? 'positive' : 'negative';
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
    const sentiment = classifySentiment(m.title, m.snippet);
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    values.push(userId, brand, domain, m.source, m.url, m.title, m.snippet, sentiment);
  }

  await pool.query(
    `INSERT INTO brand_mentions (user_id, brand, domain, source, url, title, snippet, sentiment)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (user_id, source, url) DO UPDATE SET title = EXCLUDED.title, snippet = EXCLUDED.snippet, sentiment = EXCLUDED.sentiment`,
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

// ── KPI Computation ──────────────────────────────────────────────────────────

export interface MentionKPIResult {
  brand: string;
  volume: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  net_sentiment_score: number;
  brand_health_score: number;
  source_count: number;
  top_sources: Array<{ source: string; count: number }>;
  computed_at: string;
}

/**
 * Compute live KPI metrics for a brand from stored brand_mentions.
 * - net_sentiment_score: (positive - negative) / total * 100, range -100..100
 * - brand_health_score: composite 0-100
 *   40% = NSS normalised to 0-100
 *   30% = volume index (log scale, caps at ~500 mentions = 100)
 *   30% = source diversity (source_count / 17 total sources * 100)
 */
export async function computeMentionKPIs(userId: string, brand: string): Promise<MentionKPIResult> {
  const pool = getPool();

  // Sentiment aggregation
  const sentResult = await pool.query(
    `SELECT
       COUNT(*) as volume,
       COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_count,
       COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_count,
       COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_count,
       COUNT(DISTINCT source) as source_count
     FROM brand_mentions
     WHERE user_id = $1 AND LOWER(brand) = LOWER($2)`,
    [userId, brand],
  );

  const row = sentResult.rows[0] || {};
  const volume = parseInt(row.volume || '0', 10);
  const positiveCount = parseInt(row.positive_count || '0', 10);
  const negativeCount = parseInt(row.negative_count || '0', 10);
  const neutralCount = parseInt(row.neutral_count || '0', 10);
  const sourceCount = parseInt(row.source_count || '0', 10);

  const nss = volume > 0 ? ((positiveCount - negativeCount) / volume) * 100 : 0;

  // Volume index: log scale, 500 mentions → 100 points
  const volumeIndex = volume > 0 ? Math.min((Math.log10(volume + 1) / Math.log10(501)) * 100, 100) : 0;

  // Source diversity: out of 17 known sources
  const diversityScore = Math.min((sourceCount / 17) * 100, 100);

  // Brand health composite
  const nssNorm = (nss + 100) / 2; // map -100..100 to 0..100
  const brandHealthScore = nssNorm * 0.4 + volumeIndex * 0.3 + diversityScore * 0.3;

  // Top sources
  const topSourceResult = await pool.query(
    `SELECT source, COUNT(*) as count
     FROM brand_mentions
     WHERE user_id = $1 AND LOWER(brand) = LOWER($2)
     GROUP BY source
     ORDER BY count DESC
     LIMIT 5`,
    [userId, brand],
  );
  const topSources = topSourceResult.rows.map((r: any) => ({
    source: r.source as string,
    count: parseInt(r.count, 10),
  }));

  return {
    brand,
    volume,
    positive_count: positiveCount,
    negative_count: negativeCount,
    neutral_count: neutralCount,
    net_sentiment_score: Math.round(nss * 10) / 10,
    brand_health_score: Math.round(brandHealthScore * 10) / 10,
    source_count: sourceCount,
    top_sources: topSources,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Persist a daily KPI snapshot (upsert by user+brand+date).
 */
export async function saveMentionKPISnapshot(userId: string, kpis: MentionKPIResult): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO mention_kpi_snapshots
       (user_id, brand, snapshot_date, volume, positive_count, negative_count, neutral_count,
        net_sentiment_score, brand_health_score, source_count, top_sources)
     VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id, brand, snapshot_date)
     DO UPDATE SET
       volume = EXCLUDED.volume,
       positive_count = EXCLUDED.positive_count,
       negative_count = EXCLUDED.negative_count,
       neutral_count = EXCLUDED.neutral_count,
       net_sentiment_score = EXCLUDED.net_sentiment_score,
       brand_health_score = EXCLUDED.brand_health_score,
       source_count = EXCLUDED.source_count,
       top_sources = EXCLUDED.top_sources`,
    [
      userId, kpis.brand, kpis.volume, kpis.positive_count, kpis.negative_count,
      kpis.neutral_count, kpis.net_sentiment_score, kpis.brand_health_score,
      kpis.source_count, JSON.stringify(kpis.top_sources),
    ],
  );
}

/**
 * Get historical KPI snapshots for trend charts (last N days).
 */
export async function getMentionKPIHistory(
  userId: string,
  brand: string,
  days = 30,
): Promise<Array<{ date: string; volume: number; net_sentiment_score: number; brand_health_score: number }>> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT snapshot_date as date, volume, net_sentiment_score, brand_health_score
     FROM mention_kpi_snapshots
     WHERE user_id = $1 AND LOWER(brand) = LOWER($2)
       AND snapshot_date > CURRENT_DATE - INTERVAL '1 day' * $3
     ORDER BY snapshot_date ASC`,
    [userId, brand, days],
  );
  return result.rows.map((r: any) => ({
    date: r.date,
    volume: parseInt(r.volume, 10),
    net_sentiment_score: parseFloat(r.net_sentiment_score),
    brand_health_score: parseFloat(r.brand_health_score),
  }));
}
