// server/src/services/platformIntelligence.ts
// Platform-specific citation intelligence derived from documented AI platform behaviors.
// Sources: Claude web_fetch pipeline, Google AIO patent signals, Perplexity Sonar retrieval,
//          ChatGPT evidence-first audit methodology.

// ── Platform scoring dimensions ─────────────────────────────────────────────
// Each platform weights page signals differently when selecting citation sources.

export interface PlatformSignals {
  wordCount: number;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  jsonLdCount: number;
  hasFaqSchema: boolean;
  hasOrgSchema: boolean;
  hasWebsiteSchema: boolean;
  schemaTypeCount: number;
  hasMetaDescription: boolean;
  metaDescriptionLength: number;
  titleLength: number;
  hasOgTags: boolean;
  isHttps: boolean;
  hasCanonical: boolean;
  internalLinkCount: number;
  responseTimeMs: number;
  imageAltCoverage: number;        // 0-1
  hasLlmsTxt: boolean;
  lexicalDiversity: number;        // 0-1
  directAnswerDensity: number;     // count of FAQ/Q&A/answer-style blocks
  namedEntityCount: number;        // detected brand/entity mentions in content
  externalLinkCount: number;
  // ChatGPT-rail additions: entity graph + claim density + noise-to-signal
  entityNameConsistency: number;   // 0-1: how consistent is entity name across title/h1/og:title
  claimCount: number;              // sentences containing factual assertions, stats, numbers
  totalSentences: number;          // total sentence count for noise-to-signal ratio
}

export interface PlatformScore {
  score: number;
  reasoning: string[];
}

