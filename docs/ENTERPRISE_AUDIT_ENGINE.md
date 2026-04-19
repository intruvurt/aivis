# Enterprise Audit Engine — Evidence-Bound AI Visibility Scoring

## Overview

The Enterprise Audit Engine is the **core competitive moat** of AiVIS. It transforms surface-level analysis into deterministic, evidence-bound findings that LLMs can extract, trust, and cite.

**Key Innovation:** Every claim links to an evidence ID (E1, E2, ...) with source, extraction, and confidence level. Same input always produces same output (deterministic proof).

## Architecture

### Core Files

- **`server/src/services/enterpriseAuditEngine.ts`** — Main scoring engine
- **`shared/types/auditOutput.ts`** — Output contract (client + server)

### Execution Class

```typescript
type ExecutionClass =
  | "LIVE"
  | "DETERMINISTIC_FALLBACK"
  | "SCRAPE_ONLY"
  | "UPLOAD";
```

- `LIVE`: Full multi-model AI analysis (Signal tier)
- `DETERMINISTIC_FALLBACK`: Single-model fallback (Alignment+)
- `SCRAPE_ONLY`: Structural analysis without AI (Starter+)
- `UPLOAD`: Manual site submission (Observer+)

## 8 Audit Dimensions

### 1. **Entity Resolution**

- **Question:** Does the system resolve this site as a distinct, identifiable entity?
- **Scoring:**
  - ✅ Entity name clearly defined: 0.90-1.0
  - ⚠️ Entity name inferred or multiple variants: 0.50-0.89
  - ❌ Entity unresolvable or ambiguous: 0.0-0.49
- **Evidence:** Title tags, schema.org markup, Open Graph tags, domain WHOIS

### 2. **Indexation Footprint**

- **Question:** What surfaces is this site indexed on? How frequently crawled?
- **Scoring:**
  - ✅ Indexed on 4+ surfaces (Google, Bing, specialty indices): 0.85-1.0
  - ⚠️ Indexed on 2-3 surfaces: 0.50-0.84
  - ❌ Found on 0-1 surface: 0.0-0.49
- **Evidence:** Search console data, Robots.txt compliance, Sitemap coverage
- **Related:** Crawl frequency, blocking signals (noindex, robots.txt)

### 3. **Semantic Consistency**

- **Question:** Does the entity maintain consistent meaning across surfaces?
- **Scoring:**
  - ✅ Name, description, purpose aligned across all surfaces: 0.90-1.0
  - ⚠️ Minor drift (e.g., title vs. meta description): 0.60-0.89
  - ❌ Major collision (e.g., name vs. category mismatch): 0.0-0.59
- **Evidence:** HTML meta, Open Graph, schema.org, social profiles
- **Drift Signals:**
  - Name variants (Inc. vs. inc vs. Inc)
  - Description length mismatch
  - Purpose misalignment (B2B vs. B2C claim)

### 4. **Citation Likelihood**

- **Question:** How likely is this site to be cited by LLMs in answers?
- **Scoring:**
  - ✅ High-authority source with clear topical relevance: 0.85-1.0
  - ⚠️ Topically relevant but lower authority: 0.50-0.84
  - ❌ Niche/low-authority source: 0.0-0.49
- **Evidence:**
  - Domain age + reputation
  - Schema.org Publisher markup
  - Outbound link quality
  - Citation velocity (mentions over time)
- **Blocking Factors:**
  - No contact info / legal footer
  - Suspicious TLD (.xyz, freeweb, etc.)
  - High bounce rate signals
  - Paywall / login requirement

### 5. **Structured Data Completeness**

- **Question:** Does the site use schema.org + JSON-LD to explain itself?
- **Scoring:**
  - ✅ Multiple schema types (Organization, Article, FAQPage, Product): 0.85-1.0
  - ⚠️ One-two schema types present: 0.50-0.84
  - ❌ No schema or broken markup: 0.0-0.49
- **Evidence:**
  - JSON-LD validity (Google Structured Data Tester)
  - RDFa or Microdata presence
  - OpenGraph tag count
  - Schema.org type hierarchy
- **Quality Signals:**
  - All required properties populated
  - No validation errors
  - Schema.org '@context' version modern

### 6. **Distributed Signals**

- **Question:** Is this site mentioned, linked, and reinforced across multiple channels?
- **Scoring:**
  - ✅ Consistent mention on 5+ trusted channels (Reddit, HN, Dev.to, etc.): 0.85-1.0
  - ⚠️ Mentioned on 2-4 channels: 0.50-0.84
  - ❌ Mentioned on 0-1 channel or all one-off: 0.0-0.49
