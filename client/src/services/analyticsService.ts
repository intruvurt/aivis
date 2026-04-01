import { Pool } from 'pg';
import { Parser } from 'json2csv';

const pool = new Pool();

// Fetch analytics data for a user and range
export async function getAnalyticsFromDB(userId: string, range: string) {
  const days = parseInt(range.replace('d', ''), 10) || 30;
  const result = await pool.query(
    `SELECT * FROM usage_daily WHERE user_id = $1 AND date > NOW() - INTERVAL '${days} days' ORDER BY date DESC`,
    [userId]
  );
  return result.rows;
}

// Generate CSV from analytics data
export async function generateCSV(userId: string, range: string) {
  const data = await getAnalyticsFromDB(userId, range);
  const parser = new Parser();
  return parser.parse(data);
}