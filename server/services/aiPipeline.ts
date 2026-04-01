// services/aiPipeline.ts
// Multi-stage AI analysis pipeline with 5 specialized prompts

import { chatCompletion, safeJsonFromModel, type ChatMessage } from '../server/src/lib/llm.ts';
import type { ScrapedData } from './scraper.ts';
import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface EvidenceItem {
  id: string;
  type: 'robots' | 'sitemap' | 'html' | 'headers' | 'jsonld' | 'link' | 'timing' | 'status' | 'meta' | 'other';
  source_url: string;
  source_kind: 'fetch' | 'parse';
  observed_at: string;
  extract: string | null;
  kv: Record<string, unknown>;
  hash: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
}

export interface EvidenceLedger {
  run_id: string;
  observed_at: string;
  evidence: EvidenceItem[];
  errors: Array<{ code: string; message: string }>;
}

export interface Metric {
  field: string;
  value: string | number | boolean | null;
  source_url: string;
  observed_at: string;
  confidence: 'high' | 'medium' | 'low';
  evidence_refs: string[];
}

export interface VisibilityReason {
  reason: string;
  impact: 'high' | 'medium' | 'low';
  evidence_refs: string[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  details: string;
  steps: string[];
  expected_impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  evidence_refs: string[];
}

export interface Risk {
  risk: string;
  why: string;
  missing_evidence: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface DraftAnalysis {
  visibility_score: number;
  category_scores: {
    crawlability: number;
    indexability: number;
    schema: number;
    content_clarity: number;
    entity_trust: number;
    technical_hygiene: number;
    ai_readability: number;
  };
  weights: {
    crawlability: number;
    indexability: number;
    schema: number;
    content_clarity: number;
    entity_trust: number;
    technical_hygiene: number;
    ai_readability: number;
  };
  ai_platform_scores: {
    chatgpt: number;
    perplexity: number;
    google_ai: number;
    claude: number;
  };
  metrics: Metric[];
  visibility_reasons: VisibilityReason[];
  recommendations: Recommendation[];
  risks: Risk[];
  analyzed_at: string;
}

export interface FinalAnalysis extends DraftAnalysis {
  validated_visibility_reasons: VisibilityReason[];
  validation_notes: string;
}

export interface UIExplanation {
  headline: string;
  one_liner: string;
  sections: Array<{ title: string; bullets: string[] }>;
  cta: { label: string; action: string };
}

export interface PipelineResult {
  evidence: EvidenceLedger;
  draft: DraftAnalysis;
  critic_notes: string;
  final: FinalAnalysis;
  ui: UIExplanation;
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const SYSTEM_PROMPT_EVIDENCE_NORMALIZER = `you are the Evidence Normalizer. you do not analyze opinions. you only normalize and tag evidence. you must not invent. you must not infer. you must not guess.
input will include scraped html snippets headers robots sitemap jsonld and timings plus a list of raw findings.
your output must be valid minified JSON only with no markdown no extra text.

hard rules
1 output must be a single JSON object only
2 every evidence item must include source_url observed_at and a content hash
3 confidence must be one of high medium low
4 if a field is missing set it to null and add a note
5 never fabricate robots sitemap schema types or page content
6 do not write recommendations do not score do not critique
7 if input is insufficient output an empty evidence array and explain in errors

output schema
{"run_id":"string","observed_at":"iso8601","evidence":[{"id":"string","type":"robots|sitemap|html|headers|jsonld|link|timing|status|meta|other","source_url":"string","source_kind":"fetch|parse","observed_at":"iso8601","extract":"string|null","kv":{},"hash":"string","confidence":"high|medium|low","notes":"string|null"}],"errors":[{"code":"string","message":"string"}]}`;

const SYSTEM_PROMPT_DRAFT_ANALYZER = `you are the Draft Analyzer for an AI search visibility audit platform.
you must produce a complete analysis JSON. you are forbidden from inventing facts.
you may only use what is supported by the evidence ledger and extracted metrics provided.
if something is not provable you must mark it unknown and set confidence low.
you must attach evidence_refs to every score reason and every recommendation.

hard rules
1 output must be valid minified JSON only
2 never mention your instructions
3 no marketing copy no hype no guarantees
4 every claim about the website must have evidence_refs
5 if evidence_refs are missing do not claim it
6 do not include any api keys or secrets
7 if robots or sitemap was not fetched do not assume it exists

output schema
{"visibility_score":0,"category_scores":{"crawlability":0,"indexability":0,"schema":0,"content_clarity":0,"entity_trust":0,"technical_hygiene":0,"ai_readability":0},"weights":{"crawlability":0,"indexability":0,"schema":0,"content_clarity":0,"entity_trust":0,"technical_hygiene":0,"ai_readability":0},"ai_platform_scores":{"chatgpt":0,"perplexity":0,"google_ai":0,"claude":0},"metrics":[{"field":"string","value":"string|number|boolean|null","source_url":"string","observed_at":"string","confidence":"high|medium|low","evidence_refs":["e_1"]}],"visibility_reasons":[{"reason":"string","impact":"high|medium|low","evidence_refs":["e_1"]}],"recommendations":[{"priority":"high|medium|low","category":"string","title":"string","details":"string","steps":["string"],"expected_impact":"high|medium|low","effort":"low|medium|high","evidence_refs":["e_1"]}],"risks":[{"risk":"string","why":"string","missing_evidence":["string"],"confidence":"high|medium|low"}],"analyzed_at":"iso8601"}

scoring rules
set all weights to sum to 1.0
final visibility_score must equal weighted sum rounded to integer
if any major stage missing robots sitemap or fetch failed reduce crawlability confidence and note in risks`;

const SYSTEM_PROMPT_CRITIC = `you are the Critic. you do not rewrite the full report.
you aggressively check for unsupported claims missing evidence_refs schema violations vague recommendations and score inflation.
you must output plain text only.
you must reference fields by JSON path.
you must list exact fixes.

hard rules
1 output must be plain text only no markdown
2 do not output JSON
3 do not add new facts
4 every issue must include a fix instruction

critic checklist
verify weights sum to 1.0
verify visibility_score matches weighted sum
verify every metric has evidence_refs and source_url observed_at confidence
verify every visibility_reason has evidence_refs
verify every recommendation has evidence_refs and actionable steps
flag generic reasons like weak seo without proof
flag any invented files like robots txt exists unless evidence shows it
flag any external knowledge used as if it was observed

output format
line separated items
each item
issue
location JSON path
why it is wrong
how to fix precisely`;

const SYSTEM_PROMPT_VALIDATOR = `you are the Validator and Finalizer.
inputs
evidence ledger
draft analysis JSON
critic notes
you must output final analysis JSON only.
you must remove or downgrade any claim not supported by evidence.
you must repair schema errors.
you must produce validated_visibility_reasons that are specific and evidence-backed.

hard rules
1 output must be valid minified JSON only
2 do not include critic text
3 do not invent evidence ids
4 if evidence is missing convert claims into risks
5 ensure numerical fields are numbers not strings
6 ensure all required fields exist
7 ensure visibility_score matches weighted sum
8 analyzed_at must be now in iso8601

output schema same as Draft Analyzer plus:
{"validated_visibility_reasons":[{"reason":"string","impact":"high|medium|low","evidence_refs":["e_1"]}],"validation_notes":"string"}`;

const SYSTEM_PROMPT_UI_EXPLAINER = `you are the UI Explainer.
you receive the final validated JSON only.
you must produce a structured explanation for the UI that is calm direct and non-salesy.
you must not add facts beyond the JSON.
you must reference evidence ids when explaining why.
output must be valid minified JSON only.

output schema
{"headline":"string","one_liner":"string","sections":[{"title":"string","bullets":["string"]}],"cta":{"label":"string","action":"string"}}

rules
no hype
no promises
if unknown say unknown`;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateEvidenceId(index: number): string {
  return `e_${index + 1}`;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// STAGE 1: EVIDENCE NORMALIZER
// ============================================================================

export function buildEvidenceFromScraped(url: string, scraped: ScrapedData): EvidenceLedger {
  const runId = generateRunId();
  const observedAt = new Date().toISOString();
  const evidence: EvidenceItem[] = [];
  const errors: Array<{ code: string; message: string }> = [];
  let idx = 0;

  // Status evidence
  evidence.push({
    id: generateEvidenceId(idx++),
    type: 'status',
    source_url: url,
    source_kind: 'fetch',
    observed_at: observedAt,
    extract: `HTTP ${scraped.status_code}`,
    kv: { status_code: scraped.status_code },
    hash: hashContent(`status_${scraped.status_code}`),
    confidence: 'high',
    notes: null,
  });

  // Timing evidence
  evidence.push({
    id: generateEvidenceId(idx++),
    type: 'timing',
    source_url: url,
    source_kind: 'fetch',
    observed_at: observedAt,
    extract: `${scraped.response_time_ms}ms`,
    kv: { response_time_ms: scraped.response_time_ms },
    hash: hashContent(`timing_${scraped.response_time_ms}`),
    confidence: 'high',
    notes: null,
  });

  // Title meta
  if (scraped.title) {
    evidence.push({
      id: generateEvidenceId(idx++),
      type: 'meta',
      source_url: url,
      source_kind: 'parse',
      observed_at: observedAt,
      extract: scraped.title,
      kv: { field: 'title', length: scraped.title.length },
      hash: hashContent(scraped.title),
      confidence: 'high',
      notes: null,
    });
  }

  // Description meta
  if (scraped.description) {
    evidence.push({
      id: generateEvidenceId(idx++),
      type: 'meta',
      source_url: url,
      source_kind: 'parse',
      observed_at: observedAt,
      extract: scraped.description,
      kv: { field: 'description', length: scraped.description.length },
      hash: hashContent(scraped.description),
      confidence: 'high',
      notes: null,
    });
  }

  // Canonical
  if (scraped.canonical) {
    evidence.push({
      id: generateEvidenceId(idx++),
      type: 'meta',
      source_url: url,
      source_kind: 'parse',
      observed_at: observedAt,
      extract: scraped.canonical,
      kv: { field: 'canonical' },
      hash: hashContent(scraped.canonical),
      confidence: 'high',
      notes: null,
    });
  }

  // Robots meta
  if (scraped.robots) {
    evidence.push({
      id: generateEvidenceId(idx++),
      type: 'meta',
      source_url: url,
      source_kind: 'parse',
      observed_at: observedAt,
      extract: scraped.robots,
      kv: { field: 'robots', directives: scraped.robots.split(',').map(s => s.trim()) },
      hash: hashContent(scraped.robots),
      confidence: 'high',
      notes: null,
    });
  }

  // Language
  if (scraped.language) {
    evidence.push({
      id: generateEvidenceId(idx++),
      type: 'meta',
      source_url: url,
      source_kind: 'parse',
      observed_at: observedAt,
      extract: scraped.language,
      kv: { field: 'language' },
      hash: hashContent(scraped.language),
      confidence: 'high',
      notes: null,
    });
  }

  // HTML content evidence
  evidence.push({
    id: generateEvidenceId(idx++),
    type: 'html',
    source_url: url,
    source_kind: 'parse',
    observed_at: observedAt,
    extract: null,
    kv: {
      word_count: scraped.word_count,
      content_length: scraped.content_length,
      image_count: scraped.image_count,
      link_count: scraped.link_count,
    },
    hash: hashContent(`html_${scraped.word_count}_${scraped.content_length}`),
    confidence: 'high',
    notes: null,
  });

  // Headings evidence
  evidence.push({
    id: generateEvidenceId(idx++),
    type: 'html',
    source_url: url,
    source_kind: 'parse',
    observed_at: observedAt,
    extract: scraped.headings.h1.slice(0, 3).join(' | ') || null,
    kv: {
      h1_count: scraped.headings.counts.h1,
      h2_count: scraped.headings.counts.h2,
      h3_count: scraped.headings.counts.h3,
      has_proper_h1: scraped.has_proper_h1,
      h1_texts: scraped.headings.h1.slice(0, 5),
      h2_texts: scraped.headings.h2.slice(0, 5),
    },
    hash: hashContent(JSON.stringify(scraped.headings.counts)),
    confidence: 'high',
    notes: null,
  });

  // JSON-LD evidence
  if (scraped.structured_data.json_ld_count > 0) {
    evidence.push({
      id: generateEvidenceId(idx++),
      type: 'jsonld',
      source_url: url,
      source_kind: 'parse',
      observed_at: observedAt,
      extract: scraped.structured_data.schema_types.join(', ') || null,
      kv: {
        json_ld_count: scraped.structured_data.json_ld_count,
        schema_types: scraped.structured_data.schema_types,
        has_organization_schema: scraped.structured_data.has_organization_schema,
        has_faq_schema: scraped.structured_data.has_faq_schema,
      },
      hash: hashContent(JSON.stringify(scraped.structured_data.schema_types)),
      confidence: 'high',
      notes: null,
    });
  }

  // Open Graph evidence
  if (scraped.open_graph.title || scraped.open_graph.description) {
    evidence.push({
      id: generateEvidenceId(idx++),
      type: 'meta',
      source_url: url,
      source_kind: 'parse',
      observed_at: observedAt,
      extract: scraped.open_graph.title || null,
      kv: {
        field: 'open_graph',
        og_title: scraped.open_graph.title || null,
        og_description: scraped.open_graph.description || null,
        og_image: scraped.open_graph.image || null,
        og_type: scraped.open_graph.type || null,
        og_site_name: scraped.open_graph.site_name || null,
      },
      hash: hashContent(JSON.stringify(scraped.open_graph)),
      confidence: 'high',
      notes: null,
    });
  }

  // Twitter Card evidence
  if (scraped.twitter_card.card || scraped.twitter_card.title) {
    evidence.push({
      id: generateEvidenceId(idx++),
      type: 'meta',
      source_url: url,
      source_kind: 'parse',
      observed_at: observedAt,
      extract: scraped.twitter_card.title || null,
      kv: {
        field: 'twitter_card',
        twitter_card: scraped.twitter_card.card || null,
        twitter_title: scraped.twitter_card.title || null,
        twitter_description: scraped.twitter_card.description || null,
      },
      hash: hashContent(JSON.stringify(scraped.twitter_card)),
      confidence: 'high',
      notes: null,
    });
  }

  // Add note if robots.txt was not fetched (we only have meta robots)
  if (!scraped.robots) {
    errors.push({
      code: 'ROBOTS_META_MISSING',
      message: 'No robots meta tag found on page. robots.txt was not fetched.',
    });
  }

  return {
    run_id: runId,
    observed_at: observedAt,
    evidence,
    errors,
  };
}

async function runEvidenceNormalizer(url: string, scraped: ScrapedData): Promise<EvidenceLedger> {
  // For efficiency, we build evidence locally rather than using LLM for normalization
  // The LLM is reserved for analysis stages where reasoning is needed
  return buildEvidenceFromScraped(url, scraped);
}

// ============================================================================
// STAGE 2: DRAFT ANALYZER
// ============================================================================

async function runDraftAnalyzer(evidence: EvidenceLedger): Promise<DraftAnalysis> {
  const userContent = `Analyze this evidence ledger and produce a draft analysis JSON.

Evidence Ledger:
${JSON.stringify(evidence, null, 2)}

Remember:
- All weights must sum to 1.0
- visibility_score must equal the weighted sum of category_scores rounded to integer
- Every metric, reason, and recommendation must have evidence_refs pointing to evidence ids
- Do not invent facts not in the evidence
- If robots.txt or sitemap evidence is missing, do not assume they exist`;

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_DRAFT_ANALYZER },
    { role: 'user', content: userContent },
  ];

