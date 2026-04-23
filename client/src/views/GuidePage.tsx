import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileSearch,
  FlaskConical,
  Hammer,
  Link2,
  Loader2,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildBreadcrumbSchema } from '../lib/seoSchema';
import { useLiveFindings } from '../hooks/useLiveFindings';
import GuideScanFlow from '../components/guide/GuideScanFlow';
import GuideExecutionChecklist from '../components/guide/GuideExecutionChecklist';
import type { GuideChecklistItem, GuideFlowStage } from '../components/guide/guideTypes';

const GUIDE_SECTIONS = [
  { id: 'system-definition', label: 'What This Is' },
  { id: 'start-here', label: 'Start Here' },
  { id: 'execution-checklist', label: 'Checklist' },
  { id: 'baseline-setup', label: 'Baseline Setup' },
  { id: 'run-first-audit', label: 'Run First Audit' },
  { id: 'read-results-correctly', label: 'Read Results' },
  { id: 'execute-fixes', label: 'Execute Fixes' },
  { id: 'retest-and-prove', label: 'Retest + Proof' },
  { id: 'tool-routing', label: 'Full Tool Map' },
  { id: 'vector-retrieval-system', label: 'Vector + Retrieval' },
  { id: 'living-loop-entity-os', label: 'Living Loop' },
  { id: 'monetization-architecture', label: 'Monetization' },
  { id: 'free-tools', label: 'Free Tools' },
  { id: 'battle-tested-rules', label: 'Battle-Tested Rules' },
  { id: 'common-failures', label: 'Common Failures' },
  { id: 'operating-cadence', label: 'Operating Cadence' },
  { id: 'integration-workflows', label: 'Integrations' },
  { id: 'dofollow-badge', label: 'Dofollow Badge' },
  { id: 'by-symptom', label: 'By Symptom' },
  { id: 'live-findings', label: 'Live Findings' },
  { id: 'deep-dive-reading', label: 'Deep-Dive Reading' },
] as const;

const HOW_TO_STEPS = [
  {
    name: 'Select one target URL',
    text: 'Start with one money page or one high-value service page. Do not audit five pages first.',
  },
  {
    name: 'Run baseline audit',
    text: 'Capture score, category grades, and recommendation list before editing any content.',
  },
  {
    name: 'Ship 3 highest-impact fixes',
    text: 'Prioritize structural and trust fixes over cosmetic edits for first pass.',
  },
  {
    name: 'Re-audit same URL',
    text: 'Use the same URL and compare result deltas instead of changing targets mid-cycle.',
  },
  {
    name: 'Document proof in Reports',
    text: 'Export report snapshots and keep a timestamped before/after trail.',
  },
  {
    name: 'Scale to adjacent pages',
    text: 'After one page improves, apply the same pattern to 2–3 related pages.',
  },
];

const GUIDE_FLOW_STAGES: GuideFlowStage[] = [
  {
    id: 'flow-start',
    title: 'Define one high-value URL',
    summary: 'Pick one revenue page and keep the target stable for your first full cycle.',
    eta: '2 min',
    anchorId: 'baseline-setup',
    ctaLabel: 'Baseline setup',
    ctaTo: '/app/analyze',
  },
  {
    id: 'flow-audit',
    title: 'Run baseline audit',
    summary: 'Capture score, grades, and evidence before any edits so your delta is provable.',
    eta: '30-60 sec',
    anchorId: 'run-first-audit',
    ctaLabel: 'Run first audit',
    ctaTo: '/app/analyze',
  },
  {
    id: 'flow-read',
    title: 'Read output by signal class',
    summary: 'Prioritize trust and extraction blockers before low-impact formatting tweaks.',
    eta: '8 min',
    anchorId: 'read-results-correctly',
    ctaLabel: 'Read results',
  },
  {
    id: 'flow-fix',
    title: 'Ship top 3 fixes',
    summary: 'Execute structure, extractability, and trust passes in that order.',
    eta: '2-3 days',
    anchorId: 'execute-fixes',
    ctaLabel: 'Execute fixes',
    ctaTo: '/app/score-fix',
  },
  {
    id: 'flow-verify',
    title: 'Re-audit same URL',
    summary: 'Re-run the exact page and compare score plus category movement.',
    eta: '30-60 sec',
    anchorId: 'retest-and-prove',
    ctaLabel: 'Retest + proof',
    ctaTo: '/app/reports',
  },
  {
    id: 'flow-scale',
    title: 'Scale proven pattern',
    summary: 'Apply the winning fix package to adjacent pages and keep weekly cadence.',
    eta: 'Weekly',
    anchorId: 'operating-cadence',
    ctaLabel: 'Operating cadence',
  },
];

const GUIDE_CHECKLIST_ITEMS: GuideChecklistItem[] = [
  {
    id: 'check-url',
    title: 'Select one target URL',
    detail: 'Start with one money page or one service page and keep that URL fixed for cycle one.',
    eta: '2 min',
    priority: 'high',
    anchorId: 'baseline-setup',
    actionLabel: 'Open Analyze',
    actionTo: '/app/analyze',
  },
  {
    id: 'check-baseline',
    title: 'Run baseline audit',
    detail: 'Save score, category grades, and recommendation set before touching content.',
    eta: '30-60 sec',
    priority: 'critical',
    anchorId: 'run-first-audit',
    actionLabel: 'Run Audit',
    actionTo: '/app/analyze',
  },
  {
    id: 'check-fixes',
    title: 'Ship 3 highest-impact fixes',
    detail:
      'Prioritize structure, extractability, and trust fixes over cosmetic content edits in pass one.',
    eta: '2-3 days',
    priority: 'critical',
    anchorId: 'execute-fixes',
    actionLabel: 'Open Score Fix',
    actionTo: '/app/score-fix',
  },
  {
    id: 'check-retest',
    title: 'Re-audit same URL',
    detail: 'Measure score and category deltas on the exact same URL to prove causality.',
    eta: '30-60 sec',
    priority: 'high',
    anchorId: 'retest-and-prove',
    actionLabel: 'Open Reports',
    actionTo: '/app/reports',
  },
  {
    id: 'check-proof',
    title: 'Document before/after proof',
    detail: 'Export and store report snapshots with timestamps for repeatable evidence.',
    eta: '10 min',
    priority: 'medium',
    anchorId: 'retest-and-prove',
    actionLabel: 'Open Reports',
    actionTo: '/app/reports',
  },
  {
    id: 'check-scale',
    title: 'Scale to adjacent pages',
    detail: 'Apply the same fix package to 2-3 related URLs in your next weekly cycle.',
    eta: '1 week',
    priority: 'medium',
    anchorId: 'operating-cadence',
  },
];

