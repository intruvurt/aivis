import { Redis } from 'ioredis';
import { getPool } from './postgresql.js';
import { getRedis } from '../infra/redis.js';
import { normalizeTrackedUrl } from '../utils/normalizeUrl.js';
import { hashSha256Hex } from '../utils/urlHash.js';

type CacheValue = Record<string, any> & { analyzed_at?: string };

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const CACHE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

type CacheIdentity = {
  rawKey: string;
  canonicalKey: string;
  urlHash: string;
  redisKey: string;
};

function buildCacheIdentity(input: string): CacheIdentity {
  const rawKey = String(input || '').trim();
  const tierSeparator = '::tier:';
  const tierIndex = rawKey.indexOf(tierSeparator);
  const baseKey = tierIndex >= 0 ? rawKey.slice(0, tierIndex) : rawKey;
  const tierSuffix = tierIndex >= 0 ? rawKey.slice(tierIndex + tierSeparator.length).trim().toLowerCase() : '';
  const normalizedBase = normalizeTrackedUrl(baseKey) || baseKey.toLowerCase();
  const canonicalKey = tierSuffix ? `${normalizedBase}${tierSeparator}${tierSuffix}` : normalizedBase;
  const urlHash = hashSha256Hex(canonicalKey);
  return {
    rawKey,
    canonicalKey,
    urlHash,
    redisKey: `analysis:${urlHash}`,
  };
}

function computeExpiryIso(analyzedAt: string): string {
  const expiresAt = new Date(new Date(analyzedAt).getTime() + CACHE_TTL * 1000);
  return expiresAt.toISOString();
}

function getRedisClient(): Redis | null {
  return getRedis();
}

