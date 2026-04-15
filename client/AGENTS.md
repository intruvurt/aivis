# AI Coding Agent Instructions for Evidence-backed site analysis for AI answers Platform

## System overview

Evidence-backed site analysis for AI answers Platform is a monorepo with a React client, an Express API server, and a shared type layer that acts as the contract between both sides.

### Repository structure

- `client/` - Vite + React 19 + Tailwind frontend
- `server/` - Express 5 + TypeScript backend
- `shared/` - shared types, enums, tier definitions, helper contracts

### Core request flow

Protected audit execution follows this path:

```ts
POST /api/analyze
  -> authRequired
  -> usageGate
  -> incrementUsage
  -> scraper.ts (Puppeteer)
  -> AI model pipeline via callAIProvider()
  -> AnalysisCacheService
  -> JSON response
```

### Primary entry points

- `client/src/main.tsx` - app bootstrap and router mounting
- `server/src/server.ts` - Express app bootstrap and route registration

---

## Terminal commands: use npm.cmd / npx.cmd

The workspace owner's Windows path contains `$e` (`Ma$e`). PowerShell expands `$e` as a variable, breaking bare `npm`/`npx`. **Always use `npm.cmd` / `npx.cmd`** for all terminal operations.

## Development commands

### Client

Run from `client/`

```bash
npm.cmd install
npm.cmd run dev
npm.cmd test
npm.cmd run typecheck
```

### Server

Run from `server/`

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

---

## Non-negotiable engineering rules

### 1) Shared types are the source of truth

`shared/types.ts` is the canonical contract for:

- `CanonicalTier`
- `TierLimits`
- `TIER_LIMITS`
- tier conversion helpers
- tier comparison helpers such as `meetsMinimumTier`
- canonical-to-UI tier mapping via `uiTierFromCanonical`

If you change tier names, scan allowances, limits, access rules, or compatibility aliases, update `shared/types.ts` first.

Do not hardcode tier logic independently in client and server.

### 2) Canonical tier model

The platform runs on a 5-tier canonical system.

| Canonical key | Display name           | Monthly scans |         Price |
| ------------- | ---------------------- | ------------: | ------------: |
| `observer`    | Observer [Free]        |             3 |          Free |
| `starter`     | Starter                |            15 |       $15/mo  |
| `alignment`   | Alignment [Core]       |            60 |       $49/mo  |
| `signal`      | Signal [Pro]           |           110 |      $149/mo  |
| `scorefix`    | Score Fix [AutoFix PR] |   250 credits | $299 one-time |

Legacy aliases must resolve through canonical helpers, never through ad hoc string checks.

Supported legacy aliases include:

- `free` -> `observer`
- `core` -> `alignment`
- `premium` -> `signal`
- `elite` -> `scorefix`

### 3) Do not infer tier behavior from labels

Never infer entitlement from display strings like `"Premium"` or `"Observer [Free]"`.

Use canonical keys only.

Bad:

```ts
if (planName.includes("Premium")) { ... }
```

Good:

```ts
if (user.tier === "signal") { ... }
```

### 4) Client is never trusted for model access, pricing, or API keys

The client must never decide:

- which AI model chain is allowed
- whether a tier has access
- billing price truth
- usage allowance truth
- provider API keys

All of that is server-owned.

### 5) `/api/analyze` must remain server-key only

Client-provided provider keys are forbidden.

`OPENROUTER_API_KEY` / `OPEN_ROUTER_API_KEY` stays server-side only.

---

## AI provider architecture

AI provider orchestration lives in:

- `server/src/services/aiProviders.ts`

This module exports:

- `PROVIDERS` - paid fallback chain
- `FREE_PROVIDERS` - free-tier fallback chain
- `SIGNAL_AI1`
- `SIGNAL_AI2`
- `SIGNAL_AI3`
- `ALIGNMENT_PRIMARY`
- `callAIProvider()`

