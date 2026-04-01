import { PoolClient } from 'pg';
import { getConnection, executeTransaction } from './postgresql.js';

export class AnalysisCacheService {
  static async get(url: string) {
    return executeTransaction(async (client: PoolClient) => {
      const res = await client.query(
        'SELECT result, analyzed_at_timestamp FROM analysis_cache WHERE url = $1',
        [url]
      );
      if (res.rows.length === 0) return null;
      return {
        ...res.rows[0].result,
        analyzed_at_timestamp: res.rows[0].analyzed_at_timestamp,
      };
    });
  }

  static async set(url: string, result: any) {
    return executeTransaction(async (client: PoolClient) => {
      await client.query(
        `INSERT INTO analysis_cache (url, result, analyzed_at_timestamp, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (url) DO UPDATE SET result = $2, analyzed_at_timestamp = $3, updated_at = NOW()`,
        [url, result, Date.now()]
      );
    });
  }

  static async clearAll() {
    return executeTransaction(async (client: PoolClient) => {
      await client.query('DELETE FROM analysis_cache');
    });
  }
}
