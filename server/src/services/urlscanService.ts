// server/src/services/urlscanService.ts
// urlscan.io integration - external page analysis (security headers, tech stack, TLS, screenshots)

const URLSCAN_API_KEY = process.env.URLSCAN_API_KEY || '';
const URLSCAN_BASE = 'https://urlscan.io/api/v1';

if (URLSCAN_API_KEY) {
  console.log('[urlscan.io]  API key configured');
} else {
  console.log('[urlscan.io]  API key not configured - urlscan features unavailable');
}

export interface UrlscanSubmitResult {
  uuid: string;
  url: string;
  visibility: string;
  api: string;
  result: string;
}

export interface UrlscanTechEntry {
  app: string;
  categories?: string[];
  confidence?: number;
}

export interface UrlscanCertificate {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
}

export interface UrlscanEnrichment {
  uuid: string;
  screenshotUrl: string | null;
  technologies: UrlscanTechEntry[];
  securityHeaders: Record<string, string>;
  certificate: UrlscanCertificate | null;
  serverIp: string | null;
  serverCountry: string | null;
  redirectChain: string[];
  consoleLogs: number;
  thirdPartyDomains: string[];
  totalRequests: number;
  malicious: boolean;
  score: number;
  error?: string;
}

/** Check whether the urlscan.io integration is available */
export function isUrlscanAvailable(): boolean {
  return !!URLSCAN_API_KEY;
}

/** Submit a URL for scanning. Returns the scan UUID for polling. */
export async function submitUrlscan(targetUrl: string): Promise<UrlscanSubmitResult> {
  if (!URLSCAN_API_KEY) throw new Error('URLSCAN_API_KEY not configured');

  const res = await fetch(`${URLSCAN_BASE}/scan/`, {
    method: 'POST',
    headers: {
      'API-Key': URLSCAN_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: targetUrl, visibility: 'unlisted' }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`urlscan.io submit failed (${res.status}): ${body.substring(0, 200)}`);
  }

  return (await res.json()) as UrlscanSubmitResult;
}

/** Poll for scan results. urlscan.io typically takes 10-30s. */
export async function getUrlscanResult(uuid: string, pollTimeoutMs = 60_000): Promise<UrlscanEnrichment> {
  if (!URLSCAN_API_KEY) throw new Error('URLSCAN_API_KEY not configured');

  const resultUrl = `${URLSCAN_BASE}/result/${encodeURIComponent(uuid)}/`;
  const deadline = Date.now() + pollTimeoutMs;
  let lastStatus = 0;

  while (Date.now() < deadline) {
    const res = await fetch(resultUrl, {
      headers: { 'API-Key': URLSCAN_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    lastStatus = res.status;

    if (res.status === 200) {
      const data = await res.json() as any;
      return extractEnrichment(uuid, data);
    }

    // 404 = scan still processing
    if (res.status === 404) {
      await new Promise(r => setTimeout(r, 5_000));
      continue;
    }

    const body = await res.text().catch(() => '');
    throw new Error(`urlscan.io result fetch failed (${res.status}): ${body.substring(0, 200)}`);
  }

  throw new Error(`urlscan.io result poll timed out after ${pollTimeoutMs}ms (last status: ${lastStatus})`);
}

/**
 * One-shot: submit + poll. Use when you can afford to wait ~20-40s.
 * For pipeline use, prefer submitUrlscan() then getUrlscanResult() with your own timing.
 */
export async function scanAndEnrich(targetUrl: string, pollTimeoutMs = 60_000): Promise<UrlscanEnrichment> {
  const submission = await submitUrlscan(targetUrl);
  console.log(`[urlscan.io] Submitted ${targetUrl} → uuid=${submission.uuid}`);
  return getUrlscanResult(submission.uuid, pollTimeoutMs);
}

/** Extract useful enrichment fields from the raw urlscan.io result JSON */
function extractEnrichment(uuid: string, raw: any): UrlscanEnrichment {
  const page = raw?.page || {};
  const lists = raw?.lists || {};
  const stats = raw?.stats || {};
  const meta = raw?.meta || {};
  const verdicts = raw?.verdicts || {};

  // Security headers from the main page response
  const securityHeaders: Record<string, string> = {};
  const mainResponse = raw?.data?.requests?.find((r: any) =>
    r?.response?.response?.url === page.url && r?.response?.response?.status < 400
  );
  const headers = mainResponse?.response?.response?.headers || {};
  const secHeaderNames = [
    'strict-transport-security', 'content-security-policy', 'x-frame-options',
    'x-content-type-options', 'referrer-policy', 'permissions-policy',
    'x-xss-protection', 'cross-origin-opener-policy', 'cross-origin-resource-policy',
  ];
  for (const [key, val] of Object.entries(headers)) {
    if (secHeaderNames.includes(key.toLowerCase())) {
      securityHeaders[key.toLowerCase()] = String(val);
    }
  }

  // Technologies
  const technologies: UrlscanTechEntry[] = (lists.technologies || []).map((t: any) => ({
    app: t.app || t.name || 'unknown',
    categories: t.categories || [],
    confidence: t.confidence,
  }));

  // Certificate
  let certificate: UrlscanCertificate | null = null;
  const certs = lists.certificates || [];
  if (certs.length > 0) {
    const c = certs[0];
    certificate = {
      subject: c.subjectName || c.subject || '',
      issuer: c.issuer || '',
      validFrom: c.validFrom ? new Date(c.validFrom * 1000).toISOString() : '',
      validTo: c.validTo ? new Date(c.validTo * 1000).toISOString() : '',
    };
  }

  // Redirect chain
  const redirectChain: string[] = (raw?.data?.requests || [])
    .filter((r: any) => r?.response?.response?.status >= 300 && r?.response?.response?.status < 400)
    .map((r: any) => r?.response?.response?.url)
    .filter(Boolean)
    .slice(0, 10);

  // Third-party domains
  const pageDomain = page.domain || '';
  const thirdPartyDomains: string[] = [...new Set<string>(
    (lists.domains || []).filter((d: string) => d !== pageDomain)
  )].slice(0, 50);

  return {
    uuid,
    screenshotUrl: `https://urlscan.io/screenshots/${uuid}.png`,
    technologies,
    securityHeaders,
    certificate,
    serverIp: page.ip || null,
    serverCountry: page.country || null,
    redirectChain,
    consoleLogs: stats.consoleMsgs || 0,
    thirdPartyDomains,
    totalRequests: stats.requests || stats.totalRequests || 0,
    malicious: verdicts?.overall?.malicious === true,
    score: verdicts?.overall?.score || 0,
  };
}
