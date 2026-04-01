-- Table for persistent analysis cache
CREATE TABLE IF NOT EXISTS analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE NOT NULL,
    result JSONB NOT NULL,
    analyzed_at_timestamp BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_url ON analysis_cache(url);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_updated ON analysis_cache(updated_at);
