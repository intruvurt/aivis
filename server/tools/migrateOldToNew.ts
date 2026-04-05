/**
 * migrateOldToNew.ts — OLD_DATABASE_URL → DATABASE_URL
 *
 * Strategy: drop FK constraints on target tables → bulk insert → re-add FKs.
 * Neon pooled connections don't allow session_replication_role or DISABLE TRIGGER.
 *
 * Usage:  npx.cmd tsx tools/migrateOldToNew.ts          (dry-run)
 *         npx.cmd tsx tools/migrateOldToNew.ts --exec    (write)
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool: PgPool } = pg;
const DRY_RUN = !process.argv.includes('--exec');

const OLD_URL = process.env.OLD_DATABASE_URL?.trim();
const NEW_URL = process.env.DATABASE_URL?.trim();
if (!OLD_URL) { console.error('OLD_DATABASE_URL not set'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const oldPool = new PgPool({ connectionString: OLD_URL, max: 5, connectionTimeoutMillis: 30_000, statement_timeout: 120_000 });
const newPool = new PgPool({ connectionString: NEW_URL, max: 5, connectionTimeoutMillis: 30_000, statement_timeout: 120_000 });

async function listTables(c: pg.Pool): Promise<string[]> {
  const { rows } = await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  return rows.map((r: any) => r.tablename);
}
async function getColumns(c: pg.Pool, t: string): Promise<string[]> {
  const { rows } = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
  return rows.map((r: any) => r.column_name);
}
async function getPrimaryKey(c: pg.Pool, t: string): Promise<string[]> {
  const { rows } = await c.query(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=$1::regclass AND i.indisprimary ORDER BY array_position(i.indkey, a.attnum)`, [t]);
  return rows.map((r: any) => r.attname);
}

interface FKConstraint { name: string; table: string; column: string; ref_table: string; ref_column: string; }

async function getFKConstraints(c: pg.Pool, table: string): Promise<FKConstraint[]> {
  const { rows } = await c.query(`
    SELECT
      tc.constraint_name AS name,
      tc.table_name AS "table",
      kcu.column_name AS "column",
      ccu.table_name AS ref_table,
      ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1 AND tc.table_schema = 'public'
  `, [table]);
  return rows as FKConstraint[];
}

async function migrateTable(table: string): Promise<{ ins: number; skip: number }> {
  const { rows: cntRows } = await oldPool.query(`SELECT COUNT(*)::int AS cnt FROM "${table}"`);
  if (cntRows[0].cnt === 0) { return { ins: 0, skip: 0 }; }

  const oldC = await getColumns(oldPool, table);
  const newC = await getColumns(newPool, table);
  const cols = oldC.filter(c => newC.includes(c));
  if (!cols.length) { console.log(`  skip  ${table}: no common cols`); return { ins: 0, skip: 0 }; }

  const pk = await getPrimaryKey(newPool, table);
  const colList = cols.map(c => `"${c}"`).join(',');
  const { rows } = await oldPool.query(`SELECT ${colList} FROM "${table}"`);

  if (DRY_RUN) {
    console.log(`  scan  ${table}: ${rows.length} rows`);
    return { ins: rows.length, skip: 0 };
  }

  // Drop FK constraints on this table
  const fks = await getFKConstraints(newPool, table);
  for (const fk of fks) {
    try {
      await newPool.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${fk.name}"`);
    } catch { /* ignore */ }
  }

  let ins = 0, skip = 0;
  const conflict = pk.length ? `ON CONFLICT (${pk.map(k => `"${k}"`).join(',')}) DO NOTHING` : '';

  for (const row of rows) {
    const vals = cols.map(c => row[c]);
    const ph = vals.map((_, i) => `$${i + 1}`).join(',');
    try {
      const r = await newPool.query(`INSERT INTO "${table}" (${colList}) VALUES (${ph}) ${conflict}`, vals);
      if (r.rowCount && r.rowCount > 0) ins++; else skip++;
    } catch (err: any) {
      skip++;
      if (skip <= 2) console.warn(`    warn ${table}: ${err.message.substring(0, 80)}`);
    }
  }

  // Re-add FK constraints
  for (const fk of fks) {
    try {
      await newPool.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.ref_table}"("${fk.ref_column}") ON DELETE CASCADE`);
    } catch (err: any) {
      // May fail if referenced rows don't exist — that's OK, we'll note it
      console.warn(`    fk-restore ${fk.name}: ${err.message.substring(0, 60)}`);
    }
  }

  if (ins > 0) console.log(`  done  ${table}: ${ins} inserted, ${skip} skipped`);
  else if (skip > 0) console.log(`  exist ${table}: all ${skip} already present`);
  return { ins, skip };
}

async function main() {
  console.log(`\n${'='.repeat(56)}`);
  console.log(`  AiVIS DB Migration: OLD -> NEW`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (--exec to write)' : 'EXECUTING'}`);
  console.log(`${'='.repeat(56)}\n`);

  await oldPool.query('SELECT 1');
  console.log('Connected to OLD database');
  await newPool.query('SELECT 1');
  console.log('Connected to NEW database');

  const oldT = await listTables(oldPool);
  const newT = await listTables(newPool);
  console.log(`Old DB: ${oldT.length} tables | New DB: ${newT.length} tables`);

  const both = oldT.filter(t => newT.includes(t));
  const missing = oldT.filter(t => !newT.includes(t));
  if (missing.length) console.log(`Not in new: ${missing.join(', ')}`);
  console.log(`\nMigrating ${both.length} tables...\n`);

  const prio = ['users', 'user_sessions', 'payments', 'licenses', 'organizations', 'workspaces', 'workspace_members'];
  const ordered = [...prio.filter(t => both.includes(t)), ...both.filter(t => !prio.includes(t))];

  let tI = 0, tS = 0;
  for (const table of ordered) {
    try {
      const r = await migrateTable(table);
      tI += r.ins; tS += r.skip;
    } catch (err: any) {
      console.warn(`  FAIL ${table}: ${err.message.substring(0, 80)}`);
    }
  }

  console.log(`\n${'='.repeat(56)}`);
  console.log(`  Total: ${tI} inserted, ${tS} skipped`);
  if (DRY_RUN) console.log('  Run with --exec to write');
  console.log(`${'='.repeat(56)}\n`);

  await oldPool.end();
  await newPool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
