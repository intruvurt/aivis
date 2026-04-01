import type {
  CitationParityAudit,
  CitationDimensionKey,
  CitationDimensionScore,
  CitationEvidenceArtifact,
  ModelParityCheck,
} from '../../../shared/types.js';

type CategoryGradeLike = { label?: string; score?: number };
type RecommendationLike = { title?: string; description?: string; implementation?: string; evidence_ids?: string[] };
type ContentHighlightLike = { source_id?: string; status?: string; note?: string };

type BuildCitationParityInput = {
  url: string;
  analyzedAt: string;
  visibilityScore: number;
  categoryGrades?: CategoryGradeLike[];
  recommendations?: RecommendationLike[];
  contentHighlights?: ContentHighlightLike[];
  evidenceManifest?: Record<string, string>;
  schemaMarkup?: {
    json_ld_count?: number;
    has_organization_schema?: boolean;
    has_faq_schema?: boolean;
    schema_types?: string[];
  };
  contentAnalysis?: {
    word_count?: number;
    faq_count?: number;
    headings?: { h1?: number; h2?: number; h3?: number };
    has_meta_description?: boolean;
  };
  domainIntelligence?: {
    entity_clarity_score?: number;
    primary_topics?: string[];
    citation_domains?: string[];
    citation_strength?: Array<{ domain?: string; tier?: string; reason?: string }>;
  };
  technicalSignals?: {
    https_enabled?: boolean;
    has_canonical?: boolean;
    status_code?: number;
    response_time_ms?: number;
    link_count?: number;
    image_count?: number;
  };
  topicalKeywords?: string[];
  brandEntities?: string[];
  goalAlignment?: {
    coverage?: number;
    matched_goals?: string[];
    missing_goals?: string[];
  };
  recommendationEvidenceSummary?: {
    evidence_ref_integrity_percent?: number;
    evidence_coverage_percent?: number;
    recommendations_with_evidence?: number;
  };
};

const DIMENSIONS: Array<{ key: CitationDimensionKey; label: string; weight: number }> = [
  { key: 'entity_clarity', label: 'Entity Clarity & Attribution Integrity', weight: 12 },
  { key: 'answer_density', label: 'Direct Answer Density & Extractability', weight: 12 },
  { key: 'structured_data', label: 'Structured Data Presence & Accuracy', weight: 12 },
  { key: 'trust_architecture', label: 'Trust Architecture', weight: 12 },
  { key: 'content_query_alignment', label: 'Content-Query Alignment', weight: 10 },
  { key: 'topical_authority_depth', label: 'Topical Authority Depth', weight: 10 },
  { key: 'noise_to_signal', label: 'Noise-to-Signal Ratio', weight: 8 },
  { key: 'technical_crawl_integrity', label: 'Technical Crawl/Index Integrity', weight: 10 },
  { key: 'citation_surface_area', label: 'Citation Surface Area', weight: 8 },
  { key: 'offpage_visibility_footprint', label: 'Off-Page Visibility Footprint', weight: 6 },
];

const CATEGORY_LABELS: Record<string, CitationDimensionKey> = {
  'Content Depth & Quality': 'answer_density',
  'Heading Structure & H1': 'answer_density',
  'Schema & Structured Data': 'structured_data',
  'Meta Tags & Open Graph': 'trust_architecture',
  'Technical SEO': 'technical_crawl_integrity',
  'AI Readability & Citability': 'content_query_alignment',
};

