import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Eye,
  FileText,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  ShieldOff,
  Sliders,
} from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildBreadcrumbSchema, buildFaqSchema, buildWebPageSchema } from '../lib/seoSchema';
import PublicPageFrame from '../components/PublicPageFrame';

const LAST_UPDATED = 'April 27, 2026';

const scopeItems = [
  { label: 'aivis.biz and all www variants', covered: true },
  { label: 'api.aivis.biz (REST and SSE endpoints)', covered: true },
  { label: 'Authenticated app shell (/app/*)', covered: true },
  { label: 'Admin routes (/admin/*)', covered: true },
  { label: 'BRAG Evidence API and citation ledger endpoints', covered: true },
  { label: 'Score Fix automated PR pipeline', covered: true },
  { label: 'WebMCP and MCP JSON-RPC surfaces', covered: true },
  { label: 'Third-party services (Stripe, Supabase, Resend)', covered: false },
];

const responseTargets = [
  { label: 'Acknowledgement', value: 'Within 24 hours of submission' },
  { label: 'Initial assessment', value: 'Within 7 business days' },
  { label: 'Severity classification', value: 'Within 7 business days' },
  { label: 'Patch or mitigation (Critical/High)', value: 'Best-effort, 14 days target' },
  { label: 'Public disclosure coordination', value: 'After patch is verified and shipped' },
];

const reportItems = [
  'Clear description of the vulnerability',
  'URL or API endpoint affected',
  'Step-by-step reproduction instructions',
  'Proof of concept (screenshot, request/response log, or code snippet)',
  'Your assessment of potential impact',
  'Optional: contact details for follow-up',
];

const honoredItems = [
  'Responsible, coordinated disclosure — no public posting before fix',
  'Good-faith testing — no destruction of data, no unauthorized access to user accounts',
  'Minimal footprint — only access what is necessary to demonstrate the issue',
  'No automated mass-scanning beyond verifying the specific vulnerability',
];

const outOfScope = [
  'Social engineering or phishing against AiVIS users or staff',
  'Physical attacks against infrastructure',
  'Denial-of-service attacks or load testing',
  'Vulnerabilities in third-party services we do not control (Stripe, Cloudflare, Supabase)',
  'UI/UX issues without security impact',
  'Self-XSS that requires the attacker to be logged in as the victim',
  'Email spoofing without demonstrated exploitation path',
  'Reports generated entirely by automated scanners without analyst verification',
];

