<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/paymentService.ts
<<<<<<< Updated upstream
import { pool } from './postgresql.ts';
=======
import { pool } from './postgresql';
>>>>>>> Stashed changes
========
import { pool } from './postgresql.ts';
>>>>>>>> Stashed changes:services/paymentService.ts
=======
import { pool } from './postgresql';
>>>>>>> Stashed changes
import type { PoolClient } from 'pg';

// Types
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'canceled';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'unpaid';

export interface Payment {
  id: string;
  user_id: string;
  tier: string;
  method: string;
  status: PaymentStatus;
  stripe_session_id?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  amount_cents: number;
  currency: string;
  subscription_status?: SubscriptionStatus;
  current_period_end?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentInput {
  userId: string;
  tier: string;
  method: string;
  status: PaymentStatus;
  stripeSessionId?: string;
  stripePriceId?: string;
  amountCents: number;
  currency?: string;
  metadata?: Record<string, any>;
}

async function executeTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export class PaymentService {
  /**
   * Create a new payment record
   */
  static async create(input: CreatePaymentInput): Promise<Payment> {
    const res = await pool.query<Payment>(
      `INSERT INTO payments (
        user_id, tier, method, status, stripe_session_id, 
        stripe_price_id, amount_cents, currency, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        input.userId,
        input.tier,
        input.method,
        input.status,
        input.stripeSessionId || null,
        input.stripePriceId || null,
        input.amountCents,
        input.currency || 'usd',
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );
    return res.rows[0];
  }

  /**
   * Find payment by Stripe session ID
   */
  static async findBySessionId(sessionId: string): Promise<Payment | null> {
    const res = await pool.query<Payment>(
      'SELECT * FROM payments WHERE stripe_session_id = $1',
      [sessionId]
    );
    return res.rows[0] || null;
  }

  /**
   * Find most recent payment with Stripe customer ID for a user
   */
  static async findWithCustomerId(userId: string): Promise<Payment | null> {
    const res = await pool.query<Payment>(
      `SELECT * FROM payments 
       WHERE user_id = $1 
         AND stripe_customer_id IS NOT NULL 
         AND status = 'completed'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  /**
   * Update payment by Stripe session ID
   */
  static async updateBySessionId(
    sessionId: string,
    updates: Partial<Payment>
  ): Promise<Payment | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.stripe_customer_id !== undefined) {
      setClause.push(`stripe_customer_id = $${paramIndex++}`);
      values.push(updates.stripe_customer_id);
    }
    if (updates.stripe_subscription_id !== undefined) {
      setClause.push(`stripe_subscription_id = $${paramIndex++}`);
      values.push(updates.stripe_subscription_id);
    }
    if (updates.subscription_status !== undefined) {
      setClause.push(`subscription_status = $${paramIndex++}`);
      values.push(updates.subscription_status);
    }
    if (updates.current_period_end !== undefined) {
      setClause.push(`current_period_end = $${paramIndex++}`);
      values.push(updates.current_period_end);
    }
    if (updates.metadata !== undefined) {
      setClause.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    setClause.push(`updated_at = NOW()`);
    values.push(sessionId);

    const res = await pool.query<Payment>(
      `UPDATE payments SET ${setClause.join(', ')} 
       WHERE stripe_session_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return res.rows[0] || null;
  }

  /**
   * Update payment by Stripe subscription ID
   */
  static async updateBySubscriptionId(
    subscriptionId: string,
    updates: Partial<Payment>
  ): Promise<Payment | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.subscription_status !== undefined) {
      setClause.push(`subscription_status = $${paramIndex++}`);
      values.push(updates.subscription_status);
    }
    if (updates.current_period_end !== undefined) {
      setClause.push(`current_period_end = $${paramIndex++}`);
      values.push(updates.current_period_end);
    }

    setClause.push(`updated_at = NOW()`);
    values.push(subscriptionId);

    const res = await pool.query<Payment>(
      `UPDATE payments SET ${setClause.join(', ')} 
       WHERE stripe_subscription_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return res.rows[0] || null;
  }

  /**
   * Get user's subscription status
   */
  static async getUserSubscription(userId: string): Promise<Payment | null> {
    const res = await pool.query<Payment>(
      `SELECT * FROM payments 
       WHERE user_id = $1 
         AND subscription_status IN ('active', 'trialing')
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    return res.rows[0] || null;
  }
}

export default PaymentService;
