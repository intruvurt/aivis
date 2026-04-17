import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Upload,
  Tag,
  Sparkles,
  ShieldCheck,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  FileJson,
  Trash2,
  Eye,
  RefreshCw,
} from "lucide-react";
import apiFetch from "../utils/api";
import { useAuthStore } from "../stores/authStore";
import { meetsMinimumTier, uiTierFromCanonical } from "../../../shared/types";
import UpgradeWall from "../components/UpgradeWall";
import type {
  DatasetVertical,
  DatasetEntry,
  DatasetEntryStage,
  DatasetEntryOrigin,
  DatasetVerticalSummary,
  DatasetAuditProof,
} from "../../../shared/types";
import toast from "react-hot-toast";

/* ── Constants ─────────────────────────────────────────────────────────── */

const STAGE_ORDER: DatasetEntryStage[] = ["ingested", "annotated", "synthesized", "audited"];

const STAGE_META: Record<DatasetEntryStage, { label: string; colour: string; icon: typeof Upload }> = {
  ingested:    { label: "Ingested",    colour: "text-blue-400",    icon: Upload },
  annotated:   { label: "Annotated",   colour: "text-amber-400",   icon: Tag },
  synthesized: { label: "Synthesized", colour: "text-purple-400",  icon: Sparkles },
  audited:     { label: "Audited",     colour: "text-emerald-400", icon: ShieldCheck },
};

const VERTICAL_META: Record<DatasetVertical, { label: string; colour: string; description: string }> = {
  ai_governance:      { label: "AI Governance",      colour: "border-violet-500/40 bg-violet-500/5",  description: "Legal & compliance frameworks" },
  incident_response:  { label: "Incident Response",  colour: "border-cyan-500/40 bg-cyan-500/5",      description: "Cybersecurity event archives" },
  agentic_interaction:{ label: "Agentic Interaction", colour: "border-amber-500/40 bg-amber-500/5",    description: "Human-AI interaction patterns" },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function StageBadge({ stage }: { stage: DatasetEntryStage }) {
  const meta = STAGE_META[stage] ?? STAGE_META.ingested;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.colour}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  );
}

/* ── Entry Detail Modal ────────────────────────────────────────────────── */

