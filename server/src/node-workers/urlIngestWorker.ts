import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import { isSafeExternalUrl } from '../middleware/securityMiddleware.js';
import { enqueueRawDocumentAndWait, type RawDocumentPersistedResult } from '../infra/queues/rawDocumentQueue.js';
import { toRawDocumentEvent } from './ingestPipeline.js';
import { normalizeUrl } from './urlNormalizer.js';

const FETCH_TIMEOUT_MS = 20_000;
const MAX_TEXT_LEN = 150_000;

function collapseWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function sanitizeChunk(input: unknown): string {
    if (typeof input !== 'string') return '';
    return collapseWhitespace(input.replace(/<[^>]+>/g, ' '));
}

function truncate(text: string, maxLen = MAX_TEXT_LEN): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen);
}

function isLikelyRss(contentType: string, body: string): boolean {
    const ct = (contentType || '').toLowerCase();
    if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) return true;
    const head = body.slice(0, 4000).toLowerCase();
    return head.includes('<rss') || head.includes('<feed') || head.includes('<channel') || head.includes('<?xml');
}

async function extractRssText(xml: string): Promise<string> {
    const parsed: any = await parseStringPromise(xml, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
    });

    const channelItems = parsed?.rss?.channel?.item;
    const feedEntries = parsed?.feed?.entry;

    const rows = Array.isArray(channelItems)
        ? channelItems
        : channelItems
            ? [channelItems]
            : Array.isArray(feedEntries)
                ? feedEntries
                : feedEntries
                    ? [feedEntries]
                    : [];

    const parts: string[] = [];
    for (const row of rows.slice(0, 25)) {
        const title = sanitizeChunk(row?.title?._ || row?.title);
        const description = sanitizeChunk(
            row?.description?._ ||
            row?.description ||
            row?.summary?._ ||
            row?.summary ||
            row?.['content:encoded'] ||
            row?.content?._ ||
            row?.content
        );
        const content = sanitizeChunk(row?.contentSnippet || row?.content);
        const joined = collapseWhitespace([title, description, content].filter(Boolean).join(' '));
        if (joined) parts.push(joined);
    }

    return truncate(collapseWhitespace(parts.join('\n\n')));
}

function extractArticleText(html: string): string {
    const $ = cheerio.load(html);

    $('script, style, noscript, iframe, svg').remove();
    $('nav, footer, header, aside, form, [aria-hidden="true"]').remove();

    const scope = $('main, article, [role="main"]').first();
    const text = scope.length ? scope.text() : $('body').text();

    return truncate(collapseWhitespace(text));
}

async function fetchUrlBody(url: string): Promise<{ body: string; contentType: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'AiVISBot/2.0 (+https://aivis.biz)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Fetch failed with HTTP ${response.status}`);
        }

        const body = await response.text();
        const contentType = response.headers.get('content-type') || '';
        return { body, contentType };
    } finally {
        clearTimeout(timeout);
    }
}

export async function ingestUrlForReplay(params: {
    url: string;
    source?: string;
    timeoutMs?: number;
}): Promise<RawDocumentPersistedResult> {
    const normalizedUrl = normalizeUrl(params.url);
    if (!isSafeExternalUrl(normalizedUrl)) {
        throw new Error('URL is not allowed (invalid protocol or private/local host)');
    }

    const { body, contentType } = await fetchUrlBody(normalizedUrl);
    const rssLike = isLikelyRss(contentType, body);

    const text = rssLike
        ? await extractRssText(body)
        : extractArticleText(body);

    if (!text) {
        throw new Error('No extractable content found at URL');
    }

    const source = (params.source || (rssLike ? 'rss' : 'web')).toLowerCase();

    const event = toRawDocumentEvent({
        url: normalizedUrl,
        source,
        text,
        timestamp: Date.now(),
    });

    return enqueueRawDocumentAndWait(event, params.timeoutMs || 30_000);
}
