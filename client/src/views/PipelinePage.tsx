import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  PlayCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  RotateCcw,
} from "lucide-react";
import apiFetch from "../utils/api";
import { useAuthStore } from "../stores/authStore";
import { meetsMinimumTier, uiTierFromCanonical } from "../../../shared/types";
import UpgradeWall from "../components/UpgradeWall";
import type {
  PipelineRun,
  PipelineRunStatus,
  RemediationMode,
  LevelledFixpack,
} from "../../../shared/types";
import toast from "react-hot-toast";

/* ── Status badge helpers ──────────────────────────────────────────────── */

const STATUS_META: Record<
  PipelineRunStatus,
  { label: string; colour: string; icon: typeof Clock }
> = {
  pending:              { label: "Pending",           colour: "text-slate-400",  icon: Clock },
  scanning:             { label: "Scanning",          colour: "text-blue-400",   icon: Loader2 },
  scoring:              { label: "Scoring",           colour: "text-indigo-400", icon: Loader2 },
  classifying:          { label: "Classifying",       colour: "text-purple-400", icon: Loader2 },
  generating_fixpacks:  { label: "Generating fixes",  colour: "text-amber-400",  icon: Loader2 },
  awaiting_approval:    { label: "Awaiting approval", colour: "text-yellow-300", icon: ThumbsUp },
  applying:             { label: "Applying",          colour: "text-cyan-400",   icon: Loader2 },
  rescanning:           { label: "Rescanning",        colour: "text-teal-400",   icon: RotateCcw },
  completed:            { label: "Completed",         colour: "text-emerald-400",icon: CheckCircle2 },
  failed:               { label: "Failed",            colour: "text-red-400",    icon: XCircle },
};

function StatusBadge({ status }: { status: PipelineRunStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const spinning = ["scanning", "scoring", "classifying", "generating_fixpacks", "applying", "rescanning"].includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.colour}`}>
      <Icon className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`} />
      {meta.label}
    </span>
  );
}

/* ── Fixpack card ──────────────────────────────────────────────────────── */

