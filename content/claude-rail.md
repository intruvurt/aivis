// Step 1: web_fetch tool - HTTP GET via Anthropic's proxy
// Returns: HTML stripped to markdown, title, meta, content blocks
// Limit: ~8,000-16,000 tokens of extracted text
// Does NOT execute JS - you get server-rendered HTML only

// Step 2: In-context analysis against training priors
// I cross-reference fetched content against:
//   - Schema.org vocabulary (training corpus)
//   - Known SEO/AEO patterns
//   - Competitor signal patterns from training data

// Step 3: Structured scoring
// I run a multi-pass evaluation:
const dimensions = {
  entityClarity:     extractH1() + extractOG() + detectNameConsistency(),
  answerBlockDensity: countFAQBlocks() + measureDirectAnswerPatterns(),
  schemaMarkup:      detectJSONLD() + validateRelationships(),
  trustSignals:      checkAuthorEntity() + checkPrivacyTerms() + checkExternalMentions(),
  contentQueryAlign: matchHeadingsToIntent() + checkTopicalCoverage(),
  noiseToSignal:     ratioFluffToFacts(),
  citationSurface:   externalLinksIn + namedEntityDensity + claimDensity
}