/**
 * NicheRankingPanel
 *
 * Displays enterprise-grade niche competitive ranking results:
 * - Brand rank in the AI-generated top 50/100 for the niche
 * - Short-form model names used for ranking and citation verification
 * - Per-platform citation model attribution (primary/fallback)
 * - Scheduled ranking job manager
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  TrendingUp,
  Bot,
  Clock,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Target,
  Layers3,
  Calendar,
  Cpu,
} from "lucide-react";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NicheRankingEntry {
  rank: number;
  brand_name: string;
  is_target: boolean;
  citation_excerpt?: string;
}

interface CitationModelUsed {
  platform: string;
  model_id: string;
  model_short: string;
  role: "primary" | "fallback";
  mentioned: boolean;
  position: number | null;
}

interface NicheRankingResult {
  id: string;
  target_url: string;
  brand_name: string;
  niche: string;
  niche_keywords: string[];
  target_rank: number | null;
  in_top_50: boolean;
  in_top_100: boolean;
  top_50: NicheRankingEntry[];
  top_100: NicheRankingEntry[];
  ranking_model_id: string;
  ranking_model_short: string;
  ranking_model_role: "primary" | "fallback";
  citation_models_used: CitationModelUsed[];
  ran_at: string;
  scheduled_job_id?: string;
}

interface ScheduledJob {
  id: string;
  target_url: string;
  niche?: string;
  interval_hours: number;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  claude: "Claude",
  google_ai: "Google AI",
};

const RANK_BADGE: Record<string, string> = {
  top10: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  top25: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  top50: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  top100: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  unranked: "bg-red-500/20 text-red-300 border border-red-500/30",
};

function getRankClass(rank: number | null): string {
  if (!rank) return RANK_BADGE.unranked;
  if (rank <= 10) return RANK_BADGE.top10;
  if (rank <= 25) return RANK_BADGE.top25;
  if (rank <= 50) return RANK_BADGE.top50;
  return RANK_BADGE.top100;
}

function getRankLabel(rank: number | null, brandName: string): string {
  if (!rank) return `${brandName} — not ranked in top 100`;
  return `#${rank} in niche`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModelPill({
  modelShort,
  role,
  platform,
  mentioned,
}: {
  modelShort: string;
  role: "primary" | "fallback";
  platform?: string;
  mentioned?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
        role === "primary"
          ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
          : "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"
      }`}
    >
      <Cpu size={10} />
      {modelShort}
      {role === "fallback" && (
        <span className="text-[9px] text-zinc-500 ml-0.5">fallback</span>
      )}
      {platform && (
        <span className="text-[9px] opacity-60 ml-0.5">/{PLATFORM_LABEL[platform] ?? platform}</span>
      )}
      {mentioned !== undefined && (
        mentioned
          ? <CheckCircle2 size={9} className="text-emerald-400 ml-0.5" />
          : <XCircle size={9} className="text-red-400 ml-0.5" />
      )}
    </span>
  );
}

function Top50List({
  entries,
  label,
}: {
  entries: NicheRankingEntry[];
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, 10);

  if (!entries.length) {
    return (
      <div className="text-sm text-zinc-500 italic">No entries in {label}.</div>
    );
  }

  return (
    <div>
      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        {label} ({entries.length} brands)
      </div>
      <div className="space-y-0.5">
        {visible.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg text-sm ${
              entry.is_target
                ? "bg-indigo-500/15 border border-indigo-500/30 font-semibold"
                : "bg-zinc-800/30 hover:bg-zinc-700/30"
            }`}
          >
            <span
              className={`w-6 text-right text-[11px] font-mono shrink-0 ${
                entry.is_target ? "text-indigo-300" : "text-zinc-500"
              }`}
            >
              {entry.rank}
            </span>
            <span className={entry.is_target ? "text-indigo-200" : "text-zinc-300"}>
              {entry.brand_name}
            </span>
            {entry.is_target && (
              <span className="ml-auto text-[10px] text-indigo-400 font-semibold shrink-0">
                ← YOU
              </span>
            )}
          </div>
        ))}
      </div>
      {entries.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Show less" : `Show all ${entries.length}`}
        </button>
      )}
    </div>
  );
}

function ScheduledJobRow({
  job,
  onToggle,
  onDelete,
}: {
  job: ScheduledJob;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-sm">
      <div className={`w-2 h-2 rounded-full shrink-0 ${job.is_active ? "bg-emerald-400" : "bg-zinc-600"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-zinc-300 truncate text-xs">{job.target_url}</div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-zinc-500 text-[11px]">
            <Clock size={10} className="inline mr-0.5" />
            Every {job.interval_hours}h
          </span>
          {job.next_run_at && (
            <span className="text-zinc-500 text-[11px]">
              Next: {formatDate(job.next_run_at)}
            </span>
          )}
          <span className="text-zinc-600 text-[11px]">
            {job.run_count} run{job.run_count !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggle(job.id, !job.is_active)}
          title={job.is_active ? "Pause" : "Resume"}
          className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          {job.is_active ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          onClick={() => onDelete(job.id)}
          title="Delete"
          className="p-1.5 rounded hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  targetUrl?: string;
  /** Pre-loaded ranking result (from parent, e.g. in analysis report) */
  initialResult?: NicheRankingResult | null;
  /** Show schedule manager */
  showScheduler?: boolean;
}