Prompt composition and provider routing logic also live there unless explicitly split into helper modules.

---

## Tier-based model allocation

Model usage is cost-optimized per plan and must stay aligned with pricing.

### Observer [Free]

Uses `FREE_PROVIDERS`

Target cost:

- **$0.00 / scan**

Purpose:

- free tier with zero direct model spend
- optimized for stable JSON generation
- avoids reasoning-heavy models that waste tokens on chain-of-thought formatting

Current free chain:

1. Gemma 4 31B free
2. Gemma 4 26B MoE free
3. Nemotron 3 Super 120B free
4. MiniMax M2.5 free
5. Nemotron 3 Nano 30B free
6. GPT-OSS 120B free

These are best-effort zero-cost fallbacks and may be rate-limited by OpenRouter.

### Alignment [Core]

Uses `ALIGNMENT_PRIMARY` + `PROVIDERS` fallback

Target cost:

- **~$0.001 / scan**

Primary behavior:

- GPT-5 Nano primary
- Claude Haiku 4.5 / Gemma class fallbacks
- then remaining paid provider chain

Purpose:

- cheap but reliable production scoring
- improved output stability over Observer
- still single-pass analysis

### Signal [Premium]

Uses a **Triple-Check Pipeline**

Target cost:

- **~$0.004 / scan**

Pipeline:

1. **AI1** - primary analysis
2. **AI2** - peer critique
3. **AI3** - validation gate

Current intended routing:

- AI1: GPT-5 Mini
- AI2: Claude Sonnet 4.6
- AI3: Grok 4.1 Fast

Behavior:

- AI2 can adjust score roughly within bounded range
- AI2 can add missing recommendations
- AI3 validates, confirms, or overrides final score
- if AI2 or AI3 fail, system must degrade gracefully to AI1-only result

Signal-exclusive requirements:

- triple-check overlay support
- response must expose `triple_check_enabled`
- response must expose `model_count`

### Score Fix [AutoFix PR]

Automated GitHub PR remediation tier via MCP. Not a subscription - users pay $299 per 250-credit pack and must repurchase when credits are exhausted. Each automated PR costs 10-25 credits depending on fix complexity.

Target cost:

- **~$0.015 / credit**

Behavior:

- same 3-stage structure as Signal
- more expensive models (GPT-5 Mini primary)
- looser timeout budget
- automated GitHub PR generation via MCP connections

Intended routing:

- AI1: GPT-5 Mini
- AI2: Claude Sonnet 4.6
- AI3: Grok 4.1 Fast

Billing model:

- $299 one-time per 250-credit pack
- 10-25 credits per automated GitHub PR fix
- no recurring subscription
- user must repurchase when credits are exhausted
- legacy alias `elite` maps to `scorefix`

---

## AI pipeline timing and token rules

`callAIProvider` must pass `opts.max_tokens` through to downstream provider calls.

Current stage token sizing:

- AI1 = `5000`
- AI2 = `600`
- AI3 = `400`

Current timing model:

- total pipeline budget: `52s`
- per-call HTTP timeout: `30s`
- deadline timers must be cleared after `Promise.race` settles
- never leave orphan timeout handlers alive

If any stage times out:

- recover gracefully
- do not crash the whole request unless no usable analysis remains

### JSON repair requirement

Model outputs may be truncated at token limits.

`safeJsonParse()` must use `repairTruncatedJson()` before giving up.

This is mandatory for resilient parsing.

---

## Recommendation output rules

The AI prompt should request:

- **8 to 12 recommendations**
- no fake cap lower than that
- no silent truncation

Client renderers must display all returned recommendations.

Do not slice recommendations in:

- recommendation lists
- comprehensive analysis blocks
- exports
- document generation
- PDF or JSON exports

If recommendations are missing, fix the pipeline or prompt. Do not hide the issue by clipping arrays.

---

## Protected route middleware contract

Protected analysis routes should follow this chain order:

