AiVIS — Evidence-backed AI Visibility & Citation Engine
0. SYSTEM DEFINITION (READ FIRST)

This is not a dashboard application.

This is a closed-loop visibility engine that:

detects whether entities are cited in AI systems
explains why they are not cited
and generates structured actions that increase citation probability

All code changes must preserve this invariant:

Every insight must connect to either a citation state OR a corrective action path.

1. ARCHITECTURE OVERVIEW
Monorepo structure
client/ → Vite + React 19 + Tailwind UI
server/ → Express 5 + TypeScript (source of truth)
shared/ → canonical types, tiers, and contracts
Core execution pipeline
POST /api/analyze
→ authRequired
→ usageGate
→ incrementUsage
→ scraper.ts (Puppeteer extraction)
→ queryGenerator.ts (AI query expansion)
→ citationTester.ts (multi-engine verification)
→ aiProviders.ts (multi-model reasoning chain)
→ ledger write (citation truth store)
→ scoringEngine.ts
→ AnalysisCacheService
→ response JSON
System principle

Server is authoritative. Client is representational.

If disagreement occurs:
server always wins.

2. DEVELOPMENT COMMAND RULES (CRITICAL)

Workspace contains Windows username with $.

REQUIRED COMMAND FORMAT

Always use:

npm.cmd
npx.cmd

Never use:

npm
npx

Reason:
PowerShell variable interpolation breaks $e paths.

3. TIER SYSTEM (CANONICAL TRUTH)

Defined in shared/types.ts.

Canonical tiers
Tier	Name	Scans	Purpose
observer	Free visibility probe	3/mo	entry-level detection
starter	Growth layer	15/mo	baseline optimization
alignment	Core system	60/mo	structured visibility engineering
signal	Advanced inference	110/mo	triple-model reasoning
scorefix	remediation engine	250 credits	automated PR fixes
RULES
Never hardcode tier logic outside shared/types.ts
UI labels are derived only via mapping helpers
Legacy names are invalid except through conversion layer
4. AI MODEL ORCHESTRATION

Defined in aiProviders.ts + config/aiProviders.ts

Execution model
Observer (free)
OpenRouter :free models only
6-model fallback chain
zero-cost execution
optimized for structured JSON output (no reasoning verbosity)
Starter / Alignment
GPT-5 Nano primary
Claude Haiku 4.5 fallback
lightweight deterministic responses
Signal (advanced)

Triple-check pipeline:

GPT-5 Mini → Claude Sonnet 4.6 → Grok 4.1 Fast
peer validation stage
score adjustment layer
final reconciliation gate
5. CITATION ENGINE (CORE SYSTEM)
Citation engines (parallel execution)
ddg_web
bing_web
ddg_instant

All executed via:

Promise.all()

in citationTester.ts.

RULE

A claim is invalid unless it can be traced to at least one citation source OR explicitly marked as missing evidence.

6. SECURITY MODEL
Middleware chain (required order)
authRequired →
usageGate →
incrementUsage →
handler
Security invariants
/api/analyze NEVER accepts client API keys
all external URLs validated via isPrivateOrLocalHost()
all input sanitized via sanitizeInput()
SSR payloads protected via escapeBootstrapState()
CSP nonce enforced per request
Helmet always enabled globally
7. DATABASE MODEL (SUPABASE POSTGRES)
Storage system
Primary DB: Supabase Postgres (PgBouncer pooler)
Server uses service-role credentials (RLS bypassed intentionally)
Client uses anon key only
Core tables
users
usage_daily
analysis_cache
audits
citation_tests
citation_results
competitor_tracking
brand_mentions
serp_snapshots
ner_run_entities
payments
8. SOCIAL + SERP INTELLIGENCE
Mention system (no API keys)

mentionTracker.ts sources:

Reddit
Hacker News
Mastodon
GitHub
Quora
Product Hunt
Wikipedia
YouTube
Dev.to
Medium
Stack Overflow
Twitter/X
Bluesky
Lemmy
Google News
others (19 total)
SERP enrichment (tier gated)

serpService.ts:

requires SERP_API_KEY
Alignment+ only
improves:
entity_clarity_score
authority_score
9. ROUTE SYSTEM
Core API
Route	Auth	Purpose
/api/analyze	yes	primary visibility engine
/api/audits	yes	history
/api/analytics	yes	temporal visibility traces
/api/health	no	system check
/api/pricing	no	tier definitions
Extended systems
/api/competitors → comparison engine (Alignment+)
/api/citations → citation verification (Signal)
/api/reverse-engineer → AI answer deconstruction tools
/api/payment → Stripe billing engine
/api/auth → session system
10. CRITICAL PIPELINE RULES
/api/analyze must always execute in this order:
authRequired
→ usageGate
→ incrementUsage
→ scraper
→ query expansion
→ citation verification
→ AI reasoning chain
→ ledger persistence
→ scoring engine
→ cached response
FAILURE HANDLING RULE

If any stage fails:

preserve prior valid outputs
degrade gracefully
never return partial schema
never break response shape
11. OUTPUT CONTRACT RULE

Every analysis MUST produce:

citation state OR
missing citation explanation + action graph

No exceptions.

12. SYSTEM PHILOSOPHY (NON-OPTIONAL)

This system is not:

SEO tool
analytics dashboard
reporting SaaS

This system is:

a deterministic engine for measuring and increasing entity visibility inside AI answer systems

13. CODE MODIFICATION RULES

When modifying code:

do not break ledger consistency
do not bypass citation flow
do not introduce non-traceable metrics
do not weaken server authority model
do not add UI-only logic that contradicts backend truth
14. FINAL PRINCIPLE

If an output does not improve the probability of citation or explain its absence, it does not belong in the system.