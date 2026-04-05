#!/usr/bin/env node
/**
 * migrate-users.mjs - Copy users from the old Neon DB to the new one.
 *
 * Usage (from repo root):
 *   node scripts/migrate-users.mjs
 *
 * Before running:
 *   1. Set OLD_DATABASE_URL in server/.env (or export it)
 *   2. Set DATABASE_URL in server/.env pointing to the NEW database
 *
 * What it does:
 *   - Reads ALL users from the old DB
 *   - For each user, upserts into the new DB by email (dedup-safe)
 *   - Also migrates: usage_daily, payments, audits, user_notification_preferences
 *   - Preserves original UUIDs where possible (avoids FK breakage)
 *   - Dry-run mode by default - pass --execute to actually write
 *
 * Safety:
 *   - Uses ON CONFLICT (email) DO NOTHING for users - never overwrites existing
 *   - Skips child rows whose user already exists in target (avoids dupes)
 *   - Runs inside a transaction so it's all-or-nothing
 */

import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../server/.env') });

const OLD_DB = process.env.OLD_DATABASE_URL;
const NEW_DB = process.env.DATABASE_URL;
const EXECUTE = process.argv.includes('--execute');

if (!OLD_DB) {
  console.error('ERROR: OLD_DATABASE_URL is not set in server/.env');
  console.error('Add it like: OLD_DATABASE_URL=postgresql://...');
  process.exit(1);
}
if (!NEW_DB) {
  console.error('ERROR: DATABASE_URL (new) is not set in server/.env');
  process.exit(1);
}
if (OLD_DB === NEW_DB) {
  console.error('ERROR: OLD_DATABASE_URL and DATABASE_URL are the same string. Aborting.');
  process.exit(1);
}

const sslOpts = { rejectUnauthorized: false };
const oldPool = new pg.Pool({ connectionString: OLD_DB, ssl: sslOpts, max: 2 });
const newPool = new pg.Pool({ connectionString: NEW_DB, ssl: sslOpts, max: 2 });

async function testConnection(pool, label) {
  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    if (rows[0]?.ok === 1) {
      console.log(`✓ ${label} connection OK`);
      return true;
    }
  } catch (e) {
    console.error(`✗ ${label} connection FAILED:`, e.message);
  }
  return false;
}

