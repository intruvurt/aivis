import type { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { pool } from './postgresql.ts';
import type { CanonicalTier } from '../src/types.ts';

// Password validation constants
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128; // Prevent DoS attacks
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

type DbUserRow = {
  id: string;
  email: string;
  password_hash: string;
  tier: CanonicalTier;
  created_at?: Date;
  updated_at?: Date;
  login_attempts?: number;
  locked_until?: Date | null;
};

type UserResponse = {
  id: string;
  email: string;
  tier: CanonicalTier;
  created_at?: string;
};

type AuthenticationResult = {
  id: string;
  email: string;
  tier: CanonicalTier;
} | null;

/**
 * Normalizes email to lowercase and trims whitespace
 */
function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
}

/**
 * Validates email and password with comprehensive checks
 */
function validateCredentials(
  email: string, 
  password: string
): { valid: boolean; error: string | null } {
  // Email validation
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  if (!validator.isEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (email.length > 254) { // RFC 5321
    return { valid: false, error: 'Email is too long' };
  }

  // Password validation
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: 'Password is too long' };
  }

  // Check for password strength
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const strengthCount = [hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length;

  if (strengthCount < 3) {
    return { 
      valid: false, 
      error: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters' 
    };
  }

  return { valid: true, error: null };
}

/**
 * Safely executes a database operation with automatic client release
 */
async function withClient<T>(
  pgPool: Pool, 
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pgPool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Executes queries within a transaction with proper rollback handling
 */
async function executeTransaction<T>(
  pgPool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withClient(pgPool, async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      throw error;
    }
  });
}

export class AuthService {
  /**
   * Register a new user with email and password
   * 
   * @throws Error with code: 'VALIDATION' | 'EMAIL_EXISTS' | 'DATABASE_ERROR'
   */
  static async registerUser({ 
    email, 
    password 
  }: { 
    email: string; 
    password: string;
  }): Promise<UserResponse> {
    const normalizedEmail = normalizeEmail(email);
    const validation = validateCredentials(normalizedEmail, password);
    
    if (!validation.valid) {
      const error = new Error(validation.error!) as Error & { code: string };
      error.code = 'VALIDATION';
      throw error;
    }

    try {
      // Hash password with secure rounds
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      return await executeTransaction(pool, async (client: PoolClient) => {
        try {
          const res = await client.query<DbUserRow>(
            `INSERT INTO public.users (email, password_hash, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             RETURNING id, email, tier, created_at`,
            [normalizedEmail, passwordHash]
          );

          const user = res.rows[0];
          
          return {
            id: user.id,
            email: user.email,
            tier: user.tier,
            created_at: user.created_at instanceof Date 
              ? user.created_at.toISOString() 
              : user.created_at,
          };
        } catch (dbError: any) {
          // Handle unique constraint violation (duplicate email)
          if (dbError?.code === '23505') {
            const error = new Error('Email already registered') as Error & { code: string };
            error.code = 'EMAIL_EXISTS';
            throw error;
          }
          throw dbError;
        }
      });
    } catch (error) {
      // Re-throw known errors
      if (error instanceof Error && 'code' in error) {
        throw error;
      }

      // Wrap unknown errors
      console.error('Registration error:', error);
      const wrappedError = new Error('Registration failed. Please try again.') as Error & { code: string };
      wrappedError.code = 'DATABASE_ERROR';
      throw wrappedError;
    }
  }

  /**
   * Authenticate user with email and password
   * Implements rate limiting via login attempts tracking
   * 
   * @returns User data if authenticated, null if invalid credentials
   * @throws Error if account is locked
   */
  static async authenticate({ 
    email, 
    password 
  }: { 
    email: string; 
    password: string;
  }): Promise<AuthenticationResult> {
    const normalizedEmail = normalizeEmail(email);

    // Basic input validation
    if (!validator.isEmail(normalizedEmail) || typeof password !== 'string') {
      return null;
    }

    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return null;
    }

