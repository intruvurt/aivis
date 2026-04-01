import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
import { executeTransaction, dbConfigured, pool } from "./postgresql.ts";
=======
import { executeTransaction, dbConfigured } from "./postgresql";
>>>>>>> Stashed changes
========
import { executeTransaction, dbConfigured, pool } from "./postgresql.ts";
>>>>>>>> Stashed changes:services/sessionService.ts
=======
import { executeTransaction, dbConfigured } from "./postgresql";
>>>>>>> Stashed changes

type CreateSessionInput = {
  userId: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type SessionData = {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
};

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
========
>>>>>>>> Stashed changes:services/sessionService.ts
type ValidationResult = {
  userId: string;
  expiresAt: Date;
  createdAt: Date;
} | null;
<<<<<<<< Updated upstream:server/services/sessionService.ts
=======
=======
>>>>>>> Stashed changes
type ValidationResult =
  | {
      userId: string;
      expiresAt: Date;
      createdAt: Date;
    }
  | null;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes

// Session configuration constants
const DEFAULT_SESSION_DURATION_HOURS = 24;
const MAX_SESSION_DURATION_DAYS = 30;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_IP_ADDRESS_LENGTH = 45; // IPv6 max length
const CLEANUP_BATCH_SIZE = 1000;
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
=======
const MAX_CONCURRENT_SESSIONS_PER_USER = 10;
>>>>>>> Stashed changes
========
>>>>>>>> Stashed changes:services/sessionService.ts
=======
const MAX_CONCURRENT_SESSIONS_PER_USER = 10;
>>>>>>> Stashed changes

/**
 * Validates and sanitizes user agent string
 */
function sanitizeUserAgent(userAgent: string | null | undefined): string | null {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
========
>>>>>>>> Stashed changes:services/sessionService.ts
  if (!userAgent || typeof userAgent !== 'string') {
    return null;
  }

<<<<<<<< Updated upstream:server/services/sessionService.ts
  const trimmed = userAgent.trim();
  if (!trimmed) return null;

  // Truncate to max length
  return trimmed.length > MAX_USER_AGENT_LENGTH 
    ? trimmed.substring(0, MAX_USER_AGENT_LENGTH) 
=======
=======
>>>>>>> Stashed changes
  if (!userAgent || typeof userAgent !== "string") return null;
  const trimmed = userAgent.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_USER_AGENT_LENGTH
    ? trimmed.substring(0, MAX_USER_AGENT_LENGTH)
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
  const trimmed = userAgent.trim();
  if (!trimmed) return null;

  // Truncate to max length
  return trimmed.length > MAX_USER_AGENT_LENGTH 
    ? trimmed.substring(0, MAX_USER_AGENT_LENGTH) 
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
    : trimmed;
}

/**
 * Validates and sanitizes IP address
 */
function sanitizeIpAddress(ipAddress: string | null | undefined): string | null {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
========
>>>>>>>> Stashed changes:services/sessionService.ts
  if (!ipAddress || typeof ipAddress !== 'string') {
    return null;
  }

<<<<<<<< Updated upstream:server/services/sessionService.ts
  const trimmed = ipAddress.trim();
  if (!trimmed) return null;

  // Basic IPv4/IPv6 validation
=======
=======
>>>>>>> Stashed changes
  if (!ipAddress || typeof ipAddress !== "string") return null;
  const trimmed = ipAddress.trim();
  if (!trimmed) return null;

  // Basic IPv4/IPv6 validation (not perfect, but blocks obvious junk)
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
  const trimmed = ipAddress.trim();
  if (!trimmed) return null;

  // Basic IPv4/IPv6 validation
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (!ipv4Regex.test(trimmed) && !ipv6Regex.test(trimmed)) {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
    console.warn('Invalid IP address format:', trimmed);
    return null;
  }

  return trimmed.length > MAX_IP_ADDRESS_LENGTH 
    ? trimmed.substring(0, MAX_IP_ADDRESS_LENGTH) 
=======
=======
>>>>>>> Stashed changes
    return null;
  }

  return trimmed.length > MAX_IP_ADDRESS_LENGTH
    ? trimmed.substring(0, MAX_IP_ADDRESS_LENGTH)
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
    console.warn('Invalid IP address format:', trimmed);
    return null;
  }

  return trimmed.length > MAX_IP_ADDRESS_LENGTH 
    ? trimmed.substring(0, MAX_IP_ADDRESS_LENGTH) 
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
    : trimmed;
}

