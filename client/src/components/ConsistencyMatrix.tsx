/**
 * ConsistencyMatrix
 *
 * Cross-platform × cross-query grid. Shows whether each query
 * was mentioned on each AI platform, forming a legibility matrix.
 */
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { API_URL } from '../config';
import type { ConsistencyMatrixCell } from '../../../shared/types';

interface Props {
  url: string;
}

interface MatrixData {
  queries: string[];
  platforms: string[];
  cells: Record<string, Record<string, ConsistencyMatrixCell>>;
}

function buildMatrix(raw: ConsistencyMatrixCell[]): MatrixData {
  // Unique queries (truncated for display) and platforms
  const querySet = new Set<string>();
  const platformSet = new Set<string>();
  for (const c of raw) {
    querySet.add(c.query);
    platformSet.add(c.platform);
  }
  const queries = Array.from(querySet).slice(0, 20);
  const platforms = Array.from(platformSet);

  const cells: Record<string, Record<string, ConsistencyMatrixCell>> = {};
  for (const c of raw) {
    if (!cells[c.query]) cells[c.query] = {};
    cells[c.query][c.platform] = c;
  }

  return { queries, platforms, cells };
}

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  claude: 'Claude',
  google_ai: 'Gemini',
};

export default function ConsistencyMatrix({ url }: Props) {
  const [raw, setRaw] = useState<ConsistencyMatrixCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API_URL}/api/citations/consistency-matrix?url=${encodeURIComponent(url)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { matrix: ConsistencyMatrixCell[] };
      setRaw(data.matrix || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load consistency matrix');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="animate-pulse h-40 bg-white/5 rounded-xl" />;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (raw.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm text-slate-400">No consistency data yet. Run a citation test across multiple platforms to populate this matrix.</p>
      </div>
    );
  }

  const { queries, platforms, cells } = buildMatrix(raw);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">Cross-Platform Consistency</h3>

      <div className="overflow-x-auto">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-medium pb-2 pr-3 min-w-[160px]">Query</th>
              {platforms.map((p) => (
                <th key={p} className="text-center text-slate-400 pb-2 px-2 font-medium whitespace-nowrap">
                  {PLATFORM_LABELS[p] || p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queries.map((q) => (
              <tr key={q} className="border-t border-white/5">
                <td className="py-1.5 pr-3 text-slate-300 max-w-[160px] truncate" title={q}>
                  {q.length > 48 ? `${q.slice(0, 48)}…` : q}
                </td>
                {platforms.map((p) => {
                  const cell = cells[q]?.[p];
                  if (!cell) {
                    return (
                      <td key={p} className="text-center py-1.5 px-2 text-slate-600">–</td>
                    );
                  }
                  return (
                    <td key={p} className="text-center py-1.5 px-2">
                      {cell.mentioned ? (
                        <span title={cell.excerpt} className="inline-block text-emerald-400 font-bold">✓</span>
                      ) : (
                        <span className="inline-block text-red-500/60">✕</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500">Showing {queries.length} queries across {platforms.length} platforms. Hover ✓ cells to see the exact excerpt.</p>
    </div>
  );
}
