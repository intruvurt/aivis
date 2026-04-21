import { Pool } from 'pg';

const pool = new Pool();

function escapeCsvValue(value: unknown): string {
  const raw = value == null ? '' : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

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
  if (!data.length) return '';

  const headers = Object.keys(data[0]);
  const lines = [headers.map(escapeCsvValue).join(',')];

  for (const row of data) {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(','));
  }

  return lines.join('\n');
}