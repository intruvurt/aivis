import React, { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Shield, Clock3, Search, Globe, Copy, Download,
  AlertTriangle, History, Trash2, BarChart3, ChevronDown, Zap, Lock, Eye, TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { usePageMeta } from "../hooks/usePageMeta";
import { checkServerHeaders } from "../api";
import type { ServerHeadersCheckResult } from "../../../shared/types";
import { useAnalysisStore } from "../stores/analysisStore";
import "../styles/animations.css";

/* ── History persistence ─────────────────────────────────────────── */

const HISTORY_KEY = "aivis-header-checks";
const MAX_HISTORY = 25;

interface CheckHistoryEntry {
  url: string;
  finalUrl: string;
  timestamp: number;
  score: number;
  grade: string;
  securityCount: number;
  riskLevel: string;
  responseTimeMs: number;
}

function loadHistory(): CheckHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: CheckHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

/* ── Color helpers ───────────────────────────────────────────────── */

function gradeColor(grade: string) {
  switch (grade) {
    case "A": return "text-emerald-300 bg-emerald-500/15 border-emerald-400/30";
    case "B": return "text-blue-300 bg-blue-500/15 border-blue-400/30";
    case "C": return "text-amber-300 bg-amber-500/15 border-amber-400/30";
    case "D": return "text-orange-300 bg-orange-500/15 border-orange-400/30";
    default: return "text-rose-300 bg-rose-500/15 border-rose-400/30";
  }
}

function gradeColorText(grade: string) {
  switch (grade) {
    case "A": return "text-emerald-300";
    case "B": return "text-blue-300";
    case "C": return "text-amber-300";
    case "D": return "text-orange-300";
    default: return "text-rose-300";
  }
}

function riskColor(risk: string) {
  const r = risk.toLowerCase();
  if (r === "low") return "text-emerald-300";
  if (r === "medium") return "text-amber-300";
  if (r === "high") return "text-rose-300";
  return "text-red-300";
}

function scoreBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

/* ── Constants ───────────────────────────────────────────────────── */

const SECURITY_LABELS: Record<string, string> = {
  hsts: "HSTS",
  csp: "CSP",
  xFrameOptions: "X-Frame-Options",
  xContentTypeOptions: "X-Content-Type-Options",
  referrerPolicy: "Referrer-Policy",
  permissionsPolicy: "Permissions-Policy",
  crossOriginOpenerPolicy: "COOP",
  crossOriginEmbedderPolicy: "COEP",
  crossOriginResourcePolicy: "CORP",
};

const FALLBACK_SAMPLES = [
  "https://aivis.biz",
  "https://github.com",
  "https://developer.mozilla.org",
];

export default function ServerHeadersPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("https://aivis.biz");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServerHeadersCheckResult | null>(null);
  const [checkHistory, setCheckHistory] = useState<CheckHistoryEntry[]>(loadHistory);
  const [showComparison, setShowComparison] = useState(false);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  const analysisHistory = useAnalysisStore((s) => s.history);

  const auditedDomains = useMemo(() => {
    const hosts = new Set<string>();
    analysisHistory.forEach((entry) => {
      try {
        const h = new URL(entry.url.startsWith("http") ? entry.url : `https://${entry.url}`).hostname;
        hosts.add(h);
      } catch { /* skip */ }
    });
    return Array.from(hosts);
  }, [analysisHistory]);

  const suggestedUrls = useMemo(() => {
    const auditUrls = auditedDomains.map((h) => `https://${h}`);
    const combined = [...auditUrls];
    for (const s of FALLBACK_SAMPLES) {
      try {
        if (!combined.some((u) => u.includes(new URL(s).hostname))) combined.push(s);
      } catch { combined.push(s); }
    }
    return combined.slice(0, 8);
  }, [auditedDomains]);

  usePageMeta({
    title: "Server Headers Check",
    description: "Inspect HTTP response headers for security policy, caching, and server behavior.",
    path: "/server-headers",
  });

  const securityCount = useMemo(() => {
    if (!result) return 0;
    return Object.values(result.security).filter(Boolean).length;
  }, [result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await checkServerHeaders({ url });
      const r = response.result;
      setResult(r);

      const oldEntry = checkHistory.find((h) => h.url === r.url);
      setPreviousScore(oldEntry ? oldEntry.score : null);

      const entry: CheckHistoryEntry = {
        url: r.url,
        finalUrl: r.finalUrl,
        timestamp: Date.now(),
        score: r.executive.overall_score,
        grade: r.executive.grade,
        securityCount: Object.values(r.security).filter(Boolean).length,
        riskLevel: r.executive.risk_level,
        responseTimeMs: r.responseTimeMs,
      };
      const updated = [entry, ...checkHistory.filter((h) => h.url !== r.url)].slice(0, MAX_HISTORY);
      setCheckHistory(updated);
      saveHistory(updated);

      toast.success("Headers loaded");
    } catch (err: any) {
      const message = err?.message || "Failed to check headers";
      setError(message);
      setResult(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const removeHistoryEntry = useCallback((entryUrl: string) => {
    setCheckHistory((prev) => {
      const updated = prev.filter((h) => h.url !== entryUrl);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    setCheckHistory([]);
    saveHistory([]);
    toast.success("History cleared");
  }, []);

  const copyExecutiveSummary = async () => {
    if (!result) return;
    const text = [
      `Server Headers Premium Audit`,
      `URL: ${result.url}`,
      `Final URL: ${result.finalUrl}`,
      `Overall Score: ${result.executive.overall_score} (${result.executive.grade})`,
      `Readiness: ${result.executive.readiness}`,
      `Risk: ${result.executive.risk_level}`,
      `XSS Risk: ${result.attack_surface.xss.risk} (${result.attack_surface.xss.score})`,
      `DDoS Risk: ${result.attack_surface.ddos.risk} (${result.attack_surface.ddos.score})`,
      `Top Actions:`,
      ...result.executive.top_actions.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n");

    await navigator.clipboard.writeText(text);
    toast.success("Executive summary copied");
  };

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `server-headers-audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
    toast.success("JSON export downloaded");
  };

  const exportImplementationPlan = () => {
    if (!result) return;
    const markdown = [
      `# Server Headers Implementation Plan`,
      ``,
      `## Target`,
      `- URL: ${result.url}`,
      `- Final URL: ${result.finalUrl}`,
      `- Status: ${result.statusCode}`,
      ``,
      `## Executive`,
      `- Overall Score: ${result.executive.overall_score} (${result.executive.grade})`,
      `- Readiness: ${result.executive.readiness}`,
      `- Risk: ${result.executive.risk_level}`,
      ``,
      `## Security Assessment`,
      `- XSS: ${result.attack_surface.xss.risk} (${result.attack_surface.xss.score})`,
      `- DDoS: ${result.attack_surface.ddos.risk} (${result.attack_surface.ddos.score})`,
      ``,
      `## Missing Headers`,
      ...result.remediation_artifacts.missing_headers.map((h) => `- ${h}`),
      ``,
      `## Checklist`,
      ...result.remediation_artifacts.checklist.map((item) => `- ${item}`),
      ``,
      `## NGINX Snippet`,
      "```nginx",
      result.remediation_artifacts.implementation_snippets.nginx,
      "```",
      ``,
      `## Express Snippet`,
      "```ts",
      result.remediation_artifacts.implementation_snippets.express,
      "```",
    ].join("\n");

    const blob = new Blob([markdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `server-headers-implementation-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
    toast.success("Implementation plan exported");
  };

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full card-charcoal hover:bg-charcoal/70 shadow-warm transition-colors self-start"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-white/80" /> Server Headers Check
            </h1>
            <p className="text-sm text-white/60">Check HTTP response headers, security policy, and cache behavior for any website.</p>
          </div>
        </div>

        <div className="surface-structured rounded-2xl p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm text-white/70 mb-2 block">Enter a website URL or domain</span>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="example.com or https://example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-5 py-3 rounded-xl bg-charcoal-light border border-white/10 text-white hover:bg-charcoal disabled:opacity-60"
                >
                  <Search className="w-4 h-4" />
                  {loading ? "Checking..." : "Check Headers"}
                </button>
              </div>
            </label>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestedUrls.map((sample) => {
              const isAudited = auditedDomains.some((d) => sample.includes(d));
              return (
                <button key={sample} type="button" onClick={() => setUrl(sample)} className={`px-3 py-1.5 rounded-full text-xs border ${isAudited ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "bg-charcoal-light border-white/10 text-white/75"} hover:text-white`}>
                  {isAudited && <span className="mr-1">★</span>}{sample.replace("https://", "")}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-sm text-white/65">
            This checker returns response headers such as security policy, cache lifetime, content type, server hints, and robots directives.
          </p>
        </div>

        {!result && checkHistory.length === 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white/80 mb-4">What this tool analyzes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ValueCard icon={<Lock className="w-5 h-5 text-emerald-300" />} title="Security Headers" desc="9-point security policy audit covering HSTS, CSP, X-Frame-Options, COOP, COEP, CORP, and more." />
              <ValueCard icon={<Zap className="w-5 h-5 text-amber-300" />} title="Attack Surface" desc="XSS and DDoS risk scoring with specific vulnerability reasons and mitigation guidance." />
              <ValueCard icon={<Eye className="w-5 h-5 text-blue-300" />} title="Rich Results & AI" desc="Structured data signals, JSON-LD detection, and search-engine readiness scoring." />
              <ValueCard icon={<Download className="w-5 h-5 text-purple-300" />} title="Fix Plans" desc="Ready-to-deploy NGINX and Express code snippets for every missing security header." />
            </div>
          </div>
        )}

        {checkHistory.length > 0 && !result && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-white/60" /> Recent Checks
              </h2>
              <button onClick={clearAllHistory} className="text-xs text-white/50 hover:text-white/80 transition-colors flex items-center gap-1" type="button">
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {checkHistory.map((entry) => (
                <HistoryCard key={entry.url} entry={entry} onSelect={() => setUrl(entry.url)} onRemove={() => removeHistoryEntry(entry.url)} />
              ))}
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100 mb-6">{error}</div>
        ) : null}

        {result && checkHistory.length > 0 && (
          <div className="mb-6 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-white/50 mr-1">Recent:</span>
              {checkHistory.slice(0, 6).map((entry) => (
                <button key={entry.url} type="button" onClick={() => setUrl(entry.url)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${entry.url === result.url ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-charcoal-light/50 text-white/60 hover:text-white"}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${entry.grade === "A" ? "bg-emerald-400" : entry.grade === "B" ? "bg-blue-400" : entry.grade === "C" ? "bg-amber-400" : "bg-rose-400"}`} />
                  {entry.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </button>
              ))}
            </div>
            {checkHistory.length >= 2 && (
              <button onClick={() => setShowComparison(!showComparison)} type="button"
                className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-charcoal-light border border-white/10 hover:bg-charcoal text-sm transition-colors">
                <BarChart3 className="w-4 h-4" />
                {showComparison ? "Hide Comparison" : "Compare Recent Checks"}
                <ChevronDown className={`w-4 h-4 transition-transform ${showComparison ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
        )}

        {showComparison && checkHistory.length >= 2 && (
          <div className="surface-structured rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-white/60" /> Cross-Domain Comparison
            </h2>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-charcoal-light/60 text-left text-white/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Domain</th>
                    <th className="px-4 py-3 font-medium text-center">Grade</th>
                    <th className="px-4 py-3 font-medium text-center">Score</th>
                    <th className="px-4 py-3 font-medium text-center">Security</th>
                    <th className="px-4 py-3 font-medium text-center">Risk</th>
                    <th className="px-4 py-3 font-medium text-center">Response</th>
                    <th className="px-4 py-3 font-medium">Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {checkHistory.map((entry) => (
                    <tr key={entry.url} className="border-t border-white/10 align-middle">
                      <td className="px-4 py-3 text-white/85 font-medium whitespace-nowrap">{entry.url.replace(/^https?:\/\//, "")}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${gradeColor(entry.grade)}`}>{entry.grade}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full ${scoreBarColor(entry.score)}`} style={{ width: `${entry.score}%` }} />
                          </div>
                          <span className="text-xs text-white/70">{entry.score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-white/80">{entry.securityCount}/9</td>
                      <td className="px-4 py-3 text-center"><span className={riskColor(entry.riskLevel)}>{entry.riskLevel}</span></td>
                      <td className="px-4 py-3 text-center text-white/70">{entry.responseTimeMs}ms</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{new Date(entry.timestamp).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="surface-structured rounded-2xl p-5 col-span-2 md:col-span-1 flex flex-col items-center justify-center">
                <span className={`text-4xl font-black px-4 py-2 rounded-xl border-2 ${gradeColor(result.executive.grade)}`}>
                  {result.executive.grade}
                </span>
                <span className="text-xs text-white/50 mt-2">Overall Grade</span>
                <div className="mt-2 w-full">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${scoreBarColor(result.executive.overall_score)}`} style={{ width: `${result.executive.overall_score}%` }} />
                  </div>
                  <span className="text-xs text-white/60 mt-1 block text-center">{result.executive.overall_score}/100</span>
                </div>
              </div>
              <StatCard icon={<Shield className="w-5 h-5 text-emerald-300" />} label="Security headers" value={`${securityCount}/9`} accent={securityCount >= 7 ? "emerald" : securityCount >= 4 ? "amber" : "rose"} />
              <StatCard icon={<Clock3 className="w-5 h-5 text-blue-300" />} label="Response time" value={`${result.responseTimeMs} ms`} accent={result.responseTimeMs < 500 ? "emerald" : result.responseTimeMs < 1500 ? "amber" : "rose"} />
              <StatCard icon={<AlertTriangle className="w-5 h-5 text-amber-300" />} label="XSS Risk" value={result.attack_surface.xss.risk} accent={result.attack_surface.xss.risk.toLowerCase() === "low" ? "emerald" : result.attack_surface.xss.risk.toLowerCase() === "medium" ? "amber" : "rose"} />
              <StatCard icon={<AlertTriangle className="w-5 h-5 text-rose-300" />} label="DDoS Risk" value={result.attack_surface.ddos.risk} accent={result.attack_surface.ddos.risk.toLowerCase() === "low" ? "emerald" : result.attack_surface.ddos.risk.toLowerCase() === "medium" ? "amber" : "rose"} />
            </div>

            {previousScore !== null && (() => {
              const diff = result.executive.overall_score - previousScore;
              if (diff === 0) return null;
              return (
                <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${diff > 0 ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200" : "border-rose-400/25 bg-rose-500/10 text-rose-200"}`}>
                  <TrendingUp className={`w-4 h-4 ${diff < 0 ? "rotate-180" : ""}`} />
                  Score {diff > 0 ? "improved" : "declined"} by {Math.abs(diff)} points since last check
                </div>
              );
            })()}

            <div className="surface-structured rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold">Executive enrichment</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
                  <button onClick={copyExecutiveSummary} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-charcoal-light border border-white/10 hover:bg-charcoal text-sm" type="button">
                    <Copy className="w-4 h-4" /> Copy Summary
                  </button>
                  <button onClick={exportJson} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-charcoal-light border border-white/10 hover:bg-charcoal text-sm" type="button">
                    <Download className="w-4 h-4" /> Export JSON
                  </button>
                  <button onClick={exportImplementationPlan} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-charcoal-light border border-white/10 hover:bg-charcoal text-sm" type="button">
                    <Download className="w-4 h-4" /> Export Plan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <MetaRow label="Overall Score" value={`${result.executive.overall_score} (${result.executive.grade})`} valueClass={gradeColorText(result.executive.grade)} />
                <MetaRow label="Readiness" value={result.executive.readiness} />
                <MetaRow label="XSS Risk" value={`${result.attack_surface.xss.risk} (${result.attack_surface.xss.score})`} valueClass={riskColor(result.attack_surface.xss.risk)} />
                <MetaRow label="DDoS Risk" value={`${result.attack_surface.ddos.risk} (${result.attack_surface.ddos.score})`} valueClass={riskColor(result.attack_surface.ddos.risk)} />
              </div>

              <p className="text-sm text-white/75 mt-4">{result.executive.executive_brief}</p>
            </div>

            <div className="surface-structured-muted rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-3">Request summary</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <MetaRow label="Requested URL" value={result.url} />
                <MetaRow label="Final URL" value={result.finalUrl} />
                <MetaRow label="Server" value={result.server.server || "Hidden / not sent"} />
                <MetaRow label="Powered by" value={result.server.poweredBy || "Not sent"} />
                <MetaRow label="Content-Type" value={result.server.contentType || "Not sent"} />
                <MetaRow label="Content-Encoding" value={result.server.contentEncoding || "Not sent"} />
              </dl>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="surface-structured rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4">Security policy</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(SECURITY_LABELS).map(([key, label]) => (
                    <div key={key} className="rounded-xl border border-white/10 bg-charcoal-light/45 px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-sm text-white/85">{label}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${result.security[key] ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-rose-400/20 bg-rose-500/10 text-rose-300"}`}>
                        {result.security[key] ? "Present" : "Missing"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-structured rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4">Caching details</h2>
                <dl className="space-y-3 text-sm">
                  <MetaRow label="Cache-Control" value={result.caching.cacheControl || "Not sent"} />
                  <MetaRow label="Expires" value={result.caching.expires || "Not sent"} />
                  <MetaRow label="ETag" value={result.caching.etag || "Not sent"} />
                  <MetaRow label="Age" value={result.caching.age || "Not sent"} />
                  <MetaRow label="Max-Age" value={result.caching.maxAgeSeconds === null ? "Not parsed" : `${result.caching.maxAgeSeconds} seconds`} />
                </dl>
              </div>
            </div>

            <div className="surface-structured rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Key observations</h2>
              {result.insights.length ? (
                <ul className="space-y-2 text-sm text-white/80">
                  {result.insights.map((insight) => (
                    <li key={insight} className="rounded-xl border border-white/10 bg-charcoal-light/35 px-4 py-3">{insight}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-white/70">No obvious issues detected from the returned headers.</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="surface-structured rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-white/80" /> Rich Results Readiness
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <MetaRow label="Eligibility" value={result.rich_results.eligibility} />
                  <MetaRow label="Score" value={String(result.rich_results.score)} />
                  <MetaRow label="JSON-LD" value={String(result.rich_results.signals.json_ld_count)} />
                  <MetaRow label="H1 count" value={String(result.rich_results.signals.h1_count)} />
                </div>
                <ul className="space-y-2 text-sm text-white/80">
                  {result.rich_results.recommendations.length ? result.rich_results.recommendations.map((item) => (
                    <li key={item} className="rounded-xl border border-white/10 bg-charcoal-light/35 px-4 py-3">{item}</li>
                  )) : <li className="rounded-xl border border-white/10 bg-charcoal-light/35 px-4 py-3">Rich result signals look stable.</li>}
                </ul>
              </div>

              <div className="surface-structured rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4">Evidence-based remediation</h2>
                <p className="text-sm text-white/70 mb-3">Missing headers</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {result.remediation_artifacts.missing_headers.length ? result.remediation_artifacts.missing_headers.map((header) => (
                    <span key={header} className="px-3 py-1.5 rounded-full text-xs border border-rose-400/20 bg-rose-500/10 text-rose-200">{header}</span>
                  )) : <span className="text-sm text-emerald-300/80">No critical missing security headers detected.</span>}
                </div>
                <ul className="space-y-2 text-sm text-white/80">
                  {result.remediation_artifacts.checklist.map((item) => (
                    <li key={item} className="rounded-xl border border-white/10 bg-charcoal-light/35 px-4 py-3">{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="surface-structured rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Raw response headers</h2>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-charcoal-light/60 text-left text-white/70">
                    <tr>
                      <th className="px-4 py-3 font-medium">Header</th>
                      <th className="px-4 py-3 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.headers).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                      <tr key={key} className="border-t border-white/10 align-top">
                        <td className="px-4 py-3 text-white/85 font-medium whitespace-nowrap">{key}</td>
                        <td className="px-4 py-3 text-white/70 break-all">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "emerald" | "amber" | "rose" | "blue" }) {
  const accentBorder = accent === "emerald" ? "border-l-emerald-500/50" : accent === "rose" ? "border-l-rose-500/50" : accent === "amber" ? "border-l-amber-500/50" : accent === "blue" ? "border-l-blue-500/50" : "";
  return (
    <div className={`surface-structured rounded-2xl p-5 ${accentBorder ? `border-l-2 ${accentBorder}` : ""}`}>
      <div className="flex items-center gap-3 mb-3">{icon}<span className="text-sm text-white/65">{label}</span></div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MetaRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal-light/35 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-white/50 mb-1">{label}</dt>
      <dd className={`break-all ${valueClass || "text-white/80"}`}>{value}</dd>
    </div>
  );
}

function ValueCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="surface-structured rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">{icon}<span className="font-semibold text-white/90">{title}</span></div>
      <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
    </div>
  );
}

function HistoryCard({ entry, onSelect, onRemove }: { entry: CheckHistoryEntry; onSelect: () => void; onRemove: () => void }) {
  return (
    <div className="surface-structured rounded-2xl p-5 cursor-pointer hover:bg-white/[0.03] transition-colors group" onClick={onSelect}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-lg font-bold px-2 py-0.5 rounded-lg border ${gradeColor(entry.grade)}`}>{entry.grade}</span>
          <span className="text-sm text-white/80 truncate">{entry.url.replace(/^https?:\/\//, "")}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-all" type="button">
          <Trash2 className="w-3.5 h-3.5 text-white/40" />
        </button>
      </div>
      <div className="flex items-center gap-4 text-xs text-white/50">
        <span>Score: {entry.score}</span>
        <span>Security: {entry.securityCount}/9</span>
        <span className={riskColor(entry.riskLevel)}>{entry.riskLevel} risk</span>
      </div>
      <div className="mt-2 w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${scoreBarColor(entry.score)}`} style={{ width: `${entry.score}%` }} />
      </div>
      <span className="text-[11px] text-white/35 mt-2 block">{new Date(entry.timestamp).toLocaleString()}</span>
    </div>
  );
}
