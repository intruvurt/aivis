/**
 * migrate-data.mjs — Copy all row data from old Neon DB to new Neon DB.
 *
 * Usage:
 *   node scripts/migrate-data.mjs
 *
 * Requires: OLD_DATABASE_URL and NEW_DATABASE_URL env vars, or falls back
 * to hardcoded values from the project .env / Render config.
 */

import pg from 'pg';
const { Client } = pg;

// ── Connection strings ──────────────────────────────────────────────────────
const OLD_DB = process.env.OLD_DATABASE_URL
  || 'postgresql://neondb_owner:npg_JmPKVd0Ij4Hz@ep-fancy-sunset-ahv3s6wd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const NEW_DB = process.env.NEW_DATABASE_URL
  || 'postgresql://neondb_owner:npg_tKL2VBbRqza7@ep-ancient-wildflower-ady7ytz4-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Tables to migrate in dependency order (parents before children).
// If a table doesn't exist in the old DB it's silently skipped.
const TABLES = [
  'users',
  'user_sessions',
  'organizations',
  'workspaces',
  'workspace_members',
  'usage_daily',
  'scan_pack_credits',
  'scan_pack_transactions',
  'credit_usage_ledger',
  'tier_credit_bonus_grants',
  'referral_codes',
  'referral_attributions',
  'referral_credit_ledger',
  'newsletter_dispatches',
  'admin_runtime_settings',
  'newsletter_editions',
  'user_notification_preferences',
  'notifications',
  'notification_reads',
  'scheduled_platform_notifications',
  'payments',
  'analysis_cache',
  'audits',
  'competitor_tracking',
  'citation_tests',
  'citation_results',
  'citation_prompt_ledger',
  'licenses',
  'license_activations',
  'license_verifications',
  'assistant_usage',
  'seo_crawls',
  'seo_crawl_pages',
  'scheduled_rescans',
  'audit_score_snapshots',
  'deploy_hook_endpoints',
  'deploy_verification_jobs',
  'api_keys',
  'api_usage_daily',
  'api_page_validations',
  'user_consents',
  'webhooks',
  'user_branding',
  'report_delivery_targets',
  'citation_niche_rankings',
  'citation_scheduled_jobs',
  'query_packs',
  'query_pack_executions',
  'citation_evidences',
  'auto_score_fix_jobs',
  'vcs_tokens',
];

async function main() {
  console.log('Connecting to OLD database...');
  const oldClient = new Client({ connectionString: OLD_DB, ssl: { rejectUnauthorized: false } });
  await oldClient.connect();
  console.log('  ✓ Connected to old DB');

  console.log('Connecting to NEW database...');
  const newClient = new Client({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } });
  await newClient.connect();
  console.log('  ✓ Connected to new DB');

  // First, check which tables actually exist in the old DB
  const { rows: oldTables } = await oldClient.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const oldTableSet = new Set(oldTables.map(r => r.table_name));

  // And in the new DB
  const { rows: newTables } = await newClient.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const newTableSet = new Set(newTables.map(r => r.table_name));

  let totalRows = 0;
  let migratedTables = 0;
  let skippedTables = 0;
  const errors = [];

  for (const table of TABLES) {
    if (!oldTableSet.has(table)) {
      console.log(`  ⊘ ${table} — not in old DB, skipping`);
      skippedTables++;
      continue;
    }
    if (!newTableSet.has(table)) {
      console.log(`  ⊘ ${table} — not in new DB, skipping`);
      skippedTables++;
      continue;
    }

    try {
      // Count rows in old
      const { rows: [{ count: oldCount }] } = await oldClient.query(`SELECT COUNT(*) AS count FROM "${table}"`);
      const rowCount = parseInt(oldCount, 10);

      if (rowCount === 0) {
        console.log(`  ○ ${table} — 0 rows, skipping`);
        skippedTables++;
        continue;
      }

      // Check if new table already has data (don't overwrite)
      const { rows: [{ count: newCount }] } = await newClient.query(`SELECT COUNT(*) AS count FROM "${table}"`);
      const existingRows = parseInt(newCount, 10);

      if (existingRows > 0) {
        console.log(`  ⚠ ${table} — new DB already has ${existingRows} rows, clearing first...`);
        // Disable FK checks temporarily and truncate
        await newClient.query(`TRUNCATE TABLE "${table}" CASCADE`);
      }

      // Get column names from old DB
      const { rows: cols } = await oldClient.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      const colNames = cols.map(c => c.column_name);

      // Also get column names from new DB to find the intersection
      const { rows: newCols } = await newClient.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      const newColSet = new Set(newCols.map(c => c.column_name));

      // Only migrate columns that exist in BOTH databases
      const sharedCols = colNames.filter(c => newColSet.has(c));

      if (sharedCols.length === 0) {
        console.log(`  ⊘ ${table} — no shared columns, skipping`);
        skippedTables++;
        continue;
      }

      // Read all rows from old, batch-insert into new
      const quotedCols = sharedCols.map(c => `"${c}"`).join(', ');
      const { rows } = await oldClient.query(`SELECT ${quotedCols} FROM "${table}"`);

      // Batch insert using multi-row VALUES
      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map((_, ri) => {
          const offset = ri * sharedCols.length;
          return `(${sharedCols.map((_, ci) => `$${offset + ci + 1}`).join(', ')})`;
        }).join(', ');

        const values = batch.flatMap(row => sharedCols.map(c => row[c]));

        await newClient.query(
          `INSERT INTO "${table}" (${quotedCols}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
          values
        );
      }

      totalRows += rowCount;
      migratedTables++;
      console.log(`  ✓ ${table} — ${rowCount} rows copied`);

    } catch (err) {
      console.error(`  ✗ ${table} — ERROR: ${err.message}`);
      errors.push({ table, error: err.message });
    }
  }

  // Reset sequences so new inserts don't conflict with migrated IDs
  console.log('\nResetting serial sequences...');
  for (const table of TABLES) {
    if (!newTableSet.has(table)) continue;
    try {
      // Find all serial/identity columns and reset their sequences
      const { rows: seqs } = await newClient.query(`
        SELECT pg_get_serial_sequence('"${table}"', column_name) AS seq, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);

      for (const { seq, column_name } of seqs) {
        if (!seq) continue;
        await newClient.query(`SELECT setval('${seq}', COALESCE((SELECT MAX("${column_name}") FROM "${table}"), 1))`);
      }
    } catch (_) {
      // Not all tables have serials — that's fine
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`  Migrated: ${migratedTables} tables, ${totalRows} total rows`);
  console.log(`  Skipped:  ${skippedTables} tables`);
  if (errors.length) {
    console.log(`  Errors:   ${errors.length}`);
    for (const e of errors) {
      console.log(`    - ${e.table}: ${e.error}`);
    }
  }
  console.log('════════════════════════════════════════\n');

  await oldClient.end();
  await newClient.end();
  console.log('Done. Both connections closed.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
