import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Code2, Heart, Package, Shield, Star, Users } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildBreadcrumbSchema, buildWebPageSchema } from '../lib/seoSchema';
import PublicPageFrame from '../components/PublicPageFrame';

const LAST_UPDATED = 'April 27, 2026';

/* ── Open-source runtime dependencies ─────────────────────────── */
const coreDeps = [
  {
    name: 'React',
    version: '19',
    role: 'UI rendering layer and concurrent component model for the client shell',
    url: 'https://react.dev',
    license: 'MIT',
  },
  {
    name: 'Vite',
    version: '6',
    role: 'Build toolchain, dev server, and production bundler for the client',
    url: 'https://vitejs.dev',
    license: 'MIT',
  },
  {
    name: 'Express',
    version: '5',
    role: 'HTTP server and middleware framework for the analysis pipeline and API routes',
    url: 'https://expressjs.com',
    license: 'MIT',
  },
  {
    name: 'TypeScript',
    version: '5',
    role: 'Static type system used across the full monorepo (client, server, shared)',
    url: 'https://www.typescriptlang.org',
    license: 'Apache-2.0',
  },
  {
    name: 'Tailwind CSS',
    version: '3',
    role: 'Utility-first CSS framework used throughout the client UI',
    url: 'https://tailwindcss.com',
    license: 'MIT',
  },
  {
    name: 'Zod',
    role: 'Runtime schema validation for all incoming API payloads and environment variables',
    url: 'https://zod.dev',
    license: 'MIT',
  },
  {
    name: 'Puppeteer',
    role: 'Headless browser used to extract rendered HTML from target URLs in the scraper pipeline',
    url: 'https://pptr.dev',
    license: 'Apache-2.0',
  },
  {
    name: 'Supabase JS',
    role: 'Client and server libraries for Postgres access, auth session management, and row-level security',
    url: 'https://supabase.com',
    license: 'MIT',
  },
  {
    name: 'Stripe Node',
    role: 'Server-side Stripe SDK for subscription billing, webhook verification, and payment intent management',
    url: 'https://stripe.com/docs/libraries',
    license: 'MIT',
  },
  {
    name: 'Resend',
    role: 'Transactional email provider SDK used for verification, password reset, and welcome messages',
    url: 'https://resend.com',
    license: 'MIT',
  },
  {
    name: 'Sentry',
    role: 'Error monitoring and runtime exception tracking in production for both client and server',
    url: 'https://sentry.io',
    license: 'MIT (SDK)',
  },
  {
    name: 'PostHog JS',
    role: 'Product analytics for public marketing pages; disabled on authenticated app routes',
    url: 'https://posthog.com',
    license: 'MIT (SDK)',
  },
  {
    name: 'React Router',
    version: '6',
    role: 'Client-side routing, lazy-loaded code splitting, and navigation guards',
    url: 'https://reactrouter.com',
    license: 'MIT',
  },
  {
    name: 'Lucide React',
    role: 'Icon set used throughout the UI — fully tree-shaken at build time',
    url: 'https://lucide.dev',
    license: 'ISC',
  },
  {
    name: 'Recharts',
    role: 'Composable chart library used for citation trend and score history visualizations',
    url: 'https://recharts.org',
    license: 'MIT',
  },
  {
    name: 'react-hot-toast',
    role: 'Lightweight toast notification system for in-app feedback',
    url: 'https://react-hot-toast.com',
    license: 'MIT',
  },
  {
    name: 'Helmet',
    role: 'Express middleware that applies security headers (CSP, HSTS, X-Frame-Options, etc.) automatically',
    url: 'https://helmetjs.github.io',
    license: 'MIT',
  },
  {
    name: 'DOMPurify',
    role: 'Server-side and client-side HTML sanitisation used to strip dangerous markup from user-supplied content',
    url: 'https://github.com/cure53/DOMPurify',
    license: 'Apache-2.0 / MPL-2.0',
  },
  {
    name: 'Turbo (Turborepo)',
    role: 'Monorepo build orchestration and caching layer for the client/server/shared workspace',
    url: 'https://turbo.build',
    license: 'MIT',
  },
  {
    name: 'Zustand',
    role: 'Minimal state management for auth, workspace, and settings stores in the client',
    url: 'https://github.com/pmndrs/zustand',
    license: 'MIT',
  },
];