export interface PlatformScores {
  chatgpt: PlatformScore;
  perplexity: PlatformScore;
  google_ai: PlatformScore;
  claude: PlatformScore;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ── Claude citation scoring ─────────────────────────────────────────────────
// Claude uses web_fetch → markdown extraction → multi-pass evaluation.
// Key: Entity clarity, answer block density, schema relationships, trust signals.
// Does NOT execute JS - server-rendered HTML only. Clean structure wins.

function scoreClaude(s: PlatformSignals): PlatformScore {
  const reasons: string[] = [];
  let score = 0;

  // Entity clarity (H1 + OG + name consistency) - weight: 20%
  let entityClarity = 0;
  if (s.h1Count === 1) { entityClarity += 40; reasons.push('Single H1 - clear entity signal'); }
  if (s.hasOgTags) { entityClarity += 30; reasons.push('OG tags reinforce entity identity'); }
  if (s.namedEntityCount >= 3) { entityClarity += 30; }
  else if (s.namedEntityCount >= 1) { entityClarity += 15; }
  score += clamp(entityClarity) * 0.20;

  // Answer block density (FAQ blocks + direct answer patterns) - weight: 18%
  let answerDensity = 0;
  if (s.hasFaqSchema) { answerDensity += 40; reasons.push('FAQPage schema - direct extraction for Claude'); }
  if (s.directAnswerDensity >= 5) { answerDensity += 35; }
  else if (s.directAnswerDensity >= 2) { answerDensity += 20; }
  if (s.h2Count >= 4 && s.h3Count >= 2) { answerDensity += 25; reasons.push('Deep heading hierarchy aids answer extraction'); }
  score += clamp(answerDensity) * 0.18;

  // Schema markup (JSON-LD completeness + relationships) - weight: 18%
  let schemaScore = 0;
  if (s.jsonLdCount >= 3 && s.hasOrgSchema) { schemaScore += 60; reasons.push('Rich JSON-LD graph with Organization'); }
  else if (s.jsonLdCount >= 1) { schemaScore += 25; }
  if (s.hasFaqSchema) { schemaScore += 20; }
  if (s.schemaTypeCount >= 5) { schemaScore += 20; reasons.push('Broad schema type coverage'); }
  score += clamp(schemaScore) * 0.18;

  // Trust signals (author entity, privacy, external mentions) - weight: 15%
  let trustScore = 0;
  if (s.isHttps) { trustScore += 30; }
  if (s.hasOrgSchema) { trustScore += 30; }
  if (s.externalLinkCount >= 3) { trustScore += 20; reasons.push('External citations add trust signal'); }
  if (s.hasCanonical) { trustScore += 20; }
  score += clamp(trustScore) * 0.15;

  // Content-query alignment (heading-to-intent match, topical coverage) - weight: 15%
  let contentAlign = 0;
  if (s.wordCount >= 1200) { contentAlign += 40; }
  else if (s.wordCount >= 600) { contentAlign += 25; }
  else if (s.wordCount >= 300) { contentAlign += 10; }
  if (s.h2Count >= 4) { contentAlign += 30; }
  if (s.lexicalDiversity >= 0.40) { contentAlign += 30; reasons.push('High lexical diversity - broad topical coverage'); }
  score += clamp(contentAlign) * 0.15;

  // Noise-to-signal ratio (facts vs fluff) - weight: 7%
  let noiseSignal = 50; // baseline
  if (s.wordCount > 0 && s.lexicalDiversity >= 0.35) { noiseSignal += 25; }
  if (s.directAnswerDensity >= 3) { noiseSignal += 25; }
  score += clamp(noiseSignal) * 0.07;

  // Citation surface (external links in, named entity density, claim density) - weight: 7%
  let citationSurface = 0;
  if (s.namedEntityCount >= 5) { citationSurface += 40; }
  else if (s.namedEntityCount >= 2) { citationSurface += 20; }
  if (s.externalLinkCount >= 2) { citationSurface += 30; }
  if (s.wordCount >= 800 && s.h2Count >= 3) { citationSurface += 30; }
  score += clamp(citationSurface) * 0.07;

  return { score: clamp(score), reasoning: reasons };
}

// ── Google AIO citation scoring ─────────────────────────────────────────────
// Google AIO selects 3-5 diverse sources that together cover a query with minimum overlap.
// Key: Passage relevance, E-E-A-T, schema completeness, direct answer blocks, breadcrumbs,
// freshness, internal link graph, query-to-title match.
// Specialization wins - owning a concept gets cited even over higher-DA sites.

function scoreGoogleAI(s: PlatformSignals): PlatformScore {
  const reasons: string[] = [];
  let score = 0;

  // E-E-A-T page quality - weight: 25%
  let eeat = 0;
  if (s.hasOrgSchema) { eeat += 35; reasons.push('Organization schema signals E-E-A-T'); }
  if (s.isHttps) { eeat += 15; }
  if (s.hasCanonical) { eeat += 10; }
  if (s.externalLinkCount >= 3) { eeat += 20; }
  if (s.namedEntityCount >= 3) { eeat += 20; reasons.push('Named entities reinforce expertise signal'); }
  score += clamp(eeat) * 0.25;

  // Schema / structured data completeness - weight: 20%
  let schemaScore = 0;
  if (s.jsonLdCount >= 3 && s.hasOrgSchema && s.hasFaqSchema) { schemaScore += 70; reasons.push('Comprehensive JSON-LD for AIO extraction'); }
  else if (s.jsonLdCount >= 2 && s.hasOrgSchema) { schemaScore += 45; }
  else if (s.jsonLdCount >= 1) { schemaScore += 20; }
  if (s.hasWebsiteSchema) { schemaScore += 15; }
  if (s.schemaTypeCount >= 6) { schemaScore += 15; }
  score += clamp(schemaScore) * 0.20;

  // Direct answer blocks - weight: 18%
  let directAnswer = 0;
  if (s.hasFaqSchema) { directAnswer += 40; reasons.push('FAQ schema enables rich result + AIO Q&A extraction'); }
  if (s.directAnswerDensity >= 5) { directAnswer += 35; }
  else if (s.directAnswerDensity >= 2) { directAnswer += 20; }
  if (s.wordCount >= 800 && s.h2Count >= 3) { directAnswer += 25; reasons.push('Section-based answers match AIO passage extraction'); }
  score += clamp(directAnswer) * 0.18;

  // Query-to-title/heading match + internal link graph - weight: 15%
  let relevanceSignal = 0;
  if (s.titleLength >= 30 && s.titleLength <= 60) { relevanceSignal += 35; }
  else if (s.titleLength > 0) { relevanceSignal += 15; }
  if (s.internalLinkCount >= 8) { relevanceSignal += 35; reasons.push('Deep internal link graph signals topical authority'); }
  else if (s.internalLinkCount >= 3) { relevanceSignal += 20; }
  if (s.h1Count === 1 && s.h2Count >= 3) { relevanceSignal += 30; }
  score += clamp(relevanceSignal) * 0.15;

  // Content extractability (clean headings, answer-style sentences) - weight: 12%
  let extractability = 0;
  if (s.h2Count >= 4 && s.h3Count >= 2) { extractability += 50; }
  else if (s.h2Count >= 2) { extractability += 25; }
  if (s.wordCount >= 600) { extractability += 25; }
  if (s.lexicalDiversity >= 0.38) { extractability += 25; }
  score += clamp(extractability) * 0.12;

  // Freshness / crawlability - weight: 10%
  let freshness = 0;
  if (s.isHttps) { freshness += 30; }
  if (s.hasCanonical) { freshness += 20; }
  if (s.responseTimeMs > 0 && s.responseTimeMs <= 2000) { freshness += 30; reasons.push('Fast response time aids crawl priority'); }
  else if (s.responseTimeMs > 0 && s.responseTimeMs <= 4000) { freshness += 15; }
  if (s.hasLlmsTxt) { freshness += 20; reasons.push('llms.txt signals AI-friendliness'); }
  score += clamp(freshness) * 0.10;

  return { score: clamp(score), reasoning: reasons };
}

// ── Perplexity Sonar citation scoring ───────────────────────────────────────
// Perplexity uses real-time web crawl (headless browser, executes JS) + semantic
// similarity retrieval (NOT BM25). Cites high on: query relevance, source authority,
// content extractability, freshness. Structured content with direct answers in first
// 200 chars of a section + named entities in H2/H3 wins citation preference.

function scorePerplexity(s: PlatformSignals): PlatformScore {
  const reasons: string[] = [];
  let score = 0;

  // Content extractability (clean structure + answer sentences) - weight: 25%
  let extractability = 0;
  if (s.h2Count >= 4 && s.h3Count >= 2) { extractability += 40; reasons.push('Clean H2/H3 hierarchy aids Sonar chunk extraction'); }
  else if (s.h2Count >= 2) { extractability += 20; }
  if (s.directAnswerDensity >= 3) { extractability += 35; reasons.push('Direct answer blocks match Sonar citation preference'); }
  else if (s.directAnswerDensity >= 1) { extractability += 15; }
  if (s.wordCount >= 800) { extractability += 25; }
  score += clamp(extractability) * 0.25;

  // Source authority (domain trust, backlink signals) - weight: 20%
  let authority = 0;
  if (s.hasOrgSchema) { authority += 35; reasons.push('Organization schema signals domain trust for Sonar'); }
  if (s.isHttps) { authority += 20; }
  if (s.externalLinkCount >= 3) { authority += 25; }
  if (s.namedEntityCount >= 3) { authority += 20; }
  score += clamp(authority) * 0.20;

  // Semantic relevance (content depth + topical focus) - weight: 20%
  let relevance = 0;
  if (s.wordCount >= 1200) { relevance += 40; }
  else if (s.wordCount >= 600) { relevance += 25; }
  if (s.lexicalDiversity >= 0.40) { relevance += 30; reasons.push('Lexical diversity improves embedding similarity'); }
  if (s.h1Count === 1 && s.titleLength >= 30) { relevance += 30; }
  score += clamp(relevance) * 0.20;

  // Factual claim density over fluff - weight: 15%
  let claimDensity = 0;
  if (s.namedEntityCount >= 5) { claimDensity += 40; reasons.push('High named entity density - fact-rich for Perplexity'); }
  else if (s.namedEntityCount >= 2) { claimDensity += 20; }
  if (s.directAnswerDensity >= 3) { claimDensity += 30; }
  if (s.jsonLdCount >= 2) { claimDensity += 30; }
  score += clamp(claimDensity) * 0.15;

  // Freshness + crawlability - weight: 12%
  let freshness = 0;
  if (s.responseTimeMs > 0 && s.responseTimeMs <= 2000) { freshness += 40; reasons.push('Fast load improves Sonar crawl freshness weighting'); }
  else if (s.responseTimeMs > 0 && s.responseTimeMs <= 4000) { freshness += 20; }
  if (s.isHttps && s.hasCanonical) { freshness += 30; }
  if (s.hasLlmsTxt) { freshness += 30; }
  score += clamp(freshness) * 0.12;

  // Schema structured context - weight: 8%
  let schemaScore = 0;
  if (s.jsonLdCount >= 3) { schemaScore += 50; }
  else if (s.jsonLdCount >= 1) { schemaScore += 25; }
  if (s.hasFaqSchema) { schemaScore += 30; }
  if (s.schemaTypeCount >= 4) { schemaScore += 20; }
  score += clamp(schemaScore) * 0.08;

  return { score: clamp(score), reasoning: reasons };
}

// ── ChatGPT citation scoring ────────────────────────────────────────────────
// ChatGPT (with browsing) uses Bing index + direct fetch. Evidence-first audit:
// 1. Deterministic fetch (raw HTML, no JS illusions) → grade what AI actually sees
// 2. Entity graph reconstruction - name consistency across title/h1/og:title
// 3. Query simulation - answerability: directness, completeness, extractability
// 4. Citation probability - sigmoid(claim_density, entity_density, structural_clarity)
// 5. Hard score caps: missing H1 → cap ≤60, no entity → cap ≤50, no answers → cap ≤65
// 6. Noise-to-signal compression test: facts+claims+numbers vs total sentences

function scoreChatGPT(s: PlatformSignals): PlatformScore {
  const reasons: string[] = [];
  let score = 0;

  // 1. Entity resolution & consistency - weight: 18%
  //    From chatgpt-rail: rebuild what AI thinks the entity is.
  //    If name shifts across tags → penalty. No clear entity → major penalty.
  let entityScore = 0;
  if (s.entityNameConsistency >= 0.9) { entityScore += 45; reasons.push('Strong entity consistency across title/H1/OG'); }
  else if (s.entityNameConsistency >= 0.5) { entityScore += 20; reasons.push('Partial entity name consistency - disambiguation risk'); }
  else { reasons.push('Entity name inconsistent across title/H1/OG - ChatGPT confusion risk'); }
  if (s.hasOrgSchema) { entityScore += 30; }
  if (s.namedEntityCount >= 3) { entityScore += 25; }
  score += clamp(entityScore) * 0.18;

  // 2. Answerability - weight: 18%
  //    Direct answer blocks + extractable Q&A structure
  let answerability = 0;
  if (s.directAnswerDensity >= 5) { answerability += 40; reasons.push('High answer extractability for ChatGPT browsing'); }
  else if (s.directAnswerDensity >= 2) { answerability += 25; }
  else if (s.directAnswerDensity >= 1) { answerability += 10; }
  if (s.hasFaqSchema) { answerability += 25; }
  if (s.h2Count >= 4 && s.h3Count >= 2) { answerability += 20; reasons.push('Deep heading hierarchy aids answer extraction'); }
  if (s.wordCount >= 800) { answerability += 15; }
  score += clamp(answerability) * 0.18;

  // 3. Schema & structured data - weight: 18%
  let schemaScore = 0;
  if (s.jsonLdCount >= 3 && s.hasOrgSchema) { schemaScore += 60; reasons.push('Rich JSON-LD aids ChatGPT entity extraction'); }
  else if (s.jsonLdCount >= 1) { schemaScore += 25; }
  if (s.hasFaqSchema) { schemaScore += 20; }
  if (s.schemaTypeCount >= 5) { schemaScore += 20; }
  score += clamp(schemaScore) * 0.18;

  // 4. Citation probability - weight: 15%
  //    sigmoid(claim_density + entity_density + structural_clarity + uniqueness)
  let citationProb = 0;
  const noiseToSignal = s.totalSentences > 0 ? s.claimCount / s.totalSentences : 0;
  if (noiseToSignal >= 0.4) { citationProb += 35; reasons.push('High fact-to-fluff ratio - strong citation candidate'); }
  else if (noiseToSignal >= 0.2) { citationProb += 20; }
  if (s.namedEntityCount >= 5) { citationProb += 25; }
  else if (s.namedEntityCount >= 2) { citationProb += 15; }
  if (s.h2Count >= 3 && s.lexicalDiversity >= 0.35) { citationProb += 20; }
  if (s.externalLinkCount >= 2) { citationProb += 20; }
  score += clamp(citationProb) * 0.15;

  // 5. Meta & OG completeness - weight: 13%
  let meta = 0;
  if (s.titleLength >= 30 && s.titleLength <= 60) { meta += 35; }
  else if (s.titleLength > 0) { meta += 15; }
  if (s.hasMetaDescription && s.metaDescriptionLength >= 120) { meta += 35; reasons.push('Strong meta description aids Bing index snippet'); }
  else if (s.hasMetaDescription) { meta += 15; }
  if (s.hasOgTags) { meta += 30; }
  score += clamp(meta) * 0.13;

  // 6. Technical + AI-friendliness - weight: 10%
  let technical = 0;
  if (s.isHttps) { technical += 25; }
  if (s.hasCanonical) { technical += 15; }
  if (s.internalLinkCount >= 5) { technical += 20; }
  if (s.responseTimeMs > 0 && s.responseTimeMs <= 2000) { technical += 20; }
  if (s.hasLlmsTxt) { technical += 20; reasons.push('llms.txt signals explicit AI consumption readiness'); }
  score += clamp(technical) * 0.10;

  // 7. Noise-to-signal compression test - weight: 8%
  let signalDensity = 0;
  if (noiseToSignal >= 0.5) { signalDensity += 50; }
  else if (noiseToSignal >= 0.3) { signalDensity += 30; }
  else if (noiseToSignal >= 0.15) { signalDensity += 15; }
  if (s.imageAltCoverage >= 0.8) { signalDensity += 25; }
  if (s.lexicalDiversity >= 0.40) { signalDensity += 25; }
  score += clamp(signalDensity) * 0.08;

  // ── HARD SCORE CAPS (gated - from chatgpt-rail) ──
  // These are non-negotiable: missing fundamentals = hard ceiling.
  let cap = 100;
  if (s.h1Count === 0) {
    cap = Math.min(cap, 60);
    reasons.push('HARD CAP: Missing H1 - score capped at 60');
  }
  if (s.entityNameConsistency < 0.3) {
    cap = Math.min(cap, 50);
    reasons.push('HARD CAP: No resolvable entity - score capped at 50');
  }
  if (s.directAnswerDensity === 0) {
    cap = Math.min(cap, 65);
    reasons.push('HARD CAP: No answer blocks - score capped at 65');
  }

  return { score: Math.min(clamp(score), cap), reasoning: reasons };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute per-platform citation readiness scores based on documented platform behaviors.
 * Replaces the previous fixed-multiplier derivation with evidence-based scoring.
 */
export function computePlatformScores(signals: PlatformSignals): PlatformScores {
  return {
    chatgpt: scoreChatGPT(signals),
    perplexity: scorePerplexity(signals),
    google_ai: scoreGoogleAI(signals),
    claude: scoreClaude(signals),
  };
}

/**
 * Extract PlatformSignals from the raw scrape data, schema analysis, and content metrics.
 */
export function extractPlatformSignals(
  sd: any,
  schema: any,
  url: string,
): PlatformSignals {
  const rawHtml = String(sd.html || '');
  const bodyText = String(sd.body || '').toLowerCase();
  const rawBody = String(sd.body || '');
  const bodyWords = bodyText.split(/\s+/).filter(Boolean);

  // Count FAQ/Q&A/answer-style blocks as direct answer density
  const faqBlockCount = (schema.has_faq_schema ? 1 : 0) +
    (rawHtml.match(/<(dt|summary|details)\b/gi) || []).length +
    (bodyText.match(/\b(what is|how to|why does|when should|FAQ|Q&A|answer:)\b/gi) || []).length;

  // Count named entities (crude: capitalized multi-word sequences not at sentence start)
  const entityMatches = (sd.body || '').match(/(?<=[.!?]\s+\w+\s+)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
  const brandEntities = new Set(entityMatches.map((e: string) => e.trim()));

  const imgTags = rawHtml.match(/<img\b[^>]*>/gi) || [];
  const imgsWithAlt = imgTags.filter((tag: string) => /\balt\s*=\s*(['"])(.*?)\1/i.test(tag)).length;

  // Entity name consistency across title / H1 / og:title (chatgpt-rail Step 3)
  const nameCandidates: string[] = [
    (sd.title || '').trim().toLowerCase(),
    ((sd.headings?.h1 || [])[0] || '').trim().toLowerCase(),
    (sd.meta?.ogTitle || '').trim().toLowerCase(),
  ].filter(Boolean);
  let entityNameConsistency = 0;
  if (nameCandidates.length >= 2) {
    // Pairwise overlap: count pairs that share ≥50% words
    let matches = 0;
    let pairs = 0;
    for (let i = 0; i < nameCandidates.length; i++) {
      for (let j = i + 1; j < nameCandidates.length; j++) {
        pairs++;
        const wordsA = new Set(nameCandidates[i].split(/\s+/));
        const wordsB = new Set(nameCandidates[j].split(/\s+/));
        const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
        const minLen = Math.min(wordsA.size, wordsB.size);
        if (minLen > 0 && intersection / minLen >= 0.5) matches++;
      }
    }
    entityNameConsistency = pairs > 0 ? matches / pairs : 0;
  } else if (nameCandidates.length === 1) {
    entityNameConsistency = 0.5; // only one name source - partial confidence
  }

  // Claim / factual assertion density (chatgpt-rail Steps 2 & 7)
  const sentences = rawBody.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const claimPatterns = /\b(\d{1,3}[,.]\d|\d+\s*%|\$\d|according to|research shows|studies|data|evidence|proven|average|increase|decrease|growth|revenue|ROI|conversion|users|customers|founded in|since \d{4})\b/gi;
  const claimCount = sentences.filter(s => claimPatterns.test(s)).length;

  return {
    wordCount: sd.wordCount || 0,
    h1Count: sd.headings?.h1?.length || 0,
    h2Count: sd.headings?.h2?.length || 0,
    h3Count: sd.headings?.h3?.length || 0,
    jsonLdCount: schema.json_ld_count || 0,
    hasFaqSchema: !!schema.has_faq_schema,
    hasOrgSchema: !!schema.has_organization_schema,
    hasWebsiteSchema: Array.isArray(schema.schema_types)
      ? schema.schema_types.some((t: string) => String(t).toLowerCase() === 'website')
      : false,
    schemaTypeCount: Array.isArray(schema.schema_types) ? schema.schema_types.length : 0,
    hasMetaDescription: !!(sd.meta?.description?.trim()),
    metaDescriptionLength: sd.meta?.description?.trim().length || 0,
    titleLength: sd.title?.trim().length || 0,
    hasOgTags: !!(sd.meta?.ogTitle?.trim() || sd.meta?.ogDescription?.trim()),
    isHttps: url.startsWith('https'),
    hasCanonical: !!sd.canonical,
    internalLinkCount: sd.links?.internal || 0,
    responseTimeMs: Number(sd.pageLoadMs || sd.lcpMs || 0),
    imageAltCoverage: imgTags.length > 0 ? imgsWithAlt / imgTags.length : 1,
    hasLlmsTxt: !!(sd.llmsTxt),
    lexicalDiversity: bodyWords.length > 0 ? new Set(bodyWords).size / bodyWords.length : 0,
    directAnswerDensity: Math.min(faqBlockCount, 20),
    namedEntityCount: brandEntities.size,
    externalLinkCount: sd.links?.external || 0,
    entityNameConsistency,
    claimCount,
    totalSentences: sentences.length,
  };
}

// ── Platform-specific prompt context for AI recommendations ─────────────────

/**
 * Build a platform intelligence block to inject into the AI analysis prompt.
 * Gives the AI model context about what each platform prioritizes so
 * recommendations become platform-aware.
 */
export function buildPlatformIntelligencePromptBlock(scores: PlatformScores): string {
  const lines: string[] = [
    'PLATFORM CITATION INTELLIGENCE (use to make recommendations platform-specific):',
  ];

  const platforms: Array<{ key: keyof PlatformScores; label: string; notes: string }> = [
    {
      key: 'chatgpt',
      label: 'ChatGPT',
      notes: 'Evidence-first: grades visibility based on what AI actually fetches (raw HTML, no JS). Entity graph reconstruction required - name must be consistent across title/H1/OG or it penalizes. Hard caps: no H1 → max 60, no entity → max 50, no answer blocks → max 65. Citation probability driven by claim density and signal-to-noise ratio, not just structure.',
    },
    {
      key: 'perplexity',
      label: 'Perplexity',
      notes: 'Real-time headless crawl + semantic embedding retrieval (not BM25). Direct answers in first 200 chars of a section + named entities in H2/H3 get citation preference over longer unstructured pages. Factual claim density > fluff.',
    },
    {
      key: 'google_ai',
      label: 'Google AI Overview',
      notes: 'Selects 3-5 diverse sources with minimum overlap. E-E-A-T is critical. Page specialization on a concept wins over higher-DA generalist sites. FAQ schema enables rich result + AIO Q&A extraction.',
    },
    {
      key: 'claude',
      label: 'Claude',
      notes: 'web_fetch returns server-rendered HTML as markdown (no JS execution). Clean entity clarity (single H1 + OG + consistent naming), answer block density, and schema relationships drive citation quality. Training-time presence matters for topics known before cutoff.',
    },
  ];

  for (const p of platforms) {
    const s = scores[p.key];
    const reasonStr = s.reasoning.length > 0 ? ` Key signals: ${s.reasoning.slice(0, 3).join('; ')}.` : '';
    lines.push(`- ${p.label} readiness: ${s.score}/100.${reasonStr} ${p.notes}`);
  }

  lines.push('When writing recommendations, note which platforms would benefit most from each fix.');

  return lines.join('\n');
}
