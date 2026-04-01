/**
 * Normalize a URL for consistent cache keys, history grouping, and report identity.
 * Canonical form: https forced, lowercase hostname only, trailing slashes stripped
 * (root URLs get '/'), search params preserved.
 */
export function normalizeTrackedUrl(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol === 'http:') parsed.protocol = 'https:';
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return withScheme.toLowerCase();
  }
}
