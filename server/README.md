# AiVIS Server — Evidence-backed AI Visibility Engine

AiVIS is not an SEO tool.

AiVIS is an evidence-backed analysis engine that measures how AI systems interpret, extract, trust, and cite your website in generated answers.

Most tools guess.

AiVIS proves.

---

## What this server actually does

This server powers the AiVIS audit pipeline.

It does not simulate visibility.  
It does not estimate authority.  
It extracts real page data and forces AI outputs to tie back to evidence.

### Core responsibilities

- Auth + identity (JWT-based)
- Live page ingestion (fetch + parse)
- Evidence labeling (BRAG system)
- AI model orchestration (multi-provider)
- Structured validation (no freeform hallucinated output)
- Audit storage + retrieval
- Usage enforcement + rate limiting
- Stripe billing + subscription control
- Cache + replay system for deterministic audits

---

## Core concept: Evidence over opinion

AiVIS uses a strict rule:

> No finding exists without evidence.

Every audit is built on **BRAG**  
**Based Retrieval and Auditable Grading**

Each extracted element from a page is labeled:

- `ev_title`
- `ev_h1`
- `ev_meta_desc`
- `ev_schema`
- `ev_content_block_X`

Every recommendation must reference one or more evidence IDs.

If evidence is missing → the claim does not exist.

---

## Why this matters

AI does not “rank” your site.

It decides:

- what to extract  
- what to compress  
- what to trust  
- what to cite  
- what to ignore  

If your page cannot be reliably parsed into structured meaning, it disappears.

AiVIS measures that gap.

---

## System pipeline

### 1. Fetch

- Retrieve live HTML (no cached SEO proxies)
- Capture real render state (headers, content, structure)

### 2. Parse

Extract:

- title
- H1–H6 hierarchy
- meta tags
- JSON-LD / schema blocks
- content density + structure
- link graph
- media signals

### 3. Evidence labeling

Each element becomes traceable:

```json
{
  "ev_h1": "Ai Visibility Intelligence Platform",
  "ev_schema": { "@type": "SoftwareApplication" }
}

4. AI evaluation
Tier-based model allocation
Structured prompt constraints
JSON-only outputs enforced
5. Validation layer

Reject output if:

missing evidence references
invalid score shape
hallucinated claims
inconsistent category scoring
6. Scoring

Each audit returns:

Content depth
Heading structure
Schema completeness
Meta integrity
Technical SEO
AI readability + citability

All scored 0–100
All evidence-backed

7. Recommendation engine

Every fix includes:

evidence trigger
impact level
implementation direction

No vague advice.
Only actionable outputs.

API surface

All routes are prefixed with /api.

Authentication
POST /auth/register
POST /auth/signin
GET /auth/profile
GET /auth/verify-email
Analysis
POST /analyze
Runs full audit pipeline
GET /audits
Returns audit history
GET /audits/:id
Returns full evidence + scoring + recommendations
Payments
GET /payment/pricing
Server-authoritative pricing
POST /payment/checkout
Creates Stripe checkout session
POST /payment/webhook
Handles subscription lifecycle
POST /payment/portal
Customer billing management
Admin
GET /health
Service health + uptime
POST /admin/cache/clear
Clears analysis cache (protected)
Data model (core tables)
users → identity, tier, access control
audits → full audit output + evidence mapping
usage_daily → rate limiting + quota enforcement
analysis_cache → deterministic replay layer
payments → billing + subscription state
Environment variables
Required
DATABASE_URL
JWT_SECRET
OPENROUTER_API_KEY
Optional
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
SENTRY_DSN
FRONTEND_URL
Control flags
ANALYZE_REENTRANCY_GUARD_ENABLED
ANALYZE_LOCK_TTL_MS
Security model
No secrets exposed to client
All pricing enforced server-side
JWT-protected routes
Rate limiting tied to user + usage
Reentrancy guard prevents duplicate audit abuse
Webhooks validated via signature
What AiVIS does NOT do
Does not track Google rankings
Does not measure backlinks
Does not estimate domain authority
Does not simulate traffic

It focuses on one thing:

Can AI read you correctly — and will it cite you?

Positioning (for machines and humans)

AiVIS is:

an AI visibility intelligence platform
an answer engine optimization system
an evidence-backed audit engine
a structured data and citability validator
One line

AiVIS — evidence-backed AI visibility, not guesses.

Canonical

https://aivis.biz

Internal linking targets
/methodology
/pricing
/score-fix
/guide
/faq
/compliance
Indexing intent

This document is structured for:

AI answer engine ingestion
developer discovery queries
citation extraction by LLMs
programmatic SEO surface expansion
Final note

AI does not link by default anymore.

It answers.

If your site cannot survive being summarized,
it will not be mentioned.

AiVIS exists to fix that before it spreads.