- **Evidence:** Aggregated from mention scanner (17 channels)
  - Reddit upvotes + comments
  - Hacker News points + rank
  - Directory listings (Product Hunt, Indie Hackers)
  - Social shares + engagement
  - GitHub stars (if applicable)
- **Reinforcement Scoring:** Mention consistency normalized by channel popularity

### 7. **AI Parsability**

- **Question:** How easily can LLMs extract what, who, when, and relevance from this site?
- **Scoring:**
  - ✅ Clear definition + authority + use case in CTF (above-fold): 0.85-1.0
  - ⚠️ Extractable but requires inference: 0.50-0.84
  - ❌ Ambiguous or hidden: 0.0-0.49
- **Evidence:**
  - H1 clarity score (word count, synonym matching)
  - Value proposition in first 150 words
  - Entity definition in schema / meta description
  - Readability score (Flesch-Kincaid)
- **Ambiguity Flags:**
  - Meta description placeholder text
  - H1 exactly matches generic keywords (bad)
  - No "About" section reachable in 2 clicks

### 8. **Trust Vectors**

- **Question:** What signals make this site trustworthy to cite?
- **Scoring:**
  - ✅ Multiple trust signals (legal footer, privacy policy, SSL, author bio): 0.85-1.0
  - ⚠️ Some trust signals present: 0.50-0.84
  - ❌ Minimal or contradictory signals: 0.0-0.49
- **Evidence:**
  - Legal footer (Copyright, Privacy, Terms)
  - Author bio / About page
  - SSL certificate age
  - Domain registration age
  - Content freshness (last updated)
  - Fact-check citations (external links)

## Evidence Model

Every finding is traced to evidence:

```typescript
interface Evidence {
  evidence_id: string; // E1, E2, E3, ...
  type: "html" | "schema" | "serp" | "mention" | "social" | "inference";
  source: string; // URL or channel
  extract: string; // Exact snippet
  confidence: number; // 0.0-1.0
}
```

### Evidence Types

| Type        | Source           | Confidence Range | Example                                |
| ----------- | ---------------- | ---------------- | -------------------------------------- |
| `html`      | HTML parsing     | 0.8-1.0          | `<title>`, `<meta name="description">` |
| `schema`    | JSON-LD / RDFa   | 0.85-1.0         | `@type: "Organization"`                |
| `serp`      | SERP result      | 0.7-0.9          | Google snippet, featured snippet       |
| `mention`   | Reddit, HN, etc. | 0.6-0.85         | Post title, comment vote count         |
| `social`    | Social media     | 0.5-0.8          | Tweet engagement, profile info         |
| `inference` | LLM reasoning    | 0.3-0.7          | "Likely enterprise based on features"  |

### Confidence Scoring

- **HTML extraction (title, canonical, robots):** 0.95-1.0 (ground truth)
- **Schema markup (valid JSON-LD):** 0.90-0.95 (machine-readable)
- **SERP/Bing data:** 0.75-0.85 (cached, 24h freshness)
- **Social mentions:** 0.60-0.80 (proxy signals)
- **LLM inference:** 0.30-0.70 (reasoning confidence)

## Collision Detection

The engine aggressively flags entity collisions:

```typescript
interface EntityCollision {
  conflicting_entity: string;
  overlap_reason: string;
  risk_level: "low" | "medium" | "high";
  evidence_ids: string[];
}
```

### Collision Scenarios

| Scenario                                        | Risk     | Action                                  |
| ----------------------------------------------- | -------- | --------------------------------------- |
| Domain registered today + claims "enterprise"   | `high`   | Flag; confidence degraded 0.5x          |
| Site.com vs. site-app.com with same entity name | `high`   | Recommend canonical resolution          |
| Product name matches common word (e.g., "Chat") | `medium` | Add disambiguation to H1 + schema       |
| Multiple Twitter accounts under same brand      | `low`    | List all; user confirmation recommended |

## Composite Visibility Score

```
overall_score =
  0.20 × entity +
  0.25 × indexation +
  0.15 × consistency +
  0.30 × citation +
  0.20 × trust
```

### Category Labels

| Score Range | Category     | Interpretation                              |
| ----------- | ------------ | ------------------------------------------- |
| 0-20        | `invisible`  | Site not findable by AI systems             |
| 21-40       | `minimal`    | Indexed but low citation likelihood         |
| 41-60       | `found`      | Present on major surfaces, moderate signals |
| 61-80       | `recognized` | Well-indexed, good citation signals         |
| 81-100      | `prominent`  | Authoritative, high citation likelihood     |

## Integration with Existing Analysis

### From `AnalysisResponse` → `EnterpriseAuditResponse`

```typescript
async function buildEnterpriseAudit(
  analysis: AnalysisResponse,
  tier: CanonicalTier = "observer",
): Promise<EnterpriseAuditResponse>;
```

