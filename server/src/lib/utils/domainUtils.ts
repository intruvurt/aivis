import { pool } from '../../services/postgresql.js';

export async function getUserPrimaryDomain(userId: string): Promise<string | null> {
  // Assuming the first website added is primary, or just picking one.
  try {
    const { rows } = await pool.query(
      'SELECT domain FROM websites WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );
    return rows[0]?.domain || null;
  } catch (error) {
    console.error("Error fetching user primary domain:", error);
    return null;
  }
}
