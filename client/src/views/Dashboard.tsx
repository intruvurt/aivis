import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { toSafeHref } from "../utils/safeHref";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import {
  Search,
  Upload,
  Globe,
  Target,
  BarChart3,
  FileText,
  Users,
  ChevronRight,
  Check,
  AlertCircle,
  Info,
  Sparkles,
  Eye,
  Loader2,
  ExternalLink,
  ArrowRight,
  Shield,
  History,
  Trash2,
  FlaskConical,
  RotateCcw,
  GripVertical,
  Activity,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock3,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Award,
  Briefcase,
  Zap,
  Camera,
  Smartphone,
  FolderOpen,
  Lock,
  Wand2,
  X,
  ClipboardPaste,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { buildTargetKey, normalizePublicUrlInput } from "../utils/targetKey";
import { useAnalysisStore } from "../stores/analysisStore";
import ComprehensiveAnalysis from "../components/ComprehensiveAnalysis";
import AuditReportCard from "../components/AuditReportCard";
import PlatformProofLoopCard from "../components/PlatformProofLoopCard";
import AuditProgressOverlay from "../components/AuditProgressOverlay";
import AuditProgressBanner from "../components/AuditProgressBanner";
import { TrustBadgesBar, TrustSection } from "../components/TrustSignals";
import OnboardingModal, {
  isOnboardingComplete,
  markOnboardingComplete,
} from "../components/OnboardingModal";
import ShareButtons from "../components/ShareButtons";
import AutoScoreFixWidget from "../components/AutoScoreFixWidget";
import AutoScoreFixModal from "../components/AutoScoreFixModal";
import CompetitorHintBanner from "../components/CompetitorHintBanner";
import IndexingReadinessCard from "../components/IndexingReadinessCard";
import TextSummaryView from "../components/TextSummaryView";
import { TIER_LIMITS, meetsMinimumTier } from "@shared/types";
import type { AnalysisResponse, AIModelScore, TextSummary } from "@shared/types";
import { canAccess } from "@shared/entitlements";
import { API_URL } from "../config";
import { getWorkspaceHeader } from "../stores/workspaceStore";
import { usePageMeta } from "../hooks/usePageMeta";
import useFeatureStatus from "../hooks/useFeatureStatus";
import usePageVisible from "../hooks/usePageVisible";
import { buildDefinedTermSetSchema, buildFaqSchema, buildHowToSchema, buildItemListSchema, buildOrganizationSchema, buildServiceSchema, buildSoftwareApplicationSchema, buildWebPageSchema, buildWebSiteSchema } from "../lib/seoSchema";
import apiFetch from "../utils/api";

// this refactor intentionally avoids over-styled / likely-invalid utility strings
// and avoids assuming apiFetch returns a native Response object.

type TrendPoint = {
  date: string;
  visibility: number;
  label?: string;
  url?: string;
  /** YYYY-MM-DD — used for dedup when merging local and server trend history */
  isoDate?: string;
};

type CategoryInsight = {
  label: string;
  score: number;
  summary: string;
  samples?: number;
  samples?: number;
};

type ApiError = Error & {
  status?: number;
  code?: string;
  retryAfter?: number;
};

type DashboardData = {
  visibilityScore: number;
  contentWordCount: number;
  schemaCount: number;
  techResponseMs: number;
  recommendationCount: number;
  topicalKeywordsCount: number;
  httpsEnabled: boolean;
  trendData: TrendPoint[];
  url?: string;
  analyzedAt?: string;
  summary?: string;
  aiPlatformScores?: {
    chatgpt: number;
    perplexity: number;
    google_ai: number;
    claude: number;
  };
  aiModelScores?: AIModelScore[];
};

type FeatureJson = {
  success?: boolean;
  data?: any;
};

type AutoScoreFixPipelineJob = {
  id: string;
  target_url: string;
  status: string;
  pr_url?: string | null;
  implementation_duration_minutes?: number | null;
  checks_status?: string | null;
  github_pr_merged_at?: string | null;
  rescan_status?: string | null;
  rescan_scheduled_for?: string | null;
  rescan_completed_at?: string | null;
  score_before?: number | null;
  score_after?: number | null;
  score_delta?: number | null;
  created_at?: string;
  updated_at?: string;
};

type SectionKey =
  | "executive"
  | "evidence"
  | "priority"
  | "threat_intel"
  | "grades"
  | "report"
  | "analysis"
  | "trend"
  | "platforms"
  | "citations"
  | "modules";

const SECTION_STORAGE_KEY = "aivis.dashboard.sectionOrder.v4";
const DEFAULT_SECTION_ORDER: SectionKey[] = [
  // Enterprise quality audit flow: Score → Evidence → Remediation → Threat/Exposure → History → Everything else
  "executive",
  "evidence",
  "priority",
  "threat_intel",
  "trend",
  "platforms",
  "citations",
  "analysis",
  "report",
  "grades",
  "modules",
];

const SECTION_META: Record<SectionKey, { label: string; subtitle: string }> = {
  executive:    { label: "Overview",      subtitle: "Your score, headline signals, and what this audit means operationally." },
  evidence:     { label: "Evidence",      subtitle: "The raw crawl data behind every score — verify what was actually found." },
  priority:     { label: "Actions",       subtitle: "What to fix first, ranked by impact and evidence strength. Start at item 1." },
  threat_intel: { label: "Security",      subtitle: "Risk posture, exposure vectors, and integrity warnings that affect AI trust." },
  trend:        { label: "Score Trend",   subtitle: "How your score has moved across all audits — track whether fixes are working." },
  platforms:    { label: "AI Platforms",  subtitle: "Visibility scores for ChatGPT, Perplexity, Claude, and Google AI specifically." },
  citations:    { label: "Citations",     subtitle: "Whether AI models are citing your URL — and at what citation strength." },
  analysis:     { label: "Full Analysis", subtitle: "Deep-dive breakdown of every signal the engine detected, beyond the summary." },
  report:       { label: "Reports",       subtitle: "Export, validate, and share this audit as a PDF, DOCX, or Markdown document." },
  grades:       { label: "Grades",        subtitle: "A–F scores across six audit categories — your lowest grade is your best fix target." },
  modules:      { label: "Modules",       subtitle: "Jump to keywords, competitors, citations, reverse engineering, and more." },
};

const HOME_STRUCTURED_DATA = [
  buildOrganizationSchema(),
  buildWebSiteSchema(),
  buildSoftwareApplicationSchema({
    name: 'AiVIS',
    description:
      'AI visibility audit platform that scores extractability, trust, and citation readiness for answer engines with evidence-backed implementation guidance.',
    offers: [
      { name: 'Observer [Free]', price: '0' },
      { name: 'Alignment [Core]', price: '49' },
      { name: 'Signal [Premium]', price: '149' },
      { name: 'Score Fix [AutoPR]', price: '299' },
    ],
  }),
  buildServiceSchema({
    name: 'AiVIS AI Visibility Audit',
    serviceType: 'AI visibility and citation readiness audit',
    description:
      'Evidence-backed scoring and implementation guidance for machine readability, structured data clarity, and answer-engine citation confidence.',
    path: '/',
  }),
  buildWebPageSchema({
    path: '/',
    name: 'AiVIS: AI Visibility Audit for ChatGPT, Perplexity, Claude',
    description:
      'AiVIS audits whether AI answer engines can parse, trust, and cite your page. Returns a 0-100 visibility score with category grades and implementation-ready fixes.',
    mainEntityId: 'https://aivis.biz/#software-application',
  }),
  buildFaqSchema([
    {
      question: 'What does AiVIS return in one audit?',
      answer:
        'Each audit returns a validated 0-100 visibility score, category grades, evidence-linked findings, and prioritized recommendations based on observed page structure and content.',
    },
    {
      question: 'What makes a page easier for AI systems to cite?',
      answer:
        'Clear entities, complete schema, one strong H1, reliable metadata, sufficient topical depth, and concise answer-style sections all improve LLM readability and citation potential.',
    },
    {
      question: 'How should teams handle low content depth scores?',
      answer:
        'Low depth scores indicate sparse explanations or short sections lacking context for answer engines. Expanding core sections with concrete, factual, implementation-level detail improves both readability and citation potential.',
    },
    {
      question: 'Why does schema quality matter even when multiple blocks exist?',
      answer:
        'Quantity of schema blocks is not enough. Schema value comes from quality, valid relationships, accurate entity references, and page-appropriate types. AiVIS audits whether structured data is complete and coherent enough for machine interpretation.',
    },
    {
      question: 'What score is considered production-ready for citation workflows?',
      answer:
        'Scores of 80 and above fall into the Excellent tier and indicate strong citation readiness. As a practical benchmark, teams should target 80+ with no unresolved high-priority findings. Scores above 90 usually reflect production-grade extraction clarity, full schema coverage, and consistent citation across answer engines.',
    },
  ], {
    id: 'https://aivis.biz/#faq',
    path: '/',
  }),
  buildHowToSchema({
    name: 'How to run an AI visibility audit with AiVIS',
    description:
      'A step-by-step guide for running an AI visibility audit, reading category scores, and shipping evidence-backed fixes.',
    url: 'https://aivis.biz/',
    id: 'https://aivis.biz/#howto-run-audit',
    steps: [
      {
        name: 'Enter your page URL',
        text: 'Paste the full URL of the page you want to audit into the AiVIS input field and select your plan tier.',
      },
      {
        name: 'Review the visibility score',
        text: 'Read the overall score and category grades for content depth, schema, metadata, headings, technical hygiene, and AI readability.',
      },
      {
        name: 'Inspect linked evidence',
        text: 'Each finding references specific evidence from the crawl. Check which evidence items are tied to low-scoring categories.',
      },
      {
        name: 'Prioritize and implement fixes',
        text: 'Sort recommendations by impact tier. Implement high-confidence fixes first: schema, content depth, and answer-style blocks usually move scores fastest.',
      },
      {
        name: 'Re-audit and compare',
        text: 'After shipping changes, re-run the audit and compare category deltas. Track score movement over time using the report history view.',
      },
    ],
  }),
  buildItemListSchema([
    { name: 'Run an Audit', path: '/' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'Methodology', path: '/methodology' },
    { name: 'Analytics', path: '/analytics' },
    { name: 'Reverse Engineer', path: '/reverse-engineer' },
    { name: 'Score Fix', path: '/score-fix' },
  ], {
    id: 'https://aivis.biz/#feature-list',
    path: '/',
  }),
  buildDefinedTermSetSchema({
    name: 'AiVIS AI Visibility Terms',
    description: 'Core concepts used in AiVIS visibility audits and remediation workflows.',
    path: '/',
    terms: [
      {
        name: 'AI Visibility Score',
        description: 'A 0-100 score representing how well AI systems can parse, trust, and cite a page.',
      },
      {
        name: 'Evidence-Linked Recommendation',
        description: 'A recommendation tied to specific crawl evidence IDs so teams can validate remediation impact.',
      },
      {
        name: 'Citation Readiness',
        description: 'The likelihood that answer engines can extract and cite page content with high confidence.',
      },
      {
        name: 'Triple-Check Validation',
        description: 'A premium scoring pipeline where multiple models critique and validate score confidence.',
      },
    ],
  }),
];

const FAQ_ITEMS = [
  {
    question: "What does AiVIS return in one audit?",
    answer:
      "Each audit returns a validated 0-100 visibility score, category grades, evidence-linked findings, and prioritized recommendations based on observed page structure and content.",
  },
  {
    question: "What makes a page easier for AI systems to cite?",
    answer:
      "Clear entities, complete schema, one strong H1, reliable metadata, sufficient topical depth, and concise answer-style sections all improve LLM readability and citation potential.",
  },
  {
    question: "How should teams handle low content depth scores?",
    answer:
      "Low depth scores indicate sparse explanations or short sections lacking context for answer engines. Expanding core sections with concrete, factual, implementation-level detail improves both readability and citation potential.",
  },
  {
    question: "Why does schema quality matter even when multiple blocks exist?",
    answer:
      "Quantity of schema blocks is not enough. Schema value comes from quality, valid relationships, accurate entity references, and page-appropriate types. AiVIS audits whether structured data is complete and coherent enough for machine interpretation.",
  },
  {
    question: "What score is considered production-ready for citation workflows?",
    answer:
      "Scores of 80 and above fall into the Excellent tier and indicate strong citation readiness. As a practical benchmark, teams should target 80+ with no unresolved high-priority findings. Scores above 90 usually reflect production-grade extraction clarity, full schema coverage, and consistent citation across answer engines.",
  },
] as const;

function normalizeUrl(input: string): string {
  return normalizePublicUrlInput(input);
}

function normalizeSectionOrder(candidate: unknown): SectionKey[] {
  const source = Array.isArray(candidate) ? candidate : [];
  const valid = new Set<SectionKey>(DEFAULT_SECTION_ORDER);
  const seen = new Set<SectionKey>();
  const ordered: SectionKey[] = [];

  for (const entry of source) {
    if (!valid.has(entry as SectionKey)) continue;
    const key = entry as SectionKey;
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }

  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) ordered.push(key);
  }

  return ordered;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, init);
  const text = await response.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const error = new Error(json?.error || json?.message || `Request failed (${response.status})`) as ApiError;
    error.status = response.status;
    error.code = typeof json?.code === "string" ? json.code : undefined;
    const retryAfter = Number(json?.retryAfter ?? response.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      error.retryAfter = retryAfter;
    }
    throw error;
  }

  if (json === null || typeof json !== "object") {
    const ct = response.headers.get("content-type") || "";
    const isHtml = ct.includes("text/html");
    const error = new Error(
      isHtml
        ? "Could not reach the API server. Check your connection and try again."
        : "Invalid API response from server"
    ) as ApiError;
    error.status = response.status;
    error.code = isHtml ? "API_UNREACHABLE" : "INVALID_API_RESPONSE";
    throw error;
  }

  return json as T;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function InfoHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[10px] font-bold text-white/70"
    >
      i
    </span>
  );
}