/**
 * Validates expiration date
 */
function validateExpiresAt(expiresAt: Date): void {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
  if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime())) {
    throw new Error('expiresAt must be a valid Date');
=======
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
    throw new Error("expiresAt must be a valid Date");
>>>>>>> Stashed changes
========
  if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime())) {
    throw new Error('expiresAt must be a valid Date');
>>>>>>>> Stashed changes:services/sessionService.ts
=======
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
    throw new Error("expiresAt must be a valid Date");
>>>>>>> Stashed changes
  }

  const now = new Date();
  if (expiresAt <= now) {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
    throw new Error('expiresAt must be in the future');
  }

  const maxExpiry = new Date(now.getTime() + MAX_SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  if (expiresAt > maxExpiry) {
    throw new Error(`Session cannot expire more than ${MAX_SESSION_DURATION_DAYS} days in the future`);
  }
}

=======
    throw new Error("expiresAt must be in the future");
========
    throw new Error('expiresAt must be in the future');
>>>>>>>> Stashed changes:services/sessionService.ts
  }

  const maxExpiry = new Date(now.getTime() + MAX_SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  if (expiresAt > maxExpiry) {
    throw new Error(`Session cannot expire more than ${MAX_SESSION_DURATION_DAYS} days in the future`);
  }
}

<<<<<<<< Updated upstream:server/services/sessionService.ts
=======
    throw new Error("expiresAt must be in the future");
  }

  const maxExpiry = new Date(
    now.getTime() + MAX_SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );
  if (expiresAt > maxExpiry) {
    throw new Error(
      `Session cannot expire more than ${MAX_SESSION_DURATION_DAYS} days in the future`
    );
  }
}

>>>>>>> Stashed changes
/**
 * Validate UUID v4 format
 */
