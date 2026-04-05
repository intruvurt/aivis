/**
 * CompetitorShareTable
 *
 * Shows how often competitors are mentioned alongside the target URL
 * in AI responses - the "citation share" view.
 */
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { API_URL } from '../config';
import type { CitationCompetitorShareEntry } from '../../../shared/types';

interface Props {
  url: string;
}

export default function CompetitorShareTable({ url }: Props) {
  const [share, setShare] = useState<CitationCompetitorShareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API_URL}/api/citations/competitor-share?url=${encodeURIComponent(url)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { share: CitationCompetitorShareEntry[] };
      setShare(data.share || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load competitor share');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="animate-pulse h-32 bg-white/5 rounded-xl" />;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (share.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm text-slate-400">No competitor citation data yet. Run a citation test to build the share table.</p>
      </div>
    );
  }

  const maxCount = Math.max(...share.map((e) => e.mention_count), 1);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Competitor Citation Share</h3>
        <span className="text-xs text-slate-500">{share[0]?.total_queries} queries analysed</span>
      </div>

      <div className="space-y-2">
        {share.slice(0, 12).map((entry) => (
          <div key={entry.competitor_name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate max-w-[180px]">{entry.competitor_name}</span>
              <span className="text-slate-400 tabular-nums">{entry.share_pct}% ({entry.mention_count})</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500/70 transition-all duration-500"
                style={{ width: `${(entry.mention_count / maxCount) * 100}%` }}
              />
            </div>
            {entry.platforms_present.length > 0 && (
              <div className="flex gap-1">
                {entry.platforms_present.map((p) => (
                  <span key={p} className="rounded px-1 py-0.5 text-[10px] bg-white/5 text-slate-400">{p}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
