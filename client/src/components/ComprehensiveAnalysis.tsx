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
      color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />
    };
  }
  if (score >= 60) {
    return {
      level: "Good",
      color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
      icon: <TrendingUp className="w-6 h-6 text-cyan-400" />
    };
  }
  if (score >= 40) {
    return {
      level: "Needs Improvement",
      color: "text-amber-300 bg-amber-500/10 border-amber-500/20",
      icon: <Eye className="w-6 h-6 text-amber-400" />
    };
  }
  return {
    level: "Critical",
    color: "text-red-300 bg-red-500/10 border-red-500/20",
    icon: <AlertCircle className="w-6 h-6 text-red-400" />
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

  // Derived colour helpers used in JSX
  const scoreColor =
    result.visibility_score >= 80
      ? '#10b981'
      : result.visibility_score >= 60
        ? '#06b6d4'
        : result.visibility_score >= 40
          ? '#f59e0b'
          : '#ef4444';

  const circumference = 2 * Math.PI * 40; // r=40
  const dashOffset = circumference * (1 - result.visibility_score / 100);

  // Build the issues rows — prefer evidence_fix_plan, fall back to keypoints
  const issueRows: Array<{ id: string; severity: string; title: string; description: string; fix: string }> =
    result.evidence_fix_plan?.issues.length
      ? result.evidence_fix_plan.issues.map((iss) => ({
          id: iss.id,
          severity: iss.severity as string,
          title: iss.area,
          description: iss.finding,
          fix: iss.actual_fix,
        }))
      : keypoints.map((kp, i) => ({
          id: `kp-${i}`,
          severity: kp.priority,
          title: kp.title,
          description: kp.description,
          fix: kp.impact,
        }));

  const visibleIssues = showAllFixPlanIssues ? issueRows : issueRows.slice(0, 8);

  function severityPill(sev: string) {
    const s = sev?.toLowerCase() ?? '';
    if (s === 'critical' || s === 'high')
      return 'text-red-400 border-red-500/30 bg-red-500/10';
    if (s === 'medium')
      return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

      {/* LEFT COLUMN */}
      <div className="xl:col-span-8 space-y-5">

        {/* 1. Score overview card */}
        <div className="rounded-2xl border border-white/10 bg-[#0c1221] p-6">
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0 w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle cx="48" cy="48" r="40" fill="none" stroke={scoreColor} strokeWidth="8"
                  strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-white leading-none">{result.visibility_score}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 mb-0.5">AI Visibility Score</p>
              <h2 className="text-2xl font-bold text-white leading-tight">{scoreInfo.level}</h2>
              <p className="text-sm text-white/50 mt-1 mb-2 break-all" style={{ overflowWrap: 'anywhere' }}>{result.url}</p>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${executionPresentation.className}`}>
                  {executionPresentation.label}
                </span>
                {result.triple_check_summary && (
                  <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-300">
                    Triple-Check ✓
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${result.visibility_score}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}cc)` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-red-400/70">Critical</span>
            <span className="text-[10px] text-amber-400/70">Needs Work</span>
            <span className="text-[10px] text-cyan-400/70">Good</span>
            <span className="text-[10px] text-emerald-400/70">Excellent</span>
          </div>
        </div>

        {/* 2. Metric cards row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Schema Types', value: String(schemaCount), sub: schemaCount > 0 ? 'detected' : 'none found', valueColor: schemaCount > 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Word Count', value: contentWordCount > 0 ? contentWordCount.toLocaleString() : '—', sub: contentWordCount >= 800 ? 'sufficient depth' : contentWordCount > 0 ? 'thin content' : 'not measured', valueColor: contentWordCount >= 800 ? 'text-emerald-400' : contentWordCount > 0 ? 'text-amber-400' : 'text-white/35' },
            { label: 'Issues Found', value: String(issueRows.length), sub: 'visibility blockers', valueColor: issueRows.length > 0 ? 'text-orange-400' : 'text-emerald-400' },
            { label: 'HTTPS', value: hasHttps ? 'Enabled' : 'Missing', sub: hasCanonical ? 'Canonical ✓' : 'No canonical', valueColor: hasHttps ? 'text-emerald-400' : 'text-red-400' },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-white/10 bg-[#0c1221] p-4">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-1">{m.label}</p>
              <p className={`text-xl font-bold ${m.valueColor}`}>{m.value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* 3. Threat intelligence */}
        {(result as any).threat_intel && <ThreatIntelBanner data={(result as any).threat_intel} />}

        {/* 4. Category grid */}
        {result.category_grades && result.category_grades.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 mb-3">Category Breakdown</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.category_grades.slice(0, 6).map((cat) => {
                const catBadge = cat.score >= 80 ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.07]'
                  : cat.score >= 60 ? 'text-cyan-400 border-cyan-500/25 bg-cyan-500/[0.07]'
                  : cat.score >= 40 ? 'text-amber-400 border-amber-500/25 bg-amber-500/[0.07]'
                  : 'text-red-400 border-red-500/25 bg-red-500/[0.07]';
                const catColor = cat.score >= 80 ? '#10b981' : cat.score >= 60 ? '#06b6d4' : cat.score >= 40 ? '#f59e0b' : '#ef4444';
                const catLabel = cat.score >= 80 ? 'Excellent' : cat.score >= 60 ? 'Good' : cat.score >= 40 ? 'Weak' : 'Critical';
                const fixCount = cat.improvements?.length ?? 0;
                return (
                  <div key={cat.label} className="rounded-xl border border-white/10 bg-[#0c1221] p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-sm font-semibold text-white leading-snug">{cat.label}</p>
                      <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full border font-semibold ${catBadge}`}>{cat.score}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mb-2">
                      <div className="h-full rounded-full" style={{ width: `${cat.score}%`, background: catColor }} />
                    </div>
                    <p className="text-[11px] text-white/40">{catLabel} · {fixCount} fix{fixCount !== 1 ? 'es' : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Upload-specific panels */}
        {isUploadResult && result.upload_analysis_mode === 'writing_audit' && result.writing_audit && (
          <WritingAuditPanel result={result} />
        )}
        {isUploadResult && result.upload_analysis_mode !== 'writing_audit' && (
          <div className="rounded-xl border border-white/10 bg-[#0c1221] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-white font-semibold">Code &amp; Template Analysis</h3>
              <span className="text-[11px] px-2 py-1 rounded-full border border-white/15 bg-charcoal-light text-white/65">AEO / SEO / GEO / Security Scan</span>
            </div>
            <p className="text-sm text-white/60">This upload was analyzed as source code or template content. The audit covers deployable SEO signals, structured data opportunities, AI extractability, and security surface.</p>
          </div>
        )}

        {/* 6. Priority issues table */}
        <div className="rounded-2xl border border-white/10 bg-[#0c1221] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-white/60" />
              <h3 className="text-sm font-semibold text-white">Priority Issues</h3>
            </div>
            <span className="text-[11px] text-white/35">{issueRows.length} total</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {visibleIssues.map((issue) => (
              <div key={issue.id} className="px-5 py-3.5 flex items-start gap-3">
                <span className={`flex-shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${severityPill(issue.severity)}`}>
                  {issue.severity?.toUpperCase() || 'MED'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/90">{issue.title}</p>
                  <p className="text-xs text-white/50 mt-0.5">{issue.description}</p>
                  {issue.fix && <p className="text-xs text-blue-400/70 mt-1">↳ {issue.fix}</p>}
                </div>
              </div>
            ))}
          </div>
          {issueRows.length > 8 && (
            <div className="px-5 py-3 border-t border-white/[0.05]">
              <button onClick={() => setShowAllFixPlanIssues((v) => !v)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                {showAllFixPlanIssues ? 'Show less' : `Show all ${issueRows.length} issues`}
              </button>
            </div>
          )}
        </div>

        {/* 7. GEO / SSFR Truth Layer */}
        {(geoSignalProfile || contradictionReport) && (
          <div className="rounded-xl border border-white/10 bg-[#0c1221] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-xs uppercase tracking-wider text-white/50 font-semibold">GEO / SSFR Truth Layer</p>
              {contradictionReport && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                  (contradictionReport as any).status === 'clean' ? 'border-emerald-500/35 text-emerald-300'
                    : (contradictionReport as any).status === 'critical' ? 'border-rose-500/35 text-rose-300'
                    : 'border-amber-500/35 text-amber-300'
                }`}>
                  {(contradictionReport as any).status?.toUpperCase()} · {(contradictionReport as any).blocker_count} blockers
                </span>
              )}
            </div>
            {(strictRubric as any)?.required_fixpacks?.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Required Fixpacks</p>
                <div className="space-y-2">
                  {(strictRubric as any).required_fixpacks.map((pack: any) => (
                    <div key={pack.id} className="rounded-md border border-white/10 bg-charcoal p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <p className="text-sm text-white/80 font-medium">{pack.label}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/65">
                          Lift +{pack.estimated_score_lift_min} to +{pack.estimated_score_lift_max}
                        </span>
                      </div>
                      <p className="text-xs text-white/55">Targets: {pack.target_gate_ids?.map(humanizeGateId).join(', ')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. Competitor gap */}
        {hasAlignment ? (
          <div className="rounded-xl border border-white/10 bg-[#0c1221] p-5">
            <h3 className="text-base font-semibold text-white mb-3">Why competitors get cited instead</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-white/40 mb-2">Competitors</p>
                <ul className="list-disc pl-4 text-sm text-white/65 space-y-1">
                  <li>appear in answer sources you do not</li>
                  <li>stronger entity clarity and extraction cues</li>
                  <li>clearer structured answers for retrieval</li>
                </ul>
              </div>
              <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-white/40 mb-2">You</p>
                <ul className="list-disc pl-4 text-sm text-white/65 space-y-1">
                  <li>missing source presence on key intents</li>
                  <li>weaker extraction signals</li>
                  <li>inconsistent metadata trust surface</li>
                </ul>
              </div>
            </div>
            {competitorTrackingAccess !== true && (
              <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-500/10 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-violet-300 mb-1">Unlock full competitor intelligence</p>
                <p className="text-sm text-white/65">Source-level competitor evidence, citation movement tracking, and full parity detail are available on higher tiers.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-violet-300 mb-1">Competitor gap preview</p>
            <p className="text-sm text-white/80">
              Competitors with clearer schema + stronger answer structure are more likely to be cited first. Your highest visible gap is in{' '}
              <span className="font-semibold text-white">schema coverage and extractable answer blocks</span>.
            </p>
          </div>
        )}

        {/* 9. Upgrade suggestions */}
        {upgradeSuggestions.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-[#0c1221] p-5">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-4 h-4 text-white/60" />
              <h3 className="text-sm font-semibold text-white">You're missing where competitors are getting picked</h3>
            </div>
            <p className="text-xs text-white/45 mb-4">Competitor appears in key answer sources while you do not. Unlock full source breakdown to see why they win.</p>
            <div className="space-y-3">
              {upgradeSuggestions.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-charcoal p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-white/55 mt-1">{item.description}</p>
                  </div>
                  <Link to={item.to} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors">
                    See why they win
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 10. SSFR / Crypto / Export */}
        {(result as any)?.audit_id && <SSFRPanel auditId={result.audit_id} />}
        {result.crypto_intelligence && <CryptoIntelligencePanel data={result.crypto_intelligence} />}
        <CollapsibleSection title="Export & Document Generation" description="Generate reports in PDF, DOCX, Markdown, and other formats" icon={Download} defaultOpen={false}>
          <DocumentGenerator result={result} />
        </CollapsibleSection>
      </div>

      {/* RIGHT COLUMN — sticky fix panel */}
      <div className="xl:col-span-4">
        <div className="sticky top-20 space-y-4">

          {/* Verdict card */}
          <div className={`rounded-2xl border-2 p-5 ${scoreInfo.color}`}>
            <div className="flex items-center gap-3 mb-3">
              {scoreInfo.icon}
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] opacity-60">Verdict</p>
                <p className="text-sm font-bold leading-snug">AI reads. Doesn't cite.</p>
              </div>
            </div>
            <p className="text-xs opacity-70 mb-3">
              Score <strong>{result.visibility_score}/100</strong> — {scoreInfo.level}.{' '}
              Citation readiness: <strong>{result.visibility_score >= 70 ? 'Moderate' : 'Weak'}</strong>.
            </p>
            {keypoints.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-[0.12em] opacity-55 mb-1.5">Top blockers</p>
                <ul className="space-y-1">
                  {keypoints.slice(0, 3).map((kp) => (
                    <li key={kp.title} className="text-xs flex items-start gap-1.5 opacity-80">
                      <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{kp.title}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Top priority fix */}
          {keypoints.length > 0 && (() => {
            const top = keypoints[0];
            const cfg = priorityConfig[top.priority];
            return (
              <div className="rounded-2xl border border-white/10 bg-[#0c1221] p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 mb-3">Highest Priority Fix</p>
                <div className={`rounded-xl border p-3 ${cfg.border} ${cfg.bg}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.text}`}>{cfg.label}</span>
                  <p className={`text-sm font-semibold mt-2 mb-1 ${cfg.text}`}>{top.title}</p>
                  <p className="text-xs text-white/55 mb-2">{top.description}</p>
                  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-charcoal-deep/60">
                    <Zap className="w-3.5 h-3.5 text-white/50 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-white/45"><span className="text-white/70 font-medium">Impact:</span> {top.impact}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Fix plan bullets */}
          {result.evidence_fix_plan && result.evidence_fix_plan.issues.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0c1221] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Fix Plan</p>
                <span className="text-[11px] text-white/35">
                  {result.evidence_fix_plan.mode === 'thorough' ? 'Thorough' : 'Standard'} · {result.evidence_fix_plan.issue_count ?? result.evidence_fix_plan.issues.length} issues
                </span>
              </div>
              <div className="space-y-2.5">
                {result.evidence_fix_plan.issues.slice(0, 5).map((iss) => {
                  const s = iss.severity?.toLowerCase() ?? '';
                  const dot = s === 'critical' || s === 'high' ? 'bg-red-500' : s === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
                  return (
                    <div key={iss.id} className="flex items-start gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/80">{iss.area}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">{iss.actual_fix}</p>
                      </div>
                    </div>
                  );
                })}
                {result.evidence_fix_plan.issues.length > 5 && (
                  <p className="text-[11px] text-white/30 pl-4">+{result.evidence_fix_plan.issues.length - 5} more issues</p>
                )}
              </div>
            </div>
          )}

          {/* Required fixpacks */}
          {(strictRubric as any)?.required_fixpacks?.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0c1221] p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 mb-3">Required Fixpacks</p>
              <div className="space-y-2">
                {(strictRubric as any).required_fixpacks.map((pack: any) => (
                  <div key={pack.id} className="rounded-lg border border-white/10 p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-medium text-white/75 truncate">{pack.label}</p>
                      <span className="flex-shrink-0 text-[10px] text-emerald-400 font-semibold">+{pack.estimated_score_lift_min}–{pack.estimated_score_lift_max}</span>
                    </div>
                    <p className="text-[10px] text-white/35">{pack.target_gate_ids?.map(humanizeGateId).join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
};

export default ComprehensiveAnalysis;