export class AnalysisCacheService {
  /**
   * Get cached analysis from Redis (if available) or PostgreSQL
   */
  static async get(url: string): Promise<CacheValue | null> {
    const identity = buildCacheIdentity(url);

    // Try Redis first
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(identity.redisKey);
        if (cached) {
          console.log(`[Cache] Redis hit: ${identity.canonicalKey}`);
          return JSON.parse(cached);
        }
      } catch (error: any) {
        console.error('[Cache] Redis get error:', error.message);
      }
    }

    // Fallback to PostgreSQL
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT result, analyzed_at, status, expires_at
           FROM analysis_cache
          WHERE url_hash = $1
          LIMIT 1`,
        [identity.urlHash]
      );

      if (result.rows.length > 0) {
        const data = result.rows[0];
        const now = Date.now();
        const expiresAtMs = new Date(data.expires_at).getTime();
        const analyzedAtMs = new Date(data.analyzed_at).getTime();

        if (data.status === 'invalidated') {
          return null;
        }

        if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) {
          await pool.query(
            `UPDATE analysis_cache
                SET status = 'expired',
                    updated_at = NOW()
              WHERE url_hash = $1
                AND status <> 'expired'`,
            [identity.urlHash],
          );
          return null;
        }

        const nextStatus = analyzedAtMs <= now - CACHE_STALE_AFTER_MS ? 'stale' : data.status;
        await pool.query(
          `UPDATE analysis_cache
              SET hit_count = COALESCE(hit_count, 0) + 1,
                  last_accessed_at = NOW(),
                  status = CASE
                    WHEN status = 'fresh' AND analyzed_at <= NOW() - INTERVAL '1 day' THEN 'stale'
                    ELSE status
                  END,
                  updated_at = NOW()
            WHERE url_hash = $1`,
          [identity.urlHash],
        );

        const cacheValue = {
          ...data.result,
          analyzed_at: data.analyzed_at,
          cache_status: nextStatus,
        };

        // Populate Redis cache for next time
        if (redis) {
          try {
            await redis.setex(
              identity.redisKey,
              CACHE_TTL,
              JSON.stringify(cacheValue)
            );
          } catch (error: any) {
            console.error('[Cache] Redis set error:', error.message);
          }
        }

        console.log(`[Cache] PostgreSQL hit: ${identity.canonicalKey}`);
        return cacheValue;
      }
    } catch (error: any) {
      console.error('[Cache] PostgreSQL get error:', error.message);
    }

    return null;
  }

  /**
   * Store analysis in both Redis and PostgreSQL
   */
  static async set(url: string, value: CacheValue): Promise<void> {
    const identity = buildCacheIdentity(url);

    // Store in Redis
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.setex(identity.redisKey, CACHE_TTL, JSON.stringify(value));
        console.log(`[Cache] Redis stored: ${identity.canonicalKey}`);
      } catch (error: any) {
        console.error('[Cache] Redis set error:', error.message);
      }
    }

    // Store in PostgreSQL
    try {
      const pool = getPool();
      const analyzedAt = value.analyzed_at || new Date().toISOString();
      const expiresAt = computeExpiryIso(analyzedAt);

      await pool.query(
        `
        INSERT INTO analysis_cache (raw_url, url, url_hash, result, analyzed_at, expires_at, status, last_accessed_at, hit_count)
        VALUES ($1, $2, $3, $4, $5, $6, 'fresh', NOW(), 0)
        ON CONFLICT (url_hash) DO UPDATE SET
          raw_url = EXCLUDED.raw_url,
          url = EXCLUDED.url,
          result = EXCLUDED.result,
          analyzed_at = EXCLUDED.analyzed_at,
          expires_at = EXCLUDED.expires_at,
          status = CASE
            WHEN analysis_cache.status IN ('stale', 'expired', 'invalidated') THEN 'revalidated'
            ELSE 'fresh'
          END,
          invalidated_at = NULL,
          last_accessed_at = NOW(),
          updated_at = NOW()
        `,
        [identity.rawKey || identity.canonicalKey, identity.canonicalKey, identity.urlHash, JSON.stringify(value), analyzedAt, expiresAt]
      );

      console.log(`[Cache] PostgreSQL stored: ${identity.canonicalKey}`);
    } catch (error: any) {
      console.error('[Cache] PostgreSQL set error:', error.message);
    }
  }

  /**
   * Clear all cache (Redis and PostgreSQL)
   */
  static async clearAll(): Promise<void> {
    // Clear Redis using SCAN (non-blocking) instead of KEYS (O(N) blocking)
    const redis = getRedisClient();
    if (redis) {
      try {
        let cursor = '0';
        let totalDeleted = 0;
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'analysis:*', 'COUNT', 200);
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
            totalDeleted += keys.length;
          }
        } while (cursor !== '0');
        if (totalDeleted > 0) console.log(`[Cache] Redis cleared: ${totalDeleted} keys`);
      } catch (error: any) {
        console.error('[Cache] Redis clear error:', error.message);
      }
    }

    // Clear PostgreSQL
    try {
      const pool = getPool();
      await pool.query(
        `UPDATE analysis_cache
            SET status = 'invalidated',
                invalidated_at = NOW(),
                updated_at = NOW()`
      );
      console.log('[Cache] PostgreSQL cleared');
    } catch (error: any) {
      console.error('[Cache] PostgreSQL clear error:', error.message);
    }
  }

  /**
   * Remove specific URL from cache
   */
  static async delete(url: string): Promise<void> {
    const identity = buildCacheIdentity(url);

    // Delete from Redis
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.del(identity.redisKey);
      } catch (error: any) {
        console.error('[Cache] Redis delete error:', error.message);
      }
    }

    // Delete from PostgreSQL
    try {
      const pool = getPool();
      await pool.query(
        `UPDATE analysis_cache
            SET status = 'invalidated',
                invalidated_at = NOW(),
                updated_at = NOW()
          WHERE url_hash = $1`,
        [identity.urlHash],
      );
    } catch (error: any) {
      console.error('[Cache] PostgreSQL delete error:', error.message);
    }
  }
}

// Cleanup on process exit - shared connection is managed by infra/redis
process.on('SIGTERM', async () => {
  const r = getRedis();
  if (r) await r.quit();
});

process.on('SIGINT', async () => {
  const r = getRedis();
  if (r) await r.quit();
});
