export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function withRetry(fn, {
  retries = 4,
  base = 300,
  factor = 2
} = {}) {
  let err;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      await sleep(base * Math.pow(factor, i));
    }
  }

  throw err;
}
