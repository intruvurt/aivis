/**
 * rssFeedService.ts
 *
 * RSS 2.0 feed emitter for the AiVIS graph expansion pipeline.
 *
 * Serves a machine-readable feed of:
 *   - gap_discovered     — new visibility gap detected from scan
 *   - citation_failure   — entity absent from model response
 *   - page_published     — new indexable page generated
 *   - graph_updated      — new semantic relationship edge written
 *
 * This feed is critical for LLM ingestion surfaces:
 *   - Perplexity, ChatGPT browsing, and Claude use RSS/Atom to discover
 *     new content and update their knowledge state
 *   - Structured XML with semantic titles accelerates indexing
 *
 * Endpoint: GET /api/feed.xml
 * Responses are cached for 5 minutes to avoid DB hammering.
 */

import { getPool } from './postgresql.js';

const SITE_URL = (process.env.FRONTEND_URL || 'https://aivis.biz').replace(/\/+$/, '');
const SITE_TITLE = 'AiVIS — AI Visibility Intelligence Feed';
const SITE_DESCRIPTION = 'Real-time feed of AI visibility gaps, citation failures, and evidence discoveries from the AiVIS citation engine.';
const FEED_LIMIT = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Types ─────────────────────────────────────────────────────────────────────

interface RssEventRow {
    id: string;
    event_type: 'gap_discovered' | 'citation_failure' | 'page_published' | 'graph_updated';
    title: string;
    description: string;
    link: string | null;
    entity: string | null;
    emitted_at: string;
}

// ── Simple in-process cache ───────────────────────────────────────────────────

let _cachedFeed: string | null = null;
let _cacheExpiry = 0;

function invalidateFeedCache(): void {
    _cachedFeed = null;
    _cacheExpiry = 0;
}

// ── XML helpers ───────────────────────────────────────────────────────────────

function escXml(raw: string): string {
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function toRfc822(isoString: string): string {
    try {
        return new Date(isoString).toUTCString();
    } catch {
        return new Date().toUTCString();
    }
}

function categoryForEventType(type: RssEventRow['event_type']): string {
    switch (type) {
        case 'gap_discovered': return 'Visibility Gap';
        case 'citation_failure': return 'Citation Failure';
        case 'page_published': return 'Content Published';
        case 'graph_updated': return 'Graph Update';
    }
}

// ── Feed builder ──────────────────────────────────────────────────────────────

function buildRssXml(events: RssEventRow[], builtAt: Date): string {
    const items = events.map((e) => {
        const link = e.link ? escXml(e.link) : `${escXml(SITE_URL)}/feed`;
        const guid = `${SITE_URL}/feed/events/${escXml(e.id)}`;
        const category = categoryForEventType(e.event_type);
        const entityTag = e.entity
            ? `\n    <dc:subject>${escXml(e.entity)}</dc:subject>`
            : '';

        return `  <item>
    <title>${escXml(e.title)}</title>
    <description>${escXml(e.description)}</description>
    <link>${link}</link>
    <guid isPermaLink="false">${guid}</guid>
    <pubDate>${toRfc822(e.emitted_at)}</pubDate>
    <category>${escXml(category)}</category>${entityTag}
  </item>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escXml(SITE_TITLE)}</title>
    <link>${escXml(SITE_URL)}</link>
    <description>${escXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${builtAt.toUTCString()}</lastBuildDate>
    <atom:link href="${escXml(SITE_URL)}/api/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${escXml(SITE_URL)}/favicon.png</url>
      <title>${escXml(SITE_TITLE)}</title>
      <link>${escXml(SITE_URL)}</link>
    </image>
${items}
  </channel>
</rss>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch recent RSS events from DB and render as RSS 2.0 XML.
 * Responses are cached for CACHE_TTL_MS to reduce DB load.
 */
export async function getRssFeedXml(options?: {
    event_type?: RssEventRow['event_type'];
    entity?: string;
    limit?: number;
}): Promise<string> {
    // Serve from cache if fresh (only for default feed with no filters)
    const isDefaultFeed = !options?.event_type && !options?.entity;
    if (isDefaultFeed && _cachedFeed && Date.now() < _cacheExpiry) {
        return _cachedFeed;
    }

    const pool = getPool();
    const limit = Math.min(options?.limit ?? FEED_LIMIT, 500);

    try {
        const params: (string | number)[] = [];
        const conditions: string[] = [];

        if (options?.event_type) {
            params.push(options.event_type);
            conditions.push(`event_type = $${params.length}`);
        }

        if (options?.entity) {
            params.push(options.entity);
            conditions.push(`LOWER(entity) = LOWER($${params.length})`);
        }

        params.push(limit);
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await pool.query(
            `SELECT id, event_type, title, description, link, entity, emitted_at
             FROM rss_events
             ${whereClause}
             ORDER BY emitted_at DESC
             LIMIT $${params.length}`,
            params,
        );

        const events = result.rows as RssEventRow[];
        const builtAt = new Date();
        const xml = buildRssXml(events, builtAt);

        if (isDefaultFeed) {
            _cachedFeed = xml;
            _cacheExpiry = Date.now() + CACHE_TTL_MS;
        }

        return xml;
    } catch {
        // Return minimal valid feed on DB error
        return buildRssXml([], new Date());
    }
}

/**
 * Invalidate the feed cache — call after writing new RSS events in tests.
 */
export { invalidateFeedCache };
