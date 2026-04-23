# Page Compiler Ledger Architecture

This maps the scan-to-page compiler model into deterministic, replayable system contracts for AiVIS.

## Pipeline Contract

External entry point:

- `POST /api/analyze/compiler`

Async state machine:

- `SCAN_INIT`
- `ENTITY_MAP`
- `GAP_MODEL`
- `PAGE_SPEC_GEN`
- `CONTENT_COMPILE`
- `SCHEMA_BIND`
- `GRAPH_LINK`
- `READY`
- `PUBLISHED` (optional publish step)

State transitions are strict and append immutable stage events to `analyze_job_events`.

## API Surface

Public job API:

- `POST /api/analyze/compiler` -> create job and enqueue worker
- `GET /api/analyze/compiler/:jobId` -> retrieve state + stage events + artifacts
- `POST /api/analyze/compiler/:jobId/publish` -> create publish artifacts and mark published
- `POST /api/analyze/compiler/:jobId/rescan` -> store visibility delta outcome

## Internal Service Breakdown

Execution service:

- `server/src/services/pageCompiler/compilerService.ts`

Deterministic handlers in sequence:

1. `createAnalyzeCompilerJob(...)`
   - Normalizes input tuple (`source_type`, `mode`, `depth`)
   - Computes request hash
   - Enforces per-user idempotency via `idempotency_key`
2. `runAnalyzeCompilerPipeline(jobId)`
   - Processes stage-by-stage transition
   - Uses transition guard: update from expected prior state only
   - Writes stage event hash chain after each stage
3. `publishAnalyzeCompilerJob(jobId)`
   - Creates format artifacts (`html`, `markdown`, `jsonld`, `api`)
   - Updates job state to `PUBLISHED`
4. `rescanAnalyzeCompilerJob(jobId)`
   - Persists post-publish visibility delta snapshot

Failure path:

- `failAnalyzeCompilerJob(jobId, reason)` marks state `FAILED` and appends immutable failure event.

## Queue + Worker

Queue module:

- `server/src/infra/queues/analyzeCompilerQueue.ts`

Worker module:

- `server/src/workers/analyzeCompilerWorker.ts`

Behavior:

- BullMQ queue name: `analyze-compiler`
- Job identity: `analyze-compiler:{jobId}` for idempotent enqueue semantics
- Worker retries (`attempts=3`) with exponential backoff
- Failure writes terminal state through `failAnalyzeCompilerJob`

## Supabase/Postgres Ledger Tables

Created via migration:

- `server/src/migrations/018_page_compiler_ledger.sql`

Core tables:

- `analyze_jobs` (state machine root)
- `analyze_job_events` (append-only stage ledger, sequence + hash chain)
- `entity_nodes`
- `entity_edges`
- `entity_gap_models`
- `page_specs`
- `page_builds`
- `page_schema_bindings`
- `page_link_graph`
- `publish_artifacts`
- `analyze_rescan_results`

Determinism properties:

- Immutable sequence per job (`UNIQUE(job_id, sequence)`)
- Parent/event hash chain per event
- Strict state transition guards
- Idempotent upsert writes for entity/spec/build layers

## Replayability and Auditability

A job is replayable by reading:

1. `analyze_jobs` current state
2. Ordered `analyze_job_events`
3. Materialized outputs (`page_specs`, `page_builds`, `page_schema_bindings`, `publish_artifacts`)

This yields an inspectable compiler trace from scan input to generated publish surfaces.
