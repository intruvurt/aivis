import { pool } from '../../services/postgresql.js';

export interface Website {
  id: string;
  url: string;
  domain: string;
  user_id: string;
  last_audit_date: Date;
  audit_count: number;
  created_at: Date;
  updated_at: Date;
}

export async function createWebsite(website: Omit<Website, 'id' | 'created_at' | 'updated_at'>): Promise<Website> {
  const result = await pool.query(
    `INSERT INTO websites (url, domain, user_id, last_audit_date, audit_count)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [website.url, website.domain, website.user_id, website.last_audit_date, website.audit_count]
  );
  return result.rows[0];
}

export async function getWebsiteById(id: string): Promise<Website | null> {
  const result = await pool.query(
    `SELECT * FROM websites WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
