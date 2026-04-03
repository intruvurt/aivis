/**
 * IndexNow utility — submit URL sets to IndexNow-compatible search engines
 * automatically when AiVIS insight content or public share pages are published.
 *
 * Env:
 *   INDEXNOW_KEY   — 32-128 char hex key. Generate once and place the key
 *                    file at /public/<key>.txt on the domain.
 *   FRONTEND_URL   — canonical origin e.g. https://aivis.biz
 */

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

export interface IndexNowResult {
  submitted: number;
  skipped:   number;
  error?:    string;
}

/**
 * pingIndexNow — fire-and-forget safe. Never throws; returns a result object.
 * Automatically de-dupes and filters to the host defined in FRONTEND_URL.
 */
export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY || process.env.INDEXNOW_API_KEY;
  const host = (() => {
    try {
      return new URL(process.env.FRONTEND_URL || 'https://aivis.biz').host;
    } catch {
      return 'aivis.biz';
    }
  })();

  if (!key) {
    console.warn('[IndexNow] INDEXNOW_KEY not set — ping skipped');
    return { submitted: 0, skipped: urls.length, error: 'INDEXNOW_KEY not configured' };
  }

  // De-dupe and restrict to own host
  const keyLocation = `https://${host}/${key}.txt`;
  const ownUrls = [...new Set(
    urls
      .filter((u) => {
        try { return new URL(u).host === host; } catch { return false; }
      })
  )];

  if (ownUrls.length === 0) {
    return { submitted: 0, skipped: urls.length, error: `No submitted URLs match the site host (${host}). IndexNow can only notify for URLs on your own domain.` };
  }

  // Self-check: verify key file is accessible before submitting
  try {
    const probe = await fetch(keyLocation, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    });
    if (!probe.ok) {
      console.warn(`[IndexNow] Key file not accessible at ${keyLocation} (HTTP ${probe.status}). Upload ${key}.txt containing "${key}" to your site root.`);
      return { submitted: 0, skipped: urls.length, error: `Key file unreachable at ${keyLocation} (HTTP ${probe.status})` };
    }
    const body = (await probe.text()).trim();
    if (body !== key) {
      console.warn(`[IndexNow] Key file at ${keyLocation} returned unexpected content. Expected "${key}", got "${body.slice(0, 60)}…". Ensure the file contains only the key string.`);
      return { submitted: 0, skipped: urls.length, error: `Key file content mismatch` };
    }
  } catch (err: any) {
    console.warn(`[IndexNow] Could not verify key file at ${keyLocation}:`, err?.message);
    // Continue anyway — the file may be fine but our fetch couldn't reach it due to network
  }

  try {
    const body = JSON.stringify({
      host,
      key,
      keyLocation,
      urlList: ownUrls,
    });

    const resp = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body,
      signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn(`[IndexNow] Non-OK response ${resp.status}: ${text.slice(0, 200)}`);
      return { submitted: 0, skipped: urls.length, error: `HTTP ${resp.status}` };
    }

    console.log(`[IndexNow] Submitted ${ownUrls.length} URL(s) to IndexNow`);
    return { submitted: ownUrls.length, skipped: urls.length - ownUrls.length };
  } catch (err: any) {
    console.warn('[IndexNow] Ping failed (non-fatal):', err?.message);
    return { submitted: 0, skipped: urls.length, error: String(err?.message) };
  }
}

/**
 * pingIndexNowOnce — convenience wrapper for pinging a single URL.
 */
export function pingIndexNowOnce(url: string): Promise<IndexNowResult> {
  return pingIndexNow([url]);
}
