const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export type BrandProtectionSubmitParams = {
  account_id: string;
  urls?: string[];
};

export type BrandProtectionSubmitResponse = {
  skipped_urls?: Array<Record<string, unknown>>;
  submitted_urls?: Array<Record<string, unknown>>;
};

function getCloudflareToken(): string {
  const token = String(process.env.CF_API_TOKEN || process.env.CF_API_KEY || '').trim();
  if (!token) {
    throw new Error('Cloudflare API token missing (set CF_API_TOKEN or CF_API_KEY)');
  }
  return token;
}

function normalizeUrlList(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const normalized = urls
    .map((u) => String(u || '').trim())
    .filter(Boolean)
    .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`))
    .filter((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    });
  return [...new Set(normalized)];
}

export async function submitBrandProtectionUrls(
  params: BrandProtectionSubmitParams,
): Promise<BrandProtectionSubmitResponse> {
  const accountId = String(params.account_id || '').trim();
  if (!accountId) {
    throw new Error('account_id is required');
  }

  const token = getCloudflareToken();
  const urls = normalizeUrlList(params.urls || []);

  const resp = await fetch(`${CF_API_BASE}/accounts/${accountId}/brand-protection/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urls }),
  });

  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const detail = json?.errors?.[0]?.message || json?.messages?.[0] || resp.statusText;
    throw new Error(`Cloudflare Brand Protection submit failed (${resp.status}): ${detail}`);
  }

  const result = (json?.result || {}) as BrandProtectionSubmitResponse;
  return {
    skipped_urls: Array.isArray(result.skipped_urls) ? result.skipped_urls : [],
    submitted_urls: Array.isArray(result.submitted_urls) ? result.submitted_urls : [],
  };
}
