// server/src/services/citationStrength.ts
// Heuristic-based citation strength — NO AI calls.
// This avoids competing with the main AI1 pipeline for OpenRouter rate limits
// and eliminates provider-backoff poisoning that was causing deterministic fallbacks.
import type { CitationStrength } from '../../../shared/types.js';

type Strength = 'high' | 'medium' | 'low' | 'unknown';

// Well-known high-authority domains (extensible)
const HIGH_AUTHORITY = new Set([
  'google.com', 'youtube.com', 'wikipedia.org', 'github.com', 'microsoft.com',
  'apple.com', 'amazon.com', 'linkedin.com', 'twitter.com', 'x.com',
  'facebook.com', 'instagram.com', 'reddit.com', 'stackoverflow.com',
  'nytimes.com', 'bbc.com', 'bbc.co.uk', 'reuters.com', 'bloomberg.com',
  'wsj.com', 'forbes.com', 'cnn.com', 'theguardian.com', 'washingtonpost.com',
  'arxiv.org', 'nature.com', 'sciencedirect.com', 'springer.com', 'pubmed.ncbi.nlm.nih.gov',
  'mozilla.org', 'w3.org', 'ietf.org', 'iso.org', 'acm.org', 'ieee.org',
  'stripe.com', 'cloudflare.com', 'aws.amazon.com', 'azure.microsoft.com',
  'docs.google.com', 'drive.google.com', 'cloud.google.com',
  'npmjs.com', 'pypi.org', 'crates.io', 'hub.docker.com',
  'medium.com', 'dev.to', 'hackernews.com', 'producthunt.com',
  'un.org', 'who.int', 'europa.eu', 'gov.uk', 'whitehouse.gov',
]);

// TLD-based authority heuristic
const HIGH_AUTH_TLDS = new Set(['.gov', '.edu', '.mil', '.int']);
const MEDIUM_AUTH_TLDS = new Set(['.org', '.ac.uk', '.edu.au']);

function cleanDomain(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

function classifyDomain(domain: string): Strength {
  if (!domain) return 'unknown';
  // Exact match
  if (HIGH_AUTHORITY.has(domain)) return 'high';
  // Check if it's a subdomain of a known authority (e.g., docs.github.com)
  for (const auth of HIGH_AUTHORITY) {
    if (domain.endsWith(`.${auth}`)) return 'high';
  }
  // TLD-based
  for (const tld of HIGH_AUTH_TLDS) {
    if (domain.endsWith(tld)) return 'high';
  }
  for (const tld of MEDIUM_AUTH_TLDS) {
    if (domain.endsWith(tld)) return 'medium';
  }
  // Known commercial TLDs with likely medium authority
  if (domain.endsWith('.com') || domain.endsWith('.io') || domain.endsWith('.co')) return 'medium';
  return 'low';
}

/**
 * Classify citation strength for external domains using heuristics.
 * Zero-latency, zero-cost, no AI calls — prevents rate-limit interference.
 */
export async function assessCitationStrength(
  domains: string[],
  _pageText: string,
  _apiKey: string
): Promise<CitationStrength[]> {
  const seen = new Set<string>();
  const results: CitationStrength[] = [];

  for (const raw of (domains || [])) {
    const domain = cleanDomain(raw);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    if (results.length >= 40) break;

    const strength = classifyDomain(domain);
    results.push({ domain, strength });
  }

  return results;
}