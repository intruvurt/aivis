// Landing — Clean marketing homepage (public shell)
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, ChevronDown, ChevronRight, Shield, Building2, Lock,
  Zap, BarChart3, FileText, GitPullRequest, ArrowRight,
  CheckCircle2, Brain, Globe, Target, Eye, Layers,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePageMeta } from "../hooks/usePageMeta";

// ─── Hero ────────────────────────────────────────────────────────────────────
function HeroSection() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const handleAudit = () => {
    if (!url.trim()) return;
    if (!isAuthenticated) {
      navigate(`/auth?mode=signup&redirect=/app/analyze?url=${encodeURIComponent(url.trim())}`);
    } else {
      navigate(`/app/analyze?url=${encodeURIComponent(url.trim())}`);
    }
  };

  return (
    <section className="relative pt-28 pb-20 overflow-hidden">
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-radial from-cyan-500/[0.07] via-transparent to-transparent" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — copy */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight"
            >
              <span className="text-white">See if AI will </span>
              <span className="bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">cite your site</span>
              <span className="text-white"> or skip it</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-5 text-lg text-white/60 leading-relaxed max-w-lg"
            >
              One audit shows whether ChatGPT, Perplexity, Claude, and Google AI
              can extract, trust, and reference your content. Get a 0–100 score,
              six category grades, and evidence-backed fixes.
            </motion.p>

            {/* Proof chips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 flex flex-wrap gap-2"
            >
              {[
                "6 scored categories",
                "8–12 fixes per audit",
                "Evidence-backed findings",
                "Export-ready reports",
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/60"
                >
                  <CheckCircle2 className="w-3 h-3 text-cyan-400/70" />
                  {t}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to={isAuthenticated ? "/app/analyze" : "/auth?mode=signup"}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
              >
                <Search className="w-4 h-4" />
                Run an Audit
              </Link>
              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.12] text-white/70 text-sm font-medium hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                View Methodology
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          </div>

          {/* Right — audit input card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="rounded-2xl bg-[#0d1117]/80 backdrop-blur border border-white/[0.08] p-6 shadow-2xl shadow-black/40">
              <p className="text-sm font-semibold text-white/80 mb-4">Try it now</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAudit()}
                  placeholder="https://yoursite.com"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40"
                />
                <button
                  onClick={handleAudit}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400 transition-colors shrink-0"
                >
                  Audit
                </button>
              </div>

              {/* Preview score mockup */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: "Content Depth", grade: "B+", color: "text-emerald-400" },
                  { label: "Schema", grade: "A", color: "text-cyan-400" },
                  { label: "Headings", grade: "A-", color: "text-cyan-300" },
                  { label: "Meta Tags", grade: "C+", color: "text-amber-400" },
                  { label: "Tech SEO", grade: "B", color: "text-emerald-400" },
                  { label: "Citability", grade: "B-", color: "text-violet-400" },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center"
                  >
                    <p className={`text-xl font-bold ${c.color}`}>{c.grade}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-center">
                <span className="text-[11px] text-white/30">
                  Sample category grades — your real audit is evidence-grounded
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Trust Strip ─────────────────────────────────────────────────────────────
function TrustStrip() {
  const items = [
    { icon: Building2, text: "U.S. Business (EIN on file)" },
    { icon: Lock, text: "256-bit SSL Encrypted" },
    { icon: Shield, text: "No Data Resale" },
    { icon: FileText, text: "Export-ready reports" },
  ];

  return (
    <section className="py-8 border-y border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-white/50 text-sm">
              <item.icon className="w-4 h-4 text-white/30" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      icon: Globe,
      title: "Crawl your site",
      desc: "We fetch your live page and extract every signal AI models evaluate — schema, headings, content, metadata, and technical setup.",
    },
    {
      icon: BarChart3,
      title: "Score the real signals",
      desc: "Six weighted categories produce a 0–100 visibility score. Each grade is tied to real crawled evidence, not generic checklists.",
    },
    {
      icon: Zap,
      title: "Fix what blocks citation",
      desc: "Prioritized, evidence-linked recommendations show exactly what to change. Signal tier generates pull requests automatically.",
    },
  ];

  return (
    <section className="py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/70 mb-3">
            How it works
          </p>
          <h2 className="text-3xl font-bold text-white">
            Three steps to AI visibility
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 hover:border-white/[0.12] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                <step.icon className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Score Preview ───────────────────────────────────────────────────────────
function ScorePreviewSection() {
  return (
    <section className="py-20 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/70 mb-3">
              Audit output
            </p>
            <h2 className="text-3xl font-bold text-white mb-4">
              Evidence-grounded scoring
            </h2>
            <p className="text-white/50 leading-relaxed mb-6">
              Every category grade maps to real signals extracted from your page.
              Not keyword density. Not generic tips. Actual crawled evidence that
              determines whether AI models will trust and cite your content.
            </p>
            <ul className="space-y-3">
              {[
                "Overall visibility score (0–100)",
                "Six weighted category grades",
                "Top issues with severity ranking",
                "Evidence IDs linking findings to page elements",
                "Prioritized fix recommendations",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-white/60">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400/60 mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Mock score card */}
          <div className="rounded-2xl bg-[#0d1117]/80 backdrop-blur border border-white/[0.08] p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">74</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">example.com</p>
                <p className="text-xs text-white/40 mt-0.5">Visibility: Good — room for improvement</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { label: "Content Depth & Quality", score: 82, color: "bg-emerald-500" },
                { label: "Heading Structure", score: 90, color: "bg-cyan-500" },
                { label: "Schema & Structured Data", score: 65, color: "bg-amber-500" },
                { label: "Meta Tags & Open Graph", score: 71, color: "bg-cyan-400" },
                { label: "Technical SEO", score: 78, color: "bg-emerald-400" },
                { label: "AI Citability", score: 58, color: "bg-violet-500" },
              ].map((c) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/60">{c.label}</span>
                    <span className="text-xs font-semibold text-white/80">{c.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Auto Score Fix ──────────────────────────────────────────────────────────
function AutoScoreFixSection() {
  const steps = [
    { icon: Eye, label: "Audit", desc: "Crawl and score your page" },
    { icon: Target, label: "Detect", desc: "Identify evidence-backed blockers" },
    { icon: GitPullRequest, label: "Fix PR", desc: "Generate implementation PR" },
    { icon: BarChart3, label: "Re-check", desc: "Re-audit and prove improvement" },
  ];

  return (
    <section className="py-20 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/70 mb-3">
          Auto Score Fix
        </p>
        <h2 className="text-3xl font-bold text-white mb-3">
          Find the issue. Open the pull request. Re-audit.
        </h2>
        <p className="text-white/50 max-w-2xl mx-auto mb-12">
          Signal and Score Fix tiers unlock automated remediation. AiVIS
          generates implementation PRs, tracks deployment, and re-audits to
          confirm score improvement.
        </p>

        <div className="grid sm:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
                <step.icon className="w-5 h-5 text-violet-400" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">{step.label}</p>
              <p className="text-xs text-white/40">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Capabilities Grid ───────────────────────────────────────────────────────
function CapabilitiesSection() {
  const capabilities = [
    { icon: Brain, title: "Multi-Model Intelligence", desc: "Triple-check pipeline across DeepSeek, Gemma, and Llama validates every score." },
    { icon: Layers, title: "Client-Ready Reports", desc: "Export shareable audits with full score breakdowns, category grades, and priority actions." },
    { icon: Target, title: "Competitive Benchmarking", desc: "Compare against direct competitors. Surface visibility gaps and quantify the delta." },
    { icon: BarChart3, title: "Re-Audit & Prove Movement", desc: "Run the same URL after implementing fixes. The trend system tracks score deltas." },
    { icon: Zap, title: "API & Automation", desc: "Integrate via REST API. Schedule audits, pull results, and trigger re-scans from CI/CD." },
    { icon: GitPullRequest, title: "Auto Score Fix Pipeline", desc: "Generate implementation PRs, track deployment, and re-audit to confirm improvement." },
  ];

  return (
    <section className="py-20 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/70 mb-3">
            Platform capabilities
          </p>
          <h2 className="text-3xl font-bold text-white">
            Built for agencies and teams
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 hover:border-white/[0.12] transition-colors"
            >
              <cap.icon className="w-5 h-5 text-cyan-400/70 mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1.5">{cap.title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{cap.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ Accordion ───────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "What does AiVIS actually audit?", a: "AiVIS audits whether ChatGPT, Perplexity, Google AI, and Claude can read, extract, trust, and cite your page. It scores six evidence-backed categories from your live URL and returns a 0–100 visibility score with prioritized, evidence-linked recommendations." },
  { q: "How is this different from a standard SEO audit?", a: "Standard SEO tools optimize for ranked pages and clicks. AiVIS measures whether AI systems can actually understand, trust, and cite your business when answers replace links. Every finding is tied to a specific crawled signal, not a generic checklist." },
  { q: "What is included in the free tier?", a: "Observer includes 5 audits per month with AI visibility scoring, keyword intelligence, schema markup auditing, heading & meta analysis, and core recommendations." },
  { q: "How does citation testing work?", a: "AiVIS runs live citation checks across multiple search engines in parallel. On Signal tier and above, you can create AI-generated query packs, schedule recurring tests, and track your niche ranking position over time." },
  { q: "Can I use AiVIS for client work?", a: "Yes. Alignment and Signal tiers include export-ready PDF and CSV reports, shareable public links, competitor benchmarking, and white-label options suitable for client deliverables." },
  { q: "How does Auto Score Fix work?", a: "Signal and Score Fix tiers can generate fix PRs from audit findings. AiVIS identifies the evidence-backed issue, produces the implementation code, and after deployment, re-audits to confirm the score improved." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left text-sm font-medium text-white/80 hover:text-white transition-colors"
      >
        <span>{q}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-white/50 leading-relaxed border-t border-white/[0.04]">
          {a}
        </div>
      )}
    </div>
  );
}

function FAQSection() {
  return (
    <section className="py-20 border-t border-white/[0.06]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/70 mb-3">
            FAQ
          </p>
          <h2 className="text-3xl font-bold text-white">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ─────────────────────────────────────────────────────────────────────
function CTASection() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <section className="py-20 border-t border-white/[0.06]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Ready to see your AI visibility score?
        </h2>
        <p className="text-white/50 mb-8 max-w-xl mx-auto">
          Run your first audit in under 60 seconds. No credit card required for
          the free tier.
        </p>
        <Link
          to={isAuthenticated ? "/app/analyze" : "/auth?mode=signup"}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-white font-semibold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
        >
          Start your audit
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Landing() {
  usePageMeta({
    title: "AiVIS — AI Visibility Audit for ChatGPT, Perplexity, Claude",
    description:
      "Measure whether AI can find and cite your site. One audit returns a 0-100 visibility score, six category grades, and evidence-backed fixes.",
  });

  return (
    <div className="min-h-screen">
      <HeroSection />
      <TrustStrip />
      <HowItWorksSection />
      <ScorePreviewSection />
      <AutoScoreFixSection />
      <CapabilitiesSection />
      <FAQSection />
      <CTASection />
    </div>
  );
}
