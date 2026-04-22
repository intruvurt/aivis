CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ingestion lifecycle control plane.
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'fetched', 'parsed', 'analyzed', 'completed', 'failed')),
  priority INT NOT NULL DEFAULT 0,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ingestion_jobs_url_hash_unique UNIQUE (url_hash)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_url_hash ON ingestion_jobs(url_hash);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_schedule ON ingestion_jobs(status, scheduled_at, priority DESC);

-- Immutable fetch snapshots for replayability and forensics.
CREATE TABLE IF NOT EXISTS crawl_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_job_id UUID REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
  url_hash TEXT NOT NULL,
  final_url TEXT,
  http_status INT,
  headers JSONB,
  html TEXT,
  text_content TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_snapshots_url_hash ON crawl_snapshots(url_hash);
CREATE INDEX IF NOT EXISTS idx_crawl_snapshots_job ON crawl_snapshots(ingestion_job_id);
CREATE INDEX IF NOT EXISTS idx_crawl_snapshots_fetched_at ON crawl_snapshots(fetched_at DESC);

-- Structured entities extracted from snapshots.
CREATE TABLE IF NOT EXISTS extracted_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_snapshot_id UUID REFERENCES crawl_snapshots(id) ON DELETE CASCADE,
  url_hash TEXT NOT NULL,
  entity_type TEXT,
  entity_value TEXT,
  confidence DOUBLE PRECISION,
  context TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_entities_url_hash ON extracted_entities(url_hash);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_snapshot ON extracted_entities(crawl_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type_value ON extracted_entities(entity_type, entity_value);

-- Latest analysis snapshot (hot read path).
CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash TEXT NOT NULL UNIQUE,
  score INT,
  visibility_score INT,
  result JSONB NOT NULL,
  model_version TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_expires ON analysis_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_analysis_results_analyzed ON analysis_results(analyzed_at DESC);

-- Append-only run history for temporal diffs and regression tracking.
CREATE TABLE IF NOT EXISTS analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash TEXT NOT NULL,
  run_id UUID NOT NULL,
  score INT,
  visibility_score INT,
  delta JSONB,
  result_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_url_hash ON analysis_runs(url_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_run_id ON analysis_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at ON analysis_runs(created_at DESC);

-- Citation attribution graph tied to analyzed entities.
CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID REFERENCES analysis_runs(id) ON DELETE SET NULL,
  extracted_entity_id UUID REFERENCES extracted_entities(id) ON DELETE SET NULL,
  url_hash TEXT NOT NULL,
  source TEXT,
  target_entity TEXT,
  mention_count INT NOT NULL DEFAULT 1,
  confidence DOUBLE PRECISION,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_url_hash ON citations(url_hash);
CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source);
CREATE INDEX IF NOT EXISTS idx_citations_target_entity ON citations(target_entity);
