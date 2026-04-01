export function normalizePublicUrlInput(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('upload://')) return trimmed;

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:') parsed.protocol = 'https:';
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return normalized.toLowerCase();
  }
}

export function buildTargetKey(input: string): string {
  const normalized = normalizePublicUrlInput(input);
  return normalized.startsWith('upload://') ? normalized.toLowerCase() : normalized;
}
