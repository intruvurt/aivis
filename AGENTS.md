# AGENTS.md

## Repository mission

AI Visibility Intelligence Platform is a monorepo for auditing whether websites are machine-readable, structurally extractable, and citation-ready inside AI-generated answers.

This repository has three active layers:

- `client/` — React application
- `server/` — Express API and audit engine
- `shared/` — canonical contracts used by both

The coding agent must treat `shared/` as the source of truth for cross-layer behavior.

---

## Repo map

- `client/src/main.tsx` — frontend app entry
- `server/src/server.ts` — backend app entry
- `shared/types.ts` — canonical tier + limits + helper contract
- `server/src/middleware/securityMiddleware.ts` — Helmet, CSP nonce, DOMPurify, Zod schemas, URL validator
- `server/src/services/aiProviders.ts` — model routing and AI execution
- `server/src/services/webSearch.ts` — DuckDuckGo HTML + Bing web search scrapers (free, no API keys)
- `server/src/services/duckDuckGoSearch.ts` — DDG Instant Answer API (knowledge graph)
- `server/src/services/citationTester.ts` — citation test orchestration (runs all 3 engines in parallel)
- `server/src/controllers/competitors.controllers.ts` — competitor CRUD + comparison + opportunity detection
- `server/src/services/mentionTracker.ts` — brand mention scanner (17 free sources: Reddit, HN, Mastodon, DDG/Bing dork, Google News, GitHub, Quora, Product Hunt, Stack Overflow, Wikipedia, Dev.to, Medium, YouTube, Lobsters, Bluesky, Twitter/X)
- `server/src/controllers/mentions.controllers.ts` — mention scan, history, timeline handlers
- `server/src/routes/mentions.ts` — `/api/mentions` routes (Alignment+ tier gate)
- `server/src/services/postgresql.ts` — DB bootstrap and migrations
- `server/src/services/emailService.ts` — transactional + broadcast email (Resend API)
- `client/src/pages/Admin.tsx` — admin portal (stats, newsletter, broadcast, tools)
- `client/src/lib/security/` — client-side sanitization (sanitize.ts, SafeHtml.tsx, SafeLink.tsx, auditChecklist.ts)
- `docs/ADMIN_PORTAL.md` — admin system documentation
- `server/src/routes/externalApiV1.ts` — v1 API (accepts both `avis_*` API keys and `avist_*` OAuth tokens)
- `server/src/routes/oauthRoutes.ts` — OAuth 2.0 (RFC 6749): client register, authorize, token, revoke. Scopes: `read:audits`, `read:analytics`, `write:audits`
- `server/src/routes/mcpServer.ts` — MCP JSON-RPC 2.0 server (Alignment+ tier gate, 15+ tools)
- `server/src/routes/webMcp.ts` — WebMCP browser-agent surface (Alignment+ tier gate, mirrors MCP tools)
- `server/src/routes/openApiSpec.ts` — OpenAPI 3.0.3 spec at `/api/v1/openapi.json`
- `client/src/components/AppShell.tsx` — authenticated app layout (sidebar + topbar + footer + outlet)
- `client/src/components/AppSidebar.tsx` — main sidebar navigation (Core, Evidence, Extensions, Platform, Agency, Resources, Account)
- `client/src/components/Footer.tsx` — site-wide footer (Platform, Resources, Company links)
- `client/src/content/blogs.ts` — blog post content (markdown links rendered via `renderInlineMarkdown`)

---

## Hard rules for all agents

### 0) Terminal commands: use npm.cmd / npx.cmd

The workspace owner's Windows username contains a `$` character (`Ma$e`). PowerShell interprets `$e` as an undefined variable, which corrupts paths resolved through `npm`, `npx`, or any command that expands the user profile path.

**Always use `npm.cmd` and `npx.cmd`** (the `.cmd` shim) instead of bare `npm` / `npx` when running terminal commands. This bypasses PowerShell's string interpolation and resolves the correct path.

```powershell
# WRONG — will fail with "The variable '$e' cannot be retrieved"
npm --prefix server run typecheck
npx tsc --noEmit

# CORRECT
npm.cmd --prefix server run typecheck
npx.cmd tsc --noEmit
```

This applies to all terminal invocations: installs, builds, typechecks, scripts, and dev servers.

### 1) Shared types first

If a change touches:

- tiers
- monthly limits
- access rules
- pricing-related tier metadata
- canonical plan names
- compatibility aliases

update `shared/types.ts` first.

Do not patch client and server separately and hope they stay aligned.

### 2) Canonical tiers only

The platform runs on these canonical tiers:

- `observer`
- `starter`
- `alignment`
- `signal`
- `scorefix` — not a subscription tier; one-time purchase

Legacy aliases must map into canonical keys through shared helpers.

Never build entitlement logic from human labels like `"Premium"` or `"Core"`.

### 3) Server owns truth

The server is authoritative for:

- plan access
- usage allowance
- pricing truth
- model routing
- provider credentials
- checkout eligibility
- share-link eligibility

The client may display state, but it must not invent it.

### 4) `/api/analyze` is a protected production path

Do not weaken these assumptions:

- auth is required
- usage is enforced
- AI keys stay server-side
- target URL validation must reject private or local hosts in production (via `isSafeExternalUrl()` in `securityMiddleware.ts`)
- all user string inputs pass through `sanitizeInput()` before persistence

### 5) Recommendations are not to be clipped

If AI returns 8 to 12 recommendations, render all of them unless product requirements explicitly change.

Do not silently slice arrays in UI or exports.

### 6) Graceful degradation matters

When a multi-stage AI pipeline partially fails:

- preserve valid earlier work
- degrade cleanly
- keep response shape stable
- do not crash the full audit unless no valid output remains

### 7) Reports must remain exportable and reproducible

Downloads and share views must preserve:

- URL
- analyzed timestamp
- visibility score
- analysis payload
- goal alignment if present
- export/share metadata

Avoid building report shells that omit the real audit content.

### 8) External API accepts both API keys and OAuth tokens

`/api/v1/*` routes authenticate via `Bearer avis_*` (API key) or `Bearer avist_*` (OAuth token). Both paths resolve `apiUserId`, `apiWorkspaceId`, `apiScopes`, and `apiTier` on the request.

### 9) MCP and WebMCP share the same Alignment+ tier gate

Both `/api/mcp/*` and `/api/webmcp/*` require Alignment or higher. Do not change one without the other. Both accept `avis_*`, `avist_*`, and JWT tokens.

### 10) Footer must render in both public and authenticated layouts

`PublicLayout.tsx` and `AppShell.tsx` both render `<Footer />`. Removing the footer from either layout makes documentation pages (blogs, FAQ, guide, privacy, terms, disclosures) unreachable.

### 11) Security headers

`securityMiddleware.ts` enforces `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` and `X-Frame-Options: DENY` on all responses.

---

## Architecture summary

### Audit flow

```ts
POST /api/analyze
  -> authRequired
  -> usageGate
  -> incrementUsage
  -> scraper.ts
  -> AI pipeline
  -> cache / persistence
  -> JSON response