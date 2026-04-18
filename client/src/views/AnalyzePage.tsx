import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Spinner from '../components/Spinner';
import {
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Clock3,
  Workflow,
  RefreshCcw,
  Wand2,
  Lock,
  X,
  ClipboardPaste,
  Info,
} from "lucide-react";
import {
  AiVisibilityIcon,
  AnswerDecompilerIcon,
  ScoreFixIcon,
  AuditEngineIcon,
} from "../components/icons";
import { useAuthStore } from "../stores/authStore";
import ComprehensiveAnalysis from "../components/ComprehensiveAnalysis";
import TextSummaryView from "../components/TextSummaryView";
import ShareButtons from "../components/ShareButtons";
import { API_URL } from "../config";
import type { AnalysisResponse, TextSummary } from "@shared/types";
import apiFetch from "../utils/api";
import { usePageMeta } from "../hooks/usePageMeta";
import { PLATFORM_NARRATIVE } from "../constants/platformNarrative";
import PlatformShiftBanner from "../components/PlatformShiftBanner";
import FeatureInstruction from "../components/FeatureInstruction";
import ConversionCTA from "../components/ConversionCTA";
import { normalizePublicUrlInput } from "../utils/targetKey";
import PageQASection from "../components/PageQASection";
import { buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";

const normalizeUrl = normalizePublicUrlInput;

const ANALYZE_FAQ = [
  {
    question: "What is an AI visibility audit?",
    answer: "An AI visibility audit measures how well a website can be read, extracted, and cited by AI answer engines such as ChatGPT, Perplexity, Claude, and Google AI Overviews. It tests whether your content is structured, entity-clear, and evidence-dense enough for AI systems to trust and quote. Unlike traditional SEO audits that focus on keyword ranking, an AI visibility audit scores citation readiness, extraction clarity, trust signals, and machine-readable structure.",
  },
  {
    question: "Why isn't my site showing up in AI-generated answers?",
    answer: "Most websites fail AI visibility checks for one or more of these reasons: weak entity clarity (AI cannot resolve what the business is or who it serves), missing FAQ and answer blocks (questions are buried in long prose instead of concise extractable sections), incomplete or mismatched JSON-LD schema (machine-readable signals contradict visible content), thin evidence (claims without proof, examples, or citations), and no trust language such as methodology disclosures or verifiable credentials. AiVIS.biz identifies exactly which blockers apply to your site and ranks them by impact.",
  },
  {
    question: "What do the audit scores mean?",
    answer: "The overall visibility score is a composite out of 100 that combines seven evidence-backed dimensions: Schema & Structured Data (20%), Content Depth (18%), Technical Trust (15%), Meta Tags & Open Graph (15%), AI Readability (12%), Heading Structure (10%), and Security & Trust (10%). Scores below 20 indicate critical extractability blockers (grade F). Scores 20-39 are Poor (grade D) — significant structural barriers. Scores 40-59 are Fair (grade C) — parseable but deprioritized. Scores 60-79 are Good (grade B) — citation-ready with minor gaps. Scores 80 and above are Excellent (grade A) — consistently citable across major AI engines.",
  },
  {
    question: "Which AI platforms does AiVIS.biz check against?",
    answer: "AiVIS.biz audits evaluate citation readiness across the four major AI answer surfaces: ChatGPT (OpenAI), Perplexity AI, Claude (Anthropic), and Google AI Overviews (formerly SGE). Each platform has different extraction thresholds, citation criteria, and entity resolution preferences. The audit scores are calibrated against observable citation behavior across all four platforms so improvements transfer across the ecosystem rather than optimizing for a single engine.",
  },
  {
    question: "How long does an audit take?",
    answer: "Most audits complete in 30-60 seconds. The pipeline fetches the live page, extracts visible content and structured data, runs multi-signal technical checks, and sends the evidence package through an AI analysis chain that scores each dimension and generates prioritized recommendations. Observer (free) tier uses a single AI model. Signal tier runs a Triple-Check Pipeline with three independent models for higher scoring confidence.",
  },
  {
    question: "What is the difference between AI visibility and traditional SEO?",
    answer: "Traditional SEO optimizes for keyword-match ranking algorithms that score pages on backlinks, anchor text, and keyword density. AI visibility optimization prepares content for probabilistic extraction: answering specific questions concisely, structuring content with clear entity-subject-predicate relationships, aligning JSON-LD schema to visible claims, and providing evidence that answer engines can surface as cited facts. A page can rank on page one of Google and score near zero for AI visibility if its content is not structured for machine extraction.",
  },
  {
    question: "How often should I re-audit?",
    answer: "After any significant content update, template redesign, schema change, or navigation restructure, re-auditing within 48 hours lets you confirm whether the changes improved extraction clarity. For competitive markets, monthly re-audits track drift versus competitors being cited in your category. AiVIS.biz stores audit history so you can compare scores over time and measure whether implemented fixes actually moved the needle.",
  },
  {
    question: "Is the audit score tied to my server technology or CMS?",
    answer: "No. The audit evaluates the rendered HTML that AI crawlers actually see, not the technology stack behind it. Scores reflect content structure, semantic markup, entity clarity, and evidence density — factors that apply equally to WordPress, Webflow, Next.js, custom builds, and static sites. The only technical factors scored are those visible to an HTTP client: headers, schema markup, canonical tags, robots directives, and rendering fidelity.",
  },
];

const validateUrl = (input: string): boolean => {
  try {
    const normalized = normalizeUrl(input);
    const urlObj = new URL(normalized);
    const host = urlObj.hostname.toLowerCase();

    // Block local/private hosts
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) return false;

    if (!host || host.replace(/\.+$/, "").length === 0) return false;
    return true;
  } catch {
    return false;
  }
};

