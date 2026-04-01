// client/src/components/BixThoughtBubble.tsx
// "Bix" — first-time user guide that runs a real audit and explains the result.
// Shows a subtle thought-bubble popup for new users, then walks them through
// a real /api/analyze call with a plain-text summary of the results.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, ArrowRight, Globe, Loader2, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import { API_URL } from "../config";
import apiFetch from "../utils/api";

// ─── Persistence ──────────────────────────────────────────────────────────────
const BIX_DISMISSED_KEY = "aivis_bix_dismissed_v1";
const BIX_COMPLETED_KEY = "aivis_bix_completed_v1";

function isBixDismissed(): boolean {
  return localStorage.getItem(BIX_DISMISSED_KEY) === "true";
}
function markBixDismissed() {
  localStorage.setItem(BIX_DISMISSED_KEY, "true");
}
function isBixCompleted(): boolean {
  return localStorage.getItem(BIX_COMPLETED_KEY) === "true";
}
function markBixCompleted() {
  localStorage.setItem(BIX_COMPLETED_KEY, "true");
}

// ─── Audit summarizer ─────────────────────────────────────────────────────────
function summarizeAudit(r: any): string {
  if (!r) return "Something went wrong — I couldn't read the audit results.";

  const score = r.visibility_score ?? r.score;
  const lines: string[] = [];

  // Score headline
  if (typeof score === "number") {
    const verdict =
      score >= 80 ? "That's strong" : score >= 60 ? "Solid foundation, but room to grow" : score >= 40 ? "There's meaningful work to do" : "This needs attention";
    lines.push(`Your AI Visibility Score is ${score}/100. ${verdict}.`);
  }

  // Summary
  if (r.summary) {
    lines.push("");
    lines.push(r.summary);
  }

  // Key takeaways
  if (Array.isArray(r.key_takeaways) && r.key_takeaways.length) {
    lines.push("");
    lines.push("Key takeaways:");
    r.key_takeaways.slice(0, 4).forEach((t: string, i: number) => {
      lines.push(`  ${i + 1}. ${t}`);
    });
  }

  // Technical signals snapshot
  const ts = r.technical_signals;
  if (ts) {
    const bits: string[] = [];
    if (typeof ts.https_enabled === "boolean") bits.push(ts.https_enabled ? "HTTPS is active" : "No HTTPS detected");
    if (typeof ts.response_time_ms === "number") bits.push(`page loaded in ${ts.response_time_ms}ms`);
    if (bits.length) {
      lines.push("");
      lines.push(`Technical snapshot: ${bits.join(", ")}.`);
    }
  }

  // Schema markup
  const sm = r.schema_markup;
  if (sm) {
    if (sm.json_ld_count > 0) {
      lines.push(`Found ${sm.json_ld_count} JSON-LD schema block${sm.json_ld_count > 1 ? "s" : ""} — that helps AI models understand your content.`);
    } else {
      lines.push("No JSON-LD schema markup detected. Adding structured data would help AI models parse your site.");
    }
  }

  // Content analysis
  const ca = r.content_analysis;
  if (ca?.word_count) {
    lines.push(`Content length: ~${ca.word_count.toLocaleString()} words.`);
  }

  // Top recommendations
  const recs = r.recommendations;
  if (Array.isArray(recs) && recs.length) {
    lines.push("");
    lines.push(`Top recommendations (${recs.length} total):`);
    recs.slice(0, 5).forEach((rec: any, i: number) => {
      const title = typeof rec === "string" ? rec : rec.title || rec.recommendation || rec.text;
      if (title) lines.push(`  ${i + 1}. ${title}`);
    });
    if (recs.length > 5) {
      lines.push(`  … and ${recs.length - 5} more.`);
    }
  }

  // AI platform scores
  const aps = r.ai_platform_scores;
  if (aps && typeof aps === "object") {
    const platformLines: string[] = [];
    for (const [platform, val] of Object.entries(aps)) {
      const s = typeof val === "number" ? val : (val as any)?.score;
      if (typeof s === "number") platformLines.push(`${platform}: ${s}/100`);
    }
    if (platformLines.length) {
      lines.push("");
      lines.push("AI platform-specific scores:");
      platformLines.forEach((l) => lines.push(`  • ${l}`));
    }
  }

  lines.push("");
  lines.push("This is a real audit — not a guess. You can explore the full breakdown in your dashboard.");

  return lines.join("\n");
}

// ─── Component ────────────────────────────────────────────────────────────────
type BixStage = "bubble" | "input" | "running" | "result";

