import pg from 'pg';
const { Client } = pg;

const DB = process.env.DATABASE_URL
  || 'postgresql://neondb_owner:npg_tKL2VBbRqza7@ep-ancient-wildflower-ady7ytz4-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const c = new Client({ connectionString: DB, ssl: true, connectionTimeoutMillis: 15000 });

try {
  await c.connect();
  console.log('Connected to current DB\n');

  // Database total size
  const { rows: [{ bytes }] } = await c.query('SELECT pg_database_size(current_database()) as bytes');
  console.log(`DATABASE SIZE: ${(parseInt(bytes) / 1024 / 1024).toFixed(2)} MB\n`);

  // Table sizes (public schema only)
  const { rows: tables } = await c.query(`
    SELECT t.tablename as name,
           pg_total_relation_size('public.' || quote_ident(t.tablename)) as size_bytes,
           s.n_live_tup as row_count
    FROM pg_tables t
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename AND s.schemaname = 'public'
    WHERE t.schemaname = 'public'
    ORDER BY pg_total_relation_size('public.' || quote_ident(t.tablename)) DESC
  `);

  console.log('TABLE'.padEnd(35) + 'SIZE'.padStart(10) + 'ROWS'.padStart(10));
  console.log('-'.repeat(55));
  for (const t of tables) {
    const kb = parseInt(t.size_bytes) / 1024;
    const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
    console.log(t.name.padEnd(35) + size.padStart(10) + String(t.row_count ?? '?').padStart(10));
  }

  // User count
  const { rows: [{ count: userCount }] } = await c.query('SELECT COUNT(*) as count FROM users');
  console.log(`\nTOTAL USERS: ${userCount}`);

  // Audit count
  const { rows: [{ count: auditCount }] } = await c.query('SELECT COUNT(*) as count FROM audits');
  console.log(`TOTAL AUDITS: ${auditCount}`);

  // Cache entries
  const { rows: [{ count: cacheCount }] } = await c.query('SELECT COUNT(*) as count FROM analysis_cache');
  console.log(`CACHE ENTRIES: ${cacheCount}`);

  await c.end();
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
