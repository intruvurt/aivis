/**
 * Rule Engine - 30 deterministic rules across 9 scoring families.
 *
 * Each rule inspects evidence items from the ledger and emits:
 *   passed, severity, score_impact, hard_blocker, evidence_ids, remediation_key
 *
 * Hard blockers cap the final score:
 *   • ≥ 1 blocker → cap 79
 *   • ≥ 3 blockers → cap 89 (before blockers, if somehow scored higher)
 *
 * Score version: 'v1'
 */

import { getPool } from '../postgresql.js';
import type { EvidenceItem } from './evidenceLedger.js';
import { normalizeTrackedUrl } from '../../utils/normalizeUrl.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuleFamily =
  | 'crawlability'
  | 'indexability'
  | 'renderability'
  | 'metadata'
  | 'schema'
  | 'entity'
  | 'content'
  | 'citation'
  | 'trust'
  | 'ecommerce'
  | 'authority';

export interface RuleResult {
  family: RuleFamily;
  ruleId: string;
  title: string;
  description: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  scoreImpact: number;
  hardBlocker: boolean;
  evidenceKeys: string[];
  remediationKey: string | null;
}

export interface ScoreBreakdown {
  crawlability: number;
  indexability: number;
  renderability: number;
  metadata: number;
  schema: number;
  entity: number;
  content: number;
  citation: number;
  trust: number;
  ecommerce: number;
  authority: number;
}

export interface ScoreSnapshot {
  familyScores: ScoreBreakdown;
  hardBlockerCount: number;
  scoreCap: number | null;
  finalScore: number;
  scoreVersion: string;
}

const SCORE_VERSION = 'v1';
const FAMILY_WEIGHT: Record<RuleFamily, number> = {
  crawlability: 10,
  indexability: 10,
  renderability: 10,
  metadata: 10,
  schema: 15,
  entity: 15,
  content: 10,
  citation: 10,
  trust: 10,
  // Ecommerce and authority families add bonus scoring but don't penalise
  // non-ecommerce / API-key-less audits — rules pass by default when signals absent.
  ecommerce: 0, // weight 0 = no false penalties; rules add +points when passing
  authority: 0, // weight 0 = no false penalties; rules add +points when passing
};

// ─── Rule definitions ─────────────────────────────────────────────────────────

interface RuleDef {
  id: string;
  family: RuleFamily;
  title: string;
  description: string;
  severity: RuleResult['severity'];
  hardBlocker: boolean;
  weight: number; // max points within family
  remediationKey: string | null;
  evaluate: (evidence: Map<string, EvidenceItem>) => { passed: boolean; keys: string[] };
}

function e(map: Map<string, EvidenceItem>, key: string): EvidenceItem | undefined {
  return map.get(key);
}