function isUuidV4(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
export class SessionService {
  /**
   * Ensures session table exists with proper indexes and constraints
   */
  private static async ensureTable(client: PoolClient): Promise<void> {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
========
>>>>>>>> Stashed changes:services/sessionService.ts
    try {
      // Create table with proper constraints
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          session_token UUID NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          user_agent TEXT,
          ip_address TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT check_expires_at_future CHECK (expires_at > created_at)
        );
      `);
<<<<<<<< Updated upstream:server/services/sessionService.ts

      // Create indexes for efficient queries
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
        ON user_sessions(user_id);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token 
        ON user_sessions(session_token) 
        WHERE expires_at > NOW();
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires 
        ON user_sessions(expires_at) 
        WHERE expires_at > NOW();
      `);

      // Add index on user_id + expires_at for active session queries
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active 
        ON user_sessions(user_id, expires_at DESC) 
        WHERE expires_at > NOW();
      `);
    } catch (error) {
      console.error('Failed to ensure session table:', error);
      throw new Error('Database initialization failed');
    }
=======
    // If you don't want extensions at runtime, move these to migrations.
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
========
>>>>>>>> Stashed changes:services/sessionService.ts

      // Create indexes for efficient queries
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
        ON user_sessions(user_id);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token 
        ON user_sessions(session_token) 
        WHERE expires_at > NOW();
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires 
        ON user_sessions(expires_at) 
        WHERE expires_at > NOW();
      `);

<<<<<<<< Updated upstream:server/services/sessionService.ts
=======
    // If you don't want extensions at runtime, move these to migrations.
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        session_token UUID NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT check_expires_at_future CHECK (expires_at > created_at)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
      ON user_sessions(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_active
      ON user_sessions(session_token)
      WHERE expires_at > NOW();
    `);

>>>>>>> Stashed changes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_active
      ON user_sessions(expires_at)
      WHERE expires_at > NOW();
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
      ON user_sessions(user_id, expires_at DESC)
      WHERE expires_at > NOW();
    `);
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
      // Add index on user_id + expires_at for active session queries
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active 
        ON user_sessions(user_id, expires_at DESC) 
        WHERE expires_at > NOW();
      `);
    } catch (error) {
      console.error('Failed to ensure session table:', error);
      throw new Error('Database initialization failed');
    }
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
  }

  /**
   * Creates a new session for a user
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
   * 
   * @throws Error if database not configured or validation fails
   * @returns Session token as UUID string
   */
  static async createSession(input: CreateSessionInput): Promise<string> {
    if (!dbConfigured) {
      throw new Error('Database not configured: cannot create session');
=======
=======
>>>>>>> Stashed changes
   * @returns Session token (UUID v4 string)
   */
  static async createSession(input: CreateSessionInput): Promise<string> {
    if (!dbConfigured) {
      throw new Error("Database not configured: cannot create session");
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
   * 
   * @throws Error if database not configured or validation fails
   * @returns Session token as UUID string
   */
  static async createSession(input: CreateSessionInput): Promise<string> {
    if (!dbConfigured) {
      throw new Error('Database not configured: cannot create session');
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
    }

    const { userId, expiresAt, userAgent, ipAddress } = input;

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string');
    }

    if (userId.length > 255) {
      throw new Error('userId is too long (max 255 characters)');
=======
    if (!userId || typeof userId !== "string") {
      throw new Error("userId is required and must be a string");
========
    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string');
>>>>>>>> Stashed changes:services/sessionService.ts
    }

    if (userId.length > 255) {
<<<<<<<< Updated upstream:server/services/sessionService.ts
      throw new Error("userId is too long (max 255 characters)");
>>>>>>> Stashed changes
========
      throw new Error('userId is too long (max 255 characters)');
>>>>>>>> Stashed changes:services/sessionService.ts
=======
    if (!userId || typeof userId !== "string") {
      throw new Error("userId is required and must be a string");
    }
    if (userId.length > 255) {
      throw new Error("userId is too long (max 255 characters)");
>>>>>>> Stashed changes
    }

    validateExpiresAt(expiresAt);

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
    // Sanitize optional fields
=======
>>>>>>> Stashed changes
========
    // Sanitize optional fields
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
    const sanitizedUserAgent = sanitizeUserAgent(userAgent);
    const sanitizedIpAddress = sanitizeIpAddress(ipAddress);

    const sessionToken = uuidv4();
    const sessionId = uuidv4();

    try {
      await executeTransaction(async (client) => {
        await this.ensureTable(client);

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
        // Check for existing active sessions (optional rate limiting)
        const existingCount = await client.query<{ count: string }>(
          `SELECT COUNT(*) as count 
           FROM user_sessions 
=======
        const existingCount = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text as count
           FROM user_sessions
>>>>>>> Stashed changes
========
        // Check for existing active sessions (optional rate limiting)
        const existingCount = await client.query<{ count: string }>(
          `SELECT COUNT(*) as count 
           FROM user_sessions 
>>>>>>>> Stashed changes:services/sessionService.ts
=======
        const existingCount = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text as count
           FROM user_sessions
>>>>>>> Stashed changes
           WHERE user_id = $1 AND expires_at > NOW()`,
          [userId]
        );

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
========
>>>>>>>> Stashed changes:services/sessionService.ts
        const activeSessionCount = parseInt(existingCount.rows[0].count, 10);
        if (activeSessionCount >= 10) {
          // Limit to 10 concurrent sessions per user
          console.warn(`User ${userId} has ${activeSessionCount} active sessions`);
<<<<<<<< Updated upstream:server/services/sessionService.ts
        }

        // Insert new session
=======
=======
>>>>>>> Stashed changes
        const activeSessionCount = parseInt(existingCount.rows[0]?.count ?? "0", 10);

        // Soft-limit: you can choose to hard-enforce by deleting oldest sessions here.
        if (activeSessionCount >= MAX_CONCURRENT_SESSIONS_PER_USER) {
          // Hard enforce by deleting oldest sessions beyond limit (optional).
          // This keeps behavior deterministic and prevents unlimited session spam.
          await client.query(
            `
            WITH to_delete AS (
              SELECT ctid
              FROM user_sessions
              WHERE user_id = $1 AND expires_at > NOW()
              ORDER BY created_at ASC
              LIMIT GREATEST(0, $2)
            )
            DELETE FROM user_sessions
            WHERE ctid IN (SELECT ctid FROM to_delete)
            `,
            [userId, activeSessionCount - (MAX_CONCURRENT_SESSIONS_PER_USER - 1)]
          );
        }

<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
        }

        // Insert new session
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
        await client.query(
          `INSERT INTO user_sessions (
            id, user_id, session_token, expires_at, user_agent, ip_address, created_at, last_accessed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
          [sessionId, userId, sessionToken, expiresAt.toISOString(), sanitizedUserAgent, sanitizedIpAddress]
=======
=======
>>>>>>> Stashed changes
          [
            sessionId,
            userId,
            sessionToken,
            expiresAt.toISOString(),
            sanitizedUserAgent,
            sanitizedIpAddress,
          ]
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
          [sessionId, userId, sessionToken, expiresAt.toISOString(), sanitizedUserAgent, sanitizedIpAddress]
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
        );
      });

      return sessionToken;
    } catch (error) {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
      console.error('Failed to create session:', error);
      
      if (error instanceof Error) {
        // Re-throw known errors
        if (error.message.includes('Database')) throw error;
        if (error.message.includes('userId')) throw error;
        if (error.message.includes('expiresAt')) throw error;
      }

      throw new Error('Failed to create session');
=======
      console.error("Failed to create session:", error);
========
      console.error('Failed to create session:', error);
      
>>>>>>>> Stashed changes:services/sessionService.ts
      if (error instanceof Error) {
        // Re-throw known errors
        if (error.message.includes('Database')) throw error;
        if (error.message.includes('userId')) throw error;
        if (error.message.includes('expiresAt')) throw error;
      }
<<<<<<<< Updated upstream:server/services/sessionService.ts
      throw new Error("Failed to create session");
>>>>>>> Stashed changes
========

      throw new Error('Failed to create session');
>>>>>>>> Stashed changes:services/sessionService.ts
=======
      console.error("Failed to create session:", error);
      if (error instanceof Error) {
        if (
          error.message.includes("Database") ||
          error.message.includes("userId") ||
          error.message.includes("expiresAt")
        ) {
          throw error;
        }
      }
      throw new Error("Failed to create session");
>>>>>>> Stashed changes
    }
  }

  /**
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
========
>>>>>>>> Stashed changes:services/sessionService.ts
   * Validates a session token and returns user ID if valid
   * Also updates last_accessed_at timestamp
   * 
   * @returns User ID if session is valid and not expired, null otherwise
<<<<<<<< Updated upstream:server/services/sessionService.ts
   */
  static async validateSession(sessionToken: string): Promise<string | null> {
    if (!dbConfigured) {
      console.warn('Database not configured: cannot validate session');
      return null;
    }

    if (!sessionToken || typeof sessionToken !== 'string') {
      return null;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionToken)) {
      return null;
    }
=======
=======
>>>>>>> Stashed changes
   * Validates a session token and returns user ID if valid.
   * Also updates last_accessed_at.
   */
  static async validateSession(sessionToken: string): Promise<string | null> {
    if (!dbConfigured) return null;
    if (!sessionToken || typeof sessionToken !== "string") return null;
    if (!isUuidV4(sessionToken)) return null;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
   */
  static async validateSession(sessionToken: string): Promise<string | null> {
    if (!dbConfigured) {
      console.warn('Database not configured: cannot validate session');
      return null;
    }

    if (!sessionToken || typeof sessionToken !== 'string') {
      return null;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionToken)) {
      return null;
    }
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
========
>>>>>>>> Stashed changes:services/sessionService.ts
        // Fetch and update in one transaction
        const res = await client.query<{
          user_id: string;
          expires_at: Date;
        }>(
<<<<<<<< Updated upstream:server/services/sessionService.ts
=======
        const res = await client.query<{ user_id: string; expires_at: string }>(
>>>>>>> Stashed changes
========
>>>>>>>> Stashed changes:services/sessionService.ts
=======
        const res = await client.query<{ user_id: string; expires_at: string }>(
>>>>>>> Stashed changes
          `UPDATE user_sessions
           SET last_accessed_at = NOW()
           WHERE session_token = $1
             AND expires_at > NOW()
           RETURNING user_id, expires_at`,
          [sessionToken]
        );

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
        if (res.rows.length === 0) {
          return null;
        }

        const row = res.rows[0];
        
        // Double-check expiration (defensive programming)
        if (new Date(row.expires_at) <= new Date()) {
          return null;
        }
=======
=======
>>>>>>> Stashed changes
        if (res.rows.length === 0) return null;

        const row = res.rows[0];
        // Defensive double-check (should already be filtered)
        if (new Date(row.expires_at) <= new Date()) return null;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
        if (res.rows.length === 0) {
          return null;
        }

        const row = res.rows[0];
        
        // Double-check expiration (defensive programming)
        if (new Date(row.expires_at) <= new Date()) {
          return null;
        }
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes

        return row.user_id;
      });
    } catch (error) {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
      console.error('Session validation error:', error);
=======
      console.error("Session validation error:", error);
>>>>>>> Stashed changes
========
      console.error('Session validation error:', error);
>>>>>>>> Stashed changes:services/sessionService.ts
=======
      console.error("Session validation error:", error);
>>>>>>> Stashed changes
      return null;
    }
  }

  /**
   * Gets detailed session information
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
   * 
   * @returns Session data or null if not found/expired
   */
  static async getSession(sessionToken: string): Promise<ValidationResult> {
    if (!dbConfigured) return null;
    if (!sessionToken || typeof sessionToken !== 'string') return null;
=======
=======
>>>>>>> Stashed changes
   */
  static async getSession(sessionToken: string): Promise<ValidationResult> {
    if (!dbConfigured) return null;
    if (!sessionToken || typeof sessionToken !== "string") return null;
    if (!isUuidV4(sessionToken)) return null;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
   * 
   * @returns Session data or null if not found/expired
   */
  static async getSession(sessionToken: string): Promise<ValidationResult> {
    if (!dbConfigured) return null;
    if (!sessionToken || typeof sessionToken !== 'string') return null;
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);

        const res = await client.query<{
          user_id: string;
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
          expires_at: Date;
          created_at: Date;
=======
          expires_at: string;
          created_at: string;
>>>>>>> Stashed changes
========
          expires_at: Date;
          created_at: Date;
>>>>>>>> Stashed changes:services/sessionService.ts
=======
          expires_at: string;
          created_at: string;
>>>>>>> Stashed changes
        }>(
          `SELECT user_id, expires_at, created_at
           FROM user_sessions
           WHERE session_token = $1
             AND expires_at > NOW()
           LIMIT 1`,
          [sessionToken]
        );

        if (res.rows.length === 0) return null;

        const row = res.rows[0];
        return {
          userId: row.user_id,
          expiresAt: new Date(row.expires_at),
          createdAt: new Date(row.created_at),
        };
      });
    } catch (error) {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
      console.error('Get session error:', error);
=======
      console.error("Get session error:", error);
>>>>>>> Stashed changes
========
      console.error('Get session error:', error);
>>>>>>>> Stashed changes:services/sessionService.ts
=======
      console.error("Get session error:", error);
>>>>>>> Stashed changes
      return null;
    }
  }

  /**
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
   * Invalidates all sessions for a user (useful for logout all devices)
   * 
   * @returns Number of sessions invalidated
   */
  static async invalidateAllSessions(userId: string): Promise<number> {
    if (!dbConfigured) {
      console.warn('Database not configured: cannot invalidate sessions');
      return 0;
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required');
=======
=======
>>>>>>> Stashed changes
   * Invalidates all sessions for a user
   */
  static async invalidateAllSessions(userId: string): Promise<number> {
    if (!dbConfigured) return 0;
    if (!userId || typeof userId !== "string") {
      throw new Error("userId is required");
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
   * Invalidates all sessions for a user (useful for logout all devices)
   * 
   * @returns Number of sessions invalidated
   */
  static async invalidateAllSessions(userId: string): Promise<number> {
    if (!dbConfigured) {
      console.warn('Database not configured: cannot invalidate sessions');
      return 0;
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required');
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
    }

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
========

>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
        const res = await client.query(
          `DELETE FROM user_sessions WHERE user_id = $1`,
          [userId]
        );
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream

        return res.rowCount ?? 0;
      });
    } catch (error) {
      console.error('Failed to invalidate all sessions:', error);
      throw new Error('Failed to invalidate sessions');
=======
=======
>>>>>>> Stashed changes
        return res.rowCount ?? 0;
      });
    } catch (error) {
      console.error("Failed to invalidate all sessions:", error);
      throw new Error("Failed to invalidate sessions");
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========

        return res.rowCount ?? 0;
      });
    } catch (error) {
      console.error('Failed to invalidate all sessions:', error);
      throw new Error('Failed to invalidate sessions');
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
    }
  }

  /**
   * Invalidates a specific session (logout)
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
   * 
   * @returns True if session was found and deleted, false otherwise
   */
  static async invalidateSession(sessionToken: string): Promise<boolean> {
    if (!dbConfigured) {
      console.warn('Database not configured: cannot invalidate session');
      return false;
    }

    if (!sessionToken || typeof sessionToken !== 'string') {
      return false;
    }
=======
=======
>>>>>>> Stashed changes
   */
  static async invalidateSession(sessionToken: string): Promise<boolean> {
    if (!dbConfigured) return false;
    if (!sessionToken || typeof sessionToken !== "string") return false;
    if (!isUuidV4(sessionToken)) return false;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
   * 
   * @returns True if session was found and deleted, false otherwise
   */
  static async invalidateSession(sessionToken: string): Promise<boolean> {
    if (!dbConfigured) {
      console.warn('Database not configured: cannot invalidate session');
      return false;
    }

    if (!sessionToken || typeof sessionToken !== 'string') {
      return false;
    }
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
========

>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
        const res = await client.query(
          `DELETE FROM user_sessions WHERE session_token = $1`,
          [sessionToken]
        );
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream

        return (res.rowCount ?? 0) > 0;
      });
    } catch (error) {
      console.error('Failed to invalidate session:', error);
=======
=======
>>>>>>> Stashed changes
        return (res.rowCount ?? 0) > 0;
      });
    } catch (error) {
      console.error("Failed to invalidate session:", error);
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========

        return (res.rowCount ?? 0) > 0;
      });
    } catch (error) {
      console.error('Failed to invalidate session:', error);
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
      return false;
    }
  }

  /**
   * Extends session expiration time
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
========
>>>>>>>> Stashed changes:services/sessionService.ts
   * 
   * @param sessionToken - Session to extend
   * @param newExpiresAt - New expiration date
   * @returns True if successful, false otherwise
<<<<<<<< Updated upstream:server/services/sessionService.ts
   */
  static async extendSession(sessionToken: string, newExpiresAt: Date): Promise<boolean> {
    if (!dbConfigured) return false;
    if (!sessionToken) return false;
=======
========
>>>>>>>> Stashed changes:services/sessionService.ts
   */
  static async extendSession(sessionToken: string, newExpiresAt: Date): Promise<boolean> {
    if (!dbConfigured) return false;
<<<<<<<< Updated upstream:server/services/sessionService.ts
    if (!sessionToken || typeof sessionToken !== "string") return false;
    if (!isUuidV4(sessionToken)) return false;
>>>>>>> Stashed changes
========
    if (!sessionToken) return false;
>>>>>>>> Stashed changes:services/sessionService.ts
=======
   */
  static async extendSession(
    sessionToken: string,
    newExpiresAt: Date
  ): Promise<boolean> {
    if (!dbConfigured) return false;
    if (!sessionToken || typeof sessionToken !== "string") return false;
    if (!isUuidV4(sessionToken)) return false;
>>>>>>> Stashed changes

    validateExpiresAt(newExpiresAt);

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
========

>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
        const res = await client.query(
          `UPDATE user_sessions
           SET expires_at = $1
           WHERE session_token = $2
             AND expires_at > NOW()`,
          [newExpiresAt.toISOString(), sessionToken]
        );
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream

        return (res.rowCount ?? 0) > 0;
      });
    } catch (error) {
      console.error('Failed to extend session:', error);
=======
=======
>>>>>>> Stashed changes
        return (res.rowCount ?? 0) > 0;
      });
    } catch (error) {
      console.error("Failed to extend session:", error);
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========

        return (res.rowCount ?? 0) > 0;
      });
    } catch (error) {
      console.error('Failed to extend session:', error);
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
      return false;
    }
  }

  /**
   * Gets all active sessions for a user
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
   * 
   * @returns Array of active sessions
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    if (!dbConfigured) return [];
    if (!userId) return [];
=======
=======
>>>>>>> Stashed changes
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    if (!dbConfigured) return [];
    if (!userId || typeof userId !== "string") return [];
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
   * 
   * @returns Array of active sessions
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    if (!dbConfigured) return [];
    if (!userId) return [];
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);

        const res = await client.query<{
          id: string;
          user_id: string;
          session_token: string;
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
          expires_at: Date;
          user_agent: string | null;
          ip_address: string | null;
          created_at: Date;
=======
=======
>>>>>>> Stashed changes
          expires_at: string;
          user_agent: string | null;
          ip_address: string | null;
          created_at: string;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
          expires_at: Date;
          user_agent: string | null;
          ip_address: string | null;
          created_at: Date;
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
        }>(
          `SELECT id, user_id, session_token, expires_at, user_agent, ip_address, created_at
           FROM user_sessions
           WHERE user_id = $1
             AND expires_at > NOW()
           ORDER BY created_at DESC`,
          [userId]
        );

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
        return res.rows.map(row => ({
=======
        return res.rows.map((row) => ({
>>>>>>> Stashed changes
========
        return res.rows.map(row => ({
>>>>>>>> Stashed changes:services/sessionService.ts
=======
        return res.rows.map((row) => ({
>>>>>>> Stashed changes
          id: row.id,
          userId: row.user_id,
          sessionToken: row.session_token,
          expiresAt: new Date(row.expires_at),
          userAgent: row.user_agent,
          ipAddress: row.ip_address,
          createdAt: new Date(row.created_at),
        }));
      });
    } catch (error) {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
      console.error('Failed to get user sessions:', error);
=======
      console.error("Failed to get user sessions:", error);
>>>>>>> Stashed changes
========
      console.error('Failed to get user sessions:', error);
>>>>>>>> Stashed changes:services/sessionService.ts
=======
      console.error("Failed to get user sessions:", error);
>>>>>>> Stashed changes
      return [];
    }
  }

  /**
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
   * Cleans up expired sessions (should be run periodically)
   * 
   * @returns Number of sessions deleted
=======
   * Cleans up expired sessions in batches (Postgres-safe)
>>>>>>> Stashed changes
========
   * Cleans up expired sessions (should be run periodically)
   * 
   * @returns Number of sessions deleted
>>>>>>>> Stashed changes:services/sessionService.ts
=======
   * Cleans up expired sessions in batches (Postgres-safe)
>>>>>>> Stashed changes
   */
  static async cleanupExpiredSessions(): Promise<number> {
    if (!dbConfigured) return 0;

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);

        const res = await client.query(
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
          `DELETE FROM user_sessions
           WHERE expires_at <= NOW()
           LIMIT $1`,
=======
=======
>>>>>>> Stashed changes
          `
          WITH doomed AS (
            SELECT ctid
            FROM user_sessions
            WHERE expires_at <= NOW()
            LIMIT $1
          )
          DELETE FROM user_sessions
          WHERE ctid IN (SELECT ctid FROM doomed)
          `,
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
          `DELETE FROM user_sessions
           WHERE expires_at <= NOW()
           LIMIT $1`,
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
          [CLEANUP_BATCH_SIZE]
        );

        return res.rowCount ?? 0;
      });
    } catch (error) {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
      console.error('Failed to cleanup expired sessions:', error);
=======
      console.error("Failed to cleanup expired sessions:", error);
>>>>>>> Stashed changes
========
      console.error('Failed to cleanup expired sessions:', error);
>>>>>>>> Stashed changes:services/sessionService.ts
=======
      console.error("Failed to cleanup expired sessions:", error);
>>>>>>> Stashed changes
      return 0;
    }
  }

  /**
   * Gets session statistics for monitoring
   */
  static async getStats(): Promise<{
    total_sessions: number;
    active_sessions: number;
    expired_sessions: number;
    unique_users: number;
  }> {
    if (!dbConfigured) {
      return {
        total_sessions: 0,
        active_sessions: 0,
        expired_sessions: 0,
        unique_users: 0,
      };
    }

    try {
      return await executeTransaction(async (client) => {
        await this.ensureTable(client);

        const res = await client.query<{
          total_sessions: string;
          active_sessions: string;
          expired_sessions: string;
          unique_users: string;
        }>(`
          SELECT 
            COUNT(*)::text as total_sessions,
            COUNT(*) FILTER (WHERE expires_at > NOW())::text as active_sessions,
            COUNT(*) FILTER (WHERE expires_at <= NOW())::text as expired_sessions,
            COUNT(DISTINCT user_id) FILTER (WHERE expires_at > NOW())::text as unique_users
          FROM user_sessions
        `);

<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
        const row = res.rows[0];
=======
=======
>>>>>>> Stashed changes
        const row = res.rows[0] ?? {
          total_sessions: "0",
          active_sessions: "0",
          expired_sessions: "0",
          unique_users: "0",
        };

<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
        const row = res.rows[0];
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
        return {
          total_sessions: parseInt(row.total_sessions, 10) || 0,
          active_sessions: parseInt(row.active_sessions, 10) || 0,
          expired_sessions: parseInt(row.expired_sessions, 10) || 0,
          unique_users: parseInt(row.unique_users, 10) || 0,
        };
      });
    } catch (error) {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
      console.error('Failed to get session stats:', error);
=======
      console.error("Failed to get session stats:", error);
>>>>>>> Stashed changes
========
      console.error('Failed to get session stats:', error);
>>>>>>>> Stashed changes:services/sessionService.ts
=======
      console.error("Failed to get session stats:", error);
>>>>>>> Stashed changes
      return {
        total_sessions: 0,
        active_sessions: 0,
        expired_sessions: 0,
        unique_users: 0,
      };
    }
  }

  /**
   * Helper to create session with default expiration
   */
  static async createSessionWithDefaults(
    userId: string,
    userAgent?: string | null,
    ipAddress?: string | null
  ): Promise<string> {
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/sessionService.ts
<<<<<<< Updated upstream
    const expiresAt = new Date(Date.now() + DEFAULT_SESSION_DURATION_HOURS * 60 * 60 * 1000);
    return this.createSession({ userId, expiresAt, userAgent, ipAddress });
  }
}
=======
=======
>>>>>>> Stashed changes
    const expiresAt = new Date(
      Date.now() + DEFAULT_SESSION_DURATION_HOURS * 60 * 60 * 1000
    );
    return this.createSession({ userId, expiresAt, userAgent, ipAddress });
  }
}
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
    const expiresAt = new Date(Date.now() + DEFAULT_SESSION_DURATION_HOURS * 60 * 60 * 1000);
    return this.createSession({ userId, expiresAt, userAgent, ipAddress });
  }
}
>>>>>>>> Stashed changes:services/sessionService.ts
=======
>>>>>>> Stashed changes
