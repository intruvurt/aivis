/**
 * Database backup script for AiVIS (Neon Postgres)
 * Usage: node scripts/backup-db.mjs
 *
 * Reads DATABASE_URL from server/.env, dumps all tables as INSERT statements
 * into a timestamped SQL file under backups/.
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Read DATABASE_URL from server/.env ──
function loadEnv() {
  const envPath = path.join(ROOT, "server", ".env");
  if (!fs.existsSync(envPath)) {
    console.error("❌ server/.env not found");
    process.exit(1);
  }
  const env = fs.readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in server/.env");
  process.exit(1);
}

// ── Connect ──
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function backup() {
  const client = await pool.connect();
  try {
    console.log("🔗 Connected to database");

    // Get all user tables
    const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupDir = path.join(ROOT, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const outFile = path.join(backupDir, `aivis-backup-${timestamp}.sql`);

    const lines = [];
    lines.push(`-- AiVIS Database Backup`);
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push(`-- Source: Neon Postgres`);
    lines.push(`-- Tables: ${tables.length}`);
    lines.push(``);

    // Dump schema (CREATE TABLE via pg_catalog)
    for (const { tablename } of tables) {
      console.log(`📋 Dumping schema: ${tablename}`);

      // Get columns
      const { rows: cols } = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tablename]);

      lines.push(`-- ════════════════════════════════════════`);
      lines.push(`-- Table: ${tablename}`);
      lines.push(`-- ════════════════════════════════════════`);
      lines.push(`CREATE TABLE IF NOT EXISTS "${tablename}" (`);

      const colDefs = cols.map((c) => {
        let def = `  "${c.column_name}" ${c.data_type}`;
        if (c.character_maximum_length) def += `(${c.character_maximum_length})`;
        if (c.column_default) def += ` DEFAULT ${c.column_default}`;
        if (c.is_nullable === "NO") def += ` NOT NULL`;
        return def;
      });
      lines.push(colDefs.join(",\n"));
      lines.push(`);`);
      lines.push(``);
    }

    // Dump data
    for (const { tablename } of tables) {
      const { rows, rowCount } = await client.query(`SELECT * FROM "${tablename}"`);
      console.log(`💾 Dumping data: ${tablename} (${rowCount} rows)`);

      if (!rowCount || rowCount === 0) {
        lines.push(`-- ${tablename}: 0 rows`);
        lines.push(``);
        continue;
      }

      lines.push(`-- ${tablename}: ${rowCount} rows`);

      const columns = Object.keys(rows[0]);
      for (const row of rows) {
        const vals = columns.map((col) => {
          const v = row[col];
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
          if (typeof v === "number") return String(v);
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        lines.push(`INSERT INTO "${tablename}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")});`);
      }
      lines.push(``);
    }

    // Dump indexes
    const { rows: indexes } = await client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    if (indexes.length > 0) {
      lines.push(`-- ════════════════════════════════════════`);
      lines.push(`-- Indexes`);
      lines.push(`-- ════════════════════════════════════════`);
      for (const { indexdef } of indexes) {
        lines.push(`${indexdef};`);
      }
    }

    fs.writeFileSync(outFile, lines.join("\n"), "utf-8");
    const sizeMB = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
    console.log(`\n✅ Backup complete: ${outFile}`);
    console.log(`📦 Size: ${sizeMB} MB | Tables: ${tables.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

backup().catch((err) => {
  console.error("❌ Backup failed:", err.message);
  process.exit(1);
});
