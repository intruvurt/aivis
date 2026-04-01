# New Spec Merge Contract (Authoritative)

This file is the enforcement contract for merging methodology specs into production.

## Spec Precedence (Highest to Lowest)

1. MUST-HAVE spec (non-negotiable requirements)
2. New GEO/SSFR spec
3. Legacy implementation spec

If two specs conflict, the higher-precedence spec wins.

## Non-Negotiable Runtime Truth Rules

- No simulated/live ambiguity in reports or API responses.
- Response must expose execution class via `analysis_integrity.execution_class`.
- GEO/SSFR truth layer must be emitted for every analysis mode (live, deterministic fallback, scrape-only, upload).
- Contradictions must be surfaced as structured data, not prose-only recommendations.

## Required API Fields

The merged contract requires these fields on analysis responses:

- `analysis_integrity.execution_class`
- `geo_signal_profile`
- `contradiction_report`

These fields are now part of the shared contract and must remain backward compatible.

## Canonical GEO/SSFR Quality Gate

An audit is only "complete" when all four checks are present and machine-readable:

1. Source verified (entity authority present)
2. Signal consistent (schema/content contradictions identified)
3. Fact differentiated (information gain assessed)
4. Relationship anchored (citation readiness evidenced)

## Implemented in Current Engine (Verified)

- Shared type contract includes `GeoSignalProfile`, `ContradictionReport`, and information-gain levels.
- Server computes deterministic GEO profile and contradiction report across all result paths.
- UI renders GEO/SSFR and contradiction outcomes in comprehensive analysis.
- CSV/HTML exports include GEO/SSFR and contradiction fields.
- Server PDF includes GEO/SSFR truth section.
- API documentation includes the new enterprise reliability fields.

## Pending for Full Superseding Completion

- Persist contradiction/GEO history for run-over-run deltas.
- Add explicit blocker-resolution lifecycle fields for operator workflows.
- Link deploy-triggered verification runs to remediation closure tracking.

## Removal Guidance from Legacy Spec

- Do not elevate `meta keywords`/`meta description` as primary scoring drivers.
- Do not depend on projection-only lift language where deterministic blocker state is available.
- Do not replace evidence-based findings with generic SEO advice.

## Enforcement Note

Any new feature touching audits, reports, or remediation must preserve this precedence and output contract. If a proposed change cannot satisfy these requirements, it is out of spec.
