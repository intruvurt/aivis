import { PoolClient } from 'pg';
import { getConnection, executeTransaction } from './postgresql.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export class AuthService {
  // Register a new user
  static async registerUser({ email, password }) {
    const password_hash = await bcrypt.hash(password, 12);
    return executeTransaction(async (client: PoolClient) => {
      const res = await client.query(
        `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, created_at`,
        [uuidv4(), email, password_hash]
      );
      return res.rows[0];
    });
  }

  // Authenticate user
  static async authenticate({ email, password }) {
    return executeTransaction(async (client: PoolClient) => {
      const res = await client.query(
        `SELECT id, email, password_hash FROM users WHERE email = $1`,
        [email]
      );
      if (res.rows.length === 0) return null;
      const user = res.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return null;
      return { id: user.id, email: user.email };
    });
  }

  // Add more methods for MFA, RBAC, etc. as needed
}
