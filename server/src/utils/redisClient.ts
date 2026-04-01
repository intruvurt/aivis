import redis from '../config/redis.ts';

/**
 * Set a value in Redis cache with optional expiration
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} expire - Expiration time in seconds (default: 3600)
 */
export const cacheSet = async (key, value, expire = 3600) => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', expire);
  } catch (error) {
    console.error('Redis Set Error:', error);
    throw error;
  }
};

/**
 * Get a value from Redis cache
 * @param {string} key - Cache key
 * @returns {Promise} Parsed value or null if not found
 */
export const cacheGet = async (key) => {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error('Redis Get Error:', error);
    throw error;
  }
};

/**
 * Delete a key from Redis cache
 * @param {string} key - Cache key
 */
export const cacheDel = async (key) => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error('Redis Delete Error:', error);
    throw error;
  }
};

/**
 * Check if a key exists in Redis cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} True if key exists
 */
export const cacheExists = async (key) => {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('Redis Exists Error:', error);
    throw error;
  }
};
