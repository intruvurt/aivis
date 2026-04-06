# AiVIS

Evidence-backed AI visibility audits, citation verification, and remediation workflows for websites that need to be understood, trusted, and cited by AI systems.

## What AiVIS actually is

AiVIS is a monorepo product that audits a live site, grounds findings in scraped evidence, shows where AI systems fail to extract or trust the page, and routes users into remediation.

The product is designed for any public website, but it is especially useful for brands, startups, local businesses, agencies, and solo operators that feel AI-search traffic loss first.

Core operating loop:

1. Scan the site.
2. Ground the result in evidence.
3. Verify citation and authority surfaces.
4. Fix structural and content gaps.
5. Re-scan and measure movement.

## Architecture

```text
aivis/
|- client/   React 19 + Vite + Tailwind frontend
|- server/   Express 5 + TypeScript API
|- shared/   canonical contracts used by both layers
|- python/   optional FastAPI deep analysis service
|- tools/    smoke and verification scripts
`- docs/     product, wiring, and ops documentation
```

The server is the source of truth for tier access, usage enforcement, pricing truth, model routing, share permissions, and report persistence.

## Current product truths

- Evidence-backed audits are the core differentiator. Findings are tied back to scraped site data instead of invented explanations.
- Public report sharing already supports short human-readable paths such as `/reports/public/:shareId`, with legacy token URLs still resolving.
- Citation verification already goes beyond a single US-only search assumption. The backend checks multiple free public sources and adapts locale by market.
- Team workspace and multi-user operations already exist in the product and matter strategically as search clicks decline.
- The Python service is real, but optional. The Node pipeline continues if it is unavailable.

## AI analysis pipeline

AiVIS routes analysis through tier-aware model chains.

- `observer`: free-model chain optimized for low-cost structured JSON output.
- `alignment`: paid production audit chain with a primary model and fallback.
- `signal`: triple-check pipeline with deep analysis, peer critique, and validation.
- `scorefix`, `agency`, and `enterprise`: remediation-heavy and scaled operational tiers built on top of the same server-authoritative contracts.

The paid stack uses OpenRouter-backed providers. Signal includes a three-stage validation path and returns metadata such as `triple_check_enabled` and `model_count`.

## Citation and authority verification

The citation stack already uses real free verification sources.

- DuckDuckGo HTML search
- Bing HTML search
- DuckDuckGo Instant Answer
- Brave HTML search
- Yahoo HTML search
- Wikipedia OpenSearch

International coverage is already part of the backend. Search locale inference adapts queries for multiple markets including the US, UK, Canada, Australia, Germany, France, Spain, Brazil, Portugal, Italy, the Netherlands, Japan, India, Mexico, Turkey, Poland, and Sweden.

This means the platform is not limited to US-only authority assumptions. It still needs more validation depth over time, but the current codebase already supports globally aware verification.

## Canonical tiers

Canonical tier truth lives in `shared/types.ts`.

| Canonical tier | Display name | Billing |
| --- | --- | --- |
| `observer` | Observer (Free) | Free |
| `alignment` | Alignment (Core) | $49/mo ($348/yr) |
| `signal` | Signal (Pro) | $149/mo ($1300/yr) |
| `scorefix` | Score Fix [AutoFix PR] | $1499 one-time |

Selected entitlement highlights from the shared contract:

| Tier | Scans/month | Team workspaces | Share links | Triple-check | AutoFix PR |
| --- | ---: | --- | --- | --- | --- |
| `observer` | 3 | no | no | no | no |
| `alignment` | 60 | no | yes | no | no |
| `signal` | 110 | yes | yes | yes | yes |
| `scorefix` | 15 | no | yes | yes | yes |

## Key routes

Core:

- `POST /api/analyze`
- `GET /api/audits`
- `GET /api/analytics`
- `GET /api/health`
- `GET /api/pricing`

Auth:

- `POST /api/auth/register`
- `POST /api/auth/signin`
- `GET /api/auth/profile`

Growth and operational surfaces already in the product include competitors, citations, reverse engineering, mention tracking, MCP access, workspaces, agency surfaces, and admin routes.

## Local development

Important Windows note: this workspace lives under a username containing `$`. In PowerShell, always use `npm.cmd` and `npx.cmd` instead of bare `npm` or `npx`.

### Prerequisites

- Node.js 22.12+
- PostgreSQL
- OpenRouter API key

### Common commands

```bash
npm.cmd --prefix client install
npm.cmd --prefix server install
npm.cmd --prefix client run build
npm.cmd --prefix server run typecheck
```

### Root smoke scripts

```bash
npm.cmd run smoke:wiring:static
npm.cmd run smoke:features
npm.cmd run smoke:analyze
npm.cmd run smoke:visibility:gate
```

## Environment variables

Required server variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `OPEN_ROUTER_API_KEY` or `OPENROUTER_API_KEY`

Optional server variables:

- `SENTRY_DSN`
- `ADMIN_KEY`
- `OLLAMA_BASE_URL`
- `FRONTEND_URL`
- `PYTHON_SERVICE_URL`
- `PYTHON_INTERNAL_KEY`

Client variables:

- `VITE_API_URL`
- `VITE_SENTRY_DSN`

## Python deep analysis service

The Python service provides:

- NLP content analysis
- document parsing
- evidence ledger recording and verification
- content fingerprint generation and comparison

It is a real implementation, not a placeholder shell. It is also optional by design. If the Python service is unavailable, the Node server degrades cleanly and continues baseline audit flows.

Current limitation: the documented spaCy setup is English-first today, so the deep NLP layer is not yet equivalent to the broader locale-aware citation search layer.

## Security and platform rules

- `/api/analyze` keeps provider credentials server-side and rejects client-provided AI keys.
- Production URL validation rejects private, local, and loopback targets.
- Email verification is enforced before first protected usage.
- Share links and report access remain server-authoritative.

## What is still not proven end-to-end

The repository has real smoke scripts and at least one opt-in E2E auth test. What is not yet proven as full always-on smoke coverage is:

- public report sharing flow
- citation verification flow across all engines
- Python endpoint smoke coverage
- full cross-tier product journey automation

That is a real gap in verification coverage, not a gap in platform ambition.

## Related docs

- `docs/PLATFORM_WIRING_AND_SMOKE.md`
- `docs/CODEBASE_REVIEW_2026-04-02.md`
- `docs/FUTURE_PROOFING_Q2_ROADMAP.md`
- `python/README.md`

## License

Proprietary. All rights reserved.
