import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Target, Search, Zap, TrendingUp, RefreshCw, BarChart3,
  Users, Building2, Radar, Shield, Globe, Code2, Bot, Send, Clock,
  KeyRound, ArrowRight, CheckCircle2, Layers, FileText, ChevronDown,
  Compass, MessageSquare, Eye, GitPullRequest, Workflow,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildOrganizationRef, buildWebPageSchema } from "../lib/seoSchema";

/* ─── Workflow steps ─── */
const steps = [
  { icon: Target, title: "Define the business goal", text: "Pick one objective per cycle: citations, score lift, competitor gap closure, or client-proof reporting.", color: "cyan" },
  { icon: Search, title: "Run baseline audits", text: "Audit homepage, key service pages, and conversion pages before changing anything. Establish the measurable starting point.", color: "blue" },
  { icon: Zap, title: "Ship evidence-backed fixes", text: "Implement the highest-impact recommendations first - technical, schema, entity, or content authority fixes in focused 3–7 day sprints.", color: "amber" },
  { icon: RefreshCw, title: "Re-audit and measure deltas", text: "Re-scan the same URLs. Track score movement, category shifts, and recommendation burn-down after every sprint.", color: "emerald" },
  { icon: Radar, title: "Run competitor + citation loops", text: "Benchmark against competitors. Run citation tests across AI platforms. Feed unresolved gaps into the next sprint backlog.", color: "violet" },
  { icon: TrendingUp, title: "Scale and automate", text: "Schedule recurring rescans, wire webhooks for alerts, connect via API or MCP for programmatic access. Repeat the loop continuously.", color: "rose" },
];

const stepColors: Record<string, string> = {
  cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-400/25 text-cyan-400",
  blue: "from-blue-500/20 to-blue-500/5 border-blue-400/25 text-blue-400",
  amber: "from-amber-500/20 to-amber-500/5 border-amber-400/25 text-amber-400",
  emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-400/25 text-emerald-400",
  violet: "from-violet-500/20 to-violet-500/5 border-violet-400/25 text-violet-400",
  rose: "from-rose-500/20 to-rose-500/5 border-rose-400/25 text-rose-400",
};

/* ─── Platform tools ─── */
const platformTools = [
  { icon: Search, title: "AI Visibility Audits", desc: "Deep-scan any URL for crawlability, schema, entity markup, and AI-readiness across 50+ signals.", to: "/analyze", tier: "All tiers" },
  { icon: BarChart3, title: "Score Analytics", desc: "Track visibility score trends over time. Spot regressions, measure sprint impact, and export progress.", to: "/analytics", tier: "Alignment+" },
  { icon: Users, title: "Competitor Tracking", desc: "Track up to 3 competitors (Alignment), 8 (Signal), or 10 (Score Fix). Auto-detect gaps, run side-by-side comparisons, and find ranking opportunities.", to: "/competitors", tier: "Alignment+" },
  { icon: Globe, title: "Citation Testing", desc: "Test whether AI platforms cite your brand. Verify presence across ChatGPT, Perplexity, Claude, and Gemini queries via DuckDuckGo, Bing, and DDG Instant Answer.", to: "/citations", tier: "Signal+" },
  { icon: MessageSquare, title: "Brand Mention Tracking", desc: "Scan 9 free sources - Reddit, Hacker News, Mastodon, GitHub, Product Hunt, Quora, Google News, and search engine dorks - for live brand mentions.", to: "/citations", tier: "Alignment+" },
  { icon: FileText, title: "Reports & Exports", desc: "Generate shareable reports with public links. Export full audit data as JSON, PDF, or CSV for client delivery.", to: "/reports", tier: "Alignment+" },
  { icon: Radar, title: "Reverse Engineer Suite", desc: "4 tools: Decompile AI answers, Ghost-draft optimized content, Diff competing pages, and Simulate AI query responses.", to: "/reverse-engineer", tier: "Alignment+" },
  { icon: Compass, title: "Niche Discovery", desc: "Discover overlooked URLs in your niche that AI models reference. Schedule automatic discovery scans.", to: "/niche-discovery", tier: "Alignment+" },
  { icon: Eye, title: "Competitive Landscape", desc: "Visual market-level view of where you stand against all tracked competitors across AI visibility dimensions.", to: "/competitive-landscape", tier: "Alignment+" },
  { icon: Layers, title: "Keyword Intelligence", desc: "Discover which keywords and entities AI models associate with your content. Identify topical gaps.", to: "/keywords", tier: "All tiers" },
  { icon: Bot, title: "MCP Console", desc: "Connect AI coding agents directly to AiVIS. 12 tools available via Model Context Protocol for automated workflows.", to: "/mcp", tier: "Alignment+" },
  { icon: Shield, title: "Server & Indexing", desc: "Analyze HTTP headers, robots.txt, sitemap health, and AI crawler access for technical compliance.", to: "/server-headers", tier: "All tiers" },
];

