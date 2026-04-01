import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileSearch, FlaskConical, Hammer, Link2, Radar, RefreshCw, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildBreadcrumbSchema } from '../lib/seoSchema';

const GUIDE_SECTIONS = [
  { id: 'start-here', label: 'Start Here' },
  { id: 'baseline-setup', label: 'Baseline Setup' },
  { id: 'run-first-audit', label: 'Run First Audit' },
  { id: 'read-results-correctly', label: 'Read Results' },
  { id: 'execute-fixes', label: 'Execute Fixes' },
  { id: 'retest-and-prove', label: 'Retest + Proof' },
  { id: 'tool-routing', label: 'Tool Routing Map' },
  { id: 'battle-tested-rules', label: 'Battle-Tested Rules' },
  { id: 'common-failures', label: 'Common Failures' },
  { id: 'operating-cadence', label: 'Operating Cadence' },
  { id: 'integration-workflows', label: 'Integrations' },
] as const;

const HOW_TO_STEPS = [
  { name: 'Select one target URL', text: 'Start with one money page or one high-value service page. Do not audit five pages first.' },
  { name: 'Run baseline audit', text: 'Capture score, category grades, and recommendation list before editing any content.' },
  { name: 'Ship 3 highest-impact fixes', text: 'Prioritize structural and trust fixes over cosmetic edits for first pass.' },
  { name: 'Re-audit same URL', text: 'Use the same URL and compare result deltas instead of changing targets mid-cycle.' },
  { name: 'Document proof in Reports', text: 'Export report snapshots and keep a timestamped before/after trail.' },
  { name: 'Scale to adjacent pages', text: 'After one page improves, apply the same pattern to 2–3 related pages.' },
];

