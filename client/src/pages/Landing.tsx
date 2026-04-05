import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileCheck2, Gauge, Search, Shield, Layers, Bot, LinkIcon, BarChart3 } from "lucide-react";
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
    description: "AiVIS crawls the page and extracts the signals answer engines use: structure, schema, metadata, headings and proof.",
    icon: Search,
  },
  {
    title: "Expose",
    description: "The report shows the blockers with the evidence behind them and the exact trust gaps stopping citation readiness.",
    icon: Shield,
  },
  {
    title: "Fix and re-scan",
    description: "Turn the audit into execution. Ship the change and run the same URL again to measure whether visibility moved.",
    icon: FileCheck2,
  },
] as const;

const measureItems = [
  { title: "Content depth", desc: "Whether your page has enough substance to support extraction, summarization and reuse." },
  { title: "Heading hierarchy", desc: "Whether your structure helps or blocks understanding across sections." },
  { title: "Entity clarity and authority", desc: "Whether your site clearly defines what it is and how it should be trusted and understood by machines." },
  { title: "Structured data", desc: "Whether your schema supports your content or conflicts with it." },
  { title: "Technical foundation", desc: "Whether performance, crawlability, robots, SPA and accessibility are blocking interpretation." },
  { title: "Citation readiness", desc: "Whether your content can be safely used inside AI generated answers." },
];

