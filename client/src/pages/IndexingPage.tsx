import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Globe, Search, Send, ExternalLink, Clock, CheckCircle2,
  AlertTriangle, Copy, ChevronDown, ChevronUp, Info, History, Zap, Loader2,
  Upload, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { usePageMeta } from "../hooks/usePageMeta";
import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import apiFetch from "../utils/api";
import { normalizePublicUrlInput } from "../utils/targetKey";
import { API_URL } from "../config";

/* ── Types ─────────────────────────────────────────────────────────── */

interface CheckResult {
  url: string;
  hostname: string;
  checkLinks: {
    google: string;
    bing: string;
    googleCache: string;
    bingUrl: string;
  };
  indexNowAvailable: boolean;
  lastAudit: { id: string; date: string; score: number } | null;
}

interface SubmitResult {
  success: boolean;
  submitted: number;
  skipped: number;
  error?: string;
  urls: string[];
}

interface SubmissionHistoryEntry {
  id: string;
  urls: string[];
  submittedCount: number;
  skippedCount: number;
  error: string | null;
  createdAt: string;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function IndexingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { history: analysisHistory } = useAnalysisStore();

  usePageMeta({
    title: "URL Indexing & IndexNow | AiVIS",
    description: "Check Google and Bing indexing status and submit URLs via IndexNow for faster crawl discovery.",
    path: "/indexing",
  });

  const [url, setUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [history, setHistory] = useState<SubmissionHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ configured: boolean; keyHint: string | null } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split(/[\n\r,]+/).map(s => s.trim()).filter(s => s.startsWith('http'));
      if (lines.length === 0) {
        toast.error('No valid URLs found in file');
        return;
      }
      setBulkUrls(lines.slice(0, 100).join('\n'));
      setShowBulk(true);
      toast.success(`Loaded ${Math.min(lines.length, 100)} URL(s) from file`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // Suggestions from previous audits
  const suggestions = React.useMemo(() => {
    const urls = new Set<string>();
    for (const h of analysisHistory || []) {
      const target = (h as any)?.url || (h as any)?.target;
      if (target) {
        try {
          urls.add(new URL(target.startsWith("http") ? target : `https://${target}`).href);
        } catch { /* skip */ }
      }
    }
    return Array.from(urls).slice(0, 10);
  }, [analysisHistory]);

  // Fetch setup status + history on mount
  useEffect(() => {
    (async () => {
      try {
        const [statusRes, historyRes] = await Promise.all([
          apiFetch(`${API_URL}/api/indexing/setup-status`),
          apiFetch(`${API_URL}/api/indexing/history`),
        ]);
        if (statusRes.ok) setSetupStatus(await statusRes.json());
        if (historyRes.ok) {
          const d = await historyRes.json();
          setHistory(d.submissions || []);
        }
      } catch { /* non-fatal */ }
    })();
  }, []);

  /* ── Check indexing ──────────────────────────────────────────────── */
  const handleCheck = useCallback(async () => {
    const normalized = normalizePublicUrlInput(url.trim());
    if (!normalized) return;
    setChecking(true);
    setCheckResult(null);
    setSubmitResult(null);
    try {
      const res = await apiFetch(`${API_URL}/api/indexing/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Check failed" }));
        toast.error(err.error || "Check failed");
        return;
      }
      setCheckResult(await res.json());
    } catch {
      toast.error("Network error");
    } finally {
      setChecking(false);
    }
  }, [url]);

  /* ── Submit to IndexNow ─────────────────────────────────────────── */
  const handleSubmit = useCallback(async (urlsToSubmit: string[]) => {
    if (!urlsToSubmit.length) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await apiFetch(`${API_URL}/api/indexing/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: urlsToSubmit }),
      });
      const data = await res.json();
      setSubmitResult(data);
      if (data.success) {
        toast.success(`Submitted ${data.submitted} URL(s) to IndexNow`);
        // Refresh history
        const historyRes = await apiFetch(`${API_URL}/api/indexing/history`);
        if (historyRes.ok) {
          const d = await historyRes.json();
          setHistory(d.submissions || []);
        }
      } else {
        const errMsg = data.error || "Submission failed";
        if (errMsg.includes("INDEXNOW_KEY")) {
          toast.error("IndexNow key not configured on server. Contact admin.");
        } else if (errMsg.includes("HTTP 403") || errMsg.includes("422")) {
          toast.error("IndexNow verification failed — the key file may not be deployed yet. Redeploy the site and retry.");
        } else if (errMsg.includes("No submitted URLs match")) {
          toast.error(errMsg);
        } else {
          toast.error(errMsg);
        }
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleBulkSubmit = useCallback(() => {
    const lines = bulkUrls
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast.error("Enter at least one URL");
      return;
    }
    if (lines.length > 100) {
      toast.error("Maximum 100 URLs per submission");
      return;
    }
    handleSubmit(lines);
  }, [bulkUrls, handleSubmit]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  }, []);