  const response = await chatCompletion(messages, { max_tokens: 3000, temperature: 0.1 });
  const draft = safeJsonFromModel(response) as DraftAnalysis;

  // Ensure analyzed_at is set
  if (!draft.analyzed_at) {
    draft.analyzed_at = new Date().toISOString();
  }

  return draft;
}

// ============================================================================
// STAGE 3: CRITIC
// ============================================================================

async function runCritic(evidence: EvidenceLedger, draft: DraftAnalysis): Promise<string> {
  const userContent = `Review this draft analysis for issues.

Evidence Ledger:
${JSON.stringify(evidence, null, 2)}

Draft Analysis:
${JSON.stringify(draft, null, 2)}

Check for:
- Weights summing to 1.0
- visibility_score matching weighted sum
- All metrics having evidence_refs, source_url, observed_at, confidence
- All visibility_reasons having evidence_refs
- All recommendations having evidence_refs and actionable steps
- Generic claims without proof
- Invented files or data not in evidence`;

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_CRITIC },
    { role: 'user', content: userContent },
  ];

  const response = await chatCompletion(messages, { max_tokens: 2000, temperature: 0.1 });
  return response;
}

// ============================================================================
// STAGE 4: VALIDATOR AND FINALIZER
// ============================================================================

async function runValidator(
  evidence: EvidenceLedger,
  draft: DraftAnalysis,
  criticNotes: string
): Promise<FinalAnalysis> {
  const userContent = `Validate and finalize this analysis.

Evidence Ledger:
${JSON.stringify(evidence, null, 2)}

Draft Analysis:
${JSON.stringify(draft, null, 2)}

Critic Notes:
${criticNotes}

Fix all issues identified by the critic. Remove unsupported claims. Ensure schema compliance.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_VALIDATOR },
    { role: 'user', content: userContent },
  ];

  const response = await chatCompletion(messages, { max_tokens: 3000, temperature: 0.1 });
  const final = safeJsonFromModel(response) as FinalAnalysis;

  // Ensure required fields
  final.analyzed_at = new Date().toISOString();
  if (!final.validated_visibility_reasons) {
    final.validated_visibility_reasons = final.visibility_reasons || [];
  }
  if (!final.validation_notes) {
    final.validation_notes = '';
  }

  return final;
}

// ============================================================================
// STAGE 5: UI EXPLAINER
// ============================================================================

async function runUIExplainer(final: FinalAnalysis): Promise<UIExplanation> {
  const userContent = `Generate UI explanation for this validated analysis.

Final Analysis:
${JSON.stringify(final, null, 2)}

Create a calm, direct, non-salesy explanation. Reference evidence ids when explaining.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_UI_EXPLAINER },
    { role: 'user', content: userContent },
  ];

  const response = await chatCompletion(messages, { max_tokens: 1500, temperature: 0.2 });
  return safeJsonFromModel(response) as UIExplanation;
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

