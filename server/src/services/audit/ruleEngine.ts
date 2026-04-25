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
  evidenceKeys: string[]; // Original key names for lookups and validation
  evidenceIds: string[]; // EV-hash IDs for database traceability
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
  avs: AVSScoreSummary;
}

export type AVSPillarKey = 'crawlability' | 'comprehension' | 'authority' | 'freshness';

export interface AVSPillarScore {
  key: AVSPillarKey;
  label: string;
  weightPercent: number;
  maxPoints: number;
  score: number;
  normalizedScore: number;
  signalCount: number;
  evidenceIds: string[];
  summary: string;
  confidence: number;
}

export interface AVSReason {
  pillar: AVSPillarKey;
  issue: string;
  impact: number;
  evidenceIds: string[];
  rationale: string;
}

export interface AVSConfidenceSummary {
  score: number;
  label: 'high' | 'medium' | 'low';
  components: {
    dataCompleteness: number;
    crawlDepth: number;
    evidenceAgreement: number;
  };
  basis: string;
}

export interface AVSScoreSummary {
  name: 'AI Visibility Score';
  methodology: string;
  pillars: Record<AVSPillarKey, AVSPillarScore>;
  reasons: AVSReason[];
  confidence: AVSConfidenceSummary;
}

const SCORE_VERSION = 'avs-v2';
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

const AVS_PILLAR_CONFIG: Readonly<Record<AVSPillarKey, {
  label: string;
  maxPoints: number;
  families: RuleFamily[];
}>> = {
  crawlability: {
    label: 'Crawlability',
    maxPoints: 25,
    families: ['crawlability', 'indexability', 'renderability'],
  },
  comprehension: {
    label: 'Comprehension',
    maxPoints: 30,
    families: ['metadata', 'schema', 'entity', 'content'],
  },
  authority: {
    label: 'Authority',
    maxPoints: 30,
    families: ['citation', 'trust', 'authority', 'ecommerce'],
  },
  freshness: {
    label: 'Freshness',
    maxPoints: 15,
    families: [],
  },
};

