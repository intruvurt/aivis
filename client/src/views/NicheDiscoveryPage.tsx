import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePageMeta } from '../hooks/usePageMeta';
import { meetsMinimumTier, TIER_LIMITS, type CanonicalTier } from '@shared/types';
import UpgradeWall from '../components/UpgradeWall';
import FeatureInstruction from '../components/FeatureInstruction';
import { API_URL } from '../config';
import apiFetch from '../utils/api';
import {
  Search,
  MapPin,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CalendarPlus,
  Copy,
  ChevronDown,
  Clock3,
  Sparkles,
  ExternalLink,
  BarChart3,
  TrendingUp,
  Target,
  RotateCcw,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────────── */

interface DiscoveredUrl {
  url: string;
  name: string;
  reason: string;
  valid: boolean;
  duplicate: boolean;
  httpStatus: number | null;
}

interface DiscoveryJob {
  id: string;
  query: string;
  location: string;
  status: string;
  discovered_urls: DiscoveredUrl[];
  scheduled_count: number;
  audited_count: number;
  error: string | null;
  created_at: string;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/** Safely normalise discovered_urls - handles double-stringified JSONB records */
function parseDiscoveredUrls(raw: unknown): DiscoveredUrl[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  return [];
}

function statusBadge(valid: boolean, duplicate: boolean, httpStatus: number | null) {
  if (duplicate)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[11px] font-medium text-yellow-400">
        <Copy className="h-3 w-3" />
        Duplicate
      </span>
    );
  if (!valid)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
        <XCircle className="h-3 w-3" />
        Invalid{httpStatus ? ` (${httpStatus})` : ''}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      Valid{httpStatus ? ` (${httpStatus})` : ''}
    </span>
  );
}

