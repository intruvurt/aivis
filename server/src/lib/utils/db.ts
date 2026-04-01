import pool from "../../config/db.js";

/**
 * Simple query wrapper for PostgreSQL
 */
export const query = async (text: string, params: any[] = []) => {
  try {
    return await pool.query(text, params);
  } catch (error: any) {
    console.error("PostgreSQL Query Error:", error);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 */
export const getClient = async () => {
  try {
    return await pool.connect();
  } catch (error: any) {
    console.error("PostgreSQL Client Error:", error);
    throw error;
  }
};
