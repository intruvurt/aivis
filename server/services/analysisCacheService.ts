import type { Pool, PoolClient } from 'pg'
import { pool } from './postgresql.ts'
import type { AnalysisResponse } from '../src/types.ts'

type CacheRow = {
  result: unknown;
  analyzed_at?: Date | null;
  updated_at?: Date | null;
  created_at?: Date | null;
};

type CacheStats = {
  total_entries: number;
  oldest_entry: Date | null;
  newest_entry: Date | null;
};

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
        // Log rollback failure but preserve original error
        console.error('Rollback failed:', rollbackError);
      }
      throw error;
    }
  });
}

/**
 * Validates that the result object contains required AnalysisResponse fields
 */
function validateAnalysisResult(obj: unknown): obj is Omit<AnalysisResponse, 'analyzed_at'> {
  if (!obj || typeof obj !== 'object') return false;
  
  const result = obj as Record<string, unknown>;
  
  // Check for required fields based on your AnalysisResponse type
  return (
    typeof result.url === 'string' &&
    typeof result.visibility_score !== 'undefined'
    // Add other required field checks here
  );
}

export class AnalysisCacheService {
  /**
   * Returns cached analysis regardless of age (fast path).
   * Use this when you want ANY cached result, even if stale.
   */
  static async get(url: string): Promise<AnalysisResponse | null> {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL parameter');
    }

    const normalizedUrl = url.trim().toLowerCase();
    
