/**
 * AgencyPage - Portfolio Command Center (Agency + Enterprise tier)
 *
 * Provides:
 * - Portfolio overview metrics (total projects, avg score, critical/warning counts)
 * - Projects table with score deltas and status badges
 * - Multi-select bulk actions: Run Audits, Bulk Schema Fix
 * - Live polling for active bulk-fix jobs
 * - Quick-add project modal
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart2,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  PlusCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import { meetsMinimumTier } from "@shared/types";
import type { CanonicalTier } from "@shared/types";

const API = API_URL.replace(/\/+$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioProject {
  id: string;
  organization_name: string;
  domain: string;
  plan: string;
  latest_score?: number | null;
  prev_score?: number | null;
  score_delta?: number | null;
  last_scanned_at?: string | null;
  status?: "stable" | "warning" | "critical" | null;
}

interface PortfolioOverview {
  total_projects: number;
  avg_score: number | null;
  projects_critical: number;
  projects_warning: number;
  projects_stable: number;
}

interface BulkFixJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  fix_type: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    results: Array<{ project_id: string; domain: string; status: string; error?: string }>;
  };
  created_at: string;
  completed_at?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...(opts?.headers as any) } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || `HTTP ${res.status}`);
  }
  return res.json();
}

function scoreBadge(score: number | null | undefined) {
  if (score == null) return <span className="text-white/30 text-xs">-</span>;
  const color =
    score >= 70 ? "text-emerald-400" : score >= 45 ? "text-amber-400" : "text-rose-400";
  return <span className={`font-mono font-bold text-sm ${color}`}>{score}</span>;
}

function deltaBadge(delta: number | null | undefined) {
  if (delta == null) return null;
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 text-xs">
        <TrendingUp className="w-3 h-3" />+{delta}
      </span>
    );
  if (delta < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-400 text-xs">
        <TrendingDown className="w-3 h-3" />{delta}
      </span>
    );
  return <span className="text-white/30 text-xs">±0</span>;
}

function statusDot(status: PortfolioProject["status"]) {
  if (!status) return null;
  const map: Record<string, string> = {
    stable: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-rose-500",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${map[status] ?? "bg-white/30"}`}
      title={status}
    />
  );
}

function jobProgressPct(job: BulkFixJob) {
  const { total, completed, failed } = job.progress;
  if (!total) return 0;
  return Math.round(((completed + failed) / total) * 100);
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number | null;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="aurora-card p-4 flex items-center gap-4">
      <div className={`rounded-xl p-2.5 ${color}/10`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-white/50 text-xs">{label}</p>
        <p className="text-white font-bold text-xl leading-tight">
          {value ?? "-"}
        </p>
      </div>
    </div>
  );
}

// ── Add-project modal ─────────────────────────────────────────────────────────

function AddProjectModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState("observer");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!name.trim() || !domain.trim()) {
      setErr("Organization name and domain are required.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portfolio/projects", {
        method: "POST",
        body: JSON.stringify({
          organization_name: name.trim(),
          domain: domain.trim(),
          plan,
        }),
      });
      onAdded();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="aurora-card p-6 w-full max-w-md relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 text-white/40 hover:text-white"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-white font-semibold text-base mb-4">Add Project</h2>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-white/60 text-xs mb-1">Client / Organization Name</label>
            <input
              className="aurora-input w-full"
              placeholder="Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">Domain</label>
            <input
              className="aurora-input w-full"
              placeholder="https://example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">Plan</label>
            <select
              className="aurora-input w-full"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              <option value="observer">Observer (Free)</option>
              <option value="alignment">Alignment ($49/mo)</option>
              <option value="signal">Signal ($149/mo)</option>
            </select>
          </div>

          {err && <p className="text-rose-400 text-xs">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="aurora-btn aurora-btn-primary w-full mt-2 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Add Project
          </button>
        </form>
      </div>
    </div>
  );
}

// ── BulkFixProgressBar ────────────────────────────────────────────────────────

function BulkFixProgressBar({ job, onDone }: { job: BulkFixJob; onDone: () => void }) {
  const pct = jobProgressPct(job);
  const done = job.status === "completed" || job.status === "failed";
  const color = job.status === "failed" ? "bg-rose-500" : "bg-indigo-500";

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  return (
    <div className="aurora-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80 text-sm">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span>Bulk Fix - {job.fix_type}</span>
          <span className="text-white/40 text-xs">{new Date(job.created_at).toLocaleTimeString()}</span>
        </div>
        <span className="text-white/50 text-xs">
          {job.progress.completed + job.progress.failed}/{job.progress.total} done
        </span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {done && (
        <p className={`text-xs ${job.status === "completed" ? "text-emerald-400" : "text-rose-400"}`}>
          {job.status === "completed"
            ? `✓ All ${job.progress.total} projects queued successfully`
            : `${job.progress.failed} project(s) failed`}
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgencyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const tier = (user?.tier ?? "observer") as CanonicalTier;

  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [activeJob, setActiveJob] = useState<BulkFixJob | null>(null);
  const [sortField, setSortField] = useState<"latest_score" | "domain" | "status">("latest_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Gate: agency or enterprise only ───────────────────────────────────────

  if (!meetsMinimumTier(tier, "agency")) {
    return (
      <div className="aurora-page-container flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <Building2 className="w-12 h-12 text-indigo-400 mx-auto mb-4 opacity-60" />
          <h2 className="text-white font-semibold text-lg mb-2">Agency Dashboard</h2>
          <p className="text-white/50 text-sm mb-6">
            Manage dozens of client sites from one command center. Requires Agency tier or higher.
          </p>
          <button
            className="aurora-btn aurora-btn-primary"
            onClick={() => navigate("/app/billing")}
          >
            Upgrade to Agency
          </button>
        </div>
      </div>
    );
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [ov, pr] = await Promise.all([
        apiFetch("/api/portfolio/overview"),
        apiFetch("/api/portfolio/projects"),
      ]);
      setOverview(ov.portfolio ?? null);
      setProjects(pr.projects ?? []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ── Poll active bulk-fix job ───────────────────────────────────────────────

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/portfolio/bulk-fix/${jobId}`);
        const job: BulkFixJob = res.job;
        setActiveJob(job);
        if (job.status === "completed" || job.status === "failed") {
          clearInterval(pollRef.current!);
          load();
        }
      } catch {
        clearInterval(pollRef.current!);
      }
    }, 2500);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Bulk actions ───────────────────────────────────────────────────────────

  async function runBulkFix(fixType: string) {
    const ids = [...selected];
    if (!ids.length) {
      alert("Select at least one project first.");
      return;
    }
    try {
      const res = await apiFetch("/api/portfolio/bulk-fix", {
        method: "POST",
        body: JSON.stringify({ project_ids: ids, fix_type: fixType }),
      });
      setActiveJob(res.job);
      startPolling(res.job.id);
    } catch (e: any) {
      alert(`Failed to start bulk fix: ${e.message}`);
    }
  }

  async function runDailyAudits() {
    try {
      await apiFetch("/api/portfolio/run-daily", { method: "POST" });
      alert("Daily audit cycle queued for all projects.");
      load();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  }

  // ── Sort ───────────────────────────────────────────────────────────────────

  function toggleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const sorted = [...projects].sort((a, b) => {
    const mult = sortDir === "asc" ? 1 : -1;
    if (sortField === "domain") return mult * a.domain.localeCompare(b.domain);
    if (sortField === "status") {
      const order: Record<string, number> = { critical: 0, warning: 1, stable: 2 };
      return mult * ((order[a.status ?? "stable"] ?? 2) - (order[b.status ?? "stable"] ?? 2));
    }
    const sa = a.latest_score ?? -1;
    const sb = b.latest_score ?? -1;
    return mult * (sa - sb);
  });

  // ── Selection helpers ──────────────────────────────────────────────────────

  function toggleAll() {
    if (selected.size === projects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(projects.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Sort icon ──────────────────────────────────────────────────────────────

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-white/20" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-indigo-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-indigo-400" />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="aurora-page-container space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-white font-bold text-2xl tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            Agency Dashboard
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Portfolio command center</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="aurora-btn aurora-btn-ghost flex items-center gap-1.5 text-sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            className="aurora-btn aurora-btn-ghost flex items-center gap-1.5 text-sm"
            onClick={runDailyAudits}
          >
            <BarChart2 className="w-4 h-4 text-violet-400" />
            Run All Audits
          </button>
          <button
            className="aurora-btn aurora-btn-primary flex items-center gap-1.5 text-sm"
            onClick={() => setShowAdd(true)}
          >
            <PlusCircle className="w-4 h-4" />
            Add Project
          </button>
        </div>
      </div>

      {err && (
        <div className="aurora-card p-4 border border-rose-500/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-rose-300 text-sm">{err}</p>
        </div>
      )}

      {/* Overview stats */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total Projects"
            value={overview.total_projects}
            icon={Building2}
            color="text-indigo-400"
          />
          <StatCard
            label="Avg Score"
            value={overview.avg_score != null ? Math.round(overview.avg_score) : null}
            icon={BarChart2}
            color="text-blue-400"
          />
          <StatCard
            label="Stable"
            value={overview.projects_stable}
            icon={CheckCircle2}
            color="text-emerald-400"
          />
          <StatCard
            label="Warning"
            value={overview.projects_warning}
            icon={AlertTriangle}
            color="text-amber-400"
          />
          <StatCard
            label="Critical"
            value={overview.projects_critical}
            icon={AlertTriangle}
            color="text-rose-400"
          />
        </div>
      )}

      {/* Active bulk-fix job */}
      {activeJob && (
        <BulkFixProgressBar
          job={activeJob}
          onDone={() => {}}
        />
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="aurora-card p-3 flex flex-wrap items-center gap-3 border border-indigo-500/30">
          <span className="text-white/60 text-sm">
            {selected.size} project{selected.size > 1 ? "s" : ""} selected
          </span>
          <button
            className="aurora-btn aurora-btn-ghost text-sm flex items-center gap-1.5"
            onClick={() => runBulkFix("schema")}
          >
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            Bulk Schema Fix
          </button>
          <button
            className="aurora-btn aurora-btn-ghost text-sm flex items-center gap-1.5"
            onClick={() => runBulkFix("meta")}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Bulk Meta Fix
          </button>
          <button
            className="ml-auto text-white/30 hover:text-white"
            onClick={() => setSelected(new Set())}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Projects table */}
      <div className="aurora-card overflow-hidden">
        {loading && !projects.length ? (
          <div className="flex items-center justify-center py-16">
            <img src="/aivis-progress-spinner.png" alt="" className="w-6 h-6 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No projects yet.</p>
            <button
              className="aurora-btn aurora-btn-primary mt-4 text-sm flex items-center gap-2 mx-auto"
              onClick={() => setShowAdd(true)}
            >
              <PlusCircle className="w-4 h-4" />
              Add first project
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/08 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left p-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === projects.length && projects.length > 0}
                      onChange={toggleAll}
                      className="accent-indigo-500"
                    />
                  </th>
                  <th
                    className="text-left p-3 cursor-pointer text-white/50 hover:text-white select-none"
                    onClick={() => toggleSort("domain")}
                  >
                    <span className="flex items-center gap-1">
                      Domain <SortIcon field="domain" />
                    </span>
                  </th>
                  <th className="text-left p-3 hidden sm:table-cell">Client</th>
                  <th
                    className="text-left p-3 cursor-pointer text-white/50 hover:text-white select-none"
                    onClick={() => toggleSort("latest_score")}
                  >
                    <span className="flex items-center gap-1">
                      Score <SortIcon field="latest_score" />
                    </span>
                  </th>
                  <th className="text-left p-3">Change</th>
                  <th
                    className="text-left p-3 cursor-pointer text-white/50 hover:text-white select-none hidden md:table-cell"
                    onClick={() => toggleSort("status")}
                  >
                    <span className="flex items-center gap-1">
                      Status <SortIcon field="status" />
                    </span>
                  </th>
                  <th className="text-left p-3 hidden lg:table-cell">Last scan</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((project) => (
                  <tr
                    key={project.id}
                    className={`border-b border-white/05 hover:bg-white/03 transition-colors ${
                      selected.has(project.id) ? "bg-indigo-500/05" : ""
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(project.id)}
                        onChange={() => toggleOne(project.id)}
                        className="accent-indigo-500"
                      />
                    </td>
                    <td className="p-3 font-mono text-white/80 text-xs truncate max-w-[160px]">
                      {project.domain}
                    </td>
                    <td className="p-3 text-white/60 hidden sm:table-cell truncate max-w-[120px]">
                      {project.organization_name}
                    </td>
                    <td className="p-3">{scoreBadge(project.latest_score)}</td>
                    <td className="p-3">{deltaBadge(project.score_delta)}</td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        {statusDot(project.status)}
                        <span className="text-white/50 text-xs capitalize">{project.status ?? "-"}</span>
                      </div>
                    </td>
                    <td className="p-3 text-white/30 text-xs hidden lg:table-cell">
                      {project.last_scanned_at
                        ? new Date(project.last_scanned_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="p-3">
                      <a
                        href={`/app/analyze?url=${encodeURIComponent(project.domain)}`}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Audit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add project modal */}
      {showAdd && (
        <AddProjectModal
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}
    </div>
  );
}
