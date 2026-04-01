
`server/AGENTS.md`

```md id="67bx4u"
# server/AGENTS.md

## Server role

The server is the source of truth for:

- authentication
- usage enforcement
- AI model routing
- audit generation
- caching
- billing integration
- report/share permissions
- audit history persistence

If the client and server disagree, the server wins.

---

## Critical backend files

- `src/server.ts` — route wiring and middleware chain
- `src/middleware/securityMiddleware.ts` — Helmet, CSP nonce, DOMPurify sanitizer, Zod schemas, URL validator
- `src/services/aiProviders.ts` — provider selection, fallback, token budgets
- `src/services/webSearch.ts` — DuckDuckGo HTML + Bing web search scrapers (free, no API keys)
- `src/services/duckDuckGoSearch.ts` — DDG Instant Answer API (knowledge graph)
- `src/services/citationTester.ts` — citation test orchestration (all 3 search engines in parallel)
- `src/services/mentionTracker.ts` — brand mention scanner (15 free public sources, no API keys)
- `src/controllers/mentions.controllers.ts` — mention scan, history, timeline handlers
- `src/routes/mentions.ts` — `/api/mentions` routes (Alignment+ tier gate)
- `src/controllers/competitors.controllers.ts` — competitor CRUD, comparison logic, opportunity detection
- `src/services/postgresql.ts` — migrations and DB bootstrap

---

## Web search verification engines

Citation testing uses 3 free web search engines — no API keys required:

| Engine | Source key | Module | Method |
| --- | --- | --- | --- |
| DuckDuckGo HTML | `ddg_web` | `webSearch.ts` | `checkWebSearchPresence()` |
| Bing HTML | `bing_web` | `webSearch.ts` | `checkBingSearchPresence()` |
| DDG Instant Answer | `ddg_instant` | `duckDuckGoSearch.ts` | `checkDDGPresence()` |

All 3 run in parallel per citation query via `Promise.all` in `citationTester.ts`.

Source union type in `shared/types.ts`: `'ddg_web' | 'bing_web' | 'ddg_instant'`

No paid search APIs. No API keys. Bing and DDG HTML are scraped with rotating browser user agents.
- `src/services/scraper.ts` — crawl/extraction
- `src/services/AnalysisCacheService*` — cache strategy
- `src/services/emailService.ts` — all transactional + broadcast email (Resend API)
- `../shared/types.ts` — canonical cross-layer contract

---

## Security middleware

`src/middleware/securityMiddleware.ts` provides:

- **Helmet** — hardened HTTP headers applied to all responses
- **CSP nonce** — per-request nonce injected into Content-Security-Policy for inline scripts
- **DOMPurify sanitizer** — `sanitizeInput()` strips XSS from user-supplied strings
- **Zod schemas** — `loginSchema`, `registerSchema`, `supportTicketSchema` for request validation
- **URL validator** — `isSafeExternalUrl()` rejects private/loopback/internal targets
- **Bootstrap escaper** — `escapeBootstrapState()` prevents JSON injection in SSR payloads

Wired into `server.ts` (global Helmet + CSP), `authControllerFixed.ts` (Zod + sanitize on login/register), and `supportTicketController.ts` (Zod + sanitize on ticket creation).

All user-facing string inputs on protected routes must pass through `sanitizeInput()` before persistence or rendering.

---

## Competitor tracking

`src/controllers/competitors.controllers.ts` handles:

- CRUD for `competitor_tracking` table
- Comparison logic: dynamic opportunity detection across schema types, content depth, heading structure, FAQ, meta description, canonical tag, viewport meta, page speed
- Advantages calculation filtered to audited competitors only
- Auto-discovery from audit history
- Monitoring toggle and frequency config

Opportunity detection loops all `schema_types[]` dynamically — do not hardcode individual schema checks.

---

## Required route behavior

### Protected audit route order

Preserve this order for audit execution:

```ts
app.post("/api/analyze", authRequired, usageGate, incrementUsage, handler);
```

### Admin endpoints

All admin routes require `x-admin-key` header validated via `requireAdminKey()` (timing-safe comparison against `ADMIN_KEY` env var). Rate limited via `adminLimiter` (5 req / 30s).

Key admin endpoints:

- `POST /api/admin/cache/clear` — clear analysis cache
- `POST /api/admin/indexnow/ping` — submit URLs to IndexNow
- `POST /api/admin/verify-user` — force-verify a user
- `POST /api/admin/set-tier` — manually set canonical tier
- `POST /api/admin/newsletter/preview` — preview/test newsletter email
- `GET/POST /api/admin/newsletter/settings` — newsletter config
- `POST /api/admin/newsletter/dispatch` — trigger newsletter send
- `GET /api/admin/newsletter/editions` — list newsletter editions
- `POST /api/admin/newsletter/editions` — create/upsert newsletter edition
- `POST /api/admin/broadcast/preview` — preview/test broadcast email
- `POST /api/admin/broadcast/send` — send broadcast to eligible users
- `GET /api/admin/db/stats` — database table sizes and row counts
- `POST /api/admin/db/cleanup` — trigger immediate DB cleanup
- `GET /api/admin/health-deep` — deep health check (DB, memory, uptime)

Full documentation: `docs/ADMIN_PORTAL.md`