type ProgressState = {
  requestId: string | null;
  step: string;
  percent: number;
};

type ProgressEventPayload = {
  step?: string;
  stage?: string;
  percent?: number;
  progress?: number;
};

type ApiFetchOptions = Parameters<typeof apiFetch>[1];
type AnalysisResultWithTextSummary = AnalysisResponse & { text_summary?: TextSummary };

type AuditExpectation = {
  icon: React.ElementType;
  label: string;
  detail: string;
};

type DemoBaselineSnapshot = {
  url: string;
  visibility_score: number;
  analyzed_at: string;
  category_grades?: Array<{ label: string; score: number }>;
};

const DEMO_BASELINE_STORAGE_KEY = "aivis.demo.beforeBaseline.v1";

const AUDIT_EXPECTATIONS: AuditExpectation[] = [
  {
    icon: AuditEngineIcon,
    label: "Evidence-backed scoring",
    detail: "See how the page holds up on visibility, trust, structure, and extraction clarity.",
  },
  {
    icon: AnswerDecompilerIcon,
    label: "Issue-level findings",
    detail: "Get specific blockers instead of vague recommendations.",
  },
  {
    icon: ScoreFixIcon,
    label: "Action-ready fixes",
    detail: "Turn the audit into implementation priorities, not just observation.",
  },
  {
    icon: AiVisibilityIcon,
    label: "AI visibility focus",
    detail: "Built for answer engines, AI overviews, summarization, and citation readiness.",
  },
];

const QUICK_EXAMPLES = ["aivis.biz", "openai.com", "stripe.com", "hubspot.com"];

const PROGRESS_LABELS: Record<string, string> = {
  idle: "Idle",
  starting: "Preparing audit",
  initializing: "Preparing audit",
  dns: "Resolving domain",
  crawl: "Fetching page content",
  extract: "Extracting visible signals",
  schema: "Checking schema and entities",
  technical: "Checking technical trust",
  security: "Running security scan",
  ai1: "Running primary AI analysis",
  ai2: "Running peer critique",
  ai3: "Running validation gate",
  compile: "Compiling score",
  finalize: "Building report",
  complete: "Complete",
  timeout: "Timed out",
};

const PIPELINE_STEPS = [
  { key: "dns", label: "Resolving domain" },
  { key: "crawl", label: "Fetching page" },
  { key: "extract", label: "Extracting signals" },
  { key: "schema", label: "Schema & entities" },
  { key: "technical", label: "Technical trust" },
  { key: "security", label: "Security scan" },
  { key: "ai1", label: "Primary AI analysis" },
  { key: "ai2", label: "Peer critique" },
  { key: "ai3", label: "Validation gate" },
  { key: "compile", label: "Compiling score" },
  { key: "finalize", label: "Building report" },
] as const;

const PIPELINE_KEYS = PIPELINE_STEPS.map((s) => s.key);

function toProgressLabel(step: string): string {
  return PROGRESS_LABELS[step] || step.replace(/_/g, " ");
}

function getProgressTone(percent: number): "neutral" | "good" {
  return percent >= 100 ? "good" : "neutral";
}

function getProgressNarrative(percent: number): string {
  if (percent >= 75) return "Compiling the evidence into a verdict and fix path";
  if (percent >= 40) return "We are validating structure, trust, and extraction blockers";
  if (percent > 0) return "Collecting evidence of what AI can read, trust, and cite";
  return "Ready to run";
}

function getStageMicrocopy(step: string): string[] {
  const normalized = (step || "starting").toLowerCase();
  if (normalized.includes("dns")) {
    return ["Resolving domain", "Checking reachability", "Starting the audit context"];
  }
  if (normalized.includes("crawl") || normalized.includes("fetch")) {
    return ["Fetching page content", "Checking visible structure", "Capturing raw page signals"];
  }
  if (normalized.includes("extract")) {
    return ["Extracting visible signals", "Reading headings and metadata", "Linking evidence to findings"];
  }
  if (normalized.includes("schema")) {
    return ["Validating JSON-LD", "Checking entity graph", "Comparing markup to visible content"];
  }
  if (normalized.includes("technical")) {
    return ["Checking canonicals and HTTPS", "Reviewing crawl and answer-engine access", "Scoring technical trust"];
  }
  if (normalized.includes("security")) {
    return ["Scanning threat indicators", "Reviewing exposure risk", "Adding security findings to the audit"];
  }
  if (normalized.includes("ai1")) {
    return ["Running primary AI analysis", "Scoring citation readiness", "Ranking blocker impact"];
  }
  if (normalized.includes("ai2")) {
    return ["Running peer critique", "Checking for missed blockers", "Adjusting score confidence"];
  }
  if (normalized.includes("ai3")) {
    return ["Running validation gate", "Confirming critical findings", "Locking the final verdict"];
  }
  if (normalized.includes("compile")) {
    return ["Compiling score", "Calculating category grades", "Preparing issue priority order"];
  }
  if (normalized.includes("recommend") || normalized.includes("report")) {
    return ["Building report", "Prioritizing fixes", "Preparing evidence view"];
  }
  if (normalized.includes("complete")) {
    return ["Audit complete", "Verdict ready", "Open report below"];
  }
  return ["Preparing audit", "Checking structure", "Collecting evidence"];
}