function jobStatusLabel(status: string) {
  switch (status) {
    case 'pending':
    case 'discovering':
      return 'Discovering…';
    case 'validating':
      return 'Validating URLs…';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

/* ── Component ────────────────────────────────────────────────────── */

export default function NicheDiscoveryPage() {
  usePageMeta({
    title: 'Niche URL Discovery',
    description:
      'Discover real business URLs by niche and location, validate them, and add to scheduled audits.',
    path: '/niche-discovery',
  });

  const user = useAuthStore((s) => s.user);
  const tier = (user?.tier || 'observer') as CanonicalTier;
  const hasAccess = meetsMinimumTier(tier, 'alignment');

  /* ── Search state ──────────────────────────────── */
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Current job state ─────────────────────────── */
  const [job, setJob] = useState<DiscoveryJob | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [frequency, setFrequency] = useState('weekly');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<{
    added: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  /* ── History state ─────────────────────────────── */
  const [pastJobs, setPastJobs] = useState<DiscoveryJob[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  /* ── Tier-aware frequency options ──────────────── */
  const tierLimits = TIER_LIMITS[tier];
  const allowedFreqs = tierLimits?.allowedRescanFrequencies || [];
  const visibleFreqs = FREQUENCY_OPTIONS.filter((f) => allowedFreqs.includes(f.value));

  /* ── Load past jobs ─────────────────────────────── */
  const loadHistory = useCallback(async () => {
    if (!hasAccess) return;
    try {
      const res = await apiFetch(`${API_URL}/api/features/niche-discovery?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setPastJobs(Array.isArray(data) ? data : data.jobs || []);
      }
    } catch {
      /* ignore */
    }
    setHistoryLoaded(true);
  }, [hasAccess]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /* ── Discover URLs ──────────────────────────────── */
  const handleDiscover = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setJob(null);
    setSelected(new Set());
    setScheduleResult(null);

    try {
      const res = await apiFetch(`${API_URL}/api/features/niche-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), location: location.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // If the server returned the job with a failure status, still show it
        if (errData.job) {
          setJob(errData.job);
        }
        throw new Error(errData.error || `Discovery failed (${res.status})`);
      }

      const data = await res.json();
      const jobData: DiscoveryJob = data.job || data;
      jobData.discovered_urls = parseDiscoveredUrls(jobData.discovered_urls);
      setJob(jobData);

      // Auto-select all valid, non-duplicate URLs
      const autoSelect = new Set<string>();
      for (const u of jobData.discovered_urls) {
        if (u.valid && !u.duplicate) autoSelect.add(u.url);
      }
      setSelected(autoSelect);

      // Refresh history
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Discovery failed');
    } finally {
      setLoading(false);
    }
  }, [query, location, loadHistory]);

  /* ── Add to schedule ────────────────────────────── */
  const handleSchedule = useCallback(async () => {
    if (!job || selected.size === 0) return;
    setScheduling(true);
    setScheduleResult(null);
    setError(null);

    try {
      const res = await apiFetch(`${API_URL}/api/features/niche-discovery/${job.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: Array.from(selected), frequency }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Scheduling failed (${res.status})`);
      }

      const result = await res.json();
      setScheduleResult(result);
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Scheduling failed');
    } finally {
      setScheduling(false);
    }
  }, [job, selected, frequency, loadHistory]);

  /* ── Toggle selection ───────────────────────────── */
  const toggleUrl = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAllValid = () => {
    if (!job) return;
    const all = new Set<string>();
    for (const u of parseDiscoveredUrls(job.discovered_urls)) {
      if (u.valid && !u.duplicate) all.add(u.url);
    }
    setSelected(all);
  };

  const deselectAll = () => setSelected(new Set());

  /* ── Load a past job ────────────────────────────── */
  const loadJob = useCallback(async (jobId: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/features/niche-discovery/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        const jobData: DiscoveryJob = data.job || data;
        jobData.discovered_urls = parseDiscoveredUrls(jobData.discovered_urls);
        setJob(jobData);
        setQuery(jobData.query || '');
        setLocation(jobData.location || '');
        setScheduleResult(null);
        const autoSelect = new Set<string>();
        for (const u of jobData.discovered_urls) {
          if (u.valid && !u.duplicate) autoSelect.add(u.url);
        }
        setSelected(autoSelect);
      }
    } catch {
      /* ignore */
    }
  }, []);

  /* ── Aggregate stats ─────────────────────────────── */
  const historyStats = useMemo(() => {
    let totalFound = 0,
      totalValid = 0,
      totalScheduled = 0;
    for (const j of pastJobs) {
      const discovered = parseDiscoveredUrls(j.discovered_urls);
      totalFound += discovered.length;
      totalValid += discovered.filter((u) => u.valid && !u.duplicate).length;
      totalScheduled += j.scheduled_count || 0;
    }
    return { totalFound, totalValid, totalScheduled, totalJobs: pastJobs.length };
  }, [pastJobs]);

  /* ── Upgrade wall for Observer ──────────────────── */
  if (!hasAccess) {
    return (
      <div className="px-4 py-16">
        <UpgradeWall
          feature="Niche URL Discovery"
          description="Discover real business URLs by niche and location, validate them, and add to your scheduled audit list - all powered by web search."
          requiredTier="alignment"
          icon={<Search className="h-6 w-6" />}
          featurePreview={[
            'Discover real business URLs by niche keyword and geographic location via web search',
            'Validate each discovered URL for public accessibility and crawl eligibility',
            'Add discovered URLs to your scheduled audit list in bulk',
          ]}
        />
      </div>
    );
  }

  const urls = parseDiscoveredUrls(job?.discovered_urls);
  const validCount = urls.filter((u) => u.valid && !u.duplicate).length;
  const dupCount = urls.filter((u) => u.duplicate).length;
  const invalidCount = urls.filter((u) => !u.valid && !u.duplicate).length;

  return (
    <div className="px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
            <Target className="h-7 w-7 text-emerald-400" />
            Niche URL Discovery
          </h1>
          <p className="mt-1.5 text-sm text-white/50 max-w-2xl">
            Discover real business URLs by industry and location using DuckDuckGo + Bing web search,
            validate HTTP responses, and schedule AI visibility audits.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          Alignment+
        </span>
      </div>

      <FeatureInstruction
        headline="How to use Niche Discovery"
        steps={[
          "Type an industry or service niche (e.g. 'dentists in Austin') and click Discover.",
          'Review the discovered URLs — valid ones are auto-selected for scheduling.',
          'Set a scan frequency (daily, weekly, monthly) and add selected URLs to scheduled audits.',
          'Check back later to see aggregated audit results across the niche.',
        ]}
        benefit="Build a competitor landscape automatically by discovering and monitoring real business URLs in any niche."
        accentClass="text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.06]"
        defaultCollapsed
      />

      {/* Stats overview - only show if history exists */}
      {historyLoaded && historyStats.totalJobs > 0 && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
            <div className="text-2xl font-bold text-white tabular-nums">
              {historyStats.totalJobs}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">Discoveries Run</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-300 tabular-nums">
              {historyStats.totalFound}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">URLs Found</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-300 tabular-nums">
              {historyStats.totalValid}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">Valid URLs</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
            <div className="text-2xl font-bold text-amber-300 tabular-nums">
              {historyStats.totalScheduled}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">Scheduled for Audit</div>
          </div>
        </div>
      )}

      {/* Search form */}
      <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-white/60" />
          <h2 className="text-sm font-semibold text-white">Search for Businesses</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              Niche / Industry
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && query.trim() && handleDiscover()}
                enterKeyHint="search"
                placeholder='e.g. "CBD smoke shops" or "vegan bakeries"'
                maxLength={200}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-500/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/15"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              Location / Area <span className="text-white/30">(optional)</span>
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && query.trim() && handleDiscover()}
                enterKeyHint="search"
                placeholder='e.g. "Atlanta, GA" or "Southeast US"'
                maxLength={200}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-500/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/15"
              />
            </div>
          </div>
          <button
            onClick={handleDiscover}
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600/80 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Discovering…' : 'Discover URLs'}
          </button>
        </div>

        {/* Progress stepper */}
        {loading && (
          <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-emerald-400 animate-spin" />
                </div>
                <span className="text-xs text-emerald-300 font-medium">Searching</span>
              </div>
              <div className="h-px flex-1 bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-[10px] text-white/30 font-bold">2</span>
                </div>
                <span className="text-xs text-white/30">Validating</span>
              </div>
              <div className="h-px flex-1 bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-[10px] text-white/30 font-bold">3</span>
                </div>
                <span className="text-xs text-white/30">Results</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/40 text-center">
              Scraping DuckDuckGo + Bing for real business URLs matching your query…
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <span>{error}</span>
            <button
              onClick={handleDiscover}
              disabled={loading || !query.trim()}
              className="ml-3 inline-flex items-center gap-1 text-xs text-red-200 underline hover:text-white transition"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Results section */}
      {job && job.status === 'completed' && urls.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6 mb-6">
          {/* Result summary bar */}
          <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-center">
              <div className="text-lg font-bold text-white tabular-nums">{urls.length}</div>
              <div className="text-[10px] text-white/40">Total Found</div>
            </div>
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-center">
              <div className="text-lg font-bold text-emerald-300 tabular-nums">{validCount}</div>
              <div className="text-[10px] text-emerald-400/60">Valid</div>
            </div>
            <div className="rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-3 py-2 text-center">
              <div className="text-lg font-bold text-yellow-300 tabular-nums">{dupCount}</div>
              <div className="text-[10px] text-yellow-400/60">Duplicates</div>
            </div>
            <div className="rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2 text-center">
              <div className="text-lg font-bold text-red-300 tabular-nums">{invalidCount}</div>
              <div className="text-[10px] text-red-400/60">Invalid</div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-white/50" />
              Discovered URLs
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllValid}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
              >
                Select all valid ({validCount})
              </button>
              <button
                onClick={deselectAll}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
              >
                Deselect all
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02] text-xs text-white/40">
                  <th className="w-10 py-3"></th>
                  <th className="py-3 pl-3 pr-4 font-medium">Business</th>
                  <th className="py-3 px-3 font-medium">URL</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 pl-3 pr-4 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {urls.map((u, i) => {
                  const canSelect = u.valid && !u.duplicate;
                  const isSelected = selected.has(u.url);
                  return (
                    <tr
                      key={u.url + i}
                      className={`border-b border-white/5 transition ${canSelect ? 'hover:bg-white/[0.03] cursor-pointer' : 'opacity-50'}`}
                      onClick={() => canSelect && toggleUrl(u.url)}
                    >
                      <td className="py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => canSelect && toggleUrl(u.url)}
                          className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-emerald-500"
                        />
                      </td>
                      <td className="py-3 pl-3 pr-4 font-medium text-white/80">{u.name}</td>
                      <td className="py-3 px-3 max-w-[340px]">
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition break-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="break-all">
                            {u.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>
                      <td className="py-3 px-3">
                        {statusBadge(u.valid, u.duplicate, u.httpStatus)}
                      </td>
                      <td className="py-3 pl-3 pr-4 text-xs text-white/40 max-w-xs truncate">
                        {u.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Schedule controls */}
          {validCount > 0 && !scheduleResult && (
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/5 pt-5">
              <span className="text-xs text-white/50">Scan frequency:</span>
              <div className="relative">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-3 pr-8 text-xs text-white/80 focus:border-white/20 focus:outline-none"
                >
                  {visibleFreqs.length > 0 ? (
                    visibleFreqs.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))
                  ) : (
                    <option value="weekly">Weekly</option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              </div>

              <button
                onClick={handleSchedule}
                disabled={scheduling || selected.size === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/80 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {scheduling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarPlus className="h-3.5 w-3.5" />
                )}
                Add {selected.size} to scheduled scans
              </button>

              <span className="text-[11px] text-white/30">
                {selected.size} of {validCount} selected
              </span>
            </div>
          )}

          {/* Schedule result */}
          {scheduleResult && (
            <div className="mt-5 border-t border-white/5 pt-5">
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {scheduleResult.added} URL{scheduleResult.added !== 1 ? 's' : ''} added to
                  scheduled scans
                  {scheduleResult.skipped > 0 && (
                    <span className="text-yellow-400/80"> · {scheduleResult.skipped} skipped</span>
                  )}
                </span>
              </div>
              {scheduleResult.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-white/40">
                  {scheduleResult.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Job failed */}
      {job && job.status === 'failed' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <span>{job.error || 'Discovery failed. Try again or adjust your search.'}</span>
            <button
              onClick={handleDiscover}
              disabled={loading || !query.trim()}
              className="ml-3 inline-flex items-center gap-1 text-xs text-red-200 underline hover:text-white transition"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty state - no history, no active job */}
      {historyLoaded && pastJobs.length === 0 && !job && !loading && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center mb-6">
          <Target className="h-10 w-10 text-white/15 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-white/70 mb-2">No discoveries yet</h3>
          <p className="text-sm text-white/40 max-w-md mx-auto mb-5">
            Enter a niche like "CBD smoke shops" or "vegan bakeries" above to search DuckDuckGo and
            Bing for real business URLs. Valid results can be added to your scheduled audit
            pipeline.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['SaaS analytics tools', 'organic pet food brands', 'coworking spaces NYC'].map(
              (ex) => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition"
                >
                  {ex}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Past discovery jobs */}
      {historyLoaded && pastJobs.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-white/50" />
              Discovery History
            </h2>
            <span className="text-[11px] text-white/30">
              {pastJobs.length} past run{pastJobs.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {pastJobs.map((j) => {
              const jUrls = parseDiscoveredUrls(j.discovered_urls);
              const jValid = jUrls.filter((u) => u.valid && !u.duplicate).length;
              return (
                <button
                  key={j.id}
                  onClick={() => loadJob(j.id)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    job?.id === j.id
                      ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-white/40 shrink-0" />
                      <span className="truncate text-sm font-medium text-white/80">{j.query}</span>
                      {j.location && (
                        <span className="truncate text-xs text-white/40">in {j.location}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-white/30">
                      <span>{new Date(j.created_at).toLocaleDateString()}</span>
                      <span>{jUrls.length} found</span>
                      <span className="text-emerald-400/50">{jValid} valid</span>
                      {j.scheduled_count > 0 && (
                        <span className="text-amber-400/50">{j.scheduled_count} scheduled</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      j.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : j.status === 'failed'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {jobStatusLabel(j.status)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
