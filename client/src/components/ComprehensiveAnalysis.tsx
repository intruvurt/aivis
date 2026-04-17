// client/src/components/ComprehensiveAnalysis.tsx
//
// Strict 2-column audit layout: MAIN (content) | RIGHT (fix/context rail).
// The left nav sidebar is handled externally by AppLayout/AppSidebar.
//
// Layout rules:
// 1. Grid = grid-cols-[minmax(0,1fr)_392px] on xl+
// 2. Main: header strip → score card → metrics row → category grid → issues TABLE
// 3. Right panel: fix opportunity, fix flow, active fix card, secondary fixes, verdict
// 4. Issues = table rows, never stacked marketing cards
// 5. Score content left-aligned, never centered

import React from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Clock3,
  Download, GitPullRequest, RefreshCw, Zap, Target, ArrowRight,
} from "lucide-react";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useCountUp } from "../hooks/useCountUp";
import DocumentGenerator from "./DocumentGenerator";
import CryptoIntelligencePanel from "./CryptoIntelligencePanel";
import ThreatIntelBanner from "./ThreatIntelBanner";
import WritingAuditPanel from "./WritingAuditPanel";
import SSFRPanel from "./SSFRPanel";
import AutoScoreFixWidget from "./AutoScoreFixWidget";
import AutoScoreFixModal from "./AutoScoreFixModal";
import { RecommendationList } from "./RecommendationList";
import AIAnswerReality from "./AIAnswerReality";
import FixImpactSimulator from "./FixImpactSimulator";
import { getAnalysisExecutionClass, type AnalysisResponse, type CanonicalTier, type LegacyTier } from "@shared/types";
import { canAccess } from "@shared/entitlements";
import { Link } from "react-router-dom";
import CollapsibleSection from "./CollapsibleSection";

// ── Types ────────────────────────────────────────────────────────

