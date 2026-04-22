-- ============================================
-- AiVIS.biz - Full Database Schema
-- Run this against your Neon PostgreSQL database
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Analysis Cache
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

-- 2. Users (with tier and login tracking)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tier VARCHAR(20) DEFAULT 'observer',
    is_verified BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(32),
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);

-- 3. User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(128) UNIQUE NOT NULL,
    session_token_last4 VARCHAR(4),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address INET,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, revoked_at, expires_at DESC);

-- 4. Usage Tracking (for tier limits)
CREATE TABLE IF NOT EXISTS usage_daily (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    requests INT NOT NULL DEFAULT 0,
    scan_units NUMERIC(12,2) NOT NULL DEFAULT 1,
    compute_units INTEGER NOT NULL DEFAULT 0,
    entities_extracted INTEGER NOT NULL DEFAULT 0,
    citations_generated INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_date ON usage_daily(date);

-- 5. Payments (Stripe integration)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan VARCHAR(50),
    status VARCHAR(50),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    stripe_last_event_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_customer ON payments(stripe_customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_last_event_id ON payments(stripe_last_event_id) WHERE stripe_last_event_id IS NOT NULL;

-- 6. Audits (analysis history)
CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    normalized_url TEXT,
    run_group_id UUID NOT NULL DEFAULT gen_random_uuid(),
    prior_run_id UUID REFERENCES audits(id) ON DELETE SET NULL,
    snapshot_kind VARCHAR(20) NOT NULL DEFAULT 'snapshot',
    visibility_score INTEGER,
    result JSONB,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audits_user ON audits(user_id);
CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_normalized_url_created ON audits(normalized_url, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_run_group_created ON audits(run_group_id, created_at DESC);

-- ============================================
-- Done! Your database is ready for auth.
-- ============================================
