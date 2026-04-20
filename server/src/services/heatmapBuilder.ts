/**
 * heatmapBuilder.ts
 *
 * Builds a HeatmapSurface from citation_results + citation_tests.
 *
 * This is the ONLY valid data path for the citation heatmap.
 * No heuristics. No scores. No client-side aggregation.
 *
 * Data sources:
 *   citation_tests   → { id, user_id, url, status, created_at }
 *   citation_results → { citation_test_id, query, platform, mentioned,
 *                        mention_quality_score, excerpt, created_at,
 *                        is_false_positive }
 *
 * Output: HeatmapSurface with rows grouped by query × engine,
 *         delta tracking vs previous test, and gap actions for dark cells.
 */

import { getPool } from './postgresql.js';
import type {
  CitationEngine,
  HeatmapCell,
  HeatmapRow,
  HeatmapSurface,
  HeatmapDelta,
  HeatmapGapAction,
  CITATION_ENGINES as _EnginesTuple,
} from '../../../shared/types.js';

const ENGINES: CitationEngine[] = ['chatgpt', 'perplexity', 'claude', 'google_ai'];

// ─── DB row shape ─────────────────────────────────────────────────────────────

interface RawCitationRow {
  query: string;
  platform: string;
  mentioned: boolean;
  mention_quality_score: number | null;
  excerpt: string | null;
  created_at: string;
  test_id: string;
}

// ─── Per-engine aggregation ───────────────────────────────────────────────────

