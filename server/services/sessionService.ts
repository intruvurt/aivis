import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { executeTransaction, dbConfigured } from "./postgresql.ts";

type CreateSessionInput = {
  userId: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type ValidationResult =
  | {
      userId: string;
      expiresAt: Date;
      createdAt: Date;
    }
  | null;

const DEFAULT_SESSION_DURATION_HOURS = 24;
const MAX_SESSION_DURATION_DAYS = 30;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_IP_ADDRESS_LENGTH = 45;
const MAX_CONCURRENT_SESSIONS_PER_USER = 10;

function sanitizeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent || typeof userAgent !== "string") return null;
  const trimmed = userAgent.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_USER_AGENT_LENGTH ? trimmed.slice(0, MAX_USER_AGENT_LENGTH) : trimmed;
}

function sanitizeIpAddress(ipAddress: string | null | undefined): string | null {
  if (!ipAddress || typeof ipAddress !== "string") return null;
  const trimmed = ipAddress.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_IP_ADDRESS_LENGTH ? trimmed.slice(0, MAX_IP_ADDRESS_LENGTH) : trimmed;
}

function validateExpiresAt(expiresAt: Date): void {
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
    throw new Error("expiresAt must be a valid Date");
  }

  const now = new Date();
  if (expiresAt <= now) {
    throw new Error("expiresAt must be in the future");
  }

  const maxExpiry = new Date(now.getTime() + MAX_SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  if (expiresAt > maxExpiry) {
    throw new Error(`Session cannot expire more than ${MAX_SESSION_DURATION_DAYS} days in the future`);
  }
}

function isUuidV4(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export class SessionService {
  private static async ensureTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        session_token UUID NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_accessed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
      ON user_sessions(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_active
      ON user_sessions(session_token)
      WHERE expires_at > NOW()
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
      ON user_sessions(user_id, expires_at DESC)
      WHERE expires_at > NOW()
    `);
  }

  static async createSession(input: CreateSessionInput): Promise<string> {
    if (!dbConfigured) {
      throw new Error("Database not configured: cannot create session");
    }

    const { userId, expiresAt, userAgent, ipAddress } = input;
    if (!userId || typeof userId !== "string") {
      throw new Error("userId is required and must be a string");
    }
    if (userId.length > 255) {
      throw new Error("userId is too long (max 255 characters)");
    }

    validateExpiresAt(expiresAt);

    const sanitizedUserAgent = sanitizeUserAgent(userAgent);
    const sanitizedIpAddress = sanitizeIpAddress(ipAddress);
    const sessionToken = uuidv4();
    const sessionId = uuidv4();

    await executeTransaction(async (client) => {
      await this.ensureTable(client);

      const existingCount = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM user_sessions
         WHERE user_id = $1
           AND expires_at > NOW()`,
        [userId],
      );

      const activeSessionCount = parseInt(existingCount.rows[0]?.count ?? "0", 10);
      if (activeSessionCount >= MAX_CONCURRENT_SESSIONS_PER_USER) {
        await client.query(
          `
          WITH to_delete AS (
            SELECT ctid
            FROM user_sessions
            WHERE user_id = $1
              AND expires_at > NOW()
            ORDER BY created_at ASC
            LIMIT GREATEST(0, $2)
          )
          DELETE FROM user_sessions
          WHERE ctid IN (SELECT ctid FROM to_delete)
          `,
          [userId, activeSessionCount - (MAX_CONCURRENT_SESSIONS_PER_USER - 1)],
        );
      }

      await client.query(
        `INSERT INTO user_sessions (
          id, user_id, session_token, expires_at, user_agent, ip_address, created_at, last_accessed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [sessionId, userId, sessionToken, expiresAt.toISOString(), sanitizedUserAgent, sanitizedIpAddress],
      );
    });

    return sessionToken;
  }

  static async validateSession(sessionToken: string): Promise<string | null> {
    if (!dbConfigured) return null;
    if (!sessionToken || typeof sessionToken !== "string") return null;
    if (!isUuidV4(sessionToken)) return null;

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);
        const res = await client.query<{ user_id: string; expires_at: string }>(
          `UPDATE user_sessions
           SET last_accessed_at = NOW()
           WHERE session_token = $1
             AND expires_at > NOW()
           RETURNING user_id, expires_at`,
          [sessionToken],
        );

        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        if (new Date(row.expires_at) <= new Date()) return null;
        return row.user_id;
      });
    } catch {
      return null;
    }
  }

  static async getSession(sessionToken: string): Promise<ValidationResult> {
    if (!dbConfigured) return null;
    if (!sessionToken || typeof sessionToken !== "string") return null;
    if (!isUuidV4(sessionToken)) return null;

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);
        const res = await client.query<{ user_id: string; expires_at: string; created_at: string }>(
          `SELECT user_id, expires_at, created_at
           FROM user_sessions
           WHERE session_token = $1
             AND expires_at > NOW()
           LIMIT 1`,
          [sessionToken],
        );

        if (res.rows.length === 0) return null;

        const row = res.rows[0];
        return {
          userId: row.user_id,
          expiresAt: new Date(row.expires_at),
          createdAt: new Date(row.created_at),
        };
      });
    } catch {
      return null;
    }
  }

  static async invalidateAllSessions(userId: string): Promise<number> {
    if (!dbConfigured) return 0;
    if (!userId || typeof userId !== "string") {
      throw new Error("userId is required");
    }

    return executeTransaction(async (client) => {
      await this.ensureTable(client);
      const res = await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
      return res.rowCount ?? 0;
    });
  }

  static async invalidateSession(sessionToken: string): Promise<boolean> {
    if (!dbConfigured) return false;
    if (!sessionToken || typeof sessionToken !== "string") return false;
    if (!isUuidV4(sessionToken)) return false;

    const deleted = await executeTransaction(async (client) => {
      await this.ensureTable(client);
      const res = await client.query(`DELETE FROM user_sessions WHERE session_token = $1`, [sessionToken]);
      return (res.rowCount ?? 0) > 0;
    });

    return deleted;
  }

  static async cleanupExpiredSessions(): Promise<number> {
    if (!dbConfigured) return 0;

    return executeTransaction(async (client) => {
      await this.ensureTable(client);
      const res = await client.query(`DELETE FROM user_sessions WHERE expires_at <= NOW()`);
      return res.rowCount ?? 0;
    });
  }

  static async createSessionForHours(
    userId: string,
    hours: number = DEFAULT_SESSION_DURATION_HOURS,
    userAgent?: string | null,
    ipAddress?: string | null,
  ): Promise<string> {
    const expiresAt = new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000);
    return this.createSession({ userId, expiresAt, userAgent, ipAddress });
  }
}

export default SessionService;
