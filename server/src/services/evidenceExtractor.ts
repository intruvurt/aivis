/**
 * evidenceExtractor.ts - Extracts structured SSFR evidence items from
 * scraper output + AI analysis result.
 *
 * Maps raw crawl data to Source/Signal/Fact/Relationship evidence items
 * that feed the SSFR rule engine.
 */

import type { ScrapeResult } from './scraper.js';
import type { AnalysisResponse, SSFREvidenceItem, SSFRFamily, SSFREvidenceStatus } from '../../../shared/types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function ev(
  family: SSFRFamily,
  key: string,
  value: unknown,
  status: SSFREvidenceStatus,
  source = 'scraper',
  confidence = 1.0,
  notes?: unknown
): SSFREvidenceItem {
  return { family, evidence_key: key, value, source, status, confidence, notes };
}

function present(v: unknown): SSFREvidenceStatus {
  if (v === null || v === undefined || v === '') return 'missing';
  if (typeof v === 'string' && v.trim().length === 0) return 'missing';
  if (typeof v === 'number' && v === 0) return 'missing';
  if (Array.isArray(v) && v.length === 0) return 'missing';
  return 'present';
}

function titleQuality(title: string | undefined): SSFREvidenceStatus {
  if (!title || title.trim().length === 0) return 'missing';
  if (title.length < 20 || title.length > 70) return 'partial';
  return 'present';
}

function metaDescQuality(desc: string | undefined): SSFREvidenceStatus {
  if (!desc || desc.trim().length === 0) return 'missing';
  if (desc.length < 50 || desc.length > 160) return 'partial';
  return 'present';
}

// ─── Extraction ─────────────────────────────────────────────────────────────