const EXPECTED_CRAWL_KEYS = [
  'robots_ai_crawlers',
  'ai_crawler_access',
  'llms_txt',
  'sitemap',
  'canonical',
  'page_load_ms',
  'lcp_ms',
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function uniqueEvidenceIds(results: RuleResult[]): string[] {
  return [...new Set(results.flatMap((result) => result.evidenceIds))];
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length < 8) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function latestFreshnessDate(evidenceMap: Map<string, EvidenceItem>): Date | null {
  const candidates: Date[] = [];

  const sitemap = evidenceMap.get('sitemap');
  const sitemapValue = sitemap?.value as Record<string, unknown> | undefined;
  const freshestMod = parseIsoDate(sitemapValue?.freshestMod);
  if (freshestMod) candidates.push(freshestMod);

  const rawStructuredEntities = evidenceMap.get('structured_data')?.value as Record<string, unknown> | undefined;
  const rawEntities = Array.isArray(rawStructuredEntities?.raw)
    ? (rawStructuredEntities.raw as Array<Record<string, unknown>>)
    : [];
  for (const entity of rawEntities) {
    const dateModified = parseIsoDate(entity.dateModified ?? entity['schema:dateModified']);
    const datePublished = parseIsoDate(entity.datePublished ?? entity['schema:datePublished']);
    if (dateModified) candidates.push(dateModified);
    if (datePublished) candidates.push(datePublished);
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((latest, current) => (current > latest ? current : latest));
}

function buildFreshnessPillar(evidenceMap: Map<string, EvidenceItem>): AVSPillarScore {
  const config = AVS_PILLAR_CONFIG.freshness;
  const sitemap = evidenceMap.get('sitemap');
  const sitemapValue = sitemap?.value as Record<string, unknown> | undefined;
  const structuredData = evidenceMap.get('structured_data');
  const latestDate = latestFreshnessDate(evidenceMap);
  const now = Date.now();

  let recencyComponent = 0;
  if (latestDate) {
    const ageDays = (now - latestDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 30) recencyComponent = 1;
    else if (ageDays <= 90) recencyComponent = 0.8;
    else if (ageDays <= 180) recencyComponent = 0.6;
    else if (ageDays <= 365) recencyComponent = 0.35;
    else recencyComponent = 0.1;
  }

  const updatesComponent = sitemapValue?.hasLastmod === true ? 1 : latestDate ? 0.6 : 0;
  const crawlFrequencyComponent = sitemapValue?.present === true
    ? sitemapValue?.hasLastmod === true
      ? 1
      : Number(sitemapValue?.urlCount ?? 0) > 0
        ? 0.6
        : 0.2
    : 0;
  const activityComponent = structuredData?.status === 'present' || latestDate ? 1 : 0;
  const normalizedScore = clamp(
    recencyComponent * 0.4 + updatesComponent * 0.3 + crawlFrequencyComponent * 0.2 + activityComponent * 0.1,
    0,
    1,
  );

  const signalCount = [latestDate, sitemapValue?.present, sitemapValue?.hasLastmod, structuredData?.status === 'present']
    .filter(Boolean).length;
  const evidenceIds = [sitemap?.evidence_id, structuredData?.evidence_id].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  let summary = 'No recency evidence detected; freshness confidence is low.';
  if (latestDate) {
    const ageDays = Math.max(0, Math.round((now - latestDate.getTime()) / (1000 * 60 * 60 * 24)));
    summary = ageDays <= 90
      ? `Recent freshness signal detected ${ageDays} day${ageDays === 1 ? '' : 's'} ago.`
      : `Latest observed freshness signal is ${ageDays} days old.`;
  } else if (sitemapValue?.hasLastmod === true) {
    summary = 'Sitemap lastmod is available, but the freshest date could not be parsed.';
  }

  return {
    key: 'freshness',
    label: config.label,
    weightPercent: config.maxPoints,
    maxPoints: config.maxPoints,
    score: roundTo(normalizedScore * config.maxPoints, 1),
    normalizedScore: roundTo(normalizedScore, 3),
    signalCount,
    evidenceIds,
    summary,
    confidence: signalCount >= 3 ? 0.9 : signalCount >= 2 ? 0.7 : signalCount >= 1 ? 0.45 : 0.2,
  };
}

function buildAVSReasons(ruleResults: RuleResult[], evidenceMap: Map<string, EvidenceItem>): AVSReason[] {
  const reasons = ruleResults
    .filter((result) => !result.passed)
    .map((result) => {
      const pillar = (Object.entries(AVS_PILLAR_CONFIG).find(([, config]) =>
        config.families.includes(result.family)
      )?.[0] ?? 'authority') as AVSPillarKey;
      const pillarConfig = AVS_PILLAR_CONFIG[pillar];
      const denominator = Math.max(
        1,
        pillarConfig.families.reduce((sum, family) => sum + Math.max(0, FAMILY_WEIGHT[family]), 0),
      );
      const evidenceLabel = result.evidenceKeys
        .map((key) => evidenceMap.get(key)?.label)
        .filter((label): label is string => typeof label === 'string' && label.length > 0)
        .join(', ');

      return {
        pillar,
        issue: result.title,
        impact: -roundTo((Math.abs(result.scoreImpact) / denominator) * pillarConfig.maxPoints, 1),
        evidenceIds: result.evidenceIds,
        rationale: evidenceLabel
          ? `${result.description} Observed via ${evidenceLabel}.`
          : result.description,
      };
    })
    .sort((left, right) => left.impact - right.impact);

  const freshnessPillar = buildFreshnessPillar(evidenceMap);
  if (freshnessPillar.score < 10) {
    reasons.push({
      pillar: 'freshness',
      issue: 'Weak recency signals',
      impact: -roundTo(freshnessPillar.maxPoints - freshnessPillar.score, 1),
      evidenceIds: freshnessPillar.evidenceIds,
      rationale: freshnessPillar.summary,
    });
  }

  return reasons.slice(0, 6);
}

function buildAVSConfidence(evidence: EvidenceItem[], contradictions: number): AVSConfidenceSummary {
  const observedEvidence = evidence.filter((item) => item.status === 'present' || item.status === 'partial').length;
  const dataCompleteness = evidence.length > 0 ? (observedEvidence / evidence.length) * 100 : 0;
  const observedCrawlKeys = EXPECTED_CRAWL_KEYS.filter((key) => {
    const item = evidence.find((candidate) => candidate.key === key);
    return item && item.status !== 'absent' && item.status !== 'error';
  }).length;
  const crawlDepth = (observedCrawlKeys / EXPECTED_CRAWL_KEYS.length) * 100;
  const evidenceAgreement = clamp(100 - contradictions * 20, 0, 100);
  const score = roundTo(dataCompleteness * 0.45 + crawlDepth * 0.3 + evidenceAgreement * 0.25, 0);

  return {
    score,
    label: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
    components: {
      dataCompleteness: roundTo(dataCompleteness, 0),
      crawlDepth: roundTo(crawlDepth, 0),
      evidenceAgreement: roundTo(evidenceAgreement, 0),
    },
    basis: 'Confidence is derived from evidence completeness, crawl-surface coverage, and contradiction-free agreement across extracted signals.',
  };
}

function buildAVSSummary(
  familyScores: ScoreBreakdown,
  ruleResults: RuleResult[],
  evidence: EvidenceItem[],
  contradictionCount: number,
): AVSScoreSummary {
  const evidenceMap = new Map<string, EvidenceItem>();
  for (const item of evidence) evidenceMap.set(item.key, item);

  const pillars = {} as Record<AVSPillarKey, AVSPillarScore>;
  for (const key of ['crawlability', 'comprehension', 'authority'] as const) {
    const config = AVS_PILLAR_CONFIG[key];
    const maxWeight = config.families.reduce((sum, family) => sum + Math.max(0, FAMILY_WEIGHT[family]), 0);
    const achieved = config.families.reduce((sum, family) => sum + familyScores[family], 0);
    const normalizedScore = maxWeight > 0 ? achieved / maxWeight : 0;
    const pillarResults = ruleResults.filter((result) => config.families.includes(result.family));
    const failedTitles = pillarResults.filter((result) => !result.passed).map((result) => result.title);

    pillars[key] = {
      key,
      label: config.label,
      weightPercent: config.maxPoints,
      maxPoints: config.maxPoints,
      score: roundTo(normalizedScore * config.maxPoints, 1),
      normalizedScore: roundTo(normalizedScore, 3),
      signalCount: pillarResults.length,
      evidenceIds: uniqueEvidenceIds(pillarResults),
      summary: failedTitles.length > 0
        ? `${failedTitles.slice(0, 2).join('; ')}${failedTitles.length > 2 ? '; more gaps detected.' : '.'}`
        : `${config.label} signals are consistently present.`,
      confidence: pillarResults.length > 0 ? 1 : 0.25,
    };
  }

  pillars.freshness = buildFreshnessPillar(evidenceMap);

  return {
    name: 'AI Visibility Score',
    methodology: 'AVS combines evidence-backed crawlability, comprehension, authority, and freshness pillars. Each pillar is derived from deterministic rule results or direct recency evidence rather than opaque averages.',
    pillars,
    reasons: buildAVSReasons(ruleResults, evidenceMap),
    confidence: buildAVSConfidence(evidence, contradictionCount),
  };
}

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

    // Resolve evidence keys to their corresponding evidence IDs (EV-hashes)
    const evidenceIds = keys
      .map((key) => evidenceMap.get(key)?.evidence_id)
      .filter((id): id is string => id !== undefined);

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
      evidenceIds,
      remediationKey: actualPassed ? null : rule.remediationKey,
    });
  }

  return results;
}

// ─── Score computation ────────────────────────────────────────────────────────

export function computeScore(
  ruleResults: RuleResult[],
  evidence: EvidenceItem[] = [],
  contradictionCount = 0,
): ScoreSnapshot {
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
    avs: buildAVSSummary(familyScores, ruleResults, evidence, contradictionCount),
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
        JSON.stringify(r.evidenceIds),
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
