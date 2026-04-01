import { pool } from '../../services/postgresql';

export interface StatusUpdate {
  id: string;
  text: string;
  created_at: Date;
  updated_at: Date;
}

export async function createStatusUpdate(text: string): Promise<StatusUpdate> {
  const result = await pool.query(
    `INSERT INTO status_updates (text) VALUES ($1) RETURNING *`,
    [text]
  );
  return result.rows[0];
}

export async function getStatusUpdateById(id: string): Promise<StatusUpdate | null> {
  const result = await pool.query(
    `SELECT * FROM status_updates WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