export default function NicheRankingPanel({
  targetUrl,
  initialResult,
  showScheduler = true,
}: Props) {
  const { token } = useAuthStore();
  const apiBase = API_URL.replace(/\/+$/, "");

  const [ranking, setRanking] = useState<NicheRankingResult | null>(
    initialResult ?? null
  );
  const [running, setRunning] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scheduler
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [newJobInterval, setNewJobInterval] = useState<number>(24);
  const [creatingJob, setCreatingJob] = useState(false);

  // View toggle: top50 / top100
  const [listView, setListView] = useState<"top50" | "top100">("top50");

  const apiHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ── Fetch latest ranking ───────────────────────────────────────────────────

  const fetchLatest = useCallback(async () => {
    if (!targetUrl) return;
    setLoadingLatest(true);
    try {
      const res = await fetch(
        `${apiBase}/api/citations/niche-ranking/latest?url=${encodeURIComponent(targetUrl)}`,
        { headers: apiHeaders }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.ranking) setRanking(data.ranking);
    } catch {
      // ignore
    } finally {
      setLoadingLatest(false);
    }
  }, [targetUrl, token]);

  useEffect(() => {
    if (!initialResult && targetUrl) {
      fetchLatest();
    }
  }, [targetUrl, fetchLatest, initialResult]);

  // ── Fetch scheduled jobs ───────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    if (!showScheduler) return;
    try {
      const res = await fetch(`${apiBase}/api/citations/schedule`, {
        headers: apiHeaders,
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.jobs)) setJobs(data.jobs);
    } catch {
      // ignore
    }
  }, [showScheduler, token]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // ── Run new ranking ────────────────────────────────────────────────────────

  const runRanking = async () => {
    if (!targetUrl) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/citations/niche-ranking`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ranking failed");
        return;
      }
      if (data.ranking) setRanking(data.ranking);
    } catch (err: any) {
      setError("Network error — check connection");
    } finally {
      setRunning(false);
    }
  };

  // ── Scheduler actions ──────────────────────────────────────────────────────

  const createJob = async () => {
    if (!targetUrl) return;
    setCreatingJob(true);
    try {
      const res = await fetch(`${apiBase}/api/citations/schedule`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ url: targetUrl, interval_hours: newJobInterval }),
      });
      const data = await res.json();
      if (res.ok && data.job) {
        setJobs((prev) => [data.job, ...prev]);
        setShowJobForm(false);
      }
    } catch {
      // ignore
    } finally {
      setCreatingJob(false);
    }
  };

  const toggleJob = async (id: string, isActive: boolean) => {
    const res = await fetch(`${apiBase}/api/citations/schedule/${id}/toggle`, {
      method: "PATCH",
      headers: apiHeaders,
      body: JSON.stringify({ is_active: isActive }),
    });
    const data = await res.json();
    if (res.ok && data.job) {
      setJobs((prev) => prev.map((j) => (j.id === id ? data.job : j)));
    }
  };

  const deleteJob = async (id: string) => {
    await fetch(`${apiBase}/api/citations/schedule/${id}`, {
      method: "DELETE",
      headers: apiHeaders,
    });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const mentionedCount = ranking?.citation_models_used.filter((m) => m.mentioned).length ?? 0;
  const totalCitationModels = ranking?.citation_models_used.length ?? 0;

  return (
    <div className="space-y-4">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-indigo-400" />
          <span className="font-semibold text-white text-sm">
            Niche Competitive Ranking
          </span>
          <span className="text-[11px] text-zinc-500 ml-1">
            AI-generated top 50/100 · citation attribution
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLatest}
            disabled={loadingLatest}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} className={loadingLatest ? "animate-spin" : ""} />
          </button>
          {targetUrl && (
            <button
              onClick={runRanking}
              disabled={running}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60"
            >
              {running ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play size={12} />
                  Run Ranking
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-700/30 text-red-300 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* ─── Current ranking result ───────────────────────────────────────── */}
      {ranking ? (
        <div className="space-y-4">
          {/* Rank summary card */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/40 p-4">
            <div className="flex items-start gap-4">
              {/* Rank badge */}
              <div
                className={`text-center px-3 py-2 rounded-lg min-w-[72px] ${getRankClass(ranking.target_rank)}`}
              >
                <div className="text-2xl font-bold font-mono">
                  {ranking.target_rank ? `#${ranking.target_rank}` : "—"}
                </div>
                <div className="text-[10px] mt-0.5 opacity-80">
                  {ranking.target_rank
                    ? ranking.in_top_50
                      ? "Top 50"
                      : "Top 100"
                    : "Unranked"}
                </div>
              </div>

              {/* Meta */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {ranking.brand_name}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5 truncate">
                  Niche: <span className="text-zinc-300">{ranking.niche}</span>
                </div>
                {ranking.niche_keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ranking.niche_keywords.slice(0, 6).map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/40"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[11px] text-zinc-600 mt-2">
                  Last run {formatDate(ranking.ran_at)}
                </div>
              </div>

              {/* Citation mention summary */}
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-white">
                  {mentionedCount}/{totalCitationModels}
                </div>
                <div className="text-[11px] text-zinc-500">platforms cited</div>
              </div>
            </div>

            {/* Ranking model attribution */}
            <div className="mt-3 pt-3 border-t border-zinc-700/30">
              <div className="text-[11px] text-zinc-500 mb-1.5 uppercase tracking-wider font-semibold">
                List generated by
              </div>
              <ModelPill
                modelShort={ranking.ranking_model_short}
                role={ranking.ranking_model_role}
              />
            </div>
          </div>

          {/* Citation models used */}
          {ranking.citation_models_used.length > 0 && (
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/40 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Bot size={14} className="text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-300">
                  Citation Model Results
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ranking.citation_models_used.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                      m.mentioned
                        ? "bg-emerald-900/15 border-emerald-700/30"
                        : "bg-zinc-800/30 border-zinc-700/20"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-zinc-200">
                          {PLATFORM_LABEL[m.platform] ?? m.platform}
                        </span>
                        {m.mentioned ? (
                          <CheckCircle2 size={11} className="text-emerald-400" />
                        ) : (
                          <XCircle size={11} className="text-zinc-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ModelPill
                          modelShort={m.model_short}
                          role={m.role}
                        />
                        {m.mentioned && m.position && (
                          <span className="text-[10px] text-emerald-400 ml-1">
                            pos #{m.position}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`text-[10px] font-semibold ${
                        m.mentioned ? "text-emerald-400" : "text-zinc-600"
                      }`}
                    >
                      {m.mentioned ? "Cited" : "Not cited"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 50 / Top 100 list */}
          {(ranking.top_50.length > 0 || ranking.top_100.length > 0) && (
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Layers3 size={14} className="text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-300">
                    Competitive List
                  </span>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-zinc-700/40 text-[11px]">
                  {(["top50", "top100"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setListView(v)}
                      className={`px-2.5 py-1 transition-colors ${
                        listView === v
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {v === "top50" ? "Top 50" : "Top 100"}
                    </button>
                  ))}
                </div>
              </div>
              <Top50List
                entries={listView === "top50" ? ranking.top_50 : ranking.top_100}
                label={listView === "top50" ? "Top 50" : "Top 100"}
              />
            </div>
          )}
        </div>
      ) : !running && !loadingLatest ? (
        <div className="rounded-xl bg-zinc-900/40 border border-zinc-700/30 p-6 text-center">
          <Target size={28} className="text-zinc-600 mx-auto mb-2" />
          <div className="text-sm text-zinc-400 mb-3">
            No ranking data yet for this URL.
          </div>
          {targetUrl && (
            <button
              onClick={runRanking}
              disabled={running}
              className="text-xs font-medium px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Run first ranking
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-zinc-900/40 border border-zinc-700/30 p-6 flex items-center gap-3 text-zinc-400">
          <RefreshCw size={16} className="animate-spin text-indigo-400 shrink-0" />
          <span className="text-sm">
            {running ? "Running niche ranking across AI models…" : "Loading latest ranking…"}
          </span>
        </div>
      )}

      {/* ─── Scheduled jobs ──────────────────────────────────────────────── */}
      {showScheduler && (
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-300">
                Scheduled Citation Jobs
              </span>
              <span className="text-[11px] text-zinc-600 ml-1">
                runs on interval, persists results
              </span>
            </div>
            {targetUrl && (
              <button
                onClick={() => setShowJobForm(!showJobForm)}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
              >
                <Plus size={10} />
                Schedule
              </button>
            )}
          </div>

          {showJobForm && targetUrl && (
            <div className="mb-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/30 space-y-2">
              <div className="text-[11px] text-zinc-400">
                Schedule ranking for:{" "}
                <span className="text-zinc-300 font-mono truncate">{targetUrl}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[11px] text-zinc-400 shrink-0">
                  Every (hours):
                </label>
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={newJobInterval}
                  onChange={(e) => setNewJobInterval(Number(e.target.value))}
                  className="w-20 px-2 py-1 text-xs rounded bg-zinc-900 border border-zinc-600 text-white focus:border-indigo-500 outline-none"
                />
                <span className="text-[11px] text-zinc-500">
                  (1 = hourly, 24 = daily, 168 = weekly)
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createJob}
                  disabled={creatingJob}
                  className="text-xs font-medium px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60"
                >
                  {creatingJob ? "Creating…" : "Create job"}
                </button>
                <button
                  onClick={() => setShowJobForm(false)}
                  className="text-xs px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {jobs.length > 0 ? (
            <div className="space-y-1.5">
              {jobs.map((job) => (
                <ScheduledJobRow
                  key={job.id}
                  job={job}
                  onToggle={toggleJob}
                  onDelete={deleteJob}
                />
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-600 text-center py-2">
              No scheduled jobs yet.{" "}
              {targetUrl && (
                <button
                  onClick={() => setShowJobForm(true)}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  Create one
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