const RULES: RuleDef[] = [
  // ── Crawlability (10) ──
  {
    id: 'C01',
    family: 'crawlability',
    title: 'Robots.txt fetched',
    description: 'robots.txt must be accessible.',
    severity: 'high',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'fix_robots_txt',
    evaluate: (ev) => {
      const item = e(ev, 'robots_ai_crawlers');
      const val = item?.value as Record<string, unknown> | undefined;
      return { passed: val?.fetched === true, keys: ['robots_ai_crawlers'] };
    },
  },
  {
    id: 'C02',
    family: 'crawlability',
    title: 'AI crawlers not blocked',
    description: 'GPTBot and other AI agents must not be disallowed in robots.txt.',
    severity: 'critical',
    hardBlocker: true,
    weight: 4,
    remediationKey: 'unblock_ai_crawlers',
    evaluate: (ev) => {
      const item = e(ev, 'robots_ai_crawlers');
      const val = item?.value as Record<string, unknown> | undefined;
      return { passed: val?.allBlocked !== true, keys: ['robots_ai_crawlers'] };
    },
  },
  {
    id: 'C03',
    family: 'crawlability',
    title: 'llms.txt present',
    description: 'An llms.txt file should be provided for AI-specific instructions.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'create_llms_txt',
    evaluate: (ev) => {
      const item = e(ev, 'llms_txt');
      const val = item?.value as Record<string, unknown> | undefined;
      return { passed: val?.present === true, keys: ['llms_txt'] };
    },
  },

  // ── Indexability (10) ──
  {
    id: 'I01',
    family: 'indexability',
    title: 'Canonical URL set',
    description: 'A canonical URL must be defined.',
    severity: 'high',
    hardBlocker: false,
    weight: 4,
    remediationKey: 'add_canonical',
    evaluate: (ev) => {
      const item = e(ev, 'canonical');
      return { passed: item?.status === 'present', keys: ['canonical'] };
    },
  },
  {
    id: 'I02',
    family: 'indexability',
    title: 'Internal links present',
    description: 'Page must have internal links for crawl graph connectivity.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'add_internal_links',
    evaluate: (ev) => {
      const item = e(ev, 'link_profile');
      const val = item?.value as Record<string, number> | undefined;
      return { passed: (val?.internal ?? 0) > 0, keys: ['link_profile'] };
    },
  },
  {
    id: 'I03',
    family: 'indexability',
    title: 'External links present',
    description: 'At least one authoritative external link should exist.',
    severity: 'low',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'add_external_links',
    evaluate: (ev) => {
      const item = e(ev, 'link_profile');
      const val = item?.value as Record<string, number> | undefined;
      return { passed: (val?.external ?? 0) > 0, keys: ['link_profile'] };
    },
  },
  {
    id: 'I04',
    family: 'indexability',
    title: 'XML sitemap present',
    description: 'A sitemap.xml helps AI crawlers and search engines discover all pages.',
    severity: 'medium',
    hardBlocker: false,
    weight: 2,
    remediationKey: 'add_sitemap',
    evaluate: (ev) => {
      const item = e(ev, 'sitemap');
      const val = item?.value as Record<string, unknown> | undefined;
      return { passed: val?.present === true, keys: ['sitemap'] };
    },
  },

  // ── Renderability (10) ──
  {
    id: 'R01',
    family: 'renderability',
    title: 'Page loads within 3 seconds',
    description: 'Page load time should be under 3000ms for AI crawler timeouts.',
    severity: 'high',
    hardBlocker: false,
    weight: 4,
    remediationKey: 'optimize_page_speed',
    evaluate: (ev) => {
      const item = e(ev, 'page_load_ms');
      const val = typeof item?.value === 'number' ? item.value : null;
      if (val === null) return { passed: true, keys: ['page_load_ms'] }; // no data = pass by default
      return { passed: val < 3000, keys: ['page_load_ms'] };
    },
  },
  {
    id: 'R02',
    family: 'renderability',
    title: 'LCP under 2500ms',
    description: 'Largest Contentful Paint should be under 2500ms.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'optimize_lcp',
    evaluate: (ev) => {
      const item = e(ev, 'lcp_ms');
      const val = typeof item?.value === 'number' ? item.value : null;
      if (val === null) return { passed: true, keys: ['lcp_ms'] };
      return { passed: val < 2500, keys: ['lcp_ms'] };
    },
  },
  {
    id: 'R03',
    family: 'renderability',
    title: 'Images present',
    description: 'Page should contain images for rich snippet eligibility.',
    severity: 'low',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'add_images',
    evaluate: (ev) => {
      const item = e(ev, 'image_count');
      const val = typeof item?.value === 'number' ? item.value : 0;
      return { passed: val > 0, keys: ['image_count'] };
    },
  },
  {
    id: 'R04',
    family: 'renderability',
    title: 'Image alt text coverage ≥ 80%',
    description: 'At least 80% of images should have descriptive alt text for AI accessibility.',
    severity: 'medium',
    hardBlocker: false,
    weight: 2,
    remediationKey: 'add_image_alt_text',
    evaluate: (ev) => {
      const item = e(ev, 'image_alt_coverage');
      const val = item?.value as Record<string, number> | undefined;
      if (!val || val.total === 0) return { passed: true, keys: ['image_alt_coverage'] }; // no images = pass
      return { passed: (val.ratio ?? 0) >= 80, keys: ['image_alt_coverage'] };
    },
  },

  // ── Metadata (10) ──
  {
    id: 'M01',
    family: 'metadata',
    title: 'Title tag present',
    description: 'Page must have a non-empty title.',
    severity: 'critical',
    hardBlocker: true,
    weight: 3,
    remediationKey: 'add_title_tag',
    evaluate: (ev) => {
      const item = e(ev, 'title');
      return { passed: item?.status === 'present', keys: ['title'] };
    },
  },
  {
    id: 'M02',
    family: 'metadata',
    title: 'Meta description present',
    description: 'A meta description provides the primary snippet for AI citations.',
    severity: 'high',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'add_meta_description',
    evaluate: (ev) => {
      const item = e(ev, 'meta_description');
      return { passed: item?.status === 'present', keys: ['meta_description'] };
    },
  },
  {
    id: 'M03',
    family: 'metadata',
    title: 'OG title set',
    description: 'Open Graph title improves sharing + AI platform display.',
    severity: 'medium',
    hardBlocker: false,
    weight: 2,
    remediationKey: 'add_og_tags',
    evaluate: (ev) => {
      const item = e(ev, 'og_title');
      return { passed: item?.status === 'present', keys: ['og_title'] };
    },
  },
  {
    id: 'M04',
    family: 'metadata',
    title: 'OG description set',
    description: 'Open Graph description provides citation-friendly summary.',
    severity: 'medium',
    hardBlocker: false,
    weight: 2,
    remediationKey: 'add_og_tags',
    evaluate: (ev) => {
      const item = e(ev, 'og_description');
      return { passed: item?.status === 'present', keys: ['og_description'] };
    },
  },
  {
    id: 'M05',
    family: 'metadata',
    title: 'OG image set',
    description: 'An Open Graph image is essential for rich social and AI platform previews.',
    severity: 'medium',
    hardBlocker: false,
    weight: 2,
    remediationKey: 'add_og_image',
    evaluate: (ev) => {
      const item = e(ev, 'og_image');
      return { passed: item?.status === 'present', keys: ['og_image'] };
    },
  },
  {
    id: 'M06',
    family: 'metadata',
    title: 'HTML lang attribute set',
    description: 'The lang attribute helps AI crawlers identify content language for citation routing.',
    severity: 'low',
    hardBlocker: false,
    weight: 1,
    remediationKey: 'add_lang_attribute',
    evaluate: (ev) => {
      const item = e(ev, 'lang');
      return { passed: item?.status === 'present', keys: ['lang'] };
    },
  },

  // ── Schema (15) ──
  {
    id: 'S01',
    family: 'schema',
    title: 'JSON-LD structured data present',
    description: 'At least one JSON-LD block must exist.',
    severity: 'critical',
    hardBlocker: true,
    weight: 5,
    remediationKey: 'add_json_ld',
    evaluate: (ev) => {
      const item = e(ev, 'structured_data');
      const val = item?.value as Record<string, unknown> | undefined;
      return { passed: (val?.count as number ?? 0) > 0, keys: ['structured_data'] };
    },
  },
  {
    id: 'S02',
    family: 'schema',
    title: 'High-value schema type present',
    description: 'LocalBusiness, FAQ, or Service schema improves AI entity recognition.',
    severity: 'high',
    hardBlocker: false,
    weight: 5,
    remediationKey: 'add_high_value_schema',
    evaluate: (ev) => {
      const item = e(ev, 'structured_data');
      const val = item?.value as Record<string, unknown> | undefined;
      return {
        passed: val?.hasLocalBusiness === true || val?.hasFAQ === true || val?.hasService === true,
        keys: ['structured_data'],
      };
    },
  },
  {
    id: 'S03',
    family: 'schema',
    title: 'Multiple schema types',
    description: 'Having 2+ distinct schema types demonstrates rich entity coverage.',
    severity: 'medium',
    hardBlocker: false,
    weight: 5,
    remediationKey: 'diversify_schema',
    evaluate: (ev) => {
      const item = e(ev, 'structured_data');
      const val = item?.value as Record<string, unknown> | undefined;
      const types = val?.types as string[] | undefined;
      return { passed: (types?.length ?? 0) >= 2, keys: ['structured_data'] };
    },
  },
  {
    id: 'S04',
    family: 'schema',
    title: 'JSON-LD entities have required properties',
    description: 'JSON-LD entities must include required properties per their schema type (name, url, etc.).',
    severity: 'high',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'complete_json_ld_properties',
    evaluate: (ev) => {
      const item = e(ev, 'json_ld_completeness');
      if (!item || item.status === 'absent') return { passed: true, keys: ['json_ld_completeness'] }; // no data = pass
      const val = item.value as Record<string, unknown> | undefined;
      return { passed: (val?.missingProperties as number ?? 0) === 0, keys: ['json_ld_completeness'] };
    },
  },

  // ── Entity (15) ──
  {
    id: 'E01',
    family: 'entity',
    title: 'H1 heading present',
    description: 'Exactly one H1 tag is required for entity identification.',
    severity: 'critical',
    hardBlocker: true,
    weight: 5,
    remediationKey: 'fix_h1_tag',
    evaluate: (ev) => {
      const item = e(ev, 'headings');
      const val = item?.value as Record<string, string[]> | undefined;
      return { passed: (val?.h1?.length ?? 0) === 1, keys: ['headings'] };
    },
  },
  {
    id: 'E02',
    family: 'entity',
    title: 'H2 section structure',
    description: 'H2 headings provide semantic section markers for AI extraction.',
    severity: 'high',
    hardBlocker: false,
    weight: 5,
    remediationKey: 'add_h2_headings',
    evaluate: (ev) => {
      const item = e(ev, 'headings');
      const val = item?.value as Record<string, string[]> | undefined;
      return { passed: (val?.h2?.length ?? 0) >= 2, keys: ['headings'] };
    },
  },
  {
    id: 'E03',
    family: 'entity',
    title: 'Title and OG title consistent',
    description: 'Title tag and OG title should match for consistent entity signals.',
    severity: 'medium',
    hardBlocker: false,
    weight: 5,
    remediationKey: 'align_title_og',
    evaluate: (ev) => {
      const title = e(ev, 'title');
      const og = e(ev, 'og_title');
      if (title?.status !== 'present' || og?.status !== 'present') return { passed: true, keys: ['title', 'og_title'] };
      const t = String(title.value || '').toLowerCase().trim();
      const o = String(og.value || '').toLowerCase().trim();
      return { passed: t === o, keys: ['title', 'og_title'] };
    },
  },

  // ── Content (10) ──
  {
    id: 'CT01',
    family: 'content',
    title: 'Minimum word count (300+)',
    description: 'Content must have at least 300 words for meaningful AI extraction.',
    severity: 'high',
    hardBlocker: false,
    weight: 4,
    remediationKey: 'add_content',
    evaluate: (ev) => {
      const item = e(ev, 'word_count');
      const val = typeof item?.value === 'number' ? item.value : 0;
      return { passed: val >= 300, keys: ['word_count'] };
    },
  },
  {
    id: 'CT02',
    family: 'content',
    title: 'Question-style headings',
    description: 'FAQ-style H2 headings improve snippet eligibility.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'add_question_headings',
    evaluate: (ev) => {
      const item = e(ev, 'question_h2s');
      const val = item?.value as Record<string, unknown> | undefined;
      return { passed: (val?.count as number ?? 0) >= 1, keys: ['question_h2s'] };
    },
  },
  {
    id: 'CT03',
    family: 'content',
    title: 'TL;DR / summary block present',
    description: 'A summary block helps AI extract concise answers.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'add_tldr',
    evaluate: (ev) => {
      const item = e(ev, 'tldr_block');
      const val = item?.value as Record<string, unknown> | undefined;
      return { passed: val?.present === true, keys: ['tldr_block'] };
    },
  },

  // ── Citation (10) ──
  {
    id: 'CI01',
    family: 'citation',
    title: 'Meta description qualifies as citation snippet',
    description: 'Meta description must be 25-160 chars for search engines and AI citation extraction.',
    severity: 'high',
    hardBlocker: false,
    weight: 4,
    remediationKey: 'optimize_meta_description',
    evaluate: (ev) => {
      const item = e(ev, 'meta_description');
      if (item?.status !== 'present') return { passed: false, keys: ['meta_description'] };
      const len = String(item.value || '').length;
      return { passed: len >= 25 && len <= 160, keys: ['meta_description'] };
    },
  },
  {
    id: 'CI02',
    family: 'citation',
    title: 'Description and OG description consistent',
    description: 'Matching descriptions prevent citation confusion across platforms.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'align_descriptions',
    evaluate: (ev) => {
      const desc = e(ev, 'meta_description');
      const og = e(ev, 'og_description');
      if (desc?.status !== 'present' || og?.status !== 'present') return { passed: true, keys: ['meta_description', 'og_description'] };
      return { passed: String(desc.value || '').toLowerCase() === String(og.value || '').toLowerCase(), keys: ['meta_description', 'og_description'] };
    },
  },
  {
    id: 'CI03',
    family: 'citation',
    title: 'TL;DR positioned at top',
    description: 'Summary block should be at the top of content for snippet priority.',
    severity: 'low',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'move_tldr_top',
    evaluate: (ev) => {
      const item = e(ev, 'tldr_block');
      const val = item?.value as Record<string, unknown> | undefined;
      if (val?.present !== true) return { passed: false, keys: ['tldr_block'] };
      return { passed: val?.position === 'top', keys: ['tldr_block'] };
    },
  },

  // ── Trust (10) ──
  {
    id: 'T01',
    family: 'trust',
    title: 'Structured data type diversity',
    description: 'Multiple schema types signal entity trustworthiness.',
    severity: 'medium',
    hardBlocker: false,
    weight: 4,
    remediationKey: 'diversify_schema',
    evaluate: (ev) => {
      const item = e(ev, 'structured_data');
      const val = item?.value as Record<string, unknown> | undefined;
      const types = val?.types as string[] | undefined;
      return { passed: (types?.length ?? 0) >= 3, keys: ['structured_data'] };
    },
  },
  {
    id: 'T02',
    family: 'trust',
    title: 'Content depth (1000+ words)',
    description: 'Long-form content signals authority to AI platforms.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'expand_content',
    evaluate: (ev) => {
      const item = e(ev, 'word_count');
      const val = typeof item?.value === 'number' ? item.value : 0;
      return { passed: val >= 1000, keys: ['word_count'] };
    },
  },
  {
    id: 'T03',
    family: 'trust',
    title: 'No evidence contradictions',
    description: 'Zero contradictions in metadata indicates consistent entity presentation.',
    severity: 'high',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'resolve_contradictions',
    evaluate: () => {
      // This rule is evaluated specially - passed = no contradictions found
      // The pipeline will override this based on the contradiction count
      return { passed: true, keys: [] };
    },
  },

  // ── Ecommerce (0 base weight — only active when platform detected) ──
  {
    id: 'EC01',
    family: 'ecommerce',
    title: 'Product JSON-LD schema present',
    description: 'Ecommerce sites must include Product schema for AI citation eligibility.',
    severity: 'critical',
    hardBlocker: false,
    weight: 5,
    remediationKey: 'add_product_schema',
    evaluate: (ev) => {
      const platform = ev.get('ecommerce_platform');
      const val = platform?.value as Record<string, unknown> | undefined;
      if (!val?.isEcommerce) return { passed: true, keys: ['ecommerce_platform'] }; // not ecommerce = pass
      const product = ev.get('product_schema');
      const pVal = product?.value as Record<string, unknown> | undefined;
      return { passed: pVal?.present === true, keys: ['ecommerce_platform', 'product_schema'] };
    },
  },
  {
    id: 'EC02',
    family: 'ecommerce',
    title: 'Offer / price schema present',
    description: 'Price and availability markup is required for ecommerce AI citations.',
    severity: 'high',
    hardBlocker: false,
    weight: 4,
    remediationKey: 'add_offer_schema',
    evaluate: (ev) => {
      const platform = ev.get('ecommerce_platform');
      const val = platform?.value as Record<string, unknown> | undefined;
      if (!val?.isEcommerce) return { passed: true, keys: ['ecommerce_platform'] };
      const offer = ev.get('offer_schema');
      const oVal = offer?.value as Record<string, unknown> | undefined;
      return { passed: oVal?.present === true, keys: ['ecommerce_platform', 'offer_schema'] };
    },
  },
  {
    id: 'EC03',
    family: 'ecommerce',
    title: 'AggregateRating schema present',
    description: 'Review signals help AI platforms recommend and cite products with high trust.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'add_aggregate_rating_schema',
    evaluate: (ev) => {
      const platform = ev.get('ecommerce_platform');
      const val = platform?.value as Record<string, unknown> | undefined;
      if (!val?.isEcommerce) return { passed: true, keys: ['ecommerce_platform'] };
      const rating = ev.get('aggregate_rating_schema');
      const rVal = rating?.value as Record<string, unknown> | undefined;
      return { passed: rVal?.present === true, keys: ['ecommerce_platform', 'aggregate_rating_schema'] };
    },
  },
  {
    id: 'EC04',
    family: 'ecommerce',
    title: 'BreadcrumbList schema present',
    description: 'Breadcrumb schema clarifies product hierarchy for AI navigation and citation.',
    severity: 'medium',
    hardBlocker: false,
    weight: 3,
    remediationKey: 'add_breadcrumb_schema',
    evaluate: (ev) => {
      const platform = ev.get('ecommerce_platform');
      const val = platform?.value as Record<string, unknown> | undefined;
      if (!val?.isEcommerce) return { passed: true, keys: ['ecommerce_platform'] };
      const breadcrumb = ev.get('breadcrumb_schema');
      const bVal = breadcrumb?.value as Record<string, unknown> | undefined;
      return {
        passed: bVal?.schemaBreadcrumb === true,
        keys: ['ecommerce_platform', 'breadcrumb_schema'],
      };
    },
  },
  {
    id: 'EC05',
    family: 'ecommerce',
    title: 'Merchant trust signals present',
    description: 'Cart, checkout, availability and pricing signals confirm merchant legitimacy to AI.',
    severity: 'low',
    hardBlocker: false,
    weight: 2,
    remediationKey: 'add_merchant_signals',
    evaluate: (ev) => {
      const platform = ev.get('ecommerce_platform');
      const val = platform?.value as Record<string, unknown> | undefined;
      if (!val?.isEcommerce) return { passed: true, keys: ['ecommerce_platform'] };
      const merch = ev.get('merchant_signals');
      const mVal = merch?.value as Record<string, unknown> | undefined;
      return { passed: (mVal?.count as number ?? 0) >= 2, keys: ['ecommerce_platform', 'merchant_signals'] };
    },
  },

  // ── Authority — SERP / Knowledge Graph signals (0 base weight) ──
  // These rules contribute bonus notes and scoring only when SERP/KG keys
  // are configured. They pass by default when evidence is absent.
  {
    id: 'AU01',
    family: 'authority',
    title: 'Brand confirmed in Google Knowledge Graph',
    description: 'A Knowledge Graph entity record signals authoritative brand recognition to AI.',
    severity: 'medium',
    hardBlocker: false,
    weight: 5,
    remediationKey: 'build_kg_entity',
    evaluate: (ev) => {
      const item = ev.get('kg_entity_confirmed');
      if (!item || item.status === 'absent' && item.confidence < 0.9) {
        // No KG integration configured — pass silently
        return { passed: true, keys: [] };
      }
      const val = item.value as Record<string, unknown> | undefined;
      return { passed: val?.present === true, keys: ['kg_entity_confirmed'] };
    },
  },
  {
    id: 'AU02',
    family: 'authority',
    title: 'Appears in SERP top-10',
    description: 'Organic SERP presence is a strong co-citation signal for AI platforms.',
    severity: 'medium',
    hardBlocker: false,
    weight: 5,
    remediationKey: 'improve_seo_rankings',
    evaluate: (ev) => {
      const item = ev.get('serp_organic_position');
      if (!item || item.confidence < 0.9) return { passed: true, keys: [] }; // no SERP API = pass
      const val = item.value as Record<string, unknown> | undefined;
      return { passed: val?.found === true, keys: ['serp_organic_position'] };
    },
  },
  {
    id: 'AU03',
    family: 'authority',
    title: 'Featured snippet or knowledge panel present',
    description: 'Ownership of a snippet or knowledge panel is the highest AI visibility signal.',
    severity: 'high',
    hardBlocker: false,
    weight: 5,
    remediationKey: 'target_featured_snippet',
    evaluate: (ev) => {
      const snippet = ev.get('serp_featured_snippet');
      const kp = ev.get('serp_knowledge_panel');
      if (!snippet && !kp) return { passed: true, keys: [] }; // no SERP API = pass
      const hasSnippet = (snippet?.value as Record<string, unknown> | undefined)?.present === true;
      const hasKp = (kp?.value as Record<string, unknown> | undefined)?.present === true;
      return {
        passed: hasSnippet || hasKp,
        keys: ['serp_featured_snippet', 'serp_knowledge_panel'].filter((k) => ev.has(k)),
      };
    },
  },
];

