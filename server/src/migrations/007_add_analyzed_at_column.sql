-- Add analyzed_at TIMESTAMPTZ column to analysis_cache (if not exists)
-- This allows using timestamp comparison queries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'analysis_cache' AND column_name = 'analyzed_at'
    ) THEN
        ALTER TABLE analysis_cache ADD COLUMN analyzed_at TIMESTAMPTZ DEFAULT NOW();
        
        -- Backfill from timestamp if it exists
        UPDATE analysis_cache 
        SET analyzed_at = to_timestamp(analyzed_at_timestamp / 1000.0)
        WHERE analyzed_at_timestamp IS NOT NULL;
        
        -- Create index for time-based queries
        CREATE INDEX IF NOT EXISTS idx_analysis_cache_analyzed_at ON analysis_cache(analyzed_at);
    END IF;
END $$;
