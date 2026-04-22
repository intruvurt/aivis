CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_url TEXT NOT NULL,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,
    result JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'fresh',
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    last_accessed_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    hit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_url_hash UNIQUE (url_hash),
    CONSTRAINT analysis_cache_status_check CHECK (status IN ('fresh', 'stale', 'expired', 'invalidated', 'revalidated'))
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_url ON analysis_cache(url);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_url_hash ON analysis_cache(url_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_status_expires ON analysis_cache(status, expires_at);