// ─── Rule execution ───────────────────────────────────────────────────────────

export function evaluateRules(
  evidence: EvidenceItem[],
  contradictionCount: number,
): RuleResult[] {
  const evidenceMap = new Map<string, EvidenceItem>();
  for (const item of evidence) evidenceMap.set(item.key, item);

  const results: RuleResult[] = [];

  for (const rule of RULES) {
    const { passed, keys } = rule.evaluate(evidenceMap);

    // Special case: T03 overrides based on contradiction count
    const actualPassed = rule.id === 'T03' ? contradictionCount === 0 : passed;

    results.push({
      family: rule.family,
      ruleId: rule.id,
      title: rule.title,
      description: rule.description,
      passed: actualPassed,
      severity: rule.severity,
      scoreImpact: actualPassed ? 0 : -rule.weight,
      hardBlocker: rule.hardBlocker && !actualPassed,
      evidenceKeys: keys,
      remediationKey: actualPassed ? null : rule.remediationKey,
    });
  }

  return results;
}

// ─── Score computation ────────────────────────────────────────────────────────

export function computeScore(ruleResults: RuleResult[]): ScoreSnapshot {
  const familyScores: ScoreBreakdown = {
    crawlability: 0,
    indexability: 0,
    renderability: 0,
    metadata: 0,
    schema: 0,
    entity: 0,
    content: 0,
    citation: 0,
    trust: 0,
    ecommerce: 0,
    authority: 0,
  };

  // Compute per-family scores - start at max weight, subtract failures
  const families = Object.keys(FAMILY_WEIGHT) as RuleFamily[];
  for (const family of families) {
    const maxWeight = FAMILY_WEIGHT[family];
    const familyRules = ruleResults.filter((r) => r.family === family);
    const totalPenalty = familyRules.reduce((sum, r) => sum + (r.passed ? 0 : Math.abs(r.scoreImpact)), 0);
    familyScores[family] = Math.max(0, maxWeight - totalPenalty);
  }

  // Sum all families for raw score (out of 100)
  const rawScore = families.reduce((sum, f) => sum + familyScores[f], 0);

  // Apply hard blocker caps
  const hardBlockerCount = ruleResults.filter((r) => r.hardBlocker).length;
  let scoreCap: number | null = null;
  if (hardBlockerCount >= 3) {
    scoreCap = 59;
  } else if (hardBlockerCount >= 1) {
    scoreCap = 79;
  }

  const finalScore = scoreCap !== null ? Math.min(rawScore, scoreCap) : rawScore;

  return {
    familyScores,
    hardBlockerCount,
    scoreCap,
    finalScore: Math.round(finalScore * 100) / 100,
    scoreVersion: SCORE_VERSION,
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function persistRuleResults(
  auditRunId: string,
  results: RuleResult[],
): Promise<void> {
  const pool = getPool();

  for (const r of results) {
    await pool.query(
      `INSERT INTO audit_rule_results
         (audit_run_id, audit_id, family, rule_id, title, description, passed, severity, score_impact, hard_blocker, evidence_ids_json, remediation_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        auditRunId,
        auditRunId,
        r.family,
        r.ruleId,
        r.title,
        r.description,
        r.passed,
        r.severity,
        r.scoreImpact,
        r.hardBlocker,
        JSON.stringify(r.evidenceKeys),
        r.remediationKey,
      ],
    );
  }
}

export async function persistScoreSnapshot(
  auditRunId: string,
  userId: string,
  url: string,
  snapshot: ScoreSnapshot,
  frameworkDetected?: string,
): Promise<void> {
  const pool = getPool();
  const fs = snapshot.familyScores;
  const normalizedUrl = normalizeTrackedUrl(url);

  await pool.query(
    `INSERT INTO audit_score_snapshots
       (audit_id, user_id, url, normalized_url,
        visibility_score,
        crawlability_score, indexability_score, renderability_score,
        metadata_score, schema_score, entity_score,
        content_score, citation_score, trust_score,
        blocker_count, score_cap, final_score,
        score_version, framework_detected)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     ON CONFLICT (audit_id)
     DO UPDATE SET
       normalized_url = EXCLUDED.normalized_url,
       visibility_score = EXCLUDED.visibility_score,
       crawlability_score = EXCLUDED.crawlability_score,
       indexability_score = EXCLUDED.indexability_score,
       renderability_score = EXCLUDED.renderability_score,
       metadata_score = EXCLUDED.metadata_score,
       schema_score = EXCLUDED.schema_score,
       entity_score = EXCLUDED.entity_score,
       content_score = EXCLUDED.content_score,
       citation_score = EXCLUDED.citation_score,
       trust_score = EXCLUDED.trust_score,
       blocker_count = EXCLUDED.blocker_count,
       score_cap = EXCLUDED.score_cap,
       final_score = EXCLUDED.final_score,
       score_version = EXCLUDED.score_version,
       framework_detected = EXCLUDED.framework_detected`,
    [
      auditRunId, userId, url, normalizedUrl,
      snapshot.finalScore,
      fs.crawlability, fs.indexability, fs.renderability,
      fs.metadata, fs.schema, fs.entity,
      fs.content, fs.citation, fs.trust,
      snapshot.hardBlockerCount, snapshot.scoreCap, snapshot.finalScore,
      snapshot.scoreVersion, frameworkDetected ?? null,
    ],
  );
}