```ts
app.post("/api/analyze", authRequired, usageGate, incrementUsage, handler);
```

### `authRequired`

Responsibilities:

- validate JWT
- require verified account when applicable
- attach `req.user`
- block unauthorized access

### `usageGate`

Responsibilities:

- check monthly tier limit
- read current usage from `usage_daily`
- enforce scan ceilings
- may be skipped in local dev if explicitly configured

### `incrementUsage`

Responsibilities:

- increment usage after request passes gate
- persist daily usage row
- keep usage accounting aligned with billing logic

Do not reorder these arbitrarily.

---

## Security rules

### URL safety

In production, audit targets must reject:

- localhost
- loopback
- private IP ranges
- internal network hosts

This logic belongs in `isPrivateOrLocalHost()` or equivalent hardened validator.

### Cache safety

Analysis cache keys must be normalized case-insensitively by URL.

Do not let:

- `EXAMPLE.com`
- `example.com/`
- `https://example.com`

fragment cache identity unnecessarily without intentional normalization rules.

### Secrets

Secrets must only come from server environment variables.

Never expose:

- OpenRouter keys
- Stripe secret keys
- JWT secret
- admin keys
- internal provider credentials

### Share links and public views

Any public snapshot/share route must be:

- explicitly generated
- non-guessable
- permission-aware
- optionally redacted by tier

Never expose private report internals by simply sharing internal audit IDs.

---

## Environment variables

### Required server environment variables

- `DATABASE_URL` - Supabase PostgreSQL connection string (PgBouncer pooler — `sslmode=require` enforced automatically)
- `JWT_SECRET` - JWT signing secret
- `OPENROUTER_API_KEY` or `OPEN_ROUTER_API_KEY` - provider auth

### Optional server environment variables

- `SENTRY_DSN`
- `ADMIN_KEY`
- `OLLAMA_BASE_URL`
- `FRONTEND_URL`
- `DATABASE_CA_CERT` / `PG_CA_CERT` - CA cert for Railway/managed Postgres with verified SSL

### Client environment variables

Inside `client/.env`

- `VITE_API_URL` - backend base URL
- `VITE_SENTRY_DSN` - frontend error reporting
- `VITE_SUPABASE_URL` - Supabase project URL (used by `client/src/utils/supabase.ts` SDK helper)
- `VITE_SUPABASE_ANON_KEY` - Supabase anon/public key (preferred naming; legacy `VITE_SUPABASE_PUBLISHABLE_KEY` also accepted)

---

## Database model

Migrations auto-run at startup in:

- `server/src/services/postgresql.ts`

Core tables include:

- `users`
- `user_sessions`
- `usage_daily`
- `analysis_cache`
- `payments`
- `audits`
- `competitor_tracking`
- `citation_tests`
- `citation_results`
- `licenses`

Do not add billing, audits, or entitlement logic without checking how those tables already interact.

---

## Key API endpoints

| Endpoint                       | Auth                  | Purpose                                 |
| ------------------------------ | --------------------- | --------------------------------------- |
| `POST /api/analyze`            | required              | Run AI visibility audit                 |
| `POST /api/analyze/upload`     | required              | Run upload-based audit                  |
| `GET /api/audits`              | required              | User audit history                      |
| `GET /api/audits/:id`          | required              | Specific audit snapshot                 |
| `GET /api/audits/target-count` | required              | Audit count for a normalized target     |
| `GET /api/analytics`           | required              | Score history and trend data            |
| `GET /api/health`              | public                | Health check and DB ping                |
| `GET /api/pricing`             | public or semi-public | Tier pricing info if exposed separately |
| `GET /api/payment/pricing`     | public                | Stripe-backed pricing truth             |
| `POST /api/payment/checkout`   | required              | Create checkout session                 |
| `POST /api/payment/portal`     | required              | Stripe billing portal                   |
| `POST /api/admin/cache/clear`  | admin                 | Clear analysis cache                    |
| `/api/auth/*`                  | varies                | Auth flows                              |
| `/api/payment/*`               | varies                | Billing, checkout, webhooks             |
| `/api/competitors/*`           | required              | Competitor tracking, Alignment+         |
| `/api/citations/*`             | required              | Citation testing, Signal+               |

