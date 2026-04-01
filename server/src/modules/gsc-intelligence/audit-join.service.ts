import { getPool } from '../../services/postgresql.js';

function normalizeUrl(value: string): string {
  const v = String(value || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v.startsWith('http') ? v : `https://${v}`);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.host.toLowerCase()}${path}`;
  } catch {
    return v.toLowerCase().replace(/https?:\/\//, '').replace(/\/+$/, '');
  }
}

export async function findRecentAuditsForPage(userId: string, pageUrl: string): Promise<Array<{ id: string; url: string; visibility_score: number; result: any; created_at: string }>> {
  const pool = getPool();
  const normalizedNeedle = normalizeUrl(pageUrl);

  const rows = await pool.query<{ id: string; url: string; visibility_score: number; result: any; created_at: string }>(
    `SELECT id, url, visibility_score, result, created_at
     FROM audits
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 120`,
    [userId]
  );

  return rows.rows.filter((row) => normalizeUrl(row.url) === normalizedNeedle).slice(0, 5);
}

export function deriveLikelyAuditCauses(auditResult: any): Array<{ type: string; severity: string; summary: string }> {
  const findings: Array<{ type: string; severity: string; summary: string }> = [];
  const technical = auditResult?.technical_signals || {};
  const schema = auditResult?.schema_markup || {};
  const content = auditResult?.content_analysis || {};

  if (technical?.https_enabled === false) {
    findings.push({ type: 'https', severity: 'high', summary: 'HTTPS is disabled for this page.' });
  }
  if (Number(technical?.response_time_ms || 0) > 2000) {
    findings.push({ type: 'performance', severity: 'medium', summary: 'Response time is above 2s.' });
  }
  if (Number(schema?.json_ld_count || 0) === 0) {
    findings.push({ type: 'schema', severity: 'medium', summary: 'No JSON-LD entities detected.' });
  }
  if (Number(content?.word_count || 0) < 400) {
    findings.push({ type: 'content_depth', severity: 'medium', summary: 'Page content is shallow (<400 words).' });
  }

  if (!findings.length) {
    findings.push({ type: 'unknown', severity: 'low', summary: 'No dominant technical issue inferred from latest audit.' });
  }

  return findings;
}
