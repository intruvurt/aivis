# AiVIS Client

> React 19 + Vite frontend for scan → evidence → fix → re-scan AI visibility workflows.

## What This App Actually Does

The client is the delivery surface for the AiVIS product loop:

1. Scan a public URL
2. Expose evidence-backed blockers
3. Launch fixes or remediation workflows
4. Re-scan and compare score movement

The frontend currently ships real, wired interfaces for:

- AI visibility audits with live progress streaming
- Evidence-backed reports with BRAG-linked recommendations
- Report history, exports, public share views, and score comparisons
- Analytics, competitors, citations, prompt intelligence, answer presence, and reverse engineering
- Score Fix remediation flows, including GitHub App / Auto Score Fix UI
- Workspaces, billing, referrals, notifications, and agency/admin surfaces

This README only documents behavior that exists in the current codebase. It does not treat marketing copy as source of truth.

## Runtime Notes

Use `npm.cmd` on Windows in this workspace. The local username contains `$`, which breaks bare `npm` in PowerShell.

```bash
npm.cmd install
npm.cmd run dev
```

Vite typically serves locally on `http://localhost:5173` unless overridden by config or environment.

## Stack

- React 19
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- React Router
- Framer Motion
- Axios + fetch-based API helpers
- jsPDF export flows

## Product Surfaces

### Public shell

- `/` — landing page with the audit launcher
- `/pricing` — pricing and tier narrative
- `/auth` — sign in / sign up / reset entry
- `/guide`, `/methodology`, `/help`, `/api-docs`, `/blogs`, `/compare/*`, `/workflow`, `/compliance` — support and educational surfaces
- `/report/public/:token` — public shared audit view

### Authenticated app shell

All primary product routes live under `/app/*`.

- `/app` — dashboard / overview
- `/app/analyze` — audit runner and report entry
- `/app/reports` — report history and comparison
- `/app/score-fix` — remediation and Auto Score Fix surface

Supporting intelligence routes:

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

Platform / utility routes:

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

## Tier Truth

Tier truth comes from shared contracts in [../shared/types.ts](../shared/types.ts), not from this README.

The current canonical tiers in code are:

- `observer`
- `alignment`
- `signal`
- `scorefix`
- `agency`
- `enterprise`

Current capability highlights from shared limits:

- `observer`: free entry tier, 3 scans/month, limited history/features
- `alignment`: 25 scans/month, full evidence, exports, report history
- `signal`: 100 scans/month, triple-check pipeline, scheduled rescans, team features
- `scorefix`: remediation-oriented tier with Auto PR capabilities and credits-driven workflows
- `agency`: high-volume, workspace-heavy, white-label and portfolio tooling
- `enterprise`: effectively unlimited API-first tier

Pricing display and checkout data are fetched from the backend. Do not hardcode price values here as product truth.

## Audit Flow In The Client

The client audit flow is already wired around the current backend:

1. Submit URL to `POST /api/analyze`
2. Read `X-Audit-Request-Id`
3. Open SSE progress stream at `/api/audit/progress/:requestId`
4. Render the analysis result when the JSON payload returns
5. Offer reports, exports, comparison, and remediation next steps

Key implementation files:

- [src/views/AnalyzePage.tsx](src/views/AnalyzePage.tsx)
- [src/components/AuditProgressOverlay.tsx](src/components/AuditProgressOverlay.tsx)
- [src/components/ComprehensiveAnalysis.tsx](src/components/ComprehensiveAnalysis.tsx)
- [src/components/RecommendationList.tsx](src/components/RecommendationList.tsx)
- [src/components/AutoScoreFixModal.tsx](src/components/AutoScoreFixModal.tsx)

## Directory Map

The current app is not yet reorganized into feature folders; this README reflects the real structure in the repo today.

```text
src/
├── components/   # shared UI, audit/report panels, nav, remediation modals
├── views/        # authenticated product views and route targets
├── pages/        # public marketing/docs/support pages and some utility screens
├── hooks/        # auth, settings, notifications, feature status, page meta
├── stores/       # Zustand auth, analysis, settings, workspaces
├── services/     # API wrappers and product service clients
├── utils/        # URL normalization, auth headers, fetch helpers, insight utilities
├── lib/          # security, SEO schema, auth helpers, sentry
├── content/      # generated blog/support content
├── constants/    # product copy, colors, narrative constants
└── auth/         # auth client helpers
```

## Environment Variables

Create `client/.env` as needed:

```bash
VITE_API_URL=https://api.aivis.biz
VITE_ENV=development
VITE_SENTRY_DSN=
```

`VITE_API_URL` should point to the backend origin, not the `/api` path.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm.cmd run dev` | Start Vite dev server |
| `npm.cmd run build` | Build production assets |
| `npm.cmd run preview` | Preview production build |
| `npm.cmd run lint` | Run ESLint |
| `npm.cmd run typecheck` | Run TypeScript checks |
| `npm.cmd test` | Run Vitest |

## Accuracy Rules For Future Edits

- Treat [../shared/types.ts](../shared/types.ts) as the cross-layer contract.
- Treat [src/App.tsx](src/App.tsx) as the route map source of truth.
- Treat pricing data as server-owned.
- Do not describe Auto Score Fix as unavailable unless the routes are actually locked.
- Do not describe public routes or tier limits from memory; verify them in code first.

## Related

- [../server/README.md](../server/README.md)
- [../shared/types.ts](../shared/types.ts)
- [../STRIPE_SETUP.md](../STRIPE_SETUP.md)
