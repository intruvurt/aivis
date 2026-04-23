-- ============================================================
-- AiVIS — Graph Expansion Pipeline
-- Migration 019: entity_relationships · visibility_events ·
--                content_pages · rss_events
--
-- Extends the graph knowledge layer with the semantic
-- relationship engine, VisibilityEvent ledger, generated
-- content registry, and RSS event feed.
-- ============================================================

-- ── entity_relationships ──────────────────────────────────────────────────────
-- Stores typed semantic edges between entity nodes.
-- relationship_type mirrors the pipeline design spec:
--   mentions | competes_with | explains | fails_at | improves | is_part_of | replaces
-- strength is a 0–1 float computed by the relationship engine.
-- evidence_url is the originating scan URL that justified this edge.
CREATE TABLE IF NOT EXISTS entity_relationships (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    from_entity_id    UUID        REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id      UUID        REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type TEXT        NOT NULL
                      CHECK (relationship_type IN (
                          'mentions','competes_with','explains','fails_at',
                          'improves','is_part_of','replaces'
                      )),
    strength          DOUBLE PRECISION NOT NULL DEFAULT 0.5
                      CHECK (strength >= 0 AND strength <= 1),
    evidence_url      TEXT,
    scan_id           UUID        REFERENCES scans(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate edges between the same pair with same type
CREATE UNIQUE INDEX IF NOT EXISTS entity_relationships_dedup
    ON entity_relationships (from_entity_id, to_entity_id, relationship_type);

CREATE INDEX IF NOT EXISTS entity_relationships_from_idx
    ON entity_relationships (from_entity_id, relationship_type);

CREATE INDEX IF NOT EXISTS entity_relationships_to_idx
    ON entity_relationships (to_entity_id, relationship_type);

CREATE INDEX IF NOT EXISTS entity_relationships_scan_idx
    ON entity_relationships (scan_id)
    WHERE scan_id IS NOT NULL;

-- ── visibility_events ─────────────────────────────────────────────────────────
-- Immutable record of every LLM probe result.
-- Each row = one model's answer to one probe prompt, with citation data.
-- This is the VisibilityEvent ledger — retrieval behavior recorded as data.
CREATE TABLE IF NOT EXISTS visibility_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id         UUID        REFERENCES scans(id) ON DELETE SET NULL,
    entity          TEXT        NOT NULL,
    prompt          TEXT        NOT NULL,
    model_used      TEXT        NOT NULL,
    cited_sources   TEXT[]      NOT NULL DEFAULT '{}',
    missing_sources TEXT[]      NOT NULL DEFAULT '{}',
    position_rank   SMALLINT,   -- rank of entity in model answer (NULL if absent)
    entity_present  BOOLEAN     NOT NULL DEFAULT FALSE,
    raw_answer      TEXT,
    probed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visibility_events_entity_idx
    ON visibility_events (entity, probed_at DESC);

CREATE INDEX IF NOT EXISTS visibility_events_scan_idx
    ON visibility_events (scan_id)
    WHERE scan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS visibility_events_model_idx
    ON visibility_events (model_used, probed_at DESC);

-- ── content_pages ─────────────────────────────────────────────────────────────
-- Registry of all auto-generated indexable pages.
-- page_type reflects the pipeline design spec:
--   definition | comparison | failure_state | evidence
-- slug is the URL-ready path segment (no leading slash).
-- jsonld stores the embedded schema.org @graph.
-- status tracks generation → published lifecycle.
CREATE TABLE IF NOT EXISTS content_pages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id         UUID        REFERENCES scans(id) ON DELETE SET NULL,
    entity          TEXT        NOT NULL,
    page_type       TEXT        NOT NULL
                    CHECK (page_type IN ('definition','comparison','failure_state','evidence')),
    title           TEXT        NOT NULL,
    slug            TEXT        NOT NULL UNIQUE,
    html_body       TEXT,
    jsonld          JSONB,
    internal_links  TEXT[]      NOT NULL DEFAULT '{}',
    gap_ids         TEXT[]      NOT NULL DEFAULT '{}',  -- originating gap IDs
    status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
    indexed_at      TIMESTAMPTZ,  -- set after IndexNow submission
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_pages_entity_idx
    ON content_pages (entity);

CREATE INDEX IF NOT EXISTS content_pages_type_status_idx
    ON content_pages (page_type, status);

CREATE INDEX IF NOT EXISTS content_pages_slug_idx
    ON content_pages (slug);

-- ── rss_events ────────────────────────────────────────────────────────────────
-- Feed items for the RSS emitter.
-- event_type: gap_discovered | citation_failure | page_published | graph_updated
-- Each row becomes one <item> in the RSS XML response.
CREATE TABLE IF NOT EXISTS rss_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  TEXT        NOT NULL
                CHECK (event_type IN (
                    'gap_discovered','citation_failure',
                    'page_published','graph_updated'
                )),
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    link        TEXT,
    entity      TEXT,
    scan_id     UUID        REFERENCES scans(id) ON DELETE SET NULL,
    page_id     UUID        REFERENCES content_pages(id) ON DELETE CASCADE,
    emitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rss_events_emitted_idx
    ON rss_events (emitted_at DESC);

CREATE INDEX IF NOT EXISTS rss_events_type_idx
    ON rss_events (event_type, emitted_at DESC);
