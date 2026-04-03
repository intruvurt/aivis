/**
 * Widget Embed Service (Level 5 — VaaS)
 *
 * Generates short-lived or permanent embed tokens that power the
 * public embeddable score-badge widget.  Tokens are tied to a specific
 * URL and workspace — the public endpoint serves the latest cached audit
 * score without requiring any authentication.
 */
import { randomBytes } from 'crypto';
import { getPool } from './postgresql.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WidgetToken {
  id: string;
  user_id: string;
  workspace_id: string;
  token: string;
  label: string | null;
  url: string;
  config: WidgetConfig;
  views: number;
  last_viewed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface WidgetConfig {
  /** 'badge' | 'preview' | 'competitor_gap' */
  type?: string;
  theme?: 'dark' | 'light';
  show_url?: boolean;
  show_delta?: boolean;
  show_recommendations?: boolean;
  primary_color?: string;
}

export interface WidgetData {
  token: string;
  url: string;
  score: number | null;
  delta: number | null;
  label: string | null;
  config: WidgetConfig;
  audited_at: string | null;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createWidgetToken(args: {
  userId: string;
  workspaceId: string;
  url: string;
  label?: string;
  config?: WidgetConfig;
  expiresInDays?: number;
}): Promise<WidgetToken> {
  const token = 'wgt_' + randomBytes(20).toString('hex');
  const expiresAt = args.expiresInDays
    ? new Date(Date.now() + args.expiresInDays * 86400 * 1000).toISOString()
    : null;

  const { rows } = await getPool().query<WidgetToken>(
    `INSERT INTO widget_embed_tokens
       (user_id, workspace_id, token, label, url, config, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING *`,
    [
      args.userId,
      args.workspaceId,
      token,
      args.label ?? null,
      args.url,
      JSON.stringify(args.config ?? {}),
      expiresAt,
    ]
  );
  return rows[0] as WidgetToken;
}

export async function listWidgetTokens(userId: string, workspaceId: string): Promise<WidgetToken[]> {
  const { rows } = await getPool().query<WidgetToken>(
    `SELECT * FROM widget_embed_tokens
      WHERE user_id = $1 AND workspace_id = $2
      ORDER BY created_at DESC`,
    [userId, workspaceId]
  );
  return rows as WidgetToken[];
}

export async function deleteWidgetToken(
  userId: string,
  workspaceId: string,
  tokenId: string,
): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `DELETE FROM widget_embed_tokens
      WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [tokenId, userId, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}

// ── Public data resolution ────────────────────────────────────────────────────

/**
 * Resolves a widget token to its display data.
 * Called from the unauthenticated public widget endpoint.
 * Records a view impression (fire-and-forget).
 */
export async function resolveWidgetToken(token: string): Promise<WidgetData | null> {
  const pool = getPool();

  const { rows } = await pool.query<WidgetToken>(
    `SELECT * FROM widget_embed_tokens
      WHERE token = $1
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [token]
  );

  const record = rows[0];
  if (!record) return null;

  // Record view impression (fire-and-forget)
  void pool.query(
    `UPDATE widget_embed_tokens
        SET views = views + 1, last_viewed_at = NOW()
      WHERE id = $1`,
    [record.id]
  ).catch(() => {});

  // Fetch latest audit score for the tracked URL
  const { rows: audits } = await pool.query<{ visibility_score: string; created_at: string }>(
    `SELECT visibility_score, created_at
       FROM audits
      WHERE user_id = $1
        AND LOWER(url) = LOWER($2)
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 2`,
    [record.user_id, record.url]
  );

  const latest = audits[0];
  const previous = audits[1];
  const score = latest ? Number(latest.visibility_score) : null;
  const delta = latest && previous
    ? +(Number(latest.visibility_score) - Number(previous.visibility_score)).toFixed(2)
    : null;

  return {
    token,
    url: record.url,
    score,
    delta,
    label: record.label,
    config: record.config as WidgetConfig,
    audited_at: latest?.created_at ?? null,
  };
}
