export type BrowserWorkerCitableBlock = {
  text: string;
  reason: string;
  source: 'body';
};

export type BrowserWorkerExtractResult = {
  url: string;
  fetched_at: string;
  page_signals?: {
    title?: string;
    meta_description?: string;
    h1?: string;
    h2_count?: number;
    word_count?: number;
  };
  citable_blocks: BrowserWorkerCitableBlock[];
  topic_candidates: string[];
  entity_candidates: string[];
  brand_queries: string[];
};

function getWorkerBaseUrl(): string {
  const raw = String(process.env.BROWSER_WORKER_URL || '').trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

export async function fetchBrowserWorkerCitableSignals(params: {
  url: string;
  brandName: string;
  maxQueries?: number;
  maxBlocks?: number;
}): Promise<BrowserWorkerExtractResult | null> {
  const baseUrl = getWorkerBaseUrl();
  if (!baseUrl) return null;

  const endpoint = `${baseUrl}/api/citable-extract`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  const fetchPromise = fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      url: params.url,
      brand_name: params.brandName,
      max_queries: params.maxQueries ?? 20,
      max_blocks: params.maxBlocks ?? 12,
    }),
  }).then(async (response) => {
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`browser_worker_http_${response.status}:${body.slice(0, 120)}`);
    }
    const parsed = (await response.json()) as BrowserWorkerExtractResult;
    if (!Array.isArray(parsed?.brand_queries) || !Array.isArray(parsed?.citable_blocks)) {
      throw new Error('browser_worker_invalid_payload');
    }
    return parsed;
  });

  try {
    return await fetchPromise;
  } catch (err: any) {
    console.warn('[BrowserWorker] Citable extraction failed (non-fatal):', err?.message || err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