// ── Internal link map: guide step → related blog posts / pages ──────────────
const DEEP_DIVE_LINKS: {
  step: string;
  items: { label: string; to: string; type: 'blog' | 'app' | 'page' }[];
}[] = [
  {
    step: 'Understand why AI skips sites',
    items: [
      {
        label: "Why AI doesn't cite websites",
        to: '/blogs/why-ai-doesnt-cite-websites',
        type: 'blog',
      },
      {
        label: 'AEO 2026: citation readiness',
        to: '/blogs/answer-engine-optimization-2026-why-citation-readiness-matters',
        type: 'blog',
      },
      {
        label: 'Zero-trust visibility principle',
        to: '/blogs/zero-trust-ai-visibility-never-assume-ai-engines-can-find-cite-your-site',
        type: 'blog',
      },
    ],
  },
  {
    step: 'Run your first audit',
    items: [
      {
        label: 'How LLMs parse your content',
        to: '/blogs/how-llms-parse-your-content-technical-breakdown',
        type: 'blog',
      },
      {
        label: 'SSFR scoring engine explained',
        to: '/blogs/ssfr-evidence-framework-the-scoring-engine-behind-aivis',
        type: 'blog',
      },
      {
        label: 'Free tools without an account',
        to: '/blogs/free-tools-schema-validator-robots-checker-content-extractability',
        type: 'blog',
      },
    ],
  },
  {
    step: 'Read and interpret results',
    items: [
      {
        label: 'AiVIS.biz full technical breakdown',
        to: '/blogs/how-aivis-works-under-the-hood-full-technical-breakdown',
        type: 'blog',
      },
      {
        label: 'Why AI visibility tools differ from SEO',
        to: '/blogs/ai-visibility-tools-2026-what-semrush-ahrefs-moz-cant-measure',
        type: 'blog',
      },
      { label: 'Analytics dashboard', to: '/app/analytics', type: 'app' },
    ],
  },
  {
    step: 'Execute fixes (structure → extractability → trust)',
    items: [
      {
        label: 'How to get cited by ChatGPT, Perplexity, Gemini',
        to: '/blogs/how-to-get-cited-by-chatgpt-perplexity-gemini-ai-citation-guide',
        type: 'blog',
      },
      {
        label: 'Score Fix AutoPR — AI-opened pull requests',
        to: '/blogs/score-fix-autopr-how-ai-opens-pull-requests-to-fix-your-visibility',
        type: 'blog',
      },
      { label: 'Open Score Fix tool', to: '/app/score-fix', type: 'app' },
    ],
  },
  {
    step: 'Retest and prove improvement',
    items: [
      {
        label: '7-step roadmap: audit → live citations in 30 days',
        to: '/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days',
        type: 'blog',
      },
      {
        label: 'Scheduled rescans + autopilot monitoring',
        to: '/blogs/scheduled-rescans-and-autopilot-monitoring-set-it-and-track-it',
        type: 'blog',
      },
      { label: 'Open Reports', to: '/app/reports', type: 'app' },
    ],
  },
  {
    step: 'Avoid common failure patterns',
    items: [
      {
        label: 'Your site ranks but still disappears',
        to: '/blogs/your-website-can-rank-and-still-disappear',
        type: 'blog',
      },
      {
        label: 'Not competing for clicks anymore',
        to: '/blogs/your-website-is-not-competing-for-clicks-anymore',
        type: 'blog',
      },
      {
        label: 'From invisible to cited — case study',
        to: '/blogs/from-invisible-to-cited-case-study-brand-citation-growth',
        type: 'blog',
      },
    ],
  },
  {
    step: 'Set up integrations and automation',
    items: [
      {
        label: 'MCP audit workflows for dev teams',
        to: '/blogs/how-mcp-audit-workflows-change-everything-for-dev-teams',
        type: 'blog',
      },
      {
        label: 'AiVIS.biz API access explained',
        to: '/blogs/aivis-api-access-explained-build-on-the-visibility-layer',
        type: 'blog',
      },
      {
        label: 'WebMCP: browser agent surface',
        to: '/blogs/webmcp-third-party-tool-calling-aivis-the-headless-audit-engine',
        type: 'blog',
      },
    ],
  },
  {
    step: 'Track brand visibility and citations',
    items: [
      {
        label: 'Citation testing explained',
        to: '/blogs/citation-testing-explained-how-to-verify-ai-models-can-find-you',
        type: 'blog',
      },
      {
        label: 'Competitor tracking — find structural gaps',
        to: '/blogs/competitor-tracking-find-the-structural-gaps-and-win',
        type: 'blog',
      },
      {
        label: 'Brand mention tracking',
        to: '/blogs/brand-mention-tracking-where-ai-discovers-new-sources',
        type: 'blog',
      },
    ],
  },
];

const MONETIZATION_MODELS = [
  {
    model: 'Current: managed Score Fix subscription',
    target: 'Continuous semantic operations and remediation',
    pricing: '$299/month',
    economics: 'Recurring MRR, stronger retention signals, and predictable delivery cadence.',
    operatingShape: 'Best when paired with weekly self-healing runs and monthly proof packets.',
  },
  {
    model: 'Proposal: managed Score Fix subscription',
    target: 'One-client operator lane (hands-on managed service)',
    pricing: '$299 per month per managed client',
    economics: 'Recurring MRR, better forecastability, stronger retention incentives.',
    operatingShape: 'Best when paired with weekly self-healing runs and monthly proof packets.',
  },
  {
    model: 'Hybrid: setup + recurring',
    target: 'Higher-complexity accounts needing initial clean-up',
    pricing: '$299 setup + $149–$299 monthly',
    economics: 'Captures heavy onboarding work while preserving MRR.',
    operatingShape: 'Good for agencies managing multiple domains and staged rollout plans.',
  },
] as const;

