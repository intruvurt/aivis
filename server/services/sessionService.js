import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { executeTransaction } from './postgresql.js';

export class SessionService {
  static async createSession(userId, expiresAt, userAgent, ipAddress) {
    const session_token = uuidv4();
    return executeTransaction(async (client: PoolClient) => {
      await client.query(
        `INSERT INTO user_sessions (id, user_id, session_token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), userId, session_token, expiresAt, userAgent, ipAddress]
      );
      return session_token;
    });
  }

  static async validateSession(sessionToken) {
    return executeTransaction(async (client: PoolClient) => {
      const res = await client.query(
        `SELECT user_id, expires_at FROM user_sessions WHERE session_token = $1`,
        [sessionToken]
      );
      if (res.rows.length === 0) return null;
      const session = res.rows[0];
      if (new Date(session.expires_at) < new Date()) return null;
      return session.user_id;
    });
  }

  static async invalidateAllSessions(userId) {
    return executeTransaction(async (client: PoolClient) => {
      await client.query(
        `DELETE FROM user_sessions WHERE user_id = $1`,
        [userId]
      );
    });
  }
}
