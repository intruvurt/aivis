---
name: "Generate AiVIS JSON-LD"
description: "Use when you want one-click production-ready homepage JSON-LD from a URL, including SoftwareApplication, Organization, FAQPage, and WebSite SearchAction blocks."
argument-hint: "Provide homepage URL plus optional brand/legal/social details to fill placeholders."
agent: "AiVIS Visibility Auditor"
tools: [web, read, search]
---
Generate production-ready JSON-LD schema blocks for the provided homepage URL.

Inputs:
- Primary URL (required)
- Optional business details: legal name, support/contact URL, logo URL, social profile URLs, founding date, publish/modified dates

Workflow:
1. Retrieve and inspect the live homepage content and visible brand signals.
2. Infer only what is supported by visible evidence or explicit user inputs.
3. Emit exactly four separate blocks in this order:
- SoftwareApplication
- Organization
- FAQPage (8 Q&A pairs aligned to AI visibility intent)
- WebSite with SearchAction
4. Use stable `@id` anchors based on the canonical homepage URL.
5. If a required value cannot be verified, keep a clearly marked placeholder instead of inventing data.

Output requirements:
- Return each block in its own `<script type="application/ld+json">` tag.
- Ensure valid JSON and schema.org-compatible properties.
- Keep terminology consistent with AiVIS evidence language (citation readiness, CITE LEDGER, BRAG) when relevant.
- End with a short validation checklist for Rich Results Test and re-audit steps.