export default function GuidePage() {
  usePageMeta({
    title: 'Guide',
    fullTitle: 'AiVIS Guide - AI Visibility Execution Playbook',
    description:
      'Practical tutorial for running AI visibility audits, interpreting results, applying fixes, and proving measurable improvements.',
    path: '/guide',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'AiVIS AI Visibility Execution Guide',
        description: 'Step-by-step process to audit, remediate, and validate AI visibility improvements.',
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
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:pl-64">
      <aside className="fixed left-8 top-28 hidden w-52 space-y-2 xl:block">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/35">Guide Navigation</p>
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

      <header id="start-here" className="section-anchor mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <img
          src="/text-logo.png"
          alt="AiVIS logo"
          className="mb-4 h-9 w-auto object-contain opacity-90"
          loading="lazy"
        />
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
          <FlaskConical className="h-3.5 w-3.5 text-orange-300" />
          Execution Guide
        </div>
        <h1 className="mt-4 text-3xl brand-title sm:text-4xl">AI Visibility Guide: no fluff, just execution</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/70">
          This page is your operator manual for AiVIS. It focuses on what to do, in what order, and what evidence to keep so visibility improvements are real and repeatable.
        </p>
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

      <section id="baseline-setup" className="section-anchor section-accent-cyan mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">1) Baseline setup before you touch content</h2>
        <ul className="mt-4 space-y-2 text-sm text-white/75 list-disc pl-5">
          <li>Choose one target URL with business value (service page, product page, or conversion page).</li>
          <li>Keep the URL stable during the first cycle so score changes are attributable.</li>
          <li>Write one success metric: score lift, category grade lift, or citation visibility lift.</li>
          <li>Open these pages in advance: Analyze, Reports, and either Competitors or Citations.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/analyze" className="btn-cta-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
            <Target className="h-3.5 w-3.5" /> Open Analyze
          </Link>
          <Link to="/reports" className="btn-cta-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
            <FileSearch className="h-3.5 w-3.5" /> Open Reports
          </Link>
        </div>
      </section>

      <section id="run-first-audit" className="section-anchor section-accent-amber mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">2) Run your first audit the right way</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <h3 className="text-sm brand-title-muted">Do this</h3>
            <ul className="mt-2 space-y-2 text-xs text-white/70 list-disc pl-4">
              <li>Run one baseline scan and save the report immediately.</li>
              <li>Capture top 3 blockers from Priority Actions, not every low-impact item.</li>
              <li>Check evidence fields before acting: headings, schema count, response signals, trust gaps.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <h3 className="text-sm brand-title-muted">Avoid this</h3>
            <ul className="mt-2 space-y-2 text-xs text-white/70 list-disc pl-4">
              <li>Changing URL target and expecting meaningful trend comparison.</li>
              <li>Jumping straight to rewrites without reviewing evidence and grade categories.</li>
              <li>Measuring success with one score number only.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="read-results-correctly" className="section-anchor section-accent-emerald mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
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
                <td className="px-4 py-3">AI may parse content but not trust it enough to cite.</td>
                <td className="px-4 py-3">Add proof signals, citations, and clearer source attribution blocks.</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-4 py-3">Good structure + weak extraction</td>
                <td className="px-4 py-3">Layout exists, but answers are not explicit enough for retrieval.</td>
                <td className="px-4 py-3">Add direct answer blocks under key H2/H3 sections.</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-4 py-3">Strong score + unstable trend</td>
                <td className="px-4 py-3">Recent changes are inconsistent or deployment cadence is noisy.</td>
                <td className="px-4 py-3">Lock weekly cadence and compare same-page scans only.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="execute-fixes" className="section-anchor section-accent-orange mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">4) Execute fixes in impact order</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            {
              title: 'Pass A: Structure',
              icon: Link2,
              points: ['One intent per section', 'Clean heading hierarchy', 'Explicit internal links to supporting pages'],
            },
            {
              title: 'Pass B: Extractability',
              icon: Radar,
              points: ['Direct question/answer blocks', 'Entity-consistent language', 'Schema aligned with visible content'],
            },
            {
              title: 'Pass C: Trust + Proof',
              icon: ShieldCheck,
              points: ['Author/source context', 'Claims tied to evidence', 'Remove unverifiable statements'],
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
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
          <Link to="/score-fix" className="btn-cta-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
            <Hammer className="h-3.5 w-3.5" /> Open Score Fix
          </Link>
          <Link to="/reverse-engineer" className="btn-cta-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
            <FlaskConical className="h-3.5 w-3.5" /> Reverse Engineer Answers
          </Link>
        </div>
      </section>

      <section id="retest-and-prove" className="section-anchor section-accent-violet mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">5) Retest and prove the change</h2>
        <ol className="mt-4 space-y-2 text-sm text-white/75 list-decimal pl-5">
          <li>Re-run the exact same URL after shipping fixes.</li>
          <li>Compare score and category-grade movement, not score only.</li>
          <li>Save the new report and export both snapshots.</li>
          <li>Log what changed on-page so future cycles can repeat the winning pattern.</li>
        </ol>
        <p className="mt-3 text-xs text-white/60">
          If there is no movement, review whether the edits touched extraction-critical zones (answer blocks, structure, schema alignment, trust signals) instead of cosmetic text.
        </p>
      </section>

      <section id="tool-routing" className="section-anchor section-accent-rose mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">6) Tool routing map: which page to use and when</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            { to: '/analyze', title: 'Analyze', detail: 'Run baseline and post-fix audits.' },
            { to: '/keywords', title: 'Keywords', detail: 'Prioritize execution queue by opportunity.' },
            { to: '/competitors', title: 'Competitors', detail: 'Find where rivals are being surfaced instead of you.' },
            { to: '/citations', title: 'Citations', detail: 'Test mention and source visibility in AI responses.' },
            { to: '/analytics', title: 'Analytics', detail: 'Track trend stability and category movement over time.' },
            { to: '/reports', title: 'Reports', detail: 'Create proof trail for clients, leadership, and retrospectives.' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-xl border border-white/10 bg-charcoal-deep p-4 transition-colors hover:border-white/20"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm brand-title-muted">{item.title}</h3>
                <ArrowRight className="h-3.5 w-3.5 text-white/60" />
              </div>
              <p className="mt-1 text-xs text-white/70">{item.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="battle-tested-rules" className="section-anchor mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">7) Battle-tested rules that keep teams from wasting cycles</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            'One URL, one cycle, one objective.',
            'Ship fewer high-impact changes instead of many shallow edits.',
            'Never claim improvement without before/after report evidence.',
            'Treat recommendations as backlog items with owners and due dates.',
            'Use weekly rhythm; ad-hoc cadence creates noisy trend signals.',
            'Keep wording consistent for core entities across related pages.',
          ].map((rule) => (
            <div key={rule} className="rounded-xl border border-white/10 bg-charcoal-deep p-3 text-xs text-white/75">
              <CheckCircle2 className="mr-2 inline h-3.5 w-3.5 text-emerald-300" />
              {rule}
            </div>
          ))}
        </div>
      </section>

      <section id="common-failures" className="section-anchor mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">8) Common failure patterns (and fast corrections)</h2>
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
            <div key={item.failure} className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <p className="text-sm text-rose-300">
                <AlertTriangle className="mr-1 inline h-4 w-4" /> {item.failure}
              </p>
              <p className="mt-1 text-xs text-white/70">Correction: {item.fix}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="operating-cadence" className="section-anchor rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">9) 14-day operating cadence you can actually run</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
            <h3 className="text-sm brand-title-muted">
              <Clock3 className="mr-1 inline h-4 w-4 text-cyan-300" /> Week 1
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-white/70 list-disc pl-4">
              <li>Baseline audit + report snapshot</li>
              <li>Close top 3 blockers</li>
              <li>Run Competitors or Citations once for context</li>
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
          <Link to="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:text-white">
            <TrendingUp className="h-3.5 w-3.5 text-cyan-300" /> Review Trend
          </Link>
          <Link to="/workflow" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:text-white">
            <Target className="h-3.5 w-3.5 text-orange-300" /> Open Workflow
          </Link>
        </div>
      </section>

      <section id="integration-workflows" className="section-anchor mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="text-xl brand-title">10) Integration workflows: Slack, Discord, Zapier, Notion</h2>
        <p className="mt-3 text-sm text-white/75">
          Signal and Score Fix can auto-deliver completed audits. Use Slack/Discord for alerts, and Zapier when you need system-to-system automation such as Notion, Airtable, or CRM updates.
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
          <Link to="/settings" className="btn-cta-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
            <Target className="h-3.5 w-3.5" /> Configure delivery targets
          </Link>
          <Link to="/pricing" className="btn-cta-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
            <FileSearch className="h-3.5 w-3.5" /> Compare integration tiers
          </Link>
        </div>
      </section>
      </main>
    </div>
  );
}
