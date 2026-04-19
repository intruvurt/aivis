# Integration Guide: Enterprise Audit Engine → API Endpoints

## Overview

The enterprise audit engine is ready for API integration. This guide shows how to wrap existing analysis responses with the deterministic audit structure.

## Quick Start

### 1. Use in Analyze Endpoint

**File:** `server/src/controllers/auditController.ts`

```typescript
import { buildEnterpriseAudit } from "../services/enterpriseAuditEngine.js";
import { callAIProvider } from "../services/aiProviders.js";
import type { CanonicalTier } from "../../../shared/types.js";

async function handleAnalyze(req: AuthRequest, res: Response) {
  const tier: CanonicalTier = req.user.tier;
  const url = req.body.url;

  // Step 1: Run existing AI analysis
  const analysis = await callAIProvider(url, {
    tier,
    // ... existing options
  });

  // Step 2: Wrap with enterprise audit engine
  const audit = await buildEnterpriseAudit(analysis, tier);

  // Step 3: Return new structure
  res.json({
    success: true,
    result: audit, // This is EnterpriseAuditResponse
  });
}
```

### 2. Backward Compatibility

If you need to maintain old response format during transition:

```typescript
async function handleAnalyze(req: AuthRequest, res: Response) {
  const analysis = await callAIProvider(url, { tier });
  const audit = await buildEnterpriseAudit(analysis, tier);

  // Option A: Return audit (new clients)
  if (req.headers["accept-version"]?.includes("enterprise")) {
    res.json({ success: true, result: audit });
    return;
  }

  // Option B: Return legacy format (old clients)
  res.json(analysis);
}
```

## Schema Mapping Reference

### From `AnalysisResponse` Fields → Audit Response Fields

```typescript
// Identity
analysis.url                                 → audit.target_url
analysis.page_title                          → audit.entity.name ✓ Evidence: E1
analysis.entity_name                         → audit.entity.name ✓ (if not page_title)

// Core Scoring
analysis.visibility_score                    → audit.visibility_score.overall
analysis.category_scores.entity_clarity      → audit.dimensions.entity_resolution.score
analysis.category_scores.indexation          → audit.dimensions.indexation.score
analysis.category_scores.consistency         → audit.dimensions.semantic_consistency.score
analysis.category_scores.citation_readiness  → audit.dimensions.citation_likelihood.score
analysis.category_scores.trust_signals       → audit.dimensions.trust_vectors.score

// Data
analysis.has_json_ld                         → audit.dimensions.structured_data.present
analysis.schema_types                        → audit.dimensions.structured_data.types
analysis.indexed_surfaces                    → audit.dimensions.indexation.indexed_surfaces
analysis.mentioned_in                        → audit.dimensions.distributed_signals.channels
analysis.trust_signals                       → audit.dimensions.trust_vectors.signals

// Findings
analysis.critical_findings                   → audit.critical_failures
analysis.recommendations                     → audit.recommended_actions

// Metadata
new Date().toISOString()                      → audit.scanned_at
tier                                          → audit.tier_applied
```

## Evidence Ledger Best Practices

### Adding Evidence During Engine Build

```typescript
const builder = new EnterpriseAuditBuilder(url, tier);

// Add evidence
const e1 = builder.addEvidence(
  "html",
  url,
  `<title>${analysis.page_title}</title>`,
  0.95, // High confidence for HTML extraction
);

const e2 = builder.addEvidence(
  "schema",
  url,
  "JSON-LD markup detected with Organization type",
  0.9, // High confidence for valid schema
);

const e3 = builder.addEvidence(
  "serp",
  "https://www.google.com/search?q=...",
  "Domain ranked #2 for primary keyword",
  0.75, // Medium confidence for SERP data (24h freshness)
);

// Evidence IDs are automatically generated (E1, E2, E3)
```

### Confidence Levels by Type