    try {
      // Fetch user with login attempt tracking
      const res = await pool.query<DbUserRow>(
        `SELECT id, email, password_hash, tier, login_attempts, locked_until
         FROM public.users
         WHERE email = $1`,
        [normalizedEmail]
      );

      if (res.rows.length === 0) {
        // User doesn't exist - timing-safe response
        await this.constantTimeDelay();
        return null;
      }

      const user = res.rows[0];

      // Check if account is locked
      if (user.locked_until) {
        const lockoutEnd = new Date(user.locked_until);
        if (lockoutEnd > new Date()) {
          const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
          throw new Error(`Account locked. Try again in ${minutesRemaining} minutes.`);
        }
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        // Increment failed login attempts
        await this.handleFailedLogin(normalizedEmail, user.login_attempts || 0);
        
        // Timing-safe response
        await this.constantTimeDelay();
        return null;
      }

      // Successful login - reset attempts
      await this.resetLoginAttempts(normalizedEmail);

      return {
        id: user.id,
        email: user.email,
        tier: user.tier,
      };
    } catch (error) {
      // Re-throw account locked errors
      if (error instanceof Error && error.message.includes('Account locked')) {
        throw error;
      }

      console.error('Authentication error:', error);
      return null;
    }
  }

  /**
   * Handle failed login attempt with rate limiting
   */
  private static async handleFailedLogin(
    email: string, 
    currentAttempts: number
  ): Promise<void> {
    const newAttempts = currentAttempts + 1;

    try {
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        // Lock account
        await pool.query(
          `UPDATE public.users
           SET login_attempts = $1,
               locked_until = NOW() + ($2 || ' minutes')::interval,
               updated_at = NOW()
           WHERE email = $3`,
          [newAttempts, LOCKOUT_DURATION_MINUTES, email]
        );
      } else {
        // Increment attempts
        await pool.query(
          `UPDATE public.users
           SET login_attempts = $1,
               updated_at = NOW()
           WHERE email = $2`,
          [newAttempts, email]
        );
      }
    } catch (error) {
      console.error('Failed to update login attempts:', error);
    }
  }

  /**
   * Reset login attempts after successful authentication
   */
  private static async resetLoginAttempts(email: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE public.users
         SET login_attempts = 0,
             locked_until = NULL,
             updated_at = NOW()
         WHERE email = $1`,
        [email]
      );
    } catch (error) {
      console.error('Failed to reset login attempts:', error);
    }
  }

  /**
   * Constant-time delay to prevent timing attacks
   */
  private static async constantTimeDelay(): Promise<void> {
    // Add small random delay (50-150ms) to prevent timing analysis
    const delay = 50 + Math.random() * 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check if user exists by email
   */
  static async userExists(email: string): Promise<boolean> {
    const normalizedEmail = normalizeEmail(email);

    if (!validator.isEmail(normalizedEmail)) {
      return false;
    }

    try {
      const res = await pool.query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM public.users WHERE email = $1) as exists',
        [normalizedEmail]
      );
      return res.rows[0]?.exists ?? false;
    } catch (error) {
      console.error('User exists check error:', error);
      return false;
    }
  }

  /**
   * Update user password with validation
   * 
   * @throws Error with code: 'VALIDATION' | 'USER_NOT_FOUND' | 'DATABASE_ERROR'
   */
  static async updatePassword({
    email,
    newPassword,
  }: {
    email: string;
    newPassword: string;
  }): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const validation = validateCredentials(normalizedEmail, newPassword);

    if (!validation.valid) {
      const error = new Error(validation.error!) as Error & { code: string };
      error.code = 'VALIDATION';
      throw error;
    }

    try {
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      await executeTransaction(pool, async (client) => {
        const res = await client.query(
          `UPDATE public.users
           SET password_hash = $1,
               updated_at = NOW(),
               login_attempts = 0,
               locked_until = NULL
           WHERE email = $2`,
          [passwordHash, normalizedEmail]
        );

        if (res.rowCount === 0) {
          const error = new Error('User not found') as Error & { code: string };
          error.code = 'USER_NOT_FOUND';
          throw error;
        }
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }

      console.error('Password update error:', error);
      const wrappedError = new Error('Failed to update password') as Error & { code: string };
      wrappedError.code = 'DATABASE_ERROR';
      throw wrappedError;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<UserResponse | null> {
    if (!userId || typeof userId !== 'string') {
      return null;
    }

    try {
      const res = await pool.query<DbUserRow>(
        'SELECT id, email, tier, created_at FROM public.users WHERE id = $1',
        [userId]
      );

      if (res.rows.length === 0) {
        return null;
      }

      const user = res.rows[0];
      return {
        id: user.id,
        email: user.email,
        tier: user.tier,
        created_at: user.created_at instanceof Date 
          ? user.created_at.toISOString() 
          : user.created_at,
      };
    } catch (error) {
      console.error('Get user by ID error:', error);
      return null;
    }
  }
}