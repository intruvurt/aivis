-- Add tier column to users table for subscription management
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'observer';

-- Add login attempt tracking for security
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Create index for tier queries
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
