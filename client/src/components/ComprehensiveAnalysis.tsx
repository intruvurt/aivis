// client/src/components/ComprehensiveAnalysis.tsx
import React from "react";
import { AlertCircle, CheckCircle2, TrendingUp, Zap, Target, Eye, ArrowRight, Download } from "lucide-react";
import DocumentGenerator from "./DocumentGenerator";
import CryptoIntelligencePanel from "./CryptoIntelligencePanel";
import ThreatIntelBanner from "./ThreatIntelBanner";
import WritingAuditPanel from "./WritingAuditPanel";
import SSFRPanel from "./SSFRPanel";
import { getAnalysisExecutionClass, type AnalysisExecutionClass, type AnalysisResponse, type CanonicalTier, type LegacyTier } from "@shared/types";
import { canAccess } from "@shared/entitlements";
import { toAuditReport } from "@shared/domain";
import { Link } from "react-router-dom";
import CollapsibleSection from "./CollapsibleSection";

interface ComprehensiveAnalysisProps {
  result: AnalysisResponse;
  tier?: string;
}

interface KeyPoint {
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  impact: string;
}

// ── Structured analysis types ────────────────────────────────────

// Human-readable labels for rubric gate IDs
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
  return GATE_LABELS[id] ?? id.replace(/^gate_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Generate prioritized keypoints
function generateKeypoints(result: AnalysisResponse): KeyPoint[] {
  const keypoints: KeyPoint[] = [];
  const contentData = result.content_analysis;
  const schemaData = result.schema_markup;
  const technicalData = result.technical_signals;

  // Critical issues first
  const hasH1 = contentData?.has_proper_h1 || false;
  const wordCount = contentData?.word_count || 0;
  const hasSchema = (schemaData?.json_ld_count ?? 0) > 0;
  const hasHTTPS = technicalData?.https_enabled || false;

  if (!hasH1) {
    keypoints.push({
      priority: "critical",
      title: "Add H1 Heading Tag",
      description: "Your page is missing an H1 tag, which is critical for AI systems to understand your content's main topic.",
      impact: "AI search engines rely heavily on H1 tags to determine topical relevance. Without it, your content is invisible to most AI-powered searches."
    });
  }

  if (!hasSchema || (schemaData?.json_ld_count || 0) === 0) {
    keypoints.push({
      priority: "critical",
      title: "Implement Structured Data (Schema.org)",
      description: "Add JSON-LD structured data to explicitly tell AI systems what your content is about.",
      impact: "Structured data is one of the highest-impact citation readiness factors. It's the difference between being understood and being ignored by AI search engines."
    });
  }

  if (wordCount < 300) {
    keypoints.push({
      priority: "critical",
      title: "Expand Content Depth Significantly",
      description: `Your content is critically thin at ${wordCount} words. AI systems heavily favor comprehensive content (800-1200+ words).`,
      impact: "Thin content is rarely cited by AI assistants. Expanding to 800+ words with valuable information will dramatically improve visibility."
    });
  }

  if (!hasHTTPS) {
    keypoints.push({
      priority: "high",
      title: "Enable HTTPS Encryption",
      description: "Your site is not using HTTPS, which is a major trust and security signal for AI systems and users.",
      impact: "Non-HTTPS sites are deprioritized by AI search engines. Enabling HTTPS is a quick win for trust and ranking."
    });
  }

  if (wordCount >= 300 && wordCount < 800) {
    keypoints.push({
      priority: "high",
      title: "Increase Content Comprehensiveness",
      description: `Your ${wordCount}-word content is good but below optimal length. AI systems prefer 800-1200+ word comprehensive guides.`,
      impact: "Longer, more comprehensive content is generally easier for AI search engines to cite when it clearly answers user intent."
    });
  }

  const hasCanonical = technicalData?.has_canonical || false;
  if (!hasCanonical) {
    keypoints.push({
      priority: "medium",
      title: "Add Canonical Tags",
      description: "Implement canonical tags to tell AI systems which version of your content is authoritative.",
      impact: "Prevents duplicate content confusion and ensures AI systems cite the correct page version."
    });
  }

  // Add AI platform-specific optimization if score is low
  if (result.visibility_score < 60) {
    keypoints.push({
      priority: "high",
      title: "Optimize for Question-Answer Format",
      description: "Restructure content to directly answer common user questions. AI systems prioritize clear, concise answers.",
      impact: "Q&A formatted content significantly improves answer extractability across ChatGPT, Perplexity, and Google AI Overviews."
    });
  }

  // Return all generated keypoints — dedupe by title, sorted by priority (critical → high → medium)
  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2 };
  const seen = new Set<string>();
  return keypoints
    .filter(kp => {
      const key = kp.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
}

// Score interpretation helper
function getScoreInterpretation(score: number): { level: string; color: string; icon: React.ReactNode } {
  if (score >= 80) {
    return {
      level: "Excellent",
      color: "text-white/80 bg-charcoal border-white/10",
      icon: <CheckCircle2 className="w-6 h-6 text-white/80" />
    };
  }
  if (score >= 60) {
    return {
      level: "Good",
      color: "text-white/85 bg-charcoal/10 border-white/12/30",
      icon: <TrendingUp className="w-6 h-6 text-white/85" />
    };
  }
  if (score >= 40) {
    return {
      level: "Needs Improvement",
      color: "text-white/80 bg-charcoal border-white/10",
      icon: <Eye className="w-6 h-6 text-white/80" />
    };
  }
  return {
    level: "Critical",
    color: "text-white/80 bg-charcoal border-white/10",
    icon: <AlertCircle className="w-6 h-6 text-white/80" />
  };
}

function getExecutionClassPresentation(executionClass: AnalysisExecutionClass): { label: string; className: string } {
  if (executionClass === "LIVE") {
    return { label: "LIVE PIPELINE", className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" };
  }
  if (executionClass === "DETERMINISTIC_FALLBACK") {
    return { label: "DETERMINISTIC FALLBACK", className: "border-amber-500/35 bg-amber-500/10 text-amber-300" };
  }
  if (executionClass === "SCRAPE_ONLY") {
    return { label: "SCRAPE-ONLY", className: "border-red-500/35 bg-red-500/10 text-red-300" };
  }
  return { label: "UPLOAD ANALYSIS", className: "border-cyan-500/35 bg-cyan-500/10 text-cyan-300" };
}

const ComprehensiveAnalysis: React.FC<ComprehensiveAnalysisProps> = ({ result, tier = "observer" }) => {
  const keypoints = generateKeypoints(result);
  const scoreInfo = getScoreInterpretation(result.visibility_score);
  const executionClass = getAnalysisExecutionClass(result);
  const executionPresentation = getExecutionClassPresentation(executionClass);
  const isUploadResult = result.source_type === "upload" || (result.url || "").startsWith("upload://");
  const [showAllFixPlanIssues, setShowAllFixPlanIssues] = React.useState(false);
  const [showAllContradictions, setShowAllContradictions] = React.useState(false);
  const normalizedTier: CanonicalTier | LegacyTier =
    tier === "observer" ||
    tier === "alignment" ||
    tier === "signal" ||
    tier === "scorefix" ||
    tier === "free" ||
    tier === "core" ||
    tier === "premium"
      ? tier
      : "observer";

  const fullEvidenceAccess = canAccess("fullEvidence", normalizedTier);
  const competitorTrackingAccess = canAccess("competitorTracking", normalizedTier);
  const citationTrackingAccess = canAccess("citationTracking", normalizedTier);
  const hasAlignment = fullEvidenceAccess === true;
  const hasSignal = citationTrackingAccess === true;
  const auditReport = toAuditReport(result);

  const contentWordCount = result.content_analysis?.word_count || 0;
  const schemaCount = result.schema_markup?.json_ld_count || 0;
  const hasCanonical = result.technical_signals?.has_canonical || false;
  const hasHttps = result.technical_signals?.https_enabled || false;
  const recommendationCount = result.recommendations?.length || 0;
  const strictRubric = result.strict_rubric;
  const contradictionReport = result.contradiction_report;
  const geoSignalProfile = result.geo_signal_profile;

  const upgradeSuggestions = [
    {
      id: "reverse-engineer",
      title: "Reverse Engineer Tool",
      description: "Use decompile + model diff to rebuild stronger section structure for low-depth or unclear content.",
      requirement: "alignment" as const,
      to: "/reverse-engineer",
      show: contentWordCount < 800 || recommendationCount >= 4,
    },
    {
      id: "competitors",
      title: "Competitor Gap Tracking",
      description: "Compare your score against direct competitors to prioritize the highest-impact schema and content gaps.",
      requirement: "alignment" as const,
      to: "/competitors",
      show: result.visibility_score < 70 || schemaCount === 0,
    },
    {
      id: "citations",
      title: "Citation Testing",
      description: "Run query-level citation tests to verify if trust and technical fixes are actually improving AI mentions.",
      requirement: "signal" as const,
      to: "/citations",
      show: !hasHttps || !hasCanonical || result.visibility_score < 80,
    },
  ].filter((item) => {
    if (item.requirement === "alignment") return item.show && !hasAlignment;
    return item.show && !hasSignal;
  });

  const priorityConfig = {
    critical: { bg: "bg-red-950/60", border: "border-red-500/40", text: "text-red-300", label: "Critical Priority" },
    high: { bg: "bg-orange-950/60", border: "border-orange-500/40", text: "text-orange-300", label: "High Priority" },
    medium: { bg: "bg-amber-950/60", border: "border-amber-500/40", text: "text-amber-300", label: "Medium Priority" }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1 — VERDICT */}
      <div className="rounded-xl border border-white/10 bg-charcoal/40 p-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-300 mb-2">Verdict</p>
        <h2 className="text-xl font-bold text-white mb-1">
          AI can read your site. It doesn’t trust it enough to cite it.
        </h2>
        <p className="text-sm text-white/65">
          AI visibility score: <span className="text-white font-semibold">{result.visibility_score} / 100</span> · Confidence:{" "}
          <span className="text-white font-semibold">{scoreInfo.level}</span> · Citation readiness:{" "}
          <span className="text-white font-semibold">{result.visibility_score >= 70 ? "Moderate" : "Weak"}</span>
        </p>
        {keypoints.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.12em] text-white/45 mb-2">Top blockers</p>
            <ul className="list-disc pl-5 text-sm text-white/75 space-y-1">
              {keypoints.slice(0, 3).map((kp) => (
                <li key={`blocker-${kp.title}`}>{kp.title.toLowerCase()}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Overall Score Summary */}
      <div className={`rounded-xl border-2 p-6 ${scoreInfo.color}`}>
        <div className="flex items-center gap-4 mb-4">
          {scoreInfo.icon}
          <div className="flex-1">
            <h3 className="text-xl font-bold">AI Visibility Score: {result.visibility_score}/100</h3>
            <div className="mt-1">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${executionPresentation.className}`}>
                {executionPresentation.label}
              </span>
            </div>
            <p className="text-sm opacity-80 break-all [overflow-wrap:anywhere]">{scoreInfo.level} - {result.url}</p>
          </div>
        </div>
      </div>



      {/* Threat Intelligence — immediately after score */}
      {(result as any).threat_intel && (
        <ThreatIntelBanner data={(result as any).threat_intel} />
      )}

      {!hasAlignment && (
        <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-violet-300 mb-1">Competitor gap preview</p>
          <p className="text-sm text-white/80">
            Competitors with clearer schema + stronger answer structure are more likely to be cited first. Your highest visible gap is in
            <span className="font-semibold text-white"> schema coverage and extractable answer blocks</span>.
          </p>
        </div>
      )}

      {/* SECTION 2 — PROOF */}
      <div className="rounded-xl border border-white/10 bg-charcoal/40 p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-white">What we actually observed</h3>
          <span className="text-[11px] uppercase tracking-[0.12em] text-white/45">Proof layer</span>
        </div>
        {result.evidence_fix_plan?.issues?.length ? (
          <div className="space-y-3">
            {auditReport.blockers.slice(0, 4).map((issue) => (
              <div key={`proof-${issue.id}`} className="rounded-lg border border-white/10 bg-charcoal-light p-3">
                <p className="text-sm font-semibold text-white/90">{issue.title}</p>
                <p className="text-xs text-amber-200/90 mt-1">AI could not confirm what your site represents.</p>
                <p className="text-xs text-white/60 mt-1">Affected pages: {auditReport.domain}</p>
                <p className="text-xs text-white/60 mt-1">Extracted value: {auditReport.evidence.find((ev) => ev.id === issue.evidenceIds[0])?.description || issue.title}</p>
                <p className="text-xs text-white/60 mt-1">Expected value: {issue.fix}</p>
                <p className="text-xs text-white/60 mt-1">Why this matters: AI avoids citing unclear sources.</p>
                <p className="text-xs text-white/60 mt-1">Verified by: {auditReport.evidence.find((ev) => ev.id === issue.evidenceIds[0])?.verifiedBy || "system"}</p>
                <p className="text-xs text-white/45 mt-1">Evidence ID: {issue.evidenceIds?.[0] || issue.id}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/65">
            We did not receive structured proof records for this run. Re-run audit to capture evidence-linked deltas.
          </p>
        )}
      </div>

      {/* SECTION 3 — COMPETITOR GAP */}
      {hasAlignment ? (
        <div className="rounded-xl border border-white/10 bg-charcoal/40 p-5">
          <h3 className="text-lg font-semibold text-white mb-2">Why competitors get cited instead</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-white/45 mb-2">Competitors</p>
              <ul className="list-disc pl-4 text-sm text-white/70 space-y-1">
                <li>appear in answer sources you do not</li>
                <li>stronger entity clarity and extraction cues</li>
                <li>clearer structured answers for retrieval</li>
              </ul>
            </div>
            <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-white/45 mb-2">You</p>
              <ul className="list-disc pl-4 text-sm text-white/70 space-y-1">
                <li>missing source presence on key intents</li>
                <li>weaker extraction signals</li>
                <li>inconsistent metadata trust surface</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-violet-400/25 bg-violet-500/10 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-violet-300 mb-1">🔒 Unlock full competitor intelligence</p>
            <p className="text-sm text-white/70">
              {competitorTrackingAccess === true
                ? "Full competitor intelligence is active on your current plan."
                : "Source-level competitor evidence, citation movement tracking, and full parity detail are available on higher tiers."}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-amber-300 mb-1">Locked section</p>
          <h3 className="text-base font-semibold text-white mb-2">Full evidence + competitor source intelligence</h3>
          <p className="text-sm text-white/65">
            You’ve unlocked the verdict, top blockers, and competitor gap preview. Upgrade to access source-level proof, full evidence ledger, and competitor intelligence over time.
          </p>
        </div>
      )}

      {isUploadResult && result.upload_analysis_mode === 'writing_audit' && result.writing_audit && (
        <WritingAuditPanel result={result} />
      )}

      {isUploadResult && result.upload_analysis_mode !== 'writing_audit' && (
        <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-white font-semibold">Code & Template Analysis</h3>
            <span className="text-[11px] px-2 py-1 rounded-full border border-white/15 bg-charcoal-light text-white/65">AEO / SEO / GEO / Security Scan</span>
          </div>
          <p className="text-sm text-white/60">
            This upload was analyzed as source code or template content. The audit covers deployable SEO signals, structured data opportunities, AI extractability, and security surface — not a full code review.
          </p>
        </div>
      )}



      {/* SECTION 4 — FIX FIRST */}
      <div className="card-charcoal/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-white/80" />
          <h3 className="text-xl font-bold text-white">Fix this first</h3>
        </div>
        <p className="text-xs text-white/55 mb-4">Top 3 actions ranked by impact.</p>

        {result.evidence_fix_plan && result.evidence_fix_plan.issues.length > 0 && (
          <div className="mb-4 rounded-xl border border-white/10 bg-charcoal p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs uppercase tracking-wider text-white/55">Actual Fix Plan</p>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/70">
                {result.evidence_fix_plan.mode === 'thorough' ? 'Thorough' : 'Standard'} · {result.evidence_fix_plan.issue_count} issues
              </span>
            </div>
            <div className="space-y-2.5">
              {(showAllFixPlanIssues ? result.evidence_fix_plan.issues : result.evidence_fix_plan.issues.slice(0, 6)).map((issue) => (
                <div key={issue.id} className="rounded-lg border border-white/10 bg-charcoal-light p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/70 uppercase">{issue.severity}</span>
                    <span className="text-xs text-white/80 font-medium">{issue.area}</span>
                  </div>
                  <p className="text-sm text-white/80">{issue.finding}</p>
                  <p className="text-xs text-white/60 mt-1">Fix: {issue.actual_fix}</p>
                </div>
              ))}
              {result.evidence_fix_plan.issues.length > 6 && (
                <button
                  onClick={() => setShowAllFixPlanIssues((v) => !v)}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors mt-1"
                >
                  {showAllFixPlanIssues ? 'Show less' : `Show all ${result.evidence_fix_plan.issues.length} issues`}
                </button>
              )}
            </div>
          </div>
        )}
        {(geoSignalProfile || contradictionReport) && (
          <div className="mb-4 rounded-xl border border-white/10 bg-charcoal p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-xs uppercase tracking-wider text-white/55">GEO / SSFR Truth Layer</p>
              {contradictionReport && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                  contradictionReport.status === 'clean'
                    ? 'border-emerald-500/35 text-emerald-300'
                    : contradictionReport.status === 'critical'
                      ? 'border-rose-500/35 text-rose-300'
                      : 'border-amber-500/35 text-amber-300'
                }`}>
                  {contradictionReport.status.toUpperCase()} · {contradictionReport.blocker_count} blockers
                </span>
              )}
            </div>

            {strictRubric.required_fixpacks.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
                <p className="text-xs uppercase tracking-wider text-white/55 mb-2">Required Fixpacks</p>
                <div className="space-y-2">
                  {strictRubric.required_fixpacks.map((pack) => (
                    <div key={pack.id} className="rounded-md border border-white/10 bg-charcoal p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <p className="text-sm text-white/80 font-medium">{pack.label}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/65">
                          Lift +{pack.estimated_score_lift_min} to +{pack.estimated_score_lift_max}
                        </span>
                      </div>
                      <p className="text-xs text-white/60">
                        Targets: {pack.target_gate_ids.map(humanizeGateId).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="space-y-4">
          {keypoints.slice(0, 3).map((kp, idx) => {
            const config = priorityConfig[kp.priority];
            return (
              <div
                key={idx}
                className={`rounded-xl border-2 p-4 ${config.border} ${config.bg}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full bg-charcoal-deep flex items-center justify-center font-bold ${config.text}`}>
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className={`font-bold ${config.text}`}>{kp.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${config.border} ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-white/75 text-sm mb-2">{kp.description}</p>
                    <div className="flex items-start gap-2 mt-3 p-3 bg-charcoal rounded-xl">
                      <Zap className="w-4 h-4 text-white/80 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-white/55">
                        <span className="font-semibold text-white">Impact:</span> {kp.impact}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>




      {/* SECTION 5 — FIX LOOP */}
      <div className="rounded-xl border border-white/10 bg-charcoal/40 p-5">
        <h3 className="text-lg font-semibold text-white mb-2">What happens after you fix</h3>
        <ul className="list-disc pl-5 text-sm text-white/70 space-y-1">
          <li>mark as fixed</li>
          <li>re-run audit</li>
          <li>see score change</li>
          <li>see evidence change</li>
        </ul>
      </div>

      {/* SECTION 6 — PAYWALL */}
      {upgradeSuggestions.length > 0 && (
        <div className="card-charcoal/50 rounded-xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-white/80" />
            <h3 className="text-lg font-bold text-white">You’re missing where competitors are getting picked</h3>
          </div>
          <p className="text-xs text-white/55 mb-4">Competitor appears in key answer sources while you do not. Unlock full source breakdown to see why they win.</p>
          <div className="space-y-3">
            {upgradeSuggestions.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-charcoal p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-white/60 mt-1">{item.description}</p>
                </div>
                <Link
                  to={item.to}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-white/15 bg-charcoal-light text-white/80 text-xs font-semibold hover:text-white transition-colors"
                >
                  See why they win
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* SSFR Evidence Audit */}
      {(result as any)?.audit_id && (
        <SSFRPanel auditId={result.audit_id} />
      )}

      {/* Crypto Intelligence */}
      {result.crypto_intelligence && (
        <CryptoIntelligencePanel data={result.crypto_intelligence} />
      )}

      {/* Document Export */}
      <CollapsibleSection
        title="Export & Document Generation"
        description="Generate reports in PDF, DOCX, Markdown, and other formats"
        icon={Download}
        defaultOpen={false}
      >
        <DocumentGenerator result={result} />
      </CollapsibleSection>
    </div>
  );
};

export default ComprehensiveAnalysis;
