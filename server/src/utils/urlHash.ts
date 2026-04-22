import { createHash } from 'crypto';
import { normalizeTrackedUrl } from './normalizeUrl.js';

export function hashSha256Hex(input: string): string {
  return createHash('sha256').update(String(input || '')).digest('hex');
}

export function hashNormalizedUrl(url: string): string {
  const normalized = normalizeTrackedUrl(url);
  return hashSha256Hex(normalized);
}
