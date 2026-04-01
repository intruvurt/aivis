import React, { useState, useEffect } from "react";
import { Shield, CheckCircle2, XCircle, AlertTriangle, ChevronDown, Wrench, Copy, Check } from "lucide-react";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import type { SSFRAuditResult, SSFRFamily, SSFREvidenceItem, SSFRRuleResult, SSFRFixpack, SSFRFixpackAsset } from "../../../shared/types";

interface SSFRPanelProps {
  auditId: string;
}

const FAMILY_LABELS: Record<SSFRFamily, { label: string; color: string }> = {
  source: { label: "Source", color: "#f97316" },
  signal: { label: "Signal", color: "#3b82f6" },
  fact: { label: "Fact", color: "#10b981" },
  relationship: { label: "Relationship", color: "#a855f7" },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

const SSFRPanel: React.FC<SSFRPanelProps> = ({ auditId }) => {
  const [data, setData] = useState<SSFRAuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<SSFRFamily>>(new Set());
  const [expandedFixpacks, setExpandedFixpacks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!auditId) return;
    let cancelled = false;

    const fetchSSFR = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = useAuthStore.getState().token;
        const res = await fetch(`${API_URL}/api/ssfr/${encodeURIComponent(auditId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 404) {
            setData(null);
            setLoading(false);
            return;
          }
          throw new Error("Failed to load SSFR data");
        }
        const json = await res.json();
        if (!cancelled) {
          setData({
            evidence: json.evidence ?? [],
            rule_results: json.rule_results ?? [],
            fixpacks: json.fixpacks ?? [],
            summary: json.summary,
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load SSFR data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSSFR();
    return () => { cancelled = true; };
  }, [auditId]);

  const toggleFamily = (family: SSFRFamily) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };

  const toggleFixpack = (idx: number) => {
    setExpandedFixpacks(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border p-6" style={{ background: "rgba(10,14,28,0.75)", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Shield className="w-4 h-4 animate-pulse" />
          Loading SSFR analysis...
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const { summary, rule_results, fixpacks } = data;

  const families: SSFRFamily[] = ["source", "signal", "fact", "relationship"];
  const rulesGrouped: Record<SSFRFamily, SSFRRuleResult[]> = { source: [], signal: [], fact: [], relationship: [] };
  for (const r of rule_results) {
    rulesGrouped[r.family]?.push(r);
  }

  return (
    <div className="rounded-2xl border transition-all" style={{ background: "rgba(10,14,28,0.75)", borderColor: "rgba(139,92,246,0.25)" }}>
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-purple-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">SSFR Evidence Audit</h3>
            <p className="text-xs text-white/50 mt-0.5">Source · Signal · Fact · Relationship</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
            {summary.passed_rules}/{summary.total_rules} passed
          </span>
          {summary.hard_blockers > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
              {summary.hard_blockers} blocker{summary.hard_blockers !== 1 ? "s" : ""}
            </span>
          )}
          {summary.effective_score_cap != null && (
            <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
              Cap: {summary.effective_score_cap}
            </span>
          )}
        </div>
      </div>

      {/* Family breakdown bars */}
      <div className="px-6 pb-4 grid grid-cols-4 gap-2">
        {families.map(fam => {
          const s = summary.families[fam];
          if (!s) return null;
          const total = s.passed + s.failed;
          const pct = total > 0 ? Math.round((s.passed / total) * 100) : 0;
          const { label, color } = FAMILY_LABELS[fam];
          return (
            <button
              key={fam}
              onClick={() => toggleFamily(fam)}
              className="rounded-xl p-3 text-left transition-all hover:brightness-110"
              style={{ background: `${color}10`, border: `1px solid ${color}30` }}
            >
              <div className="text-xs font-medium" style={{ color }}>{label}</div>
              <div className="text-lg font-bold text-white mt-1">{pct}%</div>
              <div className="h-1.5 rounded-full mt-2" style={{ background: `${color}20` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
              <div className="text-[10px] text-white/40 mt-1">{s.passed}/{total} rules</div>
            </button>
          );
        })}
      </div>

      {/* Expanded family rule details */}
      {families.map(fam => {
        if (!expandedFamilies.has(fam)) return null;
        const rules = rulesGrouped[fam];
        const { label, color } = FAMILY_LABELS[fam];
        return (
          <div key={`${fam}-rules`} className="px-6 pb-4">
            <div className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${color}20` }}>
              <h4 className="text-xs font-semibold mb-3" style={{ color }}>{label} Rules</h4>
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.rule_id} className="flex items-start gap-2 text-xs">
                    {rule.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-400" />
                    ) : rule.is_hard_blocker ? (
                      <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-yellow-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-white/80">{rule.title}</span>
                      {rule.is_hard_blocker && !rule.passed && rule.score_cap != null && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                          Cap: {rule.score_cap}
                        </span>
                      )}
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${SEVERITY_COLORS[rule.severity]}15`, color: SEVERITY_COLORS[rule.severity] }}>
                        {rule.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Fixpacks */}
      {fixpacks.length > 0 && (
        <div className="px-6 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4 text-white/50" />
            <h4 className="text-xs font-semibold text-white/70">Fixpacks ({fixpacks.length})</h4>
          </div>
          <div className="space-y-2">
            {fixpacks.map((fp, i) => (
              <FixpackCard key={i} fixpack={fp} expanded={expandedFixpacks.has(i)} onToggle={() => toggleFixpack(i)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FixpackCard: React.FC<{ fixpack: SSFRFixpack; expanded: boolean; onToggle: () => void }> = ({ fixpack, expanded, onToggle }) => {
  const color = SEVERITY_COLORS[fixpack.priority] || "#6b7280";

  return (
    <div className="rounded-xl transition-all" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${color}20` }}>
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 text-left">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white/80 truncate">{fixpack.title}</div>
          <div className="text-[10px] text-white/40 mt-0.5">
            {fixpack.type} · {fixpack.auto_generatable ? "auto-generatable" : "manual"} · {fixpack.verification_status}
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-white/30 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <p className="text-xs text-white/60 mt-3 mb-3">{fixpack.summary}</p>
          {fixpack.assets.map((asset, j) => (
            <AssetBlock key={j} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
};

const AssetBlock: React.FC<{ asset: SSFRFixpackAsset }> = ({ asset }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(asset.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="mt-2 rounded-lg overflow-hidden" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <span className="text-[10px] text-white/50 uppercase tracking-wider">{asset.label}</span>
        <button onClick={handleCopy} className="text-white/30 hover:text-white/70 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="text-[11px] text-white/70 p-3 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed font-mono">
        {asset.content}
      </pre>
    </div>
  );
};

export default SSFRPanel;
