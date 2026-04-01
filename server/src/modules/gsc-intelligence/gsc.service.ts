import { getPool } from '../../services/postgresql.js';
import { decryptToken, encryptToken } from './gsc.crypto.js';
import { GscClient } from './gsc.client.js';
import { refreshGoogleAccessToken } from './gsc.oauth.js';
import type { DateRange, GscMetricRow, GscPropertyRef, GscSourceMode } from './gsc.types.js';

export type GscConnectionRecord = {
  id: string;
  user_id: string;
  google_account_email: string;
  google_sub: string;
  encrypted_refresh_token: string;
  encrypted_access_token: string;
  token_expires_at: string | null;
  is_active: boolean;
};

export type GscPropertyRecord = {
  id: string;
  user_id: string;
  gsc_connection_id: string;
  site_url: string;
  permission_level: string;
  is_selected: boolean;
  is_active: boolean;
};

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function upsertGscConnection(args: {
  userId: string;
  googleEmail: string;
  googleSub: string;
  refreshToken: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    `INSERT INTO gsc_connections (
        user_id,
        google_account_email,
        google_sub,
        encrypted_refresh_token,
        encrypted_access_token,
        token_expires_at,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,TRUE,NOW(),NOW())
      ON CONFLICT (user_id, google_sub)
      DO UPDATE SET
        google_account_email = EXCLUDED.google_account_email,
        encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        token_expires_at = EXCLUDED.token_expires_at,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING id`,
    [
      args.userId,
      args.googleEmail,
      args.googleSub,
      encryptToken(args.refreshToken),
      encryptToken(args.accessToken),
      args.tokenExpiresAt,
    ]
  );

  return result.rows[0]?.id;
}

export async function getActiveConnectionByUser(userId: string): Promise<GscConnectionRecord | null> {
  const pool = getPool();
  const result = await pool.query<GscConnectionRecord>(
    `SELECT *
     FROM gsc_connections
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function ensureFreshAccessToken(userId: string): Promise<{ accessToken: string; connectionId: string }> {
  const pool = getPool();
  const connection = await getActiveConnectionByUser(userId);
  if (!connection) {
    throw new Error('No active GSC connection found');
  }

  const tokenExpiresAt = toDateOrNull(connection.token_expires_at);
  const nowPlusBuffer = new Date(Date.now() + 60 * 1000);

  if (tokenExpiresAt && tokenExpiresAt > nowPlusBuffer) {
    return {
      accessToken: decryptToken(connection.encrypted_access_token),
      connectionId: connection.id,
    };
  }

  const refreshToken = decryptToken(connection.encrypted_refresh_token);
  const refreshed = await refreshGoogleAccessToken(refreshToken);

  await pool.query(
    `UPDATE gsc_connections
     SET encrypted_access_token = $1,
         token_expires_at = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [encryptToken(refreshed.accessToken), refreshed.expiresAt, connection.id]
  );

  return {
    accessToken: refreshed.accessToken,
    connectionId: connection.id,
  };
}

export async function syncPropertiesFromGoogle(userId: string): Promise<GscPropertyRef[]> {
  const pool = getPool();
  const { accessToken, connectionId } = await ensureFreshAccessToken(userId);
  const client = new GscClient(accessToken);

  const liveSites = await client.listSites();

  const synced: GscPropertyRef[] = [];
  for (const site of liveSites) {
    const upsert = await pool.query<{ id: string; site_url: string }>(
      `INSERT INTO gsc_properties (
          user_id,
          gsc_connection_id,
          site_url,
          permission_level,
          is_selected,
          is_active,
          created_at,
          updated_at
        ) VALUES ($1,$2,$3,$4,FALSE,TRUE,NOW(),NOW())
        ON CONFLICT (user_id, site_url)
        DO UPDATE SET
          gsc_connection_id = EXCLUDED.gsc_connection_id,
          permission_level = EXCLUDED.permission_level,
          is_active = TRUE,
          updated_at = NOW()
        RETURNING id, site_url`,
      [userId, connectionId, site.siteUrl, site.permissionLevel]
    );

    const row = upsert.rows[0];
    if (row) {
      synced.push({ propertyId: row.id, siteUrl: row.site_url });
    }
  }

  return synced;
}

export async function listUserProperties(userId: string): Promise<GscPropertyRecord[]> {
  const pool = getPool();
  const result = await pool.query<GscPropertyRecord>(
    `SELECT *
     FROM gsc_properties
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY is_selected DESC, site_url ASC`,
    [userId]
  );
  return result.rows;
}

