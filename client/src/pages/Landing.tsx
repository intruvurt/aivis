import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileCheck2, Gauge, Search, Shield } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePageMeta } from "../hooks/usePageMeta";

const API_URL = import.meta.env.VITE_API_URL || "";

const proofItems = [
  "What AI sees",
  "What it cannot verify",
  "What to fix next",
  "How to prove the lift",
];

const steps = [
  {
    title: "Scan",
    description: "We crawl the page and extract the signals answer engines actually use: structure, schema, metadata, headings, and proof.",
    icon: Search,
  },
  {
    title: "Expose",
    description: "The report shows the blockers, the evidence behind them, and the exact trust gaps stopping citation readiness.",
    icon: Shield,
  },
  {
    title: "Fix and re-scan",
    description: "Turn the audit into execution, ship the change, and run the same URL again to measure whether visibility moved.",
    icon: FileCheck2,
  },
] as const;

export default function Landing() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [totalAudits, setTotalAudits] = useState<number>(0);
  const [avgScore, setAvgScore] = useState<number>(0);

  useEffect(() => {
    fetch(`${API_URL}/api/public/benchmarks`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.benchmarks) {
          setTotalAudits(d.benchmarks.total_audits || 0);
          setAvgScore(d.benchmarks.avg_score || 0);
        }
      })
      .catch(() => {});
  }, []);

  usePageMeta({
    title: "AiVIS — AI Visibility Audit for ChatGPT, Perplexity, Claude",
    description:
      "Measure whether AI can find and cite your site. One audit returns a 0-100 visibility score, six category grades, and evidence-backed fixes.",
  });

  const handleAudit = () => {
    if (!url.trim()) return;
    const normalized = url.trim();
    if (!isAuthenticated) {
      navigate(`/auth?mode=signup&redirect=/app/analyze?url=${encodeURIComponent(normalized)}`);
      return;
    }
    navigate(`/app/analyze?url=${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="text-white">
      <section className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_38%),linear-gradient(180deg,#09111e_0%,#060a14_100%)] pt-24 pb-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_28rem] lg:px-8">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">AI visibility audit</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Your site ranks. AI ignores it.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/68">
              See your visibility in one pass: what AI can read, what it cannot trust, and what you need to change before the next scan.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {proofItems.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white/72">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#0b1422]/92 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-medium text-white/84">
              <Gauge className="h-4 w-4 text-cyan-300" />
              See your visibility
            </div>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Start with any public homepage, feature page, blog post, or documentation URL.
            </p>
            <div className="mt-5 space-y-3">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleAudit()}
                placeholder="https://yoursite.com"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/32 focus:outline-none focus:ring-2 focus:ring-orange-400/70"
              />
              <button
                onClick={handleAudit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
              >
                <Search className="h-4 w-4" />
                See Your Visibility
              </button>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/46">What you get</p>
              <ul className="mt-3 space-y-2 text-sm text-white/66">
                <li>0-100 visibility score with category breakdown</li>
                <li>Evidence-linked blockers tied to the crawl</li>
                <li>Fix path you can validate on the next scan</li>
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/54">
              <span>No credit card for Observer</span>
              <span>Works on public URLs</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#08101d] py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-sm text-white/58 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> No data resale</span>
          <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-cyan-300" /> Export-ready proof</span>
          <span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4 text-cyan-300" /> Six weighted score dimensions</span>
        </div>
      </section>

      {totalAudits > 0 && (
        <section className="border-b border-white/8 bg-gradient-to-r from-[#0b1422] to-[#0d1a2e] py-5">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 text-sm sm:px-6 lg:px-8">
            <span className="font-semibold text-orange-300">{totalAudits.toLocaleString()}+ audits completed</span>
            <span className="hidden sm:block h-4 w-px bg-white/12" />
            <span className="text-white/58">Platform avg score: <span className="font-medium text-white/80">{avgScore}/100</span></span>
            <span className="hidden sm:block h-4 w-px bg-white/12" />
            <span className="text-white/58">Real-time benchmark data</span>
          </div>
        </section>
      )}

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">One product loop: scan, expose, fix, re-scan.</h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-400/14 text-orange-300">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Step {index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/64">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-5 px-4 sm:px-6 lg:px-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Start small</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">See your visibility. Then fix what AI cannot trust.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62">
              The first screen should get you to the verdict fast. The deeper tools stay available after the audit, not before it.
            </p>
          </div>
          <Link
            to={isAuthenticated ? "/app/analyze" : "/auth?mode=signup"}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
          >
            See Your Visibility
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