/* ─── Integration capabilities ─── */
const integrations = [
  { icon: KeyRound, title: "API Keys", desc: "Programmatic access to audits, citations, competitor tracking, and scheduled rescans. Full REST API with scoped permissions.", to: "/api-docs" },
  { icon: Bot, title: "MCP Protocol", desc: "Connect AI coding agents directly to AiVIS. 12 tools available via Model Context Protocol for automated workflows.", to: "/mcp" },
  { icon: Send, title: "Webhooks", desc: "Push audit results to Slack, Discord, Zapier, Teams, Google Chat, Notion, or any custom endpoint. HMAC-signed payloads.", to: "/integrations" },
  { icon: Clock, title: "Scheduled Rescans", desc: "Automate recurring audits - daily, weekly, biweekly, or monthly. Get notified on score changes automatically.", to: "/settings" },
];

/* ─── Execution tracks ─── */
const executionTracks = [
  {
    icon: Building2,
    title: "Solo Founder / SMB",
    subtitle: "Improve your money pages this week",
    gradient: "from-cyan-500/15 to-blue-500/10",
    border: "border-cyan-400/20",
    badge: "bg-cyan-500/15 text-cyan-300",
    cadence: "Weekly rhythm",
    schedule: [
      { day: "Monday", action: "Run baseline audit on 1 core page" },
      { day: "Tuesday–Thursday", action: "Ship top 2–3 evidence-backed fixes" },
      { day: "Friday", action: "Re-audit same URL, measure delta" },
    ],
    tools: [
      { to: "/analyze", label: "Run Audit" },
      { to: "/analytics", label: "Score Trends" },
      { to: "/keywords", label: "Keywords" },
      { to: "/niche-discovery", label: "Niche Discovery" },
      { to: "/reports", label: "Export Report" },
    ],
    outcome: "Measurable score improvement every week with clear before/after evidence.",
  },
  {
    icon: Users,
    title: "Agency / Consultancy",
    subtitle: "Repeatable client delivery at scale",
    gradient: "from-violet-500/15 to-purple-500/10",
    border: "border-violet-400/20",
    badge: "bg-violet-500/15 text-violet-300",
    cadence: "Per-client sprint",
    schedule: [
      { day: "Week 1", action: "Baseline all key URLs + competitor benchmarks + brand mention scan" },
      { day: "Week 2–3", action: "Close top gaps, fix schema and entities, run reverse-engineer diff" },
      { day: "Week 4", action: "Re-audit, generate client report with deltas + citation test results" },
    ],
    tools: [
      { to: "/competitors", label: "Competitor Gaps" },
      { to: "/competitive-landscape", label: "Landscape" },
      { to: "/citations", label: "Citations & Mentions" },
      { to: "/reverse-engineer", label: "Reverse Engineer" },
      { to: "/reports", label: "Client Reports" },
      { to: "/integrations", label: "Webhook Alerts" },
    ],
    outcome: "Evidence-backed deliverables showing exactly what changed and why scores moved.",
  },
  {
    icon: TrendingUp,
    title: "Growth / SEO Team",
    subtitle: "Lift AI visibility quarter-over-quarter",
    gradient: "from-emerald-500/15 to-teal-500/10",
    border: "border-emerald-400/20",
    badge: "bg-emerald-500/15 text-emerald-300",
    cadence: "Monthly strategy + weekly execution",
    schedule: [
      { day: "Monthly", action: "Strategic audit of all priority pages + competitor landscape + niche discovery scan" },
      { day: "Weekly", action: "Mini-cycle: audit → reverse-engineer → ghost draft → re-audit on 2–3 URLs" },
      { day: "Continuous", action: "Scheduled rescans + webhook alerts + MCP-automated fix cycles" },
    ],
    tools: [
      { to: "/reverse-engineer", label: "Reverse Engineer" },
      { to: "/analytics", label: "Trend Analytics" },
      { to: "/mcp", label: "MCP Console" },
      { to: "/api-docs", label: "API Access" },
      { to: "/niche-discovery", label: "Niche Discovery" },
      { to: "/competitive-landscape", label: "Landscape" },
    ],
    outcome: "Programmatic monitoring with automated alerts. Quarter-over-quarter visibility growth.",
  },
];

