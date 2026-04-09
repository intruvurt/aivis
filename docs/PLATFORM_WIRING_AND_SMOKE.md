# Platform Wiring & Smoke Verification

This document defines the minimum non-negotiable wiring checks for core product surfaces:

- UX/copy policy surfaces (pricing, methodology, legal)
- audit/citation/competitor feature routes
- GSC + MCP integration routes

On this workspace, use `npm.cmd` instead of bare `npm` when running commands from PowerShell.

## Commands

### Static wiring (no auth required)

```bash
npm.cmd run smoke:wiring:static
```

Checks:

- key client routes exist in `client/src/App.tsx`
- key server endpoints are mounted in `server/src/server.ts`
- critical webMCP tools exist in `server/src/routes/webMcp.ts`

### Feature status smoke

```bash
npm.cmd run smoke:features
```

Validates feature status contract and cards/hooks wiring.

### Analyze integrity smoke (auth required)

```bash
npm.cmd run smoke:analyze
```

Requires one of:

- `SMOKE_AUTH_TOKEN`
- `SMOKE_EMAIL` + `SMOKE_PASSWORD`

Optional:

- `SMOKE_API_BASE_URL`
- `SMOKE_ANALYZE_URL`
- `SMOKE_SCAN_MOCK_DATA`

### Visibility gate smoke (auth required)

```bash
npm.cmd run smoke:visibility:gate
```

Requires a scorefix token via:

- `SMOKE_AUTH_TOKEN_scorefix` or `SMOKE_AUTH_TOKEN`
- or `tools/.smoke-tier-tokens.json`

## Why this exists

This is to prevent drift between:

- copy promises
- mounted routes
- integration surfaces

If one breaks, release confidence is invalid.

## What this does not prove yet

These smoke scripts improve release confidence, but they do not yet prove full end-to-end coverage for every major surface.

Still missing as clearly documented comprehensive smoke coverage:

- public report share creation and resolution
- all citation verification engines under live conditions
- Python deep-analysis endpoint coverage
- complete cross-tier journey verification

There is also an opt-in E2E auth test guarded by `RUN_E2E_TESTS=true`, which is useful but not the same as always-on smoke enforcement.

## Queue worker performance contract

The queue worker now uses incremental intelligence before deep crawl:

- hashes core pages (`/`, `/about`, `/pricing`, `/product`, `/services`)
- skips full recompute when no meaningful changes are detected
- reuses latest completed audit result for instant-mode reruns
- emits stage hints over SSE so UI can stream useful progress copy

Distributed execution controls:

- `AUDIT_WORKER_CONCURRENCY` controls in-process parallel jobs.
- `AUDIT_WORKER_SHARD_TOTAL` and `AUDIT_WORKER_SHARD_INDEX` allow horizontal worker partitioning by URL hash.

## Realtime visibility layer (OpenRouter swarm)

New backend endpoints:

- `POST /api/visibility/start` - starts a multi-model prompt swarm run.
- `GET /api/visibility/stream/:runId` - SSE stream for partial model outputs and aggregate progress.
- `GET /api/visibility/history?domain=...` - day-level mention-rate trend from `visibility_snapshots`.

## Auto visibility fix engine

- `POST /api/fix-engine/plan` - maps detected issues to root causes, priorities, and deployable patch payloads.
- `POST /api/fix-engine/verify` - computes before/after score delta for fix-loop verification.

## Self-healing pipeline (implemented)

Mounted at `/api/pipeline`. Requires `authRequired` + `enforceFeatureGate('alignment')`.

- `POST /api/pipeline/run` - execute full pipeline: scrape → evidence → SSFR rules → deterministic scoring (7 categories) → fix classification (25 rules → 11 FixClass values) → levelled fixpack generation (L1/L2/L3). Accepts `mode`: `advisory` | `assisted` | `autonomous`.
- `GET /api/pipeline` - list user's pipeline runs (paginated via `limit`/`offset` query params).
- `GET /api/pipeline/:id` - get run details including scoring result, classification result, and fixpacks.
- `POST /api/pipeline/:id/approve` - transition run from `awaiting_approval` → `applying` (Assisted mode).
- `POST /api/pipeline/:id/rescan` - trigger rescan verification: re-scrapes URL, re-scores, produces `RescanUplift` with score-before, score-after, per-category deltas.
- `GET /api/pipeline/:id/uplift` - retrieve rescan uplift proof for a completed run.
- `GET /api/auto-score-fix/status` - credit balance and tier eligibility check (separate route group).

Pipeline status progression: `pending` → `scoring` → `classifying` → `generating_fixpacks` → `awaiting_approval` (or `completed` for advisory mode) → `applying` → `rescanning` → `completed` | `failed`.

Hard-blocker caps enforce score ceilings: missing robots.txt (30), blocked AI crawlers (35), no title tag (40), no organization schema or JSON-LD (50).

## Agency portfolio control layer

- `GET /api/portfolio/overview` - multi-site score/trend overview for the operator.
- `GET/POST /api/portfolio/projects` - project portfolio management (org + domain + plan).
- `POST /api/portfolio/run-daily` - queue incremental audits across portfolio projects.
- `GET/PATCH /api/portfolio/tasks` - centralized task queue fed by agency event bus.

## Growth engine layer

- `POST /api/growth/lead-engine/run` - queue personalized lead audits from discovered domains.
- `POST /api/growth/outreach/preview` - generate personalized outreach copy using report link context.
- `GET /api/growth/digest/daily` - “biggest drops / biggest wins” digest payload for content loops.
- `POST /api/growth/referrals/redeem` - apply +5 credit referral bonus on conversion events.
- `POST /api/growth/viral/snippet` - generate report-embedded competitor curiosity snippet.