/* ── Third-party API providers & platforms ─────────────────────── */
const providers = [
  {
    name: 'OpenAI',
    role: 'GPT-5 Nano and GPT-5 Mini used for visibility analysis on Starter, Alignment, and Signal tiers',
    url: 'https://openai.com',
  },
  {
    name: 'Anthropic',
    role: 'Claude Sonnet 4.6 used as peer validation model in the Triple-Check pipeline (Signal tier)',
    url: 'https://anthropic.com',
  },
  {
    name: 'xAI',
    role: 'Grok 4.1 Fast used as the final validation gate in Triple-Check consensus (Signal tier)',
    url: 'https://x.ai',
  },
  {
    name: 'OpenRouter',
    role: 'Multi-model routing hub used for free-tier Observer scans across open-weight fallback models',
    url: 'https://openrouter.ai',
  },
  {
    name: 'Cloudflare',
    role: 'Edge network, WAF, bot protection, DNS, SSL/TLS termination, and security.txt hosting',
    url: 'https://cloudflare.com',
  },
  {
    name: 'Railway',
    role: 'Primary production hosting for the Node.js API server, background workers, and Docker builds',
    url: 'https://railway.app',
  },
  {
    name: 'Supabase',
    role: 'Managed Postgres database with PgBouncer connection pooling, row-level security, and auth session storage',
    url: 'https://supabase.com',
  },
  {
    name: 'Stripe',
    role: 'Subscription billing, one-time payment collection, webhook event handling for tier entitlements',
    url: 'https://stripe.com',
  },
  {
    name: 'Resend',
    role: 'Transactional email infrastructure for account verification, password reset, and onboarding',
    url: 'https://resend.com',
  },
  {
    name: 'SerpAPI',
    role: 'SERP signal enrichment for Alignment-tier and above scans — improves entity clarity and authority scoring',
    url: 'https://serpapi.com',
  },
];

/* ── Standards referenced ── */
const standards = [
  { name: 'RFC 9116', note: 'security.txt format', url: 'https://www.rfc-editor.org/rfc/rfc9116' },
  {
    name: 'schema.org',
    note: 'Structured data vocabulary (Organization, FAQPage, SoftwareApplication, HowTo, ItemList)',
    url: 'https://schema.org',
  },
  {
    name: 'OWASP Top 10',
    note: 'Web application security standard used as baseline for code review',
    url: 'https://owasp.org/www-project-top-ten/',
  },
  {
    name: 'JSON-LD 1.1',
    note: 'Linked data serialisation format for structured metadata',
    url: 'https://www.w3.org/TR/json-ld11/',
  },
  {
    name: 'JSON-RPC 2.0',
    note: 'Protocol used by the AiVIS MCP and WebMCP server interfaces',
    url: 'https://www.jsonrpc.org/specification',
  },
  {
    name: 'WCAG 2.2 AA',
    note: 'Accessibility baseline targeted in UI component development',
    url: 'https://www.w3.org/TR/WCAG22/',
  },
  {
    name: 'GDPR',
    note: 'EU data protection regulation — informs data handling, retention, and deletion policies',
    url: 'https://gdpr.eu',
  },
  {
    name: 'MCP (Anthropic)',
    note: 'Model Context Protocol — used for the AiVIS tool-calling integration surface',
    url: 'https://modelcontextprotocol.io',
  },
];

/* ── Security researchers ── */
const researchers: Array<{ name: string; contribution: string; date?: string }> = [
  // Future researchers credited here after confirmed fix + consent
];

