# AI Visibility Intelligence Audits Client

> Ai Visibility Intelligence Audits Engine — React + Vite + TypeScript + Tailwind

## Overview

The AI Visibility Intelligence Audits frontend is a modern React 19 application that provides:

- **AI Visibility Audits** — Analyze how AI systems parse and surface your website
- **Platform Scoring** — Individual scores for ChatGPT, Perplexity, Claude, Google AI
- **Reverse Engineer** — Decompile AI answers, generate blueprints, compare model preferences, simulate visibility changes
- **Citation Tracking** — Test if AI platforms mention your brand (Signal tier)
- **Competitor Tracking** — Compare your visibility against competitors (Alignment+)
- **Analytics** — Track score trends over time across all your audited pages
- **Keyword Intelligence** — Intent, volume, competition, opportunity scores from your audits
- **Reports** — Manage and export your audit history

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The dev server runs on <https://aivis.biz>

## Tech Stack

- **React 19** — Latest React with concurrent features
- **Vite** — Fast build tool and dev server
- **TypeScript** — Full type safety
- **Tailwind CSS** — Utility-first styling
- **Zustand** — Lightweight state management
- **React Router** — Client-side routing
- **jsPDF** — PDF report generation

## Project Structure

```text
src/
├── components/        # Reusable UI components
├── views/             # Page-level components
├── pages/             # Static pages (Terms, Privacy, FAQ)
├── hooks/             # Custom React hooks
├── stores/            # Zustand stores (auth, analysis)
├── services/          # API service layer
├── utils/             # Utility functions
├── auth/              # Auth context and providers
└── assets/            # Static assets
```

## Environment Variables

Create a `.env` file:

```bash
# Backend API URL
VITE_API_URL=https://api.aivis.biz

# Environment
VITE_ENV=development

# Optional: Sentry DSN for error tracking
VITE_SENTRY_DSN=
```

## Available Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run Vitest tests |

## Key Routes

| Route | Auth | Tier | Description |
| ----- | ---- | ---- | ----------- |
| `/` | No | — | Landing page + audit form |
| `/auth` | No | — | Sign in / sign up / reset password |
| `/dashboard` | Yes | — | User dashboard |
| `/pricing` | No | — | Pricing plans |
| `/compare` | No | — | Plan comparison overview |
| `/workflow` | No | — | Platform workflow and value path |
| `/methodology` | No | — | Scoring methodology |
| `/guide` | No | — | How-to guide |
| `/analytics` | Yes | Alignment+ | Score history & trends |
| `/keywords` | Yes | Alignment+ | Keyword intelligence |
| `/competitors` | Yes | Alignment+ | Competitor tracking & comparison |
| `/reverse-engineer` | Yes | Alignment+ | AI answer tools (4 tools) |
| `/citations` | Yes | Alignment+ / Signal split | BRA authority checks at Alignment; full citation testing at Signal |
| `/reports` | Yes | All authenticated tiers | Audit report history |
| `/terms` | No | — | Terms of Service |
| `/privacy` | No | — | Privacy Policy |
| `/faq` | No | — | FAQ |

## Tier System

| Tier | Price | audits/mo | Competitors | Key Features |
| ---- | ----- | --------- | ----------- | ------------ |
| Observer | Free | 3 | 0 | Basic audits, core recommendations, report history, shareable links |
| Alignment | $49/mo | 60 | 2 | + Exports, report history, force-refresh, competitor tracking, reverse engineer, BRA authority checker |
| Signal | $149/mo | 110 | 5 | + Citation testing, API access, white-label, scheduled reaudits |
| Score Fix | $299 per 250-scan pack | 250 | 10 | + Thorough evidence audit mode, Actual Fix Plan, and issue-level validation guidance. Repurchase when scans exhausted. |

## Building for Production

```bash
npm run build
```

Output goes to `dist/` — deploy to any static host (Vercel, Netlify, etc.)

## Related

- [Server README](../server/README.md)
- [Stripe Setup](../STRIPE_SETUP.md)

---

**AI Evidence-backed Visibility Intelligence Audits & Auto PR Remediations** — Intruvurt Labs • Georgia, USA
