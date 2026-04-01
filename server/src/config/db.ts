import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const { Pool } = pg;
const PG_URI = process.env.PG_URI || process.env.DATABASE_URL || '';

// NOTE: This module is DEPRECATED. Use getPool() from services/postgresql.ts instead.
// The pool is lazily created to avoid consuming connections on module import.
let _pool: pg.Pool | null = null;

function getLegacyPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: PG_URI,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      statement_timeout: 30_000,
    });

    _pool.on('error', (err) => {
      console.error('PostgreSQL legacy pool error (non-fatal)', err.message);
    });
  }
  return _pool;
}

export default getLegacyPool();
