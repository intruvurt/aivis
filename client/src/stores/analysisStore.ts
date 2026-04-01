import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnalysisResponse } from '../../../shared/types';
import { buildTargetKey } from '../utils/targetKey';

interface HistoryEntry {
  url: string;
  result: AnalysisResponse;
  timestamp: number;
}

interface AnalysisState {
  // State
  url: string;
  loading: boolean;
  error: string | null;
  result: AnalysisResponse | null;
  /**
   * Local-only client history (persisted to localStorage).
   *
   * Use for: instant trend preview, re-run convenience, local exports, recent audit UX.
   * NOT canonical server truth — persistent/account-scoped history comes from
   * /api/audits and /api/analytics. When merging with server data, server snapshots
   * win on collision (dedupe by normalized target + timestamp).
   */
  history: HistoryEntry[];

  // Actions
  setUrl: (url: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setResult: (result: AnalysisResponse | null) => void;
  addToHistory: (url: string, result: AnalysisResponse) => void;
  /** Merge server-side audits into local history (server wins on collision). */
  mergeServerAudits: (audits: Array<{ url: string; visibility_score: number; summary?: string; recommendations?: unknown; created_at: string }>) => void;
  clearHistory: () => void;
  removeFromHistory: (timestamp: number) => void;
  reset: () => void;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeResult(result: unknown, fallbackUrl = ''): AnalysisResponse | null {
  if (!isObjectRecord(result)) return null;

  return {
    ...(result as AnalysisResponse),
    url: typeof result.url === 'string' && result.url.trim() ? result.url : fallbackUrl,
  } as AnalysisResponse;
}

function sanitizeHistoryEntry(entry: unknown): HistoryEntry | null {
  if (!isObjectRecord(entry)) return null;

  const url = typeof entry.url === 'string' ? entry.url.trim() : '';
  const timestamp = typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)
    ? entry.timestamp
    : Date.now();
  const result = sanitizeResult(entry.result, url);

  if (!url || !result) return null;

  return {
    url,
    result,
    timestamp,
  };
}

function sanitizeHistoryEntries(history: unknown): HistoryEntry[] {
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => sanitizeHistoryEntry(entry))
    .filter((entry): entry is HistoryEntry => Boolean(entry));
}

const initialState = {
  url: '',
  loading: false,
  error: null,
  result: null,
  history: [] as HistoryEntry[],
};

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      ...initialState,

      setUrl: (url) => set({ url }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      setResult: (result) => set({ result }),

      addToHistory: (url, result) =>
        set((state) => {
          const targetKey = buildTargetKey(url);
          const history = sanitizeHistoryEntries(state.history);
          return {
            history: [
              { url, result, timestamp: Date.now() },
              ...history
                .filter((entry) => buildTargetKey(entry.url) !== targetKey)
                .slice(0, 49),
            ],
          };
        }),

      removeFromHistory: (timestamp) =>
        set((state) => ({
          history: state.history.filter((h) => h.timestamp !== timestamp),
        })),

      mergeServerAudits: (audits) =>
        set((state) => {
          const localByKey = new Map<string, HistoryEntry>();
          for (const entry of sanitizeHistoryEntries(state.history)) {
            localByKey.set(buildTargetKey(entry.url), entry);
          }

          for (const audit of audits) {
            const key = buildTargetKey(audit.url);
            const ts = new Date(audit.created_at).getTime();
            const existing = localByKey.get(key);
            // Server wins if local entry is older or missing
            if (!existing || existing.timestamp < ts) {
              localByKey.set(key, {
                url: audit.url,
                timestamp: ts,
                result: {
                  visibility_score: audit.visibility_score,
                  url: audit.url,
                  summary: audit.summary ?? '',
                  recommendations: Array.isArray(audit.recommendations) ? audit.recommendations : [],
                } as AnalysisResponse,
              });
            }
          }

          const merged = Array.from(localByKey.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 50);

          return { history: merged };
        }),

      clearHistory: () => set({ history: [] }),

      reset: () => set(initialState),
    }),
    {
      name: 'aivis-analysis',
      merge: (persistedState, currentState) => {
        const persisted = isObjectRecord(persistedState) ? persistedState : {};
        const result = sanitizeResult(persisted.result, '');
        const history = sanitizeHistoryEntries(persisted.history);

        return {
          ...currentState,
          ...persisted,
          result,
          history,
        };
      },
      // Only persist history and the latest result – not transient UI state
      partialize: (state) => ({
        result: state.result,
        history: state.history,
      }),
    }
  )
);
