import { pool } from '../../services/postgresql';

export interface StageResult {
  name: string;
  output: any;
}

export interface AiAuditRun {
  run_id: string;
  prompts: any[];
  blueprint: string;
  stage_results: StageResult[];
  created_at: Date;
}

async function createAiAuditRun(data: Omit<AiAuditRun, 'created_at'>): Promise<AiAuditRun> {
  const result = await pool.query(
    `INSERT INTO ai_audit_runs (run_id, prompts, blueprint, stage_results, created_at)
     VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    [data.run_id, JSON.stringify(data.prompts), data.blueprint, JSON.stringify(data.stage_results)]
  );
  return result.rows[0];
}

async function getAiAuditRunById(run_id: string): Promise<AiAuditRun | null> {
  const result = await pool.query(
    `SELECT * FROM ai_audit_runs WHERE run_id = $1`,
    [run_id]
  );
  return result.rows[0] || null;
}

async function updateAiAuditRun(run_id: string, updates: Partial<AiAuditRun>): Promise<AiAuditRun | null> {
  const fields = Object.keys(updates);
  if (fields.length === 0) return getAiAuditRunById(run_id);
  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => {
    if (f === 'prompts' || f === 'stage_results') {
      return JSON.stringify((updates as any)[f]);
    }
    return (updates as any)[f];
  });
  const result = await pool.query(
    `UPDATE ai_audit_runs SET ${setClause} WHERE run_id = $1 RETURNING *`,
    [run_id, ...values]
  );
  return result.rows[0] || null;
}

export const AiAuditRunModel = {
  create: createAiAuditRun,
  getById: getAiAuditRunById,
  update: updateAiAuditRun,
};
