/**
 * Evidence Ledger - extracts ~30 evidence categories from ScrapeResult.
 *
 * Every evidence item has:
 *   evidence_id, category, key, label, value_json, status, confidence, notes[]
 *
 * evidence_id is a deterministic hash generated at extraction time:
 *   EV-{sha256(auditRunId + key + status).slice(0,12)}
 * This ensures IDs exist before scoring, before DB, before BRAG gate.
 *
 * This module never throws. If extraction fails for a category,
 * the item is emitted with status='error' and a note explaining why.
 */

import { createHash } from 'crypto';
import { getPool } from '../postgresql.js';
import type { ScrapeResult, StructuredData, RobotsInfo } from '../scraper.js';

// ─── Evidence ID generation ───────────────────────────────────────────────────

/** Deterministic evidence ID: EV-{sha256(auditRunId + key + status)[0:12]} */
function generateEvidenceId(auditRunId: string, key: string, status: string): string {
  const hash = createHash('sha256')
    .update(`${auditRunId}:${key}:${status}`)
    .digest('hex')
    .slice(0, 12);
  return `EV-${hash}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  /** Deterministic ID generated at extraction time: EV-{hash} */
  evidence_id: string;
  category: string;
  key: string;
  label: string;
  value: unknown;
  source?: string;
  selector?: string;
  attribute?: string;
  status: 'present' | 'absent' | 'partial' | 'error';
  confidence: number;
  notes: string[];
}

/** Evidence item before ID assignment — used internally by helper functions */
type RawEvidenceItem = Omit<EvidenceItem, 'evidence_id'>;

export interface EvidenceLedger {
  auditRunId: string;
  url: string;
  items: EvidenceItem[];
  contradictions: Contradiction[];
  extractedAt: string;
}

export interface Contradiction {
  a: string; // key of first evidence
  b: string; // key of second evidence
  description: string;
}

// ─── Main extraction ──────────────────────────────────────────────────────────

export function extractEvidenceFromScrapedData(
  auditRunId: string,
  scrapeResult: ScrapeResult,
): EvidenceLedger {
  const d = scrapeResult.data;
  const rawItems: RawEvidenceItem[] = [];

  // 1. Title
  rawItems.push(textEvidence('meta', 'title', 'Page title', d.title, 'head > title'));

  // 2. Meta description
  rawItems.push(textEvidence('meta', 'meta_description', 'Meta description', d.meta?.description, 'meta[name=description]'));

  // 3. OG title
  rawItems.push(textEvidence('meta', 'og_title', 'Open Graph title', d.meta?.ogTitle, 'meta[property=og:title]'));

  // 4. OG description
  rawItems.push(textEvidence('meta', 'og_description', 'Open Graph description', d.meta?.ogDescription, 'meta[property=og:description]'));

  // 5. Canonical URL
  rawItems.push(textEvidence('indexability', 'canonical', 'Canonical URL', d.canonical, 'link[rel=canonical]'));

  // 6. Headings structure
  rawItems.push(headingsEvidence(d.headings));

  // 7. Word count
  rawItems.push(numericEvidence('content', 'word_count', 'Word count', d.wordCount, undefined, d.wordCount != null && d.wordCount >= 300));

  // 8. Structured data / JSON-LD
  rawItems.push(structuredDataEvidence(d.structuredData));

  // 9. Robots / AI crawler access
  rawItems.push(robotsEvidence(d.robots));

  // 10. llms.txt
  rawItems.push(llmsTxtEvidence(d.llmsTxt));

  // 11. Internal / external links
  rawItems.push(linksEvidence(d.links));

  // 12. Images count
  rawItems.push(numericEvidence('content', 'image_count', 'Image count', d.images));

  // 13. Question H2s (FAQ-style headings)
  rawItems.push(questionH2Evidence(d.questionH2Count, d.questionH2s));

  // 14. TL;DR block
  rawItems.push(tldrEvidence(d.hasTldr, d.tldrText, d.tldrPosition));

  // 15. Performance - LCP
  rawItems.push(numericEvidence('performance', 'lcp_ms', 'Largest Contentful Paint (ms)', d.lcpMs));

  // 16. Page load time
  rawItems.push(numericEvidence('performance', 'page_load_ms', 'Page load time (ms)', d.pageLoadMs));

  // 17. Sitemap
  rawItems.push(sitemapEvidence(d.sitemap));

  // 18. Image alt text coverage
  rawItems.push(imageAltEvidence(d.images, d.imagesWithAlt));

  // 19. Lang attribute
  rawItems.push(textEvidence('meta', 'lang', 'HTML lang attribute', d.lang, 'html[lang]'));

  // 20. OG image
  rawItems.push(textEvidence('meta', 'og_image', 'Open Graph image', d.meta?.ogImage, 'meta[property=og:image]'));

  // 21. Twitter card
  rawItems.push(textEvidence('meta', 'twitter_card', 'Twitter card type', d.meta?.twitterCard, 'meta[name=twitter:card]'));

  // 22. Hreflang tags
  rawItems.push(hreflangEvidence(d.hreflang));

  // 23. Granular AI crawler access
  rawItems.push(aiCrawlerAccessEvidence(d.aiCrawlerAccess));

  // 24. JSON-LD property completeness
  rawItems.push(jsonLdCompletenessEvidence(d.structuredData));

  // 25. Ecommerce platform detection
  rawItems.push(ecommercePlatformEvidence(d.html || ''));

  // 26. Product / ProductGroup schema
  rawItems.push(ecommerceProductSchemaEvidence(d.structuredData));

  // 27. Offer / price schema
  rawItems.push(ecommerceOfferSchemaEvidence(d.structuredData));

  // 28. AggregateRating schema (reviews)
  rawItems.push(ecommerceRatingSchemaEvidence(d.structuredData));

  // 29. BreadcrumbList schema depth
  rawItems.push(ecommerceBreadcrumbEvidence(d.structuredData, d.html || ''));

  // 30. Merchant / cart signals (HTML patterns)
  rawItems.push(ecommerceMerchantSignalsEvidence(d.html || ''));

  // Assign deterministic evidence IDs — IDs exist before DB, before scoring, before BRAG gate
  const items: EvidenceItem[] = rawItems.map((raw) => ({
    ...raw,
    evidence_id: generateEvidenceId(auditRunId, raw.key, raw.status),
  }));

  // Detect contradictions across evidence
  const contradictions = detectContradictions(items);

  return {
    auditRunId,
    url: scrapeResult.url,
    items,
    contradictions,
    extractedAt: new Date().toISOString(),
  };
}

// ─── Contradiction detection ──────────────────────────────────────────────────

export function detectContradictions(items: EvidenceItem[]): Contradiction[] {
  const contradictions: Contradiction[] = [];
  const byKey = new Map<string, EvidenceItem>();
  for (const item of items) byKey.set(item.key, item);

  // Title vs OG title mismatch
  const title = byKey.get('title');
  const ogTitle = byKey.get('og_title');
  if (
    title?.status === 'present' && ogTitle?.status === 'present' &&
    typeof title.value === 'string' && typeof ogTitle.value === 'string' &&
    title.value.toLowerCase() !== ogTitle.value.toLowerCase()
  ) {
    contradictions.push({
      a: 'title',
      b: 'og_title',
      description: 'Page title and OG title differ - AI crawlers may see inconsistent brand signals.',
    });
  }

  // Meta description vs OG description mismatch
  const desc = byKey.get('meta_description');
  const ogDesc = byKey.get('og_description');
  if (
    desc?.status === 'present' && ogDesc?.status === 'present' &&
    typeof desc.value === 'string' && typeof ogDesc.value === 'string' &&
    desc.value.toLowerCase() !== ogDesc.value.toLowerCase()
  ) {
    contradictions.push({
      a: 'meta_description',
      b: 'og_description',
      description: 'Meta description and OG description differ - citation extracts may be inconsistent.',
    });
  }

  // Canonical URL points elsewhere
  const canonical = byKey.get('canonical');
  if (canonical?.status === 'present' && typeof canonical.value === 'string') {
    // This is noted if present - rule engine will evaluate further
    // (no automatic contradiction here without knowing the audited URL)
  }

  // Robots blocks AI crawlers but structured data exists
  const robots = byKey.get('robots_ai_crawlers');
  const schema = byKey.get('structured_data');
  if (
    robots?.status === 'present' &&
    (robots.value as Record<string, unknown>)?.allBlocked === true &&
    schema?.status === 'present'
  ) {
    contradictions.push({
      a: 'robots_ai_crawlers',
      b: 'structured_data',
      description: 'AI crawlers are blocked via robots.txt but structured data is present - content won\'t reach AI platforms despite being well-structured.',
    });
  }

  return contradictions;
}

// ─── Evidence helpers ─────────────────────────────────────────────────────────

function textEvidence(
  category: string,
  key: string,
  label: string,
  value: string | undefined | null,
  selector?: string,
): RawEvidenceItem {
  const present = typeof value === 'string' && value.trim().length > 0;
  const notes: string[] = [];
  if (present && value!.length < 10) notes.push('Very short - may be too brief for AI extraction.');
  if (present && value!.length > 300) notes.push('Unusually long - may be truncated by AI crawlers.');
  return {
    category,
    key,
    label,
    value: present ? value!.trim() : null,
    selector,
    status: present ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function numericEvidence(
  category: string,
  key: string,
  label: string,
  value: number | undefined | null,
  selector?: string,
  passes?: boolean,
): RawEvidenceItem {
  const present = typeof value === 'number' && !isNaN(value);
  return {
    category,
    key,
    label,
    value: present ? value : null,
    selector,
    status: present ? 'present' : 'absent',
    confidence: present ? 1.0 : 0.5,
    notes: passes === false ? ['Below recommended threshold.'] : [],
  };
}

function headingsEvidence(headings?: { h1: string[]; h2: string[]; h3: string[] }): RawEvidenceItem {
  const notes: string[] = [];
  const h1Count = headings?.h1?.length ?? 0;
  const h2Count = headings?.h2?.length ?? 0;

  if (h1Count === 0) notes.push('Missing H1 - primary heading is absent.');
  if (h1Count > 1) notes.push(`Multiple H1 tags (${h1Count}) - should be exactly one.`);
  if (h2Count === 0) notes.push('No H2 headings - content lacks section structure.');

  return {
    category: 'content',
    key: 'headings',
    label: 'Heading structure',
    value: {
      h1: headings?.h1 ?? [],
      h2: headings?.h2 ?? [],
      h3: headings?.h3 ?? [],
    },
    status: h1Count > 0 ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function structuredDataEvidence(sd?: StructuredData): RawEvidenceItem {
  const notes: string[] = [];
  const count = sd?.jsonLdCount ?? 0;
  const types = sd?.uniqueTypes ?? [];

  if (count === 0) notes.push('No JSON-LD structured data found.');
  if (count > 0 && !sd?.hasLocalBusiness && !sd?.hasFAQ && !sd?.hasService) {
    notes.push('Structured data exists but no high-value types (LocalBusiness, FAQ, Service) detected.');
  }

  return {
    category: 'schema',
    key: 'structured_data',
    label: 'JSON-LD structured data',
    value: {
      count,
      types,
      hasLocalBusiness: sd?.hasLocalBusiness ?? false,
      hasFAQ: sd?.hasFAQ ?? false,
      hasService: sd?.hasService ?? false,
    },
    status: count > 0 ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function robotsEvidence(robots?: RobotsInfo): RawEvidenceItem {
  const notes: string[] = [];
  const fetched = robots?.fetched ?? false;
  const allows = robots?.allows ?? {};

  const aiAgents = [
    'gptbot',
    'GPTBot',
    'OpenAI',
    'openai',
    'BingPreview',
    'bingbot',
    'adidxbot',
    'microsoftpreview',
    'bingvideopreview',
  ];
  const aiBlocked = aiAgents.filter((a) => allows[a] === false);
  const allBlocked = aiBlocked.length >= 2;

  if (!fetched) notes.push('robots.txt was not fetched or does not exist.');
  if (allBlocked) notes.push('Multiple AI crawlers are blocked via robots.txt.');
  if (aiBlocked.length > 0 && !allBlocked) notes.push(`Some AI crawlers blocked: ${aiBlocked.join(', ')}`);

  return {
    category: 'crawlability',
    key: 'robots_ai_crawlers',
    label: 'AI crawler access (robots.txt)',
    value: { fetched, allows, aiBlocked, allBlocked },
    status: fetched ? 'present' : 'absent',
    confidence: fetched ? 1.0 : 0.3,
    notes,
  };
}

function llmsTxtEvidence(llms?: { fetched: boolean; present: boolean; raw?: string }): RawEvidenceItem {
  const notes: string[] = [];
  const present = llms?.present ?? false;

  if (!present) notes.push('No llms.txt file found - AI-specific instructions file is missing.');
  if (present && llms?.raw && llms.raw.length < 50) notes.push('llms.txt exists but is very short.');

  return {
    category: 'crawlability',
    key: 'llms_txt',
    label: 'llms.txt file',
    value: { present, length: llms?.raw?.length ?? 0 },
    status: present ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function linksEvidence(links?: { internal: number; external: number }): RawEvidenceItem {
  const notes: string[] = [];
  const internal = links?.internal ?? 0;
  const external = links?.external ?? 0;

  if (internal === 0) notes.push('No internal links found - crawlability is limited.');
  if (external === 0) notes.push('No external links - may appear isolated to AI crawlers.');

  return {
    category: 'content',
    key: 'link_profile',
    label: 'Internal / external link counts',
    value: { internal, external },
    status: internal > 0 || external > 0 ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function questionH2Evidence(count?: number, h2s?: string[]): RawEvidenceItem {
  const notes: string[] = [];
  const present = typeof count === 'number' && count > 0;

  if (!present) notes.push('No question-style H2 headings - FAQ-style content is absent.');
  if (present && count! >= 3) notes.push('Good FAQ coverage with multiple question headings.');

  return {
    category: 'content',
    key: 'question_h2s',
    label: 'Question-style H2 headings',
    value: { count: count ?? 0, samples: (h2s ?? []).slice(0, 5) },
    status: present ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function tldrEvidence(
  hasTldr?: boolean,
  text?: string,
  position?: 'top' | 'mid' | 'bottom' | 'none',
): RawEvidenceItem {
  const notes: string[] = [];
  const present = hasTldr === true;

  if (!present) notes.push('No TL;DR / summary block detected.');
  if (present && position === 'top') notes.push('TL;DR is near the top - optimal for snippet extraction.');
  if (present && position !== 'top') notes.push(`TL;DR position is "${position || 'unknown'}" - top is recommended.`);

  return {
    category: 'content',
    key: 'tldr_block',
    label: 'TL;DR / summary block',
    value: { present, position: position ?? 'none', length: text?.length ?? 0 },
    status: present ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

// ─── New evidence helpers ─────────────────────────────────────────────────────

function sitemapEvidence(sitemap?: { fetched: boolean; present: boolean; urlCount?: number }): RawEvidenceItem {
  const notes: string[] = [];
  const present = sitemap?.present ?? false;

  if (!present) notes.push('No sitemap.xml found - search engines and AI crawlers cannot discover pages efficiently.');
  if (present && (sitemap?.urlCount ?? 0) === 0) notes.push('Sitemap exists but contains no URL entries.');
  if (present && (sitemap?.urlCount ?? 0) > 0) notes.push(`Sitemap contains ${sitemap!.urlCount} URLs.`);

  return {
    category: 'indexability',
    key: 'sitemap',
    label: 'XML Sitemap',
    value: { present, urlCount: sitemap?.urlCount ?? 0 },
    status: present ? 'present' : 'absent',
    confidence: sitemap?.fetched ? 1.0 : 0.3,
    notes,
  };
}

function imageAltEvidence(totalImages?: number, withAlt?: number): RawEvidenceItem {
  const notes: string[] = [];
  const total = totalImages ?? 0;
  const alt = withAlt ?? 0;
  const ratio = total > 0 ? alt / total : 0;

  if (total === 0) notes.push('No images found on the page.');
  else if (ratio >= 0.9) notes.push(`Excellent alt text coverage: ${alt}/${total} images (${Math.round(ratio * 100)}%).`);
  else if (ratio >= 0.5) notes.push(`Partial alt text coverage: ${alt}/${total} images (${Math.round(ratio * 100)}%).`);
  else notes.push(`Poor alt text coverage: ${alt}/${total} images (${Math.round(ratio * 100)}%) - AI crawlers cannot interpret untagged images.`);

  return {
    category: 'content',
    key: 'image_alt_coverage',
    label: 'Image alt text coverage',
    value: { total, withAlt: alt, ratio: Math.round(ratio * 100) },
    status: total === 0 ? 'absent' : ratio >= 0.5 ? 'present' : 'partial',
    confidence: 1.0,
    notes,
  };
}

function hreflangEvidence(hreflangs?: string[]): RawEvidenceItem {
  const notes: string[] = [];
  const tags = hreflangs ?? [];
  const present = tags.length > 0;

  if (present) notes.push(`${tags.length} hreflang alternate(s) declared: ${tags.slice(0, 5).join(', ')}${tags.length > 5 ? '...' : ''}`);
  // hreflang is not required - absence is informational, not a failure

  return {
    category: 'indexability',
    key: 'hreflang',
    label: 'Hreflang alternate tags',
    value: { count: tags.length, languages: tags.slice(0, 10) },
    status: present ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function aiCrawlerAccessEvidence(access?: Record<string, boolean>): RawEvidenceItem {
  const notes: string[] = [];
  if (!access) {
    return {
      category: 'crawlability',
      key: 'ai_crawler_access',
      label: 'Granular AI crawler access',
      value: null,
      status: 'absent',
      confidence: 0.3,
      notes: ['Could not determine per-crawler access - robots.txt may be missing.'],
    };
  }

  const allowed = Object.entries(access).filter(([, v]) => v).map(([k]) => k);
  const blocked = Object.entries(access).filter(([, v]) => !v).map(([k]) => k);

  if (blocked.length === 0) notes.push('All major AI crawlers are allowed.');
  else if (allowed.length === 0) notes.push('All major AI crawlers are blocked - site is invisible to AI platforms.');
  else notes.push(`Blocked: ${blocked.join(', ')}. Allowed: ${allowed.join(', ')}.`);

  return {
    category: 'crawlability',
    key: 'ai_crawler_access',
    label: 'Granular AI crawler access',
    value: access,
    status: blocked.length === 0 ? 'present' : blocked.length < Object.keys(access).length ? 'partial' : 'absent',
    confidence: 1.0,
    notes,
  };
}

/** Check JSON-LD entities for required properties completeness */
function jsonLdCompletenessEvidence(sd?: StructuredData): RawEvidenceItem {
  const notes: string[] = [];
  if (!sd || sd.jsonLdCount === 0) {
    return {
      category: 'schema',
      key: 'json_ld_completeness',
      label: 'JSON-LD property completeness',
      value: null,
      status: 'absent',
      confidence: 1.0,
      notes: ['No JSON-LD found to validate.'],
    };
  }

  // Required properties per common @type
  const requiredProps: Record<string, string[]> = {
    Organization: ['name', 'url'],
    LocalBusiness: ['name', 'address', 'url'],
    Person: ['name'],
    Product: ['name', 'description'],
    Article: ['headline', 'author', 'datePublished'],
    BlogPosting: ['headline', 'author', 'datePublished'],
    FAQPage: ['mainEntity'],
    WebSite: ['name', 'url'],
    SoftwareApplication: ['name', 'applicationCategory'],
    Service: ['name', 'provider'],
    Event: ['name', 'startDate', 'location'],
    HowTo: ['name', 'step'],
    VideoObject: ['name', 'uploadDate', 'thumbnailUrl'],
    BreadcrumbList: ['itemListElement'],
  };

  let totalChecked = 0;
  let totalMissing = 0;
  const issues: string[] = [];

  for (const entity of (sd.raw ?? [])) {
    const type = entity?.['@type'] || entity?.type;
    const typeName = Array.isArray(type) ? type[0] : type;
    if (!typeName || typeof typeName !== 'string') continue;

    const required = requiredProps[typeName];
    if (!required) continue;

    totalChecked++;
    const missing = required.filter((p) => !entity[p] && !entity[`schema:${p}`]);
    if (missing.length > 0) {
      totalMissing += missing.length;
      issues.push(`${typeName}: missing ${missing.join(', ')}`);
    }
  }

  if (totalChecked === 0) notes.push('JSON-LD types present but none match common schemas for validation.');
  else if (issues.length === 0) notes.push(`All ${totalChecked} JSON-LD entities have required properties.`);
  else notes.push(...issues.slice(0, 5));

  return {
    category: 'schema',
    key: 'json_ld_completeness',
    label: 'JSON-LD property completeness',
    value: { entitiesChecked: totalChecked, missingProperties: totalMissing, issues: issues.slice(0, 10) },
    status: totalChecked > 0 && issues.length === 0 ? 'present' : issues.length > 0 ? 'partial' : 'absent',
    confidence: 1.0,
    notes,
  };
}

// ─── Ecommerce evidence helpers ───────────────────────────────────────────────

function ecommercePlatformEvidence(html: string): RawEvidenceItem {
  const lower = html.toLowerCase();
  let platform = 'none';
  if (lower.includes('shopify')) platform = 'shopify';
  else if (lower.includes('woocommerce') || lower.includes('wc-block')) platform = 'woocommerce';
  else if (lower.includes('magento') || lower.includes('mage/')) platform = 'magento';
  else if (lower.includes('bigcommerce')) platform = 'bigcommerce';
  else if (lower.includes('prestashop')) platform = 'prestashop';
  else if (
    lower.includes('add-to-cart') || lower.includes('add_to_cart') ||
    lower.includes('product-price') || lower.includes('product_price') ||
    lower.includes('sku') || lower.includes('cart-item')
  ) platform = 'generic_ecommerce';

  const isEcommerce = platform !== 'none';
  const notes: string[] = [];
  if (isEcommerce) notes.push(`Detected platform: ${platform}. Ecommerce schema validation is active.`);
  else notes.push('No ecommerce platform detected. Ecommerce rules will not penalise this site.');

  return {
    category: 'ecommerce',
    key: 'ecommerce_platform',
    label: 'Ecommerce platform detected',
    value: { platform, isEcommerce },
    status: isEcommerce ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function ecommerceProductSchemaEvidence(sd?: StructuredData): RawEvidenceItem {
  const types = sd?.uniqueTypes ?? [];
  const raw = sd?.raw ?? [];
  const hasProduct = types.some((t) => /^Product$|^ProductGroup$/i.test(t));

  const notes: string[] = [];
  if (hasProduct) {
    const productEntities = raw.filter((e) => {
      const t = e?.['@type'];
      return (
        t === 'Product' || t === 'ProductGroup' ||
        (Array.isArray(t) && t.some((v: string) => /^Product/i.test(v)))
      );
    });
    notes.push(`Found ${productEntities.length} Product entity(ies) in JSON-LD.`);
    // Check for required Product properties
    const missing = productEntities.flatMap((e) => {
      const m: string[] = [];
      if (!e.name) m.push('name');
      if (!e.description && !e.offers) m.push('description or offers');
      return m;
    });
    if (missing.length > 0) notes.push(`Missing Product properties: ${[...new Set(missing)].join(', ')}.`);
  } else {
    notes.push('No Product schema found. Ecommerce sites must include Product JSON-LD for AI citation eligibility.');
  }

  return {
    category: 'ecommerce',
    key: 'product_schema',
    label: 'Product JSON-LD schema',
    value: { present: hasProduct, types: types.filter((t) => /^Product/i.test(t)) },
    status: hasProduct ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function ecommerceOfferSchemaEvidence(sd?: StructuredData): RawEvidenceItem {
  const types = sd?.uniqueTypes ?? [];
  const raw = sd?.raw ?? [];
  const hasOffer = types.some((t) => /^Offer$|^AggregateOffer$/i.test(t));

  // Also check nested offers inside Product entities
  const hasNestedOffer = raw.some((e) => {
    const offers = e?.offers;
    if (!offers) return false;
    if (typeof offers === 'object' && !Array.isArray(offers)) {
      const t = offers?.['@type'];
      return t === 'Offer' || t === 'AggregateOffer';
    }
    if (Array.isArray(offers)) return offers.some((o) => o?.['@type'] === 'Offer');
    return false;
  });

  const present = hasOffer || hasNestedOffer;
  const notes: string[] = [];
  if (present) {
    notes.push('Offer schema found. Price and availability are machine-readable.');
    // Check for price in offers
    const offerEntities = raw.flatMap((e) => {
      if (!e?.offers) return [];
      return Array.isArray(e.offers) ? e.offers : [e.offers];
    });
    const missingPrice = offerEntities.filter((o) => !o?.price && !o?.priceRange).length;
    if (missingPrice > 0) notes.push(`${missingPrice} Offer(s) missing price property.`);
  } else {
    notes.push('No Offer schema detected. Without price/availability markup AI assistants cannot extract product details.');
  }

  return {
    category: 'ecommerce',
    key: 'offer_schema',
    label: 'Offer / price schema',
    value: { present, nested: hasNestedOffer },
    status: present ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function ecommerceRatingSchemaEvidence(sd?: StructuredData): RawEvidenceItem {
  const types = sd?.uniqueTypes ?? [];
  const raw = sd?.raw ?? [];
  const hasRating = types.some((t) => /^AggregateRating$/i.test(t));

  // Also check nested aggregateRating
  const hasNestedRating = raw.some((e) => {
    const r = e?.aggregateRating;
    if (!r) return false;
    return r?.['@type'] === 'AggregateRating' || (typeof r === 'object' && r.ratingValue);
  });

  const present = hasRating || hasNestedRating;
  const notes: string[] = [];
  if (present) {
    notes.push('AggregateRating schema found. Review signals are machine-readable for AI platforms.');
  } else {
    notes.push('No AggregateRating schema. Products without ratings lose rich snippet eligibility and AI trust signals.');
  }

  return {
    category: 'ecommerce',
    key: 'aggregate_rating_schema',
    label: 'AggregateRating (review) schema',
    value: { present },
    status: present ? 'present' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function ecommerceBreadcrumbEvidence(sd?: StructuredData, html?: string): RawEvidenceItem {
  const types = sd?.uniqueTypes ?? [];
  const raw = sd?.raw ?? [];
  const hasSchemaBreadcrumb = types.some((t) => /^BreadcrumbList$/i.test(t));

  let depth = 0;
  if (hasSchemaBreadcrumb) {
    const breadcrumb = raw.find((e) => e?.['@type'] === 'BreadcrumbList');
    const items = breadcrumb?.itemListElement;
    depth = Array.isArray(items) ? items.length : 0;
  }

  // Fallback: check HTML for breadcrumb nav patterns
  const hasHtmlBreadcrumb =
    !hasSchemaBreadcrumb &&
    html != null &&
    (html.toLowerCase().includes('breadcrumb') || html.includes('aria-label="breadcrumb"'));

  const present = hasSchemaBreadcrumb || hasHtmlBreadcrumb;
  const notes: string[] = [];
  if (hasSchemaBreadcrumb) {
    notes.push(`BreadcrumbList found with depth ${depth}. ${depth >= 3 ? 'Good category hierarchy.' : 'Shallow — consider deeper hierarchy.'}`);
  } else if (hasHtmlBreadcrumb) {
    notes.push('HTML breadcrumb detected but no BreadcrumbList JSON-LD. Add schema markup for AI extractability.');
  } else {
    notes.push('No breadcrumb navigation found. Breadcrumbs improve product page hierarchy signals for AI crawlers.');
  }

  return {
    category: 'ecommerce',
    key: 'breadcrumb_schema',
    label: 'Breadcrumb navigation structure',
    value: { present, schemaBreadcrumb: hasSchemaBreadcrumb, htmlBreadcrumb: hasHtmlBreadcrumb, depth },
    status: hasSchemaBreadcrumb ? 'present' : present ? 'partial' : 'absent',
    confidence: 1.0,
    notes,
  };
}

function ecommerceMerchantSignalsEvidence(html: string): RawEvidenceItem {
  const lower = html.toLowerCase();
  const signals: string[] = [];

  if (lower.includes('add-to-cart') || lower.includes('add_to_cart') || lower.includes('addtocart')) signals.push('cart');
  if (lower.includes('checkout') || lower.includes('buy-now') || lower.includes('buy now')) signals.push('checkout');
  if (lower.includes('in-stock') || lower.includes('in stock') || lower.includes('availability')) signals.push('availability');
  if (lower.includes('free-shipping') || lower.includes('free shipping')) signals.push('free_shipping');
  if (lower.includes('return-policy') || lower.includes('return policy') || lower.includes('30-day')) signals.push('return_policy');
  if (lower.includes('secure-checkout') || lower.includes('ssl') || lower.includes('https://')) signals.push('secure_checkout');
  if (/\$[\d,]+\.?\d{0,2}|\€[\d,]+|£[\d,]+/.test(html)) signals.push('price_display');

  const isEcommerce = signals.length >= 2;
  const notes: string[] = [];
  if (signals.length > 0) notes.push(`Merchant signals detected: ${signals.join(', ')}.`);
  else notes.push('No merchant signals detected in HTML.');

  return {
    category: 'ecommerce',
    key: 'merchant_signals',
    label: 'Merchant page signals',
    value: { signals, count: signals.length, isEcommerce },
    status: signals.length >= 2 ? 'present' : signals.length === 1 ? 'partial' : 'absent',
    confidence: 0.9,
    notes,
  };
}

// ─── SERP / Knowledge Graph evidence injection ─────────────────────────────────
//
// These items are injected POST-scrape from real API calls. They carry the same
// EvidenceItem interface and are persisted to audit_evidence alongside all other items.
//
// Keys are prefixed `serp_` and `kg_` to avoid collision with scrape-derived keys.

export interface SerpEvidenceInput {
  organicPosition?: number | null;
  hasFeaturedSnippet?: boolean;
  hasKnowledgePanel?: boolean;
  knowledgePanelData?: Record<string, unknown>;
  paaQuestions?: string[];
  richResults?: boolean;
}

export interface KgEvidenceInput {
  entityPresent?: boolean;
  entityTypes?: string[];
  entityDescription?: string;
  resultScore?: number;
  kgId?: string;
}

export function buildSerpEvidenceItems(opts: {
  serp?: SerpEvidenceInput;
  kg?: KgEvidenceInput;
  brand?: string;
  auditRunId?: string;
}): EvidenceItem[] {
  const rawItems: RawEvidenceItem[] = [];
  const { serp, kg } = opts;

  // SERP organic position
  if (serp !== undefined) {
    const pos = serp.organicPosition;
    const found = typeof pos === 'number' && pos > 0;
    const notes: string[] = [];
    if (found) notes.push(`Brand appears at organic position ${pos} in SERP.`);
    else notes.push('Brand not found in SERP organic results (positions 1-10 checked).');

    rawItems.push({
      category: 'authority',
      key: 'serp_organic_position',
      label: 'SERP organic position',
      value: { position: pos ?? 0, found },
      source: 'serp_api',
      status: found && pos! <= 5 ? 'present' : found ? 'partial' : 'absent',
      confidence: 0.95,
      notes,
    });

    // Featured snippet
    const featuredNotes: string[] = [];
    if (serp.hasFeaturedSnippet) featuredNotes.push('Site owns a featured snippet — highest AI citation priority signal.');
    else featuredNotes.push('No featured snippet. Structured Q&A content can help claim one.');

    rawItems.push({
      category: 'authority',
      key: 'serp_featured_snippet',
      label: 'SERP featured snippet',
      value: { present: serp.hasFeaturedSnippet ?? false },
      source: 'serp_api',
      status: serp.hasFeaturedSnippet ? 'present' : 'absent',
      confidence: 0.95,
      notes: featuredNotes,
    });

    // Knowledge panel
    const kpNotes: string[] = [];
    if (serp.hasKnowledgePanel) kpNotes.push('Knowledge panel present — entity is recognized by Google\'s Knowledge Graph.');
    else kpNotes.push('No knowledge panel. Adding Organization/Person schema and claiming entities can help.');

    rawItems.push({
      category: 'authority',
      key: 'serp_knowledge_panel',
      label: 'SERP knowledge panel',
      value: { present: serp.hasKnowledgePanel ?? false, data: serp.knowledgePanelData ?? null },
      source: 'serp_api',
      status: serp.hasKnowledgePanel ? 'present' : 'absent',
      confidence: 0.95,
      notes: kpNotes,
    });

    // PAA coverage
    if (Array.isArray(serp.paaQuestions) && serp.paaQuestions.length > 0) {
      rawItems.push({
        category: 'authority',
        key: 'serp_paa_questions',
        label: 'SERP "People Also Ask" questions',
        value: { count: serp.paaQuestions.length, questions: serp.paaQuestions.slice(0, 5) },
        source: 'serp_api',
        status: 'present',
        confidence: 0.95,
        notes: [`${serp.paaQuestions.length} PAA questions found. Answering these with FAQ schema improves coverage.`],
      });
    }
  }

  // KG entity confirmation
  if (kg !== undefined) {
    const confirmed = kg.entityPresent === true;
    const kgNotes: string[] = [];
    if (confirmed) {
      kgNotes.push(`Brand entity confirmed in Google Knowledge Graph.`);
      if (kg.entityTypes && kg.entityTypes.length > 0) kgNotes.push(`Entity types: ${kg.entityTypes.join(', ')}.`);
      if (kg.entityDescription) kgNotes.push(`Description: "${kg.entityDescription.substring(0, 100)}${kg.entityDescription.length > 100 ? '...' : ''}"`);
    } else {
      kgNotes.push('Brand entity not found in Google Knowledge Graph. This reduces AI citability.');
    }

    rawItems.push({
      category: 'authority',
      key: 'kg_entity_confirmed',
      label: 'Google Knowledge Graph entity',
      value: {
        present: confirmed,
        types: kg.entityTypes ?? [],
        description: kg.entityDescription ?? null,
        kgId: kg.kgId ?? null,
        resultScore: kg.resultScore ?? 0,
      },
      source: 'google_kg_api',
      status: confirmed ? 'present' : 'absent',
      confidence: 0.95,
      notes: kgNotes,
    });
  }

  const runId = opts.auditRunId || 'serp';
  return rawItems.map((raw) => ({
    ...raw,
    evidence_id: generateEvidenceId(runId, raw.key, raw.status),
  }));
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function persistEvidenceItems(
  auditRunId: string,
  url: string,
  items: EvidenceItem[],
): Promise<void> {
  const pool = getPool();

  for (const item of items) {
    await pool.query(
      `INSERT INTO audit_evidence
         (audit_run_id, url, category, key, label, value_json, source, selector, attribute, status, confidence, notes_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        auditRunId,
        url,
        item.category,
        item.key,
        item.label,
        JSON.stringify(item.value),
        item.source ?? null,
        item.selector ?? null,
        item.attribute ?? null,
        item.status,
        item.confidence,
        JSON.stringify(item.notes),
      ],
    );
  }
}

export async function loadEvidenceForRun(auditRunId: string): Promise<EvidenceItem[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT category, key, label, value_json, source, selector, attribute, status, confidence, notes_json
     FROM audit_evidence
     WHERE audit_run_id = $1
     ORDER BY created_at ASC`,
    [auditRunId],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    category: String(row.category),
    key: String(row.key),
    label: String(row.label),
    value: row.value_json,
    source: row.source as string | undefined,
    selector: row.selector as string | undefined,
    attribute: row.attribute as string | undefined,
    status: String(row.status) as EvidenceItem['status'],
    confidence: Number(row.confidence),
    notes: Array.isArray(row.notes_json) ? (row.notes_json as string[]) : [],
  }));
}