```typescript
// Ground truth (take as-is)
'html'       → 0.90-1.0
'schema'     → 0.85-0.95

// Indexed/cached data (assume 24h freshness)
'serp'       → 0.75-0.85
'mention'    → 0.60-0.80

// LLM reasoning (lower confidence)
'inference'  → 0.30-0.70
```

## Handling Entity Collisions

### Detect & Flag

```typescript
const builder = new EnterpriseAuditBuilder(url, tier);

// During analysis, check for collisions
if (analysis.entity_collisions?.length > 0) {
  analysis.entity_collisions.forEach((collision) => {
    builder.addEvidence(
      "inference",
      url,
      `Potential collision detected: ${collision.conflicting_entity}`,
      0.5, // Lower confidence for inference
    );
  });
}

const audit = builder.build(analysis);
// audit.entity_collisions will contain all detected collisions
```

### Collision Risk Levels

```typescript
const collision = {
  conflicting_entity: "chat.com", // e.g., ChatGPT vs. your "Chat" product
  overlap_reason: "Exact name match",
  risk_level: "high" as const,
  evidence_ids: ["E5", "E6"], // References to evidence
};

// High risk → recommend schema.org disambiguation
// Medium risk → add description to clarify
// Low risk → informational only
```

## Tier-Based Scoring

### Evidence Inclusion by Tier

```typescript
// Observer: Minimal evidence (E1-E5 only, high-confidence only)
if (tier === "observer") {
  const filteredEvidence = audit.evidence.filter(
    (e) => e.confidence >= 0.85 && audit.evidence.indexOf(e) < 5,
  );
  audit.evidence = filteredEvidence;
}

// Starter+: Full evidence ledger
// Alignment+: Evidence + collision detection
// Signal+: Evidence + triple-check consensus + collision details
```

### Dimension Visibility by Tier

```typescript
// Observer: All 8 dimensions visible but minimal details
const dimensionsByTier = {
  observer: [
    "entity_resolution",
    "indexation",
    "semantic_consistency",
    "citation_likelihood",
    "structured_data",
    "distributed_signals",
    "ai_parsability",
    "trust_vectors",
  ], // All visible
  starter: [
    /* All + full evidence */
  ],
  alignment: [
    /* All + competitor comparison */
  ],
  signal: [
    /* All + triple-check scoring */
  ],
};
```

## Testing Integration

### Unit Test Template

```typescript
import { buildEnterpriseAudit } from "../services/enterpriseAuditEngine";
import type { AnalysisResponse } from "../types/analysis";

describe("Enterprise Audit Engine Integration", () => {
  it("should map analysis to audit response", async () => {
    const mockAnalysis: AnalysisResponse = {
      url: "https://example.com",
      page_title: "Example Corp",
      entity_name: "Example Corp",
      visibility_score: 75,
      category_scores: {
        entity_clarity: 80,
        indexation: 70,
        consistency: 85,
        citation_readiness: 75,
        trust_signals: 70,
      },
      has_json_ld: true,
      schema_types: ["Organization", "WebSite"],
      indexed_surfaces: ["google", "bing", "reddit"],
      mentioned_in: ["reddit", "hn"],
      // ... other fields
    };

    const audit = await buildEnterpriseAudit(mockAnalysis, "starter");

    expect(audit.entity.name).toBe("Example Corp");
    expect(audit.visibility_score.overall).toBe(0.75);
    expect(audit.dimensions.structured_data.present).toBe(true);
    expect(audit.evidence.length).toBeGreaterThan(0);
    expect(audit.tier_applied).toBe("starter");
  });

  it("should generate evidence IDs correctly", async () => {
    const audit = await buildEnterpriseAudit(mockAnalysis, "observer");

    const evidenceIds = audit.evidence.map((e) => e.evidence_id);
    expect(evidenceIds).toEqual(expect.arrayContaining(["E1", "E2", "E3"]));
  });

  it("should calculate median confidence", async () => {
    const audit = await buildEnterpriseAudit(mockAnalysis, "starter");

    expect(audit.confidence_median).toBeLessThanOrEqual(1.0);
    expect(audit.confidence_median).toBeGreaterThanOrEqual(0.0);
  });
});
```

