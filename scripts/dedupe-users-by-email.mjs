#!/usr/bin/env node
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const IS_PRODUCTION =
  String(process.env.NODE_ENV || "").toLowerCase() === "production";

const APPLY = process.argv.includes("--apply");
const REASSIGN_FKS = process.argv.includes("--reassign-fks");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

function quoteIdent(input) {
  return '"' + String(input).replace(/"/g, '""') + '"';
}

function fqTable(schema, table) {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

async function getUserFkColumns(client) {
  const q = await client.query(
    `SELECT tc.table_schema, tc.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND ccu.table_schema = 'public'
       AND ccu.table_name = 'users'
       AND ccu.column_name = 'id'
       AND tc.table_schema = 'public'
     ORDER BY tc.table_name, kcu.column_name`,
  );

  return q.rows.map((r) => ({
    schema: r.table_schema,
    table: r.table_name,
    column: r.column_name,
  }));
}

async function countReferences(client, refs, userId) {
  const result = [];
  for (const ref of refs) {
    const sql = `SELECT COUNT(*)::bigint AS c FROM ${fqTable(ref.schema, ref.table)} WHERE ${quoteIdent(ref.column)} = $1`;
    const { rows } = await client.query(sql, [userId]);
    const count = Number(rows[0]?.c || 0);
    if (count > 0) result.push({ ...ref, count });
  }
  return result;
}

async function reassignReferences(client, refs, fromUserId, toUserId) {
  for (const ref of refs) {
    const sql = `UPDATE ${fqTable(ref.schema, ref.table)} SET ${quoteIdent(ref.column)} = $1 WHERE ${quoteIdent(ref.column)} = $2`;
    await client.query(sql, [toUserId, fromUserId]);
  }
}

async function main() {
  let connectionString = String(process.env.DATABASE_URL || "").trim();
  try {
    const u = new URL(connectionString);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    connectionString = u.toString();
  } catch {
    // keep original connection string
  }

  const poolConfig = { connectionString };
  const caCert = process.env.DATABASE_CA_CERT || process.env.PG_CA_CERT;
  if (caCert) {
    poolConfig.ssl = { rejectUnauthorized: true, ca: [caCert] };
  } else if (IS_PRODUCTION) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);
  const client = await pool.connect();

  try {
    const fkRefs = await getUserFkColumns(client);

    const dupes = await client.query(
      `WITH ranked AS (
         SELECT
           id,
           email,
           LOWER(email) AS email_key,
           is_verified,
           COALESCE(last_login, to_timestamp(0)) AS last_login_safe,
           created_at,
           ROW_NUMBER() OVER (
             PARTITION BY LOWER(email)
             ORDER BY is_verified DESC, COALESCE(last_login, to_timestamp(0)) DESC, created_at DESC
           ) AS rn
         FROM users
       )
       SELECT
         email_key,
         COUNT(*)::int AS total,
         ARRAY_AGG(id ORDER BY rn) AS ordered_ids,
         ARRAY_AGG(email ORDER BY rn) AS ordered_emails
       FROM ranked
       GROUP BY email_key
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC, email_key ASC`,
    );

    if (dupes.rowCount === 0) {
      console.log("No duplicate users found (case-insensitive).");
      return;
    }

    console.log(`Found ${dupes.rowCount} duplicate email group(s).`);
    console.log(
      `Mode: ${APPLY ? "APPLY" : "DRY-RUN"}${REASSIGN_FKS ? " + REASSIGN_FKS" : ""}`,
    );

    let wouldDelete = 0;
    let deleted = 0;
    let skipped = 0;

    for (const group of dupes.rows) {
      const keepId = group.ordered_ids[0];
      const keepEmail = group.ordered_emails[0];
      const dropIds = group.ordered_ids.slice(1);
      const dropEmails = group.ordered_emails.slice(1);

      console.log(`\nEmail key: ${group.email_key}`);
      console.log(`Keep: ${keepId} (${keepEmail})`);

      for (let i = 0; i < dropIds.length; i += 1) {
        const dropId = dropIds[i];
        const dropEmail = dropEmails[i];
        const refs = await countReferences(client, fkRefs, dropId);
        const totalRefRows = refs.reduce((acc, r) => acc + r.count, 0);

        console.log(
          `  Drop candidate: ${dropId} (${dropEmail}) refs=${totalRefRows}`,
        );

        if (!APPLY) {
          wouldDelete += 1;
          if (refs.length > 0) {
            const detail = refs
              .map((r) => `${r.table}.${r.column}:${r.count}`)
              .join(", ");
            console.log(`    refs: ${detail}`);
          }
          continue;
        }

        if (totalRefRows > 0 && !REASSIGN_FKS) {
          skipped += 1;
          const detail = refs
            .map((r) => `${r.table}.${r.column}:${r.count}`)
            .join(", ");
          console.log(
            `    skipped (has refs, rerun with --reassign-fks): ${detail}`,
          );
          continue;
        }

        try {
          await client.query("BEGIN");

          if (totalRefRows > 0 && REASSIGN_FKS) {
            await reassignReferences(client, refs, dropId, keepId);
          }

          await client.query("DELETE FROM users WHERE id = $1", [dropId]);

          await client.query("COMMIT");
          deleted += 1;
          console.log("    deleted");
        } catch (err) {
          await client.query("ROLLBACK");
          skipped += 1;
          console.log(
            `    skipped after rollback: ${String(err?.message || err)}`,
          );
        }
      }
    }

    console.log("\nSummary");
    if (!APPLY) {
      console.log(`Would delete: ${wouldDelete}`);
      console.log("Run with --apply to execute changes.");
      console.log(
        "Use --reassign-fks to migrate foreign-key references before deleting.",
      );
    } else {
      console.log(`Deleted: ${deleted}`);
      console.log(`Skipped: ${skipped}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("dedupe-users-by-email failed:", err);
  process.exit(1);
});
