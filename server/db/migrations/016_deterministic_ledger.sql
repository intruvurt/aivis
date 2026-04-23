-- Migration 016: Deterministic replay ledger
-- Implements a total-ordered, hash-chained, versioned event ledger.
-- State(t) = R(S₀, E₁…Eₙ, V) — every audit scan is replayable from this table alone.

-- ─── Core ledger table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_ledger_events (
  -- Primary identity
  event_id        TEXT        PRIMARY KEY,  -- UUIDv7 (time-sortable)
  trace_id        TEXT        NOT NULL,     -- audit session / scan_id

  -- Total ordering (critical)
  sequence        BIGINT      NOT NULL,     -- strictly monotonic per trace_id

  -- Time anchor (server clock, not client)
  ts              BIGINT      NOT NULL,     -- epoch milliseconds

  -- Event vocabulary (constrained enum via CHECK)
  event_type      TEXT        NOT NULL
    CHECK (event_type IN (
      'audit.started',
      'crawl.complete',
      'entity.resolved',
      'query.expanded',
      'citation.tested',
      'ai.reconciled',
      'score.computed',
      'audit.completed',
      'audit.failed'
    )),

  -- Data payload: normalized output, never raw input
  payload         JSONB       NOT NULL DEFAULT '{}',

  -- Deterministic transformation output for this event
  state_delta     JSONB       NOT NULL DEFAULT '{}',

  -- CRITICAL: makes replay version-safe
  reducer_version TEXT        NOT NULL,

  -- Hash chain integrity
  parent_hash     TEXT,                     -- NULL only for sequence=0
  event_hash      TEXT        NOT NULL,     -- hash(type+payload+state_delta+reducer_version+parent_hash)

  -- Uniqueness: one sequence slot per trace
  UNIQUE (trace_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_ale_trace_seq  ON audit_ledger_events (trace_id, sequence ASC);
CREATE INDEX IF NOT EXISTS idx_ale_ts         ON audit_ledger_events (ts);
CREATE INDEX IF NOT EXISTS idx_ale_event_type ON audit_ledger_events (event_type);

-- ─── Snapshot table (performance layer) ──────────────────────────────────────
-- Replay becomes: load snapshot → fold from snapshot.sequence_at onward
CREATE TABLE IF NOT EXISTS audit_snapshots (
  id                  TEXT    PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id            TEXT    NOT NULL,

  -- Snapshot is valid through this sequence (inclusive)
  sequence_at         BIGINT  NOT NULL,

  -- Full materialized state at sequence_at
  state               JSONB   NOT NULL,

  -- Must match the reducer that produced this snapshot
  reducer_version     TEXT    NOT NULL,

  -- Integrity: hash(state) — verified on load
  state_hash          TEXT    NOT NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (trace_id, sequence_at, reducer_version)
);

CREATE INDEX IF NOT EXISTS idx_as_trace_seq ON audit_snapshots (trace_id, sequence_at DESC);

-- ─── RLS: public reads, service-role writes ───────────────────────────────────
-- Service role bypasses RLS entirely (Supabase default for service key).
-- Anon/authenticated users may read completed traces for public UI.
ALTER TABLE audit_ledger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_snapshots     ENABLE ROW LEVEL SECURITY;

-- Write: service role only (no client key can write)
CREATE POLICY ale_service_write ON audit_ledger_events
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY as_service_write ON audit_snapshots
  FOR ALL USING (false) WITH CHECK (false);
