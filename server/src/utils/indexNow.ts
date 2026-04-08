/**
 * IndexNow utility - submit URL sets to IndexNow-compatible search engines.
 *
 * Env:
 *   INDEXNOW_KEY   - 32-128 char hex key.
 *   FRONTEND_URL   - canonical origin e.g. https://aivis.biz
 */

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

export interface IndexNowResult {
  submitted: number;
  skipped:   number;
  error?:    string;
}

/**
 * pingIndexNow - fire-and-forget safe. Never throws; returns a result object.
 * Groups URLs by host and submits each batch to IndexNow independently.
 */
export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY || process.env.INDEXNOW_API_KEY;

  if (!key) {
    console.warn('[IndexNow] INDEXNOW_KEY not set - ping skipped');
    return { submitted: 0, skipped: urls.length, error: 'INDEXNOW_KEY not configured' };
  }

  // De-dupe and parse valid URLs
  const validUrls = [...new Set(
    urls.filter((u) => { try { new URL(u); return true; } catch { return false; } })
  )];

  if (validUrls.length === 0) {
    return { submitted: 0, skipped: urls.length, error: 'No valid URLs provided' };
  }

  // Group by host — IndexNow requires all URLs in a batch to share the same host
  const byHost = new Map<string, string[]>();
  for (const u of validUrls) {
    const h = new URL(u).host;
    if (!byHost.has(h)) byHost.set(h, []);
    byHost.get(h)!.push(u);
  }

  let totalSubmitted = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const [host, hostUrls] of byHost) {
    try {
      const body = JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: hostUrls,
      });

      const resp = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
        signal: AbortSignal.timeout(8_000),
      });

      if (resp.ok || resp.status === 202) {
        console.log(`[IndexNow] Submitted ${hostUrls.length} URL(s) for ${host}`);
        totalSubmitted += hostUrls.length;
      } else {
        const text = await resp.text().catch(() => '');
        console.warn(`[IndexNow] ${host}: HTTP ${resp.status} - ${text.slice(0, 200)}`);
        errors.push(`${host}: HTTP ${resp.status}`);
        totalSkipped += hostUrls.length;
      }
    } catch (err: any) {
      console.warn(`[IndexNow] ${host}: ${err?.message}`);
      errors.push(`${host}: ${err?.message}`);
      totalSkipped += hostUrls.length;
    }
  }

  return {
    submitted: totalSubmitted,
    skipped: totalSkipped,
    ...(errors.length > 0 ? { error: errors.join('; ') } : {}),
  };
}

/**
 * pingIndexNowOnce - convenience wrapper for pinging a single URL.
 */
export function pingIndexNowOnce(url: string): Promise<IndexNowResult> {
  return pingIndexNow([url]);
}
