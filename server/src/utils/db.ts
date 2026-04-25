import type { PoolClient, QueryResult } from 'pg';
import pool from '../config/db.js';

/**
 * Simple query wrapper for PostgreSQL
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
export const query = async (text: string, params: unknown[] = []): Promise<QueryResult> => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('PostgreSQL Query Error:', error);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise} PostgreSQL client
 */
export const getClient = async (): Promise<PoolClient> => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('PostgreSQL Client Error:', error);
    throw error;
  }
};
