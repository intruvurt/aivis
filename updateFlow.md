# AiVIS Update Flow (Evidence-Backed, Robust)

Last updated: 2026-04-24

## System Contract

AiVIS is an evidence engine for AI-answer visibility. Output is valid only when tied to:

- citation state (present / absent / uncertain), or
- corrective action path backed by evidence IDs.

## Canonical Runtime Flow

1. Request enters protected API (`/api/analyze`, `/api/mcp`, `/api/webmcp`, `/api/v1/*`).
2. Auth + tier + workspace enforcement runs server-side.
3. Queue/worker orchestration starts (Redis queues + BullMQ + scheduled loops).
4. Scrape/extract runs (HTTP/Puppeteer; Python augmentation optional).
5. Evidence + scoring + citation logic executes.
6. Ledger/registry writes occur when schema is available.
7. Timeline/stage state streams via SSE.
8. Response returns deterministic state + evidence-linked summaries.

## Robustness Guarantees

### Startup gates

- Determinism gate (existing):
  - `DETERMINISM_STARTUP_GATE=true`
  - `DETERMINISM_STARTUP_GATE_STRICT=true` (fail-fast)
- Schema readiness gate (new):
  - `SCHEMA_READINESS_GATE=true`
  - `SCHEMA_READINESS_GATE_HARD_FAIL=true` (fail-fast)

Schema gate validates critical tables before background flow starts using `to_regclass` checks.

### Runtime degradation behavior

- Missing `credit_ledger` no longer hard-fails analyze path.
- Missing `scans`/graph tables no longer crash ingestion path; graph stage skips with structured fallback.
- Queue progress endpoints enforce job ownership.
- Heatmap build now degrades to empty-surface fallback when citation relations are unavailable.
- Worker progress sync loop is overlap-guarded and non-blocking (`unref`) to reduce interval leak risk.
- DB cleanup bootstrap timer is non-blocking (`unref`) to avoid idle-process retention.

### Analytics + feature route integrity

- PostHog auth key resolution is unified (`POSTHOG_API_KEY` primary, `POSTHOG_KEY` compatibility fallback).
- Days-window parsing in analytics routes is clamped/validated for granular query safety.
- Feature/person endpoints enforce authenticated user scope (no cross-user cohort/person reads).

## Worker & Queue Reality Check

### Confirmed startup workers/loops

- Audit queue worker loop
- FixWorker
- TrackingWorker
- PRWorker
- RawDocumentWorker
- AnalyzeCompilerWorker
- MCP audit loop
- DB cleanup loop
- Scheduler + citation revalidation loop

### Queue routes

- `POST /api/queue/audit`
- `GET /api/queue/audit/progress/:jobId` (ownership enforced)
- `GET /api/v1/audit/progress/:id` (ownership enforced)

## MCP + Node + Python Execution Model

### Node/JS

- Primary orchestrator for routes, workers, queueing, SSE, and auditing.

### MCP

- `GET/POST /api/mcp/*` tool surface.
- `GET/POST /api/webmcp/*` browser-agent tool surface.
- Async queue processing via `mcpAuditProcessor`.

### Python (optional but real)

- Graph/document ingestion and BRAG validation hooks.
- Availability-sensitive: pipeline degrades to safe fallback if unavailable.

## UI State Machine & Motion

### Canonical stage machine

- `resolve -> fetch -> extract -> schema -> trust -> conflict -> score`
- Mapped in `ScanStageTimeline` from pipeline step keys.

### Motion

- Route-level transitions use opacity + y + blur (`AnimatedRoutes`).

## Evidence Summary Contract

Minimum response fields for evidence-backed summaries:

- `visibility_score`
- `evidence_count`
- `brag_findings_count`
- recommendation metadata tied to evidence artifacts

MCP evidence endpoint returns manifest/highlights if present in audit payload.

## AEO Primitive Contract (Content Generation)

For `/api/content/generate-fix`, generated implementations must:

- preserve canonical entity naming (no entity dilution),
- tie remediation language to evidence signals (citation presence/absence + extractability),
- output deterministic implementation artifacts (not generic advisory prose).

## Health & Readiness Endpoints

- `GET /api/admin/health-deep`
  - includes runtime, database latency, and `schema_readiness`
- `GET /api/admin/schema-readiness`
  - compact table readiness report
  - `200` when all required tables present
  - `503` when any required table missing

Both admin endpoints require `x-admin-key`.

## Required Tables (Readiness Set)

- `users`
- `audits`
- `analysis_cache`
- `credit_ledger`
- `scan_pack_credits`
- `scans`
- `entities`
- `claims`
- `cluster_members`

## Operational Verification Checklist

1. Check readiness:
   - `GET /api/admin/schema-readiness`
2. Check deep health:
   - `GET /api/admin/health-deep`
3. Trigger one analyze request and confirm:
   - no 500 on missing optional subsystems
   - timeline stage progression is monotonic
4. Confirm queue ownership boundaries by testing cross-user job IDs.

## Non-Negotiables

1. Server is source of truth for entitlement and evidence.
2. Optional subsystem absence must not break response shape.
3. Summary claims must be traceable to evidence or explicit missing-evidence state.
4. UI stage transitions must reflect real backend state, never synthetic placeholders.