export default function AcknowledgementsPage() {
  usePageMeta({
    title: 'Acknowledgements — AiVIS.biz',
    description:
      'Credits for the open-source libraries, third-party providers, industry standards, and security researchers that make the AiVIS.biz CITE LEDGER evidence platform possible.',
    path: '/acknowledgements',
    structuredData: [
      buildWebPageSchema({
        path: '/acknowledgements',
        name: 'AiVIS.biz Acknowledgements',
        description:
          'Open-source dependencies, third-party providers, referenced standards, and security researcher credits for the AiVIS.biz AI visibility audit platform.',
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Acknowledgements', path: '/acknowledgements' },
      ]),
    ],
  });

  const linkCls = 'text-cyan-300/80 underline underline-offset-2 hover:text-cyan-200';
  const extLink = (url: string, label: string) => (
    <a href={url} className={linkCls} target="_blank" rel="noreferrer">
      {label}
    </a>
  );

  return (
    <PublicPageFrame
      icon={Heart}
      title="Acknowledgements"
      subtitle="The open-source libraries, API providers, standards, and researchers that make AiVIS.biz possible"
      maxWidthClass="max-w-4xl"
    >
      <p className="text-white/50 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <div className="space-y-14 text-white/75 leading-relaxed">
        {/* ── Intro ── */}
        <section>
          <p>
            AiVIS.biz is built on a foundation of open-source software, public standards, and hosted
            infrastructure services. This page documents all significant dependencies, providers,
            and referenced specifications to maintain full transparency about what powers the
            platform. It also credits security researchers who responsibly disclose vulnerabilities
            that result in verified fixes.
          </p>
          <p className="mt-3">
            Every entry below represents a real runtime dependency or referenced standard in the
            production system — not marketing copy. Versions are listed where materially relevant.
          </p>
        </section>

        {/* ── Core open-source ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400" /> Open-Source Dependencies
          </h2>
          <p className="text-sm text-white/45 mb-5">
            All packages used are published under OSI-approved open-source licences. Licence type is
            noted for each package.
          </p>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] bg-white/5 px-5 py-2.5 text-xs font-medium text-white/35 uppercase tracking-wide">
              <span>Package</span>
              <span>Licence</span>
            </div>
            {coreDeps.map((dep) => (
              <div
                key={dep.name}
                className="px-5 py-4 border-t border-white/5 grid grid-cols-[1fr_auto] gap-4 items-start"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <a
                      href={dep.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-white hover:text-cyan-300 transition-colors"
                    >
                      {dep.name}
                    </a>
                    {dep.version && (
                      <span className="text-xs text-white/30 font-mono">v{dep.version}</span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">{dep.role}</p>
                </div>
                <span className="text-xs font-mono text-emerald-400/70 whitespace-nowrap mt-0.5">
                  {dep.license}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Third-party providers ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
            <Package className="w-5 h-5 text-violet-400" /> Third-Party API Providers &amp;
            Platforms
          </h2>
          <p className="text-sm text-white/45 mb-5">
            These services are integrated via API and are subject to their own terms of service and
            privacy policies. AiVIS.biz holds data processor agreements where required.
          </p>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {providers.map((p) => (
              <div key={p.name} className="px-5 py-4 border-t border-white/5 first:border-0">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-white hover:text-cyan-300 transition-colors"
                >
                  {p.name}
                </a>
                <p className="text-xs text-white/50 leading-relaxed mt-0.5">{p.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Standards ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" /> Standards &amp; Specifications
            Referenced
          </h2>
          <p className="text-sm text-white/45 mb-5">
            Implementation decisions across the pipeline are informed by these published standards.
          </p>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {standards.map((s) => (
              <div
                key={s.name}
                className="px-5 py-3.5 border-t border-white/5 first:border-0 flex items-start gap-4"
              >
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-white hover:text-cyan-300 transition-colors w-44 shrink-0"
                >
                  {s.name}
                </a>
                <p className="text-xs text-white/50 leading-relaxed">{s.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security researchers ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" /> Security Researchers
          </h2>
          <p className="text-sm text-white/45 mb-5">
            Researchers who have responsibly disclosed vulnerabilities that led to confirmed fixes
            are credited here with their consent. Attribution requests can be sent to{' '}
            {extLink('mailto:security@aivis.biz', 'security@aivis.biz')}.
          </p>
          {researchers.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.015] px-6 py-8 text-center">
              <Shield className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/35">
                No researchers credited yet. If you discover a vulnerability, see the{' '}
                <Link to="/security" className={linkCls}>
                  Security Policy
                </Link>{' '}
                for how to report it.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {researchers.map((r) => (
                <div key={r.name} className="px-5 py-4 border-t border-white/5 first:border-0">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-amber-400/60 shrink-0" />
                    <span className="text-sm font-semibold text-white">{r.name}</span>
                    {r.date && <span className="ml-auto text-xs text-white/30">{r.date}</span>}
                  </div>
                  <p className="text-xs text-white/50 mt-1 ml-7">{r.contribution}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── BRAG / built on ── */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-400/70" /> Built on BRAG
          </h2>
          <p>
            The evidence framework that powers every AiVIS audit — BRAG
            (Based-Retrieval-Auditable-Grading) — is open source and available for adaptation.{' '}
            {extLink('https://github.com/dobleduche/brag', 'Explore BRAG on GitHub')} to understand
            the evidence-trailing methodology or customise it for your own audit use case.
          </p>
          <p className="mt-3">
            AiVIS.biz is designed, built, and maintained by Ryan Mason / Intruvurt Labs, LLC. The
            platform would not be possible without the collective work of the open-source community,
            the researchers and engineers at the provider organisations listed above, and the early
            users whose feedback shaped the core pipeline.
          </p>
        </section>

        {/* ── Related ── */}
        <nav className="grid sm:grid-cols-3 gap-4 pt-4" aria-label="Related pages">
          {[
            { to: '/security', label: 'Security Policy', sub: 'Disclosure & safeguards' },
            { to: '/privacy', label: 'Privacy Policy', sub: 'Data collection & retention' },
            { to: '/compliance', label: 'Compliance', sub: 'GDPR & regulatory posture' },
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
