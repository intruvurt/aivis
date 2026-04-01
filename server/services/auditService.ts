import { pool } from './postgresql.ts';

export type AuditStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Audit {
  id: string;
  user_id: string;
  url: string;
  status: AuditStatus;
  overall_score?: number;
  category_scores?: Record<string, number>;
  visibility_status?: string;
  evidence?: any[];
  error_message?: string;
  processing_time_ms?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAuditInput {
  userId: string;
  url: string;
}

export class AuditService {
  /**
   * Create a new audit record
   */
  static async create(input: CreateAuditInput): Promise<Audit> {
    const res = await pool.query<Audit>(
      `INSERT INTO audits (user_id, url, status, created_at, updated_at)
       VALUES ($1, $2, 'pending', NOW(), NOW())
       RETURNING *`,
      [input.userId, input.url]
    );
    return res.rows[0];
  }

  /**
   * Get audit by ID
   */
  static async findById(id: string): Promise<Audit | null> {
    const res = await pool.query<Audit>(
      'SELECT * FROM audits WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Get audits for a user
   */
  static async findByUserId(userId: string, limit = 50): Promise<Audit[]> {
    const res = await pool.query<Audit>(
      `SELECT * FROM audits 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  }

  /**
   * Update audit status
   */
  static async updateStatus(id: string, status: AuditStatus): Promise<Audit | null> {
    const res = await pool.query<Audit>(
      `UPDATE audits SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return res.rows[0] || null;
  }

  /**
   * Complete an audit with results
   */
  static async complete(
    id: string, 
    results: {
      overallScore: number;
      categoryScores?: Record<string, number>;
      visibilityStatus?: string;
      evidence?: any[];
      processingTimeMs?: number;
    }
  ): Promise<Audit | null> {
    const res = await pool.query<Audit>(
      `UPDATE audits SET 
        status = 'completed',
        overall_score = $1,
        category_scores = $2,
        visibility_status = $3,
        evidence = $4,
        processing_time_ms = $5,
        updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        results.overallScore,
        results.categoryScores ? JSON.stringify(results.categoryScores) : null,
        results.visibilityStatus || null,
        results.evidence ? JSON.stringify(results.evidence) : null,
        results.processingTimeMs || null,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  /**
   * Mark audit as failed
   */
  static async fail(id: string, errorMessage: string): Promise<Audit | null> {
    const res = await pool.query<Audit>(
      `UPDATE audits SET 
        status = 'failed',
        error_message = $1,
        updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [errorMessage, id]
    );
    return res.rows[0] || null;
  }

  /**
   * Get user's audit count for the current month
   */
  static async getMonthlyCount(userId: string): Promise<number> {
    const res = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audits 
       WHERE user_id = $1 
         AND created_at >= date_trunc('month', CURRENT_DATE)`,
      [userId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  /**
   * Check if user can create more audits this month
   */
  static async canCreateAudit(userId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const [countRes, userRes] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM audits 
         WHERE user_id = $1 
           AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [userId]
      ),
      pool.query<{ audits_per_month: number }>(
        'SELECT audits_per_month FROM users WHERE id = $1',
        [userId]
      ),
    ]);

    const count = parseInt(countRes.rows[0]?.count || '0', 10);
    const limit = userRes.rows[0]?.audits_per_month || 10;
    const remaining = Math.max(0, limit - count);

    return {
      allowed: limit === -1 || count < limit, // -1 means unlimited
      remaining: limit === -1 ? -1 : remaining,
      limit,
    };
  }
}

export default AuditService;
