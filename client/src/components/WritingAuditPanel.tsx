import React from "react";
import { FileText, CheckCircle2, AlertTriangle, XCircle, ArrowRight, BookOpen, Target, Sparkles, Shield, PenTool } from "lucide-react";
import type { AnalysisResponse } from "@shared/types";

interface WritingAuditPanelProps {
  result: AnalysisResponse;
}

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; description: string }> = {
  keep: { label: "KEEP", color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", description: "Publish as-is. Content is strong." },
  refresh: { label: "REFRESH", color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", description: "Update specific sections, stats, or phrasing." },
  rebuild: { label: "REBUILD", color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", description: "Rewrite from scratch with a new approach." },
  merge: { label: "MERGE", color: "text-blue-300", bg: "bg-blue-500/10", border: "border-blue-500/30", description: "Combine with another piece for better coverage." },
  kill: { label: "KILL", color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30", description: "Archive or delete. Not worth saving." },
};

const FACT_STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  verified: { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, color: "text-emerald-300" },
  unverified: { icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />, color: "text-amber-300" },
  disputed: { icon: <XCircle className="w-3.5 h-3.5 text-red-400" />, color: "text-red-300" },
  missing_source: { icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />, color: "text-orange-300" },
};

function ScoreGauge({ score, label, size = "md" }: { score: number; label: string; size?: "sm" | "md" }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : score >= 40 ? "text-orange-400" : "text-red-400";
  const bgColor = score >= 80 ? "bg-emerald-500/15" : score >= 60 ? "bg-amber-500/15" : score >= 40 ? "bg-orange-500/15" : "bg-red-500/15";
  const borderColor = score >= 80 ? "border-emerald-500/25" : score >= 60 ? "border-amber-500/25" : score >= 40 ? "border-orange-500/25" : "border-red-500/25";
  const barWidth = `${Math.min(100, Math.max(0, score))}%`;

  if (size === "sm") {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] text-white/55 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className={`h-full rounded-full ${score >= 80 ? "bg-emerald-500/60" : score >= 60 ? "bg-amber-500/60" : score >= 40 ? "bg-orange-500/60" : "bg-red-500/60"}`} style={{ width: barWidth }} />
        </div>
        <span className={`text-[11px] font-mono font-medium ${color} shrink-0`}>{score}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-white/65">{label}</span>
        <span className={`text-lg font-mono font-bold ${color}`}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${score >= 80 ? "bg-emerald-500/60" : score >= 60 ? "bg-amber-500/60" : score >= 40 ? "bg-orange-500/60" : "bg-red-500/60"}`} style={{ width: barWidth }} />
      </div>
    </div>
  );
}

const RUBRIC_LABELS: Record<string, { label: string; weight: string }> = {
  content: { label: "Content Quality", weight: "25%" },
  facts: { label: "Factual Integrity", weight: "20%" },
  structure: { label: "Structure", weight: "15%" },
  seo: { label: "SEO Surface", weight: "15%" },
  aeo: { label: "AEO & Citation", weight: "15%" },
  business: { label: "Business Value", weight: "10%" },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: "Blog Post",
  article: "Article",
  ebook: "E-Book / Long-form",
  research: "Research / Whitepaper",
  general: "General Content",
};

const WritingAuditPanel: React.FC<WritingAuditPanelProps> = ({ result }) => {
  const wa = result.writing_audit;
  if (!wa) return null;

  const verdict = VERDICT_CONFIG[wa.verdict] || VERDICT_CONFIG.refresh;
  const [showFullRewrite, setShowFullRewrite] = React.useState(false);

  // Weighted overall rubric score
  const rubricWeighted = wa.rubric_scores
    ? Math.round(
        wa.rubric_scores.content * 0.25 +
        wa.rubric_scores.facts * 0.20 +
        wa.rubric_scores.structure * 0.15 +
        wa.rubric_scores.seo * 0.15 +
        wa.rubric_scores.aeo * 0.15 +
        wa.rubric_scores.business * 0.10
      )
    : null;

  return (
    <div className="space-y-4">
      {/* Header: Content type + Verdict */}
      <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Writing & Editorial Audit</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 text-cyan-300">
              {CONTENT_TYPE_LABELS[wa.content_type] || wa.content_type}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${verdict.border} ${verdict.bg}`}>
            <span className={`text-sm font-bold tracking-wider ${verdict.color}`}>{verdict.label}</span>
          </div>
        </div>
        <p className={`text-sm ${verdict.color} opacity-80`}>{verdict.description}</p>

        {/* Readability */}
        {wa.readability_level && wa.readability_level !== "Unknown" && (
          <div className="mt-3 text-xs text-white/55">
            Readability: <span className="text-white/80 font-medium">{wa.readability_level}</span>
          </div>
        )}
      </div>

      {/* SEO Title + Hook */}
      <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
        <h4 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
          <PenTool className="w-4 h-4 text-white/50" />
          Title & Hook Assessment
        </h4>
        <div className="space-y-3">
          {wa.seo_title && (
            <div className="rounded-lg border border-white/8 bg-charcoal/40 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-white/45">Suggested SEO Title</span>
                <span className={`text-xs font-mono font-medium ${wa.seo_title_score >= 70 ? "text-emerald-400" : wa.seo_title_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                  {wa.seo_title_score}/100
                </span>
              </div>
              <p className="text-sm text-white/90">{wa.seo_title}</p>
            </div>
          )}
          {wa.hook && (
            <div className="rounded-lg border border-white/8 bg-charcoal/40 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-white/45">Suggested Hook</span>
                <span className={`text-xs font-mono font-medium ${wa.hook_score >= 70 ? "text-emerald-400" : wa.hook_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                  {wa.hook_score}/100
                </span>
              </div>
              <p className="text-sm text-white/90 leading-relaxed">{wa.hook}</p>
            </div>
          )}
        </div>
      </div>

      {/* Weighted Rubric Scores */}
      {wa.rubric_scores && (
        <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Target className="w-4 h-4 text-white/50" />
              7-Pass Rubric Breakdown
            </h4>
            {rubricWeighted !== null && (
              <span className={`text-lg font-mono font-bold ${rubricWeighted >= 80 ? "text-emerald-400" : rubricWeighted >= 60 ? "text-amber-400" : rubricWeighted >= 40 ? "text-orange-400" : "text-red-400"}`}>
                {rubricWeighted}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {Object.entries(RUBRIC_LABELS).map(([key, meta]) => {
              const score = (wa.rubric_scores as Record<string, number>)?.[key] ?? 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] text-white/40 w-8 shrink-0">{meta.weight}</span>
                  <div className="flex-1">
                    <ScoreGauge score={score} label={meta.label} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Intelligence Scores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ScoreGauge score={wa.de_ai_score} label="De-AI Score" />
        <ScoreGauge score={wa.information_gain_score ?? 0} label="Information Gain" />
        <ScoreGauge score={wa.citation_readiness_score ?? 0} label="Citation Ready" />
        {wa.entity_clarity && <ScoreGauge score={wa.entity_clarity.score} label="Entity Clarity" />}
      </div>

      {/* Entity Clarity Detail */}
      {wa.entity_clarity && (wa.entity_clarity.name || wa.entity_clarity.what) && (
        <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
          <h4 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white/50" />
            Entity Clarity Check
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {wa.entity_clarity.name && (
              <div className="rounded-lg border border-white/8 bg-charcoal/40 p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-white/40">NAME</span>
                <p className="text-sm text-white/85 mt-0.5">{wa.entity_clarity.name}</p>
              </div>
            )}
            {wa.entity_clarity.what && (
              <div className="rounded-lg border border-white/8 bg-charcoal/40 p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-white/40">WHAT</span>
                <p className="text-sm text-white/85 mt-0.5">{wa.entity_clarity.what}</p>
              </div>
            )}
            {wa.entity_clarity.who && (
              <div className="rounded-lg border border-white/8 bg-charcoal/40 p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-white/40">WHO</span>
                <p className="text-sm text-white/85 mt-0.5">{wa.entity_clarity.who}</p>
              </div>
            )}
            {wa.entity_clarity.why && (
              <div className="rounded-lg border border-white/8 bg-charcoal/40 p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-white/40">WHY</span>
                <p className="text-sm text-white/85 mt-0.5">{wa.entity_clarity.why}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fact Integrity */}
      {wa.fact_check_items && wa.fact_check_items.length > 0 && (
        <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
          <h4 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-white/50" />
            Fact Integrity ({wa.fact_check_items.length} claims)
          </h4>
          <div className="space-y-2">
            {wa.fact_check_items.map((item, i) => {
              const cfg = FACT_STATUS_CONFIG[item.status] || FACT_STATUS_CONFIG.unverified;
              return (
                <div key={i} className="rounded-lg border border-white/8 bg-charcoal/40 p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">{cfg.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-white/85">{item.claim}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] uppercase font-medium ${cfg.color}`}>{item.status.replace("_", " ")}</span>
                        {item.note && <span className="text-[11px] text-white/45">{item.note}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Freshness + De-AI Findings */}
      {((wa.freshness_findings && wa.freshness_findings.length > 0) || (wa.de_ai_findings && wa.de_ai_findings.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {wa.freshness_findings && wa.freshness_findings.length > 0 && (
            <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
              <h4 className="text-xs font-semibold text-white/65 uppercase tracking-wider mb-2">Freshness Findings</h4>
              <ul className="space-y-1.5">
                {wa.freshness_findings.map((f, i) => (
                  <li key={i} className="text-sm text-white/75 flex items-start gap-2">
                    <span className="text-white/30 mt-0.5 shrink-0">-</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {wa.de_ai_findings && wa.de_ai_findings.length > 0 && (
            <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
              <h4 className="text-xs font-semibold text-white/65 uppercase tracking-wider mb-2">De-AI Findings</h4>
              <ul className="space-y-1.5">
                {wa.de_ai_findings.map((f, i) => (
                  <li key={i} className="text-sm text-white/75 flex items-start gap-2">
                    <span className="text-white/30 mt-0.5 shrink-0">-</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Chunking Issues */}
      {wa.chunking_issues && wa.chunking_issues.length > 0 && (
        <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
          <h4 className="text-xs font-semibold text-white/65 uppercase tracking-wider mb-2">
            Chunking Issues ({wa.chunking_issues.length})
          </h4>
          <p className="text-[11px] text-white/40 mb-2">Paragraphs or sections exceeding 150 words without a structural break, reducing AI extractability.</p>
          <ul className="space-y-1.5">
            {wa.chunking_issues.map((c, i) => (
              <li key={i} className="text-sm text-orange-300/80 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400/60 mt-0.5 shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rewrite Diff Viewer */}
      {wa.rewrite && wa.rewrite.diff && wa.rewrite.diff.length > 0 && (
        <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white/50" />
              Editorial Diff ({wa.rewrite.diff.length} fixes)
            </h4>
            <div className="flex items-center gap-2">
              {wa.rewrite.no_emdash_passed && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">No em-dashes</span>
              )}
            </div>
          </div>
          <div className="space-y-2.5">
            {wa.rewrite.diff.map((d, i) => (
              <div key={i} className="rounded-lg border border-white/8 bg-charcoal/40 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-white/50 uppercase">{d.type}</span>
                  <span className="text-[11px] text-white/40">{d.reason}</span>
                </div>
                {d.original && (
                  <div className="text-sm text-red-300/70 line-through mb-1 pl-2 border-l-2 border-red-500/20">{d.original}</div>
                )}
                {d.revised && (
                  <div className="text-sm text-emerald-300/85 pl-2 border-l-2 border-emerald-500/30 flex items-start gap-1.5">
                    <ArrowRight className="w-3 h-3 mt-1 shrink-0 text-emerald-500/50" />
                    <span>{d.revised}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Full Rewrite toggle */}
          {wa.rewrite.rewritten_text && (
            <div className="mt-3">
              <button
                onClick={() => setShowFullRewrite((v) => !v)}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {showFullRewrite ? "Hide full rewrite" : "Show full rewrite"}
              </button>
              {showFullRewrite && (
                <div className="mt-2 rounded-lg border border-white/10 bg-charcoal/60 p-4 text-sm text-white/80 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {wa.rewrite.rewritten_text}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WritingAuditPanel;
