 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/docs/CODEBASE_REVIEW_2026-04-02.md b/docs/CODEBASE_REVIEW_2026-04-02.md
new file mode 100644
index 0000000000000000000000000000000000000000..afe80a37fb7a5711bd6315cb74361a8d0b4353b9
--- /dev/null
+++ b/docs/CODEBASE_REVIEW_2026-04-02.md
@@ -0,0 +1,131 @@
+# Full Codebase Review (Top-to-Bottom)
+
+Date: 2026-04-02  
+Reviewer: Codex agent
+
+## Scope Reviewed
+
+This review covered repository structure, core architecture surfaces, static checks, and maintainability hotspots across:
+
+- `client/`
+- `server/`
+- `shared/`
+- selected root tooling/scripts
+
+## How the review was performed
+
+### Structural inventory
+- Counted tracked files (`rg --files | wc -l`): **759 files**.
+- Identified largest TypeScript/TSX files by line count to locate concentration risk.
+
+### Quality gates executed
+- `npm run typecheck` (root: client + server)
+- `npm run lint` (root: client + server)
+- `npm --prefix server test`
+- `npm --prefix client test -- --run`
+
+## Executive summary
+
+1. **TypeScript compile health is good**: full typecheck passes for both client and server.
+2. **Automated tests are healthy**: server and client Vitest suites pass.
+3. **Lint health is poor**: eslint currently reports **741 issues** (**284 errors, 457 warnings**) and fails fast in the client stage.
+4. **Architecture concentration risk is high**: several core files are very large (`server.ts` >10k lines; dashboard/view layers 2k–4k+), increasing defect and onboarding risk.
+5. **Core platform contracts look coherent**: canonical tier mapping in `shared/types.ts` remains explicit and centralized.
+
+## Detailed findings
+
+## 1) Contract and tier model integrity (Good)
+
+`shared/types.ts` still acts as an authoritative cross-layer contract for canonical tiers (`observer`, `alignment`, `signal`, `scorefix`) and compatibility aliases (`free`, `core`, `premium`, `elite`). Utility functions (`uiTierFromCanonical`, `canonicalTierFromUi`, `meetsMinimumTier`) are centralized and consistent with repository policy.
+
+Why this matters:
+- Keeps plan/entitlement drift lower between client and server.
+- Makes tier migration safer by preserving alias handling in one place.
+
+## 2) Security middleware baseline (Good with one caveat)
+
+Security middleware is applied globally at startup (`applySecurityMiddleware(app)`), and includes Helmet, CSP nonce generation, and additional secure headers. Input sanitization and schemas are present in `securityMiddleware.ts`.
+
+Caveat:
+- `isSafeExternalUrl` currently allows `mailto:` in its protocol allowlist. For generic “external URL” validation this may be broader than needed and can create policy confusion depending on callsites.
+
+Recommendation:
+- Split validators by use-case: one strict HTTP(S) URL validator for crawl/analyze targets and one broader validator for link/contact fields.
+
+## 3) Protected analyze path and middleware chain (Good)
+
+`/api/analyze` route includes authentication + usage enforcement and preserves server-authoritative checks. The route currently applies:
+
+`authRequired -> workspaceRequired -> heavyActionLimiter -> usageGate -> incrementUsage -> handler`
+
+This is a strong defensive chain and consistent with a production-protected path.
+
+## 4) Reliability and model routing posture (Good)
+
+`aiProviders.ts` includes:
+- explicit provider lists by tier context,
+- timeout wrapping with cleanup,
+- provider backoff memory for degraded upstream behavior,
+- per-call `max_tokens` passthrough.
+
+This is aligned with graceful-degradation goals for multi-stage AI workflows.
+
+## 5) Lint debt and frontend quality gate breakage (High priority)
+
+Lint run fails with broad issue classes:
+- browser globals flagged as undefined (e.g., `EventSource`, `FileReader`, `btoa`, `SpeechRecognition`, `crypto`),
+- React purity and hook dependency warnings,
+- unescaped entities in JSX,
+- many `any` and unused symbol warnings.
+
+Observed impact:
+- CI/quality confidence is degraded.
+- Signal-to-noise for real regressions is low.
+
+Recommendation:
+- Stage lint cleanup into phased PRs:
+  1) ESLint environment config correctness (browser globals and TS-aware rules),
+  2) fix all lint **errors** (make lint green),
+  3) then reduce warning budget by category.
+
+## 6) File-size concentration and maintainability risk (High priority)
+
+Largest files indicate significant single-file concentration:
+- `server/src/server.ts`: 10,437 lines
+- `client/src/views/Dashboard.tsx`: 4,145 lines
+- `shared/types.ts`: 2,981 lines
+- `client/src/views/ReverseEngineerPage.tsx`: 2,919 lines
+
+Risk:
+- harder reviews, slower safe refactors, higher merge-conflict frequency, and larger blast radius per change.
+
+Recommendation:
+- Create a decomposition roadmap focused on:
+  - route registration extraction from `server.ts` into feature routers,
+  - splitting large view pages into feature slices/hooks/presentational components,
+  - isolating `shared/types.ts` into tier contracts + analysis contracts + helpers.
+
+## Prioritized action plan
+
+### P0 (immediate)
+1. Make lint pass by resolving current lint errors and ensuring proper browser/global ESLint env for client TSX.
+2. Add CI gating strategy: fail on lint errors, optionally allow warnings initially with a tracked budget.
+
+### P1 (next sprint)
+1. Break down `server/src/server.ts` into route modules + orchestration bootstrap.
+2. Begin extracting `Dashboard.tsx` and `ReverseEngineerPage.tsx` into composable units.
+
+### P2 (near-term)
+1. Reduce `shared/types.ts` surface area into grouped modules while preserving import compatibility.
+2. Add architecture decision records (ADRs) for tier-contract and AI-pipeline boundaries.
+
+## Pass/fail snapshot
+
+- Typecheck: ✅ pass
+- Tests (server): ✅ pass
+- Tests (client): ✅ pass
+- Lint: ❌ fail (741 issues total)
+
+## Reviewer note
+
+The repository has strong product-contract intent and real platform depth, but immediate leverage is in restoring lint signal and reducing oversized-file risk. Doing those two items first should materially improve release safety and developer velocity.
 
