e // server/src/services/googleKnowledgeGraph.ts
// Google Knowledge Graph Search API integration for entity disambiguation.

export interface KGEntity {
  kg_id: string;            // e.g. "kg:/m/0dl567"
  name: string;
  types: string[];          // schema.org types
  description: string;      // short description
  detailed_description: string; // article body excerpt
  url?: string;             // official website
  image_url?: string;
  result_score: number;     // Google relevance score
}

export interface KGLookupResult {
  entities: KGEntity[];
  query: string;
  raw_count: number;
}

const KG_ENDPOINT = 'https://kgsearch.googleapis.com/v1/entities:search';
const KG_TIMEOUT_MS = 6000;

function getKGApiKey(): string | null {
  return process.env.GOOGLE_KG_KEY || process.env.GOOGLE_KG_API_KEY || null;
}

/**
 * Search Google Knowledge Graph for entities matching the query.
 * Returns empty result if no API key is configured.
 */
export async function searchKnowledgeGraph(
  query: string,
  options?: { limit?: number; types?: string[]; languages?: string[] },
): Promise<KGLookupResult> {
  const apiKey = getKGApiKey();
  if (!apiKey || !query.trim()) {
    return { entities: [], query, raw_count: 0 };
  }

  const params = new URLSearchParams({
    query: query.trim(),
    key: apiKey,
    limit: String(options?.limit ?? 5),
    indent: 'false',
  });
  if (options?.languages?.length) {
    params.set('languages', options.languages.join(','));
  }
  if (options?.types?.length) {
    params.set('types', options.types.join(','));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KG_TIMEOUT_MS);

  try {
    const response = await fetch(`${KG_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[GoogleKG] API returned ${response.status}: ${response.statusText}`);
      return { entities: [], query, raw_count: 0 };
    }

    const data = await response.json() as any;
    const elements: any[] = data?.itemListElement ?? [];

    const entities: KGEntity[] = elements
      .filter((el: any) => el?.result?.['@id'])
      .map((el: any) => {
        const r = el.result;
        return {
          kg_id: String(r['@id'] || ''),
          name: String(r.name || ''),
          types: Array.isArray(r['@type']) ? r['@type'].map(String) : [],
          description: String(r.description || ''),
          detailed_description: String(r.detailedDescription?.articleBody || ''),
          url: r.url || r.detailedDescription?.url || undefined,
          image_url: r.image?.contentUrl || undefined,
          result_score: Number(el.resultScore || 0),
        };
      });

    return { entities, query, raw_count: elements.length };
  } catch (err: unknown) {
    if ((err as any)?.name === 'AbortError') {
      console.warn('[GoogleKG] Request timed out');
    } else {
      console.warn('[GoogleKG] Lookup failed:', (err as Error).message);
    }
    return { entities: [], query, raw_count: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve the best-matching KG entity for a brand name + domain combo.
 * Prefers entities whose official URL matches the given domain.
 */
export async function resolveEntityFromKG(
  brandName: string,
  canonicalDomain?: string,
): Promise<KGEntity | null> {
  const result = await searchKnowledgeGraph(brandName, { limit: 5 });
  if (result.entities.length === 0) return null;

  // If we have a canonical domain, try to match by URL
  if (canonicalDomain) {
    const domainLower = canonicalDomain.toLowerCase().replace(/^www\./, '');
    const domainMatch = result.entities.find((e) => {
      if (!e.url) return false;
      try {
        const entityHost = new URL(e.url).hostname.toLowerCase().replace(/^www\./, '');
        return entityHost === domainLower || entityHost.endsWith(`.${domainLower}`);
      } catch {
        return false;
      }
    });
    if (domainMatch) return domainMatch;
  }

  // Fall back to highest-scoring entity
  return result.entities[0];
}

/**
 * Check if two brand names resolve to distinct KG entities.
 * Returns true if they have different KG IDs (confirmed different entities).
 * Returns null if KG can't resolve either entity.
 */
export async function areDistinctEntities(
  brandA: string,
  domainA: string | undefined,
  brandB: string,
  domainB: string | undefined,
): Promise<boolean | null> {
  const [entityA, entityB] = await Promise.all([
    resolveEntityFromKG(brandA, domainA),
    resolveEntityFromKG(brandB, domainB),
  ]);

  if (!entityA || !entityB) return null; // Can't determine
  return entityA.kg_id !== entityB.kg_id;
}

/**
 * Find colliding entities: distinct KG entities that share or contain the brand name.
 */
export async function findKGCollisions(
  brandName: string,
  canonicalDomain: string,
): Promise<KGEntity[]> {
  const result = await searchKnowledgeGraph(brandName, { limit: 8 });
  if (result.entities.length <= 1) return [];

  const domainLower = canonicalDomain.toLowerCase().replace(/^www\./, '');
  return result.entities.filter((e) => {
    if (!e.url) return true; // No URL = can't confirm it's ours, could be a collision
    try {
      const entityHost = new URL(e.url).hostname.toLowerCase().replace(/^www\./, '');
      return entityHost !== domainLower && !entityHost.endsWith(`.${domainLower}`);
    } catch {
      return true;
    }
  });
}
