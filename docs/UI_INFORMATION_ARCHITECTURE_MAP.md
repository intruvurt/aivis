# UI Information Architecture Map

## Purpose

This document defines the production UI architecture for AiVIS.biz so navigation, page purpose, and execution flow remain consistent across all user-facing surfaces.

The architecture is implemented in code through:

- `client/src/config/routeIntelligence.ts` (single source of truth for app navigation groups and route guidance)
- `client/src/components/RouteGuideBar.tsx` (global page-context strip)
- `client/src/components/AppShell.tsx` (injects context strip for all `/app/*` and `/tools/*` pages)
- `client/src/components/PublicLayout.tsx` (injects context strip for mapped public routes)
- `client/src/components/AppSidebar.tsx` (driven by the same route map)

## Product Operating Flow

1. Analyze: run evidence collection on a URL
2. Evidence: inspect findings, blockers, and confidence
3. Gaps: identify prompt/answer drift and missing coverage
4. Fix: execute remediation in Score Fix
5. Verify: rerun analysis and compare movement over time

This is the baseline loop for every customer tier.

## Navigation Architecture

### Core

- `/app` Command Center
- `/app/analyze` Run AI Visibility Audit
- `/app/snapshot` point-in-time baseline capture
- `/app/reports` Evidence Reports
- `/app/score-fix` Score Fix execution
- `/app/site-crawl` full-site blocker scan

### Evidence

- `/app/analytics` score movement and trend health
- `/app/citations` citation behavior tracking (Alignment+)
- `/app/competitors` benchmark and pressure analysis (Alignment+)
- `/app/benchmarks` public benchmark surface

### Extensions

- `/app/keywords` intent and keyword extraction
- `/app/prompt-intelligence` prompt cluster gap analysis (Alignment+)
- `/app/answer-presence` answer inclusion tracking (Alignment+)
- `/app/reverse-engineer` decompile/model-diff/simulate workflows (Alignment+)
- `/app/brand-integrity` brand accuracy monitoring (Alignment+)
- `/app/niche-discovery` niche opportunity discovery

### Platform

- `/tools/schema-validator` JSON-LD and schema checks
- `/tools/server-headers` header trust checks
- `/tools/robots-checker` crawler access verification
- `/tools/content-extractability` extraction quality test
- `/tools/language-checker` locale/language signal checks
- `/app/domain-rating` domain quality scoring (Alignment+)
- `/app/mcp` MCP console (Alignment+)
- `/app/gsc` Search Console correlation and indexing diagnostics (Alignment+)

### Agency

- `/app/agency` agency operations workspace
- `/app/badge` embed badge
- `/app/dataset` dataset studio (Signal+)
- `/app/api-docs` API docs (Signal+)
- `/app/integrations` integrations hub (Signal+)

### Resources

- `/blogs`
- `/guide`

### Account

- `/app/profile`
- `/app/referrals`
- `/app/billing`
- `/app/settings`
- `/app/compliance-dashboard`
- `/app/notifications`
- `/app/admin`
- `/app/help`

## Entity-Locked Generation System UX

The new system is represented directly in product flow and route intent.

### Layer A: Entity Core

- stable anchors: `AiVIS`, `CITE LEDGER`, `Answer Engines`, `BRAG scoring`
- UI implication: entity names are treated as immutable system references

### Layer B: Topic Kernels

- finite kernel set mapped to problem classes and retrieval behaviors
- UI implication: kernels are selected and tracked in `/app/keywords`, `/app/prompt-intelligence`, and `/app/niche-discovery`

### Layer C: Structural Mutations

- deterministic output shapes (field report, failure analysis, debugging narrative, and similar)
- UI implication: mutation operations are executed in `/app/pipeline` and validated in `/app/dataset`

### Execution Controls

- anti-duplication is modeled as semantic fingerprinting at dataset level
- publication and verification loop runs through `/app/workflow` and `/app/reports`
- every stage maps back to evidence and verification before scale deployment

## Global UX Constraints

1. Every app/tool route must have a clear purpose and next step.
2. Labels in sidebar, route metadata, and page headings must refer to the same concept.
3. Lock states must show human-readable tier requirements.
4. Route-level context must be generated from one shared map; no duplicate hardcoded labels.
5. New pages must be added to the route intelligence map before release.

## Implementation Rules

1. Add navigation entries only in `client/src/config/routeIntelligence.ts`.
2. Keep route guidance actionable and operation-focused (not marketing copy).
3. Keep primary actions executable links to real pages (no placeholders).
4. Do not add dead-end pages to the sidebar.
5. Route coverage is enforced at build time via `client/scripts/validate-route-intelligence.mjs`.
6. Validate all changes via client build before merge.

## Execution Checklist For New User-Facing Pages

1. Create route component and real feature behavior.
2. Register route in `client/src/App.tsx`.
3. Add nav entry and route guide rule in `client/src/config/routeIntelligence.ts`.
4. Add/verify translation label key used by sidebar.
5. Confirm lock tier behavior (if applicable).
6. Confirm route guide copy explains purpose, next step, and executable primary action.
7. Run build and verify no route crashes.