function clamp(value: number, min = 0, max = 10): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function categoryToDimensionScores(categoryGrades: CategoryGradeLike[] = []): Partial<Record<CitationDimensionKey, number>> {
  const out: Partial<Record<CitationDimensionKey, number[]>> = {};
  for (const grade of categoryGrades) {
    const label = typeof grade.label === 'string' ? grade.label : '';
    const key = CATEGORY_LABELS[label];
    if (!key) continue;
    const normalized = clamp(asNumber(grade.score) / 10);
    out[key] = [...(out[key] || []), normalized];
  }

  const reduced: Partial<Record<CitationDimensionKey, number>> = {};
  for (const [key, values] of Object.entries(out) as Array<[CitationDimensionKey, number[]]>) {
    if (!values.length) continue;
    reduced[key] = values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return reduced;
}

function mapDimensionFix(dimension: CitationDimensionKey): string {
  const fixes: Record<CitationDimensionKey, string> = {
    entity_clarity: 'Add explicit author/organization attribution, tighten entity naming consistency, and publish verifiable About/Editorial metadata.',
    answer_density: 'Add query-led H2/H3 sections with immediate concise answers and reduce narrative before answer spans.',
    structured_data: 'Expand and validate JSON-LD schema coverage (Organization, Article/FAQ/HowTo/Product as applicable) with content-matched values.',
    trust_architecture: 'Add publish/updated dates, credential signals, and primary-source outbound references for key factual claims.',
    content_query_alignment: 'Map page sections to target query intents and close intent gaps with explicit definitions, examples, and edge cases.',
    topical_authority_depth: 'Build internal topic clusters and reinforce semantic links between core and supporting pages.',
    noise_to_signal: 'Reduce boilerplate/CTA weight above fold and increase substantive answer content density per page section.',
    technical_crawl_integrity: 'Resolve indexability/canonical risks, improve crawlable HTML output, and minimize JS-only critical content.',
    citation_surface_area: 'Increase discrete attributable facts, structured claim blocks, and evidence-linked implementation notes.',
    offpage_visibility_footprint: 'Grow reputable third-party mentions and niche authority backlinks aligned to core entities/topics.',
  };
  return fixes[dimension];
}

function scoreVisibilityLevel(value: number): 'high' | 'medium' | 'low' {
  if (value >= 80) return 'high';
  if (value >= 55) return 'medium';
  return 'low';
}

export function buildCitationParityAudit(input: BuildCitationParityInput): CitationParityAudit {
  const categoryScores = categoryToDimensionScores(input.categoryGrades || []);
  const headingCounts = input.contentAnalysis?.headings || {};
  const wordCount = asNumber(input.contentAnalysis?.word_count);
  const h2h3 = asNumber(headingCounts.h2) + asNumber(headingCounts.h3);
  const faqCount = asNumber(input.contentAnalysis?.faq_count);
  const jsonLdCount = asNumber(input.schemaMarkup?.json_ld_count);
  const schemaTypes = Array.isArray(input.schemaMarkup?.schema_types) ? input.schemaMarkup?.schema_types || [] : [];
  const externalDomainCount = Array.isArray(input.domainIntelligence?.citation_domains)
    ? input.domainIntelligence?.citation_domains?.length || 0
    : 0;
  const citationStrengthCount = Array.isArray(input.domainIntelligence?.citation_strength)
    ? input.domainIntelligence?.citation_strength?.length || 0
    : 0;
  const internalLinkProxy = Math.max(0, asNumber(input.technicalSignals?.link_count) - externalDomainCount);
  const imageCount = asNumber(input.technicalSignals?.image_count);
  const recommendationCount = Array.isArray(input.recommendations) ? input.recommendations.length : 0;
  const recWithEvidence = Array.isArray(input.recommendations)
    ? input.recommendations.filter((r) => Array.isArray(r.evidence_ids) && r.evidence_ids.length > 0).length
    : 0;
  const highlightEvidenceCount = Array.isArray(input.contentHighlights)
    ? input.contentHighlights.filter((h) => typeof h.source_id === 'string' && h.source_id.length > 0).length
    : 0;
  const evidenceManifestCount = input.evidenceManifest ? Object.keys(input.evidenceManifest).length : 0;
  const entityScore = asNumber(input.domainIntelligence?.entity_clarity_score) / 10;
  const brandEntityFactor = Math.min(10, (input.brandEntities?.length || 0) * 2.5);
  const orgSchemaFactor = input.schemaMarkup?.has_organization_schema ? 8.5 : 3.5;

  const answerDepthFactor = Math.min(10, wordCount / 140);
  const headingFactor = Math.min(10, h2h3 * 1.2 + (asNumber(headingCounts.h1) > 0 ? 1 : 0));
  const faqFactor = Math.min(10, faqCount * 2);

  const structuredDensityFactor = Math.min(10, jsonLdCount * 2.5);
  const structuredVarietyFactor = Math.min(10, schemaTypes.length * 1.6);

  const extRefFactor = Math.min(10, externalDomainCount * 1.5);
  const evidenceIntegrityFactor = clamp(asNumber(input.recommendationEvidenceSummary?.evidence_ref_integrity_percent, 70) / 10);
  const timestampSignalFactor = /\b(20\d{2}|19\d{2})\b/.test(Object.values(input.evidenceManifest || {}).join(' ')) ? 7.5 : 4;

  const queryCoverage = typeof input.goalAlignment?.coverage === 'number'
    ? clamp(input.goalAlignment.coverage * 10)
    : Math.min(10, ((input.topicalKeywords?.length || 0) + (input.domainIntelligence?.primary_topics?.length || 0)) / 1.6);

  const topicalClusterFactor = Math.min(10, internalLinkProxy / 5 + (input.domainIntelligence?.primary_topics?.length || 0) * 1.2);
  const keywordBreadthFactor = Math.min(10, (input.topicalKeywords?.length || 0) * 0.9);

  const chromeWeight = (asNumber(input.technicalSignals?.link_count) * 8) + (imageCount * 12) + ((h2h3 + asNumber(headingCounts.h1)) * 20);
  const signalRatio = wordCount > 0 ? wordCount / Math.max(1, wordCount + chromeWeight) : 0;
  const noiseScore = clamp(signalRatio * 14);

  const httpsFactor = input.technicalSignals?.https_enabled ? 9 : 4;
  const canonicalFactor = input.technicalSignals?.has_canonical ? 8 : 4;
  const statusFactor = asNumber(input.technicalSignals?.status_code, 200) >= 400 ? 3 : 8;
  const speedMs = asNumber(input.technicalSignals?.response_time_ms, 2500);
  const speedFactor = speedMs <= 1200 ? 9 : speedMs <= 2500 ? 7 : speedMs <= 4000 ? 5 : 3;

  const citationFactFactor = Math.min(10, (highlightEvidenceCount * 1.6) + (recWithEvidence * 0.9));
  const citationCoverageFactor = recommendationCount > 0 ? clamp((recWithEvidence / recommendationCount) * 10) : 4;

  const offpageMentionFactor = Math.min(10, externalDomainCount * 1.3);
  const offpageStrengthFactor = Math.min(10, citationStrengthCount * 2.2);

  const rawScores: Record<CitationDimensionKey, number> = {
    entity_clarity: clamp((entityScore * 0.5) + (brandEntityFactor * 0.25) + (orgSchemaFactor * 0.25)),
    answer_density: clamp((answerDepthFactor * 0.35) + (headingFactor * 0.35) + (faqFactor * 0.15) + ((categoryScores.answer_density ?? 5) * 0.15)),
    structured_data: clamp((structuredDensityFactor * 0.4) + (structuredVarietyFactor * 0.3) + ((categoryScores.structured_data ?? 5) * 0.3)),
    trust_architecture: clamp((extRefFactor * 0.3) + (evidenceIntegrityFactor * 0.35) + (timestampSignalFactor * 0.2) + ((categoryScores.trust_architecture ?? 5) * 0.15)),
    content_query_alignment: clamp((queryCoverage * 0.6) + ((categoryScores.content_query_alignment ?? 5) * 0.4)),
    topical_authority_depth: clamp((topicalClusterFactor * 0.55) + (keywordBreadthFactor * 0.3) + ((categoryScores.topical_authority_depth ?? 5) * 0.15)),
    noise_to_signal: clamp((noiseScore * 0.8) + ((categoryScores.noise_to_signal ?? 5) * 0.2)),
    technical_crawl_integrity: clamp((httpsFactor * 0.2) + (canonicalFactor * 0.2) + (statusFactor * 0.2) + (speedFactor * 0.2) + ((categoryScores.technical_crawl_integrity ?? 5) * 0.2)),
    citation_surface_area: clamp((citationFactFactor * 0.55) + (citationCoverageFactor * 0.25) + ((categoryScores.citation_surface_area ?? 5) * 0.2)),
    offpage_visibility_footprint: clamp((offpageMentionFactor * 0.5) + (offpageStrengthFactor * 0.3) + ((categoryScores.offpage_visibility_footprint ?? 5) * 0.2)),
  };

  const evidence: CitationEvidenceArtifact[] = [];
  const pushEvidence = (
    dimension: CitationDimensionKey,
    finding: string,
    evidenceType: CitationEvidenceArtifact['evidence_type'],
    evidenceId: string,
    locator: string,
    observedValue: string,
    confidence: CitationEvidenceArtifact['confidence']
  ) => {
    evidence.push({
      dimension,
      score_0_10: round1(rawScores[dimension]),
      finding,
      evidence_type: evidenceType,
      evidence_id: evidenceId,
      source_url: input.url,
      selector_or_locator: locator,
      observed_value: observedValue,
      capture_time_utc: input.analyzedAt,
      confidence,
    });
  };

  pushEvidence('entity_clarity', 'Entity confidence estimated from explicit brand/org signals and schema identity anchors.', 'metadata', 'ev_entity_score', 'domain_intelligence.entity_clarity_score', String(asNumber(input.domainIntelligence?.entity_clarity_score)), 'high');
  pushEvidence('entity_clarity', 'Brand entity count contributes to attribution confidence.', 'dom', 'ev_brand_entities', 'brand_entities[]', String(input.brandEntities?.length || 0), 'medium');
  pushEvidence('answer_density', 'Answer extraction potential estimated from word depth and heading segmentation.', 'dom', 'ev_answer_blocks', 'content_analysis.word_count + headings', `words=${wordCount}; h2_h3=${h2h3}; faq=${faqCount}`, 'high');
  pushEvidence('structured_data', 'Structured data quantity/variety scored from JSON-LD block and schema-type coverage.', 'schema', 'ev_schema_density', 'schema_markup.json_ld_count + schema_types[]', `json_ld=${jsonLdCount}; schema_types=${schemaTypes.join(',') || 'none'}`, 'high');
  pushEvidence('trust_architecture', 'Trust architecture includes references, evidence integrity, and temporal freshness cues.', 'link', 'ev_trust_refs', 'domain_intelligence.citation_domains[]', `external_domains=${externalDomainCount}; evidence_integrity=${asNumber(input.recommendationEvidenceSummary?.evidence_ref_integrity_percent, 0)}%`, 'medium');
  pushEvidence('content_query_alignment', 'Alignment uses explicit findability-goal coverage where available.', 'metadata', 'ev_goal_alignment', 'goal_alignment.coverage', String(asNumber(input.goalAlignment?.coverage, -1)), 'medium');
  pushEvidence('topical_authority_depth', 'Topical authority estimated from link graph depth and topical breadth.', 'dom', 'ev_topic_cluster', 'technical_signals.link_count + topical_keywords[]', `internal_link_proxy=${internalLinkProxy}; topical_keywords=${input.topicalKeywords?.length || 0}`, 'medium');
  pushEvidence('noise_to_signal', 'Noise ratio approximated from substantive text vs chrome-heavy page elements.', 'dom', 'ev_signal_ratio', 'word_count/(word_count+chrome_weight)', `${round1(signalRatio * 10)}/10`, 'medium');
  pushEvidence('technical_crawl_integrity', 'Crawl integrity combines https/canonical/status/performance indicators.', 'http', 'ev_technical_integrity', 'technical_signals.*', `https=${Boolean(input.technicalSignals?.https_enabled)}; canonical=${Boolean(input.technicalSignals?.has_canonical)}; status=${asNumber(input.technicalSignals?.status_code, 200)}; response_ms=${speedMs}`, 'high');
  pushEvidence('citation_surface_area', 'Citation surface estimated from evidence-linked highlights/recommendations.', 'metadata', 'ev_citation_surface', 'content_highlights + recommendations.evidence_ids', `highlights_with_source=${highlightEvidenceCount}; recs_with_evidence=${recWithEvidence}`, 'high');
  pushEvidence('offpage_visibility_footprint', 'Off-page visibility estimated from detected citations and source-strength hints.', 'search', 'ev_offpage_mentions', 'citation_domains + citation_strength', `domains=${externalDomainCount}; strength_items=${citationStrengthCount}`, 'low');

  if (input.evidenceManifest) {
    const entries = Object.entries(input.evidenceManifest).slice(0, 16);
    for (const [id, value] of entries) {
      const mappedDimension: CitationDimensionKey =
        id.includes('schema')
          ? 'structured_data'
          : id.includes('h1') || id.includes('h2') || id.includes('h3') || id.includes('word')
            ? 'answer_density'
            : id.includes('canonical') || id.includes('https')
              ? 'technical_crawl_integrity'
              : id.includes('meta') || id.includes('title')
                ? 'trust_architecture'
                : 'citation_surface_area';
      pushEvidence(
        mappedDimension,
        'Direct scraped evidence manifest value used in parity scoring.',
        id.includes('schema') ? 'schema' : 'metadata',
        id,
        `evidence_manifest.${id}`,
        String(value).slice(0, 240),
        'high'
      );
    }
  }

  const dimensions: CitationDimensionScore[] = DIMENSIONS.map((dim) => {
    const score = round1(rawScores[dim.key]);
    const weighted = round1((score / 10) * dim.weight);
    return {
      key: dim.key,
      label: dim.label,
      score_0_10: score,
      weighted_points: weighted,
      evidence_count: evidence.filter((item) => item.dimension === dim.key).length,
      rationale: `${dim.label} scored from observed page, schema, metadata, and evidence-linkage signals.`,
    };
  });

  const weightedTotal = dimensions.reduce((sum, dim) => sum + dim.weighted_points, 0);
  const weightedScore = Math.round(weightedTotal);

  const structuredHardFail = rawScores.structured_data < 4;
  const technicalHardFail = rawScores.technical_crawl_integrity < 4;

  const strongest = [...dimensions]
    .sort((a, b) => b.score_0_10 - a.score_0_10)
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.score_0_10}/10`);

  const weakest = [...dimensions]
    .sort((a, b) => a.score_0_10 - b.score_0_10)
    .slice(0, 3);

  const concerns = weakest.map((item) => `${item.label} is under target at ${item.score_0_10}/10.`);
  const topFrictionPoints = weakest.map((item) => `${item.label} is currently limiting citation confidence.`);

  const priorityFixes = Array.from(new Set(weakest.map((item) => mapDimensionFix(item.key)))).slice(0, 5);
  while (priorityFixes.length < 5) {
    priorityFixes.push('Increase evidence-linked recommendations and maintain structured, directly citable answer blocks.');
  }

  let verdict: CitationParityAudit['verdict'];
  if (structuredHardFail || technicalHardFail || weightedScore < 55) {
    verdict = 'Avoid for serious factual claims';
  } else if (weightedScore < 80) {
    verdict = 'OK as opinion';
  } else {
    verdict = 'Safe to cite as factual';
  }

  const visibilityLevel = scoreVisibilityLevel(weightedScore);

  const allDimensionKeys = DIMENSIONS.map((item) => item.key);

  const buildParityCheck = (
    requiredDimensions: CitationDimensionKey[],
    requiredOutputs: string[],
    outputPresenceMap: Record<string, boolean>
  ): ModelParityCheck => {
    const coveredDimensions = requiredDimensions.filter((dim) => allDimensionKeys.includes(dim));
    const missingDimensions = requiredDimensions.filter((dim) => !coveredDimensions.includes(dim));
    const outputsPresent = requiredOutputs.filter((key) => outputPresenceMap[key]);
    const outputsMissing = requiredOutputs.filter((key) => !outputPresenceMap[key]);
    return {
      required_dimensions: requiredDimensions,
      covered_dimensions: coveredDimensions,
      missing_dimensions: missingDimensions,
      required_outputs: requiredOutputs,
      outputs_present: outputsPresent,
      outputs_missing: outputsMissing,
      pass: missingDimensions.length === 0 && outputsMissing.length === 0,
    };
  };

  const outputPresence: Record<string, boolean> = {
    verdict: true,
    strongest_reliability_indicators: strongest.length > 0,
    biggest_concerns_or_limitations: concerns.length > 0,
    visibility_note: true,
    top_3_friction_points: topFrictionPoints.length >= 3,
    dimensions_1_10: dimensions.length === 10,
    numeric_visibility_score_0_100: Number.isFinite(weightedScore),
    prioritized_structural_fixes: priorityFixes.length > 0,
    implementation_level_recommendations: priorityFixes.length > 0,
  };

  const modelParity = {
    perplexity: buildParityCheck(
      ['entity_clarity', 'structured_data', 'trust_architecture', 'technical_crawl_integrity', 'offpage_visibility_footprint'],
      ['verdict', 'strongest_reliability_indicators', 'biggest_concerns_or_limitations', 'visibility_note'],
      outputPresence
    ),
    claude: buildParityCheck(
      ['entity_clarity', 'answer_density', 'structured_data', 'trust_architecture', 'content_query_alignment', 'noise_to_signal', 'citation_surface_area'],
      ['dimensions_1_10', 'top_3_friction_points'],
      outputPresence
    ),
    gemini: buildParityCheck(
      ['entity_clarity', 'trust_architecture', 'technical_crawl_integrity', 'offpage_visibility_footprint'],
      ['verdict', 'biggest_concerns_or_limitations', 'visibility_note'],
      outputPresence
    ),
    chatgpt: buildParityCheck(
      ['entity_clarity', 'answer_density', 'structured_data', 'trust_architecture', 'content_query_alignment', 'topical_authority_depth', 'technical_crawl_integrity', 'citation_surface_area'],
      ['numeric_visibility_score_0_100', 'prioritized_structural_fixes', 'implementation_level_recommendations'],
      outputPresence
    ),
  };

  const parityComplete = Object.values(modelParity).every((check) => check.pass) && dimensions.length === 10;

  return {
    rubric_version: 'consensus-v1',
    parity_complete: parityComplete,
    ai_visibility_score_0_100: weightedScore,
    verdict,
    strongest_reliability_indicators: strongest,
    biggest_concerns_or_limitations: concerns,
    visibility_note: {
      level: visibilityLevel,
      reasons: [
        `Composite weighted score: ${weightedScore}/100.`,
        `Technical integrity: ${round1(rawScores.technical_crawl_integrity)}/10.`,
        `Structured data quality: ${round1(rawScores.structured_data)}/10.`,
      ],
    },
    dimensions,
    top_friction_points: topFrictionPoints,
    priority_fixes: priorityFixes,
    model_parity: modelParity,
    evidence,
  };
}
