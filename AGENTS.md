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
- `server/src/services/mentionTracker.ts` — brand mention scanner (15 free sources: Reddit, HN, Mastodon, DDG/Bing dork, Google News, GitHub, Quora, Product Hunt, Stack Overflow, Wikipedia, Dev.to, Medium, YouTube, Lobsters)
- `server/src/controllers/mentions.controllers.ts` — mention scan, history, timeline handlers
- `server/src/routes/mentions.ts` — `/api/mentions` routes (Alignment+ tier gate)
- `server/src/services/postgresql.ts` — DB bootstrap and migrations
- `server/src/services/emailService.ts` — transactional + broadcast email (Resend API)
- `client/src/pages/Admin.tsx` — admin portal (stats, newsletter, broadcast, tools)
- `client/src/lib/security/` — client-side sanitization (sanitize.ts, SafeHtml.tsx, SafeLink.tsx, auditChecklist.ts)
- `docs/ADMIN_PORTAL.md` — admin system documentation

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
- `alignment`
- `signal`
- `scorefix'### Not a tier

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