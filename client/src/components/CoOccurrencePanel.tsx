/**
 * CoOccurrencePanel
 *
 * Shows unlinked brand web mentions found via DDG web search co-occurrence scan.
 * Lets the user trigger a fresh scan and review existing findings.
 */
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { API_URL } from '../config';
import type { CitationCoOccurrence } from '../../../shared/types';

interface Props {
  url: string;
  brandName?: string; // if provided, enables the scan button
}

export default function CoOccurrencePanel({ url, brandName }: Props) {
  const [occurrences, setOccurrences] = useState<CitationCoOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API_URL}/api/citations/co-occurrences?url=${encodeURIComponent(url)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { occurrences: CitationCoOccurrence[] };
      setOccurrences(data.occurrences || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load co-occurrences');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  const runScan = async () => {
    if (!brandName || scanning) return;
    setScanning(true);
    setScanMessage(null);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/citations/co-occurrences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, brand_name: brandName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, string>;
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { found: CitationCoOccurrence[]; count: number };
      setScanMessage(`Found ${data.count} new co-occurrence${data.count !== 1 ? 's' : ''}`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Unlinked Co-occurrences</h3>
        {brandName && (
          <button
            onClick={runScan}
            disabled={scanning}
            className="rounded-lg px-3 py-1 text-xs font-medium bg-violet-600/80 hover:bg-violet-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? 'Scanning…' : 'Scan now'}
          </button>
        )}
      </div>

      {scanMessage && (
        <p className="text-xs text-emerald-400">{scanMessage}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {loading ? (
        <div className="animate-pulse h-20 bg-white/5 rounded-lg" />
      ) : occurrences.length === 0 ? (
        <p className="text-sm text-slate-400">
          No co-occurrence data yet.{' '}
          {brandName
            ? 'Click "Scan now" to search the web for unlinked brand mentions.'
            : 'Provide a brand name to enable web scanning.'}
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {occurrences.map((occ) => (
            <div
              key={occ.id}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-1"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    occ.has_link
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}
                >
                  {occ.has_link ? 'Linked' : 'Unlinked'}
                </span>
                <a
                  href={occ.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline truncate flex-1"
                >
                  {occ.source_title || occ.source_url}
                </a>
              </div>
              {occ.mention_context && (
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {occ.mention_context}
                </p>
              )}
              <p className="text-[10px] text-slate-500">{occ.source_url}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Unlinked mentions are pages where your brand is discussed but not linked.
        These are candidate link-building targets.
      </p>
    </div>
  );
}
