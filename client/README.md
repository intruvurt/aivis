# AiVIS

AiVIS is the AI visibility Evidence-backed Intelligence and Auto Fix PR-Remediation platform for aivis.biz

It scans a site shows what AI systems misunderstand proves the problem with evidence and helps move the site toward being understood trusted and cited

## What this app is

This client is the frontend for the AiVIS product flow

Scan a public URL

Expose the blockers with evidence

Launch fixes or remediation steps

Re scan and measure what changed

This is not a generic SEO dashboard and it is not just a surface for reports. The product is built around finding what breaks AI understanding and turning that into usable next actions

## What it does right now

The current frontend is wired to the backend and includes real working product surfaces for

AI visibility audits with live progress streaming

Evidence backed reports linked to BRAG style findings

Report history exports public share pages and score comparison

Citation tracking answer presence competitor tracking keyword intelligence and reverse engineering tools

Score Fix remediation flows including GitHub and auto fix related interfaces

Workspaces billing referrals notifications agency tools and admin surfaces

This README reflects the real codebase and not marketing copy

## Stack

React 19

Vite

TypeScript

Tailwind CSS

Zustand

React Router

Framer Motion

Axios and fetch based API helpers

jsPDF export flows

## Run locally

On Windows use `npm.cmd` in this workspace

```bash
npm.cmd install
npm.cmd run dev
```

Vite usually runs on <http://localhost:5173> unless changed by config or environment

Product flow

Everything in AiVIS follows this loop

Scan the site

Expose the evidence

Fix the issues

Re scan and compare movement

If a feature does not support that loop it should not be treated as a core surface

Routes
Public routes

/ landing page and audit launcher

/pricing pricing

/auth sign in sign up and reset

/guide /methodology /workflow /compare/* support and educational pages

/report/public/:token public shared audit view

Authenticated routes

All main product routes live under /app/*

/app dashboard

/app/analyze audit runner

/app/reports report history and comparison

/app/score-fix remediation and auto fix surface

Supporting intelligence routes include

/app/analytics

/app/citations

/app/competitors

/app/keywords

/app/prompt-intelligence

/app/answer-presence

/app/reverse-engineer

/app/brand-integrity

/app/niche-discovery

/app/benchmarks

Platform and utility routes include

/app/schema-validator

/app/server-headers

/app/robots-checker

/app/indexing

/app/mcp

/app/gsc

/app/profile

/app/settings

/app/billing

/app/notifications

/app/team

/app/agency

/app/admin

Tier truth

Tier truth comes from shared contracts in ../shared/types.ts and not from this README

The current canonical tiers in code are

observer

alignment

signal

scorefix

agency

enterprise

The simple model is this

Observer lets users see what AI gets wrong

Alignment shows why it is happening

Signal tracks and proves visibility over time

ScoreFix is the remediation layer

Agency and Enterprise expand that for larger teams and heavier usage

Prices and checkout data should stay backend controlled and should not be hardcoded here

Audit flow in the client

The client audit flow is already wired around the current backend

Submit URL to POST /api/analyze

Read the audit request id

Open the SSE progress stream at /api/audit/progress/:requestId

Render the analysis result when the response completes

Offer reports exports comparison and remediation next steps

Important implementation files include

src/views/AnalyzePage.tsx

src/components/AuditProgressOverlay.tsx

src/components/ComprehensiveAnalysis.tsx

src/components/RecommendationList.tsx

src/components/AutoScoreFixModal.tsx

Evidence system

AiVIS uses an evidence first approach

Each issue should tie back to traceable evidence ids and grounded findings

The point is not to generate fluffy insight. The point is to show what was found why it matters and what should happen next

Score Fix

Score Fix is the execution layer

It exists to move the product beyond reporting

Find the issue

Generate the fix path

Apply the change through GitHub or remediation flow

Re scan and validate the result

That is where the product becomes operational and not just informative

Project structure

This reflects the real repo structure today

src/
├── components/
├── views/
├── pages/
├── hooks/
├── stores/
├── services/
├── utils/
├── lib/
├── constants/
└── auth/

In plain terms

components holds shared UI report panels navigation and remediation modals

views holds authenticated product views

pages holds public and support pages

hooks holds auth settings notifications and feature helpers

stores holds Zustand state for auth analysis settings and workspaces

services holds API wrappers and service clients

utils holds helper functions

lib holds security schema auth and sentry helpers

constants holds product constants and internal copy

auth holds auth helpers

Environment variables

Create client/.env as needed

VITE_API_URL=<https://api.aivis.biz>
VITE_ENV=production
VITE_SENTRY_DSN=render environment variable

VITE_API_URL should point to the backend origin and not the /api path

Scripts

npm.cmd run dev starts the local dev server

npm.cmd run build builds production assets

npm.cmd run preview previews the production build

npm.cmd run lint runs ESLint

npm.cmd run typecheck runs TypeScript checks

npm.cmd test runs Vitest

Rules for future edits

Treat ../shared/types.ts as the cross layer contract

Treat src/App.tsx as the route map source of truth

Treat pricing as server owned

Do not describe a feature here unless it actually exists in code

Do not hardcode tier limits or public route details from memory

Related

../server/README.md

../shared/types.ts

../STRIPE_SETUP.md

Final note

AiVIS is built to show whether a site can actually be read trusted and cited by AI systems

The product is not just about audits

It is about proving what is broken helping fix it and measuring the change
