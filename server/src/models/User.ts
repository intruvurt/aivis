// server/src/models/User.ts - FIXED WITH EMAIL VERIFICATION
import { pool } from '../services/postgresql.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export type UserRole = 'user' | 'admin' | 'auditor';
export type OAuthProvider = 'google' | 'github' | null;

export interface User {
  id: string;
  email: string;
  password_hash?: string | null;

  // EMAIL VERIFICATION - REQUIRED FOR ANALYZER ACCESS
  is_verified: boolean;
  verification_token?: string | null;
  verification_token_expires?: Date | null;

  // Account info
  name?: string;
  role?: UserRole;
  tier?: string;
  company?: string | null;
  website?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  timezone?: string | null;
  language?: string | null;

  // Enriched organization profile
  org_description?: string | null;
  org_logo_url?: string | null;
  org_favicon_url?: string | null;
  org_phone?: string | null;
  org_address?: string | null;
  org_verified?: boolean;
  org_verification_confidence?: number | null;
  org_verification_reasons?: string[] | null;

  // Security
  mfa_secret?: string | null;
  login_attempts?: number;
  locked_until?: Date | null;
  last_login?: Date | null;

  // Stripe
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Columns safe to return from general lookups (excludes secrets)
const SAFE_COLUMNS = `id, email, is_verified, verification_token_expires, name, role, tier,
  company, website, bio, avatar_url, timezone, language,
  org_description, org_logo_url, org_favicon_url, org_phone, org_address,
  org_verified, org_verification_confidence, org_verification_reasons,
  login_attempts, locked_until, last_login,
  stripe_customer_id, stripe_subscription_id,
  created_at, updated_at`;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { token, expires };
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await pool.query(`SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [normalizeEmail(email)]);
  return result.rows[0] || null;
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
  const result = await pool.query(`SELECT ${SAFE_COLUMNS} FROM users WHERE stripe_customer_id = $1`, [stripeCustomerId]);
  return result.rows[0] || null;
}

export async function getUserByVerificationToken(token: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE verification_token = $1 AND verification_token_expires > NOW()`,
    [token]
  );
  return result.rows[0] || null;
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
  tier?: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  const password_hash = await hashPassword(input.password);
  const { token, expires } = generateVerificationToken();

  const result = await pool.query(
    `INSERT INTO users (
      email, password_hash, name, tier, is_verified, verification_token, verification_token_expires
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      email,
      password_hash,
      input.name || email.split('@')[0], // Default name from email
      input.tier || 'observer',
      false, // NOT verified by default
      token,
      expires,
    ]
  );

  return result.rows[0];
}

export async function verifyUserEmail(token: string): Promise<User | null> {
  const result = await pool.query(
    `UPDATE users
     SET is_verified = TRUE, verification_token = NULL, verification_token_expires = NULL, updated_at = NOW()
     WHERE verification_token = $1 AND verification_token_expires > NOW()
     RETURNING *`,
    [token]
  );

  return result.rows[0] || null;
}

export async function resendVerificationEmail(email: string): Promise<{ token: string; user: User } | null> {
  const { token, expires } = generateVerificationToken();

  const result = await pool.query(
    `UPDATE users
     SET verification_token = $1, verification_token_expires = $2, updated_at = NOW()
     WHERE email = $3 AND is_verified = FALSE
     RETURNING *`,
    [token, expires, normalizeEmail(email)]
  );

  if (!result.rows[0]) return null;

  return {
    token,
    user: result.rows[0],
  };
}

// Columns stored as JSONB in PostgreSQL - values must be JSON.stringify'd before binding
const JSONB_COLUMNS = new Set(['org_verification_reasons']);

// Allowlisted columns that may be updated via updateUserById - prevents SQL injection via dynamic keys
const ALLOWED_UPDATE_COLUMNS = new Set([
  'email', 'password_hash', 'name', 'role', 'tier', 'company', 'website', 'bio',
  'avatar_url', 'timezone', 'language', 'is_verified', 'verification_token',
  'verification_token_expires', 'org_description', 'org_logo_url', 'org_favicon_url',
  'org_phone', 'org_address', 'org_verified', 'org_verification_confidence',
  'org_verification_reasons', 'mfa_secret', 'login_attempts', 'locked_until',
  'last_login', 'stripe_customer_id',
  'stripe_subscription_id',
]);

export async function updateUserById(
  id: string,
  updates: Partial<User> & { password?: string }
): Promise<User | null> {
  const safeUpdates: Record<string, any> = { ...updates };

  // Never allow updating immutable fields
  delete safeUpdates.id;
  delete safeUpdates.created_at;

  // Normalize email if present
  if (typeof safeUpdates.email === 'string') {
    safeUpdates.email = normalizeEmail(safeUpdates.email);
  }

  // Support password -> password_hash
  if (typeof (updates as any).password === 'string' && (updates as any).password) {
    safeUpdates.password_hash = await hashPassword((updates as any).password);
    delete (safeUpdates as any).password;
  }

  // Serialize JSONB fields so pg sends them as JSON strings, not native arrays
  for (const col of JSONB_COLUMNS) {
    if (col in safeUpdates && safeUpdates[col] != null && typeof safeUpdates[col] !== 'string') {
      safeUpdates[col] = JSON.stringify(safeUpdates[col]);
    }
  }

  const fields = Object.keys(safeUpdates).filter(f => ALLOWED_UPDATE_COLUMNS.has(f));
  if (fields.length === 0) return getUserById(id);

  const setClause = fields.map((f, i) => `"${f}" = $${i + 2}`).join(', ');
  const values = fields.map((f) => safeUpdates[f]);

  const result = await pool.query(
    `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );

