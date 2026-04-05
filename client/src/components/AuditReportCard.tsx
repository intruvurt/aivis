// client/src/components/AuditReportCard.tsx
import React, { useState } from "react";
import {
  Award,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  Hash,
  Cpu,
  FileSearch,
  Quote,
  Eye,
  Type,
  Code2,
  Globe,
  Wrench,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import type {
  AnalysisExecutionClass,
  AnalysisResponse,
  AuditGrade,
  CategoryGrade,
  ContentHighlight,
  AuditVersion,
} from "@shared/types";
import { getAnalysisExecutionClass } from "@shared/types";

// ─── Grade styling ──────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<
  AuditGrade,
  {
    bg: string;
    text: string;
    border: string;
    ring: string;
    glow: string;
    label: string;
  }
> = {
  A: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    border: "border-emerald-400/40",
    ring: "ring-emerald-400/30",
    glow: "shadow-emerald-500/25",
    label: "Excellent",
  },
  B: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-300",
    border: "border-cyan-400/40",
    ring: "ring-cyan-400/30",
    glow: "shadow-cyan-500/25",
    label: "Good",
  },
  C: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-400/40",
    ring: "ring-amber-400/30",
    glow: "shadow-amber-500/25",
    label: "Average",
  },
  D: {
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    border: "border-orange-400/40",
    ring: "ring-orange-400/30",
    glow: "shadow-orange-500/25",
    label: "Weak",
  },
  F: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    border: "border-red-400/40",
    ring: "ring-red-400/30",
    glow: "shadow-red-500/25",
    label: "Failing",
  },
};

function overallGrade(score: number): AuditGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 50) return "C";
  if (score >= 25) return "D";
  return "F";
}

// ─── BRAG Evidence Labels ────────────────────────────────────────────────────

const EV_LABELS: Record<string, string> = {
  ev_title:      'Page Title',
  ev_meta_desc:  'Meta Description',
  ev_meta_kw:    'Meta Keywords',
  ev_og_title:   'OG Title',
  ev_og_desc:    'OG Description',
  ev_h1:         'H1 Tag',
  ev_h2:         'H2 Tags',
  ev_h3:         'H3 Tags',
  ev_word_count: 'Word Count',
  ev_links_int:  'Internal Links',
  ev_links_ext:  'External Links',
  ev_images:     'Images',
  ev_https:      'HTTPS',
  ev_schema:     'Schema / JSON-LD',
  ev_body:       'Body Content',
};

// ─── Area icons ─────────────────────────────────────────────────────────────

const AREA_ICON: Record<string, React.ReactNode> = {
  heading: <Type className="w-4 h-4" />,
  meta: <FileSearch className="w-4 h-4" />,
  schema: <Code2 className="w-4 h-4" />,
  content: <BookOpen className="w-4 h-4" />,
  technical: <Wrench className="w-4 h-4" />,
  readability: <Eye className="w-4 h-4" />,
};

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  good: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-white/80",
    label: "Pass",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-white/80",
    label: "Needs Work",
  },
  critical: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-white/80",
    label: "Critical",
  },
  missing: {
    icon: <HelpCircle className="w-4 h-4" />,
    color: "text-white/55 dark:text-white/60",
    label: "Missing",
  },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function GradeBadge({
  grade,
  size = "md",
}: {
  grade: AuditGrade;
  size?: "sm" | "md" | "lg";
}) {
  const cfg = GRADE_CONFIG[grade];
  const sizeClasses = {
    sm: "w-8 h-8 text-base",
    md: "w-12 h-12 text-xl",
    lg: "w-20 h-20 text-4xl",
  };
  return (
    <div
      className={`${sizeClasses[size]} rounded-xl ${cfg.bg} ${cfg.text} ${cfg.border} border-2 font-black flex items-center justify-center shadow-lg ${cfg.glow} ring-2 ${cfg.ring}`}
    >
      {grade}
    </div>
  );
}

function scoreBarTone(score: number): string {
  if (score >= 90) return "bg-gradient-to-r from-emerald-300 to-cyan-300";
  if (score >= 75) return "bg-gradient-to-r from-cyan-300 to-violet-300";
  if (score >= 50) return "bg-gradient-to-r from-violet-300 to-amber-200";
  if (score >= 25) return "bg-gradient-to-r from-amber-200 to-orange-300";
  return "bg-gradient-to-r from-rose-300 to-amber-200";
}