/* ─── FAQ ─── */
const faqs = [
  { q: "How many pages can I audit per scan?", a: "Depends on your tier: Observer gets 3 pages/scan, Alignment gets 3, Signal gets 10, and Score Fix gets 10 pages per scan." },
  { q: "Can I connect AiVIS to my existing tools?", a: "Yes. Use the REST API with scoped API keys, wire webhooks to Slack/Discord/Zapier/Teams/Notion, or connect AI agents via MCP." },
  { q: "How do scheduled rescans work?", a: "Set a frequency (daily, weekly, biweekly, monthly) for any URL. AiVIS automatically re-audits and notifies you via webhook if the score changes." },
  { q: "What's the difference between competitor tracking and citation testing?", a: "Competitor tracking benchmarks your visibility score against other sites. Citation testing checks whether AI platforms like ChatGPT and Perplexity actually mention your brand in their answers." },
  { q: "What are the 4 Reverse Engineer tools?", a: "Decompile breaks down AI answers to see what content produced them. Ghost Draft generates AI-optimized content. Diff compares two pages side-by-side. Simulate runs hypothetical AI queries." },
  { q: "How does brand mention tracking work?", a: "AiVIS scans 9 free sources - Reddit, Hacker News, Mastodon, GitHub, Product Hunt, Quora, Google News, and search engine dorks - for live mentions of your brand. No API keys required." },
  { q: "What is MCP and how do I use it?", a: "Model Context Protocol lets AI coding agents (Cursor, Windsurf, etc.) connect directly to AiVIS. Your agent can trigger audits, read results, and fix issues programmatically using 12 available MCP tools." },
  { q: "Can other platforms do what AiVIS does?", a: "Most AI visibility tools only offer basic auditing or citation tracking. AiVIS uniquely combines multi-model AI pipelines, reverse engineering, brand mention scanning, niche discovery, MCP integration, and automated PR generation in one platform." },
];

