/**
 * Cloudflare Browser Run integration.
 *
 * Uses the CF Browser Run /content Quick Action endpoint to render
 * JavaScript-heavy pages remotely. Falls back gracefully when
 * CF_ACCOUNT_ID or CF_API_TOKEN are missing.
 *
 * Docs: https://developers.cloudflare.com/browser-run/quick-actions/content-endpoint/
 */

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CF_API_TOKEN || process.env.CF_API_KEY || '';
const CF_CONTENT_URL = CF_ACCOUNT_ID
    ? `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/content`
    : '';

/** Whether CF Browser Run credentials are configured */
export function isCfBrowserRunAvailable(): boolean {
    return CF_CONTENT_URL.length > 0 && CF_API_TOKEN.length > 0;
}

export interface CfContentResult {
    html: string;
    browserMs: number;
}

/**
 * Fetch fully rendered HTML via CF Browser Run /content endpoint.
 * Throws on misconfiguration, timeout, or HTTP error.
 */
export async function cfFetchContent(
    url: string,
    timeoutMs = 10_000,
): Promise<CfContentResult> {
    if (!isCfBrowserRunAvailable()) {
        throw new Error('[CfBrowserRun] Not configured (missing CF_ACCOUNT_ID or CF_API_TOKEN)');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const start = Date.now();
        const res = await fetch(CF_CONTENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${CF_API_TOKEN}`,
            },
            body: JSON.stringify({
                url,
                gotoOptions: { waitUntil: 'networkidle2' },
                rejectResourceTypes: ['image', 'font', 'media'],
            }),
            signal: controller.signal,
        });

        const browserMs = Number(res.headers.get('x-browser-ms-used') || 0);

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(
                `[CfBrowserRun] HTTP ${res.status}: ${body.slice(0, 200)}`,
            );
        }

        const html = await res.text();
        return { html, browserMs: browserMs || (Date.now() - start) };
    } finally {
        clearTimeout(timer);
    }
}
