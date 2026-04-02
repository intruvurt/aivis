import { Redis } from 'ioredis';
import { getPool } from './postgresql.js';
import { getRedis } from '../infra/redis.js';

type CacheValue = Record<string, any> & { analyzed_at?: string };

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function getRedisClient(): Redis | null {
  return getRedis();
}

export class AnalysisCacheService {
  /**
   * Get cached analysis from Redis (if available) or PostgreSQL
   */
  static async get(url: string): Promise<CacheValue | null> {
    const normalizedUrl = url.trim().toLowerCase();

    // Try Redis first
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(`analysis:${normalizedUrl}`);
        if (cached) {
          console.log(`[Cache] Redis hit: ${normalizedUrl}`);
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
        `SELECT result, analyzed_at FROM analysis_cache WHERE url = $1`,
        [normalizedUrl]
      );

      if (result.rows.length > 0) {
        const data = result.rows[0];
        const cacheValue = {
          ...data.result,
          analyzed_at: data.analyzed_at,
        };

        // Populate Redis cache for next time
        if (redis) {
          try {
            await redis.setex(
              `analysis:${normalizedUrl}`,
              CACHE_TTL,
              JSON.stringify(cacheValue)
            );
          } catch (error: any) {
            console.error('[Cache] Redis set error:', error.message);
          }
        }

        console.log(`[Cache] PostgreSQL hit: ${normalizedUrl}`);
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
    const normalizedUrl = url.trim().toLowerCase();

    // Store in Redis
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.setex(`analysis:${normalizedUrl}`, CACHE_TTL, JSON.stringify(value));
        console.log(`[Cache] Redis stored: ${normalizedUrl}`);
      } catch (error: any) {
        console.error('[Cache] Redis set error:', error.message);
      }
    }

    // Store in PostgreSQL
    try {
      const pool = getPool();
      const analyzedAt = value.analyzed_at || new Date().toISOString();
      const analyzedAtTimestamp = new Date(analyzedAt).getTime();

      await pool.query(
        `
        INSERT INTO analysis_cache (url, result, analyzed_at, analyzed_at_timestamp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (url) DO UPDATE SET
          result = EXCLUDED.result,
          analyzed_at = EXCLUDED.analyzed_at,
          analyzed_at_timestamp = EXCLUDED.analyzed_at_timestamp,
          updated_at = NOW()
        `,
        [normalizedUrl, JSON.stringify(value), analyzedAt, analyzedAtTimestamp]
      );

      console.log(`[Cache] PostgreSQL stored: ${normalizedUrl}`);
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
      await pool.query('DELETE FROM analysis_cache');
      console.log('[Cache] PostgreSQL cleared');
    } catch (error: any) {
      console.error('[Cache] PostgreSQL clear error:', error.message);
    }
  }

  /**
   * Remove specific URL from cache
   */
  static async delete(url: string): Promise<void> {
    const normalizedUrl = url.trim().toLowerCase();

    // Delete from Redis
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.del(`analysis:${normalizedUrl}`);
      } catch (error: any) {
        console.error('[Cache] Redis delete error:', error.message);
      }
    }

    // Delete from PostgreSQL
    try {
      const pool = getPool();
      await pool.query('DELETE FROM analysis_cache WHERE url = $1', [normalizedUrl]);
    } catch (error: any) {
      console.error('[Cache] PostgreSQL delete error:', error.message);
    }
  }
}

// Cleanup on process exit — shared connection is managed by infra/redis
process.on('SIGTERM', async () => {
  const r = getRedis();
  if (r) await r.quit();
});

process.on('SIGINT', async () => {
  const r = getRedis();
  if (r) await r.quit();
});