function EntryDetail({ entry, onClose }: { entry: DatasetEntry; onClose: () => void }) {
  const [proof, setProof] = useState<DatasetAuditProof | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);

  useEffect(() => {
    if (entry.stage !== "audited" || !entry.audit_hash) return;
    setLoadingProof(true);
    apiFetch(`/api/dataset/proof/${entry.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setProof(d.proof); })
      .catch(() => {})
      .finally(() => setLoadingProof(false));
  }, [entry.id, entry.stage, entry.audit_hash]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0f121c] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <XCircle className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-semibold text-white mb-1">{entry.title}</h3>
        <div className="flex items-center gap-3 mb-4">
          <StageBadge stage={entry.stage} />
          <span className="text-xs text-white/40">{entry.origin}</span>
          {entry.source_url && (
            <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline truncate max-w-[200px]">
              {entry.source_url}
            </a>
          )}
        </div>

        <div className="space-y-4 text-sm text-white/70">
          {entry.content && (
            <div>
              <p className="text-xs font-medium text-white/50 mb-1">Content</p>
              <pre className="whitespace-pre-wrap bg-white/[0.03] rounded-lg p-3 text-xs max-h-40 overflow-y-auto">{entry.content}</pre>
            </div>
          )}

          {entry.labels && Object.keys(entry.labels).length > 0 && (
            <div>
              <p className="text-xs font-medium text-white/50 mb-1">Labels</p>
              <pre className="whitespace-pre-wrap bg-white/[0.03] rounded-lg p-3 text-xs">{JSON.stringify(entry.labels, null, 2)}</pre>
            </div>
          )}

          {entry.audit_hash && (
            <div>
              <p className="text-xs font-medium text-white/50 mb-1">Audit Hash</p>
              <code className="text-xs text-emerald-400 break-all">{entry.audit_hash}</code>
            </div>
          )}

          {entry.provenance_jsonld && (
            <div>
              <p className="text-xs font-medium text-white/50 mb-1">JSON-LD Provenance</p>
              <pre className="whitespace-pre-wrap bg-white/[0.03] rounded-lg p-3 text-xs max-h-48 overflow-y-auto">{JSON.stringify(entry.provenance_jsonld, null, 2)}</pre>
            </div>
          )}

          {loadingProof && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
          {proof && (
            <div>
              <p className="text-xs font-medium text-white/50 mb-1">Audit Proof</p>
              <pre className="whitespace-pre-wrap bg-white/[0.03] rounded-lg p-3 text-xs max-h-48 overflow-y-auto">{JSON.stringify(proof, null, 2)}</pre>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────── */

export default function DatasetStudioPage() {
  const user = useAuthStore((s) => s.user);
  const rawTier = user?.tier ?? "observer";
  const tier = uiTierFromCanonical(rawTier as any);
  const canAccess = meetsMinimumTier(rawTier as any, "signal");

  /* ── State ── */
  const [activeVertical, setActiveVertical] = useState<DatasetVertical>("ai_governance");
  const [summaries, setSummaries] = useState<Record<DatasetVertical, DatasetVerticalSummary | null>>({
    ai_governance: null,
    incident_response: null,
    agentic_interaction: null,
  });
  const [entries, setEntries] = useState<DatasetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [stageFilter, setStageFilter] = useState<DatasetEntryStage | "">("");
  const [originFilter, setOriginFilter] = useState<DatasetEntryOrigin | "">("");
  const [selectedEntry, setSelectedEntry] = useState<DatasetEntry | null>(null);

  /* Ingest form */
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingesting, setIngesting] = useState(false);

  /* Synthesize form */
  const [synthCount, setSynthCount] = useState(5);
  const [synthesizing, setSynthesizing] = useState(false);

  /* Action loading */
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ── Data loading ── */
  const loadSummaries = useCallback(async () => {
    try {
      const r = await apiFetch("/api/dataset/summary");
      const d = await r.json();
      if (d.success && d.summaries) {
        const map: Record<string, DatasetVerticalSummary> = {};
        for (const s of d.summaries) map[s.vertical] = s;
        setSummaries({
          ai_governance: map["ai_governance"] ?? null,
          incident_response: map["incident_response"] ?? null,
          agentic_interaction: map["agentic_interaction"] ?? null,
        });
      }
    } catch { /* silent */ }
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ vertical: activeVertical, limit: "50" });
      if (stageFilter) params.set("stage", stageFilter);
      if (originFilter) params.set("origin", originFilter);
      const r = await apiFetch(`/api/dataset/entries?${params}`);
      const d = await r.json();
      if (d.success) setEntries(d.entries ?? []);
    } catch {
      toast.error("Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, [activeVertical, stageFilter, originFilter]);

  useEffect(() => {
    if (!canAccess) return;
    loadSummaries();
  }, [canAccess, loadSummaries]);

  useEffect(() => {
    if (!canAccess) return;
    loadEntries();
  }, [canAccess, loadEntries]);

  /* ── Actions ── */
  const handleIngest = useCallback(async () => {
    if (!ingestUrl.trim() && !ingestContent.trim()) {
      toast.error("Provide a source URL or content");
      return;
    }
    setIngesting(true);
    try {
      const r = await apiFetch("/api/dataset/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical: activeVertical,
          source_url: ingestUrl.trim() || undefined,
          title: ingestTitle.trim() || undefined,
          content: ingestContent.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success("Entry ingested");
        setIngestUrl("");
        setIngestTitle("");
        setIngestContent("");
        setIngestOpen(false);
        loadEntries();
        loadSummaries();
      } else {
        toast.error(d.error ?? "Ingestion failed");
      }
    } catch {
      toast.error("Ingestion failed");
    } finally {
      setIngesting(false);
    }
  }, [activeVertical, ingestUrl, ingestTitle, ingestContent, loadEntries, loadSummaries]);

  const handleSynthesize = useCallback(async () => {
    setSynthesizing(true);
    try {
      const r = await apiFetch("/api/dataset/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical: activeVertical, count: synthCount }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(`${d.entries?.length ?? 0} synthetic entries created`);
        loadEntries();
        loadSummaries();
      } else {
        toast.error(d.error ?? "Synthesis failed");
      }
    } catch {
      toast.error("Synthesis failed");
    } finally {
      setSynthesizing(false);
    }
  }, [activeVertical, synthCount, loadEntries, loadSummaries]);

  const handleAnnotate = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      const r = await apiFetch(`/api/dataset/annotate/${id}`, { method: "POST" });
      const d = await r.json();
      if (d.success) {
        toast.success("Entry annotated");
        loadEntries();
        loadSummaries();
      } else {
        toast.error(d.error ?? "Annotation failed");
      }
    } catch {
      toast.error("Annotation failed");
    } finally {
      setActionLoading(null);
    }
  }, [loadEntries, loadSummaries]);

  const handleAudit = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      const r = await apiFetch(`/api/dataset/audit/${id}`, { method: "POST" });
      const d = await r.json();
      if (d.success) {
        toast.success("Audit proof issued");
        loadEntries();
        loadSummaries();
      } else {
        toast.error(d.error ?? "Audit failed");
      }
    } catch {
      toast.error("Audit failed");
    } finally {
      setActionLoading(null);
    }
  }, [loadEntries, loadSummaries]);

  const handleBatchAudit = useCallback(async () => {
    const unaudited = entries.filter((e) => e.stage !== "audited").map((e) => e.id);
    if (!unaudited.length) {
      toast("No entries to audit");
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch("/api/dataset/audit/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_ids: unaudited }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(`${d.results?.filter((x: { success: boolean }) => x.success).length ?? 0} entries audited`);
        loadEntries();
        loadSummaries();
      } else {
        toast.error(d.error ?? "Batch audit failed");
      }
    } catch {
      toast.error("Batch audit failed");
    } finally {
      setLoading(false);
    }
  }, [entries, loadEntries, loadSummaries]);

  const handleDelete = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      const r = await apiFetch(`/api/dataset/entries/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (d.success) {
        toast.success("Entry deleted");
        loadEntries();
        loadSummaries();
      } else {
        toast.error(d.error ?? "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setActionLoading(null);
    }
  }, [loadEntries, loadSummaries]);

  /* ── Upgrade wall ── */
  if (!canAccess) {
    return (
      <UpgradeWall
        feature="Dataset Studio"
        description="Build audit-verified, high-integrity datasets across AI Governance, Incident Response, and Agentic Interaction verticals with deterministic provenance trails."
        requiredTier="signal"
        icon={<Database className="w-6 h-6" />}
      />
    );
  }

  const activeSummary = summaries[activeVertical];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Database className="w-6 h-6 text-violet-400" />
          Dataset Studio
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Build high-integrity, audit-verified datasets with four-stage pipeline: Ingest → Annotate → Synthesize → Audit
        </p>
      </motion.div>

      {/* Vertical selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.keys(VERTICAL_META) as DatasetVertical[]).map((v) => {
          const meta = VERTICAL_META[v];
          const sum = summaries[v];
          const active = v === activeVertical;
          return (
            <button
              key={v}
              onClick={() => setActiveVertical(v)}
              className={`rounded-xl border p-4 text-left transition-all ${
                active
                  ? `${meta.colour} ring-1 ring-white/20`
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <p className="text-sm font-semibold text-white">{meta.label}</p>
              <p className="text-xs text-white/40 mt-0.5">{meta.description}</p>
              {sum && (
                <div className="flex items-center gap-3 mt-3 text-xs text-white/50">
                  <span>{sum.total_entries} entries</span>
                  <span>{sum.audited_entries} audited</span>
                  <span>{sum.synthetic_entries} synthetic</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Pipeline stage overview */}
      {activeSummary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {STAGE_ORDER.map((stage) => {
            const meta = STAGE_META[stage];
            const Icon = meta.icon;
            const count =
              stage === "ingested" ? activeSummary.total_entries - activeSummary.annotated_entries - activeSummary.synthesized_entries - activeSummary.audited_entries :
              stage === "annotated" ? activeSummary.annotated_entries :
              stage === "synthesized" ? activeSummary.synthesized_entries :
              activeSummary.audited_entries;
            return (
              <div key={stage} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${meta.colour}`} />
                  <span className="text-xs font-medium text-white/70">{meta.label}</span>
                </div>
                <p className="text-xl font-bold text-white">{Math.max(0, count)}</p>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setIngestOpen(!ingestOpen)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Ingest Entry
          {ingestOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={handleSynthesize}
          disabled={synthesizing}
          className="inline-flex items-center gap-2 rounded-lg border border-purple-500/40 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
        >
          {synthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Synthesize {synthCount}
        </button>

        <button
          onClick={handleBatchAudit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4" />
          Batch Audit All
        </button>

        <button
          onClick={() => { loadEntries(); loadSummaries(); }}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Synth count */}
        <label className="inline-flex items-center gap-1.5 text-xs text-white/40 ml-auto">
          Count
          <input
            type="number"
            min={1}
            max={50}
            value={synthCount}
            onChange={(e) => setSynthCount(Math.max(1, Math.min(50, Number(e.target.value) || 5)))}
            className="w-14 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white"
          />
        </label>
      </div>

      {/* Ingest form */}
      {ingestOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3"
        >
          <p className="text-sm font-medium text-white">Ingest New Entry</p>
          <input
            type="url"
            placeholder="Source URL (optional)"
            value={ingestUrl}
            onChange={(e) => setIngestUrl(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <input
            type="text"
            placeholder="Title"
            value={ingestTitle}
            onChange={(e) => setIngestTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <textarea
            placeholder="Content (text payload)"
            value={ingestContent}
            onChange={(e) => setIngestContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 resize-y"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIngestOpen(false)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleIngest}
              disabled={ingesting}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
            >
              {ingesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Ingest
            </button>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 text-xs">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as DatasetEntryStage | "")}
          className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-white"
        >
          <option value="">All stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>{STAGE_META[s].label}</option>
          ))}
        </select>

        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value as DatasetEntryOrigin | "")}
          className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-white"
        >
          <option value="">All origins</option>
          <option value="real">Real</option>
          <option value="synthetic">Synthetic</option>
        </select>

        <span className="text-white/40 ml-auto">{entries.length} entries</span>
      </div>

      {/* Entry list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-white/40" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-sm">
          No entries yet. Ingest a source or synthesize edge-case data.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-4 flex items-center gap-4 hover:border-white/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StageBadge stage={entry.stage} />
                  <span className="text-[10px] text-white/30 uppercase">{entry.origin}</span>
                  {entry.human_reviewed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" title="Human reviewed" />}
                </div>
                <p className="text-sm font-medium text-white truncate">{entry.title || "(untitled)"}</p>
                {entry.source_url && (
                  <p className="text-xs text-white/30 truncate">{entry.source_url}</p>
                )}
              </div>

              {entry.audit_hash && (
                <span className="hidden sm:inline text-[10px] text-emerald-400/60 font-mono truncate max-w-[100px]" title={entry.audit_hash}>
                  {entry.audit_hash.slice(0, 12)}…
                </span>
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setSelectedEntry(entry)}
                  className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>

                {entry.stage === "ingested" && (
                  <button
                    onClick={() => handleAnnotate(entry.id)}
                    disabled={actionLoading === entry.id}
                    className="p-1.5 rounded hover:bg-amber-500/10 text-amber-400/60 hover:text-amber-400 transition-colors"
                    title="Annotate"
                  >
                    {actionLoading === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                  </button>
                )}

                {entry.stage !== "audited" && (
                  <button
                    onClick={() => handleAudit(entry.id)}
                    disabled={actionLoading === entry.id}
                    className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400/60 hover:text-emerald-400 transition-colors"
                    title="Audit"
                  >
                    {actionLoading === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  </button>
                )}

                {entry.provenance_jsonld && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(entry.provenance_jsonld, null, 2));
                      toast.success("JSON-LD copied");
                    }}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    title="Copy JSON-LD"
                  >
                    <FileJson className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(entry.id)}
                  disabled={actionLoading === entry.id}
                  className="p-1.5 rounded hover:bg-red-500/10 text-red-400/40 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Entry detail modal */}
      {selectedEntry && <EntryDetail entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </div>
  );
}