  /* ── Render ──────────────────────────────────────────────────────── */

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const totalSubmitted = history.reduce((sum, h) => sum + h.submittedCount, 0);

  return (
    <div className="min-h-screen text-white px-4 py-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5 transition">
          <ArrowLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-cyan-400" />
            URL Indexing & IndexNow
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Check Google/Bing indexing status and submit URLs for faster crawl discovery
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
          <div className="text-2xl font-bold text-white tabular-nums">{history.length}</div>
          <div className="text-[11px] text-white/40 mt-0.5">Submissions</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
          <div className="text-2xl font-bold text-cyan-300 tabular-nums">{totalSubmitted}</div>
          <div className="text-[11px] text-white/40 mt-0.5">URLs Submitted</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-300 tabular-nums">
            {totalSubmitted > 0 ? `${Math.round((totalSubmitted / (totalSubmitted + history.reduce((s, h) => s + h.skippedCount, 0))) * 100)}%` : '—'}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">Success Rate</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-300 tabular-nums">{suggestions.length}</div>
          <div className="text-[11px] text-white/40 mt-0.5">From Audits</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111827]/90 p-4 text-center">
          {setupStatus?.configured ? (
            <>
              <div className="text-lg font-bold text-emerald-300 flex items-center justify-center gap-1"><CheckCircle2 className="h-4 w-4" />Active</div>
              <div className="text-[11px] text-white/40 mt-0.5">IndexNow Setup</div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-amber-300 flex items-center justify-center gap-1"><AlertTriangle className="h-4 w-4" />Inactive</div>
              <div className="text-[11px] text-white/40 mt-0.5">IndexNow Setup</div>
            </>
          )}
        </div>
      </div>

