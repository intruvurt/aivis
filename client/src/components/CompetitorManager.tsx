import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Users,
  Loader2,
  ExternalLink,
  Search,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { API_URL } from '../config';
import { appInputSurfaceClass, appSelectSurfaceClass } from "../lib/formStyles";
import apiFetch from '../utils/api';
import { toSafeHref } from '../utils/safeHref';

interface Competitor {
  id: string;
  competitor_url: string;
  nickname: string;
  latest_score?: number;
  monitoring_enabled: boolean;
  monitor_frequency: string;
  next_monitor_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CompetitorManagerProps {
  token?: string;
  onCompetitorsChange?: () => void;
  onScanComplete?: (url: string) => void;
}

interface CompetitorSuggestion {
  nickname: string;
  url: string;
}

interface SuggestionNiche {
  key: string;
  label: string;
  count: number;
}

function toFriendlyCompetitorError(message: string): string {
  const msg = (message || '').toLowerCase();
  if (
    msg.includes('ai provider') ||
    msg.includes('openrouter') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('rate limit') ||
    msg.includes('backoff')
  ) {
    return 'Competitor audit is temporarily degraded due to AI provider latency. Please retry in a few seconds.';
  }
  return message;
}

export default function CompetitorManager({ token, onCompetitorsChange, onScanComplete }: CompetitorManagerProps) {
  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [niches, setNiches] = useState<SuggestionNiche[]>([]);
  const [selectedNiche, setSelectedNiche] = useState("");
  // Tracks which competitor rows are actively being scanned
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set());
  const [bulkScanState, setBulkScanState] = useState<{ active: boolean; total: number; completed: number }>({
    active: false,
    total: 0,
    completed: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "score-desc" | "score-asc">("recent");
  const [lastScanSummary, setLastScanSummary] = useState<{ url: string; score?: number } | null>(null);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchCompetitors();
    }
  }, [token]);

  useEffect(() => {
    if (!token || !addingNew) return;
    void fetchSuggestions(selectedNiche);
  }, [token, addingNew, selectedNiche]);

  async function fetchCompetitors() {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch(`${API_URL}/api/competitors`, {
        headers: {},
      });
      if (response.status === 401) return;

      if (!response.ok) {
        throw new Error("Failed to fetch competitors");
      }

      const data = await response.json();
      setCompetitors(data.competitors || []);
    } catch (err: any) {
      console.error("Fetch competitors error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuggestions(niche?: string) {
    if (!token) return;

    try {
      setSuggestionsLoading(true);
      setSuggestionsError(null);

      const query = niche ? `?niche=${encodeURIComponent(niche)}` : '';
      const response = await apiFetch(`${API_URL}/api/competitors/suggestions${query}`, {
        headers: {},
      });

      if (!response.ok) {
        throw new Error('Failed to fetch competitor suggestions');
      }

      const data = await response.json();
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      setNiches(Array.isArray(data?.niches) ? data.niches : []);
    } catch (err: any) {
      console.error('Fetch suggestions error:', err);
      setSuggestionsError(err?.message || 'Failed to fetch suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function createCompetitor(url: string, nickname: string) {
    if (!token) return;

    try {
      setSubmitting(true);
      setError(null);

      const response = await apiFetch(`${API_URL}/api/competitors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          nickname: nickname.trim(),
        }),
      });
      if (response.status === 401) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add competitor");
      }

        return true;
      } catch (err: any) {
        console.error("Add competitor error:", err);
        setError(err.message);
        return false;
      } finally {
        setSubmitting(false);
      }
    }

    async function addCompetitor() {
      if (!newUrl.trim() || !newNickname.trim() || !token) return;

      const added = await createCompetitor(newUrl, newNickname);
      if (added) {
      setNewUrl("");
      setNewNickname("");
      setAddingNew(false);
      await fetchCompetitors();
      onCompetitorsChange?.();
    }
  }

    async function addSuggestedCompetitor(suggestion: CompetitorSuggestion) {
      const added = await createCompetitor(suggestion.url, suggestion.nickname);
      if (added) {
        await fetchCompetitors();
        onCompetitorsChange?.();
      }
    }

  async function removeCompetitor(id: string) {
    if (!token || !confirm("Remove this competitor?")) return;

    try {
      const response = await apiFetch(`${API_URL}/api/competitors/${id}`, {
        method: "DELETE",
        headers: {},
      });
      if (response.status === 401) return;

      if (!response.ok) {
        throw new Error("Failed to remove competitor");
      }

      await fetchCompetitors();
      onCompetitorsChange?.();
    } catch (err: any) {
      console.error("Remove competitor error:", err);
      setError(err.message);
    }
  }

  async function setMonitoringEnabled(id: string, enabled: boolean, freq: string) {
    try {
      const response = await apiFetch(`${API_URL}/api/competitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitoring_enabled: enabled, monitor_frequency: freq }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any)?.error || 'Failed to update monitoring');
      }
      await fetchCompetitors();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function scanCompetitor(id: string, url: string, options?: { skipListRefresh?: boolean; silentSuccess?: boolean }) {
    if (!token || scanningIds.has(id)) return;

    setScanningIds((prev) => new Set(prev).add(id));
    setError(null);

    try {
      // Use apiFetch so token refresh and consistent error handling apply.
      // POST /api/analyze runs the full audit and auto-updates competitor_tracking
      // via an UPDATE query in the analyze handler.
      const response = await apiFetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `Audit failed (${response.status})`);
      }

      const payload = await response.json().catch(() => ({}));
      const resolvedUrl = String(payload?.url || url || '').trim();
      const resolvedScore = typeof payload?.visibility_score === 'number'
        ? payload.visibility_score
        : undefined;

      if (resolvedUrl && !options?.silentSuccess) {
        setLastScanSummary({ url: resolvedUrl, score: resolvedScore });
      }

      if (resolvedUrl) {
        onScanComplete?.(resolvedUrl);
      }

      if (!options?.skipListRefresh) {
        await fetchCompetitors();
        onCompetitorsChange?.();
      }
    } catch (err: any) {
      console.error("Audit competitor error:", err);
      setError(toFriendlyCompetitorError(err?.message || 'Audit failed. Please try again.'));
    } finally {
      setScanningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function scanAllCompetitors() {
    if (!token || scanningIds.size > 0 || bulkScanState.active || competitors.length === 0) return;

    setBulkScanState({ active: true, total: competitors.length, completed: 0 });
    setError(null);

    setLastScanSummary(null);
    setBulkSummary(null);

    try {
      for (let i = 0; i < competitors.length; i++) {
        const competitor = competitors[i];
        await scanCompetitor(competitor.id, competitor.competitor_url, {
          skipListRefresh: true,
          silentSuccess: true,
        });
        setBulkScanState((prev) => ({
          ...prev,
          completed: Math.min(prev.total, i + 1),
        }));
      }

      await fetchCompetitors();
      onCompetitorsChange?.();
      setBulkSummary(`Refresh complete. ${competitors.length} competitor audits updated.`);
    } finally {
      setBulkScanState({ active: false, total: 0, completed: 0 });
    }
  }

  const visibleCompetitors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = competitors.filter((competitor) => {
      if (!term) return true;
      return (
        competitor.nickname.toLowerCase().includes(term) ||
        competitor.competitor_url.toLowerCase().includes(term)
      );
    });

    return filtered.sort((a, b) => {
      if (sortMode === "score-desc") return (b.latest_score ?? -1) - (a.latest_score ?? -1);
      if (sortMode === "score-asc") return (a.latest_score ?? 999) - (b.latest_score ?? 999);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [competitors, searchTerm, sortMode]);

  const averageScore = useMemo(() => {
    const scored = competitors.filter((comp) => typeof comp.latest_score === "number");
    if (!scored.length) return null;
    return Math.round(scored.reduce((acc, comp) => acc + (comp.latest_score || 0), 0) / scored.length);
  }, [competitors]);

  function scoreColor(score: number): string {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-sky-400";
    if (score >= 40) return "text-amber-400";
    return "text-red-400";
  }

  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  function isStale(dateStr: string): boolean {
    return Date.now() - new Date(dateStr).getTime() > 7 * 24 * 60 * 60 * 1000;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white/12" />
        <p className="mt-4 text-sm text-white/55">Loading competitors...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-white/22/20 to-white/14/20">
            <Users className="w-5 h-5 text-white/80" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Competitor Tracking</h3>
            <p className="text-xs text-white/55">
              {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
        </div>

        <button
          onClick={() => setAddingNew(!addingNew)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-white/28 to-white/14 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Competitor
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-white/10 bg-charcoal p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-white/80 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white/80 mb-1">Error</p>
              <p className="text-xs text-white/55">{error}</p>
            </div>
          </div>
        </div>
      )}

      {lastScanSummary && (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-100">Competitor audit complete</p>
                <p className="truncate text-xs text-emerald-100/80">
                  {lastScanSummary.url}
                  {typeof lastScanSummary.score === 'number' ? ` • Score ${lastScanSummary.score}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`/?url=${encodeURIComponent(lastScanSummary.url)}`)}
                className="rounded-lg bg-charcoal px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-charcoal-light"
              >
                Open Result
              </button>
              <button
                type="button"
                onClick={() => setLastScanSummary(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-emerald-100/80 transition-colors hover:bg-emerald-500/15"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkSummary && (
        <div className="rounded-xl border border-white/10 bg-charcoal p-3">
          <p className="text-xs text-white/75">{bulkSummary}</p>
        </div>
      )}

      {/* Add Form */}
      {addingNew && (
        <div className="rounded-xl border border-white/10 bg-charcoal-deep p-5">
          <h4 className="text-sm font-semibold text-white mb-4">Add New Competitor</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/55 mb-1.5">Competitor URL</label>
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newUrl.trim() && !submitting && handleAdd()}
                enterKeyHint="done"
                placeholder="https://competitor.com"
                disabled={submitting}
                className={`w-full px-3 py-2 rounded-lg text-sm ${appInputSurfaceClass}`}
              />
            </div>
            <div>
              <label className="block text-xs text-white/55 mb-1.5">Nickname</label>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newUrl.trim() && !submitting && handleAdd()}
                enterKeyHint="done"
                placeholder="Main Competitor"
                disabled={submitting}
                className={`w-full px-3 py-2 rounded-lg text-sm ${appInputSurfaceClass}`}
              />
            </div>

            <div className="rounded-lg border border-white/10 bg-charcoal p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-white/80">Need ideas? Pick a niche</p>
                <select
                  value={selectedNiche}
                  onChange={(e) => setSelectedNiche(e.target.value)}
                  disabled={suggestionsLoading || submitting}
                  className={`px-2 py-1 rounded-md text-xs ${appSelectSurfaceClass}`}
                >
                  <option value="">Popular options</option>
                  {niches.map((niche) => (
                    <option key={niche.key} value={niche.key}>
                      {niche.label}
                    </option>
                  ))}
                </select>
              </div>

              {suggestionsLoading ? (
                <p className="text-xs text-white/55">Loading suggestions...</p>
              ) : suggestionsError ? (
                <p className="text-xs text-white/70">{suggestionsError}</p>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-white/55">No suggestions available for this niche yet.</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-auto pr-1">
                  {suggestions.map((suggestion) => (
                    <div
                      key={`${suggestion.nickname}-${suggestion.url}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-charcoal-light px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{suggestion.nickname}</p>
                        <p className="text-[11px] text-white/60 truncate">{suggestion.url}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setNewUrl(suggestion.url);
                            setNewNickname(suggestion.nickname);
                          }}
                          className="px-2 py-1 rounded-md text-[11px] bg-charcoal hover:bg-charcoal text-white/80"
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          onClick={() => addSuggestedCompetitor(suggestion)}
                          disabled={submitting}
                          className="px-2 py-1 rounded-md text-[11px] bg-gradient-to-r from-white/28 to-white/14 text-white disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={addCompetitor}
                disabled={submitting || !newUrl.trim() || !newNickname.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-charcoal rounded-lg text-white text-sm font-medium hover:bg-charcoal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setAddingNew(false);
                  setNewUrl("");
                  setNewNickname("");
                  setSelectedNiche("");
                }}
                disabled={submitting}
                className="px-4 py-2 bg-charcoal-light rounded-lg text-white text-sm font-medium hover:bg-charcoal disabled:opacity-40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Tracked</p>
          <p className="text-xl font-bold text-white mt-1">{competitors.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Avg Score</p>
          <p className={`text-xl font-bold mt-1 ${averageScore !== null ? scoreColor(averageScore) : "text-white/40"}`}>
            {averageScore !== null ? averageScore : "N/A"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 col-span-2">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/55" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search competitors"
                className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm ${appInputSurfaceClass}`}
              />
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as "recent" | "score-desc" | "score-asc")}
              className={`px-3 py-2 rounded-lg text-sm ${appSelectSurfaceClass}`}
            >
              <option value="recent">Sort: Recently Updated</option>
              <option value="score-desc">Sort: Score High → Low</option>
              <option value="score-asc">Sort: Score Low → High</option>
            </select>
            <button
              onClick={scanAllCompetitors}
              disabled={competitors.length === 0 || scanningIds.size > 0 || bulkScanState.active}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-white/28 to-white/14 text-sm text-white disabled:opacity-40"
              type="button"
            >
              {bulkScanState.active
                ? `Refreshing ${bulkScanState.completed}/${bulkScanState.total}…`
                : `Refresh All Scores (${competitors.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Competitors List */}
      {competitors.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-charcoal-deep p-8 text-center">
          <Users className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-sm text-white/55">No competitors tracked yet.</p>
          <p className="text-xs text-white/60 mt-1">Add your first competitor to start comparing!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleCompetitors.map((competitor) => (
            <div
              key={competitor.id}
              className="rounded-xl border border-white/10 bg-charcoal-deep p-4 hover:border-white/10 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-white">{competitor.nickname}</h4>
                    {competitor.latest_score !== undefined && (
                      <span className={`text-lg font-bold ${scoreColor(competitor.latest_score)}`}>
                        {competitor.latest_score}
                      </span>
                    )}
                    {isStale(competitor.updated_at) && (
                      <span className="text-[10px] text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded" title="Score may be outdated">
                        Stale
                      </span>
                    )}
                  </div>
                  <a
                    href={toSafeHref(competitor.competitor_url) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white/85 transition-colors"
                  >
                    {competitor.competitor_url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="text-[10px] text-white/40 mt-1">
                    Audited {relativeTime(competitor.updated_at)} • Added {new Date(competitor.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => scanCompetitor(competitor.id, competitor.competitor_url)}
                    disabled={scanningIds.has(competitor.id) || bulkScanState.active}
                    className="p-2 rounded-lg bg-charcoal-light hover:bg-charcoal text-white/55 hover:text-white/85 transition-all group disabled:opacity-50 disabled:cursor-not-allowed order-2"
                    title={
                      bulkScanState.active
                        ? "Bulk refresh in progress"
                        : scanningIds.has(competitor.id)
                          ? "Scanning…"
                          : "Audit competitor"
                    }
                  >
                    {scanningIds.has(competitor.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white/85" />
                    ) : (
                      <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                    )}
                  </button>
                  <button
                    onClick={() => removeCompetitor(competitor.id)}
                    className="p-2 rounded-lg bg-charcoal-light hover:bg-charcoal text-white/55 hover:text-white/80 transition-all order-3"
                    title="Remove competitor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {/* Auto-monitor toggle */}
                  <div className="flex items-center gap-1 order-1">
                    {competitor.monitoring_enabled && (
                      <select
                        value={competitor.monitor_frequency || 'daily'}
                        onChange={(e) => {
                          e.stopPropagation();
                          void setMonitoringEnabled(competitor.id, true, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] px-1.5 py-1 rounded-md border border-white/10 bg-charcoal-deep text-white/70 focus:outline-none"
                        title="Auto-monitor frequency"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    )}
                    <button
                      onClick={() => void setMonitoringEnabled(competitor.id, !competitor.monitoring_enabled, competitor.monitor_frequency || 'daily')}
                      className={`p-2 rounded-lg transition-all ${competitor.monitoring_enabled ? 'bg-charcoal-light text-emerald-400' : 'bg-charcoal-light text-white/30 hover:text-white/60'}`}
                      title={competitor.monitoring_enabled ? `Auto-monitoring on (${competitor.monitor_frequency || 'daily'}) - click to disable` : 'Enable auto-monitoring'}
                    >
                      {competitor.monitoring_enabled
                        ? <ToggleRight className="w-4 h-4" />
                        : <ToggleLeft className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {visibleCompetitors.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-8 text-center">
              <p className="text-sm text-white/60">No competitors match your current search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