  return result.rows[0] || null;
}

export async function incrementLoginAttempts(email: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET login_attempts = COALESCE(login_attempts, 0) + 1,
         locked_until = CASE WHEN COALESCE(login_attempts, 0) >= 5 THEN NOW() + INTERVAL '30 minutes' ELSE locked_until END
     WHERE email = $1`,
    [normalizeEmail(email)]
  );
}

export async function resetLoginAttempts(email: string): Promise<void> {
  await pool.query(
    `UPDATE users SET login_attempts = 0, locked_until = NULL WHERE email = $1`,
    [normalizeEmail(email)]
  );
}

export async function deleteUserById(id: string): Promise<void> {
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
}

export async function comparePassword(
  candidatePassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, passwordHash);
}

// ── Password Reset ──────────────────────────────────────────────────────────

export function generatePasswordResetToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return { token, expires };
}

/**
 * Store a password-reset token on the user row.
 * Re-uses the verification_token / verification_token_expires columns
 * (they're NULL after the user verified their email, so safe to reuse).
 */
export async function setPasswordResetToken(
  email: string,
): Promise<{ token: string; user: User } | null> {
  const { token, expires } = generatePasswordResetToken();

  const result = await pool.query(
    `UPDATE users
     SET verification_token = $1, verification_token_expires = $2, updated_at = NOW()
     WHERE email = $3 AND is_verified = TRUE
     RETURNING *`,
    [token, expires, normalizeEmail(email)],
  );

  if (!result.rows[0]) return null;
  return { token, user: result.rows[0] };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<User | null> {
  const user = await getUserByVerificationToken(token);
  if (!user) return null;

  const password_hash = await hashPassword(newPassword);

  const result = await pool.query(
    `UPDATE users
     SET password_hash = $1, verification_token = NULL, verification_token_expires = NULL,
         login_attempts = 0, locked_until = NULL, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [password_hash, user.id],
  );

  return result.rows[0] || null;
}

/**
 * Default export: mongoose-like adapter for backwards compatibility
 */
const UserModel = {
  async findById(id: string) {
    return getUserById(id);
  },

  async findOne(filter: { email?: string }) {
    if (filter.email) return getUserByEmail(filter.email);
    return null;
  },

  async create(input: Parameters<typeof createUser>[0]) {
    return createUser(input);
  },

  async updateById(id: string, updates: Parameters<typeof updateUserById>[1]) {
    return updateUserById(id, updates);
  },

  async findByIdAndUpdate(id: string, updates: Parameters<typeof updateUserById>[1]) {
    return updateUserById(id, updates);
  },

  async findByIdAndDelete(id: string) {
    const user = await getUserById(id);
    if (user) await deleteUserById(id);
    return user;
  },

  async comparePassword(candidatePassword: string, passwordHash: string) {
    return comparePassword(candidatePassword, passwordHash);
  },
};

export default UserModel;
