type CacheValue = Record<string, any> & { analyzed_at?: string };

const cache = new Map<string, CacheValue>([]);

export class AnalysisCacheService {
  static async get(url: string): Promise<CacheValue | null> {
    return cache.get(url) ?? null;
  }

  static async set(url: string, value: CacheValue): Promise<void> {
    cache.set(url, value);
  }

  static async clearAll(): Promise<void> {
    cache.clear();
  }
}