interface EngineAgg {
  mentioned: boolean;
  count: number;
  confidence: number;
  lastSeenAt: string;
  excerpt: string | null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build and return the full HeatmapSurface for a user + URL.
 * Reads the last two completed citation tests to enable delta tracking.
 */
export async function buildHeatmapSurface(
  userId: string,
  url: string,
): Promise<HeatmapSurface> {
  const pool = getPool();

  // 1. Fetch the last two completed tests for this user+url
  const { rows: tests } = await pool.query<{ id: string; created_at: string }>(
    `SELECT id, created_at
     FROM citation_tests
     WHERE user_id = $1
       AND url    = $2
       AND status = 'completed'
     ORDER BY created_at DESC
     LIMIT 2`,
    [userId, url],
  );

  if (tests.length === 0) {
    return emptyHeatmap(url);
  }

  const currentTestId = tests[0].id;
  const previousTestId = tests.length > 1 ? tests[1].id : null;

  // 2. Pull citation_results for the current (plus optionally previous) test
  const testIds = previousTestId ? [currentTestId, previousTestId] : [currentTestId];

  const { rows: rawRows } = await pool.query<RawCitationRow>(
    `SELECT
       cr.query,
       cr.platform,
       cr.mentioned,
       cr.mention_quality_score,
       cr.excerpt,
       cr.created_at,
       cr.citation_test_id AS test_id
     FROM citation_results cr
     WHERE cr.citation_test_id = ANY($1::uuid[])
       AND (cr.is_false_positive IS NULL OR cr.is_false_positive = FALSE)
     ORDER BY cr.query, cr.platform, cr.created_at DESC`,
    [testIds],
  );

  // 3. Partition by test
  const currentRows = rawRows.filter((r) => r.test_id === currentTestId);
  const previousRows = previousTestId
    ? rawRows.filter((r) => r.test_id === previousTestId)
    : [];

  // 4. Aggregate current test into query × engine map
  const currentMap = buildQueryEngineMap(currentRows);
  const previousMap = previousTestId ? buildQueryEngineMap(previousRows) : null;

  // 5. Collect unique queries (sorted for stable display order)
  const allQueries = Array.from(currentMap.keys()).sort();

  // 6. Build surface rows
  const rows: HeatmapRow[] = allQueries.map((query) => {
    const engineMap = currentMap.get(query)!;

    const cells: HeatmapCell[] = ENGINES.map((engine) => {
      const agg = engineMap.get(engine) ?? null;
      return {
        engine,
        cited: agg?.mentioned ?? false,
        citationCount: agg?.count ?? 0,
        confidence: agg?.confidence ?? 0,
        lastSeenAt: agg?.lastSeenAt ?? null,
        excerpt: agg?.excerpt ?? null,
      };
    });

    const totalCitations = cells.reduce((sum, c) => sum + c.citationCount, 0);
    const citedEngines = cells.filter((c) => c.cited).length;
    const visibilityProbability = citedEngines / ENGINES.length;

    const gapAction =
      visibilityProbability < 1 ? buildGapAction(query, cells) : null;

    return { query, cells, totalCitations, visibilityProbability, gapAction };
  });

  // 7. Delta tracking: compare current vs previous test
  const deltas: HeatmapDelta[] = [];
  if (previousMap) {
    for (const query of allQueries) {
      for (const engine of ENGINES) {
        const cur = currentMap.get(query)?.get(engine)?.mentioned ?? false;
        const prev = previousMap.get(query)?.get(engine)?.mentioned ?? false;
        if (cur && !prev) deltas.push({ query, engine, change: 'gained' });
        if (!cur && prev) deltas.push({ query, engine, change: 'lost' });
      }
    }
  }

  const totalCited = rows.filter((r) => r.totalCitations > 0).length;

  return {
    entity: url,
    url,
    rows,
    generatedAt: new Date().toISOString(),
    deltas,
    totalCited,
    totalQueries: rows.length,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyHeatmap(url: string): HeatmapSurface {
  return {
    entity: url,
    url,
    rows: [],
    generatedAt: new Date().toISOString(),
    deltas: [],
    totalCited: 0,
    totalQueries: 0,
  };
}

/**
 * Group raw citation rows into a nested Map<query, Map<engine, EngineAgg>>.
 * mention_quality_score is on a 0–10 scale; we convert to 0–100 for confidence.
 */
function buildQueryEngineMap(
  rows: RawCitationRow[],
): Map<string, Map<CitationEngine, EngineAgg>> {
  const map = new Map<string, Map<CitationEngine, EngineAgg>>();

  for (const row of rows) {
    const engine = row.platform as CitationEngine;
    if (!ENGINES.includes(engine)) continue;

    if (!map.has(row.query)) {
      map.set(row.query, new Map());
    }
    const engineMap = map.get(row.query)!;

    if (!engineMap.has(engine)) {
      engineMap.set(engine, {
        mentioned: false,
        count: 0,
        confidence: 0,
        lastSeenAt: row.created_at,
        excerpt: null,
      });
    }

    const agg = engineMap.get(engine)!;

    if (row.mentioned) {
      agg.mentioned = true;
      agg.count += 1;

      // Running average of confidence from mention_quality_score (0–10 → 0–100)
      const qs = typeof row.mention_quality_score === 'number' ? row.mention_quality_score : 5;
      const qualityPct = Math.min(100, Math.max(0, qs * 10));
      agg.confidence = Math.round(
        (agg.confidence * (agg.count - 1) + qualityPct) / agg.count,
      );

      if (!agg.excerpt && row.excerpt) {
        agg.excerpt = row.excerpt;
      }
      if (row.created_at > agg.lastSeenAt) {
        agg.lastSeenAt = row.created_at;
      }
    }
  }

  return map;
}

/**
 * Produce a structured gap action for any row that isn't fully cited.
 * This is the corrective action graph — the heatmap's output invariant.
 */
function buildGapAction(query: string, cells: HeatmapCell[]): HeatmapGapAction {
  const cited = cells.filter((c) => c.cited);
  const missing = cells.filter((c) => !c.cited);
  const issue = cited.length === 0 ? 'no_citation' : 'weak_citation';

  const citedNames = cited.map((c) => engineLabel(c.engine)).join(', ');
  const missingNames = missing.map((c) => engineLabel(c.engine)).join(', ');

  const cause =
    cited.length === 0
      ? `No AI system cites this entity for "${query}". Likely causes: missing topical authority, no content cluster targeting this query class, or AI-extractability failures.`
      : `Partial presence: cited on ${citedNames} but absent on ${missingNames}. Likely cause: platform-specific content structure gaps or authority asymmetry.`;

  const fix =
    cited.length === 0
      ? `Build an authoritative content cluster targeting "${query}". Include: FAQ schema (FAQPage), DefinedTermSet markup, named entity disambiguation. Ensure content is AI-extractable (no JS gates, text in DOM).`
      : `Review content accessibility for ${missingNames}. Check: JSON-LD presence, llms.txt directives, structured factual claims, and that the page renders without JavaScript execution.`;

  const expectedImpact =
    cited.length === 0
      ? `Citation presence on all ${ENGINES.length} AI systems (currently 0/${ENGINES.length}).`
      : `Raises visibility probability from ${Math.round((cited.length / ENGINES.length) * 100)}% to 100% by gaining ${missingNames}.`;

  return { query, issue, cause, fix, expectedImpact };
}

function engineLabel(engine: CitationEngine): string {
  const labels: Record<CitationEngine, string> = {
    chatgpt: 'ChatGPT',
    perplexity: 'Perplexity',
    claude: 'Claude',
    google_ai: 'Google AI',
  };
  return labels[engine];
}
