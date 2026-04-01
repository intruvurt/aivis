import { normalizePublicHttpUrl } from '../lib/urlSafety.js';

type EnrichedOrgProfile = {
  website: string;
  domain: string;
  org_name: string | null;
  org_description: string | null;
  org_logo_url: string | null;
  org_favicon_url: string | null;
  org_phone: string | null;
  org_address: string | null;
  confidence_score: number;
  verified: boolean;
  verification_reasons: string[];
};

function stripHtml(input: string): string {
  return String(input || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(input: unknown): string | null {
  const text = stripHtml(String(input || '')).trim();
  if (!text) return null;
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

function safeUrl(raw: unknown, base: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractMeta(html: string, attr: 'name' | 'property', key: string): string | null {
  const patternA = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const patternB = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["'][^>]*>`, 'i');
  const match = html.match(patternA)?.[1] || html.match(patternB)?.[1] || '';
  return cleanText(match);
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  return cleanText(match);
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
  for (const rel of rels) {
    const regex = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["'][^>]*>`, 'i');
    const href = html.match(regex)?.[1];
    if (href) {
      const resolved = safeUrl(href, baseUrl);
      if (resolved) return resolved;
    }
  }
  try {
    const base = new URL(baseUrl);
    return `${base.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function parseJsonLd(html: string): any[] {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const nodes: any[] = [];

  for (const script of scripts) {
    const content = script
      .replace(/<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .trim();
    if (!content) continue;

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        nodes.push(...parsed);
      } else if (parsed && Array.isArray(parsed['@graph'])) {
        nodes.push(...parsed['@graph']);
      } else {
        nodes.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return nodes.filter(Boolean);
}

function normalizeEntityName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityScore(a: string, b: string): number {
  const x = normalizeEntityName(a);
  const y = normalizeEntityName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;

  const xTokens = new Set(x.split(' '));
  const yTokens = new Set(y.split(' '));
  const overlap = [...xTokens].filter((token) => yTokens.has(token)).length;
  const base = Math.max(xTokens.size, yTokens.size, 1);
  return overlap / base;
}

export async function enrichOrgProfileFromWebsite(input: {
  website: string;
  claimedEntityName?: string | null;
}): Promise<EnrichedOrgProfile | null> {
  const normalized = normalizePublicHttpUrl(input.website);
  if (!normalized.ok) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(normalized.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'aivis-profile-enricher/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const finalUrl = res.url || normalized.url;
    const html = await res.text();
    const jsonLd = parseJsonLd(html);

    const orgNode = jsonLd.find((node) => {
      const typeValue = String(node?.['@type'] || '').toLowerCase();
      return (
        typeValue.includes('organization') ||
        typeValue.includes('localbusiness') ||
        typeValue.includes('corporation') ||
        typeValue.includes('person')
      );
    });

    const webNode = jsonLd.find((node) => String(node?.['@type'] || '').toLowerCase().includes('website'));

    const title = extractTitle(html);
    const metaDescription =
      extractMeta(html, 'name', 'description') ||
      extractMeta(html, 'property', 'og:description');

    const ogSiteName = extractMeta(html, 'property', 'og:site_name');
    const ogImage = extractMeta(html, 'property', 'og:image');

    const orgName =
      cleanText(orgNode?.name) ||
      cleanText(ogSiteName) ||
      cleanText(webNode?.name) ||
      cleanText(title?.split('|')[0] || title || '');

    const orgDescription =
      cleanText(orgNode?.description) ||
      cleanText(metaDescription) ||
      cleanText(webNode?.description);

    const orgLogo =
      safeUrl(orgNode?.logo?.url || orgNode?.logo, finalUrl) ||
      safeUrl(ogImage, finalUrl);

    const orgFavicon = extractFavicon(html, finalUrl);
    const orgPhone = cleanText(orgNode?.telephone);

    const orgAddress = cleanText(
      orgNode?.address?.streetAddress
        ? `${orgNode.address.streetAddress}, ${orgNode.address.addressLocality || ''}, ${orgNode.address.addressRegion || ''} ${orgNode.address.postalCode || ''}`
        : orgNode?.address?.name || ''
    );

    const verificationReasons: string[] = [];
    let confidence = 0;

    if (orgName) {
      confidence += 35;
      verificationReasons.push('Organization name extracted from metadata/schema.');
    }
    if (orgDescription) {
      confidence += 15;
      verificationReasons.push('Organization description extracted.');
    }
    if (orgLogo || orgFavicon) {
      confidence += 15;
      verificationReasons.push('Brand imagery (logo/favicon) detected.');
    }
    if (orgPhone || orgAddress) {
      confidence += 15;
      verificationReasons.push('NAP signals detected (phone/address).');
    }

    const domainMatch = (() => {
      try {
        const a = new URL(finalUrl).hostname.replace(/^www\./, '').toLowerCase();
        const b = new URL(normalized.url).hostname.replace(/^www\./, '').toLowerCase();
        return a === b;
      } catch {
        return false;
      }
    })();

    if (domainMatch) {
      confidence += 10;
      verificationReasons.push('Final domain matches claimed website domain.');
    }

    const claimed = cleanText(input.claimedEntityName || '');
    const nameSimilarity = claimed && orgName ? similarityScore(claimed, orgName) : null;

    if (nameSimilarity !== null) {
      if (nameSimilarity >= 0.65) {
        confidence += 10;
        verificationReasons.push('Claimed entity name closely matches extracted organization name.');
      } else {
        verificationReasons.push('Claimed entity name does not strongly match extracted organization name.');
      }
    }

    const verified = confidence >= 55 && Boolean(orgName) && domainMatch;

    return {
      website: normalized.url,
      domain: normalized.hostname,
      org_name: orgName,
      org_description: orgDescription,
      org_logo_url: orgLogo,
      org_favicon_url: orgFavicon,
      org_phone: orgPhone,
      org_address: orgAddress,
      confidence_score: Math.min(100, Math.max(0, Math.round(confidence))),
      verified,
      verification_reasons: verificationReasons,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
