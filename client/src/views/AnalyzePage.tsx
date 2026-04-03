import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Loader2,
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
} from "lucide-react";
import {
  AiVisibilityIcon,
  AnswerDecompilerIcon,
  ScoreFixIcon,
  AuditEngineIcon,
} from "../components/icons";
import { useAuthStore } from "../stores/authStore";
import ComprehensiveAnalysis from "../components/ComprehensiveAnalysis";
import { API_URL } from "../config";
import type { AnalysisResponse } from "@shared/types";
import apiFetch from "../utils/api";
import { usePageMeta } from "../hooks/usePageMeta";
import { PLATFORM_NARRATIVE } from "../constants/platformNarrative";
import PlatformShiftBanner from "../components/PlatformShiftBanner";
import { normalizePublicUrlInput } from "../utils/targetKey";

const normalizeUrl = normalizePublicUrlInput;

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
  starting: "Analyzing how AI reads your site",
  initializing: "Checking structure",
  fetching: "Scanning pages",
  crawling: "Scanning pages",
  parsing: "Extracting meaning",
  scoring: "Checking trust signals",
  recommendations: "Building report",
  complete: "Complete",
  timeout: "Timed out",
};

function toProgressLabel(step: string): string {
  return PROGRESS_LABELS[step] || step.replace(/_/g, " ");
}

function getProgressTone(percent: number): "neutral" | "good" {
  return percent >= 100 ? "good" : "neutral";
}

function getProgressNarrative(percent: number): string {
  if (percent >= 68) return "Competitor advantage detected";
  if (percent >= 32) return "We found structural issues already";
  if (percent > 0) return "Collecting evidence of what AI can and cannot verify";
  return "Ready to run";
}