/* ─── Animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" } }),
};

export default function PlatformWorkflowPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  usePageMeta({
    title: "Workflow - AI Visibility Operating System",
    description: "The end-to-end execution workflow for founders, agencies, and growth teams. Baseline, fix, re-audit, automate, and scale AI visibility.",
    path: "/workflow",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "@id": "https://aivis.biz/workflow#howto",
        name: "AiVIS Platform Workflow: Baseline to Scale",
        description: "Turn AiVIS from a one-off audit tool into a repeatable growth engine for founders, agencies, and growth teams.",
        url: "https://aivis.biz/workflow",
        publisher: buildOrganizationRef(),
        mainEntityOfPage: { "@id": "https://aivis.biz/workflow#webpage" },
        step: steps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.title,
          text: s.text,
        })),
      },
      buildWebPageSchema({
        path: "/workflow",
        name: "AiVIS Platform Workflow",
        description: "An evidence-first operating loop for AI visibility growth across audits, remediation, validation, and citation workflows.",
        mainEntityId: "https://aivis.biz/workflow#howto",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Workflow", path: "/workflow" },
      ]),
    ],
  });

  return (
    <div className="text-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-cyan-400 mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Platform Workflow
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5">
              The AI visibility<br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"> operating system</span>
            </h1>
            <p className="max-w-2xl mx-auto text-white/60 text-base sm:text-lg leading-relaxed">
              A repeatable, evidence-first workflow for founders, agencies, and growth teams.
              Baseline. Fix. Re-audit. Automate. Scale.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/app/analyze" className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm transition-colors">
              Start an Audit
            </Link>
            <Link to="/pricing" className="px-6 py-2.5 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors">
              View Plans
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── 6-Step Workflow Pipeline ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">The execution loop</h2>
            <p className="text-white/55 max-w-xl mx-auto">Six steps from baseline to continuous improvement. Run it weekly, per-client, or on autopilot.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const colors = stepColors[step.color];
              return (
                <motion.div
                  key={step.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeUp}
                  className={`relative rounded-2xl border bg-gradient-to-br ${colors} p-5 group hover:scale-[1.02] transition-transform duration-200`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Step {i + 1}</span>
                      <h3 className="text-sm font-semibold text-white mt-0.5 mb-1.5">{step.title}</h3>
                      <p className="text-xs text-white/55 leading-relaxed">{step.text}</p>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-white/15 z-10">
                      {(i + 1) % 3 !== 0 && <ArrowRight className="w-5 h-5" />}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
      </section>
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Every tool you need</h2>
            <p className="text-white/55 max-w-xl mx-auto">Not a single-trick auditor. A complete toolkit for AI visibility - from diagnostics to competitive intelligence.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platformTools.map((tool, i) => {
              const Icon = tool.icon;
              return (
                <motion.div
                  key={tool.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-30px" }}
                  variants={fadeUp}
                >
                  <Link
                    to={tool.to}
                    className="block h-full rounded-2xl border border-white/8 bg-[#222837] hover:bg-[#262c3d] p-5 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10 flex items-center justify-center mb-3 group-hover:from-cyan-500/25 group-hover:to-blue-500/15 transition-colors">
                      <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">{tool.title}</h3>
                    <p className="text-xs text-white/50 leading-relaxed mb-3">{tool.desc}</p>
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-medium">{tool.tier}</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Feature-Specific Workflow Chains ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Real workflow chains</h2>
            <p className="text-white/55 max-w-xl mx-auto">Proven multi-tool sequences for specific outcomes. Each chain uses actual platform tools in the order that produces the best results.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chain 1: Full Visibility Baseline */}
            <motion.div custom={0} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-30px" }} variants={fadeUp}
              className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Workflow className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Full Visibility Baseline</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 ml-auto">All tiers</span>
              </div>
              <p className="text-xs text-white/50 mb-4">Establish a measurable starting point before changing anything.</p>
              <div className="space-y-2">
                {[
                  { step: "Audit", tool: "AI Visibility Audit", path: "/analyze", desc: "Scan homepage + 2 key pages" },
                  { step: "Check", tool: "Server & Indexing", path: "/server-headers", desc: "Verify robots.txt, sitemaps, AI crawler access" },
                  { step: "Discover", tool: "Keyword Intelligence", path: "/keywords", desc: "Map current entity + keyword associations" },
                  { step: "Export", tool: "Reports", path: "/reports", desc: "Generate baseline report for before/after comparison" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={s.path} className="text-xs font-medium text-white/80 hover:text-white transition-colors">{s.tool}</Link>
                      <p className="text-[10px] text-white/40">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Chain 2: Competitive Gap Closure */}
            <motion.div custom={1} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-30px" }} variants={fadeUp}
              className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-purple-500/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Workflow className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Competitive Gap Closure</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 ml-auto">Alignment+</span>
              </div>
              <p className="text-xs text-white/50 mb-4">Identify exactly where competitors outperform you and close the gaps.</p>
              <div className="space-y-2">
                {[
                  { tool: "Competitor Tracking", path: "/competitors", desc: "Add up to 3–10 competitors, run comparison" },
                  { tool: "Competitive Landscape", path: "/competitive-landscape", desc: "Visualize market-level gaps across AI dimensions" },
                  { tool: "Reverse Engineer → Decompile", path: "/reverse-engineer", desc: "Decompile why a competitor's page ranks in AI answers" },
                  { tool: "Reverse Engineer → Diff", path: "/reverse-engineer", desc: "Side-by-side diff your page vs competitor" },
                  { tool: "Re-audit", path: "/analyze", desc: "Rescan after shipping fixes; measure delta" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-violet-500/15 text-violet-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={s.path} className="text-xs font-medium text-white/80 hover:text-white transition-colors">{s.tool}</Link>
                      <p className="text-[10px] text-white/40">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Chain 3: AI Citation Presence */}
            <motion.div custom={2} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-30px" }} variants={fadeUp}
              className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Workflow className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">AI Citation Presence</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 ml-auto">Signal+</span>
              </div>
              <p className="text-xs text-white/50 mb-4">Verify and improve whether AI platforms actually cite your brand in their answers.</p>
              <div className="space-y-2">
                {[
                  { tool: "Citation Testing", path: "/citations", desc: "Test brand presence across DuckDuckGo, Bing, DDG Instant Answer" },
                  { tool: "Brand Mention Tracking", path: "/citations", desc: "Scan Reddit, HN, Mastodon, GitHub, Product Hunt + more" },
                  { tool: "Reverse Engineer → Simulate", path: "/reverse-engineer", desc: "Simulate AI queries to see if your content surfaces" },
                  { tool: "Niche Discovery", path: "/niche-discovery", desc: "Find overlooked URLs in your niche that AI models reference" },
                  { tool: "Re-audit + Analytics", path: "/analytics", desc: "Track citation improvement over time" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={s.path} className="text-xs font-medium text-white/80 hover:text-white transition-colors">{s.tool}</Link>
                      <p className="text-[10px] text-white/40">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Chain 4: Reverse Engineer Deep Dive */}
            <motion.div custom={3} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-30px" }} variants={fadeUp}
              className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Workflow className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Reverse Engineer Deep Dive</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 ml-auto">Alignment+</span>
              </div>
              <p className="text-xs text-white/50 mb-4">Understand exactly why competitors appear in AI answers and build content that competes.</p>
              <div className="space-y-2">
                {[
                  { tool: "Decompile", path: "/reverse-engineer", desc: "Break down a competitor's AI answer to see what content produced it" },
                  { tool: "Ghost Draft", path: "/reverse-engineer", desc: "Generate AI-optimized content using reverse-engineered structure" },
                  { tool: "Diff", path: "/reverse-engineer", desc: "Compare your page structure vs the ghost draft output" },
                  { tool: "Simulate", path: "/reverse-engineer", desc: "Run simulated AI queries to validate the new content approach" },
                  { tool: "Audit", path: "/analyze", desc: "Rescan to confirm score improvement from content changes" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={s.path} className="text-xs font-medium text-white/80 hover:text-white transition-colors">{s.tool}</Link>
                      <p className="text-[10px] text-white/40">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Chain 5: MCP Automation Pipeline */}
            <motion.div custom={4} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-30px" }} variants={fadeUp}
              className="rounded-2xl border border-rose-400/20 bg-gradient-to-br from-rose-500/10 to-pink-500/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Workflow className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">MCP Automation Pipeline</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 ml-auto">Alignment+</span>
              </div>
              <p className="text-xs text-white/50 mb-4">Wire AI coding agents into AiVIS for fully automated audit-and-fix cycles.</p>
              <div className="space-y-2">
                {[
                  { tool: "MCP Console", path: "/mcp", desc: "Connect your AI agent (Cursor, Windsurf, etc.) via MCP protocol" },
                  { tool: "API Key Setup", path: "/api-docs", desc: "Generate scoped API keys for programmatic audit triggers" },
                  { tool: "Scheduled Rescans", path: "/settings", desc: "Set daily/weekly auto-rescans on priority URLs" },
                  { tool: "Webhooks", path: "/integrations", desc: "Push audit results to Slack, Discord, Teams, or custom endpoint" },
                  { tool: "Score Fix AutoPR", path: "/analyze", desc: "Score Fix tier: auto-generate GitHub PRs to fix issues" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-rose-500/15 text-rose-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={s.path} className="text-xs font-medium text-white/80 hover:text-white transition-colors">{s.tool}</Link>
                      <p className="text-[10px] text-white/40">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Chain 6: Brand Authority Build */}
            <motion.div custom={5} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-30px" }} variants={fadeUp}
              className="rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Workflow className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Brand Authority Build</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 ml-auto">Signal+</span>
              </div>
              <p className="text-xs text-white/50 mb-4">Build a complete picture of your brand's authority across AI platforms, web mentions, and entity associations.</p>
              <div className="space-y-2">
                {[
                  { tool: "Brand Mention Tracking", path: "/citations", desc: "Scan 15 sources for existing brand mentions" },
                  { tool: "Citation Testing", path: "/citations", desc: "Verify AI platforms cite your brand" },
                  { tool: "Keyword Intelligence", path: "/keywords", desc: "Map entity associations AI models hold about you" },
                  { tool: "Niche Discovery", path: "/niche-discovery", desc: "Find niche URLs AI references - join that conversation" },
                  { tool: "Score Analytics", path: "/analytics", desc: "Track authority growth over time" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-blue-500/15 text-blue-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={s.path} className="text-xs font-medium text-white/80 hover:text-white transition-colors">{s.tool}</Link>
                      <p className="text-[10px] text-white/40">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Execution Tracks ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Built for how you work</h2>
            <p className="text-white/55 max-w-xl mx-auto">Whether you're a solo founder, an agency running 20 clients, or a growth team - there's a workflow for you.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {executionTracks.map((track, i) => {
              const Icon = track.icon;
              return (
                <motion.div
                  key={track.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-30px" }}
                  variants={fadeUp}
                  className={`rounded-2xl border ${track.border} bg-gradient-to-br ${track.gradient} p-6 flex flex-col`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-white/70" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{track.title}</h3>
                      <p className="text-xs text-white/50">{track.subtitle}</p>
                    </div>
                  </div>
                  <span className={`inline-block self-start text-[10px] px-2.5 py-0.5 rounded-full ${track.badge} font-medium mb-4`}>
                    {track.cadence}
                  </span>

                  <div className="space-y-2.5 mb-5 flex-1">
                    {track.schedule.map((s) => (
                      <div key={s.day} className="flex gap-2.5">
                        <span className="flex-shrink-0 w-24 text-[10px] font-medium text-white/40 uppercase tracking-wide pt-0.5">{s.day}</span>
                        <span className="text-xs text-white/65 leading-relaxed">{s.action}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-white/8">
                    <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2.5">Tools you'll use</p>
                    <div className="flex flex-wrap gap-1.5">
                      {track.tools.map((t) => (
                        <Link
                          key={`${track.title}-${t.to}`}
                          to={t.to}
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-white/10 text-white/65 hover:text-white hover:border-white/25 transition-colors"
                        >
                          {t.label}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-white/[0.03]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-white/55 leading-relaxed">{track.outcome}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Integration & Automation ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Automate everything</h2>
            <p className="text-white/55 max-w-lg mx-auto">Connect AiVIS to your stack. Trigger audits programmatically, pipe results to dashboards, and get alerted on regressions.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {integrations.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-30px" }}
                  variants={fadeUp}
                >
                  <Link
                    to={item.to}
                    className="flex items-start gap-4 rounded-2xl border border-white/8 bg-[#222837] hover:bg-[#262c3d] p-5 transition-colors group h-full"
                  >
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 flex items-center justify-center group-hover:from-violet-500/25 group-hover:to-purple-500/15 transition-colors">
                      <Icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        {item.title}
                        <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
                      </h3>
                      <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Webhook providers row */}
          <div className="mt-8 text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3">Sends data to</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {["Slack", "Discord", "Zapier", "Microsoft Teams", "Google Chat", "Notion", "Custom Webhook"].map((name) => (
                <span key={name} className="text-[11px] px-3 py-1.5 rounded-lg border border-white/8 bg-white/[0.03] text-white/45">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold text-center mb-8">Common questions</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-[#222837] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm font-medium text-white/80">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="px-5 pb-4 text-xs text-white/50 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to start the loop?</h2>
            <p className="text-white/55 text-sm mb-6 max-w-md mx-auto">
              Run your first baseline audit free. See exactly what to fix, then measure the difference.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/app/analyze" className="px-7 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm transition-colors">
                Run Free Audit
              </Link>
              <Link to="/guide" className="px-7 py-2.5 rounded-xl border border-white/15 text-white/70 hover:text-white text-sm transition-colors">
                Read the Guide
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