const answerBlocks: { q: string; a: string }[] = [
  { q: "What is AiVIS", a: "AiVIS is an AI visibility intelligence platform that audits how answer engines read, trust and cite a website. It crawls your page, extracts structural signals and maps them to a 0-100 visibility score across six weighted categories. Every finding is tied to real page evidence through BRAG evidence identifiers so results can be verified and traced, not assumed." },
  { q: "What is AI visibility", a: "AI visibility is the degree to which a website can be understood, trusted and reused by systems that generate answers instead of returning links. It depends on content depth, heading clarity, schema coverage, metadata quality and machine-readable formatting. A page can rank first in traditional search and still be invisible to answer engines if these signals are missing." },
  { q: "What causes low AI visibility scores", a: "Common causes include thin content with fewer than 800 words, missing or conflicting structured data, unclear heading hierarchy, absent metadata, weak entity signals and poor technical foundations like blocked crawlers or slow load times. AiVIS identifies each gap with evidence so you know exactly what to fix and in what order of impact." },
  { q: "How does AiVIS find visibility issues", a: "AiVIS crawls the target URL with a real browser, extracts structural signals including headings, schema, meta tags, body content and links, then runs them through a multi-model AI pipeline that scores each category. On higher tiers a second model critiques findings and a third validates the result. Every issue references specific page evidence through BRAG identifiers." },
  { q: "What is citation readiness", a: "Citation readiness measures how safe and reliable a page is for reuse inside AI-generated answers. It requires clear entity definitions, consistent schema support, sufficient content depth and structural formatting that allows AI systems to extract usable information without risking attribution errors or factual misrepresentation." },
  { q: "What is BRAG in AiVIS", a: "BRAG stands for Based Retrieval and Auditable Grading. It is the evidence framework that ties every audit finding to a real element on your page. Each heading, schema block, meta tag and content section receives a BRAG evidence identifier that can be traced, verified and rechecked across scan cycles so no finding is left unsupported." },
  { q: "Why does structure matter for AI systems", a: "Structure allows AI models to break content into context-appropriate sections without losing meaning. Clean headings, logical section flow, consistent naming and proper schema help answer engines determine what each part of a page means, how it relates to the broader topic and whether it can be safely extracted and cited as a source." },
  { q: "Who should use AiVIS", a: "AiVIS is built for founders, marketers, developers and agencies who need to understand why their content is not being used by AI answer engines. If your site depends on being found, trusted and reused by ChatGPT, Perplexity, Claude or Google AI, the audit shows exactly where visibility breaks and what changes will fix it." },
];

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
    fullTitle: "AiVIS — AI Evidence-backed Visibility Audits",
    title: "AI Evidence-backed Visibility Audits for ChatGPT, Perplexity, Claude and Google AI",
    description:
      "AiVIS is an AI visibility intelligence platform that audits how answer engines read, trust and cite a website. Get a 0-100 visibility score with evidence-backed findings and prioritized fixes.",
    path: "/",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: answerBlocks.map((block) => ({
        "@type": "Question",
        name: block.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: block.a,
        },
      })),
    },
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

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_38%),linear-gradient(180deg,#09111e_0%,#060a14_100%)] pt-24 pb-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_28rem] lg:px-8">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">AI visibility audit</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              AI Evidence-backed Visibility Audits
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/68">
              AiVIS is an AI visibility intelligence platform that audits how answer engines read, trust and cite a website. It interprets your site's structure, trust signals and citation readiness based on real page evidence — not inferred summaries.
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
              Start with any public homepage, feature page, blog post or documentation URL.
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
                See Visibility
              </button>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/46">What you get</p>
              <ul className="mt-3 space-y-2 text-sm text-white/66">
                <li>0-100 visibility score with six category grades</li>
                <li>Evidence-backed findings tied to real page data</li>
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

      {/* ── Trust bar ── */}
      <section className="border-y border-white/8 bg-[#08101d] py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-sm text-white/58 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> No data resale</span>
          <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-cyan-300" /> Export-ready proof</span>
          <span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4 text-cyan-300" /> Six weighted score dimensions</span>
        </div>
      </section>

      {/* ── Benchmark bar ── */}
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

      {/* ── Positioning ── */}
      <section className="py-16 border-b border-white/8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Understanding AI visibility</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">What is AI visibility</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/64">
            AI visibility is the degree to which a website can be understood, trusted and reused by systems that generate answers instead of returning links. Ranking alone does not earn citation. AiVIS measures the extractability, trust-signal alignment and citation readiness of your content by analyzing what answer engines actually need to formulate a reliable answer. Learn more about the <Link to="/methodology" className="text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200">audit methodology</Link> behind the scoring.
          </p>
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="py-16 border-b border-white/8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">What you actually get</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Evidence-backed visibility intelligence</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { title: "Full page interpretation", desc: "AiVIS reads your page the way an answer engine does and shows where meaning breaks or becomes unclear." },
              { title: "Evidence-backed findings", desc: "Every issue is tied to a real part of your page so you can see what caused it and how to fix it." },
              { title: "Clear consistent scoring logic", desc: "You get a visibility score based on structure, content and trust signals that affect citation readiness. No AI guessing, hallucinations or opinions. Every finding must be validated with BRAG evidence IDs." },
              { title: "Actionable fixes", desc: "Each result includes direct changes that improve how your site is read and reused by AI systems." },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/64">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How AI reads ── */}
      <section className="py-16 border-b border-white/8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">How AI reads your site</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">How AI systems evaluate websites</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { title: "Structure comes first", desc: "Clean headings and logical sections help models understand what each part of the page means without guessing." },
              { title: "Clarity beats volume", desc: "A long page does not help if the meaning is unclear. AI prefers content that is easy to break into usable parts." },
              { title: "Trust is earned through signals", desc: "Consistent naming, schema and supporting details increase confidence in what the page is saying." },
              { title: "Alignment with real user questions", desc: "Content must match how users actually ask questions or it will not be retrieved." },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/64">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── What AiVIS measures ── */}
      <section className="py-16 border-b border-white/8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Core audit dimensions</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">What AiVIS actually audits</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {measureItems.map((item) => (
              <article key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/64">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who benefits ── */}
      <section className="py-16 border-b border-white/8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Who benefits</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Who benefits from AI visibility audits</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/64">
            AI visibility audits help anyone whose content needs to appear inside generated answers. If your site depends on being found, trusted and reused by AI systems, this audit shows you exactly where visibility breaks and how to repair it.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { title: "Founders and product teams", desc: "Understand whether your product pages, documentation and landing pages are readable by AI systems that potential customers use to evaluate solutions before they ever visit your site." },
              { title: "Marketing and content teams", desc: "See which content assets are eligible for citation, which are being ignored, and what structural changes unlock retrieval across ChatGPT, Perplexity, Claude and Gemini." },
              { title: "Developers and technical leads", desc: "Audit schema markup, heading hierarchy, canonical tags and structured data against the signals AI models use to build trust, resolve entities and extract usable content." },
              { title: "Agencies and consultants", desc: "Offer clients measurable proof of AI visibility health with a structured report that connects every finding to real page evidence through BRAG evidence identifiers." },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/64">{item.desc}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-white/52">
            <Link to="/pricing" className="text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200">Compare audit plans</Link> to find the visibility intelligence level that matches your needs, or read the <Link to="/methodology" className="text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200">audit methodology</Link> to see how scoring works.
          </p>
        </div>
      </section>

      {/* ── BRAG ── */}
      <section className="py-16 border-b border-white/8 bg-gradient-to-b from-[#0b1422] to-[#060a14]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/80">BRAG</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Based Retrieval and Auditable Grading</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/68">
            AiVIS uses BRAG which stands for Based Retrieval and Auditable Grading. Every finding is tied to real page evidence using stable evidence identifiers. Each element of your page is assigned a BRAG evidence ID so results can be traced, verified and rechecked across scan cycles. This means you can validate any finding against your actual page data instead of relying on generic advice.
          </p>
          <p className="mt-3 max-w-3xl text-base leading-7 text-white/60">
            If something cannot be proven it is not included. If something is missing it is shown as missing. There are no assumptions, no AI-generated opinions and no filler insights. Every issue links back to a concrete part of your page.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl border border-orange-400/20 bg-orange-400/[0.04] p-6">
              <h3 className="text-lg font-semibold text-orange-300">Evidence first</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">Titles, headings, schema and content are extracted directly from your page and stored as evidence units.</p>
            </article>
            <article className="rounded-3xl border border-orange-400/20 bg-orange-400/[0.04] p-6">
              <h3 className="text-lg font-semibold text-orange-300">Traceable findings</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">Each issue links back to the exact part of your page that caused it so fixes are clear and direct.</p>
            </article>
            <article className="rounded-3xl border border-orange-400/20 bg-orange-400/[0.04] p-6">
              <h3 className="text-lg font-semibold text-orange-300">Consistent scoring</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">Scores are based on verified signals not generated summaries so results stay stable across scans.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ── From audit to citation ── */}
      <section className="py-16 border-b border-white/8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Beyond the audit</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">From audit to citation</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/64">
            An audit is the starting point. AiVIS also supports{" "}
            <Link to="/citations" className="text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200">how AI citation testing works</Link>{" "}
            to verify whether AI models reference your brand in live answers. You can run{" "}
            <Link to="/competitors" className="text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200">competitor visibility tracking</Link>{" "}
            to benchmark your visibility against rival sites and identify structural gaps they have not addressed. Score trend{" "}
            <Link to="/analytics" className="text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200">analytics</Link>{" "}
            show how your visibility changes as you apply fixes across scan cycles. Review the{" "}
            <Link to="/methodology" className="text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200">audit methodology</Link>{" "}
            to understand how each category is scored or use the{" "}
            <Link to="/tools/schema-validator" className="text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200">structured data impact validator</Link>{" "}
            to check your schema coverage before the next scan.
          </p>
        </div>
      </section>

      {/* ── Agentic layer ── */}
      <section className="py-16 border-b border-white/8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Agentic surface</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Built for agents, tools and AI workflows</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/64">
            AiVIS is not just a report. It is a structured surface that agents can use to evaluate and improve visibility across sites, products and content systems.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { icon: Layers, title: "WebMCP ready surface", desc: "Audit outputs can be consumed by tools that require clean structured data for decision making and automation." },
              { icon: Bot, title: "Context driven analysis", desc: "Results adapt to niche intent and page type so recommendations stay relevant to your domain." },
              { icon: LinkIcon, title: "Integration friendly outputs", desc: "Data can be used across internal tools, dashboards and automation pipelines without reprocessing." },
              { icon: BarChart3, title: "Agent usable scoring", desc: "Scores are consistent and explainable so agents can act on them without guesswork." },
            ].map((item) => (
              <article key={item.title} className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/64">{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 border-b border-white/8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Scan. Expose. Fix. Re-scan.</h2>
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

      {/* ── Answer blocks ── */}
      <section className="py-16 border-b border-white/8 bg-gradient-to-b from-[#060a14] to-[#0b1422]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Frequently asked questions</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Frequently asked questions about AI visibility</h2>
          <div className="mt-8 space-y-4">
            {answerBlocks.map((block) => (
              <article key={block.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">{block.q}</h3>
                <p className="mt-2 text-sm leading-6 text-white/64">{block.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-5 px-4 sm:px-6 lg:px-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Start now</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Find what AI gets wrong about your site</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62">
              Run an evidence-backed audit and see where your site visibility breaks before the answer engine decides without you.
            </p>
          </div>
          <Link
            to={isAuthenticated ? "/app/analyze" : "/auth?mode=signup"}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
          >
            Start Visibility Audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
