import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Clock3, Database, Search, Globe, Copy, Download, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { usePageMeta } from "../hooks/usePageMeta";
import { checkServerHeaders } from "../api";
import type { ServerHeadersCheckResult } from "../../../shared/types";
import "../styles/animations.css";

const SAMPLE_URLS = [
  "https://aivis.biz",
  "https://github.com",
  "https://developer.mozilla.org",
];

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

export default function ServerHeadersPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("https://aivis.biz");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServerHeadersCheckResult | null>(null);

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
      setResult(response.result);
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

  const copyExecutiveSummary = async () => {
    if (!result) return;
    const text = [
      `Server Headers Premium Audit`,
      `URL: ${result.url || "N/A"}`,
      `Final URL: ${result.finalUrl || "N/A"}`,
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
      `- URL: ${result.url || "N/A"}`,
      `- Final URL: ${result.finalUrl || "N/A"}`,
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
    document.body.removeChild(anchor);
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
            {SAMPLE_URLS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setUrl(sample)}
                className="px-3 py-1.5 rounded-full text-xs bg-charcoal-light border border-white/10 text-white/75 hover:text-white"
              >
                {sample}
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm text-white/65">
            This checker returns response headers such as security policy, cache lifetime, content type, server hints, and robots directives.
          </p>
        </div>

        return (
          <>
            <header className="border-b border-white/10 bg-charcoal-deep backdrop-blur-xl sticky top-0 z-20">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="rounded-full p-2 transition-colors hover:bg-white/8"
                  type="button"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5 text-white/55" />
                </button>
                <div className="min-w-0">
                  <h1 className="flex items-center gap-2 text-xl brand-title">
                    <Shield className="h-5 w-5 text-cyan-400" />
                    Server Headers Check
                  </h1>
                  <p className="text-sm text-white/60 leading-relaxed">Inspect HTTP response headers for security policy, caching, and server behavior</p>
                </div>
              </div>
            </header>
            <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                    <Copy className="w-4 h-4" /> Copy Summary
                  </button>
                  <button onClick={exportJson} className="btn-export-shimmer action-button-prominent inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm" type="button">
                    <Download className="w-4 h-4" /> Export JSON
                  </button>
                  <button onClick={exportImplementationPlan} className="btn-export-shimmer action-button-prominent inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm" type="button">
                    <Download className="w-4 h-4" /> Export Plan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <MetaRow label="Overall Score" value={`${result.executive.overall_score} (${result.executive.grade})`} />
                <MetaRow label="Readiness" value={result.executive.readiness} />
                <MetaRow label="XSS Risk" value={`${result.attack_surface.xss.risk} (${result.attack_surface.xss.score})`} />
                <MetaRow label="DDoS Risk" value={`${result.attack_surface.ddos.risk} (${result.attack_surface.ddos.score})`} />
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
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${result.security[key] ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-charcoal text-white/60"}`}>
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
                    <span key={header} className="px-3 py-1.5 rounded-full text-xs border border-white/10 bg-charcoal-light/45 text-white/80">{header}</span>
                  )) : <span className="text-sm text-white/70">No critical missing security headers detected.</span>}
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface-structured rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">{icon}<span className="text-sm text-white/65">{label}</span></div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal-light/35 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-white/50 mb-1">{label}</dt>
      <dd className="text-white/80 break-all">{value}</dd>
    </div>
  );
}