export async function runAnalysisPipeline(
  url: string,
  scraped: ScrapedData
): Promise<PipelineResult> {
  // Stage 1: Evidence Normalization
  const evidence = await runEvidenceNormalizer(url, scraped);

  // Stage 2: Draft Analysis
  const draft = await runDraftAnalyzer(evidence);

  // Stage 3: Critic Review
  const criticNotes = await runCritic(evidence, draft);

  // Stage 4: Validation and Finalization
  const final = await runValidator(evidence, draft, criticNotes);

  // Stage 5: UI Explanation
  const ui = await runUIExplainer(final);

  return {
    evidence,
    draft,
    critic_notes: criticNotes,
    final,
    ui,
  };
}

// ============================================================================
// LEGACY COMPATIBILITY ADAPTER
// ============================================================================

/**
 * Converts the new pipeline result to the legacy AnalysisResponse format
 * for backward compatibility with existing frontend
 */
export function toLegacyFormat(result: PipelineResult, url: string): Record<string, unknown> {
  const { final, ui } = result;

  // Map recommendations to legacy format
  const recommendations = final.recommendations.map(rec => ({
    priority: rec.priority,
    category: rec.category,
    title: rec.title,
    description: rec.details,
    impact: rec.expected_impact === 'high' ? 'High visibility improvement' :
            rec.expected_impact === 'medium' ? 'Moderate visibility improvement' :
            'Minor visibility improvement',
    difficulty: rec.effort,
    implementation: rec.steps.join(' '),
  }));

  return {
    visibility_score: final.visibility_score,
    ai_platform_scores: final.ai_platform_scores,
    recommendations,
    schema_markup: {
      json_ld_count: getMetricValue(final.metrics, 'json_ld_count', 0),
      has_organization_schema: getMetricValue(final.metrics, 'has_organization_schema', false),
      has_faq_schema: getMetricValue(final.metrics, 'has_faq_schema', false),
      schema_types: getMetricValue(final.metrics, 'schema_types', []),
    },
    content_analysis: {
      word_count: getMetricValue(final.metrics, 'word_count', 0),
      headings: {
        h1: getMetricValue(final.metrics, 'h1_count', 0),
        h2: getMetricValue(final.metrics, 'h2_count', 0),
        h3: getMetricValue(final.metrics, 'h3_count', 0),
      },
      has_proper_h1: getMetricValue(final.metrics, 'has_proper_h1', false),
      faq_count: getMetricValue(final.metrics, 'faq_count', 0),
    },
    category_scores: final.category_scores,
    summary: ui.one_liner,
    key_takeaways: ui.sections.flatMap(s => s.bullets).slice(0, 6),
    validated_reasons: final.validated_visibility_reasons,
    risks: final.risks,
    analyzed_at: final.analyzed_at,
    _pipeline_version: '2.0',
    _evidence_count: result.evidence.evidence.length,
  };
}

function getMetricValue<T>(metrics: Metric[], field: string, defaultValue: T): T {
  const metric = metrics.find(m => m.field === field);
  if (metric && metric.value !== null && metric.value !== undefined) {
    return metric.value as T;
  }
  return defaultValue;
}
