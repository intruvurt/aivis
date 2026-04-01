import { pool } from '../../services/postgresql';

export interface AnalysisAuditLog {
  id: string;
  input: any;
  output?: any;
  error?: string;
  flow?: any[];
  created_at: Date;
}

async function createAnalysisAuditLog(log: Omit<AnalysisAuditLog, 'id' | 'created_at'>): Promise<AnalysisAuditLog> {
  const result = await pool.query(
    `INSERT INTO analysis_audit_logs (input, output, error, flow) VALUES ($1, $2, $3, $4) RETURNING *`,
    [JSON.stringify(log.input), log.output ? JSON.stringify(log.output) : null, log.error, log.flow ? JSON.stringify(log.flow) : null]
  );
  return result.rows[0];
}

async function getAnalysisAuditLogById(id: string): Promise<AnalysisAuditLog | null> {
  const result = await pool.query(
    `SELECT * FROM analysis_audit_logs WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export const AnalysisAuditLogModel = {
  create: createAnalysisAuditLog,
  getById: getAnalysisAuditLogById,
};
