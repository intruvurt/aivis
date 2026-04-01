/**
 * User Branding Service (White-Label)
 * Manages company branding settings used for white-label PDF/CSV exports.
 * Signal-tier only.
 */
import { getPool } from './postgresql.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserBranding {
  user_id: string;
  workspace_id: string;
  company_name: string | null;
  logo_url: string | null;
  logo_base64: string | null;
  primary_color: string;
  accent_color: string;
  footer_text: string | null;
  tagline: string | null;
  contact_email: string | null;
  website_url: string | null;
  show_cover_page: boolean;
  created_at: string;
  updated_at: string;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getBranding(userId: string, workspaceId: string): Promise<UserBranding | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM user_branding WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );
  return rows[0] || null;
}

export async function upsertBranding(
  userId: string,
  workspaceId: string,
  data: {
    company_name?: string;
    logo_url?: string;
    logo_base64?: string;
    primary_color?: string;
    accent_color?: string;
    footer_text?: string;
    tagline?: string;
    contact_email?: string;
    website_url?: string;
    show_cover_page?: boolean;
  }
): Promise<UserBranding> {
  const pool = getPool();

  // Validate logo_base64 size (max 500KB as base64)
  if (data.logo_base64 && data.logo_base64.length > 700_000) {
    throw new Error('Logo must be under 500KB');
  }

  // Validate colors
  const colorRegex = /^#[0-9a-fA-F]{6}$/;
  if (data.primary_color && !colorRegex.test(data.primary_color)) {
    throw new Error('Invalid primary_color hex');
  }
  if (data.accent_color && !colorRegex.test(data.accent_color)) {
    throw new Error('Invalid accent_color hex');
  }

  const { rows } = await pool.query(
    `INSERT INTO user_branding (user_id, workspace_id, company_name, logo_url, logo_base64, primary_color, accent_color, footer_text, tagline, contact_email, website_url, show_cover_page)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, '#0ea5e9'), COALESCE($7, '#6366f1'), $8, $9, $10, $11, COALESCE($12, FALSE))
     ON CONFLICT (workspace_id) DO UPDATE SET
       company_name = COALESCE($3, user_branding.company_name),
       logo_url = COALESCE($4, user_branding.logo_url),
       logo_base64 = COALESCE($5, user_branding.logo_base64),
       primary_color = COALESCE($6, user_branding.primary_color),
       accent_color = COALESCE($7, user_branding.accent_color),
       footer_text = COALESCE($8, user_branding.footer_text),
       tagline = COALESCE($9, user_branding.tagline),
       contact_email = COALESCE($10, user_branding.contact_email),
       website_url = COALESCE($11, user_branding.website_url),
       show_cover_page = COALESCE($12, user_branding.show_cover_page),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      workspaceId,
      data.company_name ?? null,
      data.logo_url ?? null,
      data.logo_base64 ?? null,
      data.primary_color ?? null,
      data.accent_color ?? null,
      data.footer_text ?? null,
      data.tagline ?? null,
      data.contact_email ?? null,
      data.website_url ?? null,
      data.show_cover_page ?? null,
    ]
  );
  return rows[0];
}

export async function deleteBranding(userId: string, workspaceId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM user_branding WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}
