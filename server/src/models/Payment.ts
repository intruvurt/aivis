import { pool } from '../services/postgresql.js';

export interface Payment {
  id: string;
  user_id: string;
  tier: string;
  method: 'stripe' | 'crypto';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  stripe_session_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  amount_cents?: number | null;
  currency: string;
  completed_at?: Date | null;
  failed_at?: Date | null;
  canceled_at?: Date | null;
  subscription_status?: string | null;
  cancel_at_period_end?: boolean;
  last_payment_at?: Date | null;
  last_invoice_id?: string | null;
  last_failed_payment_at?: Date | null;
  failed_invoice_id?: string | null;
  metadata?: Record<string, any> | null;
  current_period_start?: Date | null;
  current_period_end?: Date | null;
  created_at: Date;
  updated_at: Date;
}

type CreatePaymentInput = {
  user: string;          // user_id
  tier: string;
  method?: 'stripe' | 'crypto';
  status: string;
  stripeSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  amountCents?: number;
  currency?: string;
  completedAt?: Date;
  metadata?: Record<string, any>;
};

// ─── create ──────────────────────────────────────────────────────────────────

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const result = await pool.query(
    `INSERT INTO payments
       (user_id, tier, method, status,
        stripe_session_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        amount_cents, currency, completed_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.user,
      input.tier,
      input.method ?? 'stripe',
      input.status,
      input.stripeSessionId ?? null,
      input.stripeCustomerId ?? null,
      input.stripeSubscriptionId ?? null,
      input.stripePriceId ?? null,
      input.amountCents ?? null,
      input.currency ?? 'usd',
      input.completedAt ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  return result.rows[0];
}

// ─── findOne ─────────────────────────────────────────────────────────────────

export async function findPaymentBySessionId(sessionId: string): Promise<Payment | null> {
  const r = await pool.query(
    `SELECT * FROM payments WHERE stripe_session_id = $1 LIMIT 1`,
    [sessionId]
  );
  return r.rows[0] ?? null;
}

export async function findPaymentBySubscriptionId(subId: string): Promise<Payment | null> {
  const r = await pool.query(
    `SELECT * FROM payments WHERE stripe_subscription_id = $1 LIMIT 1`,
    [subId]
  );
  return r.rows[0] ?? null;
}

/** Returns the most recent completed payment with a stripe_customer_id for a user */
export async function findLatestCompletedPaymentByUser(userId: string): Promise<Payment | null> {
  const r = await pool.query(
    `SELECT * FROM payments
     WHERE user_id = $1 AND status = 'completed' AND stripe_customer_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return r.rows[0] ?? null;
}

// ─── update ──────────────────────────────────────────────────────────────────

export async function updatePaymentBySessionId(
  sessionId: string,
  updates: Partial<{
    status: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    completed_at: Date;
    failed_at: Date;
    canceled_at: Date;
    subscription_status: string;
    cancel_at_period_end: boolean;
    last_payment_at: Date;
    last_invoice_id: string;
    last_failed_payment_at: Date;
    failed_invoice_id: string;
  }>
): Promise<Payment | null> {
  return _updatePayment('stripe_session_id', sessionId, updates);
}

export async function updatePaymentBySubscriptionId(
  subId: string,
  updates: Partial<{
    status: string;
    stripe_customer_id: string;
    subscription_status: string;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    canceled_at: Date;
    last_payment_at: Date;
    last_invoice_id: string;
    last_failed_payment_at: Date;
    failed_invoice_id: string;
  }>
): Promise<Payment | null> {
  return _updatePayment('stripe_subscription_id', subId, updates);
}

async function _updatePayment(
  whereCol: string,
  whereVal: string,
  updates: Record<string, any>
): Promise<Payment | null> {
  const keys = Object.keys(updates);
  if (keys.length === 0) return null;
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => updates[k]);
  const r = await pool.query(
    `UPDATE payments SET ${setClause}, updated_at = NOW()
     WHERE ${whereCol} = $1
     RETURNING *`,
    [whereVal, ...values]
  );
  return r.rows[0] ?? null;
}

// ─── getPaymentById (kept for backwards compat) ───────────────────────────────

export async function getPaymentById(id: string): Promise<Payment | null> {
  const r = await pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

// ─── Default export (adapter so paymentController can call Payment.create etc) ──

const PaymentModel = {
  create: createPayment,
  findOne: findLatestCompletedPaymentByUser,         // context-specific, see controller
  findOneAndUpdate: (filter: any, update: any) => {
    // Dispatches based on filter shape - covers all cases in paymentController
    if (filter.stripeSessionId) {
      return updatePaymentBySessionId(filter.stripeSessionId, _mapCamelToSnake(update));
    }
    if (filter.stripeSubscriptionId) {
      return updatePaymentBySubscriptionId(filter.stripeSubscriptionId, _mapCamelToSnake(update));
    }
    if (filter['metadata.paymentIntentId']) {
      // One-time payment intent: no direct lookup needed currently
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  },
  findBySessionId: findPaymentBySessionId,
  findBySubscriptionId: findPaymentBySubscriptionId,
  findLatestByUser: findLatestCompletedPaymentByUser,
};

export default PaymentModel;

// ─── helpers ─────────────────────────────────────────────────────────────────

function _mapCamelToSnake(obj: Record<string, any>): Record<string, any> {
  const map: Record<string, string> = {
    status: 'status',
    stripeCustomerId: 'stripe_customer_id',
    stripeSubscriptionId: 'stripe_subscription_id',
    completedAt: 'completed_at',
    failedAt: 'failed_at',
    canceledAt: 'canceled_at',
    subscriptionStatus: 'subscription_status',
    currentPeriodEnd: 'current_period_end',
    cancelAtPeriodEnd: 'cancel_at_period_end',
    lastPaymentAt: 'last_payment_at',
    lastInvoiceId: 'last_invoice_id',
    lastFailedPaymentAt: 'last_failed_payment_at',
    failedInvoiceId: 'failed_invoice_id',
  };
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const mapped = map[k];
    if (mapped) result[mapped] = v;
  }
  return result;
}
