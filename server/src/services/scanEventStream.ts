import type { ScanEvent } from '../../../shared/types.js';
import { getRedis } from '../infra/redis.js';

const SCAN_STREAM_MAXLEN = 2000;
const SCAN_STREAM_TTL_SECONDS = 60 * 60 * 6; // 6 hours

function buildScanStreamKey(scanId: string): string {
  return `scan:${scanId}:events`;
}

function parseFieldPairs(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const value = fields[i + 1] ?? '';
    out[key] = value;
  }
  return out;
}

export interface ScanTimelineEvent {
  id: string;
  seq: number;
  timestamp: number;
  event: ScanEvent;
}

export async function appendScanEvent(
  scanId: string,
  seq: number,
  event: ScanEvent,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const key = buildScanStreamKey(scanId);
  try {
    await redis.xadd(
      key,
      'MAXLEN',
      '~',
      String(SCAN_STREAM_MAXLEN),
      '*',
      'seq',
      String(seq),
      'ts',
      String(Date.now()),
      'event',
      JSON.stringify(event),
    );
    await redis.expire(key, SCAN_STREAM_TTL_SECONDS);
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.warn('[scanEventStream] append failed:', e?.message || String(err));
  }
}

export async function readScanEvents(
  scanId: string,
  limit = 300,
): Promise<ScanTimelineEvent[]> {
  const redis = getRedis();
  if (!redis) return [];

  const key = buildScanStreamKey(scanId);
  try {
    const rows = await redis.xrevrange(key, '+', '-', 'COUNT', limit);
    const parsed = rows
      .map(([id, fields]) => {
        const map = parseFieldPairs(fields);
        let event: ScanEvent | null = null;
        try {
          event = JSON.parse(map.event || '{}') as ScanEvent;
        } catch {
          event = null;
        }
        if (!event) return null;
        const seq = Number(map.seq || 0);
        const timestamp = Number(map.ts || 0);
        return {
          id,
          seq: Number.isFinite(seq) ? seq : 0,
          timestamp: Number.isFinite(timestamp) ? timestamp : 0,
          event,
        } as ScanTimelineEvent;
      })
      .filter((row): row is ScanTimelineEvent => row !== null)
      .sort((a, b) => a.seq - b.seq);

    return parsed;
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.warn('[scanEventStream] read failed:', e?.message || String(err));
    return [];
  }
}
