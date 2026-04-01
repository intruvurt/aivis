/**
 * CitationTrendSparkline
 *
 * Renders an SVG sparkline of mention-rate over time for a URL,
 * plus a small table of the last N data points.
 */
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { API_URL } from '../config';
import type { CitationMentionTrend } from '../../../shared/types';

interface Props {
  url: string;
}

export default function CitationTrendSparkline({ url }: Props) {
  const [trends, setTrends] = useState<CitationMentionTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/citations/trend?url=${encodeURIComponent(url)}&limit=30`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { trends: CitationMentionTrend[] };
      setTrends(data.trends || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load trend data');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="animate-pulse h-20 bg-white/5 rounded-xl" />;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (trends.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm text-slate-400">No mention trend data yet. Run a citation test to start tracking.</p>
      </div>
    );
  }

  // Build SVG sparkline
  const W = 320;
  const H = 60;
  const PAD = 4;
  const rates = trends.map((t) => t.mention_rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const range = max - min || 1;

  const xStep = (W - PAD * 2) / Math.max(rates.length - 1, 1);
  const points = rates.map((r, i) => {
    const x = PAD + i * xStep;
    const y = PAD + (1 - (r - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const latest = trends[trends.length - 1];
  const earliest = trends[0];
  const delta = latest.mention_rate - earliest.mention_rate;
  const deltaColour = delta >= 0 ? 'text-emerald-400' : 'text-red-400';
  const deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Mention Rate Trend</h3>
        <span className={`text-sm font-bold ${deltaColour}`}>{deltaLabel}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
        {/* gradient fill */}
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* fill area */}
        <polygon
          points={`${PAD},${H - PAD} ${points.join(' ')} ${PAD + (rates.length - 1) * xStep},${H - PAD}`}
          fill="url(#sparkGrad)"
        />
      </svg>

      {/* Mini stats row */}
      <div className="flex gap-4 text-xs text-slate-400">
        <span>Current: <strong className="text-white">{latest.mention_rate.toFixed(1)}%</strong></span>
        <span>Queries: <strong className="text-white">{latest.total_queries}</strong></span>
        <span>Mentioned: <strong className="text-white">{latest.mentioned_count}</strong></span>
        <span>Points: <strong className="text-white">{trends.length}</strong></span>
      </div>
    </div>
  );
}
