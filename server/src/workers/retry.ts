function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Exponential backoff retry wrapper
 *
 * Rules:
 * - retries ONLY transient failures
 * - increases delay exponentially
 * - adds jitter to avoid worker sync collapse
 */
export async function withRetry(fn, options = {}) {
  const {
    retries = 5,
    baseDelay = 300,
    factor = 2,
    jitter = 0.3,
    onRetry = () => {}
  } = options;

  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) {
        throw err;
      }

      const exponential = baseDelay * Math.pow(factor, attempt);
      const randomJitter = exponential * jitter * Math.random();
      const delay = exponential + randomJitter;

      onRetry({
        attempt,
        delay,
        error: err
      });

      await sleep(delay);
      attempt++;
    }
  }
}
