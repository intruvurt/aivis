export type NormalizePublicUrlResult =
  | { ok: true; url: string; hostname: string; error?: undefined }
  | { ok: false; error: string; url?: undefined; hostname?: undefined };

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (['127.0.0.1', '0.0.0.0', '::1'].includes(host)) return true;

  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;

  if (/^[0-9a-f:]+$/i.test(host)) {
    if (host.startsWith('fe80:')) return true;
    if (host.startsWith('fc') || host.startsWith('fd')) return true;
  }

  return false;
}

export function normalizePublicHttpUrl(rawUrl: string, opts?: { allowPrivate?: boolean }): NormalizePublicUrlResult {
  let input = String(rawUrl || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (input.startsWith('<') && input.endsWith('>')) {
    input = input.slice(1, -1).trim();
  }
  if (!input) return { ok: false, error: 'URL is required' };

  const normalizedInput = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input) ? input : `https://${input}`;

  let parsed: URL;
  try {
    parsed = new URL(normalizedInput);
  } catch {
    try {
      parsed = new URL(encodeURI(normalizedInput));
    } catch {
      return { ok: false, error: 'Invalid URL format' };
    }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Only http/https URLs are supported' };
  }

  const normalizedHostname = parsed.hostname.replace(/\.+$/, '').toLowerCase();
  if (!normalizedHostname) {
    return { ok: false, error: 'Invalid URL format' };
  }
  parsed.hostname = normalizedHostname;

  const allowPrivate = Boolean(opts?.allowPrivate) || process.env.ALLOW_PRIVATE_ANALYZE_TARGETS === 'true';
  if (!allowPrivate && isPrivateOrLocalHost(normalizedHostname)) {
    return { ok: false, error: 'Private/internal URLs are not allowed' };
  }

  if (parsed.protocol === 'http:') parsed.protocol = 'https:';
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const canonicalUrl = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;

  return { ok: true, url: canonicalUrl, hostname: normalizedHostname };
}

export { isPrivateOrLocalHost };
