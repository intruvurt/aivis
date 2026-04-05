/**
 * DropAlertBanner
 *
 * Lists active (undismissed) citation drop alerts for a URL
 * and lets the user dismiss them one by one.
 */
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { API_URL } from '../config';
import type { CitationDropAlert } from '../../../shared/types';

interface Props {
  url?: string; // if omitted, shows all alerts for the user
}

export default function DropAlertBanner({ url }: Props) {
  const [alerts, setAlerts] = useState<CitationDropAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = url ? `?url=${encodeURIComponent(url)}` : '';
      const res = await apiFetch(`${API_URL}/api/citations/drop-alerts${query}`);
      if (!res.ok) return;
      const data = await res.json() as { alerts: CitationDropAlert[] };
      setAlerts((data.alerts || []).filter((a) => !a.dismissed));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (id: string) => {
    await apiFetch(`${API_URL}/api/citations/drop-alerts/${id}/dismiss`, {
      method: 'POST',
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3"
        >
          <span className="text-red-400 text-base mt-0.5 shrink-0">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">
              Citation mention rate dropped {alert.drop_magnitude.toFixed(0)} points
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {alert.url} - {alert.previous_mention_rate.toFixed(0)}% → {alert.current_mention_rate.toFixed(0)}%
            </p>
            {alert.created_at && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Detected {new Date(alert.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            className="shrink-0 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
