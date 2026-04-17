# AiVIS.biz Client

This package is the frontend for the AiVIS.biz product flow.

It is not a generic SEO dashboard. The client is built to help users scan a public site, understand what AI systems miss, review evidence, trigger remediation, and measure what changes after another scan.

## Product role

The client presents the operational loop used across the platform:

1. Launch or review an audit.
2. Inspect evidence-backed findings.
3. Compare history, competitors, citations, and mentions.
4. Start remediation flows.
5. Re-scan and validate movement.

If a screen does not support that loop or strengthen collaboration around it, it is not a core surface.

## Current frontend surfaces

The current app is already wired to real backend flows for:

- audit launch and live progress streaming
- comprehensive analysis and recommendation rendering
- report history, exports, and comparison
- public report sharing via `/reports/public/:shareId`
- citation tracking and answer presence workflows
- competitor tracking and reverse engineering tools
- Score Fix and AutoFix PR-related remediation surfaces
- billing, notifications, workspaces, agency flows, and admin tools

## Stack

- React 19
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- React Router
- Framer Motion
- Axios and fetch helpers
- jsPDF export flows

## Run locally

On this Windows workspace, always use `npm.cmd`.

```bash
npm.cmd install
npm.cmd run dev
```

Vite usually runs on `http://localhost:5173`.

## Route model

Public routes include:

- `/`
- `/pricing`
- `/auth`
- `/guide`
- `/methodology`
- `/workflow`
- `/compare/*`
- `/reports/public/:shareId`
- `/report/public/:shareId` for legacy link compatibility

Authenticated product routes live under `/app/*` and include:

- `/app/dashboard`
- `/app/analyze`
- `/app/reports`
- `/app/score-fix`
- `/app/analytics`
- `/app/citations`
- `/app/competitors`
- `/app/keywords`
- `/app/prompt-intelligence`
- `/app/answer-presence`
- `/app/reverse-engineer`
- `/app/brand-integrity`
- `/app/niche-discovery`
- `/app/benchmarks`
- `/app/schema-validator`
- `/app/server-headers`
- `/app/robots-checker`
- `/app/indexing`
- `/app/mcp`
- `/app/gsc`
- `/app/profile`
- `/app/settings`
- `/app/billing`
- `/app/notifications`
- `/app/team`
- `/app/agency`
- `/app/admin`

## Tier truth

Tier logic does not belong in this README. It comes from `../shared/types.ts` and the server remains authoritative.

Current canonical tiers in the shared contract:

- `observer`
- `alignment`
- `signal`
- `scorefix`
- `agency`
- `enterprise`

Simple framing:

- Observer shows what AI gets wrong.
- Alignment explains the structural reason.
- Signal measures citation and visibility progress over time.
- Score Fix moves from diagnosis into remediation.
- Agency and Enterprise extend this into team and portfolio operations.

## Audit flow in the client

The main client audit sequence is already wired to the backend:

1. Submit a target to `POST /api/analyze`.
2. Read the created audit request id.
3. Open the SSE progress stream at `/api/audit/progress/:requestId`.
4. Render the finished analysis.
5. Offer reports, exports, sharing, comparison, and remediation next steps.

Important implementation files:

- `src/views/AnalyzePage.tsx`
- `src/components/AuditProgressOverlay.tsx`
- `src/components/ComprehensiveAnalysis.tsx`
- `src/components/RecommendationList.tsx`
- `src/components/AutoScoreFixModal.tsx`
- `src/pages/PublicReportPage.tsx`

## Evidence-first rule

AiVIS.biz uses an evidence-first product model.

- Findings should connect back to real evidence.
- Recommendations should stay grounded in the analyzed page.
- Public reports should preserve the actual audit payload, not a marketing summary.

## Team workspace importance

The workspace layer is strategically important. As search click volume becomes less dependable, teams need a shared operational layer for audits, historical movement, remediation decisions, and stakeholder-visible public reports.

That is one of the clearest product differentiators in this codebase.

## Project structure

```text
src/
|- auth/
|- components/
|- constants/
|- hooks/
|- lib/
|- pages/
|- services/
|- stores/
|- utils/
`- views/
```

In practical terms:

- `components/` holds shared UI, report blocks, navigation, and remediation modals
- `views/` holds larger product screens
- `pages/` holds route-level surfaces
- `services/` and `utils/` handle API and transformation logic
- `stores/` coordinates frontend state

## Documentation note

This README is meant to reflect the working product, not aspirational copy. If the client and server disagree, the server wins.

views holds authenticated product views

pages holds public and support pages

hooks holds auth settings notifications and feature helpers

stores holds Zustand state for auth analysis settings and workspaces

services holds API wrappers and service clients

utils holds helper functions

lib holds security schema auth and sentry helpers

constants holds product constants and internal copy

auth holds auth helpers

Environment variables

Create client/.env as needed

VITE_API_URL=<https://api.aivis.biz>
VITE_ENV=production
VITE_SENTRY_DSN=render environment variable

VITE_API_URL should point to the backend origin and not the /api path

Scripts

npm.cmd run dev starts the local dev server

npm.cmd run build builds production assets

npm.cmd run preview previews the production build

npm.cmd run lint runs ESLint

npm.cmd run typecheck runs TypeScript checks

npm.cmd test runs Vitest

Rules for future edits

Treat ../shared/types.ts as the cross layer contract

Treat src/App.tsx as the route map source of truth

Treat pricing as server owned

Do not describe a feature here unless it actually exists in code

Do not hardcode tier limits or public route details from memory

Related

../server/README.md

../shared/types.ts

../STRIPE_SETUP.md

Final note

AiVIS.biz is built to show whether a site can actually be read trusted and cited by AI systems

The product is not just about audits

It is about proving what is broken helping fix it and measuring the change
