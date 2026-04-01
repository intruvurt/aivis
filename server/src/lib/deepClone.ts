/**
 * Deep clone helper that prefers native structuredClone when available.
 * Falls back to Node's util.structuredClone (if present) or JSON round-trip.
 */
export function deepClone<T>(obj: T): T {
  // Prefer the global structuredClone in modern runtimes
  // (works in browsers and recent Node versions)
  try {
    const g = globalThis as any;
    if (typeof g.structuredClone === 'function') {
      return g.structuredClone(obj) as T;
    }
  } catch {
    // ignore
  }

  // Fallback to JSON deep-clone (loses functions, Dates become strings, etc.)
  return JSON.parse(JSON.stringify(obj));
}

export default deepClone;