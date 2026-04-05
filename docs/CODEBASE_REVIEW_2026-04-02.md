# AI Visibility Engine - Full Codebase Review (2026-04-02)

## Scope and method

This review covers the monorepo at a structural, quality, and operational level with emphasis on:

- contract integrity between `shared/`, `server/`, and `client/`
- security posture around input validation and URL safety
- runtime reliability of the audit pipeline
- developer ergonomics and maintainability signals

Commands run:

- `npm run typecheck`
- `npm run lint`

And focused source inspection of key cross-layer files:

- `shared/types.ts`
- `server/src/server.ts`
- `server/src/middleware/securityMiddleware.ts`
- `server/src/services/aiProviders.ts`
- `server/src/services/citationTester.ts`
- `client/src/main.tsx`

---

## Executive summary

The codebase is feature-rich and clearly oriented around a strong server-authoritative architecture. Core controls are in place (tier contracts, route hardening primitives, provider abstraction, timeout budgeting), and type checking currently passes. However, lint health is severely degraded (741 total findings, 284 errors), creating substantial reliability and change-risk drag.

### Overall scorecard

- **Architecture direction:** Strong
- **Security baseline design:** Strong, with specific hardening opportunities
- **Type safety status:** Passing (`tsc --noEmit`)
- **Code quality gate status:** Failing (`eslint` currently not enforceable as a merge gate)
- **Operational risk level (current):** Medium-High due to lint debt and codebase sprawl in key modules

---

## What is working well

### 1) Shared-contract-first tier model is well established

`shared/types.ts` provides canonical tier definitions, legacy alias mapping, hierarchy ordering, and entitlement-like limits in one place. This is the right monorepo pattern and prevents client/server drift when followed consistently.

### 2) Server truth boundary is explicit

`server/src/server.ts` centralizes route wiring, auth/usage middleware references, and provider orchestration dependencies, reinforcing that sensitive logic remains server-side.

### 3) Security middleware foundation is present

`server/src/middleware/securityMiddleware.ts` includes Helmet usage, CSP nonce generation, DOMPurify sanitization utilities, Zod schemas for high-risk payloads, and external URL safety checks.

### 4) AI provider abstraction is practical

`server/src/services/aiProviders.ts` separates free vs paid provider chains and models tier-specific triples (`SIGNAL_*`, `scorefix_*`), including provider backoff memory to improve resilience.

### 5) Citation testing workflow is ambitious and modular

`server/src/services/citationTester.ts` defines platform simulation prompts and includes multiple web verification tracks, with extensible platform/model candidate maps.

---

## Critical findings (priority ordered)

## P0 - CI quality gate is effectively broken by lint volume

`npm run lint` currently reports **741 issues (284 errors, 457 warnings)**. This means lint cannot serve as a practical protection layer and developers are incentivized to ignore it. High-volume categories include:

- undefined browser/runtime globals (`no-undef`)
- JSX entity escaping issues (`react/no-unescaped-entities`)
- hook purity issues (`react-hooks/purity`)
- widespread `any` and unused-symbol noise

**Impact:** elevated regression probability, hidden defects, and slow code reviews.

**Recommendation:**

1. Establish a staged lint remediation plan (baseline snapshot + ratchet).
2. Make new/changed files lint-clean mandatory first, then burn down backlog.
3. Split client lint config by browser vs node contexts to eliminate false positives.

---

## P1 - `server.ts` concentration risk

`server/src/server.ts` has become a highly concentrated orchestration surface with broad imports and mixed concerns. While functionally central, its current size and responsibility density increase blast radius for edits.

**Impact:** onboarding friction, brittle merges, harder incident response.

**Recommendation:**

- carve out route registrars by domain (`audit`, `admin`, `billing`, `mentions`, etc.)
- isolate long-lived pipeline helpers into dedicated modules
- retain `server.ts` as composition root only

---

## P1 - URL safety logic split across modules may drift

There is URL/private-host safety logic in `securityMiddleware.ts` and additional URL normalization/safety helpers referenced from `server.ts` (`lib/urlSafety`). The architecture is valid, but duplicated policy surfaces can diverge over time.

**Impact:** inconsistent request acceptance/rejection under edge cases.

**Recommendation:**

- define one canonical URL safety policy module and consume everywhere
- add explicit security tests for loopback, private IP, IDN/punycode, and rebinding-like host patterns

---

## P2 - AI model comments vs configuration may drift quickly

`aiProviders.ts` contains time-stamped model strategy comments and fixed model identifiers. This is good for intent tracking but can become stale quickly as providers deprecate or retag models.

**Impact:** silent fallback churn or unexpected cost/performance behavior.

**Recommendation:**

- add provider-health smoke checks in CI
- assert model availability at startup (warn/fail by environment)
- store model policy in typed config with validation, not comment-only provenance

---

## P2 - Citation simulation complexity requires contract tests

`citationTester.ts` includes extensive prompt/system behavior and multiple candidate chains. This can regress quietly without focused contract tests for response shape and degraded-mode behavior.

**Recommendation:**

- introduce deterministic fixture tests for parser/output contract
- verify web-source fields are always present and typed as expected
- add per-platform fallthrough tests for provider failure paths

---

## 30/60/90 day modernization plan

### 0–30 days

- implement lint ratchet strategy and fix top error classes (`no-undef`, hook purity, JSX entities)
- split `server.ts` into route registrars + bootstrapping composition layer
- unify URL safety policy with targeted unit tests

### 31–60 days

- add resilience tests for AI fallback/backoff and timeout boundaries
- add citation pipeline contract tests and JSON-shape snapshots
- enforce changed-files lint clean in CI

### 61–90 days

- modularize highest-churn client views into smaller feature slices
- add architecture decision records (ADRs) for tier contract, provider policy, and share/report integrity
- introduce operational SLO dashboard for analyze latency, provider failures, and partial-degradation rates

---

## Suggested KPIs to track after this review

- lint errors and warnings trend (weekly)
- percentage of PRs touching `server.ts`
- `/api/analyze` p95 and p99 latency
- AI provider fallback rate and timeout rate
- citation test completion rate by source engine
- escaped/sanitized input coverage in controller-level tests

---

## Closing assessment

The repository has strong architectural intent and meaningful domain depth. The primary blocker to sustained velocity is code hygiene debt, not foundational design. If lint debt is aggressively reduced and core orchestration modules are decomposed, the project can move from "feature-capable but fragile" to "feature-capable and reliably evolvable."