## API Response Example

### Full Audit Response (Display Format)

```json
{
  "target_url": "https://example.com",
  "scanned_at": "2026-04-14T10:30:00Z",
  "execution_class": "LIVE",
  "entity": {
    "name": "Example Corp",
    "canonical_url": "https://example.com",
    "resolved": true,
    "confidence": 0.95,
    "evidence_ids": ["E1"]
  },
  "entity_collisions": [],
  "visibility_score": {
    "overall": 0.75,
    "breakdown": {
      "entity": 0.8,
      "indexation": 0.7,
      "consistency": 0.85,
      "citation": 0.75,
      "trust": 0.7
    }
  },
  "dimensions": {
    "entity_resolution": {
      "name": "Entity Resolution",
      "score": 0.8,
      "status": "pass",
      "findings": ["Entity clearly resolved as Example Corp"],
      "evidence_ids": ["E1", "E2"]
    },
    "indexation": {
      "name": "Indexation Footprint",
      "score": 0.7,
      "status": "warning",
      "findings": ["Indexed on 3 major surfaces (Google, Bing, Reddit)"],
      "evidence_ids": ["E3"]
    }
    // ... 6 more dimensions
  },
  "critical_failures": [
    {
      "issue": "No trusted citations found",
      "impact": "blocking",
      "evidence_ids": ["E8"]
    }
  ],
  "recommended_actions": [
    {
      "action": "Add schema.org Organization markup",
      "expected_effect": "Improve entity clarity and citation likelihood",
      "priority": "high",
      "evidence_ids": ["E3", "E4"]
    }
  ],
  "evidence": [
    {
      "evidence_id": "E1",
      "type": "html",
      "source": "https://example.com",
      "extract": "<title>Example Corp</title>",
      "confidence": 0.95
    },
    {
      "evidence_id": "E2",
      "type": "schema",
      "source": "https://example.com",
      "extract": "@type: Organization",
      "confidence": 0.9
    }
    // ... more evidence
  ],
  "evidence_count": 12,
  "confidence_median": 0.85,
  "tier_applied": "starter"
}
```

## Monitoring & Observability

### Log Template

```typescript
import logger from "../services/logger";

try {
  const audit = await buildEnterpriseAudit(analysis, tier);

  logger.info("Enterprise audit generated", {
    url,
    tier,
    overall_score: audit.visibility_score.overall,
    evidence_count: audit.evidence_count,
    confidence_median: audit.confidence_median,
    critical_failures: audit.critical_failures.length,
    execution_time_ms: Date.now() - startTime,
  });

  return audit;
} catch (error) {
  logger.error("Enterprise audit generation failed", {
    url,
    tier,
    error: error.message,
  });
  throw error;
}
```

### Metrics to Track

- **Audit latency:** Time to generate per tier
- **Evidence coverage:** Average evidence count by tier
- **Collision detection rate:** How often collisions are flagged
- **Confidence distribution:** Median/mean confidence by dimension
- **Critical failure rate:** % of audits with blocking issues

## Troubleshooting

### Issue: Low confidence scores

**Solution:** Check evidence type distribution. If too much `inference` type (0.3-0.7 confidence), add more `html`/`schema` evidence (0.85-1.0).

### Issue: Missing entity name

**Solution:** Fallback logic: page_title → entity_name from schema → domain name

### Issue: Collision detection not triggering

**Solution:** Review `EntityCollision` logic in builder. May need to seed with analysis.entity_collisions data.

### Issue: Evidence count mismatch

**Solution:** Some tier configs filter evidence. Check if tier-specific filtering is active.

## Next: API Endpoints

With integration complete, create new routes:

- `GET /api/audits/:id` — Retrieve specific audit
- `POST /api/audits/export` — Export as JSON/PDF
- `GET /api/audits/public/:shareToken` — Public audit view
- `GET /api/audits/compare` — Compare two audits (A/B)

All endpoints should return `EnterpriseAuditResponse` structure.
