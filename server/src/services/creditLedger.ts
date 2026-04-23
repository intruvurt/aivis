import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getRedis } from '../infra/redis.js';
import { executeTransaction, getPool } from './postgresql.js';

export type CreditLedgerEventType =
    | 'subscription_grant'
    | 'topup'
    | 'usage'
    | 'refund'
    | 'adjustment';

export type CreditLedgerSource = 'stripe' | 'api' | 'mcp' | 'system' | 'gateway';

function roundCredits(value: number): number {
    return Math.round(Math.max(0, Number(value || 0)) * 100) / 100;
}

export async function getCreditLedgerBalance(userId: string, client?: PoolClient): Promise<number> {
    const queryable = client || getPool();
    const ledger = await queryable.query(
        `SELECT COALESCE(SUM(delta), 0) AS balance, COUNT(*)::int AS event_count
     FROM credit_ledger
     WHERE user_id = $1`,
        [userId],
    );
    const fallback = await queryable.query(
        'SELECT credits_remaining FROM scan_pack_credits WHERE user_id = $1',
        [userId],
    );

    const ledgerBalance = roundCredits(Number(ledger.rows?.[0]?.balance || 0));
    const legacyBalance = roundCredits(Number(fallback.rows?.[0]?.credits_remaining || 0));

    return Math.max(ledgerBalance, legacyBalance);
}

export async function appendCreditLedgerEvent(args: {
    userId: string;
    type: CreditLedgerEventType;
    delta: number;
    source: CreditLedgerSource;
    requestId?: string | null;
    stripeEventId?: string | null;
    metadata?: Record<string, unknown> | null;
    client?: PoolClient;
}): Promise<{ inserted: boolean }> {
    const queryable = args.client || getPool();
    const delta = Math.round(Number(args.delta || 0) * 100) / 100;
    if (!Number.isFinite(delta) || delta === 0) {
        return { inserted: false };
    }

    const result = await queryable.query(
        `INSERT INTO credit_ledger (id, user_id, type, delta, source, request_id, stripe_event_id, metadata)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7)
     ON CONFLICT DO NOTHING
     RETURNING id`,
        [
            args.userId,
            args.type,
            delta,
            args.source,
            args.requestId || null,
            args.stripeEventId || null,
            args.metadata ? JSON.stringify(args.metadata) : null,
        ],
    );

    return { inserted: result.rows.length > 0 };
}

export async function reserveCredits(args: {
    userId: string;
    amount: number;
    requestId?: string;
    source?: string;
    ttlSeconds?: number;
}): Promise<{ reserved: boolean; reservationId?: string; availableBalance: number }> {
    const amount = roundCredits(args.amount);
    if (amount <= 0) {
        const balance = await getCreditLedgerBalance(args.userId);
        return { reserved: false, availableBalance: balance };
    }

    return executeTransaction(async (client) => {
        const balance = await getCreditLedgerBalance(args.userId, client);
        const reserveAgg = await client.query(
            `SELECT COALESCE(SUM(amount), 0) AS reserved
       FROM credit_reservations
       WHERE user_id = $1
         AND status = 'reserved'
         AND expires_at > NOW()`,
            [args.userId],
        );
        const reserved = roundCredits(Number(reserveAgg.rows?.[0]?.reserved || 0));
        const spendable = roundCredits(balance - reserved);
        if (spendable < amount) {
            return { reserved: false, availableBalance: spendable };
        }

        const reservationId = crypto.randomUUID();
        const ttlSeconds = Math.max(15, Number(args.ttlSeconds || 120));
        await client.query(
            `INSERT INTO credit_reservations
       (id, user_id, amount, request_id, source, status, expires_at)
       VALUES ($1, $2, $3, NULLIF($4, ''), $5, 'reserved', NOW() + ($6::text || ' seconds')::interval)`,
            [reservationId, args.userId, amount, args.requestId || null, args.source || 'gateway', ttlSeconds],
        );

        return { reserved: true, reservationId, availableBalance: roundCredits(spendable - amount) };
    });
}

export async function releaseReservation(reservationId: string): Promise<void> {
    await getPool().query(
        `UPDATE credit_reservations
     SET status = 'released', released_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'reserved'`,
        [reservationId],
    );
}

export async function commitReservedUsage(args: {
    reservationId: string;
    userId: string;
    requestId?: string | null;
    reason?: string;
    metadata?: Record<string, unknown>;
}): Promise<{ committed: boolean; balance: number }> {
    return executeTransaction(async (client) => {
        const lock = await client.query(
            `SELECT id, amount, status
       FROM credit_reservations
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
            [args.reservationId, args.userId],
        );

        const row = lock.rows[0];
        if (!row || row.status !== 'reserved') {
            const balance = await getCreditLedgerBalance(args.userId, client);
            return { committed: false, balance };
        }

        const amount = roundCredits(Number(row.amount || 0));
        await appendCreditLedgerEvent({
            userId: args.userId,
            type: 'usage',
            delta: -amount,
            source: 'gateway',
            requestId: args.requestId || null,
            metadata: {
                reservationId: args.reservationId,
                reason: args.reason || 'gateway_usage',
                ...(args.metadata || {}),
            },
            client,
        });

        await client.query(
            `UPDATE credit_reservations
       SET status = 'committed', committed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
            [args.reservationId],
        );

        const balance = await getCreditLedgerBalance(args.userId, client);
        return { committed: true, balance };
    });
}

export async function withCreditDecisionLock<T>(
    userId: string,
    requestId: string,
    fn: () => Promise<T>,
): Promise<T> {
    const redis = getRedis();
    if (!redis) {
        return fn();
    }

    const lockKey = `lock:credits:user:${userId}`;
    const lockToken = `${requestId}:${Date.now()}`;
    const acquired = await redis.set(lockKey, lockToken, 'EX', 10, 'NX');
    if (acquired !== 'OK') {
        throw Object.assign(new Error('Credit gateway is currently handling another request. Retry in a few seconds.'), {
            code: 'CREDIT_DECISION_LOCKED',
            status: 429,
        });
    }

    try {
        return await fn();
    } finally {
        const releaseScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `;
        await redis.eval(releaseScript, 1, lockKey, lockToken).catch(() => { });
    }
}