function FixpackCard({ fp }: { fp: LevelledFixpack }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <span className="text-xs font-semibold text-violet-400 mr-2">L{fp.level}</span>
          <span className="text-sm font-medium text-white">{fp.title}</span>
          <span className="ml-2 text-xs text-white/50">
            +{fp.expected_uplift_min}–{fp.expected_uplift_max} pts
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-sm text-white/70">
          <p>{fp.summary}</p>
          {fp.patches.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Patches ({fp.patches.length})</p>
              {fp.patches.map((p, i) => (
                <div key={i} className="rounded bg-black/30 p-2 font-mono text-xs text-white/60 overflow-x-auto">
                  <span className="text-violet-400">{p.operation}</span>{" "}
                  <span className="text-white/80">{p.file_path}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Run detail panel ──────────────────────────────────────────────────── */

function RunDetail({
  run,
  onApprove,
  onRescan,
  acting,
}: {
  run: PipelineRun;
  onApprove: (id: string) => void;
  onRescan: (id: string) => void;
  acting: boolean;
}) {
  const sc = run.scoring_result;
  const cl = run.classification_result;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 space-y-4 border-t border-white/10 pt-4"
    >
      {/* Scoring summary */}
      {sc && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Score" value={sc.overall_score} />
          <Stat label="Hard blockers" value={sc.hard_blockers.length} />
          <Stat label="Categories" value={sc.categories.length} />
          {sc.score_cap != null && <Stat label="Score cap" value={sc.score_cap} />}
        </div>
      )}

      {/* Classification summary */}
      {cl && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Findings" value={cl.findings.length} />
          <Stat label="Auto-fixable" value={cl.auto_fixable_count} />
          <Stat label="Manual only" value={cl.manual_only_count} />
          <Stat label="Expected uplift" value={`+${cl.total_expected_uplift_min}–${cl.total_expected_uplift_max}`} />
        </div>
      )}

      {/* Fixpacks */}
      {run.fixpacks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide">
            Fixpacks ({run.fixpacks.length})
          </h4>
          {run.fixpacks.map((fp, i) => (
            <FixpackCard key={i} fp={fp} />
          ))}
        </div>
      )}

      {/* Rescan uplift */}
      {run.rescan_uplift && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4" />
            Rescan uplift: {run.rescan_uplift.score_before} → {run.rescan_uplift.score_after}{" "}
            <span className="text-emerald-300">(+{run.rescan_uplift.score_delta})</span>
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {run.status === "awaiting_approval" && (
          <button
            disabled={acting}
            onClick={() => onApprove(run.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <ThumbsUp className="w-4 h-4" /> Approve fixes
          </button>
        )}
        {["completed", "applying"].includes(run.status) && !run.rescan_uplift && (
          <button
            disabled={acting}
            onClick={() => onRescan(run.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Verify with rescan
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-3">
      <p className="text-[11px] text-white/40 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold text-white mt-0.5">{String(value)}</p>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */

export default function PipelinePage() {
  const user = useAuthStore((s) => s.user);
  const userTier = uiTierFromCanonical((user as any)?.tier ?? "observer");

  if (!meetsMinimumTier(userTier, "alignment")) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <UpgradeWall
          requiredTier="alignment"
          feature="Self-Healing Audit Pipeline"
          description="Run automated scan → score → classify → fixpack pipelines with one click. Alignment tier and above."
        />
      </div>
    );
  }

  return <PipelinePageInner />;
}

function PipelinePageInner() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  /* New run form state */
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<RemediationMode>("advisory");
  const [submitting, setSubmitting] = useState(false);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await apiFetch("/api/pipeline?limit=50");
      const data = await res.json();
      if (data.success) setRuns(data.runs ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const startRun = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, mode }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Pipeline run started");
        setUrl("");
        fetchRuns();
      } else {
        toast.error(data.error || "Failed to start pipeline");
      }
    } catch {
      toast.error("Failed to start pipeline run");
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (id: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/api/pipeline/${encodeURIComponent(id)}/approve`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Fixes approved"); fetchRuns(); }
      else toast.error(data.error || "Approve failed");
    } catch { toast.error("Approve failed"); }
    finally { setActing(false); }
  };

  const rescan = async (id: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/api/pipeline/${encodeURIComponent(id)}/rescan`, { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Rescan complete"); fetchRuns(); }
      else toast.error(data.error || "Rescan failed");
    } catch { toast.error("Rescan failed"); }
    finally { setActing(false); }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <PlayCircle className="w-6 h-6 text-violet-400" />
          Self-Healing Audit Pipeline
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Scan → Score → Classify → Generate fixpacks — all in one click.
        </p>
      </div>

      {/* New run form */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/70">Start a new pipeline run</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as RemediationMode)}
            className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="advisory">Advisory</option>
            <option value="assisted">Assisted</option>
            <option value="autonomous">Autonomous</option>
          </select>
          <button
            disabled={submitting || !url.trim()}
            onClick={startRun}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            Run Pipeline
          </button>
        </div>
      </div>

      {/* Run list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70">Pipeline runs</h2>
          <button
            onClick={fetchRuns}
            className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">
            No pipeline runs yet. Start one above.
          </div>
        ) : (
          runs.map((run) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <button
                onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={run.status} />
                  <span className="text-sm text-white truncate max-w-[280px]">
                    {run.target_url}
                  </span>
                  <span className="text-xs text-white/30 shrink-0">
                    {run.mode}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {run.scoring_result && (
                    <span className="text-sm font-semibold text-white">
                      {run.scoring_result.overall_score}
                    </span>
                  )}
                  <span className="text-xs text-white/30">
                    {new Date(run.created_at).toLocaleDateString()}
                  </span>
                  {expandedId === run.id ? (
                    <ChevronDown className="w-4 h-4 text-white/30" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/30" />
                  )}
                </div>
              </button>
              {expandedId === run.id && (
                <RunDetail run={run} onApprove={approve} onRescan={rescan} acting={acting} />
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