export async function setSelectedProperty(userId: string, propertyId: string): Promise<GscPropertyRecord> {
  const pool = getPool();
  const selected = await pool.query<GscPropertyRecord>(
    `SELECT *
     FROM gsc_properties
     WHERE id = $1 AND user_id = $2 AND is_active = TRUE
     LIMIT 1`,
    [propertyId, userId]
  );

  const property = selected.rows[0];
  if (!property) throw new Error('Property not found');

  await pool.query(
    `UPDATE gsc_properties
     SET is_selected = FALSE, updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );

  await pool.query(
    `UPDATE gsc_properties
     SET is_selected = TRUE, updated_at = NOW()
     WHERE id = $1`,
    [propertyId]
  );

  return { ...property, is_selected: true };
}

export async function getPropertyForUser(userId: string, propertyId: string): Promise<GscPropertyRecord | null> {
  const pool = getPool();
  const result = await pool.query<GscPropertyRecord>(
    `SELECT *
     FROM gsc_properties
     WHERE id = $1 AND user_id = $2 AND is_active = TRUE
     LIMIT 1`,
    [propertyId, userId]
  );
  return result.rows[0] || null;
}

export async function getSelectedProperty(userId: string): Promise<GscPropertyRecord | null> {
  const pool = getPool();
  const result = await pool.query<GscPropertyRecord>(
    `SELECT *
     FROM gsc_properties
     WHERE user_id = $1 AND is_selected = TRUE AND is_active = TRUE
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function queryLiveMetrics(args: {
  userId: string;
  propertyId: string;
  range: DateRange;
  dimensions: string[];
  rowLimit?: number;
  dimensionFilterGroups?: unknown[];
}): Promise<{ property: GscPropertyRecord; rows: GscMetricRow[] }> {
  const property = await getPropertyForUser(args.userId, args.propertyId);
  if (!property) throw new Error('Property not found');

  const { accessToken } = await ensureFreshAccessToken(args.userId);
  const client = new GscClient(accessToken);

  const rows = await client.querySearchAnalytics({
    siteUrl: property.site_url,
    startDate: args.range.startDate,
    endDate: args.range.endDate,
    dimensions: args.dimensions,
    rowLimit: args.rowLimit,
    dimensionFilterGroups: args.dimensionFilterGroups,
  });

  return { property, rows };
}

export async function saveToolRun(args: {
  userId: string;
  propertyId: string;
  toolName: string;
  sourceMode: GscSourceMode;
  inputArgs: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
}): Promise<string> {
  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    `INSERT INTO gsc_tool_runs (
      user_id,
      property_id,
      tool_name,
      source_mode,
      input_args,
      output_summary,
      executed_at
    ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
    RETURNING id`,
    [
      args.userId,
      args.propertyId,
      args.toolName,
      args.sourceMode,
      JSON.stringify(args.inputArgs),
      JSON.stringify(args.outputSummary),
    ]
  );
  return result.rows[0]?.id;
}

export async function createEvidence(args: {
  userId: string;
  propertyId: string;
  sourceType: 'gsc' | 'aivis_audit';
  sourceRef: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const pool = getPool();
  const result = await pool.query<{ evidence_id: string }>(
    `INSERT INTO gsc_evidence_links (
      user_id,
      property_id,
      source_type,
      source_ref,
      payload,
      created_at
    ) VALUES ($1,$2,$3,$4,$5,NOW())
    RETURNING evidence_id`,
    [args.userId, args.propertyId, args.sourceType, args.sourceRef, JSON.stringify(args.payload)]
  );
  return result.rows[0]?.evidence_id;
}

export async function snapshotProperty(userId: string, propertyId: string): Promise<{ pageRows: number; queryRows: number; jobId: string }> {
  const pool = getPool();
  const property = await getPropertyForUser(userId, propertyId);
  if (!property) throw new Error('Property not found');

  const job = await pool.query<{ id: string }>(
    `INSERT INTO gsc_snapshot_jobs (user_id, property_id, status, started_at, created_at)
     VALUES ($1, $2, 'running', NOW(), NOW())
     RETURNING id`,
    [userId, propertyId]
  );
  const jobId = job.rows[0]?.id;

  try {
    const recent = {
      startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    };

    const [pageResult, queryResult] = await Promise.all([
      queryLiveMetrics({
        userId,
        propertyId,
        range: recent,
        dimensions: ['page'],
        rowLimit: 1000,
      }),
      queryLiveMetrics({
        userId,
        propertyId,
        range: recent,
        dimensions: ['query', 'page'],
        rowLimit: 2000,
      }),
    ]);

    await pool.query(
      `INSERT INTO gsc_snapshots (property_id, source_mode, start_date, end_date, captured_at)
       VALUES ($1, 'snapshot', $2, $3, NOW())`,
      [propertyId, recent.startDate, recent.endDate]
    );

    if (pageResult.rows.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [];
      let index = 1;
      for (const row of pageResult.rows) {
        values.push(`($${index++},$${index++},$${index++},$${index++},$${index++},$${index++},NOW())`);
        params.push(propertyId, recent.startDate, recent.endDate, row.keys[0] || '', row.clicks, row.impressions);
      }
      await pool.query(
        `INSERT INTO gsc_snapshots_pages (property_id, start_date, end_date, page, clicks, impressions, captured_at)
         VALUES ${values.join(',')}`,
        params
      );
    }

    if (queryResult.rows.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [];
      let index = 1;
      for (const row of queryResult.rows) {
        values.push(`($${index++},$${index++},$${index++},$${index++},$${index++},$${index++},$${index++},NOW())`);
        params.push(propertyId, recent.startDate, recent.endDate, row.keys[0] || '', row.keys[1] || '', row.clicks, row.impressions);
      }
      await pool.query(
        `INSERT INTO gsc_snapshots_queries (property_id, start_date, end_date, query, page, clicks, impressions, captured_at)
         VALUES ${values.join(',')}`,
        params
      );
    }

    await pool.query(
      `UPDATE gsc_snapshot_jobs
       SET status = 'completed',
           finished_at = NOW(),
           details = $2
       WHERE id = $1`,
      [jobId, JSON.stringify({ pageRows: pageResult.rows.length, queryRows: queryResult.rows.length })]
    );

    return {
      pageRows: pageResult.rows.length,
      queryRows: queryResult.rows.length,
      jobId,
    };
  } catch (error) {
    await pool.query(
      `UPDATE gsc_snapshot_jobs
       SET status = 'failed',
           finished_at = NOW(),
           details = $2
       WHERE id = $1`,
      [jobId, JSON.stringify({ error: error instanceof Error ? error.message : String(error) })]
    );
    throw error;
  }
}

export async function getLatestSnapshotJob(userId: string, propertyId: string): Promise<{ id: string; status: string; started_at: string | null; finished_at: string | null; details: unknown } | null> {
  const pool = getPool();
  const result = await pool.query<{ id: string; status: string; started_at: string | null; finished_at: string | null; details: unknown }>(
    `SELECT id, status, started_at, finished_at, details
     FROM gsc_snapshot_jobs
     WHERE user_id = $1 AND property_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, propertyId]
  );

  return result.rows[0] || null;
}

export async function getSnapshotPageMetrics(args: {
  userId: string;
  propertyId: string;
  range: DateRange;
}): Promise<Array<{ page: string; clicks: number; impressions: number }>> {
  const property = await getPropertyForUser(args.userId, args.propertyId);
  if (!property) throw new Error('Property not found');

  const pool = getPool();
  const result = await pool.query<{ page: string; clicks: string; impressions: string }>(
    `SELECT page,
            SUM(clicks)::float8 AS clicks,
            SUM(impressions)::float8 AS impressions
     FROM gsc_snapshots_pages
     WHERE property_id = $1
       AND start_date >= $2
       AND end_date <= $3
     GROUP BY page`,
    [args.propertyId, args.range.startDate, args.range.endDate]
  );

  return result.rows.map((row) => ({
    page: row.page,
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
  }));
}

export async function getSnapshotQueryPageMetrics(args: {
  userId: string;
  propertyId: string;
  range: DateRange;
}): Promise<Array<{ query: string; page: string; clicks: number; impressions: number }>> {
  const property = await getPropertyForUser(args.userId, args.propertyId);
  if (!property) throw new Error('Property not found');

  const pool = getPool();
  const result = await pool.query<{ query: string; page: string; clicks: string; impressions: string }>(
    `SELECT query,
            page,
            SUM(clicks)::float8 AS clicks,
            SUM(impressions)::float8 AS impressions
     FROM gsc_snapshots_queries
     WHERE property_id = $1
       AND start_date >= $2
       AND end_date <= $3
     GROUP BY query, page`,
    [args.propertyId, args.range.startDate, args.range.endDate]
  );

  return result.rows.map((row) => ({
    query: row.query,
    page: row.page,
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
  }));
}
