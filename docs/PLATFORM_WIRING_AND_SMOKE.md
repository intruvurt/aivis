# Platform Wiring & Smoke Verification

This document defines the minimum non-negotiable wiring checks for core product surfaces:

- UX/copy policy surfaces (pricing, methodology, legal)
- audit/citation/competitor feature routes
- GSC + IndexNow + MCP integration routes

## Commands

### Static wiring (no auth required)

```bash
npm run smoke:wiring:static
```

Checks:

- key client routes exist in `client/src/App.tsx`
- key server endpoints are mounted in `server/src/server.ts`
- critical webMCP tools exist in `server/src/routes/webMcp.ts`

### Feature status smoke

```bash
npm run smoke:features
```

Validates feature status contract and cards/hooks wiring.

### Analyze integrity smoke (auth required)

```bash
npm run smoke:analyze
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
npm run smoke:visibility:gate
```

Requires a scorefix token via:

- `SMOKE_AUTH_TOKEN_SCOREFIX` or `SMOKE_AUTH_TOKEN`
- or `tools/.smoke-tier-tokens.json`

## Why this exists

This is to prevent drift between:

- copy promises
- mounted routes
- integration surfaces

If one breaks, release confidence is invalid.

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

- `POST /api/visibility/start` — starts a multi-model prompt swarm run.
- `GET /api/visibility/stream/:runId` — SSE stream for partial model outputs and aggregate progress.
- `GET /api/visibility/history?domain=...` — day-level mention-rate trend from `visibility_snapshots`.

## Auto visibility fix engine

- `POST /api/fix-engine/plan` — maps detected issues to root causes, priorities, and deployable patch payloads.
- `POST /api/fix-engine/verify` — computes before/after score delta for fix-loop verification.

## Self-healing loop

- `GET /api/self-healing/preferences` / `PUT /api/self-healing/preferences` — mode control (`manual`, `assisted`, `autonomous`) and anomaly threshold.
- `GET /api/self-healing/events` — latest anomaly detections, generated fix plans, confidence, and status.
- `POST /api/self-healing/run-now` — trigger one full monitor→detect→diagnose cycle immediately.

## Agency portfolio control layer

- `GET /api/portfolio/overview` — multi-site score/trend overview for the operator.
- `GET/POST /api/portfolio/projects` — project portfolio management (org + domain + plan).
- `POST /api/portfolio/run-daily` — queue incremental audits across portfolio projects.
- `GET/PATCH /api/portfolio/tasks` — centralized task queue fed by agency event bus.

## Growth engine layer

- `POST /api/growth/lead-engine/run` — queue personalized lead audits from discovered domains.
- `POST /api/growth/outreach/preview` — generate personalized outreach copy using report link context.
- `GET /api/growth/digest/daily` — “biggest drops / biggest wins” digest payload for content loops.
- `POST /api/growth/referrals/redeem` — apply +5 credit referral bonus on conversion events.
- `POST /api/growth/viral/snippet` — generate report-embedded competitor curiosity snippet.