interface ComprehensiveAnalysisProps {
  result: AnalysisResponse;
  tier?: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function toneClasses(score: number) {
  if (score >= 80) return { bar: "bg-emerald-400", badge: "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20", label: "Excellent" };
  if (score >= 65) return { bar: "bg-amber-400", badge: "bg-amber-400/10 text-amber-300 border border-amber-400/20", label: "Moderate" };
  return { bar: "bg-rose-400", badge: "bg-rose-400/10 text-rose-300 border border-rose-400/20", label: "Weak" };
}

function severityClasses(sev: string) {
  const s = sev?.toUpperCase() ?? "";
  if (s === "CRITICAL" || s === "HIGH") return "bg-rose-400/10 text-rose-300 border border-rose-400/20";
  if (s === "MED" || s === "MEDIUM") return "bg-amber-400/10 text-amber-300 border border-amber-400/20";
  return "bg-cyan-400/10 text-cyan-300 border border-cyan-400/20";
}

function scoreLevel(score: number) {
  if (score >= 80) return { label: "Strong Visibility", color: "text-emerald-300" };
  if (score >= 65) return { label: "Moderate Gaps", color: "text-amber-300" };
  if (score >= 40) return { label: "Needs Work", color: "text-rose-300" };
  return { label: "Critical Gaps", color: "text-rose-400" };
}

function executionBadge(cls: string) {
  if (cls === "LIVE") return { label: "LIVE PIPELINE", cn: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" };
  if (cls === "DETERMINISTIC_FALLBACK") return { label: "FALLBACK", cn: "border-amber-500/35 bg-amber-500/10 text-amber-300" };
  if (cls === "SCRAPE_ONLY") return { label: "SCRAPE-ONLY", cn: "border-red-500/35 bg-red-500/10 text-red-300" };
  return { label: "UPLOAD", cn: "border-cyan-500/35 bg-cyan-500/10 text-cyan-300" };
}

const GATE_LABELS: Record<string, string> = {
  gate_metadata_integrity: "Metadata Integrity",
  gate_structural_extractability: "Structural Extractability",
  gate_cross_platform_parity: "Cross-platform Parity",
  gate_content_depth: "Content Depth",
  gate_schema_coverage: "Schema Coverage",
  gate_technical_trust: "Technical Trust",
  gate_citation_readiness: "Citation Readiness",
  gate_heading_structure: "Heading Structure",
  gate_ai_readability: "AI Readability",
};

function humanizeGateId(id: string): string {
  return GATE_LABELS[id] ?? id.replace(/^gate_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ────────────────────────────────────────────────────

const ComprehensiveAnalysis: React.FC<ComprehensiveAnalysisProps> = ({ result, tier = "observer" }) => {
  const [showAllIssues, setShowAllIssues] = React.useState(false);
  const [autoFixOpen, setAutoFixOpen] = React.useState(false);
  const [expandedFixId, setExpandedFixId] = React.useState<string | null>(null);
  const scrollRef = useScrollReveal<HTMLDivElement>();
  const animatedScore = useCountUp(result.visibility_score, 900);

  // Tier
  const normalizedTier: CanonicalTier | LegacyTier =
    (["observer", "starter", "alignment", "signal", "scorefix", "free", "core", "premium"] as const).includes(tier as any)
      ? (tier as CanonicalTier | LegacyTier)
      : "observer";

  const hasAlignment = canAccess("fullEvidence", normalizedTier) === true;
  const hasSignal = canAccess("citationTracking", normalizedTier) === true;
  const isUploadResult = (result as any).source_type === "upload" || (result.url || "").startsWith("upload://");

  // Data extraction
  const contentWordCount = result.content_analysis?.word_count || 0;
  const schemaCount = result.schema_markup?.json_ld_count || 0;
  const hasCanonical = result.technical_signals?.has_canonical || false;
  const hasHttps = result.technical_signals?.https_enabled || false;
  const recommendationCount = result.recommendations?.length || 0;
  const executionClass = getAnalysisExecutionClass(result);
  const execBadge = executionBadge(executionClass);
  const level = scoreLevel(result.visibility_score);

  const strictRubric = (result as any).strict_rubric;
  const contradictionReport = result.contradiction_report;
  const geoSignalProfile = result.geo_signal_profile;

  // Category grades (max 6)
  const categories = (result.category_grades || []).slice(0, 6);

  // Build issue rows - prefer evidence_fix_plan, fall back to recommendations
  const issueRows: Array<{
    id: string;
    severity: string;
    title: string;
    description: string;
    fix: string;
    lift?: string;
    evidenceIds: string[];
    evidenceExcerpt?: string;
  }> =
    result.evidence_fix_plan?.issues.length
      ? result.evidence_fix_plan.issues.map((iss) => ({
          id: iss.id,
          severity: iss.severity as string,
          title: iss.finding,
          description: iss.finding,
          fix: iss.actual_fix,
          lift: undefined,
          evidenceIds: Array.isArray(iss.evidence_ids) ? iss.evidence_ids : [],
          evidenceExcerpt: iss.evidence_excerpt,
        }))
      : (result.recommendations || []).map((rec, i) => ({
          id: `rec-${i}`,
          severity: rec.priority || "medium",
          title: rec.title || `Issue ${i + 1}`,
          description: rec.description || rec.impact || "",
          fix: rec.implementation || "",
          lift: undefined,
          evidenceIds: Array.isArray(rec.evidence_ids) ? rec.evidence_ids : [],
          evidenceExcerpt: undefined,
        }));

  const visibleIssues = showAllIssues ? issueRows : issueRows.slice(0, 8);

  // Metrics row
  const metricCards = [
    { label: "Schema Types", value: String(schemaCount), hint: schemaCount > 0 ? "detected" : "none found" },
    { label: "Word Count", value: contentWordCount > 0 ? contentWordCount.toLocaleString() : "-", hint: contentWordCount >= 800 ? "sufficient depth" : contentWordCount > 0 ? "thin content" : "not measured" },
    { label: "Issues Found", value: String(issueRows.length), hint: "visibility blockers" },
    { label: "HTTPS / Canonical", value: hasHttps ? "Enabled" : "Missing", hint: hasCanonical ? "Canonical ✓" : "No canonical" },
  ];

  // Fix panel data
  const totalLift = issueRows.reduce((sum, r) => {
    const n = r.lift ? parseInt(r.lift.replace("+", ""), 10) : 0;
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const topFix = issueRows[0];
  const secondaryFixes = issueRows.slice(1, 4);

  // Upgrade suggestions
  const upgradeSuggestions = [
    { id: "reverse-engineer", title: "Reverse Engineer Tool", description: "Use decompile + model diff to rebuild stronger section structure.", requirement: "alignment" as const, to: "/app/reverse-engineer", show: contentWordCount < 800 || recommendationCount >= 4 },
    { id: "competitors", title: "Competitor Gap Tracking", description: "Compare your score against direct competitors.", requirement: "alignment" as const, to: "/app/competitors", show: result.visibility_score < 70 || schemaCount === 0 },
    { id: "citations", title: "Citation Testing", description: "Run query-level citation tests to verify AI mentions.", requirement: "signal" as const, to: "/app/citations", show: !hasHttps || !hasCanonical || result.visibility_score < 80 },
  ].filter((item) => {
    if (item.requirement === "alignment") return item.show && !hasAlignment;
    return item.show && !hasSignal;
  });

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div ref={scrollRef} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_392px] gap-0 items-start">

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main className="min-w-0 overflow-y-auto space-y-6 pb-8">

        {/* 1. HEADER STRIP - not a card */}
        <section className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <h1 className="truncate text-[26px] font-semibold tracking-tight text-white">
                {result.url?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || "Audit Result"}
              </h1>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${execBadge.cn}`}>
                {execBadge.label}
              </span>
              {result.triple_check_summary && (
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-300">
                  Triple-Check ✓
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/45">
              <span>{new Date(result.analyzed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              {contentWordCount > 0 && <span>{contentWordCount.toLocaleString()} words</span>}
              {result.cached && <span>Cached</span>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link to="/app/analyze" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/72 transition hover:bg-white/[0.06]">
              <RefreshCw className="h-4 w-4" /> Re-audit
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/72 transition hover:bg-white/[0.06]">
              <Download className="h-4 w-4" /> Export
            </button>
            {hasAlignment && (
              <button
                type="button"
                onClick={() => setAutoFixOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.18)] transition hover:scale-[1.01]"
              >
                <GitPullRequest className="h-4 w-4" /> Fix Automatically
              </button>
            )}
          </div>
        </section>

        {/* 2. SCORE BLOCK - one big card, left-aligned */}
        <section className="reveal rounded-[22px] border border-white/10 bg-white/[0.04] p-6">
          <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-6">
            <div className="flex flex-col justify-center">
              <div className="text-[60px] font-semibold leading-none tracking-tight text-white animate-score-pop">
                {animatedScore}
              </div>
              <div className={`mt-2 text-sm font-medium ${level.color}`}>{level.label}</div>
              {totalLift > 0 && <div className="mt-2 text-sm text-emerald-300">+{totalLift} pts available</div>}
            </div>
            <div className="flex flex-col justify-center">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-white/55">AI Visibility Score</span>
                <span className="text-white/70">{result.visibility_score} / 100</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 bar-grow-origin animate-bar-grow" style={{ width: `${result.visibility_score}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-white/32">
                <span>Needs Work</span><span>Moderate</span><span>Strong</span><span>Excellent</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. METRICS ROW - 4 cards inline */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metricCards.map((card, i) => (
            <div key={card.label} className="reveal card-lift rounded-2xl border border-white/10 bg-white/[0.04] p-4" data-delay={i + 1}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/34">{card.label}</div>
              <div className="mt-2 text-xl font-semibold text-white">{card.value}</div>
              <div className="mt-2 text-sm text-white/42">{card.hint}</div>
            </div>
          ))}
        </section>

        {/* 3b. AI ANSWER REALITY CHECK - the "oh shit" moment */}
        {result.ai_platform_scores && (
          <AIAnswerReality
            scores={result.ai_platform_scores}
            url={result.url || ''}
            brandEntities={result.brand_entities || []}
            topicalKeywords={result.topical_keywords || []}
          />
        )}

        {/* 4. CATEGORY GRID - up to 6 cards, 3 cols */}
        {categories.length > 0 && (
          <section className="reveal">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-white">Score by Category</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat, i) => {
                const tone = toneClasses(cat.score);
                const fixCount = cat.improvements?.length ?? 0;
                return (
                  <div key={cat.label} className="reveal card-lift rounded-2xl border border-white/10 bg-white/[0.04] p-4" data-delay={i + 1}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium text-white/80">{cat.label}</div>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.badge}`}>{tone.label}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl font-semibold text-white">{cat.score}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full bar-grow-origin animate-bar-grow ${tone.bar}`} style={{ width: `${cat.score}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] text-white/40">{fixCount} fix{fixCount !== 1 ? "es" : ""} suggested</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Threat intelligence banner */}
        {result.threat_intel && <ThreatIntelBanner data={result.threat_intel} />}

        {/* 5. PRIORITY ISSUES - TABLE rows */}
        <section className="reveal rounded-[22px] border border-white/10 bg-white/[0.04]">
          <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-white">Priority Issues</h2>
            <span className="text-[11px] text-white/35">{issueRows.length} total</span>
          </div>

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[100px_minmax(0,1fr)_minmax(0,220px)_110px] items-center gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/33">
            <div>Severity</div><div>Claim</div><div>Evidence / Fix</div><div>Action</div>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-white/10">
            {visibleIssues.map((issue) => (
              <div key={issue.id} className="grid grid-cols-1 sm:grid-cols-[100px_minmax(0,1fr)_minmax(0,220px)_110px] items-start gap-4 px-5 py-4 transition hover:bg-white/[0.025]">
                <div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${severityClasses(issue.severity)}`}>
                    {(issue.severity || "MED").toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">{issue.title}</div>
                  {issue.description && <div className="mt-1 text-xs text-white/45">{issue.description}</div>}
                </div>
                <div>
                  {issue.evidenceIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {issue.evidenceIds.slice(0, 3).map((id) => (
                        <span key={id} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100/85">
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-white/55">{issue.evidenceExcerpt || issue.fix || "Review the full report for fix detail."}</div>
                </div>
                <div>
                  {hasAlignment ? (
                    <button
                      type="button"
                      onClick={() => setAutoFixOpen(true)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
                    >
                      Fix this
                    </button>
                  ) : (
                    <Link to="/app/score-fix" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]">View fix</Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {issueRows.length > 8 && (
            <div className="border-t border-white/10 px-5 py-3">
              <button onClick={() => setShowAllIssues((v) => !v)} className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors">
                {showAllIssues ? "Show less" : `Show all ${issueRows.length} issues`}
              </button>
            </div>
          )}
        </section>

        {/* Upload-specific panels */}
        {isUploadResult && (result as any).upload_analysis_mode === "writing_audit" && (result as any).writing_audit && (
          <WritingAuditPanel result={result} />
        )}

        {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
          <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">Evidence-Backed Fixes</h2>
                <p className="mt-1 text-sm text-white/52">Each recommendation is tied to BRAG evidence or marked advisory when evidence links are absent.</p>
              </div>
              {hasAlignment && (
                <button
                  type="button"
                  onClick={() => setAutoFixOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  <GitPullRequest className="h-4 w-4" /> Fix these automatically
                </button>
              )}
            </div>
            <RecommendationList recommendations={result.recommendations} tier={normalizedTier} />
          </section>
        )}

        {/* GEO / SSFR Truth Layer */}
        {(geoSignalProfile || contradictionReport) && (
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-xs uppercase tracking-wider text-white/50 font-semibold">GEO / SSFR Truth Layer</p>
              {contradictionReport && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                  (contradictionReport as any).status === "clean" ? "border-emerald-500/35 text-emerald-300"
                    : (contradictionReport as any).status === "critical" ? "border-rose-500/35 text-rose-300"
                    : "border-amber-500/35 text-amber-300"
                }`}>
                  {(contradictionReport as any).status?.toUpperCase()} · {(contradictionReport as any).blocker_count} blockers
                </span>
              )}
            </div>
            {strictRubric?.required_fixpacks?.length > 0 && (
              <div className="space-y-2">
                {strictRubric.required_fixpacks.map((pack: any) => (
                  <div key={pack.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-medium text-white/75 truncate">{pack.label}</p>
                      <span className="text-[10px] text-emerald-400 font-semibold">+{pack.estimated_score_lift_min}–{pack.estimated_score_lift_max}</span>
                    </div>
                    <p className="text-[10px] text-white/35">{pack.target_gate_ids?.map(humanizeGateId).join(", ")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upgrade suggestions */}
        {upgradeSuggestions.length > 0 && (
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-4 h-4 text-white/60" />
              <h3 className="text-sm font-semibold text-white">Unlock deeper intelligence</h3>
            </div>
            <div className="space-y-3">
              {upgradeSuggestions.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-white/55 mt-1">{item.description}</p>
                  </div>
                  <Link to={item.to} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors">
                    Learn more <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SSFR / Crypto / Export */}
        {result.audit_id && <SSFRPanel auditId={result.audit_id} />}
        {result.crypto_intelligence && <CryptoIntelligencePanel data={result.crypto_intelligence} />}
        <CollapsibleSection title="Export & Reports" description="PDF, DOCX, Markdown, share link" icon={Download} defaultOpen={false}>
          <DocumentGenerator result={result} />
        </CollapsibleSection>
      </main>

      {/* ═══════ RIGHT PANEL - fix/context rail ═══════ */}
      <aside className="hidden xl:flex h-full flex-col border-l border-white/10 bg-[#0a1220] px-5 py-6 sticky top-0 self-start max-h-screen overflow-y-auto">

        {result.audit_id && hasAlignment && (
          <div className="mb-5">
            <AutoScoreFixWidget auditResult={result} onOpen={() => setAutoFixOpen(true)} />
          </div>
        )}

        {/* Fix Impact Simulator - projected improvement */}
        {result.recommendations?.length > 0 && (
          <FixImpactSimulator
            currentScore={result.visibility_score}
            recommendations={result.recommendations}
            onFixClick={() => setAutoFixOpen(true)}
            hasAlignment={hasAlignment}
          />
        )}

        {/* 1. Fix impact */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30">Fix Opportunity</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-300">{totalLift > 0 ? `+${totalLift} pts` : "-"}</div>
          <div className="mt-1 text-sm text-white/42">{totalLift > 0 ? `Available from ${Math.min(issueRows.length, 5)} safe changes` : "No estimated lift data"}</div>
        </div>

        {/* 2. Fix flow - detect → plan → PR → verify */}
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs">
          <div className="flex flex-col items-center gap-1 text-cyan-300"><CheckCircle2 className="h-4 w-4" /><span>Scan</span></div>
          <div className="h-px flex-1 bg-white/10" />
          <div className="flex flex-col items-center gap-1 text-white/40"><Clock3 className="h-4 w-4" /><span>Expose</span></div>
          <div className="h-px flex-1 bg-white/10" />
          <div className="flex flex-col items-center gap-1 text-white/40"><GitPullRequest className="h-4 w-4" /><span>Fix</span></div>
          <div className="h-px flex-1 bg-white/10" />
          <div className="flex flex-col items-center gap-1 text-white/40"><CheckCircle2 className="h-4 w-4" /><span>Re-scan</span></div>
        </div>

        {/* 3. Active fix card - top priority */}
        {topFix && (
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${severityClasses(topFix.severity)}`}>
                {(topFix.severity || "MED").toUpperCase()}
              </span>
              <span className="text-xs text-white/38">{topFix.fix ? "Auto-fixable" : "Manual review"}</span>
            </div>
            <h3 className="text-base font-semibold text-white">{topFix.title}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/42">
              {topFix.lift && <span>{topFix.lift} pts</span>}
            </div>
            {topFix.fix && (
              <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300/70">Fix</div>
                <p className="text-[12px] leading-5 text-cyan-100/80">{topFix.fix}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setAutoFixOpen(true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.18)] transition hover:scale-[1.01]"
            >
              <GitPullRequest className="h-4 w-4" /> Fix this automatically
            </button>
          </div>
        )}

        {/* 4. Secondary fixes */}
        {secondaryFixes.length > 0 && (
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 mb-5">
            <div className="mb-3 text-sm font-semibold text-white">Next Highest ROI Fixes</div>
            <div className="space-y-3">
              {secondaryFixes.map((fix) => (
                <div key={fix.id}>
                  <button
                    onClick={() => setExpandedFixId(expandedFixId === fix.id ? null : fix.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-left transition hover:bg-white/[0.05]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                        <AlertTriangle className="h-4 w-4 text-white/55" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white/84">{fix.title}</div>
                        {fix.lift && <div className="mt-0.5 text-xs text-emerald-300">{fix.lift} pts</div>}
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 text-white/30 transition-transform ${expandedFixId === fix.id ? "rotate-90" : ""}`} />
                  </button>
                  {expandedFixId === fix.id && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs leading-5 text-white/65">
                      {fix.fix ? (
                        <>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/70">Fix</div>
                          <p className="text-cyan-100/80">{fix.fix}</p>
                        </>
                      ) : (
                        <p>{fix.description || "No auto-fix available - manual review recommended."}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Fix plan summary */}
        {result.evidence_fix_plan && result.evidence_fix_plan.issues.length > 0 && (
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Fix Plan</p>
              <span className="text-[11px] text-white/35">
                {result.evidence_fix_plan.mode === "thorough" ? "Thorough" : "Standard"} · {result.evidence_fix_plan.issue_count ?? result.evidence_fix_plan.issues.length} issues
              </span>
            </div>
            <div className="space-y-2.5">
              {result.evidence_fix_plan.issues.slice(0, 5).map((iss) => {
                const s = iss.severity?.toLowerCase() ?? "";
                const dot = s === "critical" || s === "high" ? "bg-red-500" : s === "medium" ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={iss.id} className="flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80">{iss.finding}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">{iss.actual_fix}</p>
                    </div>
                  </div>
                );
              })}
              {result.evidence_fix_plan.issues.length > 5 && (
                <p className="text-[11px] text-white/30 pl-4">+{result.evidence_fix_plan.issues.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        {/* 6. Verdict summary */}
        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 text-sm font-semibold text-white">Verdict</div>
          <p className="text-sm text-white/65 mb-3">
            Score <strong className="text-white">{result.visibility_score}/100</strong> - {level.label}.{" "}
            Citation readiness: <strong className="text-white">{result.visibility_score >= 70 ? "Moderate" : "Weak"}</strong>.
          </p>
          {issueRows.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/40 mb-1.5">Top blockers</p>
              <ul className="space-y-1">
                {issueRows.slice(0, 3).map((iss) => (
                  <li key={iss.id} className="text-xs flex items-start gap-1.5 text-white/65">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5 text-white/40" />
                    <span>{iss.title}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* 7. Competitive pressure teaser */}
        {result.visibility_score < 80 && !hasAlignment && (
          <div className="mt-5 rounded-[22px] border border-amber-500/15 bg-amber-500/[0.05] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Your competitors may be ahead</span>
            </div>
            <p className="text-xs text-white/55 leading-relaxed mb-3">
              Sites in your category scoring above {Math.min(result.visibility_score + 20, 85)} are more likely to be cited by AI. Track and compare against direct competitors.
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
            >
              Unlock competitor tracking <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
        {hasAlignment && result.visibility_score < 80 && (
          <div className="mt-5 rounded-[22px] border border-amber-500/15 bg-amber-500/[0.05] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Check your competitive position</span>
            </div>
            <p className="text-xs text-white/55 leading-relaxed mb-3">
              AI is recommending someone. Find out who — and what they are doing differently.
            </p>
            <Link
              to="/app/competitors"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
            >
              Compare competitors <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </aside>

      <AutoScoreFixModal open={autoFixOpen} onClose={() => setAutoFixOpen(false)} auditResult={result} />
    </div>
  );
};

export default ComprehensiveAnalysis;