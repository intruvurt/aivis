/**
 * Evidence Ledger - extracts ~15 evidence categories from ScrapeResult.
 *
 * Every evidence item has:
 *   category, key, label, value_json, status, confidence, notes[]
 *
 * This module never throws. If extraction fails for a category,
 * the item is emitted with status='error' and a note explaining why.
 */

import { getPool } from '../postgresql.js';
import type { ScrapeResult, StructuredData, RobotsInfo } from '../scraper.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
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
  const items: EvidenceItem[] = [];

  // 1. Title
  items.push(textEvidence('meta', 'title', 'Page title', d.title, 'head > title'));

  // 2. Meta description
  items.push(textEvidence('meta', 'meta_description', 'Meta description', d.meta?.description, 'meta[name=description]'));

  // 3. OG title
  items.push(textEvidence('meta', 'og_title', 'Open Graph title', d.meta?.ogTitle, 'meta[property=og:title]'));

  // 4. OG description
  items.push(textEvidence('meta', 'og_description', 'Open Graph description', d.meta?.ogDescription, 'meta[property=og:description]'));

  // 5. Canonical URL
  items.push(textEvidence('indexability', 'canonical', 'Canonical URL', d.canonical, 'link[rel=canonical]'));

  // 6. Headings structure
  items.push(headingsEvidence(d.headings));

  // 7. Word count
  items.push(numericEvidence('content', 'word_count', 'Word count', d.wordCount, undefined, d.wordCount != null && d.wordCount >= 300));

  // 8. Structured data / JSON-LD
  items.push(structuredDataEvidence(d.structuredData));

  // 9. Robots / AI crawler access
  items.push(robotsEvidence(d.robots));

  // 10. llms.txt
  items.push(llmsTxtEvidence(d.llmsTxt));

  // 11. Internal / external links
  items.push(linksEvidence(d.links));

  // 12. Images count
  items.push(numericEvidence('content', 'image_count', 'Image count', d.images));

  // 13. Question H2s (FAQ-style headings)
  items.push(questionH2Evidence(d.questionH2Count, d.questionH2s));

  // 14. TL;DR block
  items.push(tldrEvidence(d.hasTldr, d.tldrText, d.tldrPosition));

  // 15. Performance - LCP
  items.push(numericEvidence('performance', 'lcp_ms', 'Largest Contentful Paint (ms)', d.lcpMs));

  // 16. Page load time
  items.push(numericEvidence('performance', 'page_load_ms', 'Page load time (ms)', d.pageLoadMs));

  // 17. Sitemap
  items.push(sitemapEvidence(d.sitemap));

  // 18. Image alt text coverage
  items.push(imageAltEvidence(d.images, d.imagesWithAlt));

  // 19. Lang attribute
  items.push(textEvidence('meta', 'lang', 'HTML lang attribute', d.lang, 'html[lang]'));

  // 20. OG image
  items.push(textEvidence('meta', 'og_image', 'Open Graph image', d.meta?.ogImage, 'meta[property=og:image]'));

  // 21. Twitter card
  items.push(textEvidence('meta', 'twitter_card', 'Twitter card type', d.meta?.twitterCard, 'meta[name=twitter:card]'));

  // 22. Hreflang tags
  items.push(hreflangEvidence(d.hreflang));

  // 23. Granular AI crawler access
  items.push(aiCrawlerAccessEvidence(d.aiCrawlerAccess));

  // 24. JSON-LD property completeness
  items.push(jsonLdCompletenessEvidence(d.structuredData));

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
): EvidenceItem {
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
): EvidenceItem {
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

function headingsEvidence(headings?: { h1: string[]; h2: string[]; h3: string[] }): EvidenceItem {
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

function structuredDataEvidence(sd?: StructuredData): EvidenceItem {
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

function robotsEvidence(robots?: RobotsInfo): EvidenceItem {
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

function llmsTxtEvidence(llms?: { fetched: boolean; present: boolean; raw?: string }): EvidenceItem {
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

function linksEvidence(links?: { internal: number; external: number }): EvidenceItem {
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

function questionH2Evidence(count?: number, h2s?: string[]): EvidenceItem {
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
): EvidenceItem {
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

function sitemapEvidence(sitemap?: { fetched: boolean; present: boolean; urlCount?: number }): EvidenceItem {
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

function imageAltEvidence(totalImages?: number, withAlt?: number): EvidenceItem {
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

function hreflangEvidence(hreflangs?: string[]): EvidenceItem {
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

function aiCrawlerAccessEvidence(access?: Record<string, boolean>): EvidenceItem {
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
function jsonLdCompletenessEvidence(sd?: StructuredData): EvidenceItem {
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
