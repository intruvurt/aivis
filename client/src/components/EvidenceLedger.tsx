/**
 * EvidenceLedger
 * Shows the full evidence manifest scraped during an audit — every ev_* data
 * point the AI used to grade the site. Allows Signal-tier users to drill into
 * the raw evidence backing each recommendation.
 */
import React, { useState } from "react";
import {
  FileSearch,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Database,
} from "lucide-react";

// Mirror of RecommendationList EV_LABELS
const EV_LABELS: Record<string, { label: string; category: string }> = {
  ev_title:      { label: "Page Title",        category: "Meta" },
  ev_meta_desc:  { label: "Meta Description",  category: "Meta" },
  ev_meta_kw:    { label: "Meta Keywords",     category: "Meta" },
  ev_og_title:   { label: "OG Title",          category: "Social" },
  ev_og_desc:    { label: "OG Description",    category: "Social" },
  ev_canonical:  { label: "Canonical URL",      category: "Technical" },
  ev_h1:         { label: "H1 Tag",            category: "Headings" },
  ev_h2:         { label: "H2 Tags",           category: "Headings" },
  ev_h3:         { label: "H3 Tags",           category: "Headings" },
  ev_word_count: { label: "Word Count",        category: "Content" },
  ev_links_int:  { label: "Internal Links",    category: "Links" },
  ev_links_ext:  { label: "External Links",    category: "Links" },
  ev_images:     { label: "Images",            category: "Content" },
  ev_https:      { label: "HTTPS",             category: "Technical" },
  ev_schema:     { label: "Schema / JSON-LD",  category: "Technical" },
  ev_body:       { label: "Body Snippet",      category: "Content" },
};

type EvidenceStatus = "good" | "warning" | "critical" | "info";

function classifyEvidence(id: string, value: string): EvidenceStatus {
  if (!value || value === "(none)" || value === "(none: CRITICAL)" || value === "(none — CRITICAL)") return "critical";
  if (value === "(none: missing canonical tag)" || value === "(none — missing canonical tag)") return "warning";

  switch (id) {
    case "ev_title":
      if (value.length < 20 || value.length > 70) return "warning";
      return "good";
    case "ev_meta_desc":
      if (value.length < 50 || value.length > 160) return "warning";
      return "good";
    case "ev_h1":
      if (value.includes("CRITICAL")) return "critical";
      return "good";
    case "ev_word_count": {
      const wc = parseInt(value, 10) || 0;
      if (wc < 300) return "critical";
      if (wc < 600) return "warning";
      return "good";
    }
    case "ev_https":
      return value === "true" ? "good" : "critical";
    case "ev_schema": {
      const count = parseInt(value, 10) || 0;
      if (count === 0) return "warning";
      return "good";
    }
    case "ev_links_int":
    case "ev_links_ext": {
      const n = parseInt(value, 10) || 0;
      if (n === 0) return "warning";
      return "good";
    }
    case "ev_images": {
      const n = parseInt(value, 10) || 0;
      if (n === 0) return "warning";
      return "good";
    }
    case "ev_meta_kw":
      return value === "(none)" ? "info" : "good";
    default:
      return "info";
  }
}

const statusConfig: Record<EvidenceStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  good:     { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", label: "Pass" },
  warning:  { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10", label: "Warning" },
  critical: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Critical" },
  info:     { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", label: "Info" },
};

interface ContentHighlight {
  area: string;
  found: string;
  status: string;
  note: string;
  source_id?: string;
}

interface EvidenceLedgerProps {
  evidenceManifest?: Record<string, string>;
  contentHighlights?: ContentHighlight[];
  recommendations?: Array<{ evidence_ids?: string[]; title?: string }>;
}

const EvidenceLedger: React.FC<EvidenceLedgerProps> = ({
  evidenceManifest,
  contentHighlights = [],
  recommendations = [],
}) => {
  const [expanded, setExpanded] = useState(false);
  const [filterStatus, setFilterStatus] = useState<EvidenceStatus | "all">("all");

  if (!evidenceManifest || Object.keys(evidenceManifest).length === 0) return null;

  // Build entries
  const entries = Object.entries(evidenceManifest).map(([id, value]) => {
    const meta = EV_LABELS[id] || { label: id, category: "Other" };
    const status = classifyEvidence(id, value);
    // Find recommendations that cite this evidence
    const citedBy = recommendations
      .filter((r) => r.evidence_ids?.includes(id))
      .map((r) => r.title || "Untitled");
    // Find content highlights linked to this evidence
    const highlights = contentHighlights.filter((h) => h.source_id === id);
    return { id, value, ...meta, status, citedBy, highlights };
  });

  const filtered = filterStatus === "all" ? entries : entries.filter((e) => e.status === filterStatus);

  // Summary counts
  const counts = { good: 0, warning: 0, critical: 0, info: 0 };
  entries.forEach((e) => counts[e.status]++);

  // Group by category
  const grouped = filtered.reduce<Record<string, typeof entries>>((acc, e) => {
    (acc[e.category] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-white/10 bg-charcoal overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-charcoal-deep/50 transition-colors"
      >
        <Database className="w-5 h-5 text-white/60" />
        <div className="flex-1 text-left">
          <h3 className="text-sm font-semibold text-white">Evidence Ledger</h3>
          <p className="text-xs text-white/50 mt-0.5">
            {entries.length} data points scraped &bull;{" "}
            <span className="text-green-400">{counts.good} pass</span> &bull;{" "}
            <span className="text-yellow-400">{counts.warning} warn</span> &bull;{" "}
            <span className="text-red-400">{counts.critical} critical</span>
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-white/50" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/50" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Filter bar */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "critical", "warning", "good", "info"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filterStatus === f
                    ? "bg-white/15 border-white/30 text-white"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                }`}
              >
                {f === "all" ? `All (${entries.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
              </button>
            ))}
          </div>

          {/* Grouped entries */}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{category}</h4>
              <div className="space-y-2">
                {items.map((entry) => {
                  const StatusIcon = statusConfig[entry.status].icon;
                  return (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-lg border border-white/8 bg-charcoal-deep hover:bg-charcoal-deep/80 transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1 rounded ${statusConfig[entry.status].bg}`}>
                          <StatusIcon className={`w-3.5 h-3.5 ${statusConfig[entry.status].color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{entry.label}</span>
                            <code className="text-[10px] text-white/40 font-mono">{entry.id}</code>
                          </div>
                          <p className="text-xs text-white/70 break-all whitespace-pre-wrap">
                            {entry.value.length > 500 ? `${entry.value.slice(0, 500)}…` : entry.value}
                          </p>

                          {/* Content highlights linked to this evidence */}
                          {entry.highlights.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {entry.highlights.map((h, i) => (
                                <div
                                  key={i}
                                  className="text-xs px-2 py-1 rounded bg-white/5 border border-white/8"
                                >
                                  <span className={`font-medium ${
                                    h.status === "good" ? "text-green-400"
                                    : h.status === "critical" ? "text-red-400"
                                    : h.status === "missing" ? "text-red-400"
                                    : "text-yellow-400"
                                  }`}>
                                    {h.status.toUpperCase()}
                                  </span>
                                  {" "}{h.note}
                                  {h.found && <span className="text-white/50 block mt-0.5 break-all [overflow-wrap:anywhere]">Found: "{h.found}"</span>}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Cited by recommendations */}
                          {entry.citedBy.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="text-[10px] text-white/40">Cited in:</span>
                              {entry.citedBy.map((title, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/60"
                                >
                                  {title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EvidenceLedger;
