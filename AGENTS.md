## Repository mission

This repository is an **evidence-based AI visibility engine**.

It determines whether entities (brands, domains, topics) appear inside AI-generated answers by producing and storing verifiable citation evidence.

The system is not an analytics dashboard.

It is a **deterministic pipeline that produces and persists visibility truth**.

---

## Core system model

All behavior in this repo must map to this pipeline:

INPUT
→ URL + optional entity seed

EXTRACTION
→ structured entity graph

QUERY GENERATION
→ intent + comparative + AI-style queries

EXECUTION
→ parallel search + AI model evaluation

LEDGER
→ immutable citation records per query result

REGISTRY
→ aggregated visibility + authority + coverage metrics

INSIGHTS
→ gaps, displacement, missing presence

ACTIONS
→ structured remediation outputs tied to evidence

---

## Execution pipeline (canonical order)

Every `/api/analyze` invocation MUST traverse these stages in order.
Stages 5–6 run concurrently (fork/join). Stages 7–8 are strictly sequential and immutable.

### 1. INPUT VALIDATION

- `sanitizeInput()` — strip dangerous characters from all user-supplied fields
- `isSafeExternalUrl()` — block private/localhost IPs, reject non-http(s) schemes
- Zod schema validation — reject malformed payloads before any DB or AI call

### 2. AUTHENTICATION

- `authRequired` middleware — validate JWT, enforce email verification
- Resolve user identity + canonical tier from `users` table

### 3. USAGE ENFORCEMENT

- `usageGate` — check monthly scan count against `TIER_LIMITS[tier].scansPerMonth`
- `incrementUsage` — pre-execution lock written to `usage_daily` before scan begins

### 4. ENTITY EXTRACTION

- `scraper.ts` (Puppeteer) — fetch and parse target URL
- Build structured entity graph from page content (brand, product, topic signals)

### 5. PARALLEL SIGNAL LAYER _(fork — all run concurrently)_

- **citationTester** — CORE TRUTH ENGINE; queries AI models and records citation presence
- **webSearch** — DDG + Bing HTML scrape for external validation
- **duckDuckGoSearch** — instant answer graph extraction
- **aiProviders** — multi-model inference via `callAIProvider()` (tier-allocated models)
- **mentionTracker** — 19 free external sources (Reddit, HN, GitHub, etc.)
- **serpService** — SerpAPI SERP signals _(Alignment+ only; skipped for observer/starter)_

### 6. CITATION RESOLUTION GATE _(join)_

- Every AI claim MUST be:
  - (a) citation-backed — matched to a real web result or SERP signal, OR
  - (b) labeled `"uncited"` — surfaced as a gap
- Uncited claims are downgraded in score and flagged in the ledger

### 7. LEDGER COMMIT _(immutable)_

- Write citation records to `citation_ledger` with `scan_id` foreign key
- Hash-lock result — no post-write mutation permitted
- Assigns stable `scan_id` used as traceability root for all downstream outputs

### 8. REGISTRY DERIVATION _(read-only)_

- Compute `visibility_registry` aggregates ONLY from committed ledger rows
- No external input may mutate registry values
- Derived metrics: visibility score, authority score, entity clarity, query coverage

### 9. RESPONSE ASSEMBLY

- Assemble structured JSON response from registry + ledger data
- Include traceability metadata: `scan_id`, `model_count`, `triple_check_enabled`, `execution_class`
- Cache result in `analysis_cache` keyed by normalised URL

---

## Architectural truth (non-negotiable)

### 1. Ledger is the source of truth

All insights must originate from `citation_ledger`.

No UI, API, or AI response may fabricate:

- visibility scores
- authority claims
- presence assertions

---

### 2. Registry is derived only

`visibility_registry` and related aggregates:

- must be computed
- never manually authored
- never overridden by client or API

---

### 3. UI is a projection of system state

There are only 3 UI states:

- scan input
- live execution stream
- evidence/result view

No persistent dashboard exists in scan flow.

---

### 4. MCP / API / OAuth are system interfaces

These are not separate products.

They are access layers to the same engine:

- MCP = tool execution interface
- WebMCP = browser automation interface
- External API = programmatic ledger/registry access
- OAuth = scoped access to evidence system

All routes must resolve to the same underlying truth engine.

---

### 5. Content system is evidence-bound

All generated content (blogs, reports, exports):

MUST:

- reference ledger or registry data
- reflect scan outputs
- remain reproducible

MUST NOT:

- invent visibility claims
- describe system capabilities not backed by code paths
- diverge from pipeline truth

---

### 6. UI architecture rule

There are only two shells:

PUBLIC SHELL
→ marketing + documentation only

SCAN SHELL (PRIMARY SYSTEM)
→ full-screen state machine
→ no sidebar
→ no persistent navigation

Legacy dashboards are deprecated and must not expand.

---

### 7. Security and data integrity rules

- all user inputs must pass sanitization middleware
- external URLs must be validated before processing
- AI keys remain server-side only
- all analysis outputs must be traceable to scan_id + ledger entries

---

### 8. Tiering system (canonical)

Only these tiers exist:

observer
starter
alignment
signal
scorefix (one-time remediation)

All access control must derive from `shared/types.ts`.

No UI or API may define ad-hoc plan names.

---

### 9. Stripe alignment rule

Stripe products MUST map 1:1 to canonical tiers.

Webhook events are authoritative for:

- subscription state
- entitlement changes
- feature access

No local overrides are allowed.

---

### 10. Content generation constraint

Any AI-generated output must be:

- tied to scan_id OR ledger OR registry state
- reproducible from stored inputs
- consistent across re-execution

---

## Hard rule

If a feature, UI element, API route, or AI output cannot be traced to:

- scan lifecycle event OR
- ledger entry OR
- registry computation OR
- entitlement mapping

it is invalid and must be refactored or removed.
