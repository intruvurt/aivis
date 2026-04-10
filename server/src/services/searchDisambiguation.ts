// server/src/services/searchDisambiguation.ts
// Shared helpers for brand/competitor disambiguation across all search services.
// Ported from the BRA relevance scoring in citations.controllers.ts to ensure
// consistent quality in mention tracking, web search, DDG and Wikipedia checks.

/**
 * Escape a string for use in a RegExp.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary test: returns true if `brand` appears as a standalone word
 * (not embedded inside a longer compound word like "AivisSpeech").
 */
export function brandMatchesWordBoundary(text: string, brand: string): boolean {
  if (!brand || brand.length < 2) return false;
  const pattern = new RegExp(`\\b${escapeRegex(brand)}\\b`, 'i');
  return pattern.test(text);
}

/**
 * Detects whether the brand name appears ONLY as a substring inside compound
 * words (e.g. "AivisSpeech") and never as a standalone token.
 * Returns true when every occurrence is embedded — a signal of a false positive.
 */
export function isCompoundWordOnly(text: string, brand: string): boolean {
  if (!brand || brand.length < 2) return false;
  const lc = text.toLowerCase();
  const nameLc = brand.toLowerCase();
  const regex = new RegExp(escapeRegex(nameLc), 'gi');
  let hasStandalone = false;
  let hasCompound = false;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(lc)) !== null) {
    const before = m.index > 0 ? lc[m.index - 1] : ' ';
    const after = lc[m.index + nameLc.length] || ' ';
    if (/[a-z0-9]/i.test(before) || /[a-z0-9]/i.test(after)) {
      hasCompound = true;
    } else {
      hasStandalone = true;
    }
  }
  return hasCompound && !hasStandalone;
}

/**
 * Common root labels extracted from competitor hostnames that are too generic
 * to be used as brand-name matches (e.g. "ai.com" → label "ai").
 */
const COMMON_ROOT_LABELS = new Set([
  'best', 'tools', 'guide', 'blog', 'docs', 'help', 'home', 'app', 'apps',
  'data', 'search', 'seo', 'ai', 'web', 'cloud', 'labs', 'news', 'media',
  'info', 'tech', 'dev', 'hub', 'site', 'page', 'my', 'the', 'get',
  'go', 'pro', 'online', 'free', 'test', 'demo', 'api', 'io', 'co',
]);

export function isCommonRootLabel(label: string): boolean {
  return COMMON_ROOT_LABELS.has(label.toLowerCase());
}

/**
 * Check whether a search result text mentions a brand using word-boundary
 * matching and compound-word rejection for short brand names (≤12 chars).
 *
 * Replaces the old `text.toLowerCase().includes(brand.toLowerCase())` pattern
 * across all search services.
 */
export function textMentionsBrand(text: string, brand: string): boolean {
  if (!text || !brand) return false;
  // For very short brands (≤3 chars) require exact case to reduce noise
  if (brand.length <= 3) {
    return text.includes(brand);
  }
  // Word-boundary check
  if (!brandMatchesWordBoundary(text, brand)) return false;
  // For short-to-medium brands, reject compound-only matches
  if (brand.length <= 12 && isCompoundWordOnly(text, brand)) return false;
  return true;
}

/**
 * Check whether a competitor URL's hostname (or its root label) appears
 * in a search result, using word-boundary matching with common-label guard.
 */
export function resultMatchesCompetitor(
  resultHost: string,
  resultTitle: string,
  resultDescription: string,
  competitorHost: string,
): boolean {
  // Exact host match — always accept
  if (resultHost === competitorHost) return true;

  const label = competitorHost.split('.')[0]?.toLowerCase() || '';
  // Skip labels that are too short or too generic
  if (!label || label.length < 4 || isCommonRootLabel(label)) return false;

  // Word-boundary match in title or description
  return (
    brandMatchesWordBoundary(resultTitle, label) ||
    brandMatchesWordBoundary(resultDescription, label)
  );
}