export function extractEvidenceFromScrape(scrape: ScrapeResult): SSFREvidenceItem[] {
  const d = scrape.data;
  const items: SSFREvidenceItem[] = [];

  // ════════ SOURCE family ════════
  // Source: identity, authority, authorship, structural identity

  // Organization schema
  const hasOrgSchema = d.structuredData?.uniqueTypes?.some(
    (t: string) => t.toLowerCase().includes('organization') || t.toLowerCase().includes('localbusiness')
  ) ?? false;
  items.push(ev('source', 'organization_schema', hasOrgSchema, hasOrgSchema ? 'present' : 'missing'));

  // sameAs / social verification
  const ldJsonItems: any[] = d.structuredData?.raw || [];
  const sameAsLinks: string[] = [];
  for (const item of ldJsonItems) {
    if (item && typeof item === 'object') {
      const raw = item as Record<string, unknown>;
      if (Array.isArray(raw.sameAs)) sameAsLinks.push(...(raw.sameAs as string[]));
      else if (typeof raw.sameAs === 'string') sameAsLinks.push(raw.sameAs);
    }
  }
  items.push(ev('source', 'same_as_links', sameAsLinks, sameAsLinks.length > 0 ? 'present' : 'missing'));

  // Author entity in structured data
  const hasAuthor = ldJsonItems.some((item: any) => {
    if (!item || typeof item !== 'object') return false;
    const raw = item as Record<string, unknown>;
    return raw.author && typeof raw.author === 'object';
  });
  items.push(ev('source', 'author_entity', hasAuthor, hasAuthor ? 'present' : 'missing'));

  // Canonical URL
  items.push(ev('source', 'canonical_url', d.canonical || null, present(d.canonical)));

  // robots.txt
  const robotsFetched = d.robots?.fetched ?? false;
  items.push(ev('source', 'robots_txt', robotsFetched, robotsFetched ? 'present' : 'missing'));

  // AI crawler access
  const crawlerAccess = d.aiCrawlerAccess || {};
  const allAllowed = Object.values(crawlerAccess).every(v => v === true);
  const someBlocked = Object.values(crawlerAccess).some(v => v === false);
  items.push(ev('source', 'ai_crawler_access', crawlerAccess,
    Object.keys(crawlerAccess).length === 0 ? 'missing' : someBlocked ? 'partial' : 'present',
    'scraper', allAllowed ? 1.0 : 0.5
  ));

  // llms.txt
  const llmsPresent = d.llmsTxt?.present ?? false;
  items.push(ev('source', 'llms_txt', llmsPresent, llmsPresent ? 'present' : 'missing'));

  // ════════ SIGNAL family ════════
  // Signal: structural markers, schema consistency, meta coherence

  // Title tag
  items.push(ev('signal', 'title_tag', d.title, titleQuality(d.title)));

  // Meta description
  items.push(ev('signal', 'meta_description', d.meta?.description, metaDescQuality(d.meta?.description)));

  // OG tags
  const hasOgTitle = !!d.meta?.ogTitle;
  const hasOgDesc = !!d.meta?.ogDescription;
  const hasOgImage = !!d.meta?.ogImage;
  const ogComplete = hasOgTitle && hasOgDesc && hasOgImage;
  items.push(ev('signal', 'og_tags', { title: hasOgTitle, description: hasOgDesc, image: hasOgImage },
    ogComplete ? 'present' : (hasOgTitle || hasOgDesc) ? 'partial' : 'missing'
  ));

  // JSON-LD count
  const jsonLdCount = d.structuredData?.uniqueTypes?.length ?? 0;
  items.push(ev('signal', 'json_ld_schemas', d.structuredData?.uniqueTypes || [], jsonLdCount > 0 ? 'present' : 'missing'));

  // FAQ schema
  const hasFaq = d.structuredData?.uniqueTypes?.some((t: string) => t.toLowerCase().includes('faqpage')) ?? false;
  items.push(ev('signal', 'faq_schema', hasFaq, hasFaq ? 'present' : 'missing'));

  // H1 heading
  const h1s = d.headings?.h1 || [];
  items.push(ev('signal', 'h1_heading', h1s,
    h1s.length === 1 ? 'present' : h1s.length === 0 ? 'missing' : 'partial',
    'scraper', h1s.length === 1 ? 1.0 : 0.5,
    h1s.length > 1 ? { warning: 'Multiple H1 tags detected' } : undefined
  ));

  // Heading hierarchy
  const h2s = d.headings?.h2 || [];
  const h3s = d.headings?.h3 || [];
  items.push(ev('signal', 'heading_hierarchy', { h1: h1s.length, h2: h2s.length, h3: h3s.length },
    h1s.length >= 1 && h2s.length >= 2 ? 'present' : 'partial'
  ));

  // Sitemap
  const sitemapPresent = d.sitemap?.present ?? false;
  items.push(ev('signal', 'sitemap', d.sitemap, sitemapPresent ? 'present' : 'missing'));

  // Language tag
  items.push(ev('signal', 'lang_attribute', d.lang, present(d.lang)));

  // Twitter card
  items.push(ev('signal', 'twitter_card', d.meta?.twitterCard, present(d.meta?.twitterCard)));

  // ════════ FACT family ════════
  // Fact: content depth, information gain, factual indicators

  // Word count
  const wc = d.wordCount ?? 0;
  items.push(ev('fact', 'word_count', wc,
    wc >= 800 ? 'present' : wc >= 300 ? 'partial' : 'missing',
    'scraper', Math.min(wc / 800, 1.0)
  ));

  // Question headings
  const qh2 = d.questionH2Count ?? 0;
  items.push(ev('fact', 'question_headings', { count: qh2, items: d.questionH2s || [] },
    qh2 >= 3 ? 'present' : qh2 >= 1 ? 'partial' : 'missing'
  ));

  // TL;DR / summary block
  items.push(ev('fact', 'tldr_block', { present: d.hasTldr ?? false, position: d.tldrPosition, text: d.tldrText },
    d.hasTldr ? 'present' : 'missing'
  ));

  // Image count + alt text coverage
  const totalImages = d.images ?? 0;
  const withAlt = d.imagesWithAlt ?? 0;
  const altCoverage = totalImages > 0 ? withAlt / totalImages : 0;
  items.push(ev('fact', 'image_alt_coverage', { total: totalImages, with_alt: withAlt, coverage: altCoverage },
    altCoverage >= 0.9 ? 'present' : altCoverage >= 0.5 ? 'partial' : totalImages === 0 ? 'missing' : 'invalid'
  ));

  // Internal links
  const intLinks = d.links?.internal ?? 0;
  items.push(ev('fact', 'internal_links', intLinks,
    intLinks >= 3 ? 'present' : intLinks >= 1 ? 'partial' : 'missing'
  ));

  // External links
  const extLinks = d.links?.external ?? 0;
  items.push(ev('fact', 'external_links', extLinks,
    extLinks >= 2 ? 'present' : extLinks >= 1 ? 'partial' : 'missing'
  ));

  // ════════ RELATIONSHIP family ════════
  // Relationship: citation anchors, cross-referencing, proof claims

  // Hreflang (internationalization)
  const hreflang = d.hreflang || [];
  items.push(ev('relationship', 'hreflang', hreflang, hreflang.length > 0 ? 'present' : 'missing'));

  // Structured data depth (multiple schema types = relationship signals)
  const schemaTypes = d.structuredData?.uniqueTypes || [];
  items.push(ev('relationship', 'schema_depth', schemaTypes,
    schemaTypes.length >= 3 ? 'present' : schemaTypes.length >= 1 ? 'partial' : 'missing'
  ));

  // Link ratio (internal vs external balance)
  const totalLinks = intLinks + extLinks;
  const linkDiversity = totalLinks > 0 ? Math.min(intLinks, extLinks) / totalLinks : 0;
  items.push(ev('relationship', 'link_diversity', { internal: intLinks, external: extLinks, ratio: linkDiversity },
    linkDiversity >= 0.15 ? 'present' : linkDiversity > 0 ? 'partial' : 'missing'
  ));

  // LCP / performance
  const lcpMs = d.lcpMs ?? 0;
  const loadMs = d.pageLoadMs ?? 0;
  items.push(ev('relationship', 'performance', { lcp_ms: lcpMs, page_load_ms: loadMs },
    lcpMs > 0 && lcpMs < 2500 ? 'present' : lcpMs > 0 && lcpMs < 4000 ? 'partial' : lcpMs > 0 ? 'invalid' : 'missing',
    'scraper', lcpMs > 0 ? Math.max(0, 1.0 - (lcpMs - 1000) / 5000) : 0
  ));

  return items;
}

