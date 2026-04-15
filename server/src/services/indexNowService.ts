/**
 * IndexNow submission service.
 *
 * IndexNow lets you instantly notify Bing, Yandex, and (via relay) Google
 * about new or updated URLs, so they get crawled and indexed faster.
 *
 * Protocol spec: https://www.indexnow.org/documentation
 *
 * Key file must be hosted at:
 *   https://aivis.biz/e31a4b8c5d2f6709a0c3b7e8f9d1a4b5.txt
 * with the key as the sole content (already created in client/public/).
 */

import { existsSync, readFileSync } from "fs";
import path from "path";

const INDEXNOW_KEY = "e31a4b8c5d2f6709a0c3b7e8f9d1a4b5";
const SITE_URL = (process.env.FRONTEND_URL || "https://aivis.biz").replace(/\/+$/, "");
const SITE_HOST = new URL(SITE_URL).hostname; // "aivis.biz"

// IndexNow accepts bulk submissions up to 10 000 URLs per call
const BATCH_SIZE = 1000;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IndexNowResult {
    submitted: number;
    skipped: number;
    batches: number;
    errors: string[];
    sitemapPinged: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Parse the static dist/client/sitemap.xml and return absolute URLs. */
export function getUrlsFromSitemap(): string[] {
    const sitemapPath = path.resolve(process.cwd(), "dist/client/sitemap.xml");
    if (!existsSync(sitemapPath)) {
        // Fall back to client/public/sitemap.xml (pre-build reference)
        const publicPath = path.resolve(process.cwd(), "../client/public/sitemap.xml");
        if (!existsSync(publicPath)) return [];
        try {
            return parseLocTags(readFileSync(publicPath, "utf8"));
        } catch {
            return [];
        }
    }
    try {
        return parseLocTags(readFileSync(sitemapPath, "utf8"));
    } catch {
        return [];
    }
}

function parseLocTags(xml: string): string[] {
    const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
    return matches
        .map((m) => m.replace(/<\/?loc>/g, "").trim())
        .filter((u) => u.startsWith("http"));
}

/** Submit a batch of URLs to a single IndexNow endpoint. */
async function submitBatch(
    endpoint: string,
    urlList: string[],
): Promise<void> {
    const body = JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList,
    });

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
        signal: AbortSignal.timeout(15_000),
    });

    // 200 = success,  202 = accepted (will process later) — both are fine
    if (response.status !== 200 && response.status !== 202) {
        const text = await response.text().catch(() => "");
        throw new Error(`IndexNow ${endpoint} returned ${response.status}: ${text.slice(0, 200)}`);
    }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Submit URLs to IndexNow (Bing relay — covers Bing + Yandex + Google signal).
 *
 * @param urls  Absolute URLs to submit.  If omitted, reads from the sitemap.
 * @returns     Summary of what was submitted.
 */
export async function submitToIndexNow(urls?: string[]): Promise<IndexNowResult> {
    const result: IndexNowResult = {
        submitted: 0,
        skipped: 0,
        batches: 0,
        errors: [],
        sitemapPinged: false,
    };

    const targets = (urls && urls.length > 0) ? urls : getUrlsFromSitemap();

    if (targets.length === 0) {
        result.errors.push("No URLs to submit — sitemap not found or empty");
        return result;
    }

    // Filter to only URLs belonging to this host
    const filtered = targets.filter((u) => {
        try { return new URL(u).hostname === SITE_HOST; } catch { return false; }
    });
    result.skipped = targets.length - filtered.length;

    // Chunk into batches
    const chunks: string[][] = [];
    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
        chunks.push(filtered.slice(i, i + BATCH_SIZE));
    }

    // Submit to Bing's IndexNow endpoint (it relays to Yandex automatically)
    const endpoint = "https://api.indexnow.org/indexnow";

    for (const chunk of chunks) {
        try {
            await submitBatch(endpoint, chunk);
            result.submitted += chunk.length;
            result.batches++;
        } catch (err: any) {
            result.errors.push(err.message || String(err));
        }
    }

    // Ping the sitemap URL (Google + Bing crawl triggers)
    result.sitemapPinged = await pingSitemap();

    return result;
}

/**
 * Ping Google and Bing with the sitemap URL so they re-crawl it.
 * Returns true if at least one ping succeeded.
 */
export async function pingSitemap(): Promise<boolean> {
    const sitemapUrl = `${SITE_URL}/sitemap.xml`;
    const endpoints = [
        `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
        `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    ];

    let anySuccess = false;
    for (const endpoint of endpoints) {
        try {
            const res = await fetch(endpoint, {
                method: "GET",
                signal: AbortSignal.timeout(10_000),
            });
            if (res.status < 400) anySuccess = true;
        } catch {
            // pings are best-effort
        }
    }
    return anySuccess;
}
