import { getPool } from './postgresql.js';

interface CreatePaymentInput {
  userId: string;
  tier: string;
  method?: string;
  status?: string;
  stripeSessionId?: string;
  stripePriceId?: string;
  amountCents?: number;
  metadata?: Record<string, unknown>;
}

interface UpdatePaymentInput {
  status?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  current_period_end?: Date;
}

class PaymentServiceImpl {
  async create(input: CreatePaymentInput) {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO payments (
        user_id, tier, method, status, stripe_session_id, stripe_price_id, amount_cents, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        input.userId,
        input.tier,
        input.method ?? 'stripe',
        input.status ?? 'pending',
        input.stripeSessionId ?? null,
        input.stripePriceId ?? null,
        input.amountCents ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );
    return result.rows[0];
  }

  async updateBySessionId(sessionId: string, updates: UpdatePaymentInput) {
    const pool = getPool();
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${i++}`);
      values.push(updates.status);
    }
    if (updates.stripe_customer_id !== undefined) {
      setClauses.push(`stripe_customer_id = $${i++}`);
      values.push(updates.stripe_customer_id);
    }
    if (updates.stripe_subscription_id !== undefined) {
      setClauses.push(`stripe_subscription_id = $${i++}`);
      values.push(updates.stripe_subscription_id);
    }
    if (updates.subscription_status !== undefined) {
      setClauses.push(`subscription_status = $${i++}`);
      values.push(updates.subscription_status);
    }
    if (updates.current_period_end !== undefined) {
      setClauses.push(`current_period_end = $${i++}`);
      values.push(updates.current_period_end);
    }

    values.push(sessionId);
    await pool.query(
      `UPDATE payments SET ${setClauses.join(', ')} WHERE stripe_session_id = $${i}`,
      values
    );
  }

  async updateBySubscriptionId(subscriptionId: string, updates: UpdatePaymentInput) {
    const pool = getPool();
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;

    if (updates.subscription_status !== undefined) {
      setClauses.push(`subscription_status = $${i++}`);
      values.push(updates.subscription_status);
    }
    if (updates.current_period_end !== undefined) {
      setClauses.push(`current_period_end = $${i++}`);
      values.push(updates.current_period_end);
    }
    if (updates.stripe_customer_id !== undefined) {
      setClauses.push(`stripe_customer_id = $${i++}`);
      values.push(updates.stripe_customer_id);
    }

    values.push(subscriptionId);
    await pool.query(
      `UPDATE payments SET ${setClauses.join(', ')} WHERE stripe_subscription_id = $${i}`,
      values
    );
  }

  async findWithCustomerId(userId: string) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT stripe_customer_id FROM payments
       WHERE user_id = $1 AND stripe_customer_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }
}

export const PaymentService = new PaymentServiceImpl();
