---
name: "Homepage Content Schema Consistency"
description: "Use when editing homepage/content files that include or discuss JSON-LD, entity schema, FAQPage, Organization, SoftwareApplication, or WebSite SearchAction."
applyTo:
  - "client/index.html"
  - "client/src/**/*home*.{ts,tsx,js,jsx,html}"
  - "content/**/*.{md,mdx,html,json}"
  - "*.html"
---
# Schema Consistency Rules (Homepage and Content)

Follow these rules when creating or modifying homepage/content schema or schema-related copy.

## Canonical Principles
- Keep server truth and evidence language aligned: claims must support citation state or corrective action.
- Do not invent entity facts (legal name, dates, social URLs, logo URLs, pricing, contact endpoints).
- Prefer canonical `https://aivis.biz` URL forms and stable `@id` anchors.

## Required JSON-LD Blocks for Homepage Work
- `SoftwareApplication`
- `Organization`
- `FAQPage`
- `WebSite` with `SearchAction`

Use separate `<script type="application/ld+json">` blocks unless explicitly asked to merge.

## Consistency Rules
- Keep product/entity naming consistent: `AiVIS` and `AiVIS.biz` where context-appropriate.
- Keep methodology terms consistent when used: `CITE LEDGER`, `BRAG`.
- Ensure FAQ answers are self-contained and citation-friendly (can stand alone if extracted).
- Do not publish placeholder values in production output; clearly mark placeholders during drafting.

## Validation Checklist
- JSON is valid and parseable.
- Schema types/properties are supported by schema.org.
- URLs resolve and use canonical host.
- Date fields use ISO format.
- No contradiction between on-page copy and schema claims.