### Web search verification engines

Citation testing verifies brand presence across 3 free web search engines (no API keys):

| Engine | Source key | UI color |
| --- | --- | --- |
| DuckDuckGo HTML | `ddg_web` | cyan |
| Bing HTML | `bing_web` | blue |
| DDG Instant Answer | `ddg_instant` | emerald |

All 3 results are rendered per query in `CitationTracker.tsx` via `WebSearchCard`.
Summary stats include `web_search_found_rate`, `bing_found_rate`, `ddg_found_rate` and corresponding average positions.
| `/api/reverse-engineer/*`      | required              | Decompile, ghost, diff, simulate tools  |

---

## Frontend architecture rules

### Dashboard data contract

The dashboard should not invent metrics.

It must derive from real analysis fields such as:

- `visibility_score`
- `content_analysis.word_count`
- `schema_markup.json_ld_count`
- `technical_signals.response_time_ms`
- `technical_signals.https_enabled`
- `recommendations`
- `keyword_intelligence`
- `topical_keywords`
- `ai_platform_scores`

### Section ordering

Dashboard section ordering is user-configurable and persisted locally.

If changing section keys, also update:

- persisted storage key handling
- normalization logic
- visible section composition logic

### History rules

`useAnalysisStore().history` is local client memory/history, not canonical server truth.

Server audit history must come from:

- `/api/audits`
- `/api/analytics`

If both are merged, dedupe by normalized target and timestamp.

### Share/report rules

Downloaded reports must include:

- report metadata
- URL
- analyzed timestamp
- visibility score
- full analysis payload
- goal alignment if present
- export timestamp

Do not export partial shells that omit the actual audit result.

---

## Billing and pricing rules

### Pricing truth

Pricing display must come from the live backend billing endpoint when available.

Do not hardcode live Stripe price truth into the UI.

Frontend may provide fallback presentation, but server pricing is canonical.

### Current plan detection

Do not infer current plan from display name.

Use canonical tier key from authenticated user or subscription payload.

### Checkout

Checkout requests must send:

```json
{
  "tier": "alignment | signal | scorefix",
  "billingPeriod": "monthly | yearly"
}
```

Observer/free should never attempt paid checkout.

---

## Reliability rules

### Graceful degradation

If AI2 or AI3 fail in triple-check mode:

- keep AI1 result if valid
- mark model count accordingly
- do not fail entire request unnecessarily

### Network failures

If frontend fetch fails:

- show clear retry guidance
- do not invent successful state
- keep last valid local result only if intentionally supported

### Abort behavior

Every long-running audit request must support cancellation and timeout cleanup.

Never leave stale overlay state or leaked timers.

---

## Coding agent operating rules

When editing this codebase:

1. Check `shared/types.ts` first for tier or contract changes.
2. Preserve canonical tier names.
3. Preserve middleware ordering on protected analysis routes.
4. Keep provider selection server-side.
5. Do not truncate recommendations unless product requirements explicitly change.
6. Keep JSON parsing resilient against truncated model output.
7. Use normalized URL keys for cache/history/report grouping.
8. Do not introduce UI-only truth for pricing, usage, or plan entitlements.
9. When uncertain, prefer explicit contracts over inferred behavior.
10. Any new feature touching audits, reports, billing, or AI routing must maintain backward compatibility with legacy `scorefix`.

---

## Quick mental model for contributors

This product is not “just an SEO auditor.”

It is a structured AI visibility system with five pressure points:

- crawlability
- extractability
- trust
- scoring consistency
- operational follow-through

Every meaningful change should improve at least one of those without breaking the others.
