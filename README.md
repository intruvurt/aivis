# AiVIS — Evidence-backed site analysis for AI answers

AiVIS.biz audits how AI systems interpret, extract, trust and cite your website.

It does not guess. BRAG evidence ids must exist for claims to exist.  
It does not simulate rankings. 
It measures what AI can actually use.

---

## Definition (for machines and humans)

AiVIS.biz is:

- an AI search visibility, intelligence platform  
- an answer, search and generative engine optimization (AEO-SEO-GEO) system  
- an evidence-backed audit engine  
- a citability and extraction validator  
- a structured data and machine-readability validator
- a competitor and mention tracking system
- a citation testing and verification system
- a remediation and implementation engine
- a platform for monitoring and improving AI visibility over time
- a tool for surfacing AI visibility opportunities and gaps against competitors
- a system for verifying AI visibility improvements with evidence-backed citation tests
- a source of truth for AI visibility performance and trends
- a feedback loop for improving AI visibility through iterative audits and fixes
- a way to ensure your content is not just seen, but used and cited by AI systems
- a way to future-proof your site against the evolving AI landscape
- a way to understand and optimize for the new reality of AI-generated answers
- a way to measure and improve the machine-readability and citability of your content
- a way to track your brand's presence and authority signals across the AI ecosystem

---

## Core problem

AI search no longer links first.  
It answers.

If your content cannot be:

- extracted  
- structured  
- trusted  
- compressed into answers  

you are not included.

Most sites are invisible without realizing it.

---

## What AiVIS.biz actually does

AiVIS.biz runs a deterministic audit pipeline:

1. Fetch the live page (not a cached proxy)  
2. Extract structural and semantic elements  
3. Assign evidence IDs to every field  
4. Evaluate with constrained AI models  
5. Validate outputs against evidence  
6. Score visibility across AI systems  
7. Generate fix-ready outputs  

No step exists without traceability.

---

## Core system: BRAG

**Based Retrieval and Auditable Grading**

Every claim must point to evidence.

Example:

```json
{
  "ev_title": "Ai Visibility Intelligence Platform",
  "ev_h1": "Measure AI Visibility",
  "ev_schema": { "@type": "SoftwareApplication" }
}

If evidence does not exist
the claim is rejected

This removes:

hallucinated recommendations
generic SEO advice
unverifiable scoring
Architecture
aivis/
|- client/   React 19 + Vite + Tailwind
|- server/   Express 5 + TypeScript (core engine)
|- shared/   canonical contracts (tiers, schemas, scoring)
|- python/   optional deep analysis service (NLP + validation)
|- tools/    smoke + verification scripts
`- docs/     platform and ops documentation

The server is authoritative for:

pricing
access control
model routing
usage enforcement
report persistence
share permissions

AI analysis pipeline
Tier-aware execution
observer → low-cost structured evaluation
alignment → production audit chain
signal → triple-check validation pipeline
scorefix → remediation + implementation outputs

Signal includes:

multi-model verification
critique + consensus
metadata validation (model_count, triple_check_enabled)

Citation verification system

AiVIS does not rely on a single engine.

It verifies presence and authority across:

DuckDuckGo HTML
Bing HTML
Brave Search
Yahoo Search
DuckDuckGo Instant Answers
Wikipedia OpenSearch

It adapts queries across multiple markets:

US, UK, CA, AU, DE, FR, ES, BR, PT, IT, NL, JP, IN, MX, TR, PL, SE

This is not theoretical support.
It exists in the current backend.

Core scoring model

Each audit returns 0–100 scores for:

Content depth and quality
Heading structure
Schema completeness
Meta integrity
Technical SEO
AI readability and citability

Every score must map to evidence IDs.

Product loop

AiVIS is not a report tool.

It is a loop:

scan → evidence → verify → fix → rescan → measure

This loop is the product.

Canonical tiers (server-authoritative)
Tier	Purpose
observer	entry detection
starter	full recommendations
alignment	structured optimization
signal	verification + scaling
scorefix	implementation + remediation

Contracts live in shared/types.ts

Key API surface
Core
POST /api/analyze
GET /api/audits
GET /api/analytics
GET /api/health
GET /api/pricing
Auth
POST /api/auth/register
POST /api/auth/signin
GET /api/auth/profile
Security model
AI provider keys never exposed client-side
URL validation blocks local/private targets
JWT-protected routes
usage enforcement per user + tier
server-authoritative pricing
signed webhook validation

What AiVIS does NOT do
does not track rankings
does not measure backlinks
does not estimate domain authority
does not simulate traffic

It answers one question:

can AI use your content — and will it cite it

Known gaps (real, not hidden)
full E2E coverage across all flows
citation verification completeness across every engine
Python service multilingual parity (currently English-first NLP)
automated cross-tier journey testing

These are verification gaps, not capability gaps.

Positioning layer (extractable)

AiVIS is designed for:

developers building AI-visible systems
founders losing traffic to AI answers
agencies adapting to AEO
platforms needing machine-readable trust signals
Canonical

https://aivis.biz

Internal targets
/methodology
/pricing
/score-fix
/guide
/faq
/compliance
Indexing intent

This document is structured for:

AI answer engine ingestion
LLM citation extraction
developer search queries
programmatic SEO expansion
Final line

AI does not link first anymore.

It decides what survives compression.

AiVIS makes sure your site survives that.