export default function BixThoughtBubble() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { result: existingResult, setResult } = useAnalysisStore();

  const [stage, setStage] = useState<BixStage>("bubble");
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [auditSummary, setAuditSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const urlInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill URL from user's website field
  useEffect(() => {
    if (user?.website && !url) {
      setUrl(user.website.replace(/^https?:\/\//, ""));
    }
  }, [user?.website]);

  // Show the bubble after a delay — only for authenticated users who haven't
  // dismissed and who haven't already run an audit.
  useEffect(() => {
    if (!isAuthenticated) { setVisible(false); return; }
    if (isBixDismissed() || isBixCompleted()) { setVisible(false); return; }
    // Don't show if user already has a result
    if (existingResult) { setVisible(false); return; }

    // Only show on pages where it makes sense
    const showPages = ["/", "/analyze", "/guide", "/help"];
    if (!showPages.includes(pathname)) { setVisible(false); return; }

    // Appear after 4 seconds with a gentle delay
    const timer = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, pathname, existingResult]);

  const handleDismiss = () => {
    setVisible(false);
    setStage("bubble");
    markBixDismissed();
  };

  const handleStart = () => {
    setStage("input");
    setTimeout(() => urlInputRef.current?.focus(), 200);
  };

  const handleRunAudit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    // Basic URL validation
    let targetUrl = trimmed;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    setStage("running");
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!res.ok) {
        const body = await res.text();
        let msg = "Audit failed";
        try {
          const parsed = JSON.parse(body);
          msg = parsed.error || parsed.message || msg;
        } catch {
          if (body) msg = body;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      setAuditResult(data);
      setAuditSummary(summarizeAudit(data));
      setStage("result");

      // Store in the analysis store so dashboard picks it up
      if (data && typeof data.visibility_score === "number") {
        setResult(data);
      }

      markBixCompleted();
    } catch (err: any) {
      setError(err?.message || "Something went wrong running the audit.");
      setStage("input");
    } finally {
      setLoading(false);
    }
  }, [url, setResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) handleRunAudit();
  };

  const handleGoToDashboard = () => {
    // Close Bix and mark completed so it doesn't reappear
    setVisible(false);
    setStage("bubble");
    markBixCompleted();

    if (pathname === "/") {
      // Already on dashboard — just scroll to top to reveal the results
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  // Don't render at all if not visible and not in a flow
  if (!visible && stage === "bubble") return null;

  return (
    <AnimatePresence>
      {/* ── Thought Bubble (initial popup) ── */}
      {stage === "bubble" && visible && (
        <motion.div
          key="bix-bubble"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="fixed bottom-6 left-6 z-50 max-w-xs sm:max-w-sm"
        >
          {/* Thought bubble tail */}
          <div className="absolute -bottom-2 left-8 flex flex-col items-start gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-[#161b22] border border-white/10" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#161b22] border border-white/10 -ml-1" />
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-[#161b22] p-4 shadow-xl shadow-black/30">
            {/* Close button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-2 right-2 rounded-full p-1 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3 pr-5">
              <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/15 border border-cyan-400/20">
                <Bot className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300/80 mb-1">
                  Bix — your guide
                </div>
                <p className="text-sm leading-relaxed text-white/75">
                  First time here? Not sure where to start?{" "}
                  <span className="text-white/90 font-medium">I'll run your first audit for free and explain exactly what the results mean.</span>
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/15 border border-cyan-400/25 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/25 transition-colors"
                >
                  Let's go <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Guided Audit Panel ── */}
      {(stage === "input" || stage === "running" || stage === "result") && (
        <motion.div
          key="bix-panel"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="fixed bottom-6 left-6 z-50 w-[calc(100vw-3rem)] max-w-md"
        >
          <div className="rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/15 border border-cyan-400/20">
                  <Bot className="h-3.5 w-3.5 text-cyan-300" />
                </div>
                <span className="text-sm font-semibold text-white/90">Bix</span>
                <span className="rounded-full bg-emerald-400/15 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  Guided Audit
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-md p-1.5 text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {/* ── URL Input Stage ── */}
              {stage === "input" && (
                <>
                  <p className="text-sm text-white/65 leading-relaxed">
                    Give me a URL and I'll run a real AI visibility audit. I'll break down what the results mean in plain English.
                  </p>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                      <input
                        ref={urlInputRef}
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="yoursite.com"
                        autoComplete="url"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white/90 placeholder-white/35 focus:border-cyan-400/30 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRunAudit}
                      disabled={!url.trim() || loading}
                      className="shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-400/25 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Audit
                    </button>
                  </div>

                  {error && (
                    <p className="text-xs text-red-300/90 leading-relaxed">{error}</p>
                  )}
                </>
              )}

              {/* ── Running Stage ── */}
              {stage === "running" && (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-300/70" />
                  <p className="text-sm text-white/55">Auditing your site…</p>
                  <p className="text-[11px] text-white/35">This usually takes 15—30 seconds</p>
                </div>
              )}

              {/* ── Result Stage ── */}
              {stage === "result" && auditSummary && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 border border-emerald-400/20">
                        <span className="text-sm font-bold text-emerald-300">
                          {auditResult?.visibility_score ?? "—"}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-white/50">Visibility Score</div>
                        <div className="text-xs text-white/35 truncate max-w-[200px]">{url}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => !p)}
                      className="rounded-md p-1 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        key="bix-result-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <pre className="whitespace-pre-wrap text-xs leading-5 text-white/70 font-sans">
                            {auditSummary}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleGoToDashboard}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/25 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View full dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStage("input");
                        setError(null);
                        setUrl("");
                        setAuditResult(null);
                        setAuditSummary("");
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Audit another site
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
