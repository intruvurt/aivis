import apiFetch from '../utils/api';

export type CloudflareSignalResponse = {
  success: boolean;
  signal?: {
    url: string;
    urlHash: string;
    metrics: {
      requests: number;
      cacheHitRate: number;
      aiCrawlerHits: number;
      humanHits: number;
      avgLatencyMs: number;
      dataServedBytes: number;
    };
    derived: {
      scanIntensity: number;
      cacheStability: number;
      crawlCostScore: number;
      aiVisibilityGate: 'open' | 'restricted';
      trafficPhysicsScore: number;
    };
    explanation: string[];
    observedAt: string;
  };
  error?: string;
};

export async function fetchCloudflareSignal(url: string, workspaceId?: string): Promise<CloudflareSignalResponse> {
  const params = new URLSearchParams({ url });
  if (workspaceId) params.set('workspace_id', workspaceId);

  const response = await apiFetch(`/api/cloudflare/signals?${params.toString()}`, {
    method: 'GET',
  });

  const data = await response.json().catch(() => ({ success: false, error: 'Invalid response payload' }));

  if (!response.ok) {
    return {
      success: false,
      error: String(data?.error || `Cloudflare signal fetch failed (${response.status})`),
    };
  }

  return data as CloudflareSignalResponse;
}
