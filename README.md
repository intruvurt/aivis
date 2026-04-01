# AI Search Visibility & Monitoring (formerly AiVIS)

**AI-powered website visibility auditing platform** — Analyze how well your website performs for AI assistants like ChatGPT, Perplexity, Claude, and Google AI.

## Overview

AiVIS scrapes your live page, runs the content through multiple AI models, and produces an evidence-backed visibility score (0–100). Every finding cites a specific scraped element so nothing is hallucinated.

- **AI Visibility Score** — 0–100 composite score across 6 graded categories
- **Platform Scores** — Individual estimates for ChatGPT, Perplexity, Claude, Google AI
- **Content & Schema Audit** — Heading structure, JSON-LD, meta tags, Open Graph
- **Keyword Intelligence** — Intent, volume tier, competition, opportunity scores
- **Evidence-Backed Findings** — Every claim traces back to a scraped page element
- **Crypto Intelligence** — Detects crypto keywords, wallet addresses, on-chain data (experimental)

## Architecture

```
aivis/
├── client/          # React 19 + Vite + Tailwind CSS frontend
├── server/          # Express 5 + TypeScript API server
├── shared/          # Shared types between client and server
├── api/             # Vercel serverless functions
└── docs/            # Additional documentation
```

## AI Models

Analysis uses [OpenRouter](https://openrouter.ai) with these models:

| Model | Role |
|-------|------|
| DeepSeek V3 | Primary analysis (paid tiers) |
| OpenAI GPT-OSS 120B | Primary analysis (free Observer tier) |
| StepFun Step 3.5 Flash | Fallback (free Observer tier) |
| Google Gemma 3 27B | AI2 peer critique (Signal) / paid fallback |
| Meta Llama 3.3 70B | AI3 validation gate (Signal) |
| Ollama (local) | Optional local fallback |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- OpenRouter API key (for AI analysis)

### Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp server/.env.example server/.env
# Edit server/.env with your credentials

# Start development servers
npm run dev  # Starts both client and server
```

### Individual Services

```bash
# Client only (port 5173)
cd client && npm run dev

# Server only (port 3001)
cd server && npm run dev
```

## Environment Variables

### Server (Required)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI models |

### Server (Optional)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for transactional emails |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `FRONTEND_URL` | Frontend URL for CORS and emails |
| `SENTRY_DSN` | Sentry DSN for error tracking |
| `ADMIN_KEY` | Admin API key for cache/user management |
| `OLLAMA_BASE_URL` | Ollama endpoint for local AI fallback |

### Client

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_SENTRY_DSN` | Sentry DSN for client errors |

## Tier System

| Tier | Display Name | Monthly Scans | Price | Competitors | Key Features |
|------|-------------|---------------|-------|-------------|--------------|
| `observer` | Observer (Free) | 5 | Free | 0 | Basic audits, core recommendations |
| `alignment` | Alignment (Core) | 25 | $9/mo | 2 | Exports, force-refresh, report history, shareable links |
| `signal` | Signal (Pro) | 100 | $29/mo | 5 | Citation tracker, API access, white-label, scheduled rescans |

## API Routes

### Core

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/analyze` | ✓ | Run AI visibility audit |
| `GET /api/audits` | ✓ | User's audit history |
| `GET /api/audits/:id` | ✓ | Single audit detail |
| `GET /api/audit/progress/:id` | ✗ | SSE progress stream |
| `GET /api/analytics` | ✓ | Score history & trends |
| `GET /api/health` | ✗ | Health check + DB ping |
| `GET /api/pricing` | ✗ | Tier pricing info |

### Auth

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/register` | ✗ | User registration |
| `POST /api/auth/signin` | ✗ | User login |
| `GET /api/auth/profile` | ✓ | Get user profile |
| `POST /api/user/refresh` | ✓ | Refresh JWT token |

### Paid Features

| Endpoint | Auth | Tier | Description |
|----------|------|------|-------------|
| `GET /api/competitors` | ✓ | Alignment+ | List tracked competitors |
| `POST /api/competitors` | ✓ | Alignment+ | Add competitor |
| `DELETE /api/competitors/:id` | ✓ | Alignment+ | Remove competitor |
| `GET /api/competitors/compare` | ✓ | Alignment+ | Side-by-side comparison |
| `POST /api/citations` | ✓ | Signal | Create citation test |
| `GET /api/citations` | ✓ | Signal | List citation tests |
| `GET /api/citations/:id` | ✓ | Signal | Citation test results |
| `POST /api/reverse-engineer/decompile` | ✓ | Alignment+ | Deconstruct AI answer |
| `POST /api/reverse-engineer/ghost` | ✓ | Alignment+ | AI-optimized page blueprint |
| `POST /api/reverse-engineer/model-diff` | ✓ | Alignment+ | Compare model preferences |
| `POST /api/reverse-engineer/simulate` | ✓ | Alignment+ | Simulate visibility changes |

### Payments & Admin

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/payment/checkout` | ✓ | Create Stripe checkout session |
| `POST /api/payment/webhook` | ✗ | Stripe webhook handler |
| `POST /api/admin/cache/clear` | Admin | Clear analysis cache |
| `POST /api/admin/verify-user` | Admin | Force-verify a user |
| `POST /api/admin/set-tier` | Admin | Change user tier |

## Scripts

```bash
# Development
npm run dev          # Start both client and server
npm run build        # Build for production

# Testing
npm test             # Run tests
npm run typecheck    # TypeScript validation

# Linting
npm run lint         # ESLint
npm run lint:fix     # Auto-fix lint issues
```

## Deployment

The application deploys on **Render**:

- **Client**: Render Static Site (React build)
- **Server**: Render Web Service (Express)
- See `render.yaml` for full configuration

Database runs on **Neon** (serverless Postgres). Migrations auto-run at server startup.

## Security

- All secrets must be set via environment variables
- Never commit `.env` files (they are gitignored)
- Production requires valid `JWT_SECRET`
- `/api/analyze` rejects client-provided API keys (server-only `OPENROUTER_API_KEY`)
- URL validation blocks private/localhost IPs in production
- Email verification required before first scan

## License

Proprietary — All rights reserved.

## Support

For support inquiries, contact support@aivisibilityengine.com
