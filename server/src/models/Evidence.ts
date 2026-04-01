import { pool } from '../../services/postgresql';

export interface Evidence {
  id: string;
  type: string;
  source_url: string;
  source_kind: string;
  observed_at: Date;
  extract: string;
  hash: string;
  confidence: string;
  notes?: string;
}

async function createEvidence(evidence: Omit<Evidence, 'id'>): Promise<Evidence> {
  const result = await pool.query(
    `INSERT INTO evidence (type, source_url, source_kind, observed_at, extract, hash, confidence, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [evidence.type, evidence.source_url, evidence.source_kind, evidence.observed_at, evidence.extract, evidence.hash, evidence.confidence, evidence.notes]
  );
  return result.rows[0];
}

async function getEvidenceById(id: string): Promise<Evidence | null> {
  const result = await pool.query(
    `SELECT * FROM evidence WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export const EvidenceModel = {
  create: createEvidence,
  getById: getEvidenceById,
};
