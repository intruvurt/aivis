# Full Codebase Review - 2026-04-02

## Scope and methodology

This review covers the full monorepo surface (`client/`, `server/`, `shared/`) using:

- static architecture inspection of the canonical files documented in the repository mission,
- TypeScript typecheck,
- ESLint for client and server,
- broad code-health metrics (file counts, `any` usage, hotspot file sizes, maintenance markers).

## Executive summary

- **Architecture direction is solid**: shared canonical tier contracts are centralized in `shared/types.ts`, and server middleware includes meaningful security controls (Helmet, CSP nonce, input schemas, URL SSRF guard).
- **Current delivery risk is high** due to lint debt: lint currently fails with **741 issues in client** and **1635 issues in server**, including **296 total errors** that block "clean CI" expectations.
- **Type safety is incomplete at scale**: `typecheck` passes, but lint identifies widespread `any` usage and undefined browser/runtime globals, indicating correctness and runtime-hardening gaps.
- **Monolithic hotspots** (4k–10k line files) are creating maintenance and regression risk; high-complexity files align with many lint findings.

## Key findings

### 1) Shared contracts and tier governance are in the right place

The canonical tier model, alias mapping, and entitlement helpers are consolidated in `shared/types.ts`, matching the repo rule that shared contract behavior must be centralized first.

**Impact:** strong cross-layer consistency foundation.

## 2) Security baseline is present and meaningful

`server/src/middleware/securityMiddleware.ts` implements:

- Helmet with explicit CSP handling,
- per-request CSP nonce,
- additional hardening headers,
- HTML sanitization path with DOMPurify + JSDOM,
- SSRF protection checks in `isSafeExternalUrl`,
- Zod schemas for sensitive request surfaces.

**Impact:** security posture is materially better than average for monorepo APIs.

## 3) Lint health is the largest immediate engineering risk

### Client lint status

`npm run lint` reports **741 problems (284 errors, 457 warnings)**.

Frequent hard failures include:
- undefined browser globals (`EventSource`, `FileReader`, `btoa`, `SpeechRecognition`, etc.),
- React purity rule violations (`Date.now`, `Math.random` in render path),
- JSX escaped character violations,
- no-undef in component/runtime contexts.

### Server lint status

`npm --prefix server run lint` reports **1635 problems (12 errors, 1623 warnings)**.

Frequent findings include:
- extensive `any` usage,
- high volume `console.*` rule breaches,
- tooling script globals failing lint (`process`, `console` not defined in `server/tools/stageClientDist.mjs`),
- configuration warning indicating flat-config migration pressure for eslint-env comments.

**Impact:** lint error volume likely obscures real regressions and increases merge risk.

## 4) Codebase scale and complexity hotspots

Measured TS/TSX size:

- **430** source files across `client/src`, `server/src`, `shared`.
- **1578** direct `any` occurrences (`\bany\b`).
- Largest files include:
  - `server/src/server.ts` (~10,437 lines)
  - `client/src/views/Dashboard.tsx` (~4,145 lines)
  - `shared/types.ts` (~2,981 lines)
  - `server/src/controllers/citations.controllers.ts` (~2,649 lines)

**Impact:** large-file concentration makes refactoring, review quality, and defect isolation harder.

## 5) Legacy surfaces are still active and raise cognitive load

Repository still contains explicit legacy/fixed compatibility patterns (e.g., `authControllerFixed`, legacy tier alias support, migration notes in DB bootstrap comments).

**Impact:** not necessarily wrong, but raises onboarding and change-risk unless boundaries are documented and enforced by tests.

## Prioritized remediation plan

### P0 (next sprint)

1. **Stabilize lint in CI**
   - Separate "error-only gate" from warnings.
   - Fix all current lint **errors** first (client + server tools).
2. **Fix runtime global definitions**
   - Add correct env globals/types to lint config per target runtime.
3. **Patch React purity violations**
   - Move non-deterministic calls out of render paths.

### P1

4. **Reduce `any` footprint in high-risk modules**
   - Start with API boundaries, auth, citations, and web search services.
5. **Introduce file-size guardrails**
   - Add soft threshold warnings for >1200 line modules.
6. **Start modular decomposition**
   - Break `server.ts` and `Dashboard.tsx` by feature slices.

### P2

7. **Legacy boundary hardening**
   - Document allowed legacy compatibility points and target sunset windows.
8. **Observability quality pass**
   - Standardize console-to-logger pathways to satisfy lint and improve incident triage.

## Suggested acceptance criteria for "review complete"

- Lint errors reduced to zero in both client and server.
- Top 5 largest files each reduced by at least 20% LOC or decomposed into feature modules.
- `any` count reduced by at least 25% in first pass.
- Security middleware and shared tier contract behavior covered by focused regression tests.

## Commands run

- `npm run -s typecheck`
- `npm run -s lint`
- `npm --prefix server run -s lint`
- `rg --files client/src server/src shared | wc -l`
- `rg -n "\bany\b" client/src server/src shared | wc -l`
- `rg --files client/src | wc -l`
- `rg --files server/src | wc -l`
- `rg --files shared | wc -l`
- `rg -n "TODO|FIXME|HACK|XXX" client/src server/src shared | wc -l`
- `find client/src server/src shared -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 wc -l | sort -nr | head -n 15`
- `rg -n "authControllerFixed|legacy|deprecated" server/src client/src shared | head -n 80`