    try {
      // Use updated_at which is guaranteed to exist in base migration
      const res = await pool.query<CacheRow>(
        `SELECT result, updated_at as analyzed_at
         FROM public.analysis_cache WHERE url = $1`,
        [normalizedUrl]
      );

      if (!res.rows || res.rows.length === 0) {
        return null;
      }

      const row = res.rows[0];
      
      if (!row.result) {
        console.warn(`Cache entry for ${normalizedUrl} has null result`);
        return null;
      }

      const resultObj = row.result as Record<string, unknown>;

      if (!validateAnalysisResult(resultObj)) {
        console.error(`Invalid cache data structure for ${normalizedUrl}`);
        return null;
      }

      // Handle various date formats/columns gracefully
      const timestamp = row.analyzed_at ?? row.updated_at ?? row.created_at ?? new Date();
      return {
        ...resultObj,
        analyzed_at: timestamp instanceof Date 
          ? timestamp.toISOString() 
          : String(timestamp),
      } as AnalysisResponse;
    } catch (error) {
      console.error('Cache get error:', error);
      throw new Error(`Failed to retrieve cache for ${normalizedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Returns cached analysis only if within maxAgeDays.
   * This is the primary method for API routes - ensures fresh data.
   * 
   * @param url - The URL to look up
   * @param maxAgeDays - Maximum age in days (default: 7)
   */
  static async getFresh(
    url: string, 
    maxAgeDays = 7
  ): Promise<AnalysisResponse | null> {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL parameter');
    }

    if (maxAgeDays < 0 || !Number.isFinite(maxAgeDays)) {
      throw new Error('Invalid maxAgeDays parameter');
    }

    const normalizedUrl = url.trim().toLowerCase();

    try {
      // Use updated_at which is guaranteed to exist in base migration
      const res = await pool.query<CacheRow>(
        `SELECT result, updated_at as analyzed_at
         FROM public.analysis_cache
         WHERE url = $1
           AND updated_at > NOW() - ($2 || ' days')::interval`,
        [normalizedUrl, maxAgeDays]
      );

      if (!res.rows || res.rows.length === 0) {
        return null;
      }

      const row = res.rows[0];
      
      if (!row.result) {
        console.warn(`Cache entry for ${normalizedUrl} has null result`);
        return null;
      }

      const resultObj = row.result as Record<string, unknown>;

      if (!validateAnalysisResult(resultObj)) {
        console.error(`Invalid cache data structure for ${normalizedUrl}`);
        return null;
      }

      // Handle various date formats/columns gracefully  
      const timestamp = row.analyzed_at ?? row.updated_at ?? row.created_at ?? new Date();
      return {
        ...resultObj,
        analyzed_at: timestamp instanceof Date 
          ? timestamp.toISOString() 
          : String(timestamp),
      } as AnalysisResponse;
    } catch (error) {
      console.error('Cache getFresh error:', error);
      throw new Error(`Failed to retrieve fresh cache for ${normalizedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upsert cache entry with validation.
   * Note: result should be the analysis payload *without* analyzed_at
   * (we stamp it in DB and return it separately).
   * 
   * @param url - The URL to cache
   * @param result - Analysis result without analyzed_at field
   */
  static async set(
    url: string, 
    result: Omit<AnalysisResponse, 'analyzed_at'>
  ): Promise<void> {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL parameter');
    }

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid result parameter');
    }

    if (!validateAnalysisResult(result)) {
      throw new Error('Result does not match expected AnalysisResponse structure');
    }

    const normalizedUrl = url.trim().toLowerCase();

    try {
      await executeTransaction(pool, async (client) => {
        // Use only columns guaranteed to exist in base migration (001)
        // analyzed_at_timestamp is BIGINT, so use epoch milliseconds
        await client.query(
          `INSERT INTO public.analysis_cache (url, result, analyzed_at_timestamp, updated_at)
           VALUES ($1, $2::jsonb, $3, NOW())
           ON CONFLICT (url)
           DO UPDATE SET 
             result = EXCLUDED.result,
             analyzed_at_timestamp = EXCLUDED.analyzed_at_timestamp,
             updated_at = NOW()`,
          [normalizedUrl, JSON.stringify(result), Date.now()]
        );
      });
    } catch (error) {
      console.error('Cache set error:', error);
      throw new Error(`Failed to cache analysis for ${normalizedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a specific cache entry by URL
   */
  static async delete(url: string): Promise<boolean> {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL parameter');
    }

    const normalizedUrl = url.trim().toLowerCase();

    try {
      const res = await pool.query(
        'DELETE FROM public.analysis_cache WHERE url = $1',
        [normalizedUrl]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      throw new Error(`Failed to delete cache for ${normalizedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete stale cache entries older than specified days
   */
  static async deleteStale(olderThanDays = 30): Promise<number> {
    if (olderThanDays < 0 || !Number.isFinite(olderThanDays)) {
      throw new Error('Invalid olderThanDays parameter');
    }

    try {
      // Use updated_at which is guaranteed to exist
      const res = await pool.query(
        `DELETE FROM public.analysis_cache
         WHERE updated_at < NOW() - ($1 || ' days')::interval`,
        [olderThanDays]
      );
      return res.rowCount ?? 0;
    } catch (error) {
      console.error('Cache deleteStale error:', error);
      throw new Error(`Failed to delete stale cache entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  static async getStats(): Promise<CacheStats> {
    try {
      // Use updated_at which is guaranteed to exist
      const res = await pool.query<{
        total_entries: string;
        oldest_entry: Date | null;
        newest_entry: Date | null;
      }>(
        `SELECT 
           COUNT(*)::text as total_entries,
           MIN(updated_at) as oldest_entry,
           MAX(updated_at) as newest_entry
         FROM public.analysis_cache`
      );

      const row = res.rows[0];
      return {
        total_entries: parseInt(row.total_entries, 10) || 0,
        oldest_entry: row.oldest_entry,
        newest_entry: row.newest_entry,
      };
    } catch (error) {
      console.error('Cache getStats error:', error);
      throw new Error(`Failed to get cache statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if cache entry exists (without retrieving full data)
   */
  static async exists(url: string): Promise<boolean> {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL parameter');
    }

    const normalizedUrl = url.trim().toLowerCase();

    try {
      const res = await pool.query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM public.analysis_cache WHERE url = $1) as exists',
        [normalizedUrl]
      );
      return res.rows[0]?.exists ?? false;
    } catch (error) {
      console.error('Cache exists error:', error);
      throw new Error(`Failed to check cache existence for ${normalizedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Admin-only: Clear all cache entries.
   * USE WITH EXTREME CAUTION IN PRODUCTION.
   * 
   * @param confirmToken - Must pass 'CONFIRM_CLEAR_ALL' to execute
   */
  static async clearAll(confirmToken?: string): Promise<number> {
    if (confirmToken !== 'CONFIRM_CLEAR_ALL') {
      throw new Error('clearAll requires confirmation token: CONFIRM_CLEAR_ALL');
    }

    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  CLEARING ALL CACHE IN PRODUCTION');
    }

    try {
      const res = await executeTransaction(pool, async (client) => {
        const countRes = await client.query('SELECT COUNT(*) FROM public.analysis_cache');
        await client.query('TRUNCATE TABLE public.analysis_cache');
        return countRes;
      });

      const deletedCount = parseInt(res.rows[0]?.count ?? '0', 10);
      console.log(`Cleared ${deletedCount} cache entries`);
      return deletedCount;
    } catch (error) {
      console.error('Cache clear all error:', error);
      throw new Error(`Failed to clear all cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
export default AnalysisCacheService;