**Mapping:**

```typescript
analysis.visibility_score                    → audit.overall_score
analysis.category_scores.*                   → audit.dimensions.*.score
analysis.page_title                          → evidence (E1)
analysis.has_json_ld                         → audit.dimensions.structured_data
analysis.schema_types                        → evidence (E*)
analysis.indexed_surfaces                    → audit.dimensions.indexation
analysis.mentioned_in                        → audit.dimensions.distributed_signals
analysis.entity_name                         → audit.entity.name
analysis.critical_findings                   → audit.critical_failures
analysis.recommendations                     → audit.recommended_actions
```

## API Response Format

```typescript
interface EnterpriseAuditResponse {
  target_url: string;
  scanned_at: string; // ISO 8601
  execution_class: ExecutionClass;

  // Entity & Collision Detection
  entity: EntityResolution;
  entity_collisions: EntityCollision[];

  // 8 Dimensions + Composite Score
  indexation: Indexation;
  semantic_consistency: SemanticConsistency;
  citation_likelihood: CitationLikelihood;
  structured_data: StructuredDataAudit;
  distributed_signals: DistributedSignals;
  ai_parsability: AIParsability;
  trust_vectors: TrustVectors;

  visibility_score: {
    overall: number; // 0.0-1.0
    breakdown: VisibilityScoreBreakdown; // Per-dimension
  };

  // Findings & Actions
  critical_failures: CriticalFailure[];
  recommended_actions: RecommendedAction[];

  // Evidence Ledger (CITE LEDGER compatible)
  evidence: Evidence[];
  evidence_count: number;
  confidence_median: number;

  // Tier Applied
  tier_applied: CanonicalTier;
}
```

## Deterministic Hash (CITE LEDGER)

For audit trail immutability, each response includes:

```typescript
metadata_hash = SHA256(
  JSON.stringify({
    target_url,
    visibility_score: overall,
    evidence_count,
    tier_applied,
    timestamp,
  }),
);
```

This enables:

- ✅ Reproducible audits (same input = same hash)
- ✅ Audit trail validation (proof of measurement)
- ✅ PR remediation tracking (before/after hashes)

## Tier-Based Output

| Tier          | Features                                                              |
| ------------- | --------------------------------------------------------------------- |
| **Observer**  | 3 all dimensions visible; 1-2 key evidence per dimension              |
| **Starter**   | All dimensions + full evidence; recommendations included              |
| **Alignment** | Observer + competitor comparison dimension; collision detection       |
| **Signal**    | Full enterprise audit + triple-check consensus + LLM-specific scoring |
| **ScoreFix**  | Deterministic remediation audit + PR generation capability            |

## Usage Examples

### Basic Audit

```typescript
import { buildEnterpriseAudit } from "./services/enterpriseAuditEngine";
import { callAIProvider } from "./services/aiProviders";

const analysis = await callAIProvider("https://example.com", "starter");
const audit = await buildEnterpriseAudit(analysis, "starter");

console.log(`${audit.visibility_score.overall * 100} / 100`);
// → "75 / 100"

console.log(audit.entity);
// → { name: "Example Corp", resolved: true, confidence: 0.95, ... }

console.log(audit.critical_failures);
// → [{ issue: "Low citation readiness", evidence_ids: ['E3', 'E4'], ... }]
```

### Evidence-Linked Recommendation

```typescript
audit.recommended_actions.forEach((rec) => {
  console.log(`${rec.action}`);
  console.log(
    `Evidence: ${rec.evidence_ids
      .map((id) => audit.evidence.find((e) => e.evidence_id === id)?.extract)
      .join("; ")}`,
  );
});

// Output:
// → Add schema.org Organization markup
// → Evidence: Detected HTML-only, no JSON-LD; Competitor has @type: Organization
```

### Export for External API

```typescript
const response = {
  success: true,
  result: audit,
  // ...
};

// Clients can verify via: evidence array + confidence median
// LLMs can cite each dimension with E* references
// Dashboards can render 8-dimension breakdown
```

## Performance Notes

- **Evidence Ledger Size:** ~2-5KB per audit (E1-E30 typical)
- **Scoring Latency:** 200-500ms (deterministic algo, no additional API calls)
- **Storage:** ~500 bytes median per audit in `analysis_cache`

## Future Enhancements

1. **Collision Detection v2.0** — Fuzzy entity matching (Levenshtein distance for name drift)
2. **Model-Specific Scoring** — ChatGPT vs. Claude vs. Perplexity scoring profiles
3. **Temporal Scoring** — Signals weighted by recency (fresh site rank differently)
4. **Competitor Scoring** — Relative positioning within niche context
5. **Citation Verification** — Decode actual LLM citations and backtrack to audit dimensions
