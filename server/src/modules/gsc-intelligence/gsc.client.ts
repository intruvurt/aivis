import type { GscMetricRow } from './gsc.types.js';

const GSC_FETCH_TIMEOUT_MS = 15_000;

export class GscClient {
  constructor(private readonly accessToken: string) {}

  async listSites(): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GSC_FETCH_TIMEOUT_MS);
    try {
    const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GSC listSites failed (${response.status}): ${text}`);
    }

    const json = await response.json() as { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> };
    const entries = Array.isArray(json.siteEntry) ? json.siteEntry : [];
    return entries
      .filter((entry) => entry.siteUrl)
      .map((entry) => ({
        siteUrl: String(entry.siteUrl),
        permissionLevel: String(entry.permissionLevel || 'siteUnverifiedUser'),
      }));
    } finally {
      clearTimeout(timer);
    }
  }

  async querySearchAnalytics(args: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    dimensions: string[];
    rowLimit?: number;
    startRow?: number;
    dimensionFilterGroups?: unknown[];
  }): Promise<GscMetricRow[]> {
    const encodedSite = encodeURIComponent(args.siteUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GSC_FETCH_TIMEOUT_MS);
    try {
    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        startDate: args.startDate,
        endDate: args.endDate,
        dimensions: args.dimensions,
        rowLimit: args.rowLimit ?? 500,
        startRow: args.startRow ?? 0,
        dimensionFilterGroups: args.dimensionFilterGroups ?? [],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GSC query failed (${response.status}): ${text}`);
    }

    const json = await response.json() as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };

    return (json.rows || []).map((row) => ({
      keys: Array.isArray(row.keys) ? row.keys : [],
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0),
    }));
    } finally {
      clearTimeout(timer);
    }
  }
}
