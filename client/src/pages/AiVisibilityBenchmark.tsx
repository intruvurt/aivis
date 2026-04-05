import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePageMeta } from "../hooks/usePageMeta";
import { SITE_NAME } from "../config/constants";
import { API_URL } from "../config";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Activity, Target, TrendingUp, AlertTriangle, Layers, ArrowRight, Zap, Search, Shield, FileCode, Braces } from "lucide-react";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../lib/seoSchema";

interface BenchmarkData {
  total_audits: number;
  avg_score: number;
  median_score: number;
  min_score: number;
  max_score: number;
  distribution: Record<string, number>;
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

export default function AiVisibilityBenchmark() {
  const [live, setLive] = useState<BenchmarkData | null>(null);
  const [compareUrl, setCompareUrl] = useState("");
  const navigate = useNavigate();

  usePageMeta({
    title: `AI Search Visibility Benchmarks 2026 | ${SITE_NAME}`,
    description: `Original research and benchmark data on AI search visibility across 154 audited pages. Average AI visibility score sits at 41/100. Learn how to beat the benchmark.`,
    path: '/benchmarks',
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "@id": "https://aivis.biz/benchmarks#article",
        "headline": "2026 AI Search Extractability Benchmarks",
        "description": "Original research across 154 B2B SaaS and editorial domains reveals the average AI visibility score is 41/100.",
        "image": ["https://aivis.biz/aivis-cover.png"],
        "author": { "@id": "https://aivis.biz/#author" },
        "publisher": { "@id": "https://aivis.biz/#organization" },
        "datePublished": "2026-01-15T00:00:00.000Z",
        "dateModified": "2026-06-01T00:00:00.000Z",
        "inLanguage": "en-US"
      },
      buildWebPageSchema({
        path: '/benchmarks',
        name: 'AI Search Visibility Benchmarks 2026',
        description: 'Original research and benchmark data on AI search visibility across 154 audited pages.',
        mainEntityId: 'https://aivis.biz/benchmarks#article',
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Benchmarks', path: '/benchmarks' },
      ]),
    ]
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/public/benchmarks`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.success) setLive(d.benchmarks); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="text-white relative overflow-hidden">
      {/* ── Ambient background ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-60 -right-40 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-16 sm:py-24">

        {/* ── Hero section ── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mb-16"
        >
          {/* Promo image */}
          <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="mb-10 flex justify-center">
            <img
              src="/images/ad-aivis.png"
              alt="AiVIS AI visibility benchmark promo - your website can rank number one and still be invisible"
              className="max-w-full h-auto max-h-[400px] object-contain rounded-2xl border border-white/10 shadow-2xl shadow-cyan-500/5"
            />
          </motion.div>

          {/* Badge */}
          <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Original Research · 154 Sites Audited
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-center tracking-tight mb-6 bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent leading-tight"
          >
            AI Search Extractability<br />Benchmarks
            <span className="text-cyan-400">.</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center text-lg sm:text-xl text-white/60 max-w-3xl mx-auto leading-relaxed"
          >
            Based on rigorous analysis of 154 B2B SaaS and editorial domains, the average website
            fails critically when parsed by LLMs for Perplexity, ChatGPT, or AI Overviews.
          </motion.p>
        </motion.section>

        {/* ── Static research benchmarks ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-16"
        >
          <div className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-6 text-center">
            Key Findings · 2026 Study
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Score Card */}
            <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="rounded-2xl border border-cyan-500/20 bg-[#0d1117] p-8 text-center hover:border-cyan-500/40 transition-colors">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-5">
                <Activity className="w-7 h-7 text-cyan-400" />
              </div>
              <div className="text-5xl font-black text-white mb-2 tabular-nums">41<span className="text-white/30 text-2xl font-medium"> / 100</span></div>
              <div className="text-white/70 font-semibold mb-1">Average Site Score</div>
              <div className="text-xs text-white/40">154-site research study</div>
            </motion.div>

            {/* JSON-LD Card */}
            <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="rounded-2xl border border-red-500/20 bg-[#0d1117] p-8 text-center hover:border-red-500/40 transition-colors">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-red-500/10 border border-red-500/20 mb-5">
                <Target className="w-7 h-7 text-red-400" />
              </div>
              <div className="text-5xl font-black text-white mb-2 tabular-nums">82<span className="text-red-400 text-2xl font-medium">%</span></div>
              <div className="text-white/70 font-semibold mb-1">Missing JSON-LD</div>
              <div className="text-xs text-white/40">No structured data detected</div>
            </motion.div>

            {/* JS-Rendering Card */}
            <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="rounded-2xl border border-orange-500/20 bg-[#0d1117] p-8 text-center hover:border-orange-500/40 transition-colors">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-500/20 mb-5">
                <BarChart3 className="w-7 h-7 text-orange-400" />
              </div>
              <div className="text-5xl font-black text-white mb-2 tabular-nums">64<span className="text-orange-400 text-2xl font-medium">%</span></div>
              <div className="text-white/70 font-semibold mb-1">JS-Rendering Blocked</div>
              <div className="text-xs text-white/40">Content invisible to AI parsers</div>
            </motion.div>
          </div>
        </motion.section>

        {/* ── Live platform benchmarks ── */}
        {live && live.total_audits >= 5 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mb-16"
          >
            <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="rounded-2xl border border-cyan-500/25 bg-[#0d1117] p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Live Platform Data</h2>
                  <p className="text-xs text-white/40">Real-time aggregation from AiVIS audits</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 text-emerald-300 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {live.total_audits.toLocaleString()} audits
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-6 mb-8">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-center">
                  <div className="text-3xl font-black text-cyan-300 tabular-nums">{live.avg_score}<span className="text-white/30 text-lg">/100</span></div>
                  <div className="text-xs text-white/50 mt-1 font-medium">Platform Average</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-center">
                  <div className="text-3xl font-black text-white/90 tabular-nums">{live.median_score}<span className="text-white/30 text-lg">/100</span></div>
                  <div className="text-xs text-white/50 mt-1 font-medium">Median Score</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-center">
                  <div className="text-3xl font-black text-white/90 tabular-nums">{live.min_score}<span className="text-white/30 text-lg"> – </span>{live.max_score}</div>
                  <div className="text-xs text-white/50 mt-1 font-medium">Score Range</div>
                </div>
              </div>

              {/* Distribution bars */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Score Distribution</div>
                {Object.entries(live.distribution).map(([bucket, count]) => {
                  const pct = live.total_audits > 0 ? Math.round((count / live.total_audits) * 100) : 0;
                  return (
                    <div key={bucket} className="flex items-center gap-3">
                      <span className="text-xs text-white/60 w-16 text-right font-mono">{bucket}</span>
                      <div className="flex-1 h-5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${Math.max(pct, 2)}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        />
                      </div>
                      <span className="text-xs text-white/50 w-14 font-mono tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.section>
        )}

        {/* ── How Do You Compare? ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#0d1117] to-[#0e1525] p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(34,211,238,0.06),transparent)]" />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-black mb-2 text-white">Where Does Your Site Stand?</h2>
              <p className="text-white/50 mb-6 max-w-lg mx-auto">
                Enter your URL to instantly see how you compare against the {live ? live.total_audits.toLocaleString() + "+" : "154"} sites in our dataset.
              </p>
              <div className="flex gap-3 max-w-xl mx-auto">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={compareUrl}
                    onChange={(e) => setCompareUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && compareUrl.trim()) {
                        navigate(`/?url=${encodeURIComponent(compareUrl.trim())}`);
                      }
                    }}
                    placeholder="https://yoursite.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-cyan-500/50 placeholder:text-white/30"
                  />
                </div>
                <button
                  onClick={() => compareUrl.trim() && navigate(`/?url=${encodeURIComponent(compareUrl.trim())}`)}
                  disabled={!compareUrl.trim()}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-40 text-sm font-semibold transition flex items-center gap-2 shadow-lg shadow-cyan-500/15"
                >
                  <Activity className="w-4 h-4" />
                  Analyze
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Scoring Methodology ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-16"
        >
          <div className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-6 text-center">
            Scoring Methodology
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: <FileCode className="w-5 h-5 text-violet-400" />,
                border: "border-violet-500/20",
                bg: "bg-violet-500/10",
                title: "Content Depth & Quality",
                desc: "Word count, topical coverage, factual claim density, explanatory depth",
                weight: "20%"
              },
              {
                icon: <Braces className="w-5 h-5 text-cyan-400" />,
                border: "border-cyan-500/20",
                bg: "bg-cyan-500/10",
                title: "Schema & Structured Data",
                desc: "JSON-LD coverage, entity completeness, FAQ/HowTo/Organization schema accuracy",
                weight: "20%"
              },
              {
                icon: <Target className="w-5 h-5 text-orange-400" />,
                border: "border-orange-500/20",
                bg: "bg-orange-500/10",
                title: "AI Readability & Citability",
                desc: "Answer block density, Q&A sections, extractable claims, citation-ready passages",
                weight: "20%"
              },
              {
                icon: <Shield className="w-5 h-5 text-emerald-400" />,
                border: "border-emerald-500/20",
                bg: "bg-emerald-500/10",
                title: "Technical SEO",
                desc: "HTTPS enforcement, canonical tags, internal linking, robots.txt, sitemap presence",
                weight: "15%"
              },
              {
                icon: <Search className="w-5 h-5 text-amber-400" />,
                border: "border-amber-500/20",
                bg: "bg-amber-500/10",
                title: "Meta Tags & Open Graph",
                desc: "Title tag specificity, meta description, OG completeness, Twitter Card markup",
                weight: "13%"
              },
              {
                icon: <Layers className="w-5 h-5 text-rose-400" />,
                border: "border-rose-500/20",
                bg: "bg-rose-500/10",
                title: "Heading Structure & H1",
                desc: "Single H1 presence, H2/H3 hierarchy, keyword-bearing headings, heading density",
                weight: "12%"
              },
            ].map((cat) => (
              <motion.div key={cat.title} variants={fadeUp} transition={{ duration: 0.5 }} className={`rounded-2xl border ${cat.border} bg-[#0d1117] p-6 text-center hover:bg-[#111827] transition-colors`}>
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${cat.bg} border ${cat.border} mb-4`}>
                  {cat.icon}
                </div>
                <div className="text-2xl font-black text-white mb-1 tabular-nums">{cat.weight}</div>
                <div className="text-sm font-semibold text-white mb-2">{cat.title}</div>
                <p className="text-xs text-white/40 leading-relaxed">{cat.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Research findings ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="mb-16 grid md:grid-cols-2 gap-6"
        >
          {/* Why 41/100 */}
          <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-[#0d1117] p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Why The Average is Only 41/100</h2>
            </div>
            <p className="text-white/60 leading-relaxed">
              Most websites rely entirely on Googlebot executing JavaScript to render their Single Page Applications (React, Vue, Angular).
              However, nimble AI agents and RAG web-fetchers often <strong className="text-white">do not execute JavaScript</strong>. They scrape the raw HTML shell.
              If your content requires JS hydration, the bots see a blank page.
            </p>
          </motion.div>

          {/* Study results */}
          <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-[#0d1117] p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <Layers className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Original Study Results</h2>
            </div>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-red-400" />
                <div>
                  <span className="font-semibold text-white">Entity Confusion:</span>
                  <span className="text-white/60"> 72% of sites have no clear <code className="text-cyan-300 text-sm bg-cyan-500/10 px-1.5 py-0.5 rounded">Organization</code> or <code className="text-cyan-300 text-sm bg-cyan-500/10 px-1.5 py-0.5 rounded">WebSite</code> schema linking their brand to their founder or products.</span>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-orange-400" />
                <div>
                  <span className="font-semibold text-white">Crawl Budget Waste:</span>
                  <span className="text-white/60"> Deeply nested routing caused AI bots to abandon crawls after 3 pages on 45% of audited domains.</span>
                </div>
              </li>
            </ul>
          </motion.div>
        </motion.section>

        {/* ── CTA section ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
          transition={{ duration: 0.6 }}
        >
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1117] to-[#111827] p-10 sm:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(34,211,238,0.08),transparent)]" />
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-6">
                <Zap className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-black mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">Beat the Benchmark</h3>
              <p className="text-white/50 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                Don't guess where your site stands. Get your exact score and an architecture fix checklist today.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-8 py-4 rounded-full text-base font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 hover:scale-105 transform"
              >
                Analyze My Site Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
