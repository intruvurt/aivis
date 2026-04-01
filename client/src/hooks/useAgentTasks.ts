// client/src/hooks/useAgentTasks.ts
// Fetches and manages agent task state for GuideBot tasks panel
import { useState, useCallback, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import apiFetch from '../utils/api';
import usePageVisible from './usePageVisible';

export interface AgentTask {
  id: string;
  task_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: Record<string, unknown> | null;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

const TASK_LABELS: Record<string, string> = {
  schedule_audits: 'Audit',
  run_citation_test: 'Citation Test',
  add_competitor: 'Competitor',
  scan_mentions: 'Mention Scan',
  schedule_rescan: 'Rescan',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Queued', color: 'text-amber-300' },
  running: { label: 'Running', color: 'text-cyan-300' },
  completed: { label: 'Done', color: 'text-emerald-300' },
  failed: { label: 'Failed', color: 'text-red-300' },
  cancelled: { label: 'Cancelled', color: 'text-white/40' },
};

export function taskLabel(type: string): string {
  return TASK_LABELS[type] || type;
}

export function statusMeta(status: string): { label: string; color: string } {
  return STATUS_META[status] || { label: status, color: 'text-white/50' };
}

export function useAgentTasks(enabled: boolean) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const pageVisible = usePageVisible();

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`${API_URL}/api/agent/tasks?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      /* network error — silent */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !pageVisible) return;
    fetchTasks();
    intervalRef.current = window.setInterval(fetchTasks, 15_000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [enabled, fetchTasks, pageVisible]);

  const cancelTask = useCallback(
    async (taskId: string) => {
      try {
        const res = await apiFetch(
          `${API_URL}/api/agent/tasks/${encodeURIComponent(taskId)}`,
          { method: 'DELETE' },
        );
        if (res.ok) {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' as const } : t)),
          );
        }
      } catch {
        /* silent */
      }
    },
    [],
  );

  return { tasks, isLoading, fetchTasks, cancelTask };
}