EOF
) (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/reports/codebase-review-2026-04-02.md b/reports/codebase-review-2026-04-02.md
new file mode 100644
index 0000000000000000000000000000000000000000..ec037663bd72d98ec68a333e3962dd13434d0517
--- /dev/null
+++ b/reports/codebase-review-2026-04-02.md
@@ -0,0 +1,132 @@
+# Full Codebase Review — 2026-04-02
+
+## Scope and methodology
+
+This review covers the full monorepo surface (`client/`, `server/`, `shared/`) using:
+
+- static architecture inspection of the canonical files documented in the repository mission,
+- TypeScript typecheck,
+- ESLint for client and server,
+- broad code-health metrics (file counts, `any` usage, hotspot file sizes, maintenance markers).
+
+## Executive summary
+
+- **Architecture direction is solid**: shared canonical tier contracts are centralized in `shared/types.ts`, and server middleware includes meaningful security controls (Helmet, CSP nonce, input schemas, URL SSRF guard).
+- **Current delivery risk is high** due to lint debt: lint currently fails with **741 issues in client** and **1635 issues in server**, including **296 total errors** that block “clean CI” expectations.
+- **Type safety is incomplete at scale**: `typecheck` passes, but lint identifies widespread `any` usage and undefined browser/runtime globals, indicating correctness and runtime-hardening gaps.
+- **Monolithic hotspots** (4k–10k line files) are creating maintenance and regression risk; high-complexity files align with many lint findings.
+
+## Key findings
+
+### 1) Shared contracts and tier governance are in the right place
+
+The canonical tier model, alias mapping, and entitlement helpers are consolidated in `shared/types.ts`, matching the repo rule that shared contract behavior must be centralized first.
+
+**Impact:** strong cross-layer consistency foundation.
+
+## 2) Security baseline is present and meaningful
+
+`server/src/middleware/securityMiddleware.ts` implements:
+
+- Helmet with explicit CSP handling,
+- per-request CSP nonce,
+- additional hardening headers,
+- HTML sanitization path with DOMPurify + JSDOM,
+- SSRF protection checks in `isSafeExternalUrl`,
+- Zod schemas for sensitive request surfaces.
+
+**Impact:** security posture is materially better than average for monorepo APIs.
+
+## 3) Lint health is the largest immediate engineering risk
+
+### Client lint status
+
+`npm run lint` reports **741 problems (284 errors, 457 warnings)**.
+
+Frequent hard failures include:
+- undefined browser globals (`EventSource`, `FileReader`, `btoa`, `SpeechRecognition`, etc.),
+- React purity rule violations (`Date.now`, `Math.random` in render path),
+- JSX escaped character violations,
+- no-undef in component/runtime contexts.
+
+### Server lint status
+
+`npm --prefix server run lint` reports **1635 problems (12 errors, 1623 warnings)**.
+
+Frequent findings include:
+- extensive `any` usage,
+- high volume `console.*` rule breaches,
+- tooling script globals failing lint (`process`, `console` not defined in `server/tools/stageClientDist.mjs`),
+- configuration warning indicating flat-config migration pressure for eslint-env comments.
+
+**Impact:** lint error volume likely obscures real regressions and increases merge risk.
+
+## 4) Codebase scale and complexity hotspots
+
+Measured TS/TSX size:
+
+- **430** source files across `client/src`, `server/src`, `shared`.
+- **1578** direct `any` occurrences (`\bany\b`).
+- Largest files include:
+  - `server/src/server.ts` (~10,437 lines)
+  - `client/src/views/Dashboard.tsx` (~4,145 lines)
+  - `shared/types.ts` (~2,981 lines)
+  - `server/src/controllers/citations.controllers.ts` (~2,649 lines)
+
+**Impact:** large-file concentration makes refactoring, review quality, and defect isolation harder.
+
+## 5) Legacy surfaces are still active and raise cognitive load
+
+Repository still contains explicit legacy/fixed compatibility patterns (e.g., `authControllerFixed`, legacy tier alias support, migration notes in DB bootstrap comments).
+
+**Impact:** not necessarily wrong, but raises onboarding and change-risk unless boundaries are documented and enforced by tests.
+
+## Prioritized remediation plan
+
+### P0 (next sprint)
+
+1. **Stabilize lint in CI**
+   - Separate “error-only gate” from warnings.
+   - Fix all current lint **errors** first (client + server tools).
+2. **Fix runtime global definitions**
+   - Add correct env globals/types to lint config per target runtime.
+3. **Patch React purity violations**
+   - Move non-deterministic calls out of render paths.
+
+### P1
+
+4. **Reduce `any` footprint in high-risk modules**
+   - Start with API boundaries, auth, citations, and web search services.
+5. **Introduce file-size guardrails**
+   - Add soft threshold warnings for >1200 line modules.
+6. **Start modular decomposition**
+   - Break `server.ts` and `Dashboard.tsx` by feature slices.
+
+### P2
+
+7. **Legacy boundary hardening**
+   - Document allowed legacy compatibility points and target sunset windows.
+8. **Observability quality pass**
+   - Standardize console-to-logger pathways to satisfy lint and improve incident triage.
+
+## Suggested acceptance criteria for "review complete"
+
+- Lint errors reduced to zero in both client and server.
+- Top 5 largest files each reduced by at least 20% LOC or decomposed into feature modules.
+- `any` count reduced by at least 25% in first pass.
+- Security middleware and shared tier contract behavior covered by focused regression tests.
+
+## Commands run
+
+- `npm run -s typecheck`
+- `npm run -s lint`
+- `npm --prefix server run -s lint`
+- `rg --files client/src server/src shared | wc -l`
+- `rg -n "\bany\b" client/src server/src shared | wc -l`
+- `rg --files client/src | wc -l`
+- `rg --files server/src | wc -l`
+- `rg --files shared | wc -l`
+- `rg -n "TODO|FIXME|HACK|XXX" client/src server/src shared | wc -l`
+- `find client/src server/src shared -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 wc -l | sort -nr | head -n 15`
+- `rg -n "authControllerFixed|legacy|deprecated" server/src client/src shared | head -n 80`
+
 
EOF
) (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/docs/CODEBASE_REVIEW_2026-04-02.md b/docs/CODEBASE_REVIEW_2026-04-02.md
new file mode 100644
index 0000000000000000000000000000000000000000..15ae01f78b86a2da8762af2c5a3a54719bed52bc
--- /dev/null
+++ b/docs/CODEBASE_REVIEW_2026-04-02.md
@@ -0,0 +1,175 @@
+# AI Visibility Engine — Full Codebase Review (2026-04-02)
+
+## Scope and method
+
+This review covers the monorepo at a structural, quality, and operational level with emphasis on:
+
+- contract integrity between `shared/`, `server/`, and `client/`
+- security posture around input validation and URL safety
+- runtime reliability of the audit pipeline
+- developer ergonomics and maintainability signals
+
+Commands run:
+
+- `npm run typecheck`
+- `npm run lint`
+
+And focused source inspection of key cross-layer files:
+
+- `shared/types.ts`
+- `server/src/server.ts`
+- `server/src/middleware/securityMiddleware.ts`
+- `server/src/services/aiProviders.ts`
+- `server/src/services/citationTester.ts`
+- `client/src/main.tsx`
+
+---
+
+## Executive summary
+
+The codebase is feature-rich and clearly oriented around a strong server-authoritative architecture. Core controls are in place (tier contracts, route hardening primitives, provider abstraction, timeout budgeting), and type checking currently passes. However, lint health is severely degraded (741 total findings, 284 errors), creating substantial reliability and change-risk drag.
+
+### Overall scorecard
+
+- **Architecture direction:** Strong
+- **Security baseline design:** Strong, with specific hardening opportunities
+- **Type safety status:** Passing (`tsc --noEmit`)
+- **Code quality gate status:** Failing (`eslint` currently not enforceable as a merge gate)
+- **Operational risk level (current):** Medium-High due to lint debt and codebase sprawl in key modules
+
+---
+
+## What is working well
+
+### 1) Shared-contract-first tier model is well established
+
+`shared/types.ts` provides canonical tier definitions, legacy alias mapping, hierarchy ordering, and entitlement-like limits in one place. This is the right monorepo pattern and prevents client/server drift when followed consistently.
+
+### 2) Server truth boundary is explicit
+
+`server/src/server.ts` centralizes route wiring, auth/usage middleware references, and provider orchestration dependencies, reinforcing that sensitive logic remains server-side.
+
+### 3) Security middleware foundation is present
+
+`server/src/middleware/securityMiddleware.ts` includes Helmet usage, CSP nonce generation, DOMPurify sanitization utilities, Zod schemas for high-risk payloads, and external URL safety checks.
+
+### 4) AI provider abstraction is practical
+
+`server/src/services/aiProviders.ts` separates free vs paid provider chains and models tier-specific triples (`SIGNAL_*`, `SCOREFIX_*`), including provider backoff memory to improve resilience.
+
+### 5) Citation testing workflow is ambitious and modular
+
+`server/src/services/citationTester.ts` defines platform simulation prompts and includes multiple web verification tracks, with extensible platform/model candidate maps.
+
+---
+
+## Critical findings (priority ordered)
+
+## P0 — CI quality gate is effectively broken by lint volume
+
+`npm run lint` currently reports **741 issues (284 errors, 457 warnings)**. This means lint cannot serve as a practical protection layer and developers are incentivized to ignore it. High-volume categories include:
+
+- undefined browser/runtime globals (`no-undef`)
+- JSX entity escaping issues (`react/no-unescaped-entities`)
+- hook purity issues (`react-hooks/purity`)
+- widespread `any` and unused-symbol noise
+
+**Impact:** elevated regression probability, hidden defects, and slow code reviews.
+
+**Recommendation:**
+
+1. Establish a staged lint remediation plan (baseline snapshot + ratchet).
+2. Make new/changed files lint-clean mandatory first, then burn down backlog.
+3. Split client lint config by browser vs node contexts to eliminate false positives.
+
+---
+
+## P1 — `server.ts` concentration risk
+
+`server/src/server.ts` has become a highly concentrated orchestration surface with broad imports and mixed concerns. While functionally central, its current size and responsibility density increase blast radius for edits.
+
+**Impact:** onboarding friction, brittle merges, harder incident response.
+
+**Recommendation:**
+
+- carve out route registrars by domain (`audit`, `admin`, `billing`, `mentions`, etc.)
+- isolate long-lived pipeline helpers into dedicated modules
+- retain `server.ts` as composition root only
+
+---
+
+## P1 — URL safety logic split across modules may drift
+
+There is URL/private-host safety logic in `securityMiddleware.ts` and additional URL normalization/safety helpers referenced from `server.ts` (`lib/urlSafety`). The architecture is valid, but duplicated policy surfaces can diverge over time.
+
+**Impact:** inconsistent request acceptance/rejection under edge cases.
+
+**Recommendation:**
+
+- define one canonical URL safety policy module and consume everywhere
+- add explicit security tests for loopback, private IP, IDN/punycode, and rebinding-like host patterns
+
+---
+
+## P2 — AI model comments vs configuration may drift quickly
+
+`aiProviders.ts` contains time-stamped model strategy comments and fixed model identifiers. This is good for intent tracking but can become stale quickly as providers deprecate or retag models.
+
+**Impact:** silent fallback churn or unexpected cost/performance behavior.
+
+**Recommendation:**
+
+- add provider-health smoke checks in CI
+- assert model availability at startup (warn/fail by environment)
+- store model policy in typed config with validation, not comment-only provenance
+
+---
+
+## P2 — Citation simulation complexity requires contract tests
+
+`citationTester.ts` includes extensive prompt/system behavior and multiple candidate chains. This can regress quietly without focused contract tests for response shape and degraded-mode behavior.
+
+**Recommendation:**
+
+- introduce deterministic fixture tests for parser/output contract
+- verify web-source fields are always present and typed as expected
+- add per-platform fallthrough tests for provider failure paths
+
+---
+
+## 30/60/90 day modernization plan
+
+### 0–30 days
+
+- implement lint ratchet strategy and fix top error classes (`no-undef`, hook purity, JSX entities)
+- split `server.ts` into route registrars + bootstrapping composition layer
+- unify URL safety policy with targeted unit tests
+
+### 31–60 days
+
+- add resilience tests for AI fallback/backoff and timeout boundaries
+- add citation pipeline contract tests and JSON-shape snapshots
+- enforce changed-files lint clean in CI
+
+### 61–90 days
+
+- modularize highest-churn client views into smaller feature slices
+- add architecture decision records (ADRs) for tier contract, provider policy, and share/report integrity
+- introduce operational SLO dashboard for analyze latency, provider failures, and partial-degradation rates
+
+---
+
+## Suggested KPIs to track after this review
+
+- lint errors and warnings trend (weekly)
+- percentage of PRs touching `server.ts`
+- `/api/analyze` p95 and p99 latency
+- AI provider fallback rate and timeout rate
+- citation test completion rate by source engine
+- escaped/sanitized input coverage in controller-level tests
+
+---
+
+## Closing assessment
+
+The repository has strong architectural intent and meaningful domain depth. The primary blocker to sustained velocity is code hygiene debt, not foundational design. If lint debt is aggressively reduced and core orchestration modules are decomposed, the project can move from “feature-capable but fragile” to “feature-capable and reliably evolvable.”
 
EOF
)