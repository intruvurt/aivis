import pg from '../server/node_modules/pg/lib/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load server .env
const envPath = join(__dirname, '../server/.env');
const envContent = readFileSync(envPath, 'utf8');
const databaseUrl = envContent.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();

if (!databaseUrl) { console.error('DATABASE_URL not found'); process.exit(1); }

const { Pool } = pg;
const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

const { rows } = await pool.query(`
  UPDATE partnership_agreements
  SET signing_deadline = NOW() + INTERVAL '48 hours',
      status = CASE
        WHEN party_a_signed_at IS NOT NULL OR party_b_signed_at IS NOT NULL
        THEN 'partially_signed'
        ELSE 'pending'
      END,
      updated_at = NOW()
  WHERE slug = 'aivis-zeeniith-referral-delivery-2026'
  RETURNING slug, status, signing_deadline
`);

await pool.end();

if (!rows.length) {
  console.log('No record found — run the /seed endpoint first.');
} else {
  console.log('Agreement reset successfully:');
  console.log(JSON.stringify(rows[0], null, 2));
  const deadline = new Date(rows[0].signing_deadline);
  console.log(`\nDeadline: ${deadline.toUTCString()}`);
  console.log(`(${Math.round((deadline - Date.now()) / 3600000)} hours from now)`);
}