function getExecutionClassPresentation(executionClass: AnalysisExecutionClass): { label: string; className: string } {
  if (executionClass === "LIVE") {
    return { label: "Live pipeline", className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" };
  }
  if (executionClass === "DETERMINISTIC_FALLBACK") {
    return { label: "Deterministic fallback", className: "bg-amber-500/10 border-amber-500/20 text-amber-300" };
  }
  if (executionClass === "SCRAPE_ONLY") {
    return { label: "Scrape-only", className: "bg-red-500/10 border-red-500/20 text-red-300" };
  }
  return { label: "Upload analysis", className: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300" };
}

function CategoryRow({
  cat,
  isOpen,
  onToggle,
}: {
  cat: CategoryGrade;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const cfg = GRADE_CONFIG[cat.grade];
  const strengths = Array.isArray(cat.strengths) ? cat.strengths : [];
  const improvements = Array.isArray(cat.improvements) ? cat.improvements : [];
  const hasDetails = strengths.length > 0 || improvements.length > 0;
  const safeScore = Math.max(0, Math.min(100, Number(cat.score) || 0));

  return (
    <div
      className={`rounded-xl border transition-all duration-300 ${
        isOpen ? `${cfg.border} ${cfg.bg}` : "border-white/14/60 dark:border-white/10 hover:border-white/12 dark:hover:border-white/10"
      }`}
    >
      {/* Row header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
        type="button"
      >
        <GradeBadge grade={cat.grade} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white dark:text-white truncate">
              {cat.label}
            </p>
            {cat.grade === 'F' && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25">Critical</span>
            )}
            {cat.grade === 'D' && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/25">High</span>
            )}
            {cat.grade === 'C' && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">Medium</span>
            )}
          </div>
          <p className="text-xs text-white/60 dark:text-white/55 truncate">
            {cat.summary}
          </p>
        </div>
        {/* Score bar */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <div className="w-28 h-2 bg-charcoal-light/70 dark:bg-charcoal rounded-full overflow-hidden border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-700 ${scoreBarTone(safeScore)}`}
              style={{ width: `${safeScore}%` }}
            />
          </div>
          <span className="text-xs font-mono text-cyan-200/90 dark:text-cyan-200/90 w-10 text-right">
            {safeScore}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-white/55 dark:text-white/60 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/55 dark:text-white/60 flex-shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/14 dark:border-white/10 pt-3">
          <p className="text-xs text-cyan-100/90 leading-relaxed">{cat.summary}</p>

          {strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-white/80 dark:text-white/80 uppercase tracking-wider mb-1.5">
                 What's Done Well
              </p>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li
                    key={i}
                    className="text-sm text-white/80 dark:text-white/75 flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-white/80 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-white/80 dark:text-white/80 uppercase tracking-wider mb-1.5">
                ↑ Needs Improvement
              </p>
              <ul className="space-y-1">
                {improvements.map((imp, i) => (
                  <li
                    key={i}
                    className="text-sm text-white/80 dark:text-white/75 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-white/80 mt-0.5 flex-shrink-0" />
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasDetails && (
            <p className="text-xs text-white/60 dark:text-white/55">
              No additional strengths or improvement bullets were returned for this section.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: ContentHighlight }) {
  const statusCfg = STATUS_CONFIG[highlight.status] || STATUS_CONFIG.warning;
  const areaIcon = AREA_ICON[highlight.area] || <Globe className="w-4 h-4" />;
  const areaLabel =
    highlight.area.charAt(0).toUpperCase() + highlight.area.slice(1);

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-charcoal/30 dark:bg-charcoal border border-white/10 dark:border-white/10">
      {/* Status icon */}
      <div className={`flex-shrink-0 mt-0.5 ${statusCfg.color}`}>
        {statusCfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        {/* Area label + status badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white/55 dark:text-white/60">{areaIcon}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60 dark:text-white/55">
            {areaLabel}
          </span>
          <span
            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${statusCfg.color} bg-current/10`}
          >
            {statusCfg.label}
          </span>
        </div>
        {/* Found content - quoted */}
        {highlight.found && (
          <div className="flex items-start gap-1.5 mb-1">
            <Quote className="w-3 h-3 text-white/75 dark:text-white/70 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-white/90 dark:text-white/85 italic leading-snug break-words whitespace-pre-wrap overflow-hidden">
              {highlight.found}
            </p>
          </div>
        )}
        {/* Note */}
        {highlight.note && (
          <p className="text-xs text-white/60 dark:text-white/55 leading-relaxed break-words whitespace-pre-wrap overflow-hidden">
            {highlight.note}
          </p>
        )}
        {/* BRAG: source evidence chip */}
        {highlight.source_id && (
          <div className="mt-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-charcoal-light dark:bg-charcoal-deep border border-white/10 dark:border-white/10 text-[10px] font-mono text-white/80 dark:text-white/85">
              {EV_LABELS[highlight.source_id] ?? highlight.source_id}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface AuditReportCardProps {
  result: AnalysisResponse;
  hideHero?: boolean;
  hideGrades?: boolean;
  hideHighlights?: boolean;
}

const AuditReportCard: React.FC<AuditReportCardProps> = ({ result, hideHero, hideGrades, hideHighlights }) => {
  const grades = result.category_grades || [];
  const highlights = result.content_highlights || [];
  const version = result.audit_version;
  const score = result.visibility_score;
  const executionClass = getAnalysisExecutionClass(result);
  const executionPresentation = getExecutionClassPresentation(executionClass);
  const grade = overallGrade(score);
  const gradeCfg = GRADE_CONFIG[grade];

  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [openCategoryIndex, setOpenCategoryIndex] = useState<number | null>(null);
  const displayedHighlights = showAllHighlights
    ? highlights
    : highlights.slice(0, 4);

  // Sort grades by severity: F first, then D, C, B, A
  const GRADE_ORDER: Record<AuditGrade, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };
  const sortedGrades = [...grades].sort((a, b) => (GRADE_ORDER[a.grade] ?? 5) - (GRADE_ORDER[b.grade] ?? 5));

  // Skip rendering if no grading data at all
  if (grades.length === 0 && highlights.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* ─── Overall Grade Hero ──────────────────────────────────────── */}
      {!hideHero && (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/10 bg-charcoal dark:bg-charcoal-deep">
        {/* Decorative gradient */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradeCfg.bg} opacity-30 pointer-events-none`}
        />

        <div className="relative p-6">
          {/* Version / Trail badge */}
          {version && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-charcoal-light dark:bg-charcoal-deep border border-white/14/60 dark:border-white/10 text-xs text-white/70 dark:text-white/55 font-mono">
                <Hash className="w-3 h-3" />
                Audit v{version.version}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-charcoal-light dark:bg-charcoal-deep border border-white/14/60 dark:border-white/10 text-xs text-white/70 dark:text-white/55">
                <Clock className="w-3 h-3" />
                {new Date(version.timestamp).toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-charcoal-light dark:bg-charcoal-deep border border-white/14/60 dark:border-white/10 text-xs text-white/70 dark:text-white/55 font-mono">
                <Cpu className="w-3 h-3" />
                {version.models.length} AI Models
              </span>
              {(result as any).analysis_tier_display && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 font-medium">
                  <ShieldCheck className="w-3 h-3" />
                  {(result as any).analysis_tier_display}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-charcoal-light dark:bg-charcoal-deep border border-white/14/60 dark:border-white/10 text-[10px] text-white/60 dark:text-white/60 font-mono">
                <span className="break-all">{version.audit_id}</span>
              </span>
              {result.triple_check_summary && (() => {
                const tc = result.triple_check_summary;
                const tcEnabled = (result as any).triple_check_enabled === true;
                if (!tcEnabled) return null;
                const adjusted = tc.ai2_adjustment !== 0 || !tc.ai3_validated;
                const label = adjusted ? "Score peer-reviewed and adjusted" : "Score validated by peer review";
                const style =
                  tc.confidence === "high"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : tc.confidence === "medium"
                    ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-400";
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${style}`}>
                    <ShieldCheck className="w-3 h-3" />
                    {label} • {tc.confidence} confidence
                  </span>
                );
              })()}
              </div>
              {/* Final scoring rationale (collapsed by default) */}
              {(result as any).triple_check_enabled && result.triple_check_summary && (result.triple_check_summary.ai2_critique || result.triple_check_summary.ai3_verdict) && (() => {
                const tc = result.triple_check_summary;
                const rationale = [tc.ai2_critique, tc.ai3_verdict].filter(Boolean).join(' ');
                if (!rationale) return null;
                return (
                  <details className="mt-3 rounded-xl bg-white/[0.03] border border-white/8">
                    <summary className="px-3 py-2 text-xs font-medium text-white/60 cursor-pointer hover:text-white/80 transition-colors select-none">
                      Final scoring rationale
                    </summary>
                    <p className="px-3 pb-3 text-xs text-white/60 leading-relaxed">
                      {rationale}
                    </p>
                  </details>
                );
              })()}
            </>
          )}

          {/* Score provenance strip */}
          {(result as any).triple_check_enabled && result.triple_check_summary && (() => {
            const tc = result.triple_check_summary;
            const initial = tc.ai1_score;
            const adjustment = tc.ai2_adjustment;
            const final_score = tc.final_score ?? score;
            if (initial == null) return null;
            return (
              <div className="flex flex-wrap items-center gap-2 mt-4 mb-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/8 text-xs text-white/65">
                <span className="font-medium text-white/80">Score path:</span>
                <span className="font-mono">{initial}</span>
                {adjustment !== 0 && (
                  <>
                    <span className="text-white/40">→</span>
                    <span className={`font-mono ${adjustment > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {adjustment > 0 ? '+' : ''}{adjustment} peer adjustment
                    </span>
                  </>
                )}
                <span className="text-white/40">→</span>
                <span className="font-mono font-semibold text-white/90">{final_score} final</span>
              </div>
            );
          })()}

          {/* Grade + Score hero */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <GradeBadge grade={grade} size="lg" />
            <div className="min-w-0">
              <h3 className="text-2xl font-bold text-white dark:text-white">
                Overall Audit Grade:{" "}
                <span className={gradeCfg.text}>
                  {grade} - {gradeCfg.label}
                </span>
              </h3>
              <p className="text-sm text-white/60 dark:text-white/55 mt-1">
                Visibility Score: {score}/100 •{" "}
                {grades.length} categories evaluated •{" "}
                {highlights.length} areas inspected
              </p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-full border text-xs font-medium ${executionPresentation.className}`}>
                {executionPresentation.label}
              </span>
              {result.processing_time_ms && (
                <p className="text-xs text-white/55 dark:text-white/60 mt-0.5">
                  Audit completed in{" "}
                  {(result.processing_time_ms / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ─── Category Grade Cards ───────────────────────────────────── */}
      {grades.length > 0 && !hideGrades && (
        <div className="rounded-2xl border border-white/10 dark:border-white/10 bg-charcoal dark:bg-charcoal-deep p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-white/55/20 to-white/40/20">
              <Award className="w-5 h-5 text-white/80 dark:text-white/80" />
            </div>
            <div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-200 via-violet-200 to-amber-100 bg-clip-text text-transparent">
                Category Grades
              </h3>
              <p className="text-xs text-white/60 dark:text-white/55">
                Click any category to see strengths & improvements
              </p>
            </div>
          </div>

          {/* Grade summary bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            {sortedGrades.map((cat, i) => {
              const cfg = GRADE_CONFIG[cat.grade];
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border} border`}
                >
                  {cat.grade} - {cat.label}
                </span>
              );
            })}
          </div>

          {/* Expandable rows */}
          <div className="space-y-2">
            {sortedGrades.map((cat, i) => (
              <CategoryRow
                key={i}
                cat={cat}
                isOpen={openCategoryIndex === i}
                onToggle={() =>
                  setOpenCategoryIndex((current) => (current === i ? null : i))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Content Highlights ─────────────────────────────────────── */}
      {highlights.length > 0 && !hideHighlights && (
        <div className="rounded-2xl border border-white/10 dark:border-white/10 bg-charcoal dark:bg-charcoal-deep p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-white/65/20 to-white/48/20">
              <FileSearch className="w-5 h-5 text-white/80 dark:text-white/85" />
            </div>
            <div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-200 via-violet-200 to-amber-100 bg-clip-text text-transparent">
                Content Highlights & Findings
              </h3>
              <p className="text-xs text-white/60 dark:text-white/55">
                Real excerpts and structural observations from your page
              </p>
            </div>
            {/* Quick status summary */}
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {(["good", "warning", "critical", "missing"] as const).map(
                (s) => {
                  const count = highlights.filter(
                    (h) => h.status === s
                  ).length;
                  if (!count) return null;
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <span
                      key={s}
                      className={`inline-flex items-center gap-1 text-xs ${cfg.color}`}
                    >
                      {cfg.icon}
                      {count}
                    </span>
                  );
                }
              )}
            </div>
          </div>

          <div className="space-y-2">
            {displayedHighlights.map((h, i) => (
              <HighlightCard key={i} highlight={h} />
            ))}
          </div>

          {highlights.length > 4 && (
            <button
              onClick={() => setShowAllHighlights(!showAllHighlights)}
              className="mt-3 text-sm text-white/80 dark:text-white/85 hover:text-white/80 font-medium flex items-center gap-1"
            >
              {showAllHighlights
                ? "Show fewer"
                : `Show all ${highlights.length} findings`}
              {showAllHighlights ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditReportCard;