/**
 * Enrich evidence with AI analysis output - adds fact/relationship items
 * that can only be determined after the AI pipeline runs.
 */
export function enrichEvidenceFromAnalysis(
  existing: SSFREvidenceItem[],
  analysis: AnalysisResponse
): SSFREvidenceItem[] {
  const items = [...existing];

  // Recommendation evidence coverage (from AI pipeline)
  const evidenceSummary = analysis.recommendation_evidence_summary;
  if (evidenceSummary) {
    items.push(ev('fact', 'recommendation_evidence_coverage',
      { coverage_pct: evidenceSummary.evidence_coverage_percent, integrity_pct: evidenceSummary.evidence_ref_integrity_percent },
      evidenceSummary.evidence_coverage_percent >= 80 ? 'present' : evidenceSummary.evidence_coverage_percent >= 50 ? 'partial' : 'missing',
      'ai_pipeline', evidenceSummary.evidence_coverage_percent / 100
    ));
  }

  // GEO signal profile (if computed)
  const geo = analysis.geo_signal_profile;
  if (geo) {
    items.push(ev('source', 'geo_source_verified', geo.source_verified, geo.source_verified ? 'present' : 'missing', 'ai_pipeline'));
    items.push(ev('signal', 'geo_signal_consistent', geo.signal_consistent, geo.signal_consistent ? 'present' : 'missing', 'ai_pipeline'));
    items.push(ev('fact', 'geo_fact_unique', geo.fact_unique, geo.fact_unique ? 'present' : 'missing', 'ai_pipeline'));
    items.push(ev('relationship', 'geo_relationship_anchored', geo.relationship_anchored, geo.relationship_anchored ? 'present' : 'missing', 'ai_pipeline'));
    items.push(ev('fact', 'information_gain', geo.information_gain,
      geo.information_gain === 'unique' ? 'present' : geo.information_gain === 'standard' ? 'partial' : 'missing',
      'ai_pipeline'
    ));
  }

  // Contradiction report
  const contradictions = analysis.contradiction_report;
  if (contradictions) {
    items.push(ev('relationship', 'contradiction_status', contradictions.status,
      contradictions.status === 'clean' ? 'present' : contradictions.status === 'attention' ? 'partial' : 'invalid',
      'ai_pipeline', contradictions.status === 'clean' ? 1.0 : contradictions.blocker_count > 0 ? 0.2 : 0.5
    ));
  }

  // Category grades
  if (analysis.category_grades && analysis.category_grades.length > 0) {
    for (const grade of analysis.category_grades) {
      items.push(ev('fact', `category_grade_${grade.label.toLowerCase().replace(/\s+/g, '_')}`,
        { grade: grade.grade, score: grade.score },
        grade.score >= 70 ? 'present' : grade.score >= 40 ? 'partial' : 'invalid',
        'ai_pipeline', grade.score / 100
      ));
    }
  }

  return items;
}
