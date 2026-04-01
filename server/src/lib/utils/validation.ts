// validation.ts
import { buildEvidence, Evidence } from './evidenceUtils.js';

/**
 * Result of URL validation and normalization
 */
export type ValidationResult = {
  valid: boolean;
  normalizedUrl?: string;
  evidence: Evidence[];
  errors: string[];
};

/**
 * Validate & normalize a URL string
 * @param rawUrl - user-provided URL
 * @returns ValidationResult
 */
export function validateAndNormalizeUrl(rawUrl: string): ValidationResult {
  const evidence: Evidence[] = [];
  const errors: string[] = [];

  if (!rawUrl || typeof rawUrl !== 'string') {
    errors.push('URL must be a non-empty string');
    evidence.push(
      buildEvidence({
        proof: null,
        source: rawUrl,
        verifiedBy: 'URL Validator',
        description: 'Provided URL is empty or not a string'
      })
    );
    return { valid: false, evidence, errors };
  }

  let urlObj: URL;
  try {
    const prefixed = rawUrl.match(/^https?:\/\//i) ? rawUrl : `https://${rawUrl}`;
    urlObj = new URL(prefixed);
  } catch {
    errors.push('Invalid URL format');
    evidence.push(
      buildEvidence({
        proof: rawUrl,
        source: rawUrl,
        verifiedBy: 'URL Validator',
        description: 'Failed to parse URL'
      })
    );
    return { valid: false, evidence, errors };
  }

  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    errors.push('URL must use http:// or https://');
    evidence.push(
      buildEvidence({
        proof: urlObj.protocol,
        source: urlObj.href,
        verifiedBy: 'URL Validator',
        description: 'Unsupported protocol'
      })
    );
    return { valid: false, evidence, errors };
  }

  // Normalize protocol and hostname
  urlObj.protocol = urlObj.protocol.toLowerCase();
  urlObj.hostname = urlObj.hostname.toLowerCase();

  // Remove default ports
  if ((urlObj.protocol === 'http:' && urlObj.port === '80') ||
      (urlObj.protocol === 'https:' && urlObj.port === '443')) {
    urlObj.port = '';
  }

  // Remove trailing slash (except root)
  if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
    urlObj.pathname = urlObj.pathname.slice(0, -1);
  }

  const normalizedUrl = urlObj.toString();
  evidence.push(
    buildEvidence({
      proof: normalizedUrl,
      source: rawUrl,
      verifiedBy: 'URL Validator',
      description: 'URL successfully validated and normalized'
    })
  );

  return { valid: true, normalizedUrl, evidence, errors };
}