      {/* ── URL Check Section ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-cyan-500/15 bg-[#0a0e1c]/75 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-cyan-400" />
          Check Indexing Status
        </h2>
        <div className="flex gap-3">
          <div className="relative flex-1" ref={inputWrapperRef}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => suggestions.length > 0 && !url && setShowSuggestions(true)}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              enterKeyHint="go"
              placeholder="https://example.com/page"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 placeholder:text-white/30"
            />
            {showSuggestions && suggestions.length > 0 && !url && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 rounded-xl overflow-hidden border border-white/10 bg-[#0a0e1c]/95 backdrop-blur-sm shadow-xl">
                <p className="text-xs text-white/40 px-3 pt-2 pb-1">From your audits</p>
                {suggestions.slice(0, 5).map((s) => (
                  <button key={s} onClick={() => { setUrl(s); setShowSuggestions(false); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-white/70 truncate">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleCheck}
            disabled={checking || !url.trim()}
            className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-sm font-semibold transition flex items-center gap-2"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Check
          </button>
        </div>

        {/* Check Results */}
        {checkResult && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-white/60">Checking:</span>
              <code className="text-sm text-cyan-300 bg-white/5 px-2 py-1 rounded">{checkResult.url}</code>
              <button onClick={() => copyToClipboard(checkResult.url)} className="p-1 hover:bg-white/10 rounded">
                <Copy className="w-3.5 h-3.5 text-white/40" />
              </button>
            </div>

            {/* Search Engine Check Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={checkResult.checkLinks.google}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3 hover:bg-white/5 transition"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-lg">G</div>
                <div>
                  <p className="text-sm font-medium text-white">Google site: Check</p>
                  <p className="text-xs text-white/40">See if Google has indexed this URL</p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/30 ml-auto" />
              </a>

              <a
                href={checkResult.checkLinks.bing}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3 hover:bg-white/5 transition"
              >
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-lg">B</div>
                <div>
                  <p className="text-sm font-medium text-white">Bing site: Check</p>
                  <p className="text-xs text-white/40">See if Bing has indexed this URL</p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/30 ml-auto" />
              </a>

              <a
                href={checkResult.checkLinks.googleCache}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3 hover:bg-white/5 transition"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">📋</div>
                <div>
                  <p className="text-sm font-medium text-white">Google Cache</p>
                  <p className="text-xs text-white/40">View Google's cached version</p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/30 ml-auto" />
              </a>

              <a
                href={checkResult.checkLinks.bingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3 hover:bg-white/5 transition"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">🔍</div>
                <div>
                  <p className="text-sm font-medium text-white">Bing Webmaster</p>
                  <p className="text-xs text-white/40">URL inspection in Bing Webmaster Tools</p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/30 ml-auto" />
              </a>
            </div>

            {/* Last Audit */}
            {checkResult.lastAudit && (
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] p-3 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-white/70">
                  Last audited: <strong className="text-emerald-300">Score {checkResult.lastAudit.score}</strong>
                  {" "}on {new Date(checkResult.lastAudit.date).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Submit to IndexNow */}
            {checkResult.indexNowAvailable && (
              <button
                onClick={() => handleSubmit([checkResult.url])}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-sm font-semibold transition"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Submitting…" : "Submit to IndexNow"}
              </button>
            )}

            {submitResult && (
              <div className={`rounded-xl p-3 flex items-center gap-3 border ${
                submitResult.success
                  ? "border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-300"
                  : "border-rose-500/15 bg-rose-500/[0.06] text-rose-300"
              }`}>
                {submitResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span className="text-sm">
                  {submitResult.success
                    ? `Submitted ${submitResult.submitted} URL(s) to IndexNow`
                    : submitResult.error || "Submission failed"}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Bulk IndexNow Submit ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-orange-500/15 bg-[#0a0e1c]/75 p-6 mb-6">
        <button onClick={() => setShowBulk(!showBulk)} className="w-full flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="w-5 h-5 text-orange-400" />
            Bulk IndexNow Submit
          </h2>
          {showBulk ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
        </button>

        {showBulk && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-white/50">
              Paste up to 100 URLs (one per line or comma-separated) or import from a file to notify search engines about new or updated content.
            </p>
            <textarea
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              placeholder={"https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/blog/new-post"}
              rows={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-white/30 font-mono"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleBulkSubmit}
                disabled={submitting || !bulkUrls.trim()}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-sm font-semibold transition flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Submitting…" : "Submit All"}
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.csv,.tsv" onChange={handleFileImport} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white/70 hover:text-white transition flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import File
              </button>
              <span className="text-xs text-white/40">
                {bulkUrls.split(/[\n,]+/).filter((s) => s.trim()).length} URL(s) entered
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Submission History ────────────────────────────────────────── */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-white/8 bg-[#0a0e1c]/75 p-6 mb-6">
          <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-white/60" />
              Submission History
              <span className="text-xs text-white/40 ml-2">{history.length} submission(s) · {totalSubmitted} URL(s)</span>
            </h2>
            {showHistory ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
          </button>

          {showHistory && (
            <div className="mt-4 space-y-2">
              {/* Export history */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => {
                    const data = history.map(e => ({
                      date: new Date(e.createdAt).toISOString(),
                      submitted: e.submittedCount,
                      skipped: e.skippedCount,
                      urls: e.urls.join('; '),
                      error: e.error || '',
                    }));
                    const csv = ['date,submitted,skipped,urls,error', ...data.map(r =>
                      `${r.date},${r.submitted},${r.skipped},"${r.urls.replace(/"/g, '""')}","${r.error}"`
                    )].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `indexnow-history-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                    toast.success('History exported');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
                >
                  <FileText className="w-3 h-3" />
                  Export CSV
                </button>
              </div>
              {history.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/6 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-xs text-white/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(entry.createdAt)}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-emerald-300">{entry.submittedCount} submitted</span>
                      {entry.skippedCount > 0 && <span className="text-amber-300">{entry.skippedCount} skipped</span>}
                      {entry.error && <span className="text-rose-300">{entry.error}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.urls.slice(0, 5).map((u: string, i: number) => (
                      <code key={i} className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded truncate max-w-xs">{u}</code>
                    ))}
                    {entry.urls.length > 5 && <span className="text-xs text-white/40">+{entry.urls.length - 5} more</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Bing IndexNow Setup Guide ────────────────────────────────── */}
      <section className="rounded-2xl border border-indigo-500/15 bg-[#0a0e1c]/75 p-6 mb-6">
        <button onClick={() => setShowSetup(!showSetup)} className="w-full flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-400" />
            How to Set Up Bing IndexNow
            {setupStatus?.configured && (
              <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                ✓ Configured
              </span>
            )}
          </h2>
          {showSetup ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
        </button>

        {showSetup && (
          <div className="mt-4 space-y-5 text-sm text-white/70">
            {/* Step 1 */}
            <div className="space-y-2">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">1</span>
                Get Your Bing IndexNow API Key
              </h3>
              <p>
                Go to the{" "}
                <a href="https://www.bing.com/indexnow" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                  Bing IndexNow page
                </a>{" "}or generate a key directly at:
              </p>
              <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.06] p-3 flex items-center gap-3">
                <code className="text-xs text-indigo-300 flex-1 break-all">https://www.bing.com/indexnow/getstarted</code>
                <button onClick={() => copyToClipboard("https://www.bing.com/indexnow/getstarted")} className="p-1 hover:bg-white/10 rounded flex-shrink-0">
                  <Copy className="w-3.5 h-3.5 text-white/40" />
                </button>
                <a href="https://www.bing.com/indexnow/getstarted" target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-white/10 rounded flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">2</span>
                Place the Key File on Your Domain
              </h3>
              <p>
                Create a text file named <code className="text-indigo-300 bg-white/5 px-1.5 py-0.5 rounded">{"<your-key>"}.txt</code> containing just the key value, and place it at your site root:
              </p>
              <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.06] p-3">
                <code className="text-xs text-indigo-300 block">https://your-domain.com/{"<your-key>"}.txt</code>
                <p className="text-xs text-white/40 mt-1">The file content should be the key itself (e.g., <code>a1b2c3d4e5f6...</code>)</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">3</span>
                Set the Environment Variable (for AiVIS server)
              </h3>
              <p>Add your IndexNow key to your server environment:</p>
              <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.06] p-3 flex items-center gap-3">
                <code className="text-xs text-indigo-300 flex-1 font-mono">INDEXNOW_KEY=your-key-here</code>
                <button onClick={() => copyToClipboard("INDEXNOW_KEY=your-key-here")} className="p-1 hover:bg-white/10 rounded flex-shrink-0">
                  <Copy className="w-3.5 h-3.5 text-white/40" />
                </button>
              </div>
              {setupStatus && (
                <p className="text-xs mt-1">
                  {setupStatus.configured ? (
                    <span className="text-emerald-400">✓ IndexNow is configured on this server (key: {setupStatus.keyHint})</span>
                  ) : (
                    <span className="text-amber-400">⚠ INDEXNOW_KEY is not set — submissions will be skipped</span>
                  )}
                </p>
              )}
            </div>

            {/* Useful Links */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <h3 className="text-white font-semibold">Useful Links</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "Bing IndexNow Get Started", url: "https://www.bing.com/indexnow/getstarted", desc: "Generate key & read docs" },
                  { label: "Bing Webmaster Tools", url: "https://www.bing.com/webmasters/about", desc: "URL inspection, sitemap, IndexNow" },
                  { label: "Google Search Console", url: "https://search.google.com/search-console", desc: "URL inspection & indexing requests" },
                  { label: "IndexNow Protocol Spec", url: "https://www.indexnow.org/documentation", desc: "Full protocol documentation" },
                ].map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/6 bg-white/[0.03] p-3 flex items-center gap-3 hover:bg-white/5 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-300">{link.label}</p>
                      <p className="text-xs text-white/40">{link.desc}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-white/30 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>

            {/* What IndexNow does */}
            <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.06] p-4 space-y-2">
              <h4 className="text-white font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                What IndexNow Does
              </h4>
              <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
                <li>Instantly notifies search engines (Bing, Yandex, Seznam, Naver) about new or updated URLs</li>
                <li>Supported by Bing, Yandex, Seznam.cz, and Naver — one API call reaches all participating engines</li>
                <li>Google does <strong className="text-white/80">not</strong> support IndexNow — use Google Search Console for URL inspection</li>
                <li>Does not guarantee indexing — it signals crawl priority to engines that support the protocol</li>
                <li>Free to use with no rate limits (beyond search engine provider limits)</li>
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* ── No auth warning ──────────────────────────────────────────── */}
      {!user && (
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-5 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-amber-200">Sign in to check indexing status and submit URLs to IndexNow.</p>
          <button onClick={() => navigate("/auth")} className="mt-3 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-semibold">
            Sign In
          </button>
        </div>
      )}
    </div>
  );
}
