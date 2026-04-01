import type { DateRange } from './gsc.types.js';

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.floor(days)));
  return toIsoDate(d);
}

export function buildTrailingRange(windowDays: number, offsetDays = 0): DateRange {
  const safeWindow = Math.max(1, Math.floor(windowDays));
  const safeOffset = Math.max(0, Math.floor(offsetDays));

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - safeOffset);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (safeWindow - 1));

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

export function monthWindowAgo(monthsAgo: number): DateRange {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - monthsAgo);

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

export function parseIsoDate(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`);
}
