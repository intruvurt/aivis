export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, {
  retries = 4,
  base = 300,
  factor = 2
}: { retries?: number; base?: number; factor?: number } = {}): Promise<T> {
  let err: unknown;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      err = e;
      await sleep(base * Math.pow(factor, i));
    }
  }

  throw (err instanceof Error ? err : new Error(String(err ?? 'Retry failed')));
}
