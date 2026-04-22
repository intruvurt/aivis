import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, KeyRound, Code2, AlertTriangle, Activity, Globe, Lock, Cpu } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  buildBreadcrumbSchema,
  buildTechArticleSchema,
  buildWebPageSchema,
} from '../lib/seoSchema';
import PublicPageFrame from '../components/PublicPageFrame';

export default function ApiDocsPage() {
  usePageMeta({
    title: 'API Docs | Auth, Endpoints, Timeline + Trust',
    description:
      'Developer docs for AiVIS.biz API: quickstart, API key auth, endpoint reference, scopes, timeline/trust outputs, and integration examples.',
    path: '/api-docs',
    structuredData: [
      buildTechArticleSchema({
        title: 'AiVIS.biz API Documentation',
        description:
          'Developer docs for AiVIS.biz REST API: quickstart, API key authentication, endpoint reference, scopes, error codes, and integration examples.',
        path: '/api-docs',
        proficiencyLevel: 'Expert',
        dependencies: 'AiVIS.biz API key · Alignment+ plan',
      }),
      buildWebPageSchema({
        path: '/api-docs',
        name: 'AiVIS.biz API Docs | Developer Reference',
        description:
          'Complete reference documentation for the AiVIS.biz AI visibility auditing API.',
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'API Docs', path: '/api-docs' },
      ]),
    ],
  });

  const sections = [
    {
      icon: BookOpen,
      title: 'Quickstart',
      points: [
        'Create an API key from your account feature settings.',
        'Call /api/v1/audits with Bearer avis_* key.',
        'Use /api/v1/usage to monitor metered API requests.',
        'Map outputs into your Scan -> Observe -> Diagnose -> Fix workflow.',
      ],
    },
    {
      icon: KeyRound,
      title: 'Authentication',
      points: [
        'External API uses API key auth: Authorization: Bearer avis_xxx.',
        'Session-auth routes under /api/features manage API keys.',
        'API keys are workspace-bound and can be disabled or revoked.',
      ],
    },
    {
      icon: Code2,
      title: 'Endpoint Surface',
      points: [
        'v1 endpoints include audits, analytics, competitors, evidence, usage, and page validation.',
        'Scopes: read:audits and read:analytics.',
        'Designed for integrations, reporting pipelines, sync jobs, and validation tooling.',
      ],
    },
    {
      icon: AlertTriangle,
      title: 'Troubleshooting',
      points: [
        '401 INVALID_API_KEY for missing/invalid/disabled/expired keys.',
        '403 INSUFFICIENT_SCOPE when key lacks required scope.',
        'Tier access and workspace isolation are enforced server-side on every key validation.',
        'Per-key request throttling is active to protect production API stability.',
      ],
    },
  ];

  const endpoints = [
    {
      method: 'GET',
      path: '/api/v1/audits',
      scope: 'read:audits',
      note: 'List audits with pagination',
    },
    {
      method: 'GET',
      path: '/api/v1/audits/:id',
      scope: 'read:audits',
      note: 'Get full audit payload',
    },
    {
      method: 'GET',
      path: '/api/v1/analytics',
      scope: 'read:analytics',
      note: 'Get score history grouped by URL',
    },
    {
      method: 'GET',
      path: '/api/v1/competitors',
      scope: 'read:audits',
      note: 'Get competitor tracking records',
    },
    {
      method: 'GET',
      path: '/api/v1/evidence/:auditId',
      scope: 'read:audits',
      note: 'Get evidence-focused audit view',
    },
    {
      method: 'GET',
      path: '/api/v1/usage',
      scope: 'read:audits',
      note: 'Get current-month metered API usage',
    },
    {
      method: 'POST',
      path: '/api/v1/page-validation',
      scope: 'read:audits',
      note: 'Run and store technical page validation',
    },
    {
      method: 'GET',
      path: '/api/v1/page-validation/:id',
      scope: 'read:audits',
      note: 'Fetch stored page validation record',
    },
    {
      method: 'GET',
      path: '/api/compliance/policy',
      scope: 'public',
      note: 'Consumer policy and disclaimer metadata',
    },
    {
      method: 'GET',
      path: '/api/compliance/consent',
      scope: 'session auth',
      note: 'List consent records for account/workspace',
    },
    {
      method: 'POST',
      path: '/api/compliance/consent',
      scope: 'session auth',
      note: 'Create or update consent status',
    },
  ];

  return (
    <PublicPageFrame
      icon={Code2}
      title="API Documentation"
      subtitle="Auth, endpoints, scopes, and trust/timeline-aware integration for the AiVIS.biz REST API"
      maxWidthClass="max-w-6xl"
    >
      <section>
        <div className="rounded-2xl border border-white/12 bg-charcoal-light/40 p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-300/40 bg-emerald-500/12 text-emerald-200 text-xs font-semibold tracking-[0.08em] uppercase">
            <Activity className="w-3.5 h-3.5" />
            Developer API
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
            AiVIS.biz API Documentation
          </h1>
          <p className="mt-3 text-white/75 max-w-3xl leading-relaxed">
            Everything needed to integrate with the real AiVIS.biz API: quickstart, API key auth,
            scopes, timeline-aware evidence flows, trust-state outputs, and production safe error
            handling.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center px-4 py-2 rounded-lg border border-emerald-300/45 bg-emerald-500/18 text-white font-medium">
              Production ready Reference
            </span>
            <Link
              to="/pricing#signal"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-white/15 bg-charcoal-light/65 text-white/90 font-medium hover:text-white hover:border-white/25 transition-colors"
            >
              View Tier Access
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Workspace-scoped API keys', value: 'Live', tone: 'cyan' },
            { label: 'Webhook dispatch', value: 'Enabled', tone: 'violet' },
            { label: 'Usage metering', value: 'Tracked', tone: 'emerald' },
            { label: 'Evidence-first payloads', value: 'Native', tone: 'amber' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/12 bg-charcoal-light/35 p-4"
            >
              <p className="text-[10px] uppercase tracking-wide text-white/50">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <article
                key={section.title}
                className="rounded-xl border border-white/12 bg-charcoal-light/35 p-5"
              >
                <div className="flex items-center gap-2 text-white">
                  <Icon className="w-4 h-4" />
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-white/75 leading-relaxed">
                  {section.points.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100/95">
          Paid tier reality: Alignment is paid but does not include external API key access. Signal
          and Score Fix include API access.
        </div>

        <div className="mt-6 rounded-xl border border-white/12 bg-charcoal-light/35 p-5">
          <h2 className="text-lg font-semibold">Elite-level API capabilities</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              'Workspace-bound API keys with scope enforcement',
              'Webhook delivery for audit and rescan completion events',
              'Usage and metering visibility for production integrations',
              'Evidence-linked audit payloads for downstream reporting systems',
              'Tier-gated access enforced server-side on every request',
              'Technical validation and audit endpoints designed for automation workflows',
            ].map((capability) => (
              <div
                key={capability}
                className="rounded-xl border border-white/10 bg-charcoal px-4 py-3 text-sm text-white/78"
              >
                {capability}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/12 bg-charcoal-light/35 p-5">
          <h2 className="text-lg font-semibold">Endpoint Reference (v1)</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/70 border-b border-white/10">
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Path</th>
                  <th className="py-2 pr-3">Scope</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((endpoint) => (
                  <tr
                    key={endpoint.path}
                    className="border-b border-white/5 text-white/85 align-top"
                  >
                    <td className="py-2 pr-3 text-emerald-200 font-medium">{endpoint.method}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{endpoint.path}</td>
                    <td className="py-2 pr-3 text-white/75">{endpoint.scope}</td>
                    <td className="py-2 text-white/75">{endpoint.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/12 bg-charcoal-light/35 p-5">
            <h3 className="text-base font-semibold">Quickstart cURL</h3>
            <pre className="mt-3 p-3 rounded-lg bg-charcoal border border-white/10 text-xs text-white/85 overflow-x-auto">
              {`curl "https://api.aivis.biz/api/v1/audits?limit=25" \\
  -H "Authorization: Bearer avis_xxxxxxxxxxxxxxxxx"`}
            </pre>
          </div>
          <div className="rounded-xl border border-white/12 bg-charcoal-light/35 p-5">
            <h3 className="text-base font-semibold">Common Errors</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li>
                • 401 INVALID_API_KEY: key missing, invalid, disabled, expired, or not entitled by
                tier
              </li>
              <li>• 403 INSUFFICIENT_SCOPE: key exists but lacks required operation scope</li>
              <li>• 404 Audit/Page not found: audit ID is outside your workspace scope</li>
              <li>
                • 409 Truth-state mismatch: timeline/event references are outside workspace scope
              </li>
              <li>
                • 400 Validation failed: unsupported, invalid, private, or localhost URL passed to
                page validation
              </li>
            </ul>
          </div>
        </div>

        {/* ── Integration Discovery ────────────────────────────────── */}
        <div className="mt-10 mb-2">
          <h2 className="text-2xl font-bold tracking-tight">Integration Discovery</h2>
          <p className="mt-1 text-sm text-white/60">
            Three ways for third-party tools and AI agents to find and connect with AiVIS.biz
            automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* OpenAPI */}
          <div className="rounded-xl border border-cyan-400/25 bg-charcoal-light/35 p-5">
            <div className="flex items-center gap-2 text-cyan-300">
              <Globe className="w-4 h-4" />
              <h3 className="text-base font-semibold">OpenAPI 3.0 Spec</h3>
            </div>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Machine-readable API definition at a single public URL. Import into Postman, generate
              SDKs, or feed directly to documentation engines.
            </p>
            <pre className="mt-3 p-3 rounded-lg bg-charcoal border border-white/10 text-xs text-white/85 overflow-x-auto">
              {`GET /api/v1/openapi.json`}
            </pre>
            <ul className="mt-3 space-y-1.5 text-xs text-white/60">
              <li>• Public - no auth required</li>
              <li>• Full request/response schemas for all v1 endpoints</li>
              <li>• Security scheme documents Bearer avis_* auth</li>
              <li>• Cache-friendly with 1-hour max-age</li>
            </ul>
          </div>

          {/* OAuth 2.0 */}
          <div className="rounded-xl border border-violet-400/25 bg-charcoal-light/35 p-5">
            <div className="flex items-center gap-2 text-violet-300">
              <Lock className="w-4 h-4" />
              <h3 className="text-base font-semibold">OAuth 2.0</h3>
            </div>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Authorization Code flow lets third-party apps request user consent and receive scoped
              access tokens - no API key sharing required.
            </p>
            <pre className="mt-3 p-3 rounded-lg bg-charcoal border border-white/10 text-xs text-white/85 overflow-x-auto">
              {`POST /api/oauth/clients      # Register app
GET  /api/oauth/authorize    # User consent
POST /api/oauth/token        # Code → token
POST /api/oauth/revoke       # Revoke token`}
            </pre>
            <ul className="mt-3 space-y-1.5 text-xs text-white/60">
              <li>• Scopes: read:audits, read:analytics</li>
              <li>• Access tokens prefixed avist_* (1 hour TTL)</li>
              <li>• HTTPS redirect URIs required (localhost for dev)</li>
              <li>• Client registration from your account settings</li>
            </ul>
          </div>

          {/* MCP */}
          <div className="rounded-xl border border-amber-400/25 bg-charcoal-light/35 p-5">
            <div className="flex items-center gap-2 text-amber-300">
              <Cpu className="w-4 h-4" />
              <h3 className="text-base font-semibold">MCP Server</h3>
            </div>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Model Context Protocol endpoint for AI agents. Agents discover and call AiVIS.biz
              tools natively - audit, analytics, evidence, and validation.
            </p>
            <pre className="mt-3 p-3 rounded-lg bg-charcoal border border-white/10 text-xs text-white/85 overflow-x-auto">
              {`GET  /api/mcp            # Server info
GET  /api/mcp/tools      # List tools
POST /api/mcp/call       # Execute tool`}
            </pre>
            <ul className="mt-3 space-y-1.5 text-xs text-white/60">
              <li>• 7 tools: audits, analytics, evidence, validation, competitors, usage</li>
              <li>• Auth: Bearer avis_* or avist_* tokens accepted</li>
              <li>• JSON-RPC style call with tool name + arguments</li>
              <li>• Scope-gated per tool, workspace-isolated</li>
            </ul>
          </div>
        </div>

        {/* MCP Agent Config Example */}
        <div className="mt-4 rounded-xl border border-white/12 bg-charcoal-light/35 p-5">
          <h3 className="text-base font-semibold">AI Agent Configuration Example</h3>
          <pre className="mt-3 p-3 rounded-lg bg-charcoal border border-white/10 text-xs text-white/85 overflow-x-auto">
            {`{
  "mcpServers": {
    "aivis": {
      "url": "https://api.aivis.biz/api/mcp",
      "headers": {
        "Authorization": "Bearer avis_your_api_key_here"
      }
    }
  }
}`}
          </pre>
          <p className="mt-2 text-xs text-white/50">
            Add this to your AI agent's MCP config. The agent will auto-discover available tools via
            /api/mcp/tools.
          </p>
        </div>
      </section>
    </PublicPageFrame>
  );
}
