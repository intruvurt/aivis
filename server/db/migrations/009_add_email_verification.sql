-- Add email verification columns if they don't exist
DO $$
BEGIN
  -- Add verification_token column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'verification_token') THEN
    ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
  END IF;

  -- Add verification_token_expires column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'verification_token_expires') THEN
    ALTER TABLE users ADD COLUMN verification_token_expires TIMESTAMPTZ;
  END IF;

  -- Ensure is_verified column exists (should be from 002_create_users.sql)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'is_verified') THEN
    ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add name column if missing (some schemas have it, some don't)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'name') THEN
    ALTER TABLE users ADD COLUMN name VARCHAR(255);
  END IF;
END $$;

-- Update existing users without verification status (if any exist from old schema)
UPDATE users SET is_verified = FALSE WHERE is_verified IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.is_verified IS 'Email verification status - must be TRUE to use analyzer';
COMMENT ON COLUMN users.verification_token IS 'Token sent via email for verification';
COMMENT ON COLUMN users.verification_token_expires IS 'Expiration time for verification token';
