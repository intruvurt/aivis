import "dotenv/config"
import pg from 'pg'
import type { Pool, PoolClient } from 'pg'

const { Pool: PgPool } = pg

const DATABASE_URL = process.env.DATABASE_URL?.trim() || ''

export const dbConfigured = DATABASE_URL.length > 0

let poolInstance: Pool | null = null
let migrationsRan = false

export function getPool(): Pool {
  if (!dbConfigured) {
    throw new Error('DATABASE_URL not configured')
  }
  if (!poolInstance) {
    poolInstance = new PgPool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      // If you use Neon/hosted PG with SSL, prefer sslmode in URL.
      // Example: DATABASE_URL="...?...&sslmode=require"
    })
  }
  return poolInstance
}

/**
 * Run database migrations on startup (idempotent)
 */
export async function runMigrations(): Promise<void> {
  if (migrationsRan || !dbConfigured) return
  
  const client = await getPool().connect()
  try {
    console.log('🔄 Running database migrations...')
    
    // All migrations in one transaction
    await client.query('BEGIN')
    
    // 1. Analysis Cache
    await client.query(`
      CREATE TABLE IF NOT EXISTS analysis_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT UNIQUE NOT NULL,
        result JSONB NOT NULL,
        analyzed_at_timestamp BIGINT NOT NULL,
        analyzed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analysis_cache_url ON analysis_cache(url)`)
    
    // 2. Users
    await client.query(`
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
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier)`)
    
    // 3. User Sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(512) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)`)
    
    // 4. Usage Tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_daily (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        requests INT NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date)
      )
    `)
    
    // 5. Payments
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        plan VARCHAR(50),
        status VARCHAR(50),
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    
    // 6. Audits
    await client.query(`
      CREATE TABLE IF NOT EXISTS audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        url TEXT NOT NULL,
        visibility_score INTEGER,
        result JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    
    await client.query('COMMIT')
    migrationsRan = true
    console.log('✅ Database migrations complete')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', err)
    throw err
  } finally {
    client.release()
  }
}

/**
 * Exported Pool instance-like proxy for legacy imports.
 * Usage: pool.query(...), pool.connect()
 */
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as any
    return real[prop]
  },
}) as Pool

export async function getConnection(): Promise<PoolClient> {
  return getPool().connect()
}

export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch { /* ignore rollback errors */ }
    throw err
  } finally {
    client.release()
  }
}

export async function healthCheck(): Promise<boolean> {
  if (!dbConfigured) return false
  try {
    await getPool().query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export async function closePool(): Promise<void> {
  if (poolInstance) await poolInstance.end()
  poolInstance = null
}