function sanitizeResponseJson<T>(response: Response): Promise<T> {
  return response.text().then((text) => {
    if (!text) throw new Error("Empty response from server. Please try again.");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("Invalid response from server. Please try again.");
    }
  });
}

const AnalyzePage: React.FC = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    requestId: null,
    step: "idle",
    percent: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [scanLimitReached, setScanLimitReached] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [resultView, setResultView] = useState<"summary" | "technical">("summary");
  const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState<string | null>(null);
  const [demoBaseline, setDemoBaseline] = useState<DemoBaselineSnapshot | null>(null);
  const [browsingPromptVisible, setBrowsingPromptVisible] = useState(false);
  const browsingPromptRef = useRef<HTMLDivElement>(null);
  const resultTextSummary = result ? (result as AnalysisResultWithTextSummary).text_summary : undefined;

  usePageMeta({
    title: "Analyze",
    description: "Run an AI visibility audit on any website. Get evidence-backed scoring and actionable recommendations.",
    path: "/analyze",
    structuredData: [
      buildWebPageSchema({
        path: "/analyze",
        name: "AI Visibility Audit Tool | AiVIS.biz",
        description: "Run an evidence-backed AI visibility audit on any website. Score citation readiness, extraction clarity, entity signals, and trust markers across ChatGPT, Perplexity, Claude, and Google AI Overviews.",
      }),
      buildFaqSchema(ANALYZE_FAQ, { path: "/analyze" }),
    ],
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressSourceRef = useRef<EventSource | null>(null);
  const pendingAutostartRef = useRef(false);
  const sseAliveRef = useRef(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, isAuthenticated, isHydrated, refreshUser, logout, user } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated && token) {
      refreshUser().then((success) => {
        if (!success) {
          logout();
          navigate("/auth?mode=signin");
        }
      });
    } else if (!isAuthenticated) {
      navigate("/auth?mode=signin");
    }
  }, [isAuthenticated, isHydrated, token, refreshUser, logout, navigate]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("aivis.lastAnalyzedUrl");
      if (stored) setLastAnalyzedUrl(stored);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    const requestedUrl = searchParams.get("url");
    if (!requestedUrl) return;
    setUrl(requestedUrl);
    if (searchParams.get("autostart") === "1") {
      pendingAutostartRef.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DEMO_BASELINE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DemoBaselineSnapshot;
      if (!parsed || typeof parsed !== "object") return;
      if (typeof parsed.url !== "string") return;
      if (typeof parsed.visibility_score !== "number") return;
      if (typeof parsed.analyzed_at !== "string") return;
      setDemoBaseline(parsed);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (!url.trim()) {
      setValidationError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      if (!validateUrl(url)) {
        setValidationError("Enter a valid URL or domain like example.com or https://example.com");
      } else {
        setValidationError(null);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [url]);

  useEffect(() => {
    return () => {
      try {
        abortControllerRef.current?.abort();
      } catch {
        // no-op
      }
      try {
        progressSourceRef.current?.close();
      } catch {
        // no-op
      }
    };
  }, []);

  // Fallback timer: if real SSE events are flowing, do nothing. Otherwise
  // synthesise both step AND percent so the pipeline checklist animates.
  useEffect(() => {
    if (!loading) return;
    const FALLBACK_SCHEDULE: { step: string; pct: number }[] = [
      { step: "dns", pct: 5 },
      { step: "crawl", pct: 15 },
      { step: "extract", pct: 25 },
      { step: "schema", pct: 35 },
      { step: "technical", pct: 38 },
      { step: "security", pct: 42 },
      { step: "ai1", pct: 50 },
      { step: "ai2", pct: 60 },
      { step: "ai3", pct: 75 },
      { step: "compile", pct: 90 },
      { step: "finalize", pct: 92 },
    ];
    let idx = 0;
    const tick = window.setInterval(() => {
      // Real SSE is driving progress — skip synthetic updates
      if (sseAliveRef.current) return;
      setProgress((prev) => {
        if (prev.percent >= 92 || prev.step === "complete") return prev;
        const target = FALLBACK_SCHEDULE[idx];
        if (!target) return prev;
        idx = Math.min(idx + 1, FALLBACK_SCHEDULE.length - 1);
        return { ...prev, step: target.step, percent: target.pct };
      });
    }, 3000);
    return () => window.clearInterval(tick);
  }, [loading]);

  // Show "continue browsing" prompt 2s after audit starts, auto-dismiss after 8s
  useEffect(() => {
    if (!loading) { setBrowsingPromptVisible(false); return; }
    const showTimer = window.setTimeout(() => setBrowsingPromptVisible(true), 2000);
    const hideTimer = window.setTimeout(() => setBrowsingPromptVisible(false), 10000);
    return () => { window.clearTimeout(showTimer); window.clearTimeout(hideTimer); };
  }, [loading]);

  // Dismiss browsing prompt on click outside
  useEffect(() => {
    if (!browsingPromptVisible) return;
    function handleClick(e: MouseEvent) {
      if (browsingPromptRef.current && !browsingPromptRef.current.contains(e.target as Node)) {
        setBrowsingPromptVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [browsingPromptVisible]);

  function closeProgressStream() {
    try {
      progressSourceRef.current?.close();
    } catch {
      // no-op
    }
    progressSourceRef.current = null;
  }

  function openProgressStream(requestId: string) {
    closeProgressStream();

    const sseUrl = `${API_URL}/api/audit/progress/${encodeURIComponent(requestId)}`;
    const es = new EventSource(sseUrl, { withCredentials: true });
    progressSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as ProgressEventPayload;
        const nextStep = data.step || data.stage;
        const nextPercent = typeof data.percent === "number" ? data.percent : data.progress;
        if (typeof nextPercent === "number" && typeof nextStep === "string") {
          sseAliveRef.current = true;
          setProgress({
            requestId,
            step: nextStep,
            percent: Math.max(0, Math.min(100, Math.round(nextPercent))),
          });
        }
      } catch {
        // ignore malformed progress events
      }
    };

    es.onerror = () => {
      closeProgressStream();
      // SSE dropped but the POST is still pending — update step text so the user
      // knows progress tracking was lost, not the analysis itself.
      setProgress((prev) =>
        prev.step === "complete" ? prev : { ...prev, step: "processing" }
      );
    };
  }

  async function fetchWithRetry(requestUrl: string, options: ApiFetchOptions, retries = 2): Promise<Response> {
    for (let i = 0; i <= retries; i += 1) {
      try {
        const response = await apiFetch(requestUrl, options);

        if (response.status === 429 && i < retries) {
          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(resolve, 1500 * (i + 1));
            const signal = (options as any)?.signal as AbortSignal | undefined;

            if (signal) {
              const onAbort = () => {
                window.clearTimeout(timer);
                reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
              };
              if (signal.aborted) return onAbort();
              signal.addEventListener("abort", onAbort, { once: true });
            }
          });
          continue;
        }

        return response;
      } catch (err: any) {
        if (err?.name === "AbortError") throw err;
        if (i === retries) throw err;

        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 1500 * (i + 1));
          const signal = (options as any)?.signal as AbortSignal | undefined;

          if (signal) {
            const onAbort = () => {
              window.clearTimeout(timer);
              reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
            };
            if (signal.aborted) return onAbort();
            signal.addEventListener("abort", onAbort, { once: true });
          }
        });
      }
    }

    throw new Error("Max retries exceeded");
  }

  async function handleAnalyze() {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError("Please enter a valid URL to analyze");
      return;
    }

    if (!validateUrl(trimmedUrl)) {
      setError("Please enter a valid URL format like example.com or https://example.com");
      return;
    }

    setValidationError(null);

    const normalizedUrl = normalizeUrl(trimmedUrl);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const HARD_TIMEOUT_MS = 300_000;
    const timeoutId = window.setTimeout(() => {
      abortControllerRef.current?.abort();
    }, HARD_TIMEOUT_MS);

    try {
      setLoading(true);
      setError(null);
      setScanLimitReached(false);
      setResult(null);
      setResultView("summary");
      sseAliveRef.current = false;

      // Generate requestId client-side so we can open the SSE stream
      // immediately, in parallel with the POST (not after the response).
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setProgress({ requestId, step: "starting", percent: 0 });
      openProgressStream(requestId);

      const endpoint = `${API_URL}/api/analyze`;

      const response = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ url: normalizedUrl, forceRefresh: true, requestId }),
        timeoutMs: HARD_TIMEOUT_MS,
        signal: abortSignal,
      }, 0);

      if (response.status === 401) {
        closeProgressStream();
        logout();
        navigate("/auth?mode=signin");
        return;
      }

      if (!response.ok) {
        closeProgressStream();
        const errorData: any = await sanitizeResponseJson<any>(response).catch(() => ({}));

        if (errorData?.code === "INVALID_URL") throw new Error(errorData.error || "Invalid URL format");
        if (errorData?.code === "SCRAPE_FAILED") {
          throw new Error(errorData.error || "Unable to access website. Check the URL and try again.");
        }
        if (errorData?.code === "SERVER_CONFIG_ERROR") {
          throw new Error("Server configuration issue. Please try again shortly.");
        }
        if (errorData?.code === "TIMEOUT_ERROR") {
          throw new Error("Website took too long to respond. Please try again.");
        }
        if (errorData?.code === "NETWORK_ERROR") {
          throw new Error("Could not reach the website. Please verify the URL is correct.");
        }
        if (errorData?.code === "USAGE_LIMIT_REACHED") {
          setScanLimitReached(true);
          setLoading(false);
          return;
        }
        if (response.status === 429) {
          throw new Error(errorData?.error || "Rate limit exceeded. Please wait a moment and try again.");
        }
        if (response.status === 500) {
          throw new Error("Server error occurred. Please try again in a moment.");
        }
        if (response.status === 503) {
          throw new Error("Service temporarily unavailable. Please try again shortly.");
        }

        throw new Error(errorData?.error || `Analysis failed with status ${response.status}. Please try again.`);
      }

      const data: AnalysisResponse = await sanitizeResponseJson<AnalysisResponse>(response);

      if (!data || typeof data !== "object") {
        closeProgressStream();
        throw new Error("Invalid response from server. Please try again.");
      }

      setResult(data);
      setResultView((data as AnalysisResultWithTextSummary).text_summary ? "summary" : "technical");
      setProgress((p) => ({ ...p, step: "complete", percent: 100 }));
      setLastAnalyzedUrl(data.url || normalizedUrl);

      try {
        window.localStorage.setItem("aivis.lastAnalyzedUrl", data.url || normalizedUrl);
      } catch {
        // no-op
      }

      window.clearTimeout(timeoutId);
      closeProgressStream();

      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "analysis_complete", {
          url: data.url,
          visibility_score: data.visibility_score,
        });
      }

      // Navigate to Snapshot (intermediate result page) instead of showing inline
      navigate("/app/snapshot", { state: { result: data } });
    } catch (err: any) {
      closeProgressStream();
      console.error("[AnalyzePage] Audit API call failed", err);

      if (err?.name === "AbortError") {
        setError("Analysis timed out. The site may be slow or the models are busy. Try again.");
        setProgress((p) => ({ ...p, step: "timeout", percent: Math.min(99, p.percent || 0) }));
        return;
      }

      if (err?.message?.toLowerCase().includes("unauthorized") || err?.message?.includes("401")) {
        logout();
        navigate("/auth?mode=signin");
        return;
      }

      if (err?.message?.toLowerCase().includes("failed to fetch") || err?.message?.toLowerCase().includes("networkerror")) {
        setError(
          "Could not reach the analysis server. If the first pass completed server-side, the second pass is often faster due to caching."
        );
        return;
      }

      setError(err?.message || "Analysis failed. Please try again.");
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  // Auto-start analysis when navigated with ?autostart=1
  useEffect(() => {
    if (!pendingAutostartRef.current) return;
    if (!url.trim() || loading) return;
    pendingAutostartRef.current = false;
    handleAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) handleAnalyze();
  };

  const canAnalyze = !!url.trim() && !validationError && !loading;
  const stageMicrocopy = useMemo(() => getStageMicrocopy(progress.step), [progress.step]);

  const pipelineStatuses = useMemo(() => {
    if (!loading) return null;
    const activeIndex = PIPELINE_KEYS.indexOf(progress.step);
    return PIPELINE_STEPS.map((s, i) => ({
      ...s,
      status: activeIndex < 0 ? ("pending" as const) : i < activeIndex ? ("completed" as const) : i === activeIndex ? ("active" as const) : ("pending" as const),
    }));
  }, [loading, progress.step]);

  const normalizedPreview = useMemo(() => {
    if (!url.trim() || validationError) return null;
    return normalizeUrl(url.trim());
  }, [url, validationError]);

  const activeResultUrl = useMemo(() => {
    if (!result?.url) return null;
    return normalizeUrl(result.url);
  }, [result?.url]);

  const activeBaselineUrl = useMemo(() => {
    if (!demoBaseline?.url) return null;
    return normalizeUrl(demoBaseline.url);
  }, [demoBaseline?.url]);

  const isSameTargetAsBaseline = !!activeResultUrl && !!activeBaselineUrl && activeResultUrl === activeBaselineUrl;

  const baselineDelta = useMemo(() => {
    if (!result || !demoBaseline || !isSameTargetAsBaseline) return null;
    const scoreDelta = result.visibility_score - demoBaseline.visibility_score;

    const baselineCategories = new Map((demoBaseline.category_grades ?? []).map((c) => [c.label, c.score]));

    const categoryDeltas = (result.category_grades ?? [])
      .map((grade) => {
        const previous = baselineCategories.get(grade.label);
        if (typeof previous !== "number") return null;
        return {
          label: grade.label,
          delta: grade.score - previous,
        };
      })
      .filter((item): item is { label: string; delta: number } => !!item)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 4);

    return { scoreDelta, categoryDeltas };
  }, [result, demoBaseline, isSameTargetAsBaseline]);

  const saveCurrentAsDemoBaseline = () => {
    if (!result) return;

    const payload: DemoBaselineSnapshot = {
      url: result.url || "",
      visibility_score: result.visibility_score,
      analyzed_at: result.analyzed_at,
      category_grades: (result.category_grades ?? []).map((grade) => ({
        label: grade.label,
        score: grade.score,
      })),
    };

    try {
      window.localStorage.setItem(DEMO_BASELINE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // no-op
    }

    setDemoBaseline(payload);
  };

  const clearDemoBaseline = () => {
    try {
      window.localStorage.removeItem(DEMO_BASELINE_STORAGE_KEY);
    } catch {
      // no-op
    }
    setDemoBaseline(null);
  };

  return (
    <div className="space-y-6 text-white">

      {/* ── Soft browsing prompt (auto-dismiss) ─────────────── */}
      {browsingPromptVisible && (
        <div
          ref={browsingPromptRef}
          className="fixed bottom-6 right-6 z-[300] max-w-xs animate-[slideInRight_0.35s_ease-out] rounded-xl border border-cyan-400/20 bg-[#1e2536]/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur-sm"
          style={{ animation: "slideInRight 0.35s ease-out" }}
        >
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90">Your audit is running</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Feel free to continue browsing — you'll be notified when it's complete.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBrowsingPromptVisible(false)}
              className="shrink-0 rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Page heading ─────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <AuditEngineIcon className="h-5 w-5 text-orange-400" />
          AI Visibility Audit
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Run an evidence-backed audit to uncover visibility blockers, trust gaps, and extraction weaknesses.
        </p>
      </div>

      <FeatureInstruction
        headline="How to run your first audit"
        steps={[
          "Paste any public URL into the box below — your homepage, a product page, or a competitor.",
          "Click Analyze and wait for the multi-model AI pipeline to finish (30–60 seconds).",
          "Review your visibility score, category grades, and the prioritized fix list.",
          "Use the recommendations to improve structure, schema, and trust signals — then re-audit to measure the lift.",
        ]}
        benefit="Every scan produces evidence-backed findings with actionable fixes ranked by expected visibility impact."
        defaultCollapsed
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-white/10 bg-charcoal/80 p-6 shadow-2xl sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
              <AuditEngineIcon className="h-3.5 w-3.5" />
              AI Visibility Audit
            </div>

            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Analyze your site the way AI systems read it
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/65">
              Run an evidence-backed audit on any website to uncover visibility blockers, trust gaps, extraction weaknesses, and the fixes most likely to improve AI comprehension and citation readiness.
            </p>

            <div className="mt-6 max-w-3xl">
              <PlatformShiftBanner
                eyebrow="Why this matters"
                title={PLATFORM_NARRATIVE.disruption}
                body={PLATFORM_NARRATIVE.oneLiner}
                bullets={PLATFORM_NARRATIVE.pillars}
              />
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-charcoal-deep">
              <img
                src="/analyze.png"
                alt="AI visibility analyze workflow preview"
                className="h-44 w-full object-cover object-center opacity-90"
                loading="lazy"
              />
            </div>

            <div className="mt-6 grid gap-3 grid-cols-2 xl:grid-cols-4">
              {AUDIT_EXPECTATIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-charcoal-deep p-4">
                    <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-charcoal p-2.5">
                      <Icon className="h-4 w-4 text-white/75" />
                    </div>
                    <div className="text-sm font-semibold text-white/85">{item.label}</div>
                    <div className="mt-1 text-xs leading-relaxed text-white/55">{item.detail}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="rounded-xl border border-white/10 bg-charcoal/80 p-6 shadow-2xl sm:p-8">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-white/70" />
              <h2 className="text-sm font-semibold text-white/85">What happens during the audit</h2>
            </div>

            <div className="mt-4 mb-5 overflow-hidden rounded-2xl border border-white/10">
              <img
                src="/images/structured.jpeg"
                alt="Structured content extraction during audit"
                className="h-32 w-full object-cover object-center opacity-85"
                loading="lazy"
              />
            </div>

            <div className="mt-5 space-y-3">
              {[
                ["1", "Fetch and validate the page", "We normalize the URL and attempt to reach the target safely."],
                ["2", "Extract visible signals", "Headings, structure, trust elements, and content patterns are inspected."],
                ["3", "Score AI visibility", "The page is evaluated for clarity, extraction readiness, and evidence depth."],
                ["4", "Generate actions", "You get concrete recommendations instead of generic SEO filler."],
              ].map(([step, title, detail]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-charcoal text-xs font-semibold text-white/80">
                      {step}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white/85">{title}</div>
                      <div className="mt-1 text-xs leading-6 text-white/55">{detail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-charcoal-deep p-4">
              <div className="text-xs uppercase tracking-wide text-white/45">Best results</div>
              <div className="mt-2 text-sm leading-7 text-white/70">
                Public pages with clear content and reachable markup tend to produce the strongest audits. Very slow sites, blocked pages, or heavy client-side rendering may reduce completeness.
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-6 rounded-xl border border-white/10 bg-charcoal/80 p-6 shadow-2xl sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-white/75" />
                <h2 className="text-lg font-semibold text-white">Start a new audit</h2>
              </div>
              <p className="mt-2 text-sm leading-7 text-white/60">
                Enter a domain or full URL. We’ll normalize it, validate it, and run the audit flow from there.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="url-input" className="mb-2 block text-sm font-medium text-white/75">
                    Website URL
                  </label>
                  <div className="relative">
                    <input
                      id="url-input"
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={handleKeyPress}
                      enterKeyHint="go"
                      placeholder="example.com or https://example.com"
                      disabled={loading}
                      className="w-full rounded-2xl border border-white/10 bg-charcoal px-4 py-4 pr-20 text-sm text-white placeholder-white/45 transition-all focus:border-white/15 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {url && (
                        <button
                          type="button"
                          onClick={() => setUrl("")}
                          disabled={loading}
                          className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white/80 disabled:opacity-40"
                          title="Clear"
                          aria-label="Clear URL"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text?.trim()) setUrl(text.trim());
                          } catch { /* clipboard permission denied */ }
                        }}
                        disabled={loading}
                        className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white/80 disabled:opacity-40"
                        title="Paste from clipboard"
                        aria-label="Paste from clipboard"
                      >
                        <ClipboardPaste className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {normalizedPreview && !validationError && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Normalized: {normalizedPreview}
                    </div>
                  )}

                  {validationError && (
                    <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {error && !scanLimitReached && (
                    <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {scanLimitReached && (
                    <div className="mt-3">
                      <ConversionCTA variant="scan-limit" />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {QUICK_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setUrl(example)}
                      disabled={loading}
                      className="rounded-full border border-white/10 bg-charcoal-deep px-3 py-1.5 text-xs text-white/75 transition-colors hover:text-white disabled:opacity-50"
                    >
                      {example}
                    </button>
                  ))}

                  {lastAnalyzedUrl && (
                    <button
                      type="button"
                      onClick={() => setUrl(lastAnalyzedUrl)}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1.5 text-xs text-white/75 transition-colors hover:text-white disabled:opacity-50"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Use last analyzed URL
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    onClick={handleAnalyze}
                    disabled={!canAnalyze}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-400 px-6 py-4 text-sm font-semibold text-slate-950 transition-all hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <Spinner className="h-5 w-5" />
                        Analyzing how AI reads your site…
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        See Your Visibility
                      </>
                    )}
                  </button>

                  <Link
                    to="/guide?section=audit-criteria&source=analyze-page"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-charcoal-deep px-5 py-4 text-sm text-white/75 transition-colors hover:text-white"
                  >
                    View scoring criteria
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-white/75" />
                  <h3 className="text-sm font-semibold text-white/85">Live audit progress</h3>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-white/75">
                  <span className="capitalize">{toProgressLabel(progress.step)}</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-charcoal">
                  <div
                    className={`h-2 transition-all duration-700 ease-out ${getProgressTone(progress.percent) === "good" ? "bg-gradient-to-r from-emerald-300/80 to-emerald-200/60" : "bg-gradient-to-r from-cyan-400/40 to-white/18"}`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-cyan-100/80">{getProgressNarrative(progress.percent)}</div>

                <div className="mt-4 rounded-xl border border-white/10 bg-charcoal p-4 text-xs leading-6 text-white/60">
                  {loading
                    ? "Resolving the domain \u00b7 extracting evidence \u00b7 scoring trust and citation readiness \u00b7 building the report."
                    : lastAnalyzedUrl
                      ? <>Last audited: <span className="text-white/80 font-medium">{lastAnalyzedUrl}</span>. Enter a URL above to start a new audit.</>
                      : "No audits yet. Run your first audit and see what AI cannot verify, what is blocking trust, and what to fix first."}
                </div>

                {loading && pipelineStatuses && (
                  <div className="mt-4 space-y-1">
                    {pipelineStatuses.map((step, i) => (
                      <div
                        key={step.key}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-500 ease-out ${
                          step.status === "active"
                            ? "border border-cyan-400/20 bg-charcoal scale-[1.01] shadow-sm shadow-cyan-500/5"
                            : step.status === "completed"
                              ? "opacity-70"
                              : "opacity-30"
                        }`}
                        style={{
                          transitionDelay: `${i * 30}ms`,
                          transform: step.status === "active" ? "translateX(2px)" : "translateX(0)",
                        }}
                      >
                        {step.status === "completed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400 transition-transform duration-300" />
                        ) : step.status === "active" ? (
                          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]" />
                        ) : (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/15" />
                        )}
                        <span
                          className={`text-xs transition-colors duration-300 ${
                            step.status === "active"
                              ? "text-white/90 font-medium"
                              : step.status === "completed"
                                ? "text-white/60"
                                : "text-white/35"
                          }`}
                        >
                          {step.label}
                        </span>
                        {step.status === "active" && (
                          <span className="ml-auto text-[10px] text-cyan-300/60 animate-pulse">running</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-white/75" />
                  <h3 className="text-sm font-semibold text-white/85">What you’ll get</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    "Visibility score and evidence-backed breakdown",
                    "Clear recommendations tied to blockers",
                    "A stronger view of AI extraction readiness",
                    "A base for Score Fix or implementation work",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-white/70">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {result && (
          <section id="analysis-report" className="mt-8 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-charcoal/80 p-5 shadow-2xl sm:p-6 space-y-5">
              {/* Row 1: badge + share strip */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Audit Complete
                </div>
                <ShareButtons
                  url={result.url}
                  score={result.visibility_score}
                  analyzedAt={result.analyzed_at}
                  auditId={result.audit_id}
                />
              </div>

              {/* Row 2: headline + view toggle */}
              <div>
                <h2 className="text-2xl font-semibold text-white">See your visibility. Then fix what AI cannot trust.</h2>
                <p className="mt-2 text-sm leading-7 text-white/60">
                  AI can extract your content, but it does not trust it enough to use it in answers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {resultTextSummary && (
                  <div className="inline-flex rounded-2xl border border-white/10 bg-charcoal-deep p-1">
                    <button
                      type="button"
                      onClick={() => setResultView("summary")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                        resultView === "summary"
                          ? "bg-cyan-400/15 text-cyan-100"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      Simple Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultView("technical")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                        resultView === "technical"
                          ? "bg-cyan-400/15 text-cyan-100"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      Technical View
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/app/score-fix"
                    className="rounded-xl border border-white/10 bg-charcoal-deep px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:text-white"
                  >
                    Score Fix
                  </Link>
                  <Link
                    to="/app/reverse-engineer"
                    className="rounded-xl border border-white/10 bg-charcoal-deep px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:text-white"
                  >
                    Reverse Engineer
                  </Link>
                  <Link
                    to="/pricing?source=analyze-result"
                    className="rounded-xl border border-white/10 bg-charcoal-deep px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:text-white"
                  >
                    Compare Tiers
                  </Link>
                </div>
              </div>

              {/* Row 3: top blockers + before/after proof (side by side on lg) */}
              <div className="grid gap-4 lg:grid-cols-2">
                {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/50">Top 3 blockers</p>
                    <ul className="mt-1 list-disc pl-5 text-xs text-white/75 space-y-0.5">
                      {result.recommendations.slice(0, 3).map((r, index) => (
                        <li key={`${r.id || r.title}-${index}`}>{r.title}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-cyan-200">Before / After proof mode</div>

                  {!demoBaseline && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-cyan-100/80">Set this audit as your baseline, apply a fix, then rerun the same URL to show measurable lift.</p>
                      <button
                        type="button"
                        onClick={saveCurrentAsDemoBaseline}
                        className="rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20 transition-colors"
                      >
                        Save as baseline (Before)
                      </button>
                    </div>
                  )}

                  {demoBaseline && !baselineDelta && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-cyan-100/80">Baseline exists for <span className="font-semibold">{demoBaseline.url}</span>. Re-audit that same target to unlock delta proof.</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveCurrentAsDemoBaseline}
                          className="rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20 transition-colors"
                        >
                          Replace baseline
                        </button>
                        <button
                          type="button"
                          onClick={clearDemoBaseline}
                          className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/15 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {baselineDelta && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                          <div className="text-white/60">Before</div>
                          <div className="text-lg font-bold text-white">{demoBaseline.visibility_score}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                          <div className="text-white/60">After</div>
                          <div className="text-lg font-bold text-white">{result.visibility_score}</div>
                        </div>
                      </div>

                      <div className={`text-xs font-semibold ${baselineDelta.scoreDelta >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                        Score delta: {baselineDelta.scoreDelta >= 0 ? "+" : ""}{baselineDelta.scoreDelta.toFixed(1)} points
                      </div>

                      {baselineDelta.categoryDeltas.length > 0 && (
                        <div className="space-y-1">
                          {baselineDelta.categoryDeltas.map((row) => (
                            <div key={row.label} className="flex items-center justify-between text-xs text-cyan-100/85">
                              <span className="truncate pr-3">{row.label}</span>
                              <span className={row.delta >= 0 ? "text-emerald-200" : "text-rose-200"}>
                                {row.delta >= 0 ? "+" : ""}{row.delta.toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={saveCurrentAsDemoBaseline}
                          className="rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20 transition-colors"
                        >
                          Promote current as new baseline
                        </button>
                        <button
                          type="button"
                          onClick={clearDemoBaseline}
                          className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/15 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {resultTextSummary && resultView === "summary" ? (
              <TextSummaryView
                summary={resultTextSummary}
                score={result.visibility_score}
                url={result.url}
                tier={((user?.tier as any) || "observer")}
                onSwitchTechnical={() => setResultView("technical")}
                onUpgrade={() => navigate("/pricing?source=analyze-summary")}
              />
            ) : (
              <ComprehensiveAnalysis result={result} tier={(user?.tier as any) || "observer"} />
            )}
          </section>
        )}

        {loading && !result && (
          <section className="mt-8 space-y-4" aria-live="polite" aria-busy={loading}>
            <div className="animate-pulse rounded-2xl border border-white/10 bg-charcoal/80 p-5 shadow-2xl sm:p-6">
              <div className="h-4 w-40 rounded bg-white/10" />
              <div className="mt-3 h-8 w-2/3 rounded bg-white/10" />
              <div className="mt-2 h-4 w-1/2 rounded bg-white/10" />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="h-16 rounded-2xl bg-white/10" />
                <div className="h-16 rounded-2xl bg-white/10" />
                <div className="h-16 rounded-2xl bg-white/10" />
              </div>
            </div>
            <div className="animate-pulse rounded-2xl border border-white/10 bg-charcoal/80 p-5 shadow-2xl sm:p-6">
              <div className="h-5 w-56 rounded bg-white/10" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="h-24 rounded-xl bg-white/10" />
                <div className="h-24 rounded-xl bg-white/10" />
                <div className="h-24 rounded-xl bg-white/10" />
                <div className="h-24 rounded-xl bg-white/10" />
              </div>
            </div>
          </section>
        )}

        {!result && !loading && (
          <PageQASection
            items={ANALYZE_FAQ}
            heading="Understanding AI visibility audits"
            className="mt-6"
          />
        )}
    </div>
  );
}

export default AnalyzePage;
