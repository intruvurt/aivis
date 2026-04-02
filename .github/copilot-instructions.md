# AI Coding Agent Instructions for AI Visibility Engine

## Architecture overview
- **Monorepo**: `client/` (Vite + React 19 + Tailwind), `server/` (Express 5 + TypeScript), `shared/` (types shared between both)
- **Data flow**: `POST /api/analyze` → `authRequired` → `usageGate` → `incrementUsage` → `scraper.ts` (Puppeteer) → multi-model AI chain via `callAIProvider()` → `AnalysisCacheService` → JSON response
- **Entry points**: [client/src/main.tsx](client/src/main.tsx) (React router), [server/src/server.ts](server/src/server.ts) (Express routes)

## Development commands

> **Terminal rule:** The workspace owner's Windows username contains `$` (`Ma$e`). PowerShell treats `$e` as a variable, breaking paths. **Always use `npm.cmd` / `npx.cmd`** instead of bare `npm` / `npx` in terminal commands.

```bash
# Client (from client/)
npm.cmd install && npm.cmd run dev     # Vite dev server on :5173
npm.cmd test                           # Vitest
npm.cmd run typecheck                  # tsc --noEmit

# Server (from server/)
npm.cmd install && npm.cmd run dev     # tsx watch on :3001
npm.cmd run build                      # Compile to dist/
```

## Critical conventions

### Shared types contract
[shared/types.ts](shared/types.ts) defines `CanonicalTier`, `TIER_LIMITS`, `TierLimits`, and tier conversion helpers (`uiTierFromCanonical`, `meetsMinimumTier`). **Any tier/limit change must update this file first** — both client and server import from it.

### Tier system (3-tier)
| Canonical | Display name | Monthly scans | Price |
|-----------|-------------|---------------|-------|
| `observer` | Observer (Free) | 5 | Free |
| `alignment` | Alignment (Core) | 25 | $9/mo |
| `signal` | Signal (Pro) | 100 | $29/mo |

Legacy aliases (`free`, `core`, `premium`, `pro`, `enterprise`) map through `uiTierFromCanonical()`.

### AI providers
[server/src/services/aiProviders.ts](server/src/services/aiProviders.ts) exports `PROVIDERS` (paid), `FREE_PROVIDERS` (free-tier), and `callAIProvider()`. Actual prompt logic lives in [server/src/config/aiProviders.ts](server/src/config/aiProviders.ts).

**Tier-based model allocation (cost-optimised):**
- **Observer (free):** `FREE_PROVIDERS.slice(0, 2)` — **$0.00/scan**. Uses OpenRouter `:free` model variants (Llama 3.3 70B Instruct free primary, Google Gemma 3 27B free fallback). Both are non-reasoning models chosen specifically because they reliably produce JSON without wasting tokens on `<think>` chain-of-thought blocks. Rate-limited by OpenRouter but zero cost. Extended fallback chain (6 models total): Llama 3.3 70B → Gemma 3 27B → Mistral Small 3.1 24B → Gemma 3 12B → Hermes 3 405B → Nemotron 3 Nano 30B. All verified against OpenRouter `/api/v1/models` on 2026-02-25.
- **Alignment ($9/mo):** `PROVIDERS.slice(0, 2)` — **~$0.002/scan**. DeepSeek V3 (primary), Gemma 3 27B paid (fallback only).
- **Signal ($29/mo):** `PROVIDERS.slice(0, 3)` — **~$0.004/scan**. **Triple-Check Pipeline** (3 models). DeepSeek V3 deep analysis → Gemma 3 27B peer critique (score adjustment −15 to +10, extra recommendations) → Llama 3.3 70B validation gate (confirms or overrides final score). Triple-check is Signal-exclusive; the progress overlay adapts dynamically.

`callAIProvider` forwards `opts.max_tokens` through to `openrouterPrompt()`. Right-sized per stage: AI1=5000, AI2=600, AI3=400. AI2 and AI3 run sequentially after AI1. Each has a deadline-based timeout derived from the remaining pipeline budget (57 s total). The per-call HTTP timeout is 30 s. The primary AI deadline is capped at 25 s to guarantee the fallback chain gets ≥ 14 s. The fallback floor is 8 s per model (raised from 5 s). Deadline timers are cleared via `clearTimeout` after each `Promise.race` settles to prevent ghost responses from leaked timers. The response includes `triple_check_enabled` (boolean) and `model_count` (1, 2, or 3). Truncated JSON from models hitting max_tokens is auto-repaired by `repairTruncatedJson()` in `safeJsonParse`.

**Recommendation output:** The prompt requests 8-12 recommendations with no artificial cap. Client-side rendering (RecommendationList, ComprehensiveAnalysis keypoints, DocumentGenerator exports) shows ALL recommendations returned by the AI — no slicing or truncation.

### Middleware chain for protected routes
```typescript
app.post('/api/analyze', authRequired, usageGate, incrementUsage, handler);
```
- `authRequired`: validates JWT, enforces email verification, sets `req.user`
- `usageGate`: checks monthly scan limit against `usage_daily` table (skipped in dev)
- `incrementUsage`: increments daily usage counter

### Security rules
- `/api/analyze` **rejects client-provided API keys** (server-only `OPENROUTER_API_KEY`)
- URL validation blocks private/localhost IPs via `isPrivateOrLocalHost()` in production
- Cache keyed by case-insensitive URL in `analysis_cache` table

## Environment variables

### Server (required)
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — Signs user tokens
- `OPEN_ROUTER_API_KEY` or `OPENROUTER_API_KEY` — AI provider auth

### Server (optional)
- `SENTRY_DSN`, `ADMIN_KEY`, `OLLAMA_BASE_URL`, `FRONTEND_URL`

### Client (`client/.env`)
- `VITE_API_URL` — Backend base URL
- `VITE_SENTRY_DSN` — Client error tracking

## Database
Migrations auto-run at startup in [server/src/services/postgresql.ts](../server/src/services/postgresql.ts). Key tables: `users`, `user_sessions`, `usage_daily`, `analysis_cache`, `payments`, `audits`, `competitor_tracking`, `citation_tests`, `citation_results`, `licenses`.

## Key API routes
| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/analyze` | ✓ | Run AI visibility audit |
| `GET /api/audits` | ✓ | User's audit history |
| `GET /api/analytics` | ✓ | Score history & trends |
| `GET /api/health` | ✗ | Health check + DB ping |
| `GET /api/pricing` | ✗ | Tier pricing info |
| `POST /api/admin/cache/clear` | Admin | Clear analysis cache |
| `/api/auth/*` | varies | Auth routes (register, signin, profile) |
| `/api/payment/*` | varies | Stripe checkout, webhooks, pricing |
| `/api/competitors/*` | ✓ | Competitor tracking (Alignment+) |
| `/api/citations/*` | ✓ | Citation testing (Signal) |
| `/api/reverse-engineer/*` | ✓ | AI answer tools — decompile, ghost, model-diff, simulate (Alignment+) |