function getStageMicrocopy(step: string): string[] {
  const normalized = (step || "starting").toLowerCase();
  if (normalized.includes("crawl") || normalized.includes("fetch") || normalized.includes("dns")) {
    return ["Scanning pages", "Checking structure", "Finding extraction blockers"];
  }
  if (normalized.includes("parse") || normalized.includes("extract")) {
    return ["Extracting meaning", "Reading entities and headings", "Validating metadata"];
  }
  if (normalized.includes("score") || normalized.includes("trust")) {
    return ["Checking trust signals", "Calculating citation readiness", "Ranking blocker impact"];
  }
  if (normalized.includes("recommend") || normalized.includes("report")) {
    return ["Building report", "Prioritizing top fixes", "Preparing evidence view"];
  }
  if (normalized.includes("complete")) {
    return ["Audit complete", "Verdict ready", "Open report below"];
  }
  return ["Analyzing how AI reads your site", "Checking structure", "Comparing competitors"];
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState<string | null>(null);
  const [demoBaseline, setDemoBaseline] = useState<DemoBaselineSnapshot | null>(null);

  usePageMeta({
    title: "Analyze",
    description: "Run an AI visibility audit on any website. Get evidence-backed scoring and actionable recommendations.",
    path: "/analyze",
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressSourceRef = useRef<EventSource | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, isAuthenticated, refreshUser, logout } = useAuthStore();

  useEffect(() => {
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
  }, [isAuthenticated, token, refreshUser, logout, navigate]);

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

  useEffect(() => {
    if (!loading) return;
    const tick = window.setInterval(() => {
      setProgress((prev) => {
        if (prev.percent >= 92 || prev.step === "complete") return prev;
        const softIncrement = prev.percent < 30 ? 2 : 1;
        return { ...prev, percent: Math.min(92, prev.percent + softIncrement) };
      });
    }, 1400);
    return () => window.clearInterval(tick);
  }, [loading]);

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

    const qs = new URLSearchParams();
    if (token) qs.set("token", token);
    const sseUrl = `${API_URL}/api/audit/progress/${encodeURIComponent(requestId)}${qs.toString() ? `?${qs}` : ""}`;
    const es = new EventSource(sseUrl);
    progressSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as ProgressEventPayload;
        const nextStep = data.step || data.stage;
        const nextPercent = typeof data.percent === "number" ? data.percent : data.progress;
        if (typeof nextPercent === "number" && typeof nextStep === "string") {
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
    };
  }

  async function fetchWithRetry(requestUrl: string, options: RequestInit, retries = 2): Promise<Response> {
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

    const HARD_TIMEOUT_MS = 70_000;
    const timeoutId = window.setTimeout(() => {
      abortControllerRef.current?.abort();
    }, HARD_TIMEOUT_MS);

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress({ requestId: null, step: "starting", percent: 0 });

      const endpoint = `${API_URL}/api/analyze`;

      const response = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ url: normalizedUrl }),
        signal: abortSignal,
      });

      const requestId = response.headers.get("X-Audit-Request-Id");
      if (requestId) {
        setProgress({ requestId, step: "initializing", percent: 0 });
        openProgressStream(requestId);
      }

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
          throw new Error("Live scan limit reached for this billing cycle. You can still view cached results, or upgrade/add audit credits to run a fresh live audit.");
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

      window.setTimeout(() => {
        const reportElement = document.getElementById("analysis-report");
        if (reportElement) reportElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) handleAnalyze();
  };

  const canAnalyze = !!url.trim() && !validationError && !loading;
  const stageMicrocopy = useMemo(() => getStageMicrocopy(progress.step), [progress.step]);
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-white/10 bg-charcoal/80 p-6 shadow-2xl sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
              <AuditEngineIcon className="h-3.5 w-3.5" />
              AI Visibility Audit
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Analyze your site the way AI systems read it
            </h1>
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
                src="/structured.jpeg"
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
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {error && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-white/28 to-white/14 px-6 py-4 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Analyzing how AI reads your site…
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Start AI citation audit
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
                    className={`h-2 ${getProgressTone(progress.percent) === "good" ? "bg-gradient-to-r from-emerald-300/80 to-emerald-200/60" : "bg-gradient-to-r from-white/28 to-white/14"}`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-cyan-100/80">{getProgressNarrative(progress.percent)}</div>

                <div className="mt-4 rounded-xl border border-white/10 bg-charcoal p-4 text-xs leading-6 text-white/60">
                  {loading
                    ? "Checking structure • extracting signals • comparing competitors • building report."
                    : "No audits yet. Run your first audit and see what AI cannot verify, who is beating you, and what to fix first."}
                </div>

                {loading && (
                  <div className="mt-4 space-y-2">
                    {stageMicrocopy.map((line) => (
                      <div key={line} className="flex items-center gap-2 rounded-lg border border-white/10 bg-charcoal p-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
                        <span className="text-xs text-white/75">{line}</span>
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

              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                <div className="text-xs uppercase tracking-wide text-cyan-200">Battlefield demo flow</div>
                <div className="mt-2 text-sm leading-7 text-cyan-100/85">
                  Show the same site before and after one remediation change. Keep the URL fixed so the audience sees measurable machine-readability lift, not a different target.
                </div>
                <div className="mt-3 space-y-1 text-xs text-cyan-100/75">
                  <div>1) Run baseline audit on a real business site</div>
                  <div>2) Save baseline in proof mode</div>
                  <div>3) Apply one structural fix from evidence</div>
                  <div>4) Re-audit and present score/category deltas</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {result && (
          <section id="analysis-report" className="mt-8 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-charcoal/80 p-5 shadow-2xl sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Audit Complete
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Your site is readable. Not citable.</h2>
                  <p className="mt-2 text-sm leading-7 text-white/60">
                    AI can extract your content, but it does not trust it enough to use it in answers.
                  </p>
                  {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs uppercase tracking-wide text-white/50">Top 3 blockers</p>
                      <ul className="mt-1 list-disc pl-5 text-xs text-white/75 space-y-0.5">
                        {result.recommendations.slice(0, 3).map((r, index) => (
                          <li key={`${r.id || r.title}-${index}`}>{r.title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 lg:min-w-[320px]">
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

                <div className="grid gap-3 sm:grid-cols-3">
                  <Link
                    to="/app/score-fix"
                    className="rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
                  >
                    Score Fix
                  </Link>
                  <Link
                    to="/app/reverse-engineer"
                    className="rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
                  >
                    Reverse Engineer
                  </Link>
                  <Link
                    to="/pricing?source=analyze-result"
                    className="rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
                  >
                    Compare Tiers
                  </Link>
                </div>
              </div>
            </div>

            <ComprehensiveAnalysis result={result} />
          </section>
        )}

        {loading && !result && (
          <section className="mt-8 space-y-4" aria-live="polite" aria-busy="true">
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
    </div>
  );
}

export default AnalyzePage;