const PLATFORM_MONETIZATION_LEVERS = [
  'Managed Entity OS retainers (semantic boundary enforcement + monthly collision suppression)',
  'API / MCP usage packs for teams automating audits in CI and agent workflows',
  'Proof-as-a-Service exports: monthly C-suite packet with before/after deltas and evidence chain',
  'Competitor intelligence subscriptions with recurring opportunity backlog generation',
  'ScoreFix operation lanes: advisory, assisted, autonomous, each with distinct SLAs and margins',
];

export default function GuidePage() {
  const { findings, loading: findingsLoading } = useLiveFindings();
  usePageMeta({
    title: 'Guide',
    fullTitle: 'AiVIS.biz Guide - AI Visibility Execution Playbook',
    description:
      'Practical tutorial for running AI visibility audits, interpreting results, applying fixes, and proving measurable improvements.',
    path: '/guide',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'AiVIS.biz AI Visibility Execution Guide',
        description:
          'Step-by-step process to audit, remediate, and validate AI visibility improvements.',
        url: 'https://aivis.biz/guide',
        step: HOW_TO_STEPS.map((step, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: step.name,
          text: step.text,
        })),
      },
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Guide', path: '/guide' },
      ]),
    ],
  });

  return (
    <div className="text-white">
      <div className="w-full xl:pl-64">
        <aside className="fixed left-8 top-28 hidden w-52 space-y-2 xl:block">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/35">
            Guide Navigation
          </p>
          {GUIDE_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="block rounded-lg border border-white/10 bg-charcoal/30 px-3 py-2 text-xs text-white/65 transition-colors hover:border-white/20 hover:text-white"
            >
              {section.label}
            </a>
          ))}
        </aside>

        <GuideScanFlow stages={GUIDE_FLOW_STAGES} />

        {/* ── System Definition ── */}
        <section
          id="system-definition"
          className="section-anchor mb-6 rounded-2xl border border-orange-400/20 bg-orange-500/5 p-6 sm:p-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-orange-300 mb-4">
            <Target className="h-3.5 w-3.5" />
            Read this first
          </div>
          <h2 className="text-2xl brand-title">What this system actually is</h2>
          <p className="mt-3 text-sm leading-7 text-white/75 max-w-3xl">
            AiVIS is a <strong className="text-white">citation intelligence engine</strong>. It
            measures whether AI systems — ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews —
            are currently capable of finding, extracting, and citing your content when generating
            answers.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-2">
                This system is NOT
              </div>
              <ul className="space-y-1.5 text-xs text-white/65 list-disc pl-3">
                <li>An SEO or keyword ranking tool</li>
                <li>A traffic or analytics dashboard</li>
                <li>A Google Signals tracker</li>
                <li>A social media reporting tool</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">
                This system IS
              </div>
              <ul className="space-y-1.5 text-xs text-white/65 list-disc pl-3">
                <li>A citation presence detector</li>
                <li>An absence causality engine</li>
                <li>A structured action generator</li>
                <li>A citation truth ledger</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-2">
                The output is
              </div>
              <ul className="space-y-1.5 text-xs text-white/65 list-disc pl-3">
                <li>Your citation state map</li>
                <li>Absence causes with evidence</li>
                <li>Action graph tied to each gap</li>
                <li>Verifiable before/after proof</li>
              </ul>
            </div>
          </div>

          <h3 className="mt-6 text-sm font-bold uppercase tracking-widest text-white/50">
            Core Concepts
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                term: 'Entity',
                def: 'A website, brand, product, person, or concept that AI systems can recognise and attribute content to. Entity strength determines attribution reliability.',
              },
              {
                term: 'Citation',
                def: 'When an AI system references, quotes, or attributes content to your entity in a generated answer. The goal this system is designed to increase.',
              },
              {
                term: 'Visibility (Citation Probability)',
                def: 'The likelihood that an AI answer system includes your content for relevant queries. Not traffic, not rankings — the probability of AI inclusion.',
              },
              {
                term: 'Citation Ledger',
                def: 'The append-only truth store: every verified citation event recorded with which AI system, which query, what position, and when. All scores trace to ledger entries.',
              },
              {
                term: 'Citation Gap',
                def: 'Queries where a competitor appears in AI answers but you do not. Identified by probing AI systems directly — not inferred from rankings.',
              },
              {
                term: 'Action Graph',
                def: 'The structured remediation output. For each diagnosed gap: what is absent, why it is absent, what to build, and the expected citation impact.',
              },
            ].map((item) => (
              <div
                key={item.term}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-3"
              >
                <div className="text-xs font-bold text-orange-300 mb-1">{item.term}</div>
                <p className="text-xs text-white/65 leading-relaxed">{item.def}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-6 text-sm font-bold uppercase tracking-widest text-white/50">
            How a scan works — 8 stages
          </h3>
          <ol className="mt-3 space-y-2">
            {[
              ['Input', 'URL + optional entity seed submitted for analysis'],
              [
                'Extraction',
                'Puppeteer scrapes page; structured entity graph built from content signals',
              ],
              [
                'Query Generation',
                'AI expands intent, comparative, and answer-engine-style queries for your entity',
              ],
              [
                'Citation Testing',
                'Multi-engine parallel verification — DDG, Bing, and AI models probed simultaneously',
              ],
              [
                'Ledger Recording',
                'All citation events committed to the immutable citation ledger with scan_id',
              ],
              [
                'Gap Analysis',
                'Absent queries diagnosed for causal reason: access block, schema gap, entity failure, content gap',
              ],
              [
                'Action Graph Generation',
                'Structured plan produced: what to fix, why, expected citation impact per action',
              ],
              [
                'Outcome',
                'Citation state map + absence map + causal breakdown + verifiable action path',
              ],
            ].map(([stage, detail], i) => (
              <li
                key={stage}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3"
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-300 text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <span className="text-xs font-semibold text-white/85">{stage}: </span>
                  <span className="text-xs text-white/60">{detail}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <header
          id="start-here"
          className="section-anchor mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <img
              src="/aivis-logo.png"
              alt="AiVIS.biz"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-lg object-contain"
              loading="lazy"
            />
            <span className="text-base font-bold text-white tracking-tight">AiVIS.biz</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
            <FlaskConical className="h-3.5 w-3.5 text-orange-300" />
            Execution Guide
          </div>
          <h1 className="mt-4 text-3xl brand-title sm:text-4xl">
            AI Visibility Guide: no fluff, just execution
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-white/70">
            This page is your operator manual for AiVIS.biz. It focuses on what to do, in what
            order, and what evidence to keep so visibility improvements are real and repeatable.
          </p>
          <div className="mt-5 rounded-xl border border-white/10 bg-charcoal-deep/40 overflow-hidden">
            <img
              src="/scan-data.png"
              alt="AiVIS.biz scan data visualization showing audit evidence extraction flow"
              className="w-full h-auto max-h-56 object-cover object-center opacity-80"
              loading="lazy"
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-xs text-white/70">
              <div className="text-white/45 uppercase tracking-wide mb-1">Objective</div>
              Increase inclusion in AI answers for pages that drive revenue.
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-xs text-white/70">
              <div className="text-white/45 uppercase tracking-wide mb-1">Proof Standard</div>
              Before/after reports, unchanged URL, and visible recommendation closure.
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-xs text-white/70">
              <div className="text-white/45 uppercase tracking-wide mb-1">Cadence</div>
              Weekly cycles outperform random one-off audits.
            </div>
          </div>
        </header>

        <GuideExecutionChecklist items={GUIDE_CHECKLIST_ITEMS} />

        <section
          id="baseline-setup"
          className="section-anchor section-accent-cyan mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">1) Baseline setup before you touch content</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/75 list-disc pl-5">
            <li>
              Choose one target URL with business value (service page, product page, or conversion
              page).
            </li>
            <li>Keep the URL stable during the first cycle so score changes are attributable.</li>
            <li>
              Write one success metric: score lift, category grade lift, or citation visibility
              lift.
            </li>
            <li>
              Open these pages in advance: Analyze, Reports, and optionally Competitors, Citations,
              or Niche Discovery.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/app/analyze"
              className="btn-cta-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              <Target className="h-3.5 w-3.5" /> Open Analyze
            </Link>
            <Link
              to="/app/reports"
              className="btn-cta-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              <FileSearch className="h-3.5 w-3.5" /> Open Reports
            </Link>
          </div>
        </section>

        <section
          id="run-first-audit"
          className="section-anchor section-accent-amber mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">2) Run your first audit the right way</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">Do this</h3>
              <ul className="mt-2 space-y-2 text-xs text-white/70 list-disc pl-4">
                <li>Run one baseline scan and save the report immediately.</li>
                <li>Capture top 3 blockers from Priority Actions, not every low-impact item.</li>
                <li>
                  Check evidence fields before acting: headings, schema count, response signals,
                  trust gaps.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">Avoid this</h3>
              <ul className="mt-2 space-y-2 text-xs text-white/70 list-disc pl-4">
                <li>Changing URL target and expecting meaningful trend comparison.</li>
                <li>
                  Jumping straight to rewrites without reviewing evidence and grade categories.
                </li>
                <li>Measuring success with one score number only.</li>
              </ul>
            </div>
          </div>
        </section>

        <section
          id="read-results-correctly"
          className="section-anchor section-accent-emerald mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">3) Read results like an operator, not a spectator</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-xs text-white/75">
              <thead className="bg-charcoal-deep text-white/65 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Signal</th>
                  <th className="px-4 py-3">What it means</th>
                  <th className="px-4 py-3">What to do next</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3">Low visibility score + weak trust</td>
                  <td className="px-4 py-3">
                    AI may parse content but not trust it enough to cite.
                  </td>
                  <td className="px-4 py-3">
                    Add proof signals, citations, and clearer source attribution blocks.
                  </td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3">Good structure + weak extraction</td>
                  <td className="px-4 py-3">
                    Layout exists, but answers are not explicit enough for retrieval.
                  </td>
                  <td className="px-4 py-3">Add direct answer blocks under key H2/H3 sections.</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3">Strong score + unstable trend</td>
                  <td className="px-4 py-3">
                    Recent changes are inconsistent or deployment cadence is noisy.
                  </td>
                  <td className="px-4 py-3">
                    Lock weekly cadence and compare same-page scans only.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section
          id="execute-fixes"
          className="section-anchor section-accent-orange mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">4) Execute fixes in impact order</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {[
              {
                title: 'Pass A: Structure',
                icon: Link2,
                points: [
                  'One intent per section',
                  'Clean heading hierarchy',
                  'Explicit internal links to supporting pages',
                ],
              },
              {
                title: 'Pass B: Extractability',
                icon: Radar,
                points: [
                  'Direct question/answer blocks',
                  'Entity-consistent language',
                  'Schema aligned with visible content',
                ],
              },
              {
                title: 'Pass C: Trust + Proof',
                icon: ShieldCheck,
                points: [
                  'Author/source context',
                  'Claims tied to evidence',
                  'Remove unverifiable statements',
                ],
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-4"
              >
                <div className="flex items-center gap-2 text-white/90">
                  <item.icon className="h-4 w-4 text-orange-300" />
                  <h3 className="text-sm brand-title-muted">{item.title}</h3>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/app/score-fix"
              className="btn-cta-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              <Hammer className="h-3.5 w-3.5" /> Open Score Fix
            </Link>
            <Link
              to="/app/pipeline"
              className="btn-cta-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Self-Healing Pipeline
            </Link>
            <Link
              to="/app/reverse-engineer"
              className="btn-cta-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              <FlaskConical className="h-3.5 w-3.5" /> Reverse Engineer Answers
            </Link>
          </div>
        </section>

        <section
          id="retest-and-prove"
          className="section-anchor section-accent-violet mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">5) Retest and prove the change</h2>
          <ol className="mt-4 space-y-2 text-sm text-white/75 list-decimal pl-5">
            <li>Re-run the exact same URL after shipping fixes.</li>
            <li>Compare score and category-grade movement, not score only.</li>
            <li>Save the new report and export both snapshots.</li>
            <li>Log what changed on-page so future cycles can repeat the winning pattern.</li>
          </ol>
          <p className="mt-3 text-xs text-white/60">
            If there is no movement, review whether the edits touched extraction-critical zones
            (answer blocks, structure, schema alignment, trust signals) instead of cosmetic text.
          </p>
          <p className="mt-2 text-xs text-white/60">
            <strong className="text-white/80">Self-Healing Pipeline users:</strong> Trigger a rescan
            from your pipeline run detail page. The system re-scrapes, re-scores, and produces an
            uplift proof with per-category deltas — no manual comparison needed.
          </p>
        </section>

        <section
          id="tool-routing"
          className="section-anchor section-accent-rose mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">6) Full tool map: every page and when to use it</h2>

          <h3 className="mt-5 text-sm font-bold uppercase tracking-widest text-blue-300/80">
            Core
          </h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                {
                  to: '/app/analyze',
                  title: 'Analyze',
                  detail: 'Run baseline and post-fix audits on any URL.',
                },
                {
                  to: '/app/reports',
                  title: 'Reports',
                  detail: 'Export, compare, and share timestamped audit snapshots.',
                },
                {
                  to: '/app/score-fix',
                  title: 'Score Fix',
                  detail: 'Auto-generate GitHub PRs with evidence-linked code changes.',
                  tier: 'Signal',
                },
                {
                  to: '/app/pipeline',
                  title: 'Pipeline',
                  detail: 'Self-healing scan → diagnose → fix → verify → score-uplift workflow.',
                  tier: 'Alignment',
                },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-4 transition-colors hover:border-white/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm brand-title-muted">{item.title}</h3>
                  {'tier' in item && (
                    <span className="text-[10px] uppercase tracking-wider text-white/35">
                      {item.tier}+
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-white/60" />
                </div>
                <p className="mt-1 text-xs text-white/70">{item.detail}</p>
              </Link>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-bold uppercase tracking-widest text-violet-300/80">
            Evidence &amp; Intelligence
          </h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                {
                  to: '/app/analytics',
                  title: 'Analytics',
                  detail: 'Track score trends, category movement, and deltas over time.',
                },
                {
                  to: '/app/citations',
                  title: 'Citations',
                  detail: 'Test mention and source visibility across search/AI engines.',
                  tier: 'Alignment',
                },
                {
                  to: '/app/competitors',
                  title: 'Competitors',
                  detail: 'Head-to-head AI visibility comparison with opportunity scoring.',
                  tier: 'Alignment',
                },
                {
                  to: '/app/benchmarks',
                  title: 'Benchmarks',
                  detail: 'Compare your score to industry and category averages.',
                },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-4 transition-colors hover:border-white/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm brand-title-muted">{item.title}</h3>
                  {'tier' in item && (
                    <span className="text-[10px] uppercase tracking-wider text-white/35">
                      {item.tier}+
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-white/60" />
                </div>
                <p className="mt-1 text-xs text-white/70">{item.detail}</p>
              </Link>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-bold uppercase tracking-widest text-emerald-300/80">
            Extensions
          </h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                {
                  to: '/app/keywords',
                  title: 'Keywords',
                  detail: 'Prioritize execution queue by keyword opportunity.',
                },
                {
                  to: '/app/prompt-intelligence',
                  title: 'Prompt Intelligence',
                  detail: 'Discover query gaps AI models use to evaluate your niche.',
                  tier: 'Alignment',
                },
                {
                  to: '/app/answer-presence',
                  title: 'Answer Presence',
                  detail: 'Monitor where your brand appears in AI-generated answers.',
                  tier: 'Alignment',
                },
                {
                  to: '/app/reverse-engineer',
                  title: 'Reverse Engineer',
                  detail: 'Decompose how AI models think about content in your niche.',
                  tier: 'Alignment',
                },
                {
                  to: '/app/brand-integrity',
                  title: 'Brand Integrity',
                  detail: 'Detect misrepresentation and fact accuracy in AI outputs.',
                  tier: 'Alignment',
                },
                {
                  to: '/app/niche-discovery',
                  title: 'Niche Discovery',
                  detail: 'Top 100 niche rankings and competitive landscape mapping.',
                },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-4 transition-colors hover:border-white/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm brand-title-muted">{item.title}</h3>
                  {'tier' in item && (
                    <span className="text-[10px] uppercase tracking-wider text-white/35">
                      {item.tier}+
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-white/60" />
                </div>
                <p className="mt-1 text-xs text-white/70">{item.detail}</p>
              </Link>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-bold uppercase tracking-widest text-amber-300/80">
            Platform Tools
          </h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                {
                  to: '/app/schema-validator',
                  title: 'Schema Validator',
                  detail: 'Validate JSON-LD, Open Graph, Twitter Cards, and Microdata.',
                },
                {
                  to: '/app/server-headers',
                  title: 'Server Headers',
                  detail: 'Inspect HTTP response headers and security configuration.',
                },
                {
                  to: '/app/robots-checker',
                  title: 'AI Crawlers',
                  detail: 'Graded A–F for each major AI crawler in your robots.txt.',
                },
                {
                  to: '/app/mcp',
                  title: 'MCP Console',
                  detail: 'AI agents invoke audit tools programmatically via MCP.',
                  tier: 'Alignment',
                },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-4 transition-colors hover:border-white/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm brand-title-muted">{item.title}</h3>
                  {'tier' in item && (
                    <span className="text-[10px] uppercase tracking-wider text-white/35">
                      {item.tier}+
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-white/60" />
                </div>
                <p className="mt-1 text-xs text-white/70">{item.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        <section
          id="vector-retrieval-system"
          className="section-anchor section-accent-cyan mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">
            Vector databases in AiVIS.biz: what they are and why they matter
          </h2>
          <p className="mt-3 text-sm text-white/75">
            In this platform, a vector database is not a separate product category. It is the
            semantic memory layer that lets the system compare entities, variants, and evidence as
            geometric points. Traditional keyword logic asks, "Do strings match?". Vector logic
            asks, "Do meanings converge in embedding space?".
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">Storage model</h3>
              <p className="mt-1 text-xs text-white/70">
                embeddings live on entity, variant, and evidence rows. This creates a unified
                semantic retrieval surface instead of isolated tables with disconnected matching
                rules.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">Search model</h3>
              <p className="mt-1 text-xs text-white/70">
                nearest-neighbor retrieval uses cosine distance and local neighborhood windows. This
                enables low-latency semantic lookups for collision diagnostics.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">Operational model</h3>
              <p className="mt-1 text-xs text-white/70">
                only local neighborhoods are re-clustered when new evidence is ingested. This keeps
                geometry updates scalable without full corpus re-clustering.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <h3 className="text-sm brand-title-muted">
              How this compounds historical audit knowledge
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
              <li>Each audit contributes evidence vectors, not just one scalar score.</li>
              <li>
                Drift history plus collision graph lets you track whether an entity boundary is
                improving or fragmenting over time.
              </li>
              <li>
                Old audits remain useful because they provide longitudinal neighborhood structure,
                not just archived reports.
              </li>
            </ul>
          </div>
        </section>

        <section
          id="living-loop-entity-os"
          className="section-anchor section-accent-violet mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">LLM retrieval systems: from rules to geometry</h2>
          <p className="mt-3 text-sm text-white/75">
            Retrieval in this system is now a staged loop: embed, retrieve neighborhood, cluster,
            detect collisions, then update entity state. That is how clarity becomes a continuous
            control system instead of a static report.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-xs text-white/75">
              <thead className="bg-charcoal-deep text-white/65 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Current capability</th>
                  <th className="px-4 py-3">Why it matters</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3">Ingest</td>
                  <td className="px-4 py-3">
                    Provider-backed embeddings for entity + variants; collision map generated on
                    create.
                  </td>
                  <td className="px-4 py-3">
                    New entities are born with semantic context, not only metadata.
                  </td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3">Diagnose</td>
                  <td className="px-4 py-3">
                    Local density clustering over unified vector points plus lexical cross-checks.
                  </td>
                  <td className="px-4 py-3">
                    Confusion is explained by neighborhood structure, not guessed from string
                    overlap.
                  </td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3">Clarify + Publish</td>
                  <td className="px-4 py-3">
                    Canonical definition, schema block, entity page, share links, index
                    notifications.
                  </td>
                  <td className="px-4 py-3">
                    Semantic corrections become crawlable public artifacts that retrieval models can
                    cite.
                  </td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3">Reinforce + Simulate</td>
                  <td className="px-4 py-3">
                    Signal-amplifier templates + query simulation with citation/confusion
                    likelihood.
                  </td>
                  <td className="px-4 py-3">
                    Teams can see the expected retrieval impact before broad rollout.
                  </td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="px-4 py-3">State update</td>
                  <td className="px-4 py-3">
                    clarity_score, collision_score, authority_score updated after every loop.
                  </td>
                  <td className="px-4 py-3">
                    The platform becomes a closed-loop identity stabilizer, not a one-time
                    diagnostic tool.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section
          id="monetization-architecture"
          className="section-anchor section-accent-emerald mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">
            Monetization architecture: old + new without losing product truth
          </h2>
          <p className="mt-3 text-sm text-white/75">
            Platform truth today can stay stable while go-to-market experiments evolve. The product
            can monetize retrieval operations, continuous remediation, and evidence-backed reporting
            as separate value layers.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-xs text-white/75">
              <thead className="bg-charcoal-deep text-white/65 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Operating implication</th>
                </tr>
              </thead>
              <tbody>
                {MONETIZATION_MODELS.map((item) => (
                  <tr key={item.model} className="border-t border-white/10">
                    <td className="px-4 py-3 font-medium text-white/85">{item.model}</td>
                    <td className="px-4 py-3">{item.target}</td>
                    <td className="px-4 py-3">{item.pricing}</td>
                    <td className="px-4 py-3">{item.operatingShape}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs text-amber-100/90">
            <p>
              Recurring ScoreFix is now positioned as a managed semantic operations lane at
              $299/month, designed around weekly self-healing runs and monthly uplift proof.
            </p>
            <p className="mt-2 text-amber-100/75">
              This section reflects the live billing model and should remain synchronized with
              shared tier contracts and server pricing configuration.
            </p>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <h3 className="text-sm brand-title-muted">
              Additional monetization levers unlocked by current pipeline
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
              {PLATFORM_MONETIZATION_LEVERS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="free-tools"
          className="section-anchor section-accent-cyan mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">10) Free tools you can use without an account</h2>
          <p className="mt-3 text-sm text-white/75">
            These standalone tools require no login and demonstrate the structural checks that drive
            AI visibility. If any show gaps, the full audit pipeline tells you everything else.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                to: '/app/robots-checker',
                title: 'AI Crawlers',
                detail: 'Robots.txt grade for GPTBot, ClaudeBot, PerplexityBot, and more.',
              },
              {
                to: '/app/schema-validator',
                title: 'Schema Validator',
                detail: 'JSON-LD, Open Graph, Twitter Cards, and Microdata in one check.',
              },
              {
                to: '/app/server-headers',
                title: 'Server Headers',
                detail: 'HTTP headers, security configuration, and caching audit.',
              },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-4 transition-colors hover:border-white/20"
              >
                <h3 className="text-sm brand-title-muted">{item.title}</h3>
                <p className="mt-1 text-xs text-white/70">{item.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Live Findings from audit DB ── */}
        <section
          id="live-findings"
          className="section-anchor mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <div className="flex items-center gap-2.5 mb-1">
            <Database className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Live from the audit database
            </span>
            {findingsLoading && <Loader2 className="h-3 w-3 animate-spin text-white/30" />}
          </div>
          <h2 className="text-xl brand-title">What the data actually shows</h2>
          <p className="mt-2 text-sm text-white/65 max-w-2xl">
            Patterns aggregated across every URL audited on the platform — updated in real-time. Use
            these to calibrate how common your issues are.
          </p>
          {findings ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    stat: `${findings.pct_no_schema}%`,
                    label: 'of sites have zero JSON-LD schema',
                    sub: 'invisible to AI knowledge-graph extraction',
                    color: 'text-rose-400',
                  },
                  {
                    stat: `${findings.pct_no_faq_schema}%`,
                    label: 'have no FAQ schema',
                    sub: 'direct Q&A not surfaced to answer engines',
                    color: 'text-amber-400',
                  },
                  {
                    stat: `${findings.pct_missing_h1}%`,
                    label: 'missing a proper H1',
                    sub: 'AI cannot confirm the page topic',
                    color: 'text-orange-400',
                  },
                  {
                    stat: `${findings.pct_no_org_schema}%`,
                    label: 'lack Organization schema',
                    sub: 'entity identity signal absent',
                    color: 'text-violet-400',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-charcoal-deep p-4"
                  >
                    <div className={`text-3xl font-extrabold tabular-nums ${item.color}`}>
                      {item.stat}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-white/80">{item.label}</div>
                    <div className="mt-0.5 text-[11px] text-white/45">{item.sub}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    stat: `${findings.pct_thin_content}%`,
                    label: 'under 300 words',
                    sub: 'too thin for AI retrieval',
                    color: 'text-yellow-400',
                  },
                  {
                    stat: `${findings.avg_score}`,
                    label: 'avg visibility score',
                    sub: `across ${findings.total_audits.toLocaleString()} audited URLs`,
                    color: 'text-cyan-400',
                  },
                  {
                    stat: `${findings.pct_ai_crawler_blocked}%`,
                    label: 'with noindex/nofollow signals',
                    sub: 'actively suppressing AI access',
                    color: 'text-rose-300',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-charcoal-deep p-4"
                  >
                    <div className={`text-2xl font-extrabold tabular-nums ${item.color}`}>
                      {item.stat}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-white/80">{item.label}</div>
                    <div className="mt-0.5 text-[11px] text-white/45">{item.sub}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-white/30">
                Sampled {new Date(findings.sampled_at).toLocaleString()} · data is anonymised, no
                PII stored.
              </p>
            </>
          ) : !findingsLoading ? (
            <p className="mt-4 text-sm text-white/40">
              Audit database stats temporarily unavailable.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl border border-white/10 bg-charcoal-deep animate-pulse"
                />
              ))}
            </div>
          )}
        </section>

        <section
          id="battle-tested-rules"
          className="section-anchor mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">
            11) Battle-tested rules that keep teams from wasting cycles
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              'One URL, one cycle, one objective.',
              'Ship fewer high-impact changes instead of many shallow edits.',
              'Never claim improvement without before/after report evidence.',
              'Treat recommendations as backlog items with owners and due dates.',
              'Use weekly rhythm; ad-hoc cadence creates noisy trend signals.',
              'Keep wording consistent for core entities across related pages.',
            ].map((rule) => (
              <div
                key={rule}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-xs text-white/75"
              >
                <CheckCircle2 className="mr-2 inline h-3.5 w-3.5 text-emerald-300" />
                {rule}
              </div>
            ))}
          </div>
        </section>

        <section
          id="common-failures"
          className="section-anchor mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">
            12) Common failure patterns (and fast corrections)
          </h2>
          <div className="mt-4 space-y-3">
            {[
              {
                failure: 'Only meta edits, no content structure changes',
                fix: 'Add answer-ready blocks and improve heading architecture before metadata tuning.',
              },
              {
                failure: 'Trying to optimize every page at once',
                fix: 'Start with one revenue-critical page, prove movement, then replicate.',
              },
              {
                failure: 'No audit evidence retained',
                fix: 'Use Reports exports each cycle; keep baseline and post-fix snapshots.',
              },
            ].map((item) => (
              <div
                key={item.failure}
                className="rounded-xl border border-white/10 bg-charcoal-deep p-4"
              >
                <p className="text-sm text-rose-300">
                  <AlertTriangle className="mr-1 inline h-4 w-4" /> {item.failure}
                </p>
                <p className="mt-1 text-xs text-white/70">Correction: {item.fix}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="operating-cadence"
          className="section-anchor rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">13) 14-day operating cadence you can actually run</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">
                <Clock3 className="mr-1 inline h-4 w-4 text-cyan-300" /> Week 1
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
                <li>Baseline audit + report snapshot</li>
                <li>Close top 3 blockers</li>
                <li>Run Competitors, Citations, or Niche Discovery for context</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">
                <RefreshCw className="mr-1 inline h-4 w-4 text-amber-300" /> Week 2
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
                <li>Re-audit same URL</li>
                <li>Review Analytics trend and category deltas</li>
                <li>Export proof packet and queue next page</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/app/analytics"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:text-white"
            >
              <TrendingUp className="h-3.5 w-3.5 text-cyan-300" /> Review Trend
            </Link>
            <Link
              to="/app/workflow"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:text-white"
            >
              <Target className="h-3.5 w-3.5 text-orange-300" /> Open Workflow
            </Link>
          </div>
        </section>

        <section
          id="integration-workflows"
          className="section-anchor mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">
            14) Integration workflows: Slack, Discord, Zapier, MCP
          </h2>
          <p className="mt-3 text-sm text-white/75">
            Signal and Score Fix can auto-deliver completed audits. Use Slack/Discord for alerts,
            Zapier for system-to-system automation, and MCP Console for AI agent integrations.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">Alert channels (Slack/Discord)</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
                <li>Post immediate "audit complete" summaries to team channels.</li>
                <li>Include score, key findings, and share-link for fast review.</li>
                <li>Use for incident-style visibility monitoring and quick triage.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-sm brand-title-muted">Automation bridge (Zapier)</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
                <li>Create Notion database items from each completed audit.</li>
                <li>Open tickets in PM tools or sync records into Airtable/HubSpot.</li>
                <li>Route high-risk audits into approval flows automatically.</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/app/settings"
              className="btn-cta-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              <Target className="h-3.5 w-3.5" /> Configure delivery targets
            </Link>
            <Link
              to="/pricing"
              className="btn-cta-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              <FileSearch className="h-3.5 w-3.5" /> Compare integration tiers
            </Link>
          </div>
        </section>

        {/* ── 12 · By Symptom ── */}
        <section
          id="by-symptom"
          className="section-anchor mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">15) Find the guide by symptom</h2>
          <p className="mt-3 text-sm text-white/75">
            If you are searching by problem rather than by workflow step, these pages diagnose each
            failure mode in detail with evidence-backed remediation paths.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                {
                  to: '/problems/site-not-showing-in-chatgpt',
                  label: 'Site not showing in ChatGPT',
                },
                {
                  to: '/problems/chatgpt-not-mentioning-my-website',
                  label: 'ChatGPT not mentioning my website',
                },
                {
                  to: '/problems/ai-ignores-my-website-content',
                  label: 'AI ignores my website content',
                },
                {
                  to: '/problems/website-never-appears-in-ai-answers',
                  label: 'Website never appears in AI answers',
                },
                { to: '/problems/content-not-used-by-ai', label: 'My content is not used by AI' },
                { to: '/problems/chatgpt-gets-my-site-wrong', label: 'ChatGPT gets my site wrong' },
                {
                  to: '/problems/ai-summarizing-my-site-incorrectly',
                  label: 'AI summarizing my site incorrectly',
                },
                { to: '/problems/ai-not-picking-up-my-pages', label: 'AI not picking up my pages' },
                {
                  to: '/problems/how-chatgpt-decides-what-websites-to-use',
                  label: 'How ChatGPT decides what websites to use',
                },
                {
                  to: '/problems/how-ai-tools-choose-sources',
                  label: 'How AI tools choose sources',
                },
                {
                  to: '/problems/why-some-sites-get-cited-not-mine',
                  label: 'Why some sites get cited and not mine',
                },
                {
                  to: '/problems/what-makes-website-visible-to-ai-search',
                  label: 'What makes a website visible to AI search',
                },
                {
                  to: '/problems/how-ai-models-read-websites',
                  label: 'How AI models read websites',
                },
                {
                  to: '/problems/how-to-get-site-mentioned-in-chatgpt',
                  label: 'How to get site mentioned in ChatGPT',
                },
                {
                  to: '/problems/how-to-make-ai-cite-my-website',
                  label: 'How to make AI cite my website',
                },
                {
                  to: '/problems/how-to-make-content-show-in-ai-results',
                  label: 'How to make content show in AI results',
                },
                {
                  to: '/problems/how-to-structure-content-for-ai-models',
                  label: 'How to structure content for AI models',
                },
                {
                  to: '/problems/seo-vs-ai-search-difference',
                  label: 'SEO vs AI search — what is different',
                },
                {
                  to: '/problems/why-ai-search-replacing-google-clicks',
                  label: 'Why AI search is replacing Google clicks',
                },
                {
                  to: '/problems/saas-show-up-in-chatgpt',
                  label: 'SaaS: how to show up in ChatGPT',
                },
                {
                  to: '/problems/startup-not-mentioned-in-ai-answers',
                  label: 'Startup not mentioned in AI answers',
                },
                {
                  to: '/problems/why-chatgpt-uses-some-sites-not-mine',
                  label: 'Why ChatGPT uses some sites and not mine',
                },
                {
                  to: '/problems/how-to-know-if-ai-can-read-my-website',
                  label: 'How to know if AI can read my site',
                },
                {
                  to: '/problems/why-ai-rewrites-instead-of-linking',
                  label: 'Why AI rewrites instead of linking',
                },
                {
                  to: '/problems/how-to-fix-content-ai-misunderstands',
                  label: 'How to fix content AI misunderstands',
                },
              ] as { to: string; label: string }[]
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-charcoal-deep px-3 py-2.5 text-xs text-white/75 hover:border-white/20 hover:text-white transition"
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-orange-300" />
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        {/* ── Deep-Dive Reading: guide step → blog/page crosslinks ── */}
        <section
          id="deep-dive-reading"
          className="section-anchor mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <div className="flex items-center gap-2.5 mb-1">
            <BookOpen className="h-4 w-4 text-violet-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Internal linking
            </span>
          </div>
          <h2 className="text-xl brand-title">Deep-dive reading by guide step</h2>
          <p className="mt-2 text-sm text-white/65 max-w-2xl">
            Every guide section has a direct body of evidence behind it. These links go deeper on
            the mechanism, the data, or the tooling.
          </p>
          <div className="mt-5 space-y-6">
            {DEEP_DIVE_LINKS.map((group) => (
              <div key={group.step}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">
                  {group.step}
                </h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {group.items.map((item) =>
                    item.type === 'app' ? (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-charcoal-deep px-3 py-2.5 text-xs text-white/75 hover:border-white/25 hover:text-white transition"
                      >
                        <span>{item.label}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-cyan-400" />
                      </Link>
                    ) : (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-charcoal-deep px-3 py-2.5 text-xs text-white/75 hover:border-white/25 hover:text-white transition"
                      >
                        <span>{item.label}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-violet-400" />
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 13 · Dofollow Backlink Badge ── */}
        <section
          id="dofollow-badge"
          className="section-anchor mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
        >
          <h2 className="text-xl brand-title">16) Dofollow backlink badge</h2>
          <p className="mt-3 text-sm text-white/75">
            Add the AiVIS.biz badge to your website footer to earn a{' '}
            <strong className="text-cyan-300">high-quality dofollow backlink</strong> while showing
            visitors your site is AI-visibility audited. Every impression and click is tracked so
            you can measure referral impact.
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <h3 className="text-sm brand-title-muted">How it works</h3>
            <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
              <li>
                Grab your personalised embed snippet from the{' '}
                <Link to="/badge" className="text-cyan-400 underline hover:text-cyan-300">
                  Badge page
                </Link>
                .
              </li>
              <li>
                Paste the HTML into your site footer — the badge image loads from AiVIS.biz CDN.
              </li>
              <li>
                A hidden 1×1 tracking pixel logs impressions; clicks redirect through a tracker
                before landing on AiVIS.biz.
              </li>
              <li>
                View real-time stats: total impressions, clicks, unique referring domains, and top
                referrers.
              </li>
            </ul>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/badge"
              className="btn-cta-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              Get your badge
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
