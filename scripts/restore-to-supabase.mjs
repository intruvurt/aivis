/**
 * restore-to-supabase.mjs — Restore Neon backup SQL into Supabase.
 *
 * Usage:
 *   SUPABASE_URL="postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres" node scripts/restore-to-supabase.mjs
 *
 * Or set SUPABASE_URL in server/.env and run:
 *   node scripts/restore-to-supabase.mjs
 *
 * What it does:
 *   1. Drops all existing public tables in Supabase (clean slate)
 *   2. Reads the backup SQL file
 *   3. Splits into statements and executes them in batches
 *   4. Handles CREATE TABLE, INSERT, and CREATE INDEX statements
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Load env from server/.env if present ──
function loadEnv() {
  const envPath = path.join(ROOT, 'server', '.env');
  if (!fs.existsSync(envPath)) return;
  const env = fs.readFileSync(envPath, 'utf-8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL not set. Pass it as an environment variable:');
  console.error('   SUPABASE_URL="postgresql://..." node scripts/restore-to-supabase.mjs');
  process.exit(1);
}

// ── Pick the most recent backup ──
const backupDir = path.join(ROOT, 'backups');
const backupFiles = fs.readdirSync(backupDir)
  .filter(f => f.endsWith('.sql'))
  .sort()
  .reverse();

if (backupFiles.length === 0) {
  console.error('❌ No .sql backup files found in backups/');
  process.exit(1);
}

const backupFile = path.join(backupDir, backupFiles[0]);
console.log(`📂 Using backup: ${backupFiles[0]}`);

// ── Connect to Supabase ──
const client = new pg.Client({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Increase statement timeout for large restores
  statement_timeout: 120000,
});

async function run() {
  await client.connect();
  console.log('✓ Connected to Supabase');

  // Step 1: Drop all existing tables in public schema (clean slate)
  console.log('\n🗑️  Dropping existing public tables...');
  const { rows: existingTables } = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);

  if (existingTables.length > 0) {
    // Drop all at once with CASCADE to handle foreign keys
    const dropList = existingTables.map(r => `"${r.tablename}"`).join(', ');
    await client.query(`DROP TABLE IF EXISTS ${dropList} CASCADE`);
    console.log(`  ✓ Dropped ${existingTables.length} tables`);
  } else {
    console.log('  (no existing tables)');
  }

  // Also drop existing indexes in public schema (they'll be recreated)
  const { rows: existingIndexes } = await client.query(`
    SELECT indexname FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname NOT LIKE 'pg_%'
  `);
  for (const { indexname } of existingIndexes) {
    try { await client.query(`DROP INDEX IF EXISTS "${indexname}"`); } catch { /* ignore */ }
  }

  // Step 2: Read backup
  console.log('\n📖 Reading backup file...');
  const sql = fs.readFileSync(backupFile, 'utf-8');

  // Step 3: Split into statements
  // The backup has one statement per line (no multi-line statements)
  const lines = sql.split('\n');
  
  let createTableCount = 0;
  let insertCount = 0;
  let indexCount = 0;
  let errorCount = 0;
  let skipCount = 0;

  // Phase 1: CREATE TABLE statements
  console.log('\n📋 Phase 1: Creating tables...');
  const createStatements = [];
  let inCreateTable = false;
  let currentCreate = '';
  
  for (const line of lines) {
    if (line.startsWith('CREATE TABLE IF NOT EXISTS')) {
      inCreateTable = true;
      currentCreate = line;
    } else if (inCreateTable) {
      currentCreate += '\n' + line;
      if (line.startsWith(');')) {
        createStatements.push(currentCreate);
        inCreateTable = false;
        currentCreate = '';
      }
    }
  }

  for (let stmt of createStatements) {
    // Fix: backup used bare "ARRAY" type — replace with "text[]"
    stmt = stmt.replace(/"(\w+)" ARRAY/g, '"$1" text[]');
    try {
      await client.query(stmt);
      createTableCount++;
    } catch (err) {
      const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS "([^"]+)"/)?.[1] || '?';
      console.error(`  ⚠ CREATE TABLE "${tableName}": ${err.message.slice(0, 100)}`);
      errorCount++;
    }
  }
  console.log(`  ✓ Created ${createTableCount} tables (${errorCount} errors)`);

  // Phase 2: INSERT data (no transactions — pooler-safe)
  console.log('\n💾 Phase 2: Inserting data...');
  errorCount = 0;
  const insertLines = lines.filter(l => l.startsWith('INSERT INTO'));
  const totalInserts = insertLines.length;
  
  for (let i = 0; i < insertLines.length; i++) {
    const stmt = insertLines[i];
    try {
      await client.query(stmt);
      insertCount++;
    } catch (err) {
      if (errorCount < 10) {
        const table = stmt.match(/INSERT INTO "([^"]+)"/)?.[1] || '?';
        console.error(`  ⚠ INSERT "${table}": ${err.message.slice(0, 120)}`);
      }
      errorCount++;
    }

    // Progress every 500 rows
    if ((i + 1) % 500 === 0 || i === insertLines.length - 1) {
      const pct = (((i + 1) / totalInserts) * 100).toFixed(0);
      process.stdout.write(`\r  ⏳ ${i + 1}/${totalInserts} (${pct}%) — ${insertCount} ok, ${errorCount} errors`);
    }
  }
  console.log(`\n  ✓ Inserted ${insertCount} rows (${errorCount} errors)`);

  // Phase 3: CREATE INDEX statements
  console.log('\n🔑 Phase 3: Creating indexes...');
  errorCount = 0;
  const indexLines = lines.filter(l => l.startsWith('CREATE INDEX') || l.startsWith('CREATE UNIQUE INDEX'));
  
  for (const stmt of indexLines) {
    try {
      await client.query(stmt);
      indexCount++;
    } catch (err) {
      if (errorCount < 5) {
        const idxName = stmt.match(/(CREATE (?:UNIQUE )?INDEX )(\S+)/)?.[2] || '?';
        console.error(`  ⚠ INDEX ${idxName}: ${err.message.slice(0, 100)}`);
      }
      errorCount++;
    }
  }
  console.log(`  ✓ Created ${indexCount} indexes (${errorCount} errors)`);

  // Step 4: Verify key tables
  console.log('\n🔍 Verification:');
  const checks = ['users', 'audits', 'analysis_cache', 'user_sessions', 'usage_daily', 'payments'];
  for (const table of checks) {
    try {
      const { rows } = await client.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      console.log(`  ${table}: ${rows[0].cnt} rows`);
    } catch {
      console.log(`  ${table}: (table not found)`);
    }
  }

  console.log('\n✅ Restore complete!');
  await client.end();
}

run().catch(async (err) => {
  console.error('\n❌ Restore failed:', err.message);
  try { await client.end(); } catch { /* ignore */ }
  process.exit(1);
});
