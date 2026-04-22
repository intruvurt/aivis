-- ============================================================
-- AiVIS — Graph Knowledge Layer
-- Migration 010: entities · claims · edges · clusters · resolutions
--
-- Requires pgvector extension. In Supabase, enable it via:
--   Dashboard → Database → Extensions → vector
-- Or run: CREATE EXTENSION IF NOT EXISTS vector;
-- ============================================================

-- Extensions (idempotent)
-- Order: vector first, then pgcrypto (for gen_random_uuid), then uuid-ossp
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- scans
-- First-class scan records. Decoupled from audits (audits are
-- user-facing history; scans are pipeline execution records).
-- Linked to audits via audit_id for traceability.
-- ============================================================
CREATE TABLE IF NOT EXISTS scans (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id       UUID        REFERENCES audits(id) ON DELETE SET NULL,
  url            TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','running','complete','failed')),
  execution_class TEXT,                          -- observer | starter | alignment | signal
  model_count    SMALLINT    DEFAULT 0,
  triple_check   BOOLEAN     DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_audit   ON scans (audit_id);
CREATE INDEX IF NOT EXISTS idx_scans_url     ON scans (url);
CREATE INDEX IF NOT EXISTS idx_scans_created ON scans (created_at DESC);

-- ============================================================
-- entities
-- Canonical entity registry. One row per resolved real-world
-- entity (org, person, product, concept). Embeddings enable
-- fuzzy deduplication at ingestion time.
-- ============================================================
CREATE TABLE IF NOT EXISTS entities (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT        NOT NULL,
  type           TEXT,                           -- org | person | product | concept | ...
  embedding      VECTOR(768),                    -- text-embedding-3-small or ada-002
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entities_name ON entities (canonical_name);

-- ivfflat cosine index for ANN entity deduplication
-- lists=100 is appropriate for up to ~1M rows; tune upward at scale
CREATE INDEX IF NOT EXISTS idx_entities_embedding
  ON entities USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- claims
-- Atomic truth units extracted per scan. Subject + predicate +
-- object form the SPO triple. Confidence/authority/freshness
-- are evidence weights, not scores (scoring happens downstream).
-- ============================================================
CREATE TABLE IF NOT EXISTS claims (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID              REFERENCES scans(id) ON DELETE CASCADE,
  subject_id      UUID              REFERENCES entities(id) ON DELETE SET NULL,
  predicate       TEXT              NOT NULL,
  object_value    TEXT,                           -- normalized string
  object_raw      TEXT,                           -- original extracted text
  object_number   DOUBLE PRECISION,              -- populated when value is numeric
  value_type      TEXT              CHECK (value_type IN ('string','number','boolean')),
  confidence      REAL              CHECK (confidence  BETWEEN 0 AND 1),
  domain_authority REAL             CHECK (domain_authority BETWEEN 0 AND 1),
  freshness       REAL              CHECK (freshness BETWEEN 0 AND 1),
  source_url      TEXT,
  embedding       VECTOR(768),
  created_at      TIMESTAMPTZ       DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claims_subject_pred ON claims (subject_id, predicate);
CREATE INDEX IF NOT EXISTS idx_claims_scan         ON claims (scan_id);
CREATE INDEX IF NOT EXISTS idx_claims_predicate    ON claims (predicate);

CREATE INDEX IF NOT EXISTS idx_claims_embedding
  ON claims USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- claim_edges
-- Explicit graph edges between claims. Written once at claim
-- insertion time. Never mutated — conflicts are resolved in
-- the resolutions table.
-- ============================================================
CREATE TABLE IF NOT EXISTS claim_edges (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_a    UUID        NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_b    UUID        NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  edge_type  TEXT        NOT NULL CHECK (edge_type IN ('SUPPORTS','CONFLICTS','DUPLICATE')),
  weight     REAL        DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT claim_edges_no_self_loop CHECK (claim_a <> claim_b),
  CONSTRAINT claim_edges_ordered      CHECK (claim_a < claim_b)   -- deduplicate (A,B) vs (B,A)
);

CREATE INDEX IF NOT EXISTS idx_claim_edges_a    ON claim_edges (claim_a);
CREATE INDEX IF NOT EXISTS idx_claim_edges_b    ON claim_edges (claim_b);
CREATE INDEX IF NOT EXISTS idx_claim_edges_type ON claim_edges (edge_type);

-- ============================================================
-- entity_edges
-- Knowledge-graph relationships between entities. Used for
-- relationship inference, graph expansion, and context scoring.
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_edges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity   UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation    TEXT,                               -- "subsidiary_of" | "founded_by" | ...
  weight      REAL        DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_edges_from ON entity_edges (from_entity);
CREATE INDEX IF NOT EXISTS idx_entity_edges_to   ON entity_edges (to_entity);

-- ============================================================
-- claim_clusters
-- Materialized grouping: one cluster per (subject_id, predicate).
-- Do not recompute on every request — write once per unique pair.
-- ============================================================
CREATE TABLE IF NOT EXISTS claim_clusters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID        REFERENCES entities(id) ON DELETE CASCADE,
  predicate   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (subject_id, predicate)
);

CREATE INDEX IF NOT EXISTS idx_claim_clusters_subj_pred
  ON claim_clusters (subject_id, predicate);

-- ============================================================
-- cluster_members
-- Claim membership within clusters. Append-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS cluster_members (
  cluster_id UUID NOT NULL REFERENCES claim_clusters(id) ON DELETE CASCADE,
  claim_id   UUID NOT NULL REFERENCES claims(id)         ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, claim_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_members_claim ON cluster_members (claim_id);

-- ============================================================
-- resolutions
-- Probabilistic outcome per cluster. Multiple candidates per
-- cluster are valid — ordered by probability descending.
-- status maps to the system's verdict vocabulary.
-- ============================================================
CREATE TABLE IF NOT EXISTS resolutions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID        NOT NULL REFERENCES claim_clusters(id) ON DELETE CASCADE,
  value      TEXT,
  probability REAL       CHECK (probability BETWEEN 0 AND 1),
  support     REAL,
  status      TEXT       CHECK (status IN ('VERIFIED','DEGRADED','CONTRADICTORY')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resolutions_cluster ON resolutions (cluster_id);

-- ============================================================
-- generate_conflict_edges (helper function)
-- Call after batch-inserting claims for a scan_id.
-- Inserts CONFLICTS edges for all same-subject + same-predicate
-- pairs where the object values diverge. Uses ON CONFLICT DO
-- NOTHING so it is safe to call multiple times.
-- ============================================================
CREATE OR REPLACE FUNCTION generate_conflict_edges(p_scan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  inserted INTEGER;
BEGIN
  WITH pairs AS (
    SELECT
      c1.id AS a,
      c2.id AS b,
      1.0::REAL AS w
    FROM claims c1
    JOIN claims c2
      ON  c1.subject_id = c2.subject_id
      AND c1.predicate  = c2.predicate
      AND c1.id         < c2.id          -- enforce ordering (see CHECK constraint)
      AND c1.object_value IS DISTINCT FROM c2.object_value
    WHERE c1.scan_id = p_scan_id
      OR  c2.scan_id = p_scan_id
  )
  INSERT INTO claim_edges (claim_a, claim_b, edge_type, weight)
  SELECT a, b, 'CONFLICTS', w
  FROM pairs
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- ============================================================
-- upsert_claim_cluster (helper function)
-- Ensures a cluster exists for (subject_id, predicate) and
-- returns its id. Used by the application layer when writing
-- new claims.
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_claim_cluster(
  p_subject_id UUID,
  p_predicate  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cluster_id UUID;
BEGIN
  INSERT INTO claim_clusters (subject_id, predicate)
  VALUES (p_subject_id, p_predicate)
  ON CONFLICT (subject_id, predicate) DO NOTHING;

  SELECT id INTO v_cluster_id
  FROM claim_clusters
  WHERE subject_id = p_subject_id
    AND predicate  = p_predicate;

  RETURN v_cluster_id;
END;
$$;

-- ============================================================
-- Useful read queries (reference — not executed here)
-- ============================================================

-- Closest entities by embedding (dedup at ingestion):
--   SELECT id, canonical_name
--   FROM entities
--   ORDER BY embedding <-> $1
--   LIMIT 5;

-- Resolution lookup for a subject + predicate:
--   SELECT r.value, r.probability, r.status
--   FROM resolutions r
--   JOIN claim_clusters c ON r.cluster_id = c.id
--   WHERE c.subject_id = $1
--     AND c.predicate  = $2
--   ORDER BY r.probability DESC;

-- Most conflicted clusters:
--   SELECT cc.subject_id, cc.predicate, COUNT(ce.*) AS conflict_count
--   FROM claim_edges ce
--   JOIN claims cl ON ce.claim_a = cl.id
--   JOIN claim_clusters cc
--     ON cl.subject_id = cc.subject_id
--   WHERE ce.edge_type = 'CONFLICTS'
--   GROUP BY cc.subject_id, cc.predicate
--   ORDER BY conflict_count DESC;
