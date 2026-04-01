import { pool } from '../../services/postgresql';

export interface Audit {
  id: string;
  website_id: string;
  audit_date: Date;
  findings: any[];
  category_scores: any[];
  risks: any[];
  recommendations: any[];
  created_at: Date;
  updated_at: Date;
}

export async function createAudit(audit: Omit<Audit, 'id' | 'created_at' | 'updated_at'>): Promise<Audit> {
  const result = await pool.query(
    `INSERT INTO audits (website_id, audit_date, findings, category_scores, risks, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [audit.website_id, audit.audit_date, JSON.stringify(audit.findings), JSON.stringify(audit.category_scores), JSON.stringify(audit.risks), JSON.stringify(audit.recommendations)]
  );
  return result.rows[0];
}

export async function getAuditById(id: string): Promise<Audit | null> {
  const result = await pool.query(
    `SELECT * FROM audits WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