function getVisibilityTone(score: number) {
  if (score >= 80) return { label: "Strong", classes: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" };
  if (score >= 60) return { label: "Stable", classes: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200" };
  if (score >= 40) return { label: "At Risk", classes: "border-amber-400/25 bg-amber-400/10 text-amber-200" };
  return { label: "Weak", classes: "border-red-400/25 bg-red-400/10 text-red-200" };
}

function transformApiResponse(
  response: AnalysisResponse,
  history: Array<{ url: string; timestamp: number; result: AnalysisResponse }>
): DashboardData {
  // Local store history — provisional trend data kept in transformApiResponse for
  // potential programmatic use. The trend chart uses raw serverHistory only.
  const responseUrl = response.url || response.analysis_integrity?.normalized_target_url || "";
  const trendData: TrendPoint[] = history
    .filter((h) => h && typeof h.url === "string" && h.url && h.url === responseUrl && h.result)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-12)
    .map((h, index, arr) => ({
      date: new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      isoDate: new Date(h.timestamp).toISOString().slice(0, 10),
      visibility: h.result.visibility_score,
      label: index === arr.length - 1 ? "Latest" : undefined,
      url: h.url,
    }));

  if (trendData.length === 0) {
    const ts = response.analyzed_at ? new Date(response.analyzed_at).getTime() : Date.now();
    trendData.push({
      date: new Date(ts).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      isoDate: new Date(ts).toISOString().slice(0, 10),
      visibility: response.visibility_score,
      label: "Current",
      url: responseUrl,
    });
  }

  return {
    visibilityScore: response.visibility_score,
    contentWordCount: response.content_analysis?.word_count || 0,
    schemaCount: response.schema_markup?.json_ld_count || 0,
    techResponseMs: response.technical_signals?.response_time_ms || 0,
    recommendationCount: (response.recommendations || []).length,
    topicalKeywordsCount: (response.keyword_intelligence || response.topical_keywords || []).length,
    httpsEnabled: response.technical_signals?.https_enabled ?? false,
    trendData,
    url: responseUrl,
    analyzedAt: response.analyzed_at,
    summary: response.summary,
    aiPlatformScores: response.ai_platform_scores,
    aiModelScores: response.ai_model_scores,
  };
}

function StatCard({
  title,
  value,
  description,
  badge,
  progress,
  onClick,
}: {
  title: string;
  value: string | number;
  description: string;
  badge?: string;
  progress?: number;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.015, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.985 }}
      className="w-full rounded-2xl border border-white/10 bg-[#121827]/90 p-5 text-left transition-colors hover:border-white/20 hover:bg-[#151c2d] hover:shadow-lg hover:shadow-white/[0.03] backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/60">{title}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-white">{value}</p>
        </div>
        {badge && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs leading-6 text-white/50">{description}</p>
      {typeof progress === "number" && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-white/80 to-white/40"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
    </motion.button>
  );
}

function ExecutiveRail({
  data,
  latestAnalysisResult,
}: {
  data: DashboardData;
  latestAnalysisResult: AnalysisResponse;
}) {
  const visibilityTone = getVisibilityTone(data.visibilityScore);
  const topRecommendation = latestAnalysisResult.recommendations?.[0];

  return (
    <section className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/65">
            <Sparkles className="h-3.5 w-3.5" />
            Executive Layer
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
            What this audit means right now
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-8 text-white/65">
            This is not just a score. It is a live operational read on whether your page is structured, trusted,
            and extractable enough to survive inside AI-generated answers.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs ${visibilityTone.classes}`}>
              {visibilityTone.label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
              {data.recommendationCount} recommendations
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wide text-white/45">Highest leverage move</div>
          <div className="mt-2 text-base font-semibold text-white">
            {topRecommendation?.title || "No priority recommendation returned"}
          </div>
          <p className="mt-2 text-sm leading-7 text-white/60">
            {topRecommendation?.description || "Run another audit after content or structure changes to produce a richer action path."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              to="/score-fix"
              className="rounded-2xl border border-white/10 bg-[#171f31] px-4 py-3 text-sm text-white/75 transition hover:text-white"
            >
              Open Score Fix
            </Link>
            <Link
              to="/reverse-engineer"
              className="rounded-2xl border border-white/10 bg-[#171f31] px-4 py-3 text-sm text-white/75 transition hover:text-white"
            >
              Reverse Engineer
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function AuditSnapshot({
  data,
  latestAnalysisResult,
  onOpenAutoScoreFix,
}: {
  data: DashboardData;
  latestAnalysisResult: AnalysisResponse;
  onOpenAutoScoreFix: () => void;
}) {
  const [showAdvisory, setShowAdvisory] = useState(false);
  const hasLiveSnapshotScore = !latestAnalysisResult.cached;
  const hasCanonical = latestAnalysisResult.technical_signals?.has_canonical ?? false;
  const visibilityTone = getVisibilityTone(data.visibilityScore);
  const recommendationEvidence = latestAnalysisResult.recommendation_evidence_summary;
  const weakCategoriesAll = (latestAnalysisResult.category_grades || []).filter((grade) => grade.score < 70);
  const weakCategories = weakCategoriesAll.slice(0, 3);
  const weakCategoryTokens = weakCategoriesAll
    .map((grade) => String(grade.label || '').toLowerCase())
    .filter(Boolean)
    .flatMap((label) => [label, ...label.split(/[^a-z0-9]+/i).filter((token) => token.length >= 4)]);

  const dedupedRecommendations = Array.from(
    (latestAnalysisResult.recommendations || []).reduce((acc, issue) => {
      const key = `${String(issue.category || '').toLowerCase().trim()}|${String(issue.title || '').toLowerCase().trim()}`;
      if (!key || key === '|') return acc;
      const existing = acc.get(key);
      if (!existing) {
        acc.set(key, issue);
        return acc;
      }
      const existingEvidence = Number(existing.verified_evidence_count || 0);
      const currentEvidence = Number(issue.verified_evidence_count || 0);
      if (currentEvidence > existingEvidence) acc.set(key, issue);
      return acc;
    }, new Map<string, any>()).values()
  );


  const rankedIssues = dedupedRecommendations.map((issue) => {
    const issueText = `${issue.category || ''} ${issue.title || ''} ${issue.description || ''}`.toLowerCase();
    const priorityWeight = issue.priority === 'high' ? 40 : issue.priority === 'medium' ? 25 : 10;
    const verificationWeight = issue.verification_status === 'verified' ? 25 : issue.verification_status === 'partial' ? 15 : 5;
    const verifiedEvidenceCount = Number(issue.verified_evidence_count || 0);
    const totalEvidenceRefs = Number(issue.total_evidence_refs || 0);
    const evidenceWeight = Math.min(20, verifiedEvidenceCount * 8);
    const alignedToWeakCategory = weakCategoryTokens.some((token) => token && issueText.includes(token));
    const weakCategoryWeight = alignedToWeakCategory ? 15 : 0;
    const peerCritiquePenalty =
      String(issue.category || '').toLowerCase().includes('peer critique') && verifiedEvidenceCount === 0
        ? -8
        : 0;
    const rankScore = priorityWeight + verificationWeight + evidenceWeight + weakCategoryWeight + peerCritiquePenalty;

    const rankReason = [
      `p:${priorityWeight}`,
      `v:${verificationWeight}`,
      `e:${evidenceWeight}`,
      weakCategoryWeight > 0 ? `w:${weakCategoryWeight}` : null,
      peerCritiquePenalty < 0 ? `peer:${peerCritiquePenalty}` : null,
      `${verifiedEvidenceCount}/${totalEvidenceRefs} refs`,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      ...issue,
      __rank: {
        score: rankScore,
        reason: rankReason,
      },
    };
  });

  const evidenceBackedIssues = rankedIssues.filter((issue) => Number(issue.total_evidence_refs || 0) > 0);
  const advisoryIssues = rankedIssues.filter((issue) => Number(issue.total_evidence_refs || 0) <= 0);

  const issuePool = showAdvisory ? rankedIssues : evidenceBackedIssues;

  const topIssues = issuePool
    .sort((left, right) => {
      const diff = Number(right.__rank?.score || 0) - Number(left.__rank?.score || 0);
      if (diff !== 0) return diff;
      return String(left.title || '').localeCompare(String(right.title || ''));
    })
    .slice(0, 5);

  const previousPoint = data.trendData.length > 1 ? data.trendData[data.trendData.length - 2] : null;
  const scoreDelta = previousPoint ? data.visibilityScore - previousPoint.visibility : 0;
  const citationWins = scoreDelta > 0 ? Math.min(3, Math.max(1, Math.round(scoreDelta / 3))) : 0;
  const citationLosses = scoreDelta < 0 ? Math.min(3, Math.max(1, Math.round(Math.abs(scoreDelta) / 3))) : 0;
  const verifiedImprovements = Number(recommendationEvidence?.verified_recommendations || 0);
  const pendingFixes = Math.max(0, topIssues.length - Math.min(verifiedImprovements, topIssues.length));
  const failedToImprove = scoreDelta < 0 ? 1 : 0;
  const nextBestAction = topIssues[0]?.title || "Add structured answer blocks to service pages";
  const competitorAccess = canAccess("competitorTracking", (latestAnalysisResult.analysis_tier || "observer") as any);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getIssueSectionId = (issue: { category?: string; title?: string; description?: string }) => {
    const text = `${issue.category || ''} ${issue.title || ''} ${issue.description || ''}`.toLowerCase();
    if (text.includes('schema') || text.includes('json-ld') || text.includes('structured')) return 'section-grades';
    if (text.includes('readability') || text.includes('citability') || text.includes('peer critique')) return 'section-analysis';
    return 'section-priority';
  };

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#0f1d2f]/95 via-[#111827]/95 to-[#241a2f]/90 p-6 shadow-2xl sm:p-8">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 sm:p-5">
          <div className="text-[11px] uppercase tracking-wide text-white/55">Audit snapshot</div>
          <div className="mt-2 text-4xl sm:text-5xl font-black text-white tabular-nums">
            {hasLiveSnapshotScore ? (
              <>
                {data.visibilityScore}
                <span className="text-base text-white/55">/100</span>
              </>
            ) : (
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 sm:p-5">
          <div className="text-[11px] uppercase tracking-wide text-white/55">Audit snapshot</div>
          <div className="mt-2 text-4xl sm:text-5xl font-black text-white tabular-nums">
            {hasLiveSnapshotScore ? (
              <>
                {data.visibilityScore}
                <span className="text-base text-white/55">/100</span>
              </>
            ) : (
              <span className="text-xl sm:text-2xl text-amber-100">Live run required</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs ${hasLiveSnapshotScore ? visibilityTone.classes : "border-amber-300/30 bg-amber-500/10 text-amber-200"}`}>
              {hasLiveSnapshotScore ? visibilityTone.label : "Cached preview"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/75">
              {data.recommendationCount} issues found
            </span>
            {recommendationEvidence ? (
              <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200">
                {Math.round(Number(recommendationEvidence.evidence_coverage_percent || 0))}% evidence coverage
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-6 text-white/65">
            {hasLiveSnapshotScore
              ? "This summary stays pinned above all sections so your score and immediate problems are always visible first."
              : "This result came from cache. Run a live audit to publish a current, share-safe score."}
          </p>

          <div className="mt-4">
            <AutoScoreFixWidget auditResult={latestAnalysisResult as any} onOpen={onOpenAutoScoreFix} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-wide text-white/55">What needs fixing now</div>
              {advisoryIssues.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAdvisory((v) => !v)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/65 transition hover:text-white/80"
                >
                  {showAdvisory ? 'Hide advisory' : `Show advisory (${advisoryIssues.length})`}
                </button>
              ) : null}
            </div>
            {topIssues.length ? (
              <ul className="space-y-1.5">
                {topIssues.map((issue, index) => (
                  <li key={issue.id || issue.title}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(getIssueSectionId(issue))}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-left transition hover:border-cyan-300/30 hover:bg-cyan-500/[0.08]"
                      title={`Ranked #${index + 1}: ${issue.__rank?.reason || ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 text-xs text-white/85">
                        <span className="font-medium leading-snug">{index + 1}. {issue.title}</span>
                        <span className="text-[10px] text-cyan-200 shrink-0">rank {Number(issue.__rank?.score || 0)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/60">
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/[0.1] px-1.5 py-0.5 text-cyan-100">
                          {issue.priority || 'medium'}
                        </span>
                        {issue.verification_status ? (
                          <span className={`rounded-full border px-1.5 py-0.5 ${
                            issue.verification_status === 'verified'
                              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                              : issue.verification_status === 'partial'
                              ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                              : 'border-red-400/30 bg-red-400/10 text-red-200'
                          }`}>
                            {issue.verification_status}
                          </span>
                        ) : null}
                        {Number(issue.total_evidence_refs || 0) > 0 ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                            evidence {Number(issue.verified_evidence_count || 0)}/{Number(issue.total_evidence_refs || 0)}
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-100">
                            no scanned evidence refs
                          </span>
                        )}
                        {issue.category ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                            {issue.category}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-white/65">
                {advisoryIssues.length > 0
                  ? 'No evidence-backed issues in this payload. Advisory findings are available via Show advisory.'
                  : 'No high-priority issues returned in this audit payload.'}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-wide text-white/55 mb-2">Weak categories</div>
            {weakCategories.length ? (
              <ul className="space-y-1.5">
                {weakCategories.map((grade) => (
                  <li key={grade.label}>
                    <button
                      type="button"
                      onClick={() => scrollToSection('section-grades')}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-left transition hover:border-amber-300/30 hover:bg-amber-500/[0.08]"
                    >
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="pr-2">{grade.label}</span>
                        <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                          {grade.score}/100
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/60">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5">grade {grade.grade}</span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5">source category_grades</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-white/65">No weak categories detected below 70 in this run.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/12 bg-white/[0.04] p-4 sm:p-5">
        <div className="text-[11px] uppercase tracking-wide text-white/55">Since your last audit</div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">Movement</p>
            <div className="space-y-1 text-sm text-white/80">
              <p className="flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />+{citationWins} citation wins</p>
              <p className="flex items-center gap-1.5"><ArrowDownRight className="h-3.5 w-3.5 text-rose-300" />-{citationLosses} citation loss</p>
              <p className="text-white/65">Competitor pressure: {latestAnalysisResult.competitor_hint?.is_potential_competitor ? "increased" : "stable"}</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">What changed</p>
            <ul className="list-disc pl-4 text-sm text-white/75 space-y-1">
              <li>entity clarity {weakCategoryTokens.some((t) => t.includes("entity")) ? "still weak" : "improved"}</li>
              <li>structure {weakCategoryTokens.some((t) => t.includes("structure")) ? "still weak" : "improved"}</li>
              <li>metadata mismatch {hasLiveSnapshotScore && hasCanonical ? "reduced" : "remains"}</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">Competitor movement</p>
            <p className="text-sm text-white/75">
              {competitorAccess === false
                ? "Unlock competitor source intelligence to see who gained citations and why."
                : latestAnalysisResult.competitor_hint?.match_reasons?.[0]
                ? `Competitor signal: ${latestAnalysisResult.competitor_hint.match_reasons[0]}.`
                : "Competitor A gained source coverage while your extraction signals remain mixed."}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">Fix queue</p>
            <div className="space-y-1 text-sm text-white/80">
              <p>{pendingFixes} fixes pending</p>
              <p>{verifiedImprovements} verified improvements</p>
              <p>{failedToImprove} failed to improve score</p>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
          <p className="text-xs uppercase tracking-wide text-cyan-200 mb-1">Next best action</p>
          <p className="text-sm font-semibold text-white">{nextBestAction}</p>
          <p className="text-xs text-cyan-100/80 mt-1">Expected impact: increase citation readiness and extraction confidence.</p>
        </div>
      </div>
    </section>
  );
}

function AutoScoreFixPipelinePanel({
  jobs,
  loading,
  onOpenAutoScoreFix,
}: {
  jobs: AutoScoreFixPipelineJob[];
  loading: boolean;
  onOpenAutoScoreFix: () => void;
}) {
  const scheduled = jobs.filter((job) => String(job.rescan_status || '') === 'scheduled').length;
  const completed = jobs.filter((job) => String(job.rescan_status || '') === 'completed').length;
  const implementationMins = jobs
    .map((job) => Number(job.implementation_duration_minutes || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const avgImplementationMins = implementationMins.length
    ? Math.round(implementationMins.reduce((acc, value) => acc + value, 0) / implementationMins.length)
    : 0;

  const recentCompleted = jobs
    .filter((job) => String(job.rescan_status || '') === 'completed')
    .sort((left, right) => {
                : latestAnalysisResult.competitor_hint?.match_reasons?.[0]
                ? `Competitor signal: ${latestAnalysisResult.competitor_hint.match_reasons[0]}.`
                : "Competitor A gained source coverage while your extraction signals remain mixed."}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">Fix queue</p>
            <div className="space-y-1 text-sm text-white/80">
              <p>{pendingFixes} fixes pending</p>
              <p>{verifiedImprovements} verified improvements</p>
              <p>{failedToImprove} failed to improve score</p>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
          <p className="text-xs uppercase tracking-wide text-cyan-200 mb-1">Next best action</p>
          <p className="text-sm font-semibold text-white">{nextBestAction}</p>
          <p className="text-xs text-cyan-100/80 mt-1">Expected impact: increase citation readiness and extraction confidence.</p>
        </div>
      </div>
    </section>
  );
}

function AutoScoreFixPipelinePanel({
  jobs,
  loading,
  onOpenAutoScoreFix,
}: {
  jobs: AutoScoreFixPipelineJob[];
  loading: boolean;
  onOpenAutoScoreFix: () => void;
}) {
  const scheduled = jobs.filter((job) => String(job.rescan_status || '') === 'scheduled').length;
  const completed = jobs.filter((job) => String(job.rescan_status || '') === 'completed').length;
  const implementationMins = jobs
    .map((job) => Number(job.implementation_duration_minutes || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const avgImplementationMins = implementationMins.length
    ? Math.round(implementationMins.reduce((acc, value) => acc + value, 0) / implementationMins.length)
    : 0;

  const recentCompleted = jobs
    .filter((job) => String(job.rescan_status || '') === 'completed')
    .sort((left, right) => {
      const leftTs = new Date(String(left.rescan_completed_at || left.updated_at || left.created_at || '')).getTime();
      const rightTs = new Date(String(right.rescan_completed_at || right.updated_at || right.created_at || '')).getTime();
      return rightTs - leftTs;
    })
    .slice(0, 3);

  const processing = jobs.filter((job) => {
    const status = String(job.status || '');
    const rescanStatus = String(job.rescan_status || '');
    return ['pending', 'generating', 'creating_pr', 'pending_approval', 'approved'].includes(status)
      || ['scheduled', 'running'].includes(rescanStatus);
  }).length;

  return (
    <section className="rounded-3xl border border-violet-300/20 bg-gradient-to-br from-[#0f1a2d]/95 via-[#111827]/95 to-[#251c31]/90 p-6 shadow-2xl sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/55">Auto Score Fix systems status</div>
          <h3 className="mt-2 text-xl sm:text-2xl font-bold text-white">Real pipeline status on live jobs</h3>
          <p className="mt-2 text-xs sm:text-sm text-white/60">
            Shows what is scheduled, what is done, average implementation time, and post-fix score movement from verification scans.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAutoScoreFix}
          className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/80 transition hover:text-white"
        >
          Open Auto Score Fix
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Scheduled</p>
          <p className="mt-2 text-2xl font-black text-cyan-200">{loading ? '…' : scheduled}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Done</p>
          <p className="mt-2 text-2xl font-black text-emerald-300">{loading ? '…' : completed}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">In progress</p>
          <p className="mt-2 text-2xl font-black text-amber-300">{loading ? '…' : processing}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/55">Avg implement time</p>
          <p className="mt-2 text-2xl font-black text-violet-200">{loading ? '…' : avgImplementationMins > 0 ? `${avgImplementationMins}m` : '—'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[11px] uppercase tracking-wide text-white/55 mb-2">Recent post-fix score results</div>
        {loading ? (
          <p className="text-xs text-white/55">Loading pipeline jobs…</p>
        ) : recentCompleted.length === 0 ? (
          <p className="text-xs text-white/55">No completed post-fix verification scans yet.</p>
        ) : (
          <div className="space-y-2">
            {recentCompleted.map((job) => {
              const before = Number(job.score_before || 0);
              const after = Number(job.score_after || 0);
              const delta = Number(job.score_delta || (after - before));
              const deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
              const completedAt = job.rescan_completed_at ? new Date(job.rescan_completed_at).toLocaleString() : 'completed';
              return (
                <div key={job.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-white/85 truncate">{job.target_url}</p>
                    <p className="text-white/50">{completedAt}</p>
                  </div>
                  <div className="flex items-center gap-2 text-white/85 tabular-nums">
                    <span>{before.toFixed(1)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-white/40" />
                    <span>{after.toFixed(1)}</span>
                    <span className={`rounded-full border px-2 py-0.5 ${delta >= 0 ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-300' : 'border-red-300/30 bg-red-500/10 text-red-300'}`}>
                      {deltaLabel}
                    </span>
                    {toSafeHref(job.pr_url) ? (
                      <a href={toSafeHref(job.pr_url) || undefined} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                        PR
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function AIPlatformScores({
  scores,
  modelScores,
}: {
  scores?: { chatgpt: number; perplexity: number; google_ai: number; claude: number };
  modelScores?: AIModelScore[];
}) {
  if (!scores && (!modelScores || modelScores.length === 0)) return null;

  const platforms = [
    { key: "chatgpt", name: "ChatGPT", value: scores.chatgpt, icon: "🤖" },
    { key: "perplexity", name: "Perplexity", value: scores.perplexity, icon: "🧭" },
    { key: "google_ai", name: "Google AI", value: scores.google_ai, icon: "🔎" },
    { key: "claude", name: "Claude", value: scores.claude, icon: "🧠" },
  ] as const;

  return (
    <section className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
      <div className="flex items-center gap-2 mb-5">
        <Eye className="h-4 w-4 text-white/75" />
        <h3 className="text-lg font-semibold text-white">AI scoring coverage</h3>
        <InfoHint text="Platform scores show how visible your page is likely to be across each AI engine based on this exact audit payload." />
      </div>
      {scores && (
        <>
          <p className="mb-3 text-xs uppercase tracking-wide text-white/45">Platform visibility scores</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {platforms.map((platform) => (
              <div key={platform.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none" aria-hidden="true">{platform.icon}</span>
                  <p className="text-sm font-medium text-white/65">{platform.name}</p>
                </div>
                <p className="mt-2 text-3xl font-bold text-white">{platform.value}<span className="text-sm text-white/45">/100</span></p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-white/80 to-white/30"
                    style={{ width: `${Math.max(0, Math.min(100, platform.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modelScores && modelScores.length > 0 && (
        <>
          <p className="mt-6 mb-3 text-xs uppercase tracking-wide text-white/45">Methodology benchmark model scores</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {modelScores.map((model) => (
              <div key={model.model_id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white/65">{model.model_label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{model.score}<span className="text-sm text-white/45">/100</span></p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300/80 to-violet-300/30"
                    style={{ width: `${Math.max(0, Math.min(100, model.score))}%` }}
                  />
                </div>
                {model.used_in_pipeline && (
                  <span className="mt-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
                    Used in this audit
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function VisibilityTrend({
  data,
  currentScore,
  totalAudits,
  onRefresh,
  refreshing,
  categoryGrades,
  topCategoryInsight,
  lowestCategoryInsight,
  analyticsSeries,
}: {
  data: TrendPoint[];
  currentScore: number;
  totalAudits: number;
  onRefresh: () => void;
  refreshing: boolean;
  categoryGrades?: Array<{ label: string; score: number; summary?: string }>;
  topCategoryInsight?: CategoryInsight | null;
  lowestCategoryInsight?: CategoryInsight | null;
  analyticsSeries?: number[];
}) {
  const analytics = useMemo(() => {
    const fallbackValues = data
      .map((point) => Number(point.visibility))
      .filter((value) => Number.isFinite(value));

    const values = (analyticsSeries && analyticsSeries.length > 0 ? analyticsSeries : fallbackValues)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const averageScore = values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : currentScore;

    const maxScore = values.length ? Math.max(...values) : currentScore;
    const minScore = values.length ? Math.min(...values) : currentScore;
    const spread = Math.max(0, maxScore - minScore);

    const variance = values.length
      ? values.reduce((sum, value) => sum + Math.pow(value - averageScore, 2), 0) / values.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const stabilityIndex = Math.max(0, Math.min(100, Math.round(100 - stdDev * 3)));

    const half = Math.floor(values.length / 2);
    const previousWindow = values.slice(0, half);
    const recentWindow = values.slice(Math.max(0, values.length - Math.max(half, 1)));

    const previousAvg = previousWindow.length
      ? previousWindow.reduce((sum, value) => sum + value, 0) / previousWindow.length
      : averageScore;
    const recentAvg = recentWindow.length
      ? recentWindow.reduce((sum, value) => sum + value, 0) / recentWindow.length
      : averageScore;
    const momentum = Math.round((recentAvg - previousAvg) * 10) / 10;

    const scoringRuns = values.filter((value) => value >= 80).length;
    const highScoreRate = values.length ? Math.round((scoringRuns / values.length) * 100) : 0;

    return {
      averageScore,
      spread,
      stabilityIndex,
      momentum,
      highScoreRate,
    };
  }, [analyticsSeries, currentScore, data]);

  const categoryInsights = useMemo(() => {
    if (topCategoryInsight || lowestCategoryInsight) {
      return {
        top: topCategoryInsight
          ? {
              label: topCategoryInsight.label,
              score: topCategoryInsight.score,
              summary: topCategoryInsight.summary,
            }
          : null,
        lowest: lowestCategoryInsight
          ? {
              label: lowestCategoryInsight.label,
              score: lowestCategoryInsight.score,
              summary: lowestCategoryInsight.summary,
            }
          : null,
      };
    }

    const normalized = (categoryGrades || [])
      .filter((grade) => typeof grade?.score === "number" && typeof grade?.label === "string")
      .map((grade) => ({
        label: grade.label,
        score: grade.score,
        summary: grade.summary || "",
      }));

    if (!normalized.length) {
      return {
        top: null as null | { label: string; score: number; summary: string },
        lowest: null as null | { label: string; score: number; summary: string },
      };
    }

    const sorted = [...normalized].sort((a, b) => b.score - a.score);
    return {
      top: sorted[0],
      lowest: sorted[sorted.length - 1],
    };
  }, [categoryGrades, lowestCategoryInsight, topCategoryInsight]);

  const exportCsv = () => {
    const rows = data.map((point) => `${point.date},${point.visibility},${point.url || ""}`);
    const csv = `date,visibility,url\n${rows.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "aivis-visibility-trend.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-white/75" />
            <h3 className="text-lg font-semibold text-white">Visibility trend</h3>
          </div>
          <p className="mt-1 text-xs text-white/45">
            {totalAudits <= 1 ? "Run more audits to establish trend depth." : `${totalAudits} audits in trend memory.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-5">
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-white/45">Current</div>
            <div className="mt-1 text-2xl font-bold text-white">{currentScore}%</div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 xl:col-span-2">
          <p className="text-[10px] uppercase tracking-wide text-white/45">Average (90d)</p>
          <p className="mt-1 text-lg font-semibold text-white">{analytics.averageScore}%</p>
          <p className="text-[11px] text-white/50">Trend baseline from all audits shown</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 xl:col-span-2">
          <p className="text-[10px] uppercase tracking-wide text-white/45">Momentum</p>
          <p className="mt-1 text-lg font-semibold text-white inline-flex items-center gap-1">
            {analytics.momentum >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-300" /> : <ArrowDownRight className="h-4 w-4 text-red-300" />}
            {analytics.momentum >= 0 ? "+" : ""}{analytics.momentum}
          </p>
          <p className="text-[11px] text-white/50">Recent half vs prior half average</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 xl:col-span-2">
          <p className="text-[10px] uppercase tracking-wide text-white/45">Stability index</p>
          <p className="mt-1 text-lg font-semibold text-white">{analytics.stabilityIndex}/100</p>
          <p className="text-[11px] text-white/50">Lower volatility = higher confidence</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 xl:col-span-3 xl:min-w-0">
          <p className="text-[10px] leading-4 uppercase tracking-wide text-white/45">Top category</p>
          <p className="mt-1 text-sm font-semibold leading-6 [overflow-wrap:anywhere] text-emerald-200">{categoryInsights.top ? `${categoryInsights.top.label} (${categoryInsights.top.score})` : "—"}</p>
          <p className="text-[11px] leading-5 [overflow-wrap:anywhere] whitespace-normal text-white/50">{categoryInsights.top?.summary || "Run an audit to populate category intelligence."}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 xl:col-span-3 xl:min-w-0">
          <p className="text-[10px] leading-4 uppercase tracking-wide text-white/45">Lowest category</p>
          <p className="mt-1 text-sm font-semibold leading-6 [overflow-wrap:anywhere] text-amber-200">{categoryInsights.lowest ? `${categoryInsights.lowest.label} (${categoryInsights.lowest.score})` : "—"}</p>
          <p className="text-[11px] leading-5 [overflow-wrap:anywhere] whitespace-normal text-white/50">{categoryInsights.lowest?.summary || "Run an audit to surface next best fix target."}</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/65 flex flex-wrap items-center gap-4">
        <span>High-score hit rate (80+): <span className="font-semibold text-white/85">{analytics.highScoreRate}%</span></span>
        <span>Score spread: <span className="font-semibold text-white/85">{analytics.spread} pts</span></span>
        <span>Decision signal: <span className="font-semibold text-white/85">{analytics.stabilityIndex >= 75 ? "Stable" : analytics.stabilityIndex >= 55 ? "Watch" : "Volatile"}</span></span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="uniqueTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 5" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "rgba(7,10,19,0.96)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                color: "white",
              }}
            />
            <Area type="monotone" dataKey="visibility" stroke="rgba(255,255,255,0.9)" fill="url(#uniqueTrendFill)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function PlatformComparisonSection() {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/65">
            <Sparkles className="h-3.5 w-3.5" />
            Platform comparison
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">How do answer engines differ in source selection?</h2>
          <p className="mt-3 text-sm leading-7 text-white/60">
            Each answer engine applies distinct retrieval and citation logic. Understanding these differences
            helps teams optimize for cross-platform visibility instead of a single model.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              platform: "ChatGPT",
              detail:
                "Prioritizes well-structured content with clear factual claims and complete JSON-LD schema. Pages with explicit entity relationships and concise answer-format sections perform best. Heading hierarchy and internal trust links improve extraction confidence.",
            },
            {
              platform: "Perplexity",
              detail:
                "Emphasizes source diversity and citation density when generating answers. Favors pages with topical authority indicators, breadth of coverage, and explicit data points. Multi-entity schema graphs increase the likelihood of direct citation.",
            },
            {
              platform: "Claude",
              detail:
                "Weights content depth and logical coherence when selecting sources. Pages with consistent information architecture, well-scoped claims, and balanced section depth produce higher extraction rates. Avoids promotional language in favor of factual precision.",
            },
            {
              platform: "Google AI Overviews",
              detail:
                "Combines traditional ranking signals with structured data evaluation. Canonical tags, internal link density, page speed, and schema completeness all affect selection probability. Pages that already rank well organically benefit from structured overlay improvements.",
            },
          ].map((item) => (
            <div key={item.platform} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-base font-semibold text-white">{item.platform}</h3>
              <div className="mt-2 text-sm leading-7 text-white/60">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScoringMethodologySection() {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/65">
            <Sparkles className="h-3.5 w-3.5" />
            Scoring methodology
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">How does AI visibility scoring work?</h2>
          <p className="mt-3 text-sm leading-7 text-white/60">
            AiVIS uses evidence-grounded analysis across six weighted categories to produce a validated
            0&ndash;100 visibility score. Each category grade is tied to real page signals extracted during
            the live crawl, not generic best-practice checklists.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: "Content Depth & Quality",
              detail:
                "Evaluates whether the page provides enough topical depth, factual specificity, and lexical diversity for retrieval models to confidently extract and cite meaningful passages. Pages with thin content, vague explanations, or short sections score lower because answer engines have less material to quote.",
            },
            {
              title: "Heading Structure & H1 Integrity",
              detail:
                "Checks for exactly one H1, a clear hierarchy of H2 and H3 subheadings, and question-format headings that align with how answer engines parse document structure. Strong heading hierarchies help models identify distinct content sections and map answers to specific parts of the page.",
            },
            {
              title: "Schema & Structured Data",
              detail:
                "Measures JSON-LD coverage, entity completeness, and relationship accuracy across schema types including Organization, FAQPage, WebSite, SoftwareApplication, and Product. Quality matters more than quantity. Each schema block must contain accurate properties that models can cross-reference.",
            },
            {
              title: "Meta Tags & Open Graph",
              detail:
                "Validates title length, meta description clarity, canonical tag, Open Graph completeness, and Twitter Card markup. These signals define how AI systems identify the page topic, scope, and authorship before deeper content extraction begins.",
            },
            {
              title: "Technical SEO Foundations",
              detail:
                "Assesses HTTPS enforcement, internal link density, page load performance, image accessibility, canonical correctness, and semantic HTML landmarks. These baseline signals determine whether AI crawlers can reach and parse your content reliably.",
            },
            {
              title: "AI Readability & Citability",
              detail:
                "The composite category that measures end-to-end answer engine readiness: can a model parse the page, verify claims through structured markup, extract quotable passages, and cite the source with confidence? This category rewards pages that combine depth, structure, schema, and trust signals cohesively.",
            },
          ].map((cat) => (
            <div key={cat.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-base font-semibold text-white">{cat.title}</h3>
              <div className="mt-2 text-sm leading-7 text-white/60">{cat.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CitationSignalsSection() {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/65">
            <Sparkles className="h-3.5 w-3.5" />
            Optimization signals
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">What signals matter for AI citation readiness?</h2>
          <p className="mt-3 text-sm leading-7 text-white/60">
            Answer engines evaluate dozens of structural and content signals before deciding whether to quote
            a page. These are the highest-impact areas that separate cited sources from invisible ones.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              question: "Why do word count and topical depth affect citation rates?",
              answer:
                "Retrieval models need enough material to extract confident, verifiable answers. Pages under 600 words rarely produce quotable passages. Pages above 1,200 words with clear topic coverage give models multiple extraction points and reduce ambiguity during generation.",
            },
            {
              question: "How do question-format headings improve answer engine performance?",
              answer:
                "When H2 headings match the phrasing users type into AI systems, retrieval models can map queries to content sections directly. Question-format headings act as natural anchor points that reduce extraction cost and increase the likelihood of exact-match citation.",
            },
            {
              question: "What role does schema markup play beyond traditional SEO?",
              answer:
                "For AI systems, schema provides machine-readable entity context that body text alone cannot deliver. Organization, FAQPage, and Product schemas let models verify authorship, pricing, and factual claims without relying on inference. Pages with complete schema graphs are easier for models to trust and cite.",
            },
            {
              question: "How should teams prioritize fixes after an audit?",
              answer:
                "Start with high-severity, low-effort recommendations: missing schema blocks, thin meta descriptions, and broken heading hierarchy. Then address content depth gaps. Finally, optimize for AI readability with answer-style sections, explicit entity framing, and internal trust-page links. Re-audit after each fix cluster to measure category movement.",
            },
          ].map((item) => (
            <div key={item.question} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-base font-semibold text-white">{item.question}</h3>
              <div className="mt-2 text-sm leading-7 text-white/60">{item.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeFaqSection() {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/65">
            <Sparkles className="h-3.5 w-3.5" />
            Frequently asked
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Clear answers about AiVIS</h2>
          <p className="mt-3 text-sm leading-7 text-white/60">
            The practical questions people ask before they trust the score enough to act on it.
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-base font-semibold text-white">{item.question}</h3>
              <div className="mt-2 text-sm leading-7 text-white/60">{item.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const steps = [
    {
      title: "Set the goal",
      detail: "Choose a real objective: citations, better structure, better category grades, or a competitor gap you want to close.",
    },
    {
      title: "Run a baseline audit",
      detail: "Audit the real page first so the next changes have a measurable before-state.",
    },
    {
      title: "Fix evidence-backed issues",
      detail: "Prioritize the recommendations with the strongest score and structure impact before cosmetic edits.",
    },
    {
      title: "Re-audit and compare",
      detail: "Use the trend and module pages to validate movement instead of guessing whether the changes worked.",
    },
  ];

  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/65">
            <Sparkles className="h-3.5 w-3.5" />
            Operational workflow
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Run AiVIS like a system, not a one-off scan</h2>
          <p className="mt-3 text-sm leading-7 text-white/60">
            The value compounds when the audit, the fixes, and the re-checks all stay connected.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-[10px] uppercase tracking-wide text-white/45">Step {index + 1}</div>
              <h3 className="mt-2 text-base font-semibold text-white">{step.title}</h3>
              <div className="mt-2 text-sm leading-7 text-white/60">{step.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Returning User Quick Panel ─────────────────────────────────────────────

function ReturningUserQuickPanel({
  totalAudits,
  totalScans,
  scoreSeries,
  topCategory,
  lowestCategory,
}: {
  totalAudits: number;
  totalScans: number;
  scoreSeries: number[];
  topCategory: CategoryInsight | null;
  lowestCategory: CategoryInsight | null;
}) {
  if (totalAudits < 1 && totalScans < 1) return null;

  const avgScore = scoreSeries.length
    ? Math.round(scoreSeries.reduce((a, b) => a + b, 0) / scoreSeries.length)
    : 0;

  const trend =
    scoreSeries.length >= 2
      ? scoreSeries[scoreSeries.length - 1] - scoreSeries[Math.max(0, scoreSeries.length - 3)]
      : 0;

  return (
    <section className="px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-3xl border border-cyan-300/15 bg-gradient-to-r from-cyan-500/[0.06] via-[#111827]/95 to-violet-500/[0.06] p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Your Visibility Overview</h2>
            <p className="text-xs text-white/45 mt-1">Performance snapshot across all audits</p>
          </div>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Full Analytics
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/50">
              <Activity className="h-3.5 w-3.5" />
              Total Scan Runs
            </div>
            <div className="mt-2 text-3xl font-black text-white tabular-nums">{Math.max(totalScans, totalAudits)}</div>
            <p className="mt-1 text-xs text-white/50">{totalAudits} completed audit records saved</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/50">
              <Target className="h-3.5 w-3.5" />
              Avg Score
            </div>
            <div className="mt-2 text-3xl font-black text-white tabular-nums">
              {avgScore}<span className="text-base text-white/45">/100</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {trend > 0 ? (
                <span className="flex items-center gap-1 text-xs text-emerald-300">
                  <TrendingUp className="h-3 w-3" /> +{trend} pts
                </span>
              ) : trend < 0 ? (
                <span className="flex items-center gap-1 text-xs text-red-300">
                  <ArrowDownRight className="h-3 w-3" /> {trend} pts
                </span>
              ) : (
                <span className="text-xs text-white/50">Stable</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.04] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/50">
              <Award className="h-3.5 w-3.5 text-emerald-300" />
              Strongest
            </div>
            {topCategory ? (
              <>
                <div className="mt-2 text-sm font-semibold text-white">{topCategory.label}</div>
                <div className="mt-1 text-xs text-emerald-300">{topCategory.score}/100 avg</div>
              </>
            ) : (
              <div className="mt-2 text-xs text-white/45">Run an audit to see</div>
            )}
          </div>

          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/50">
              <AlertCircle className="h-3.5 w-3.5 text-amber-300" />
              Fix Next
            </div>
            {lowestCategory ? (
              <>
                <div className="mt-2 text-sm font-semibold text-white">{lowestCategory.label}</div>
                <div className="mt-1 text-xs text-amber-300">{lowestCategory.score}/100 avg</div>
              </>
            ) : (
              <div className="mt-2 text-xs text-white/45">Run an audit to see</div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55 transition hover:text-white/80"
          >
            <FileText className="h-3 w-3" />
            Reports
          </Link>
          <Link
            to="/competitors"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55 transition hover:text-white/80"
          >
            <Users className="h-3 w-3" />
            Competitors
          </Link>
          <Link
            to="/keywords"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55 transition hover:text-white/80"
          >
            <Target className="h-3 w-3" />
            Keywords
          </Link>
          <Link
            to="/citations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55 transition hover:text-white/80"
          >
            <Eye className="h-3 w-3" />
            Citations
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Audit Preview Teaser (new users) ───────────────────────────────────────

function AuditPreviewTeaser() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/[0.08] px-3 py-1 text-[11px] uppercase tracking-wide text-cyan-200/80">
          <Eye className="h-3.5 w-3.5" />
          What your audit delivers
        </div>
        <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
          More than a score — a complete visibility assessment
        </h2>
        <p className="mt-3 mx-auto max-w-2xl text-sm leading-7 text-white/55">
          Every audit returns structured, evidence-backed findings that show exactly why AI answer engines
          can or cannot parse, trust, and cite your page.
        </p>
      </div>

      <div className="mx-auto max-w-6xl grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {([
          {
            icon: Target,
            title: "0–100 Visibility Score",
            detail:
              "A single number that captures how ready your page is for AI extraction, citation, and retrieval across all major answer engines.",
            accent: "border-cyan-400/20 bg-cyan-500/[0.06]",
          },
          {
            icon: BarChart3,
            title: "A–F Category Grades",
            detail:
              "Six scored categories — content depth, heading structure, schema markup, meta tags, technical SEO, and AI readability — each with actionable context.",
            accent: "border-violet-400/20 bg-violet-500/[0.06]",
          },
          {
            icon: CheckCircle2,
            title: "8–12 Priority Recommendations",
            detail:
              "Evidence-backed actions ranked by impact. Each recommendation is tied to real crawl findings, not generic checklists.",
            accent: "border-emerald-400/20 bg-emerald-500/[0.06]",
          },
          {
            icon: Globe,
            title: "AI Platform Coverage",
            detail:
              "Per-platform readiness scores for ChatGPT, Perplexity, Claude, and Google AI Overviews. See where you're visible and where you're not.",
            accent: "border-amber-400/20 bg-amber-500/[0.06]",
          },
          {
            icon: Shield,
            title: "Security & Threat Intel",
            detail:
              "Private IP exposure checks, HTTPS enforcement, internal path leaks, and crypto signal detection. Enterprise-grade safety baseline.",
            accent: "border-red-400/20 bg-red-500/[0.06]",
          },
          {
            icon: FileText,
            title: "Export-Ready Reports",
            detail:
              "JSON and shareable snapshots ready for clients, stakeholders, or internal review. Every audit is reproducible and timestamped.",
            accent: "border-fuchsia-400/20 bg-fuchsia-500/[0.06]",
          },
        ] as const).map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className={`rounded-2xl border p-5 ${item.accent}`}>
              <Icon className="h-5 w-5 text-white/75 mb-3" />
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-white/55">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Agency Value Section ───────────────────────────────────────────────────

function AgencyValueSection() {
  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/65">
            <Briefcase className="h-3.5 w-3.5" />
            Built for teams &amp; agencies
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
            Scale AI visibility across your entire portfolio
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/60">
            AiVIS is designed for agencies and teams that manage multiple sites. Track, benchmark, fix, and
            prove improvement across every client — with auditable evidence at every step.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {([
            {
              icon: Globe,
              title: "Multi-Site Tracking",
              detail:
                "Monitor AI visibility across multiple client sites from a single dashboard. Track score trends, category movements, and fix velocity per target.",
            },
            {
              icon: FileText,
              title: "Client-Ready Reports",
              detail:
                "Export shareable audit snapshots with full score breakdowns, category grades, and priority actions. Ready for client reviews and stakeholder presentations.",
            },
            {
              icon: Users,
              title: "Competitive Benchmarking",
              detail:
                "Compare client pages against direct competitors. Surface visibility gaps and quantify the delta between your client and their market.",
            },
            {
              icon: RefreshCw,
              title: "Re-Audit & Prove Movement",
              detail:
                "Run the same URL after implementing fixes. The trend system tracks score deltas and category-level improvement — proof that changes worked.",
            },
            {
              icon: Activity,
              title: "API & Automation",
              detail:
                "Integrate AiVIS into your existing workflow via the REST API. Schedule audits, pull results programmatically, and trigger re-scans from CI/CD pipelines.",
            },
            {
              icon: Zap,
              title: "Auto Score Fix Pipeline",
              detail:
                "Signal and Score Fix tiers unlock automated remediation. AiVIS generates implementation PRs, tracks deployment, and re-audits to confirm score improvement.",
            },
          ] as const).map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <Icon className="h-5 w-5 text-white/65 mb-3" />
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-white/60">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HeroAnalyze({
  onAnalyze,
  onAnalyzeUpload,
  onClearAudit,
  isAnalyzing,
  hasResults,
  prefillUrl,
}: {
  onAnalyze: (url: string, opts?: { discoveryGoals?: string; scanMockData?: boolean }) => void;
  onAnalyzeUpload: (files: File[]) => void;
  onClearAudit: () => void;
  isAnalyzing: boolean;
  hasResults: boolean;
  prefillUrl?: string;
}) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [inputUrl, setInputUrl] = useState("");
  const [goals, setGoals] = useState("");
  const [scanMockData, setScanMockData] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const history = useAnalysisStore((s) => s.history);

  const uploadBatchLimit = user?.tier === "scorefix" ? 15 : user?.tier === "signal" ? 10 : meetsMinimumTier(user?.tier || 'observer', 'alignment') ? 5 : 1;

  const canUpload = meetsMinimumTier(user?.tier || 'observer', 'alignment');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("url");
    if (sharedUrl?.trim()) setInputUrl(sharedUrl.trim());
  }, []);

  useEffect(() => {
    if (!prefillUrl?.trim()) return;
    setMode("url");
    setInputUrl(prefillUrl.trim());
  }, [prefillUrl]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isAnalyzing) return;
    if (!isAuthenticated) {
      navigate("/auth?mode=signin");
      return;
    }

    if (mode === "upload") {
      if (!files.length) return;
      onAnalyzeUpload(files);
      return;
    }

    if (!inputUrl.trim()) return;
    onAnalyze(inputUrl.trim(), { discoveryGoals: goals.trim(), scanMockData });
  };

  return (
    <section className={`relative overflow-hidden ${hasResults ? "pt-10 pb-8" : "pt-10 pb-16 min-h-[90vh] flex items-center"}`}>
      {!hasResults && (
        <>
          <div className="pointer-events-none absolute -top-60 -left-40 h-[700px] w-[700px] rounded-full bg-cyan-500/[0.09] blur-[160px]" />
          <div className="pointer-events-none absolute -top-32 right-[-120px] h-[550px] w-[550px] rounded-full bg-violet-500/[0.08] blur-[140px]" />
          <div className="pointer-events-none absolute bottom-[-50px] left-1/2 -translate-x-1/2 h-[250px] w-[700px] rounded-full bg-fuchsia-500/[0.05] blur-[110px]" />
        </>
      )}

      <div className={`relative z-10 w-full ${hasResults ? "max-w-6xl mx-auto px-4" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"}`}>
        {!hasResults && (
          <div className="select-none">
            <div className="grid items-center gap-8 sm:grid-cols-[1fr_320px] lg:grid-cols-[1fr_400px] sm:gap-10 lg:gap-16">

              {/* ── Left: Headline + context ── */}
              <div>
                {/* Badge + logo */}
                <div className="mb-7 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/[0.08] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300/90">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Visibility Intelligence Audits
                  </div>
                  <img
                    src="/text-logo.png"
                    alt="AiVIS logo"
                    className="h-8 w-auto object-contain"
                    loading="eager"
                    decoding="async"
                  />
                </div>

                {/* H1 with gradient accent word */}
                <h1 className="text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-[40px] lg:text-5xl xl:text-[64px]">
                  Measure whether AI can
                  <br className="hidden sm:block" />
                  <span className="bg-gradient-to-r from-cyan-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    &nbsp;read, trust &amp; cite
                  </span>
                  <br />
                  your site
                </h1>

                <p className="mt-5 max-w-xl text-base leading-7 text-white/55 sm:text-[17px] sm:leading-8">
                  One audit returns a 0–100 visibility score, six category grades, and
                  evidence-backed fixes — ready to implement and re-audit.
                </p>

                {/* Platform coverage badges */}
                <div className="mt-7 flex flex-wrap gap-2">
                  {[
                    { name: "ChatGPT",    dot: "bg-emerald-400" },
                    { name: "Perplexity", dot: "bg-violet-400"  },
                    { name: "Claude",     dot: "bg-amber-400"   },
                    { name: "Google AI",  dot: "bg-cyan-400"    },
                  ].map((p) => (
                    <span
                      key={p.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
                      {p.name}
                    </span>
                  ))}
                </div>

                {/* Trust checklist */}
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {["6 scored categories", "8–12 fixes per audit", "Evidence-backed findings", "Export-ready reports"].map((stat) => (
                    <span key={stat} className="flex items-center gap-1.5 text-xs text-white/40">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                      {stat}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Right: Sample audit preview card ── */}
              <div className="hidden sm:block">
                <div className="card-smoke glass-bleed-cyan relative rounded-3xl p-6 shadow-[0_40px_100px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.035]">
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/[0.05] via-transparent to-violet-500/[0.06]" />
                  <div className="relative space-y-4">

                    {/* Card header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">Example Audit</span>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Live run</span>
                    </div>

                    {/* Score ring + site meta */}
                    <div className="flex items-center gap-4 border-b border-white/[0.06] pb-4">
                      <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center">
                        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 68 68">
                          <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                          <circle cx="34" cy="34" r="28" fill="none" stroke="url(#hsg)" strokeWidth="5" strokeLinecap="round" strokeDasharray="112.6 175.9" />
                          <defs>
                            <linearGradient id="hsg" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#22d3ee" />
                              <stop offset="100%" stopColor="#a78bfa" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <span className="relative text-xl font-black tabular-nums text-white">64</span>
                      </div>
                      <div>
                        <div className="font-mono text-[11px] text-white/30">example-site.com</div>
                        <div className="mt-1 text-sm font-bold text-amber-300">At Risk</div>
                        <div className="mt-0.5 text-[11px] text-white/35">3 high-priority issues</div>
                      </div>
                    </div>

                    {/* Category grade bars */}
                    <div className="space-y-2.5">
                      {[
                        { label: "Content Depth",  grade: "A", score: 78, grad: "from-emerald-400 to-emerald-300", gc: "text-emerald-400" },
                        { label: "Schema Markup",  grade: "C", score: 52, grad: "from-amber-400 to-orange-300",   gc: "text-amber-400"   },
                        { label: "Technical SEO",  grade: "B", score: 66, grad: "from-cyan-400 to-blue-300",      gc: "text-cyan-400"    },
                        { label: "AI Readability", grade: "D", score: 38, grad: "from-red-400 to-rose-300",       gc: "text-red-400"     },
                      ].map((cat) => (
                        <div key={cat.label} className="flex items-center gap-2.5">
                          <span className="w-24 shrink-0 truncate text-[10px] text-white/40">{cat.label}</span>
                          <div className="flex-1 overflow-hidden rounded-full bg-white/[0.07]" style={{ height: "6px" }}>
                            <div className={`h-full rounded-full bg-gradient-to-r ${cat.grad}`} style={{ width: `${cat.score}%` }} />
                          </div>
                          <span className={`w-4 text-right text-[10px] font-bold ${cat.gc}`}>{cat.grade}</span>
                        </div>
                      ))}
                    </div>

                    {/* Top findings */}
                    <div className="border-t border-white/[0.06] pt-3.5">
                      <div className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.13em] text-white/25">Top Findings</div>
                      <div className="space-y-2">
                        {[
                          { text: "Add FAQPage JSON-LD schema", hi: true  },
                          { text: "Meta description too short (22 chars)", hi: true  },
                          { text: "Add structured H2 heading hierarchy",  hi: false },
                        ].map((rec) => (
                          <div key={rec.text} className="flex items-start gap-2">
                            <span className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${rec.hi ? "bg-red-400" : "bg-amber-400"}`} />
                            <span className="text-[11px] leading-4 text-white/45">{rec.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={`${hasResults ? "" : "mt-12"}`}>
          {/* ── Mode toggle ──────────────────────────────────────── */}
          <div className="mb-4 flex justify-center">
            <div className={`inline-flex rounded-2xl border p-1 backdrop-blur-md ${!hasResults ? "border-white/[0.10] bg-[#0d1420]/80 shadow-[0_4px_24px_rgba(0,0,0,0.4)]" : "border-white/10 bg-[#111827]/80"}`}>
              <button
                type="button"
                onClick={() => setMode("url")}
                className={`relative px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 ${
                  mode === "url"
                    ? "bg-gradient-to-r from-cyan-500/25 to-violet-500/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/[0.08]"
                    : "text-white/45 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Analyze URL
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={`relative px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 ${
                  mode === "upload"
                    ? "bg-gradient-to-r from-cyan-500/25 to-violet-500/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/[0.08]"
                    : "text-white/45 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Upload &amp; Audit
                </span>
              </button>
            </div>
          </div>

          {/* ── Input container ───────────────────────────────────── */}
          <div className={`relative rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300 ${!hasResults ? "border-white/[0.10] bg-[#0b1422]/90 shadow-[0_20px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.03]" : "border-white/10 bg-[#111827]/90 shadow-2xl"}`}>
            {/* Accent glow bleed — top edge */}
            <div className="pointer-events-none absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" aria-hidden="true" />
            <div className="pointer-events-none absolute top-0 left-[8%] right-[8%] h-10 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(34,211,238,0.05),transparent)]" aria-hidden="true" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="hidden sm:flex ml-2 shrink-0">
                {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin text-cyan-300/80" /> : mode === "url" ? <Globe className="h-5 w-5 text-white/35" /> : <Upload className="h-5 w-5 text-white/35" />}
              </div>

              {mode === "url" ? (
                <>
                  <div className="flex-1 group relative rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 focus-within:border-cyan-400/30 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_24px_rgba(34,211,238,0.06)]">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="Enter your website URL to audit"
                        enterKeyHint="go"
                        disabled={isAnalyzing}
                        className="w-full rounded-xl bg-transparent px-4 py-3.5 pr-20 text-[15px] text-white placeholder:text-white/35 outline-none disabled:opacity-50 tracking-wide"
                      />
                      <div className="absolute right-2.5 flex items-center gap-0.5">
                        {inputUrl && (
                          <button
                            type="button"
                            onClick={() => setInputUrl("")}
                            disabled={isAnalyzing}
                            className="rounded-lg p-1.5 text-white/30 transition-all hover:bg-white/10 hover:text-white/70 disabled:opacity-40"
                            title="Clear"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text?.trim()) setInputUrl(text.trim());
                            } catch { /* clipboard permission denied */ }
                          }}
                          disabled={isAnalyzing}
                          className="rounded-lg p-1.5 text-white/30 transition-all hover:bg-white/10 hover:text-white/70 disabled:opacity-40"
                          title="Paste from clipboard"
                        >
                          <ClipboardPaste className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { onClearAudit(); setInputUrl(""); }}
                    disabled={isAnalyzing || !hasResults}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-white/50 transition-all hover:border-white/15 hover:bg-white/[0.08] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    New Audit
                  </button>
                </>
              ) : (
                <div className="flex-1 px-3 py-1.5">
                  {/* Primary file input — works on desktop & mobile file system / Google Drive / iCloud */}
                  <input
                    type="file"
                    multiple={uploadBatchLimit > 1}
                    accept=".html,.htm,.md,.markdown,.txt,.pdf,.docx,.js,.mjs,.cjs,.jsx,.ts,.tsx,.css,.json,.py,.php,.rb,.go,.java,.vue,.svelte,.png,.jpg,.jpeg,.webp"
                    disabled={isAnalyzing}
                    onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, Math.max(1, uploadBatchLimit)))}
                    className="w-full text-sm text-white/80 file:mr-3 file:rounded-lg file:border file:border-white/15 file:bg-[#171f31] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white/80"
                  />

                  {/* Mobile-friendly quick-pick buttons */}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-500/20 active:scale-[0.97]">
                      <FolderOpen className="h-3 w-3" />
                      Browse Files
                      <input
                        type="file"
                        multiple={uploadBatchLimit > 1}
                        accept=".html,.htm,.md,.markdown,.txt,.pdf,.docx,.js,.mjs,.cjs,.jsx,.ts,.tsx,.css,.json,.py,.php,.rb,.go,.java,.vue,.svelte,.png,.jpg,.jpeg,.webp"
                        disabled={isAnalyzing}
                        onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, Math.max(1, uploadBatchLimit)))}
                        className="hidden"
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-medium text-violet-200 transition hover:bg-violet-500/20 active:scale-[0.97]">
                      <Camera className="h-3 w-3" />
                      Capture Photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={isAnalyzing}
                        onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, Math.max(1, uploadBatchLimit)))}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {files.length > 0 && (
                    <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5">
                      <p className="text-[11px] font-medium text-emerald-200">
                        {files.length} file{files.length > 1 ? 's' : ''} selected
                        {files.length > 1 && (
                          <span className="text-emerald-300/60"> — {files.map(f => f.name).join(', ')}</span>
                        )}
                        {files.length === 1 && (
                          <span className="text-emerald-300/60"> — {files[0].name}</span>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-start gap-2 text-[11px] text-white/55">
                      <Globe className="mt-px h-3 w-3 shrink-0 text-cyan-400/70" />
                      <span><strong className="text-white/70">Website files</strong> (HTML, CSS, JS, code) — audited for structure, schema, meta tags & AI readability as if live</span>
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-white/55">
                      <FileText className="mt-px h-3 w-3 shrink-0 text-violet-400/70" />
                      <span><strong className="text-white/70">Content files</strong> (MD, PDF, DOCX, TXT) — audited for content quality, SEO title, hooks & de-AI score</span>
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-white/55">
                      <Eye className="mt-px h-3 w-3 shrink-0 text-fuchsia-400/70" />
                      <span><strong className="text-white/70">Images</strong> (PNG, JPG, WebP) — OCR-extracted then audited as content</span>
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-white/55">
                      <Smartphone className="mt-px h-3 w-3 shrink-0 text-amber-400/70" />
                      <span><strong className="text-white/70">Mobile</strong> — pick from device storage, Google Drive, iCloud, or Dropbox via your system file picker</span>
                    </div>
                    <p className="text-[10px] text-white/30 pl-5">
                      File auto-detected · Max per upload: Alignment 5 · Signal 10 · Score Fix 15
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isAnalyzing || (mode === "url" ? !inputUrl.trim() : files.length === 0) || (mode === "upload" && !canUpload)}
                className={`inline-flex items-center justify-center gap-2.5 rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30 ${!hasResults ? "bg-gradient-to-r from-cyan-500 to-violet-600 shadow-[0_8px_32px_rgba(6,182,212,0.25)] hover:shadow-[0_8px_40px_rgba(6,182,212,0.35)] hover:from-cyan-400 hover:to-violet-500 active:scale-[0.97]" : "border border-white/[0.08] bg-white/[0.08] hover:bg-white/[0.14] hover:border-white/15"}`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="tracking-wide">Running audit…</span>
                  </>
                ) : (
                  <>
                    {mode === "upload" ? <Upload className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                    <span className="tracking-wide">{mode === "upload" ? "Analyze Upload" : "Run Audit"}</span>
                  </>
                )}
              </button>
            </div>

            {mode === "url" && (
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 transition-all duration-200">
                <div className="mb-1.5 flex items-center gap-2">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">
                    What do you want to be found for?
                  </label>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/30">Optional</span>
                  <InfoHint text="Optional. Add key topics or target queries so the audit can measure goal alignment instead of generic visibility only." />
                </div>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={2}
                  disabled={isAnalyzing}
                  placeholder="Example: emergency plumber near me, tankless water heater repair, 24/7 plumbing service"
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-white/80 placeholder:text-white/30 outline-none transition-all focus:border-white/15 focus:bg-white/[0.05]"
                />
                <div className="mt-2.5 flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-white/55 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={scanMockData}
                      onChange={(e) => setScanMockData(e.target.checked)}
                      disabled={isAnalyzing}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.04] accent-cyan-400"
                    />
                    <span className="transition-colors group-hover:text-white/70">Audit for mock or placeholder content</span>
                    <InfoHint text="Use this when pages may still contain lorem ipsum, TODO text, sample blocks, or placeholder templates." />
                  </label>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-white/30">
                  Forced reruns use 0.5 referral or pack credits first when available; otherwise they use a normal plan scan. Mock-data review and findability-goal analysis use 1.33 referral or pack credits first when available.
                </p>
              </div>
            )}
          </div>

          {!hasResults && history.length > 0 && (
            <div className="mt-10 max-w-2xl mx-auto text-left">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
                  <History className="h-4 w-4" />
                  Recent audits
                </h3>
                <button
                  type="button"
                  onClick={() => useAnalysisStore.getState().clearHistory()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px] font-medium text-white/40 transition-all hover:border-white/15 hover:text-white/65"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>

              <div className="space-y-2">
                {history.filter((entry) => entry?.url).slice(0, 3).map((entry) => (
                  <button
                    key={entry.timestamp}
                    type="button"
                    onClick={() => {
                      setInputUrl(entry.url || "");
                      onAnalyze(entry.url, { discoveryGoals: goals.trim(), scanMockData });
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 text-left transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05] hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] group"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <Globe className="h-4 w-4 shrink-0 text-white/35 transition group-hover:text-white/55" />
                      <span className="truncate text-sm text-white/75 transition group-hover:text-white/90">{entry.url}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/65">
                        {entry.result.visibility_score}
                      </span>
                      <span className="text-[11px] text-white/35">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

export default function Dashboard() {
  usePageMeta({
    title: "AI Visibility Audit Platform",
    fullTitle: "AiVIS: AI Visibility Audit for ChatGPT, Perplexity, Claude",
    description:
      "AiVIS audits whether AI answer engines can parse, trust, and cite your page. Returns a 0-100 visibility score with category grades and implementation-ready fixes.",
    path: "/",
    ogTitle: "AiVIS — AI Visibility Audit for Answer Engines",
    ogDescription:
      "AiVIS audits whether AI can parse, trust, and cite your page, then returns a 0-100 score, category grades, and implementation-ready fixes.",
    structuredData: HOME_STRUCTURED_DATA,
  });

  const navigate = useNavigate();
  const { token, isAuthenticated, refreshUser, logout, user } = useAuthStore();
  const latestAnalysisResult = useAnalysisStore((s) => s.result);
  const analysisHistory = useAnalysisStore((s) => s.history);
  const { status: featureStatus, updatedAtLabel: featureStatusUpdatedAt } = useFeatureStatus();
  const pageVisible = usePageVisible();

  const [data, setData] = useState<DashboardData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);
  const [auditOverlayActive, setAuditOverlayActive] = useState(false);
  const [overlayMinimized, setOverlayMinimized] = useState(false);
  const [auditPercent, setAuditPercent] = useState(0);
  const [auditUrl, setAuditUrl] = useState("");
  const [apiFinished, setApiFinished] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [scanCountByTarget, setScanCountByTarget] = useState<Record<string, number>>({});
  const [activeTargetScanCount, setActiveTargetScanCount] = useState(0);
  const [isRetryScan, setIsRetryScan] = useState(false);
  const [auditRequestId, setAuditRequestId] = useState<string | null>(null);
    const [asfModalOpen, setAsfModalOpen] = useState(false);
  const [competitorHintDismissed, setCompetitorHintDismissed] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(DEFAULT_SECTION_ORDER);
  const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);
  const [showSectionOrder, setShowSectionOrder] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'technical'>('text');
  const [serverHistory, setServerHistory] = useState<TrendPoint[]>([]);
  const [serverAuditCount, setServerAuditCount] = useState(0);
  const [serverTotalScans, setServerTotalScans] = useState(0);
  const [trendRefreshing, setTrendRefreshing] = useState(false);
  const [historyTopCategory, setHistoryTopCategory] = useState<CategoryInsight | null>(null);
  const [historyLowestCategory, setHistoryLowestCategory] = useState<CategoryInsight | null>(null);
  const [allAuditScoreSeries, setAllAuditScoreSeries] = useState<number[]>([]);
  const [autoScoreFixJobs, setAutoScoreFixJobs] = useState<AutoScoreFixPipelineJob[]>([]);
  const [generateFixTarget, setGenerateFixTarget] = useState<{ title: string; description?: string; category?: string; impact?: string } | null>(null);
  const [autoScoreFixLoading, setAutoScoreFixLoading] = useState(false);
  const [heroPrefillUrl, setHeroPrefillUrl] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const sharedAutoRunRef = useRef(false);

  const isAdminUser = String(user?.role || "").toLowerCase() === "admin";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SECTION_STORAGE_KEY);
      if (!raw) return;
      setSectionOrder(normalizeSectionOrder(JSON.parse(raw)));
    } catch {
      // ignore bad user preference state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(normalizeSectionOrder(sectionOrder)));
  }, [sectionOrder]);

  const refreshCategoryInsights = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
      const pageLimit = 100;
      let offset = 0;
      let total = 0;
      const allAuditRows: Array<{ id?: string | number; visibility_score?: number }> = [];

      do {
        const auditsPayload = await fetchJson<{
          audits?: Array<{ id?: string | number; visibility_score?: number }>;
          total?: number;
          limit?: number;
          offset?: number;
        }>(`${API_URL}/api/audits?limit=${pageLimit}&offset=${offset}`, {
          headers: authHeaders,
        });

        const rows = Array.isArray(auditsPayload?.audits) ? auditsPayload.audits : [];
        total = Number.isFinite(Number(auditsPayload?.total)) ? Number(auditsPayload?.total) : rows.length;
        allAuditRows.push(...rows);
        offset += rows.length;

        if (!rows.length) break;
      } while (offset < total);

      // serverAuditCount is set exclusively by the /api/analytics endpoint
      // to avoid dual-source inconsistency.

      const scoreSeries = allAuditRows
        .map((row) => Number(row?.visibility_score))
        .filter((score) => Number.isFinite(score));
      setAllAuditScoreSeries(scoreSeries);

      const auditIds = allAuditRows
        .map((audit) => String(audit?.id || "").trim())
        .filter(Boolean);

      if (!auditIds.length) {
        setHistoryTopCategory(null);
        setHistoryLowestCategory(null);
        return;
      }

      const detailResults: Array<PromiseSettledResult<{ audit?: any; result?: any }>> = [];
      const detailBatchSize = 20;

      for (let index = 0; index < auditIds.length; index += detailBatchSize) {
        const chunk = auditIds.slice(index, index + detailBatchSize);
        const chunkResults = await Promise.allSettled(
          chunk.map((id) =>
            fetchJson<{ audit?: any; result?: any }>(`${API_URL}/api/audits/${encodeURIComponent(id)}`, {
              headers: authHeaders,
            })
          )
        );
        detailResults.push(...chunkResults);
      }

      const categoryAgg = new Map<string, { sum: number; count: number; summary: string }>();

      for (const item of detailResults) {
        if (item.status !== "fulfilled") continue;
        const payload = item.value as { audit?: any; result?: any };
        const auditObj = payload?.audit ?? payload;

        const resultObj = (() => {
          const raw = auditObj?.result ?? payload?.result;
          if (typeof raw === "string") {
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          }
          return raw;
        })();

        const grades = Array.isArray(resultObj?.category_grades) ? resultObj.category_grades : [];
        for (const grade of grades) {
          const label = typeof grade?.label === "string" ? grade.label : "";
          const score = Number(grade?.score);
          if (!label || !Number.isFinite(score)) continue;

          const existing = categoryAgg.get(label) || { sum: 0, count: 0, summary: "" };
          existing.sum += score;
          existing.count += 1;
          if (!existing.summary && typeof grade?.summary === "string") existing.summary = grade.summary;
          categoryAgg.set(label, existing);
        }
      }

      const rolled = Array.from(categoryAgg.entries())
        .map(([label, value]) => ({
          label,
          score: Math.round(value.sum / Math.max(1, value.count)),
          summary: value.summary || "Historical category average from all available completed audits.",
          samples: value.count,
        }))
        .sort((a, b) => b.score - a.score);

      if (!rolled.length) {
        setHistoryTopCategory(null);
        setHistoryLowestCategory(null);
        return;
      }

      setHistoryTopCategory(rolled[0]);
      setHistoryLowestCategory(rolled[rolled.length - 1]);
    } catch {
      setHistoryTopCategory(null);
      setHistoryLowestCategory(null);
      setAllAuditScoreSeries([]);
    }
  }, [isAuthenticated, token]);

  const refreshServerHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setTrendRefreshing(true);
      const payload = await fetchJson<FeatureJson>(`${API_URL}/api/analytics?range=90d`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (payload?.success && payload?.data?.score_history) {
        setServerHistory(
          // Server history is the canonical source of trend truth.
          // isoDate is already YYYY-MM-DD from the API.
          (payload.data.score_history as Array<{ date: string; score: number; url: string }>).map((point) => ({
            date: point.date,
            isoDate: point.date,
            visibility: point.score,
            url: point.url,
          }))
        );
        setServerAuditCount(payload.data.summary?.total_audits ?? 0);
        setServerTotalScans(payload.data.summary?.total_scans ?? payload.data.summary?.total_audits ?? 0);
      }
      await refreshCategoryInsights();
    } catch {
      // non-fatal
    } finally {
      setTrendRefreshing(false);
    }
  }, [isAuthenticated, refreshCategoryInsights, token]);

  useEffect(() => {
    void refreshServerHistory();
  }, [refreshServerHistory]);

  const handleClearAuditView = useCallback(() => {
    setData(null);
    setAuditUrl("");
    setError(null);
    setShowSectionOrder(false);
    useAnalysisStore.getState().setResult(null);
    // Re-fetch overview stats so returning user panel shows fresh numbers
    void refreshServerHistory();
  }, [refreshServerHistory]);

  // Sync server audits into local history so cross-device audits appear
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    (async () => {
      try {
        const payload = await fetchJson<{
          audits?: Array<{ url: string; visibility_score: number; summary?: string; recommendations?: unknown; created_at: string }>;
        }>(`${API_URL}/api/audits?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (Array.isArray(payload?.audits)) {
          useAnalysisStore.getState().mergeServerAudits(payload.audits);
        }
      } catch {
        // non-fatal — local history still works
      }
    })();
  }, [isAuthenticated, token]);

  const refreshAutoScoreFixPipeline = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    try {
      setAutoScoreFixLoading(true);
      const authHeaders = { Authorization: `Bearer ${token}` };
      const candidates = [
        `${API_URL}/api/auto-score-fix/jobs?limit=12`,
        `${API_URL}/auto-score-fix/jobs?limit=12`,
      ];

      let jobs: AutoScoreFixPipelineJob[] = [];
      for (const endpoint of candidates) {
        try {
          const payload = await fetchJson<{ jobs?: AutoScoreFixPipelineJob[] }>(endpoint, {
            headers: authHeaders,
          });
          jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
          break;
        } catch {
          // try next endpoint variant
        }
      }

      setAutoScoreFixJobs(jobs);
    } catch {
      // non-fatal
    } finally {
      setAutoScoreFixLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    void refreshAutoScoreFixPipeline();
  }, [refreshAutoScoreFixPipeline]);

  useEffect(() => {
    if (!isAuthenticated || !token || !pageVisible) return;
    const timer = window.setInterval(() => {
      void refreshAutoScoreFixPipeline();
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, token, refreshAutoScoreFixPipeline, pageVisible]);

  useEffect(() => {
    if (latestAnalysisResult) {
      setData(transformApiResponse(latestAnalysisResult, analysisHistory));
    }
  }, [latestAnalysisResult, analysisHistory]);

  // mergedTrendData intentionally removed — chart uses raw serverHistory only.

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get("upgraded");
    const tier = params.get("tier");
    if (upgraded === "true" && tier) {
      window.history.replaceState({}, "", window.location.pathname);
      refreshUser().then((success: boolean) => {
        if (success) {
          const tierName = tier === "alignment" ? "Alignment" : tier === "signal" ? "Signal" : tier === "scorefix" ? "Score Fix" : tier;
          setUpgradeSuccess(`Welcome to ${tierName}. Your account has been upgraded.`);
          setTimeout(() => setUpgradeSuccess(null), 8000);
        }
      });
    }
  }, [refreshUser]);

  useEffect(() => {
    if (isAuthenticated && analysisHistory.length === 0 && !isOnboardingComplete()) {
      const timer = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, analysisHistory.length]);

  const fetchTargetScanCount = useCallback(
    async (target: string): Promise<number> => {
      if (!isAuthenticated) return 0;
      const normalized = normalizeUrl(target);
      if (!normalized) return 0;

      try {
        const payload = await fetchJson<{ total?: number }>(
          `${API_URL}/api/audits/target-count?url=${encodeURIComponent(normalized)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        );
        return Number.isFinite(payload?.total) ? Math.max(0, Number(payload.total)) : 0;
      } catch {
        return 0;
      }
    },
    [isAuthenticated, token]
  );

  const analyzeUrl = useCallback(
    async (url: string, opts?: { retry?: boolean; discoveryGoals?: string; scanMockData?: boolean; forceRefresh?: boolean }) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        setError("Please enter a valid URL.");
        return;
      }

      setData(null);
      useAnalysisStore.getState().setResult(null);
      setIsAnalyzing(true);
      setCompetitorHintDismissed(false);
      setError(null);
      setAuditUrl(normalizedUrl);
      setApiFinished(false);
      setScanCount((prev) => prev + 1);
      setIsRetryScan(Boolean(opts?.retry));

      const targetKey = buildTargetKey(normalizedUrl);
      const remoteCount = await fetchTargetScanCount(normalizedUrl);
      let nextCount = 1;
      setScanCountByTarget((prev) => {
        const base = Math.max(prev[targetKey] || 0, remoteCount);
        nextCount = base + 1;
        return { ...prev, [targetKey]: nextCount };
      });
      setActiveTargetScanCount(nextCount);

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setAuditRequestId(requestId);
      setAuditOverlayActive(true);
      setOverlayMinimized(false);
      setAuditPercent(0);

      const timeoutId = window.setTimeout(() => abortControllerRef.current?.abort(), 120_000);

      try {
        const currentTargetKey = buildTargetKey(latestAnalysisResult?.url || data?.url || auditUrl || "");
        const retryRequested = Boolean(opts?.retry) || (Boolean(currentTargetKey) && currentTargetKey === targetKey);
        const tierKey = String(user?.tier || "observer").toLowerCase();
        const tierLimits = (TIER_LIMITS as Record<string, { hasForceRefresh?: boolean }>)[tierKey] || TIER_LIMITS.observer;
        const canForceRefresh = Boolean(tierLimits?.hasForceRefresh);
        const shouldForceRefresh = Boolean(opts?.forceRefresh) || (canForceRefresh && retryRequested);

        const payload = await fetchJson<AnalysisResponse>(`${API_URL}/api/analyze?ts=${Date.now()}`, {
          method: "POST",
          signal: abortControllerRef.current.signal,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...getWorkspaceHeader(),
          },
          body: JSON.stringify({
            url: normalizedUrl,
            forceRefresh: shouldForceRefresh,
            retryRequested,
            requireLiveAi: true,
            requestId,
            findabilityGoals: String(opts?.discoveryGoals || "").trim(),
            scanMockData: Boolean(opts?.scanMockData),
          }),
        });

        if (!payload || typeof payload !== "object") {
          throw new Error("Invalid audit response received from server");
        }

        setApiFinished(true);
        const resolvedUrl = payload.url || payload.analysis_integrity?.normalized_target_url || normalizedUrl;
        setAuditUrl(resolvedUrl);
        setData(transformApiResponse({ ...payload, url: resolvedUrl }, useAnalysisStore.getState().history));
        useAnalysisStore.getState().setResult({ ...payload, url: resolvedUrl });
        useAnalysisStore.getState().addToHistory(resolvedUrl, { ...payload, url: resolvedUrl });
        window.dispatchEvent(new Event("aivis-usage-updated"));
        void refreshServerHistory();
      } catch (err: any) {
        console.error("[Dashboard] Audit API call failed", err);
        const apiErr = err as ApiError;
        if (err?.name === "AbortError") {
          setError("Analysis timed out. Retry once the page settles or after backend load drops.");
        } else if (apiErr?.code === "USAGE_LIMIT_REACHED" || String(err?.message || "").toLowerCase().includes("monthly scan limit reached")) {
          setError("Live scan limit reached for this billing cycle. You can still view cached results, or upgrade/add audit credits to run a fresh live audit.");
        } else if (apiErr?.code === "INSUFFICIENT_PACK_CREDITS" || apiErr?.status === 402) {
          setError("This audit add-on requires more credits than you currently have. Add a credit pack or remove optional add-ons (mock-data scan, findability goals) and retry.");
        } else if (apiErr?.status === 429 || apiErr?.code === "HIGH_COST_RATE_LIMIT" || apiErr?.code === "RATE_LIMIT_EXCEEDED") {
          const retryAfter = Number(apiErr?.retryAfter || 60);
          setError(`Rate limit reached. Please retry in about ${Math.max(1, Math.round(retryAfter))} seconds.`);
        } else if (apiErr?.status === 401 || apiErr?.code === "NO_USER" || apiErr?.code === "NO_TOKEN" || apiErr?.code === "TOKEN_EXPIRED" || apiErr?.code === "INVALID_TOKEN" || apiErr?.code === "USER_NOT_FOUND") {
          setApiFinished(true);
          setAuditOverlayActive(false);
          logout();
          navigate("/auth?mode=signin");
          return;
        } else {
          setError(err?.message || "Audit failed. Please try again.");
        }
        setApiFinished(true);
        setAuditOverlayActive(false);
      } finally {
        clearTimeout(timeoutId);
        setIsAnalyzing(false);
      }
    },
    [auditUrl, data?.url, fetchTargetScanCount, latestAnalysisResult?.url, logout, navigate, refreshServerHistory, token, user?.tier]
  );

  const analyzeUpload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const effectiveTier = user?.tier || 'observer';
      const maxBatchFiles = meetsMinimumTier(effectiveTier, 'scorefix') ? 15 : meetsMinimumTier(effectiveTier, 'signal') ? 10 : meetsMinimumTier(effectiveTier, 'alignment') ? 5 : 0;
      if (maxBatchFiles === 0) {
        setError("Upload analysis is available on Alignment, Signal, and Score Fix plans.");
        return;
      }
      if (files.length > maxBatchFiles) {
        setError(`Too many files selected. Your plan supports up to ${maxBatchFiles} files per upload.`);
        return;
      }

      setData(null);
      useAnalysisStore.getState().setResult(null);
      setIsAnalyzing(true);
      setCompetitorHintDismissed(false);
      setError(null);
      setApiFinished(false);

      const uploadTarget = files.length === 1 ? `upload://${files[0].name}` : `upload://batch-${files.length}-files`;
      setAuditUrl(uploadTarget);
      setScanCount((prev) => prev + 1);
      setIsRetryScan(false);

      const targetKey = buildTargetKey(uploadTarget);
      let nextCount = 1;
      setScanCountByTarget((prev) => {
        nextCount = (prev[targetKey] || 0) + 1;
        return { ...prev, [targetKey]: nextCount };
      });
      setActiveTargetScanCount(nextCount);

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setAuditRequestId(requestId);
      setAuditOverlayActive(true);
      setOverlayMinimized(false);
      setAuditPercent(0);

      try {
        const encodedFiles = await Promise.all(
          files.map(async (file) => {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode(...chunk);
            }
            return {
              fileName: file.name,
              mimeType: file.type,
              content: btoa(binary),
              encoding: "base64",
            };
          })
        );

        const payload = await fetchJson<AnalysisResponse>(`${API_URL}/api/analyze/upload`, {
          method: "POST",
          signal: abortControllerRef.current.signal,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...getWorkspaceHeader(),
          },
          body: JSON.stringify({ files: encodedFiles, requestId }),
        });

        if (!payload || typeof payload !== "object") {
          throw new Error("Invalid upload audit response received from server");
        }

        setApiFinished(true);
        const resolvedUrl = payload.url || payload.analysis_integrity?.normalized_target_url || uploadTarget;
        setAuditUrl(resolvedUrl);
        setData(transformApiResponse({ ...payload, url: resolvedUrl }, useAnalysisStore.getState().history));
        useAnalysisStore.getState().setResult({ ...payload, url: resolvedUrl });
        useAnalysisStore.getState().addToHistory(resolvedUrl, { ...payload, url: resolvedUrl });
        void refreshServerHistory();
      } catch (err: any) {
        console.error("[Dashboard] Upload audit API call failed", err);
        const apiErr = err as ApiError;
        if (err?.name === "AbortError") {
          setError("Upload analysis timed out. Please retry.");
        } else if (apiErr?.status === 401 || apiErr?.code === "NO_USER" || apiErr?.code === "NO_TOKEN" || apiErr?.code === "TOKEN_EXPIRED" || apiErr?.code === "INVALID_TOKEN" || apiErr?.code === "USER_NOT_FOUND") {
          setApiFinished(true);
          setAuditOverlayActive(false);
          logout();
          navigate("/auth?mode=signin");
          return;
        } else if (apiErr?.status === 403 || apiErr?.code === "TIER_INSUFFICIENT") {
          setError("Upload analysis requires Alignment, Signal, or Score Fix. Upgrade your plan to use this feature.");
        } else if (apiErr?.code === "USAGE_LIMIT_REACHED" || String(err?.message || "").toLowerCase().includes("monthly scan limit reached")) {
          setError("Live scan limit reached for this billing cycle. You can still view cached results, or upgrade/add audit credits to run a fresh live audit. Need help? Visit our Help Center.");
        } else if (apiErr?.code === "INSUFFICIENT_PACK_CREDITS" || apiErr?.status === 402) {
          setError("This audit add-on requires more credits than you currently have. Add a credit pack or remove optional add-ons and retry.");
        } else if (apiErr?.status === 429 || apiErr?.code === "HIGH_COST_RATE_LIMIT" || apiErr?.code === "RATE_LIMIT_EXCEEDED") {
          const retryAfter = Number(apiErr?.retryAfter || 60);
          setError(`Upload rate limit reached. Please retry in about ${Math.max(1, Math.round(retryAfter))} seconds.`);
        } else if (apiErr?.status === 413) {
          setError("File too large for upload. Try a smaller file or reduce the number of files.");
        } else {
          setError(err?.message || "Upload analysis failed.");
        }
        setApiFinished(true);
        setAuditOverlayActive(false);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [logout, navigate, refreshServerHistory, token, user?.tier]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("url")?.trim();

    if (!sharedUrl || sharedAutoRunRef.current || isAnalyzing || !!data) return;
    if (!isAuthenticated) return;

    sharedAutoRunRef.current = true;
    void analyzeUrl(sharedUrl);

    const next = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", next);
  }, [analyzeUrl, data, isAnalyzing, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || isAnalyzing) return;

    const currentTarget = auditUrl || data?.url || latestAnalysisResult?.url || "";
    const normalizedTarget = normalizeUrl(currentTarget);
    const targetKey = buildTargetKey(normalizedTarget);

    if (!normalizedTarget || !targetKey) return;

    let cancelled = false;

    void (async () => {
      const remoteCount = await fetchTargetScanCount(normalizedTarget);
      if (cancelled || remoteCount <= 0) return;

      setScanCountByTarget((prev) => {
        const currentCount = prev[targetKey] || 0;
        if (remoteCount <= currentCount) return prev;
        return { ...prev, [targetKey]: remoteCount };
      });

      setActiveTargetScanCount((prev) => Math.max(prev, remoteCount));
    })();

    return () => {
      cancelled = true;
    };
  }, [auditUrl, data?.url, fetchTargetScanCount, isAnalyzing, isAuthenticated, latestAnalysisResult?.url]);

  const displayTargetScanCount = useMemo(() => {
    const currentTarget = auditUrl || data?.url || latestAnalysisResult?.url || "";
    const key = buildTargetKey(currentTarget);
    if (!key) return 0;
    return Math.max(scanCountByTarget[key] || 0, activeTargetScanCount);
  }, [activeTargetScanCount, auditUrl, data?.url, latestAnalysisResult?.url, scanCountByTarget]);

  const hasLiveAuditResult = Boolean(latestAnalysisResult && !latestAnalysisResult.cached);
  const remainingLiveScans = Math.max(0, Number(featureStatus?.usage?.remainingThisMonth ?? 0));
  const packCreditsRemaining = Math.max(0, Number(featureStatus?.credits?.packCreditsRemaining ?? 0));
  const liveAuditBlockedByUsage = remainingLiveScans <= 0 && packCreditsRemaining <= 0;

  const availableSections = useMemo(() => {
    const sections: SectionKey[] = ["executive"];

    // Evidence findings — primary observable data from page crawl
    if (
      latestAnalysisResult?.recommendation_evidence_summary ||
      latestAnalysisResult?.content_highlights?.length ||
      latestAnalysisResult?.evidence_manifest
    ) {
      sections.push("evidence");
    }

    // Priority remediation actions — mapped to findings above
    if (latestAnalysisResult?.recommendations?.length) sections.push("priority");

    // Threat / private exposure / security flags — critical for enterprise
    if (
      latestAnalysisResult?.threat_intel?.risk_level ||
      latestAnalysisResult?.crypto_intelligence?.has_crypto_signals ||
      latestAnalysisResult?.analysis_integrity
    ) {
      sections.push("threat_intel");
    }

    // Historical visibility trend
    sections.push("trend");

    // AI platform coverage
    if (data?.aiPlatformScores || (data?.aiModelScores && data.aiModelScores.length > 0)) {
      sections.push("platforms");
    }

    // Deep-dive analysis layers
    if (latestAnalysisResult) sections.push("analysis", "report");

    // Category grades summary
    if (latestAnalysisResult?.category_grades?.length) {
      sections.push("grades");
    }

    // Module navigation (lower priority in enterprise view)
    sections.push("modules");
    return sections;
  }, [data?.aiModelScores, data?.aiPlatformScores, latestAnalysisResult]);

  const orderedSections = useMemo(() => {
    return [...availableSections].sort(
      (a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b)
    );
  }, [availableSections, sectionOrder]);

  const moveSection = useCallback((section: SectionKey, direction: -1 | 1) => {
    const visible = [...orderedSections];
    const index = visible.indexOf(section);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= visible.length) return;
    const next = [...visible];
    [next[index], next[target]] = [next[target], next[index]];
    setSectionOrder((prev) => {
      const hidden = prev.filter((item) => !next.includes(item));
      return [...next, ...hidden];
    });
  }, [orderedSections]);

  const dragSection = useCallback((from: SectionKey, to: SectionKey) => {
    if (from === to) return;
    const visible = [...orderedSections];
    const fromIndex = visible.indexOf(from);
    const toIndex = visible.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...visible];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setSectionOrder((prev) => {
      const hidden = prev.filter((item) => !next.includes(item));
      return [...next, ...hidden];
    });
  }, [orderedSections]);

  const renderSection = (key: SectionKey) => {
    if (!data || !latestAnalysisResult) return null;

    switch (key) {
      case "executive":
        return (
          <div key={key} id="section-executive">
            <ExecutiveRail
              data={data}
              latestAnalysisResult={latestAnalysisResult}
            />
          </div>
        );
      case "evidence": {
        const recEvidence = latestAnalysisResult.recommendation_evidence_summary;
        const highlights = latestAnalysisResult.content_highlights || [];
        const threatLevel = latestAnalysisResult.threat_intel?.risk_level || "low";

        return (
          <section id="section-evidence" key={key} className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8 section-accent-cyan">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h3 className="brand-title text-lg">Evidence &amp; Findings</h3>
              {recEvidence && (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2.5 py-1 text-xs text-cyan-200/85">
                  Evidence coverage {Math.round(recEvidence.evidence_coverage_percent || 0)}%
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-white/45">The raw crawl data behind every score — verify what the engine actually found on your page.</p>

            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="min-w-0 space-y-3">
                <p className="text-xs uppercase tracking-wide text-white/45 px-1">Top 3 findings from this audit</p>
                {(highlights.length ? highlights.slice(0, 3) : []).map((item, idx) => (
                  <div key={`${item.area}-${idx}`} className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="rounded-full border border-white/10 bg-[#171f31] px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/65">
                        {item.area}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "good"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                            : item.status === "warning"
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                            : "border-red-400/30 bg-red-400/10 text-red-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white [overflow-wrap:anywhere]">{item.found}</div>
                    <div className="mt-1.5 text-xs leading-6 text-white/60 [overflow-wrap:anywhere]">{item.note}</div>
                  </div>
                ))}

                {!highlights.length && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    No detailed evidence highlights were returned in this audit payload.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {recEvidence && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs space-y-2">
                    <div className="uppercase tracking-wide text-white/50 mb-3 font-semibold">Evidence integrity</div>
                    <div className="text-white/75">
                      Total recommendations: <span className="text-white/85 font-semibold">{recEvidence.total_recommendations}</span>
                    </div>
                    <div className="text-white/75">
                      Verified links: <span className="text-emerald-300 font-semibold">{recEvidence.verified_recommendations}</span>
                    </div>
                    <div className="text-white/75">
                      Unverified: <span className="text-red-300 font-semibold">{recEvidence.unverified_recommendations}</span>
                    </div>
                    <div className="pt-2 border-t border-white/10"></div>
                    <div className="text-white/75">
                      Overall integrity: <span className="text-cyan-200 font-semibold">{Math.round(recEvidence.evidence_ref_integrity_percent || 0)}%</span>
                    </div>
                  </div>
                )}

                {recEvidence && (
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3">
                    <div className="text-xs text-cyan-100 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-cyan-300" />
                      <div>
                        Evidence coverage shows <span className="font-semibold">{Math.round(recEvidence.evidence_coverage_percent || 0)}%</span> of audit findings are citation-backed.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      }
      case "threat_intel": {
        const threatLevel = latestAnalysisResult.threat_intel?.risk_level || "low";
        const hasPrivateExposure = latestAnalysisResult.threat_intel?.flags?.some(f => /private.ip|internal.path/i.test(f));
        const cryptoSignals = latestAnalysisResult.crypto_intelligence?.has_crypto_signals || false;
        const hasThreatData =
          threatLevel !== "low" ||
          hasPrivateExposure ||
          cryptoSignals ||
          latestAnalysisResult.analysis_integrity?.warnings?.length;

        if (!hasThreatData) return null;

        return (
          <section id="section-threat_intel" key={key} className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8 section-accent-red">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-white/75" />
              <h3 className="brand-title text-lg">Security & Threat Intelligence</h3>
            </div>
            <p className="mb-4 text-xs text-white/45">Security exposure flags — private IP leaks, crypto signals, and integrity warnings that could undermine AI trust.</p>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Threat level + security posture */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-xs uppercase tracking-wide text-white/50 mb-2">Overall risk posture</div>

                <div className="flex items-end gap-3">
                  <div>
                    <span
                      className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                        threatLevel === "low"
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          : threatLevel === "medium"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                          : "border-red-400/30 bg-red-400/10 text-red-200"
                      }`}
                    >
                      {threatLevel === "low" ? "Low Risk" : threatLevel === "medium" ? "Medium Risk" : "High Risk"}
                    </span>
                  </div>
                  <span className="text-xs text-white/50">
                    {threatLevel === "low"
                      ? "No critical exposure detected"
                      : threatLevel === "medium"
                      ? "Some exposure vectors present"
                      : "Critical exposure requires remediation"}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/10"></div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/10 bg-[#171f31] px-2.5 py-2 text-white/75">
                    HTTPS:{" "}
                    <span className={data.httpsEnabled ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"}>
                      {data.httpsEnabled ? "Secured" : "Unencrypted"}
                    </span>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#171f31] px-2.5 py-2 text-white/75">
                    Threat Level:{" "}
                    <span
                      className={
                        threatLevel === "low"
                          ? "text-emerald-300 font-semibold"
                          : threatLevel === "medium"
                          ? "text-amber-300 font-semibold"
                          : "text-red-300 font-semibold"
                      }
                    >
                      {threatLevel}
                    </span>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#171f31] px-2.5 py-2 text-white/75 col-span-2">
                    Crypto Signals:{" "}
                    <span className={cryptoSignals ? "text-amber-300 font-semibold" : "text-emerald-300 font-semibold"}>
                      {cryptoSignals ? "⚠ Detected" : "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Private exposure + warnings */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-xs uppercase tracking-wide text-white/50 mb-2">Exposure vectors</div>

                {hasPrivateExposure && (
                  <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
                      <div className="text-sm text-red-100">
                        <div className="font-semibold">Private IP / Internal Path Exposure Detected</div>
                        <div className="mt-1 text-xs text-red-100/80">
                          Private IPs or internal service paths were exposed in the page content, headers, or crawl artifacts. This increases reconnaissance risk.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {latestAnalysisResult.analysis_integrity?.warnings?.length ? (
                  <div className="space-y-2">
                    {latestAnalysisResult.analysis_integrity.warnings.slice(0, 3).map((warning, idx) => (
                      <div key={idx} className="rounded-lg border border-amber-400/20 bg-amber-400/[0.08] p-2.5">
                        <div className="text-xs text-amber-100">
                          <span className="font-semibold">Warning:</span> {warning}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-white/55">No additional exposure warnings detected.</div>
                )}
              </div>
            </div>
          </section>
        );
      }
      case "grades":
        return latestAnalysisResult.category_grades?.length ? (
          <section id="section-grades" key={key} className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8 section-accent-emerald">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="brand-title text-lg">Category Grades</h3>
              <span className="text-xs text-white/50">A–F performance layer</span>
            </div>
            <p className="mb-4 text-xs text-white/45">Six scored categories — your lowest grade is your highest-leverage fix target.</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {latestAnalysisResult.category_grades.map((grade, idx) => (
                <div key={`${grade.label}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{grade.label}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${
                      grade.grade === "A"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : grade.grade === "B"
                        ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                        : grade.grade === "C"
                        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                        : "border-red-400/30 bg-red-400/10 text-red-200"
                    }`}>
                      {grade.grade}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-white/55">Score {grade.score}/100</div>
                  <div className="mt-2 text-xs leading-6 text-white/60">{grade.summary}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null;
      case "priority":
        return latestAnalysisResult.recommendations?.length ? (
          <section id="section-priority" key={key} className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8 section-accent-orange">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="brand-title text-lg">Priority Actions</h3>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/65">
                {latestAnalysisResult.recommendations.length} actions
              </span>
            </div>
            <p className="mb-4 text-xs text-white/45">Ranked by impact score and evidence strength — start at item 1 and work down.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {latestAnalysisResult.recommendations.map((action) => {
                const schemaLikelyCovered =
                  (action.category || "").toLowerCase().includes("schema") ||
                  action.title.toLowerCase().includes("schema") ||
                  action.description.toLowerCase().includes("json-ld");
                const schemaAlreadyStrong =
                  (latestAnalysisResult.schema_markup?.json_ld_count || 0) >= 5 &&
                  (latestAnalysisResult.schema_markup?.schema_types?.length || 0) >= 4;

                const displayedPriority = schemaLikelyCovered && schemaAlreadyStrong && action.priority === "medium"
                  ? "low"
                  : action.priority || "medium";

                return (
                  <div key={action.id || `${action.title}-${action.category}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="rounded-full border border-white/10 bg-[#171f31] px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/65">
                        {displayedPriority}
                      </span>
                      <span className="rounded-full border border-white/10 bg-[#171f31] px-2 py-0.5 text-[11px] text-white/55">
                        {action.category || "General"}
                      </span>
                      {action.verification_status && (
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          action.verification_status === "verified"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                            : action.verification_status === "partial"
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                            : "border-red-400/30 bg-red-400/10 text-red-200"
                        }`}>
                          {action.verification_status}
                        </span>
                      )}
                    </div>
                    <div className="text-base font-semibold text-white line-clamp-2">{action.title}</div>
                    <div className="mt-2 text-sm leading-7 text-white/60 line-clamp-3">{action.description}</div>
                    {meetsMinimumTier(user?.tier || 'observer', 'alignment') && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setGenerateFixTarget({ title: action.title, description: action.description, category: action.category, impact: action.impact })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition-colors hover:bg-cyan-400/20"
                      >
                        <Wand2 className="h-3 w-3" />
                        Generate fix
                      </button>
                    </div>
                    )}
                    {schemaLikelyCovered && schemaAlreadyStrong && (
                      <div className="mt-2 text-xs text-cyan-200/80">
                        Schema already detected ({latestAnalysisResult.schema_markup?.json_ld_count} JSON-LD blocks): prioritize utilization consistency before adding more blocks.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {latestAnalysisResult.upgrade_cta && (
              <div className="mt-6 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{latestAnalysisResult.upgrade_cta.message}</p>
                    {latestAnalysisResult.upgrade_cta.recommendations_hidden > 0 && (
                      <p className="mt-1 text-xs text-white/50">
                        +{latestAnalysisResult.upgrade_cta.recommendations_hidden} more recommendation{latestAnalysisResult.upgrade_cta.recommendations_hidden === 1 ? '' : 's'} available on paid plans
                      </p>
                    )}
                  </div>
                  <a
                    href="/pricing"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/30"
                  >
                    View plans
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
          </section>
        ) : null;
      case "report":
        return (
          <div key={key} id="section-report" className="space-y-4">
            <p className="px-1 text-xs text-white/40">Export, validate, and share this audit as a PDF, DOCX, or Markdown document. Use the validation loop to measure fix impact over time.</p>
            <PlatformProofLoopCard
              url={latestAnalysisResult.url}
              score={latestAnalysisResult.visibility_score}
              title="Validation loop"
              subtitle="This audit should lead directly to a focused fix, same-URL re-audit, and measurable proof of movement."
              compact
            />
            <AuditReportCard result={latestAnalysisResult} />
          </div>
        );
      case "analysis":
        return (
          <div key={key} id="section-analysis" className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8 section-accent-amber">
              <div className="section-header-row mb-2">
                <h3 className="brand-title text-lg">Comprehensive Analysis</h3>
              </div>
              <p className="mb-4 text-xs text-white/45">Full deep-dive breakdown of every signal the engine detected — for when you need more than the summary.</p>
              <ComprehensiveAnalysis result={latestAnalysisResult} tier={user?.tier || "observer"} />
            </div>
          </div>
        );
      case "trend":
        return (
          <div key={key} id="section-trend">
            <p className="mb-3 px-1 text-xs text-white/40">How your visibility score has moved across all audits — see whether your fixes are actually working over time.</p>
            <VisibilityTrend
              data={serverHistory}
              currentScore={data.visibilityScore}
              totalAudits={serverAuditCount}
              onRefresh={refreshServerHistory}
              refreshing={trendRefreshing}
              categoryGrades={latestAnalysisResult.category_grades}
              topCategoryInsight={historyTopCategory}
              lowestCategoryInsight={historyLowestCategory}
              analyticsSeries={allAuditScoreSeries}
            />
          </div>
        );
      case "platforms":
        return (
          <div key={key} id="section-platforms">
            <p className="mb-3 px-1 text-xs text-white/40">How visible your page is to ChatGPT, Perplexity, Claude, and Google AI specifically — not just as an aggregate score.</p>
            <AIPlatformScores scores={data.aiPlatformScores} modelScores={data.aiModelScores} />
          </div>
        );
      case "citations": {
        const citationStrengths = latestAnalysisResult.domain_intelligence?.citation_strength || [];
        const citationDomains = latestAnalysisResult.domain_intelligence?.citation_domains || [];
        const platformScores = data.aiPlatformScores;
        const highCount = citationStrengths.filter(c => c.strength === 'high').length;
        const mediumCount = citationStrengths.filter(c => c.strength === 'medium').length;
        const totalCitations = citationDomains.length;
        const canAccessCitations = meetsMinimumTier(user?.tier || 'observer', 'alignment');

        return (
          <section id="section-citations" key={key} className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8 section-accent-cyan">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="brand-title text-lg">Citation & Mention Snapshot</h3>
              <span className="text-xs text-white/45">AI presence overview</span>
            </div>
            <p className="mb-4 text-xs text-white/45">Whether AI models are actually citing your URL — and what citation strength looks like across platforms.</p>

            {/* AI Platform Scores Mini Summary */}
            {platformScores && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {([
                  { label: 'ChatGPT', value: platformScores.chatgpt },
                  { label: 'Perplexity', value: platformScores.perplexity },
                  { label: 'Google AI', value: platformScores.google_ai },
                  { label: 'Claude', value: platformScores.claude },
                ] as const).map(p => (
                  <div key={p.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                    <div className="text-xs text-white/50 mb-1">{p.label}</div>
                    <div className={`text-lg font-bold ${p.value >= 70 ? 'text-emerald-400' : p.value >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                      {p.value}/100
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Citation Strength Summary */}
            {totalCitations > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-white/70">
                    <span className="font-semibold text-white">{totalCitations}</span> citation domains detected
                  </span>
                  {highCount > 0 && <span className="text-emerald-400">{highCount} high</span>}
                  {mediumCount > 0 && <span className="text-amber-400">{mediumCount} medium</span>}
                </div>
              </div>
            )}

            {/* CTA to full Citations page */}
            <Link
              to={canAccessCitations ? '/citations' : '/pricing'}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="flex items-center gap-3">
                <Eye className="h-9 w-9 text-white/75" />
                <div>
                  <span className="text-sm font-medium text-white/80">
                    {canAccessCitations ? 'Open Citation Tracker' : 'Unlock Citation Tracker'}
                  </span>
                  {!canAccessCitations && (
                    <span className="block text-xs text-white/45 mt-0.5">Alignment plan or above</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/45" />
            </Link>
          </section>
        );
      }
      case "modules": {
        const userTier = user?.tier || 'observer';
        const hasAlignment = meetsMinimumTier(userTier, 'alignment');
        const hasScorefix = meetsMinimumTier(userTier, 'scorefix');

        type ModuleRequiredTier = 'alignment' | 'scorefix' | null;
        const MODULE_ITEMS: {
          label: string;
          path: string;
          icon: React.ElementType;
          requiredTier: ModuleRequiredTier;
          desc: string;
        }[] = [
          { label: "Keywords",        path: "/keywords",         icon: Target,       requiredTier: null,        desc: "AI-surfaced keywords from your audit data" },
          { label: "Server Headers",  path: "/server-headers",   icon: Shield,       requiredTier: null,        desc: "HTTP headers and crawlability signals" },
          { label: "Indexing",        path: "/indexing",         icon: Activity,     requiredTier: null,        desc: "Indexability and crawl coverage" },
          { label: "Analytics",       path: "/analytics",        icon: BarChart3,    requiredTier: 'alignment', desc: "Score trends and fix impact tracking" },
          { label: "Competitors",     path: "/competitors",      icon: Users,        requiredTier: 'alignment', desc: "AI visibility scores vs. competitors" },
          { label: "Niche Discovery", path: "/niche-discovery",  icon: Search,       requiredTier: 'alignment', desc: "Topic gaps vs. top-ranking AI pages" },
          { label: "Citations",       path: "/citations",        icon: Eye,          requiredTier: 'alignment', desc: "Which AI models are citing your URL" },
          { label: "Reverse Engineer",path: "/reverse-engineer", icon: FlaskConical, requiredTier: 'alignment', desc: "Decompose how AI answers are structured" },
          { label: "Reports",         path: "/reports",          icon: FileText,     requiredTier: 'alignment', desc: "Export PDF, DOCX, and Markdown reports" },
          { label: "Score Fix",       path: "/score-fix",        icon: Zap,          requiredTier: 'scorefix',  desc: "Auto-ship fixes as GitHub pull requests" },
        ];

        const freeItems   = MODULE_ITEMS.filter(m => m.requiredTier === null);
        const alignItems  = MODULE_ITEMS.filter(m => m.requiredTier === 'alignment');
        const sfItems     = MODULE_ITEMS.filter(m => m.requiredTier === 'scorefix');

        const tierBadge = (req: ModuleRequiredTier) => {
          if (req === 'scorefix') return { label: 'Score Fix', cls: 'border-orange-400/30 bg-orange-400/10 text-orange-300' };
          if (req === 'alignment') return { label: 'Alignment', cls: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' };
          return null;
        };

        const renderModuleCard = (item: typeof MODULE_ITEMS[number]) => {
          const isLocked =
            (item.requiredTier === 'alignment' && !hasAlignment) ||
            (item.requiredTier === 'scorefix' && !hasScorefix);

          const badge = tierBadge(item.requiredTier);
          const Icon = item.icon;

          if (isLocked) {
            return (
              <Link
                key={item.path}
                to={`/pricing?intent=${item.requiredTier}&from=modules`}
                className="group relative flex items-start justify-between rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-white/15 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-8 w-8 shrink-0 text-white/25 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-white/35">{item.label}</span>
                    <p className="mt-0.5 text-[11px] leading-5 text-white/25">{item.desc}</p>
                  </div>
                </div>
                <div className="ml-2 shrink-0 flex flex-col items-end gap-1">
                  <Lock className="h-3.5 w-3.5 text-white/25" />
                  {badge && (
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-start justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-8 w-8 shrink-0 text-white/75 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-white/80">{item.label}</span>
                  <p className="mt-0.5 text-[11px] leading-5 text-white/45">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/45 shrink-0 mt-1" />
            </Link>
          );
        };

        return (
          <section id="section-modules" key={key} className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8 section-accent-violet">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="brand-title text-lg">Explore Modules</h3>
              <span className="text-xs text-white/45">
                {hasAlignment ? 'Full access' : `${freeItems.length} of ${MODULE_ITEMS.length} available`}
              </span>
            </div>
            <p className="mb-5 text-xs text-white/45">Jump to keyword intelligence, competitor tracking, citation testing, and reverse engineering tools.</p>

            {/* Free / unlocked tools */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {freeItems.map(renderModuleCard)}
              {hasAlignment && alignItems.map(renderModuleCard)}
              {hasScorefix && sfItems.map(renderModuleCard)}
            </div>

            {/* Locked tiers — shown only when not yet unlocked */}
            {!hasAlignment && (
              <div className="mt-5 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-cyan-400/60" />
                    <span className="text-xs font-semibold text-cyan-300/70">Unlock {alignItems.length} more tools — Alignment plan</span>
                  </div>
                  <Link
                    to="/pricing?intent=alignment&from=modules"
                    className="shrink-0 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-medium text-cyan-300 transition hover:bg-cyan-400/20"
                  >
                    $49/mo →
                  </Link>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {alignItems.map(renderModuleCard)}
                </div>
              </div>
            )}

            {!hasScorefix && (
              <div className="mt-3 rounded-2xl border border-orange-400/10 bg-orange-400/[0.03] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-orange-400/60" />
                    <span className="text-xs font-semibold text-orange-300/70">Automated PR remediation — Score Fix</span>
                  </div>
                  <Link
                    to="/pricing?intent=scorefix&from=modules"
                    className="shrink-0 rounded-lg border border-orange-400/20 bg-orange-400/10 px-3 py-1.5 text-[11px] font-medium text-orange-300 transition hover:bg-orange-400/20"
                  >
                    $299 / 250 credits →
                  </Link>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {sfItems.map(renderModuleCard)}
                </div>
              </div>
            )}
          </section>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white flex flex-col">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#232a38] via-[#2b3343] to-[#222a38]" />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(80,55,35,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(80,55,35,0.18) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <AuditProgressOverlay
        isActive={auditOverlayActive && !overlayMinimized}
        url={auditUrl}
        apiFinished={apiFinished}
        onComplete={() => setAuditOverlayActive(false)}
        onMinimize={() => setOverlayMinimized(true)}
        onPercentChange={setAuditPercent}
        tripleCheck={user?.tier === "signal" || user?.tier === "scorefix"}
        tier={user?.tier || "observer"}
        scanCount={Math.max(1, displayTargetScanCount)}
        isRetryScan={isRetryScan}
        requestId={auditRequestId}
        authToken={token}
      />

      <AuditProgressBanner
        isVisible={auditOverlayActive && overlayMinimized}
        url={auditUrl}
        percent={auditPercent}
        onExpand={() => setOverlayMinimized(false)}
        isFinished={apiFinished}
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {upgradeSuccess && (
          <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] p-4 flex items-center gap-3 backdrop-blur-md">
            <Sparkles className="h-5 w-5 shrink-0 text-emerald-300/80" />
            <p className="text-sm text-white/80">{upgradeSuccess}</p>
            <button type="button" onClick={() => setUpgradeSuccess(null)} className="ml-auto text-sm text-white/45 transition hover:text-white/75">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/15 bg-red-500/[0.06] p-4 flex items-center gap-3 backdrop-blur-md">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-300/80" />
            <p className="text-sm text-red-100/90">
              {error}
              {error.includes("Help Center") && (
                <a href="/help" className="ml-1 underline underline-offset-2 text-red-200 hover:text-white transition-colors">Open Help Center</a>
              )}
            </p>
            <button type="button" onClick={() => setError(null)} className="ml-auto text-sm text-red-200/50 transition hover:text-red-100">
              Dismiss
            </button>
          </div>
        )}

        {isAnalyzing && (
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center gap-3 backdrop-blur-md">
            <Loader2 className="h-5 w-5 animate-spin shrink-0 text-cyan-300/70" />
            <p className="text-sm text-white/65">Running deep audit. This can take a minute.</p>
          </div>
        )}
      </div>

      <HeroAnalyze
        onAnalyze={analyzeUrl}
        onAnalyzeUpload={analyzeUpload}
        onClearAudit={handleClearAuditView}
        isAnalyzing={isAnalyzing}
        hasResults={!!data}
        prefillUrl={heroPrefillUrl}
      />

      {!data && <TrustBadgesBar />}

      {data && latestAnalysisResult && (
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 sm:px-6 lg:px-8">

          {/* ── Compact audit meta strip ──────────────────────────────── */}
          {(auditUrl || data.url) && (
            <div className="mb-8 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-[#0c1628]/95 via-[#111827]/95 to-[#15122a]/95 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.03] backdrop-blur-xl">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  {/* ── Badges row ── */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Active audit target
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">
                      Audit #{Math.max(1, displayTargetScanCount)}
                    </span>
                  </div>

                  {/* ── Target URL ── */}
                  {(auditUrl || data.url || "").startsWith("upload://") ? (
                    <div className="inline-flex max-w-full items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5">
                      <span className="truncate text-base sm:text-lg font-semibold tracking-tight text-white/90">
                        {(auditUrl || data.url || "").replace("upload://", "")}
                      </span>
                      <span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">uploaded doc</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const targetUrl = (auditUrl || data.url || "").trim();
                        if (!targetUrl) return;
                        setHeroPrefillUrl(targetUrl);
                        setAuditUrl(targetUrl);
                      }}
                      className="group inline-flex max-w-full items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-left text-base sm:text-lg font-semibold tracking-tight text-white/90 break-all transition-all duration-200 hover:border-cyan-400/20 hover:bg-white/[0.06] hover:shadow-[0_0_20px_rgba(34,211,238,0.04)]"
                      title="Use this target URL in Analyze URL"
                    >
                      <span>{auditUrl || data.url}</span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-white/40 transition-all group-hover:text-cyan-300/70" />
                    </button>
                  )}

                  {/* ── Metadata badges ── */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-white/45">
                      <Clock3 className="h-3 w-3" />
                      {latestAnalysisResult.processing_time_ms ? `${Math.max(1, Math.round(latestAnalysisResult.processing_time_ms / 100) / 10)}s` : "N/A"}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${latestAnalysisResult.cached ? "border-amber-400/15 bg-amber-500/[0.06] text-amber-300/80" : "border-emerald-400/15 bg-emerald-500/[0.06] text-emerald-300/80"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${latestAnalysisResult.cached ? "bg-amber-400/80" : "bg-emerald-400/80"}`} />
                      {latestAnalysisResult.cached ? "Cached" : "Live"}
                    </span>
                    {latestAnalysisResult.analyzed_at ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-white/45">
                        {new Date(latestAnalysisResult.analyzed_at).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* ── Right controls column ── */}
                <div className="flex flex-wrap items-center gap-2 xl:flex-col xl:items-end xl:gap-3">
                  {/* Share buttons */}
                {hasLiveAuditResult ? (
                  <ShareButtons
                    url={auditUrl || data.url}
                    score={data.visibilityScore}
                    analyzedAt={latestAnalysisResult.analyzed_at}
                    auditId={latestAnalysisResult?.audit_id}
                    scanCount={Math.max(1, displayTargetScanCount)}
                  />
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300/15 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
                    <span>
                      {liveAuditBlockedByUsage
                        ? "Share + score summary require a live run. No live scans left this cycle."
                        : "Share + score summary unlock after a live run."}
                    </span>
                    <button
                      type="button"
                      disabled={liveAuditBlockedByUsage}
                      onClick={() => {
                        if (liveAuditBlockedByUsage) return;
                        const liveUrl = auditUrl || data.url || latestAnalysisResult.url || "";
                        if (!liveUrl || liveUrl.startsWith("upload://")) return;
                        void analyzeUrl(liveUrl, { retry: true, forceRefresh: true });
                      }}
                      className="rounded-md border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-100 transition-all hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {liveAuditBlockedByUsage ? "Limit reached" : "Run Live Audit"}
                    </button>
                  </div>
                )}

                  {/* ── View controls ── */}
                  <div className="flex items-center gap-1.5">
                    <div className="inline-flex rounded-lg border border-white/[0.07] bg-white/[0.02] p-0.5 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setViewMode('text')}
                        title="Plain-language summary of your audit"
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-medium transition-all duration-200 ${viewMode === 'text' ? 'bg-cyan-500/15 text-cyan-200 shadow-[inset_0_1px_0_rgba(34,211,238,0.1)]' : 'text-white/40 hover:text-white/65 hover:bg-white/[0.04]'}`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Quick View
                      </button>
                      {meetsMinimumTier(user?.tier || 'observer', 'alignment') && (
                      <button
                        type="button"
                        onClick={() => setViewMode('technical')}
                        title="Full detailed audit with scores, code data, and intricate details"
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-medium transition-all duration-200 ${viewMode === 'technical' ? 'bg-cyan-500/15 text-cyan-200 shadow-[inset_0_1px_0_rgba(34,211,238,0.1)]' : 'text-white/40 hover:text-white/65 hover:bg-white/[0.04]'}`}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Technical View
                      </button>
                      )}
                      {!meetsMinimumTier(user?.tier || 'observer', 'alignment') && (
                      <button
                        type="button"
                        onClick={() => navigate('/pricing')}
                        title="Technical view available on Alignment and above"
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-medium text-white/25 cursor-pointer hover:text-white/40 transition-all duration-200"
                      >
                        <Lock className="h-3 w-3" />
                        Technical View
                      </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSectionOrder((s) => !s)}
                      title="Customize section layout"
                      className={`inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-[10px] text-white/40 transition-all hover:border-white/15 hover:text-white/65 ${viewMode !== 'technical' ? 'hidden' : ''}`}
                    >
                      <GripVertical className="h-3 w-3" />
                      Layout
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAuditView}
                      title="Clear results and start a new audit (does not delete saved history)"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-[10px] text-white/40 transition-all hover:border-white/15 hover:text-white/65"
                    >
                      <RotateCcw className="h-3 w-3" />
                      New Audit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Section layout panel (shown directly under controls) ───── */}
          {showSectionOrder && viewMode === 'technical' && (
            <section className="mt-4 rounded-2xl border border-white/[0.07] bg-[#111827]/80 p-5 backdrop-blur-md">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide text-white/55">Reorder result sections</span>
                <button
                  type="button"
                  onClick={() => setSectionOrder(DEFAULT_SECTION_ORDER)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium text-white/45 transition-all hover:border-white/15 hover:text-white/70"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {orderedSections.map((section, index) => (
                  <div
                    key={section}
                    draggable
                    onDragStart={() => setDraggedSection(section)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggedSection) return;
                      dragSection(draggedSection, section);
                      setDraggedSection(null);
                    }}
                    onDragEnd={() => setDraggedSection(null)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all duration-200 ${draggedSection === section ? "border-cyan-400/25 bg-cyan-400/[0.06] shadow-[0_0_16px_rgba(34,211,238,0.06)]" : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12]"}`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 text-white/35 cursor-grab active:cursor-grabbing" />
                      <span className="text-xs text-white/65 capitalize">{section}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveSection(section, -1)} disabled={index === 0} className="rounded-md border border-white/[0.06] p-1 text-white/45 transition hover:text-white/70 disabled:opacity-20">
                        <ArrowUpRight className="h-3 w-3 -rotate-45" />
                      </button>
                      <button type="button" onClick={() => moveSection(section, 1)} disabled={index === orderedSections.length - 1} className="rounded-md border border-white/[0.06] p-1 text-white/45 transition hover:text-white/70 disabled:opacity-20">
                        <ArrowDownRight className="h-3 w-3 rotate-45" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Results navigation (technical view only) ──────────────── */}
          {viewMode === 'technical' && (
          <nav
            aria-label="Jump to audit section"
            className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 mb-6"
          >
            <div className="border-b border-white/[0.05] bg-[#111827]/95 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8">
              <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {orderedSections.map((section) => {
                  const meta = SECTION_META[section];
                  return (
                    <button
                      key={section}
                      type="button"
                      title={meta.subtitle}
                      onClick={() => {
                        const el = document.getElementById(`section-${section}`);
                        if (!el) return;
                        const top = el.getBoundingClientRect().top + window.scrollY - 56;
                        window.scrollTo({ top, behavior: "smooth" });
                      }}
                      className="shrink-0 whitespace-nowrap rounded-lg border border-transparent px-3 py-1.5 text-[11px] font-medium text-white/45 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-white/80"
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
          )}

          {/* ── Result sections ───────────────────────────────────────── */}
          <div className="flex flex-col gap-8">
            <AuditSnapshot data={data} latestAnalysisResult={latestAnalysisResult} onOpenAutoScoreFix={() => setAsfModalOpen(true)} />
            {autoScoreFixJobs.length > 0 && (
              <AutoScoreFixPipelinePanel
                jobs={autoScoreFixJobs}
                loading={autoScoreFixLoading}
                onOpenAutoScoreFix={() => setAsfModalOpen(true)}
              />
            )}
            {latestAnalysisResult?.competitor_hint && !competitorHintDismissed && (
              <CompetitorHintBanner
                hint={latestAnalysisResult.competitor_hint}
                onDismiss={() => setCompetitorHintDismissed(true)}
              />
            )}
            {viewMode === 'text' && latestAnalysisResult?.text_summary ? (
              <TextSummaryView
                summary={latestAnalysisResult.text_summary}
                score={data.visibilityScore}
                url={auditUrl || data.url}
                tier={(user?.tier || 'observer') as 'observer' | 'alignment' | 'signal' | 'scorefix'}
                onUpgrade={() => navigate('/pricing')}
                onSwitchTechnical={meetsMinimumTier(user?.tier || 'observer', 'alignment') ? () => setViewMode('technical') : undefined}
              />
            ) : (
              <AnimatePresence mode="wait">
                {orderedSections.map((section, sIdx) => (
                  <motion.div
                    key={section}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, delay: sIdx * 0.06, ease: "easeOut" }}
                  >
                    {renderSection(section)}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

        </main>
      )}

      {isAuthenticated && !data && (
        <div className="mx-auto mb-3 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            to="/integrations"
            className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-xs text-white/45 transition hover:border-white/10 hover:text-white/65"
          >
            <span className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />
              <span>Automation &amp; API</span>
              {featureStatus?.features?.scheduledRescans?.available && Number(featureStatus.features.scheduledRescans.count) > 0 && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
                  {Number(featureStatus.features.scheduledRescans.count)} scheduled
                </span>
              )}
            </span>
            <ChevronRight className="h-3.5 w-3.5 opacity-40" />
          </Link>
        </div>
      )}

      {!data && (
        <div className="space-y-2 pb-6">
          {isAuthenticated && (serverAuditCount > 0 || serverTotalScans > 0) ? (
            <ReturningUserQuickPanel
              totalAudits={serverAuditCount}
              totalScans={serverTotalScans}
              scoreSeries={allAuditScoreSeries}
              topCategory={historyTopCategory}
              lowestCategory={historyLowestCategory}
            />
          ) : (
            <AuditPreviewTeaser />
          )}
          <AgencyValueSection />
          <WorkflowSection />
          <ScoringMethodologySection />
          <PlatformComparisonSection />
          <CitationSignalsSection />
          <HomeFaqSection />
          <IndexingReadinessCard />
          <TrustSection featureStatus={featureStatus} />
        </div>
      )}

      {showOnboarding && (
        <OnboardingModal
          onClose={() => {
            markOnboardingComplete();
            setShowOnboarding(false);
          }}
          onAnalyze={(url) => {
            markOnboardingComplete();
            setShowOnboarding(false);
            analyzeUrl(url, { forceRefresh: true });
          }}
        />
      )}

      {latestAnalysisResult && (
        <AutoScoreFixModal
          open={asfModalOpen}
          onClose={() => setAsfModalOpen(false)}
          auditResult={latestAnalysisResult as any}
        />
      )}

      {generateFixTarget && (
        <GenerateFixDrawer
          action={generateFixTarget}
          context={{ url: latestAnalysisResult?.url, pageTitle: latestAnalysisResult?.title }}
          onClose={() => setGenerateFixTarget(null)}
        />
      )}
    </div>
  );
}

type GenerateFixAction = { title: string; description?: string; category?: string; impact?: string };
type GenerateFixContext = { url?: string; pageTitle?: string };

function GenerateFixDrawer({ action, context, onClose }: { action: GenerateFixAction; context: GenerateFixContext; onClose: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [fix, setFix] = useState<{ fix: string; format: string; explanation: string; category: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setFix(null);
    setError(null);

    fetchJson<{ success: boolean; fix: string; format: string; explanation: string; category: string }>(
      `${API_URL}/api/content/generate-fix`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, context }),
      }
    )
      .then((data) => { if (!cancelled) { setFix(data); setStatus("done"); } })
      .catch((err) => { if (!cancelled) { setError(err?.message || "Failed to generate fix"); setStatus("error"); } });

    return () => { cancelled = true; };
  }, [action.title]);

  const handleCopy = async () => {
    if (!fix?.fix) return;
    try {
      await navigator.clipboard.writeText(fix.fix);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-lg flex-col bg-[#0d1117] shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-base font-semibold text-white">Generate Fix</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-white/10 transition-colors">
            <X className="h-5 w-5 text-white/60" />
          </button>
        </div>

        <div className="flex-1 space-y-4 p-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1">{action.category || "General"}</div>
            <div className="text-sm font-semibold text-white">{action.title}</div>
            {action.description && <div className="mt-1 text-xs leading-5 text-white/55">{action.description}</div>}
          </div>

          {status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating fix…
            </div>
          )}

          {status === "error" && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>
          )}

          {status === "done" && fix && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-emerald-300/80">{fix.format}</span>
                  <button type="button" onClick={handleCopy} className="rounded p-1 hover:bg-white/10 transition-colors" title="Copy fix">
                    {copied ? <Check className="h-4 w-4 text-white/80" /> : <Copy className="h-4 w-4 text-white/50" />}
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-white/80">{fix.fix}</pre>
              </div>
              {fix.explanation && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/55">
                    <Sparkles className="h-3.5 w-3.5" />
                    Why this fix
                  </div>
                  <p className="text-sm leading-6 text-white/70">{fix.explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