async function run() {
  console.log(`\nMode: ${EXECUTE ? '🔴 EXECUTE (writes to new DB)' : '🟡 DRY RUN (pass --execute to write)'}\n`);

  // 1. Test both connections
  const oldOk = await testConnection(oldPool, 'Old DB');
  const newOk = await testConnection(newPool, 'New DB');
  if (!oldOk || !newOk) {
    console.error('\nCannot proceed - fix connection issues above.');
    process.exit(1);
  }

  // 2. Read all users from old DB
  console.log('\n── Reading users from old DB ──');
  const { rows: oldUsers } = await oldPool.query(`
    SELECT id, email, password_hash, tier, is_verified, mfa_secret,
           login_attempts, locked_until, last_login, created_at, updated_at,
           name, role, verification_token, verification_token_expires,
           stripe_subscription_id, stripe_customer_id, company, website, bio,
           avatar_url, timezone, language, org_description, org_logo_url,
           org_favicon_url, org_phone, org_address, org_verified,
           org_verification_confidence, org_verification_reasons,
           trial_ends_at, trial_used, trial_tier, trial_started_at, trial_converted
    FROM users ORDER BY created_at
  `);
  console.log(`Found ${oldUsers.length} users in old DB:\n`);
  oldUsers.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email}  tier=${u.tier}  verified=${u.is_verified}  role=${u.role || 'user'}  created=${u.created_at?.toISOString?.().slice(0, 10)}`);
  });

  // 3. Check which emails already exist in new DB
  const { rows: newExisting } = await newPool.query('SELECT id, email FROM users');
  const existingEmails = new Set(newExisting.map(r => r.email.toLowerCase().trim()));
  console.log(`\nNew DB already has ${newExisting.length} users.`);

  const toMigrate = oldUsers.filter(u => !existingEmails.has(u.email.toLowerCase().trim()));
  const skipped = oldUsers.filter(u => existingEmails.has(u.email.toLowerCase().trim()));

  if (skipped.length > 0) {
    console.log(`\n⏭  Skipping ${skipped.length} users (already in new DB):`);
    skipped.forEach(u => console.log(`    - ${u.email}`));
  }

  if (toMigrate.length === 0) {
    console.log('\n✓ No new users to migrate - all already in new DB.');
    await cleanup();
    return;
  }

  console.log(`\n📋 Will migrate ${toMigrate.length} users:`);
  toMigrate.forEach(u => console.log(`    + ${u.email} (${u.tier}, verified=${u.is_verified})`));

  if (!EXECUTE) {
    console.log('\n🟡 DRY RUN complete. Run with --execute to apply.');
    await cleanup();
    return;
  }

  // 4. Execute migration inside transaction
  console.log('\n── Migrating users ──');
  const client = await newPool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    let childRows = { usage: 0, payments: 0, audits: 0, prefs: 0 };

    for (const u of toMigrate) {
      // Insert user preserving original UUID
      const res = await client.query(`
        INSERT INTO users (
          id, email, password_hash, tier, is_verified, mfa_secret,
          login_attempts, locked_until, last_login, created_at, updated_at,
          name, role, verification_token, verification_token_expires,
          stripe_subscription_id, stripe_customer_id, company, website, bio,
          avatar_url, timezone, language, org_description, org_logo_url,
          org_favicon_url, org_phone, org_address, org_verified,
          org_verification_confidence, org_verification_reasons,
          trial_ends_at, trial_used, trial_tier, trial_started_at, trial_converted
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36
        )
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [
        u.id, u.email, u.password_hash, u.tier, u.is_verified, u.mfa_secret,
        u.login_attempts || 0, u.locked_until, u.last_login, u.created_at, u.updated_at,
        u.name, u.role || 'user', u.verification_token, u.verification_token_expires,
        u.stripe_subscription_id, u.stripe_customer_id, u.company, u.website, u.bio,
        u.avatar_url, u.timezone, u.language, u.org_description, u.org_logo_url,
        u.org_favicon_url, u.org_phone, u.org_address, u.org_verified || false,
        u.org_verification_confidence, u.org_verification_reasons ? JSON.stringify(u.org_verification_reasons) : null,
        u.trial_ends_at, u.trial_used || false, u.trial_tier, u.trial_started_at, u.trial_converted || false,
      ]);

      if (res.rowCount > 0) {
        inserted++;
        console.log(`  ✓ ${u.email}`);

        // Migrate usage_daily for this user
        try {
          const { rows: usageRows } = await oldPool.query(
            'SELECT date, requests FROM usage_daily WHERE user_id = $1', [u.id]
          );
          for (const row of usageRows) {
            await client.query(`
              INSERT INTO usage_daily (user_id, date, requests)
              VALUES ($1, $2, $3)
              ON CONFLICT (user_id, date) DO UPDATE SET requests = EXCLUDED.requests
            `, [u.id, row.date, row.requests]);
            childRows.usage++;
          }
        } catch (e) {
          console.warn(`    ⚠ usage_daily skip (table may not exist in old DB): ${e.message}`);
        }

        // Migrate payments for this user
        try {
          const { rows: payRows } = await oldPool.query(
            'SELECT * FROM payments WHERE user_id = $1', [u.id]
          );
          for (const p of payRows) {
            await client.query(`
              INSERT INTO payments (id, user_id, tier, method, stripe_session_id, amount_cents, currency, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO NOTHING
            `, [p.id, u.id, p.tier, p.method, p.stripe_session_id, p.amount_cents, p.currency, p.created_at]);
            childRows.payments++;
          }
        } catch (e) {
          console.warn(`    ⚠ payments skip: ${e.message}`);
        }

        // Migrate audits for this user
        try {
          const { rows: auditRows } = await oldPool.query(
            'SELECT id, url, result, source, created_at FROM audits WHERE user_id = $1', [u.id]
          );
          for (const a of auditRows) {
            await client.query(`
              INSERT INTO audits (id, user_id, url, result, source, created_at)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO NOTHING
            `, [a.id, u.id, a.url, a.result ? JSON.stringify(a.result) : null, a.source, a.created_at]);
            childRows.audits++;
          }
        } catch (e) {
          console.warn(`    ⚠ audits skip: ${e.message}`);
        }

        // Migrate notification preferences
        try {
          const { rows: prefRows } = await oldPool.query(
            'SELECT * FROM user_notification_preferences WHERE user_id = $1', [u.id]
          );
          for (const pref of prefRows) {
            await client.query(`
              INSERT INTO user_notification_preferences (user_id, email_notifications, push_notifications)
              VALUES ($1, $2, $3)
              ON CONFLICT (user_id) DO NOTHING
            `, [u.id, pref.email_notifications ?? true, pref.push_notifications ?? false]);
            childRows.prefs++;
          }
        } catch (e) {
          console.warn(`    ⚠ prefs skip: ${e.message}`);
        }
      } else {
        console.log(`  ⏭ ${u.email} (conflict - already exists)`);
      }
    }

    await client.query('COMMIT');
    console.log(`\n✅ Migration complete!`);
    console.log(`   Users inserted: ${inserted}`);
    console.log(`   Usage rows:     ${childRows.usage}`);
    console.log(`   Payment rows:   ${childRows.payments}`);
    console.log(`   Audit rows:     ${childRows.audits}`);
    console.log(`   Pref rows:      ${childRows.prefs}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration ROLLED BACK due to error:', e.message);
    throw e;
  } finally {
    client.release();
  }

  await cleanup();
}

async function cleanup() {
  await oldPool.end().catch(() => {});
  await newPool.end().catch(() => {});
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
