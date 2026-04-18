# UI Route Intelligence Map (Entity-Locked System)

## Goal

Align all authenticated user-facing routes to one execution model:

1. Evidence intake
2. Gap diagnosis
3. Deterministic implementation
4. Verification and closure

This map is implemented through `client/src/config/routeIntelligence.ts` and rendered globally by `client/src/components/RouteGuideBar.tsx` inside `AppShell`.

## Operating Model

The platform uses an evidence-first loop:

- Audit and capture evidence
- Detect blockers and drift
- Execute fixes in priority order
- Re-run audits and verify score movement

For scaled content operations, this aligns to an entity-locked generation lattice:

- Stable entity core anchors (never mutate)
- Finite topic kernels
- Deterministic structural mutations
- Semantic fingerprinting for anti-duplication
- CITE LEDGER traceability for each output

## Route Coverage

`routeIntelligence.ts` now covers:

- Core app routes (`/app`, `/app/analyze`, `/app/reports`, `/app/score-fix`)
- Evidence routes (`/app/analytics`, `/app/citations`, `/app/competitors`, `/app/benchmarks`, `/app/audits/:id`)
- Extensions (`/app/prompt-intelligence`, `/app/answer-presence`, `/app/reverse-engineer`, `/app/brand-integrity`, `/app/niche-discovery`, `/app/keywords`)
- Platform execution routes (`/app/pipeline`, `/app/workflow`, `/app/mcp`)
- Agency/system routes (`/app/dataset`, `/app/integrations`, `/app/api-docs`)
- Tool routes under both `/tools/*` and `/app/*` forms
- Account/ops routes (`/app/settings`, `/app/team`, `/app/billing`, `/app/help`)
- Fallback `/app/*` guide for consistency on uncatalogued pages

## UX Consistency Rules

- Sidebar labels and route intent map use one central source (`routeIntelligence.ts`)
- Tier labels are rendered via shared helper (`formatTierGateLabel`) to avoid drift
- Every guided route has:
  - concise purpose
  - explicit next step
  - execution checklist (up to 3 steps)
  - primary action target

## Extension Process

When adding a new user-facing page:

1. Add route in `App.tsx`
2. Add navigation item in `APP_NAV_GROUPS` if discoverable from sidebar
3. Add a `RouteGuideRule` entry with instructions and primary action
4. If tier-gated, set `minTier` and verify UI badge + route gate behavior
5. Run `npm.cmd --prefix client run build` and validate route renders in-app