const techMeasures = [
  {
    icon: Lock,
    title: 'Authentication',
    items: [
      'JWT-based session tokens with short-lived expiry',
      'Email verification required before audit access',
      'Google OAuth as an alternative second-factor path',
      'Password hashing via bcrypt with per-user salt',
      'Rate-limited login and registration endpoints',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Transport & Headers',
    items: [
      'HTTPS enforced across all endpoints via HSTS',
      'Content-Security-Policy with per-request nonces on all HTML responses',
      'X-Content-Type-Options: nosniff',
      'X-Frame-Options: SAMEORIGIN',
      'Referrer-Policy: strict-origin-when-cross-origin',
      'Permissions-Policy restricts camera, microphone, geolocation',
    ],
  },
  {
    icon: Sliders,
    title: 'Input & Output Handling',
    items: [
      'All user inputs sanitised via sanitizeInput() before processing',
      'External URLs validated through isPrivateOrLocalHost() to block SSRF',
      'Zod schema validation on all incoming API payloads',
      'AI model API keys are server-side only — never exposed to client bundles',
      'Bootstrap state escaped via escapeBootstrapState() to prevent XSS',
    ],
  },
  {
    icon: Eye,
    title: 'Monitoring & Access Control',
    items: [
      'Sentry error tracking for runtime exceptions in production',
      'Admin routes protected by ADMIN_KEY environment variable',
      'Usage gates enforce tier limits before any scan or AI call is made',
      'Immutable citation ledger — entries are append-only, no post-write mutation',
      'Row-level security enforced at Supabase layer for user-scoped data',
    ],
  },
];

const crawlPolicy = [
  { source: 'GPTBot (OpenAI)', access: 'Public documentation, blogs, methodology pages' },
  { source: 'ClaudeBot (Anthropic)', access: 'Public documentation, blogs, methodology pages' },
  { source: 'PerplexityBot', access: 'Public documentation, blogs, methodology pages' },
  { source: 'All AI crawlers', access: 'Blocked: /api/*, /app/*, /admin/*, /account/*' },
  { source: 'All AI crawlers', access: 'Blocked: BRAG implementation detail routes' },
  { source: 'All AI crawlers', access: 'Blocked: citation ledger write endpoints' },
];

const faqItems = [
  {
    question: 'Does AiVIS.biz have a bug bounty programme?',
    answer:
      'AiVIS.biz does not currently operate a paid bug bounty programme. We do recognise responsible researchers publicly in our Acknowledgements page when a valid submission leads to a confirmed fix and the researcher consents to attribution.',
  },
  {
    question: 'What counts as a valid security report?',
    answer:
      'A valid report demonstrates a reproducible vulnerability — authentication bypass, privilege escalation, SSRF, stored XSS, insecure direct object reference, data leakage between tenant accounts, or similar. Reports must include reproduction steps and an impact assessment to be reviewed.',
  },
  {
    question: 'How are AI model API keys protected?',
    answer:
      'All AI provider credentials (OpenRouter, OpenAI, Anthropic, xAI) are held exclusively as server-side environment variables. They are never embedded in client bundles, never transmitted in responses, and never logged. The analysis pipeline does not accept API keys from the client payload.',
  },
  {
    question: 'What encryption standard covers data in transit?',
    answer:
      'All connections between browsers, the AiVIS API, and the Supabase database are TLS 1.2 minimum, enforced by Cloudflare and Railway. Connections to the database use sslmode=require. Internal service-to-service calls on the same platform use the platform-managed TLS layer.',
  },
  {
    question: 'Can I test AiVIS.biz security controls on my own account?',
    answer:
      "You may test controls that apply only to your own authenticated session and data. Accessing, enumerating, or modifying other users' accounts, scans, or evidence records — even for testing — is not permitted and will be treated as a violation of these terms.",
  },
];

export default function SecurityPage() {
  usePageMeta({
    title: 'Security Policy — AiVIS.biz',
    description:
      'AiVIS.biz security policy: responsible disclosure, scope, technical safeguards, AI crawler access controls, and contact details for reporting vulnerabilities in the CITE LEDGER evidence platform.',
    path: '/security',
    structuredData: [
      buildWebPageSchema({
        path: '/security',
        name: 'AiVIS.biz Security Policy',
        description:
          'Responsible disclosure programme, technical safeguards, authentication model, and AI crawler policy for the AiVIS.biz evidence-backed visibility platform.',
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Security', path: '/security' },
      ]),
      buildFaqSchema(faqItems, { path: '/security' }),
    ],
  });

  const linkCls = 'text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200';

  return (
    <PublicPageFrame
      icon={Shield}
      title="Security Policy"
      subtitle="Responsible disclosure, technical safeguards, and AI crawler access controls for the AiVIS.biz platform"
      maxWidthClass="max-w-4xl"
    >
      <p className="text-white/50 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-14 text-white/75 leading-relaxed">
        {/* ── Overview ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" /> Overview
          </h2>
          <p>
            AiVIS.biz is operated by <strong className="text-white">Intruvurt Labs, LLC</strong>, a
            US company based in Georgia. The platform runs a deterministic AI citation verification
            pipeline — CITE LEDGER — backed by an evidence-linked evidence-chain framework (BRAG).
            Security of that pipeline, its ledger records, and the users who operate it is treated
            as a non-negotiable platform invariant, not an optional feature layer.
          </p>
          <p className="mt-3">
            This page describes our responsible disclosure process, the technical safeguards we have
            implemented, our AI crawler access policy, and the contact channels available for
            security researchers and users.
          </p>
          <p className="mt-3">
            The machine-readable version of this policy is available at{' '}
            <a
              href="/.well-known/security.txt"
              className={linkCls}
              target="_blank"
              rel="noreferrer"
            >
              /.well-known/security.txt
            </a>{' '}
            (RFC 9116 format).
          </p>
        </section>

        {/* ── Scope ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-400" /> Scope
          </h2>
          <p className="mb-4">
            This policy covers vulnerabilities in systems directly operated and maintained by
            AiVIS.biz. Third-party processors (Stripe, Cloudflare, Supabase, Resend) have their own
            disclosure programmes and should be reported directly to them.
          </p>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {scopeItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0"
              >
                {item.covered ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldOff className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <span className={item.covered ? 'text-white/80' : 'text-white/35 line-through'}>
                  {item.label}
                </span>
                {!item.covered && (
                  <span className="ml-auto text-xs text-slate-600">out of scope</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Responsible Disclosure ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" /> Responsible Disclosure
          </h2>
          <p className="mb-4">
            If you discover a vulnerability, please report it to{' '}
            <a href="mailto:security@aivis.biz" className={linkCls}>
              security@aivis.biz
            </a>{' '}
            before any public disclosure. We are a small team — coordinated disclosure gives us time
            to verify, fix, and notify affected users before details become public.
          </p>

          <h3 className="text-base font-semibold text-white mt-6 mb-3">What to include</h3>
          <ul className="space-y-2">
            {reportItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <ArrowRight className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <h3 className="text-base font-semibold text-white mt-8 mb-3">Response targets</h3>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {responseTargets.map((row) => (
              <div
                key={row.label}
                className="flex flex-col sm:flex-row sm:items-center gap-1 px-5 py-3 border-b border-white/5 last:border-0"
              >
                <span className="text-sm text-white/55 sm:w-56 shrink-0">{row.label}</span>
                <span className="text-sm text-white/85">{row.value}</span>
              </div>
            ))}
          </div>

          <h3 className="text-base font-semibold text-white mt-8 mb-3">Safe harbour</h3>
          <p className="text-sm mb-3">
            We will not pursue legal action against researchers who meet all of the following
            conditions:
          </p>
          <ul className="space-y-2">
            {honoredItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <h3 className="text-base font-semibold text-white mt-8 mb-3">Out of scope</h3>
          <ul className="space-y-2">
            {outOfScope.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-400/60 mt-0.5 shrink-0" />
                <span className="text-white/55">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Technical Safeguards ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Technical Safeguards
          </h2>
          <p className="mb-6">
            The following controls are implemented in the current production build of the AiVIS
            pipeline. They reflect real code paths — not aspirational policies.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {techMeasures.map(({ icon: Icon, title, items }) => (
              <div
                key={title}
                className="p-5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                </div>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-white/60">
                      <span className="mt-1 w-1 h-1 rounded-full bg-cyan-400/40 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── AI Crawler Policy ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-violet-400" /> AI Crawler Access Policy
          </h2>
          <p className="mb-4">
            AiVIS actively measures how AI systems access and process web content. Our own crawler
            policy reflects that operational knowledge: we welcome AI crawlers on public educational
            content and restrict them from proprietary implementation paths, user data, and
            authenticated routes.
          </p>
          <div className="rounded-xl border border-white/10 overflow-hidden mb-4">
            <div className="grid grid-cols-2 bg-white/5 px-5 py-2 text-xs font-medium text-white/40 uppercase tracking-wide">
              <span>Crawler</span>
              <span>Access</span>
            </div>
            {crawlPolicy.map((row, i) => (
              <div key={i} className="grid grid-cols-2 px-5 py-3 border-t border-white/5 text-sm">
                <span className="text-white/70">{row.source}</span>
                <span
                  className={
                    row.access.startsWith('Blocked') ? 'text-red-400/70' : 'text-emerald-400/70'
                  }
                >
                  {row.access}
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm">
            Crawlers that ignore robots.txt directives are blocked at the Cloudflare WAF layer and
            may be reported to the relevant AI provider. The full crawl policy is declared in{' '}
            <a href="/robots.txt" className={linkCls} target="_blank" rel="noreferrer">
              /robots.txt
            </a>{' '}
            and{' '}
            <a href="/crawlers.txt" className={linkCls} target="_blank" rel="noreferrer">
              /crawlers.txt
            </a>
            .
          </p>
        </section>

        {/* ── Contact ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" /> Contact
          </h2>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-white/40 w-32 shrink-0">Security reports</span>
              <a href="mailto:security@aivis.biz" className={linkCls}>
                security@aivis.biz
              </a>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white/40 w-32 shrink-0">General support</span>
              <Link to="/help" className={linkCls}>
                aivis.biz/help
              </Link>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white/40 w-32 shrink-0">Privacy / GDPR</span>
              <a href="mailto:privacy@aivis.biz" className={linkCls}>
                privacy@aivis.biz
              </a>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white/40 w-32 shrink-0">Legal</span>
              <a href="mailto:legal@aivis.biz" className={linkCls}>
                legal@aivis.biz
              </a>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white/40 w-32 shrink-0">Machine-readable</span>
              <a
                href="/.well-known/security.txt"
                className={linkCls}
                target="_blank"
                rel="noreferrer"
              >
                /.well-known/security.txt
              </a>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-5">Frequently asked questions</h2>
          <div className="space-y-5">
            {faqItems.map((faq) => (
              <div
                key={faq.question}
                className="border-b border-white/8 pb-5 last:border-0 last:pb-0"
              >
                <h3 className="text-base font-medium text-white mb-2">{faq.question}</h3>
                <p className="text-sm text-white/60">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Related ── */}
        <nav className="grid sm:grid-cols-3 gap-4 pt-4" aria-label="Related pages">
          {[
            { to: '/privacy', label: 'Privacy Policy', sub: 'Data collection & retention' },
            { to: '/compliance', label: 'Compliance', sub: 'GDPR & regulatory posture' },
            { to: '/acknowledgements', label: 'Acknowledgements', sub: 'Research credits' },
          ].map(({ to, label, sub }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  {label}
                </div>
                <div className="text-xs text-slate-500 truncate">{sub}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
            </Link>
          ))}
        </nav>
      </div>
    </PublicPageFrame>
  );
}
