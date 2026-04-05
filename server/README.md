# AiVIS - Server

Express 5 + TypeScript API server for the AiVIS platform.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run typecheck` | Type validation without emit |

## Environment Variables

See `.env.example` for all available options.

### Required

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for signing JWT tokens
- `OPENROUTER_API_KEY` - OpenRouter API key

### Optional

- `RESEND_API_KEY` - For transactional emails
- `STRIPE_SECRET_KEY` - For payment processing
- `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- `FRONTEND_URL` - Frontend URL for CORS
- `SENTRY_DSN` - Error tracking
- `GA4_MEASUREMENT_ID` - GA4 stream measurement ID (for server-side events)
- `GA4_API_SECRET` - GA4 Measurement Protocol API secret
- `ANALYZE_REENTRANCY_GUARD_ENABLED` - Prevent duplicate in-flight analyze calls per user+target
- `ANALYZE_LOCK_TTL_MS` - Reentrancy lock TTL in milliseconds

## Project Structure

```text
server/
├── src/
│   ├── server.ts           # Express app entry point
│   ├── config/             # Configuration files
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Express middleware
│   ├── routes/             # Route definitions
│   ├── services/           # Business logic
│   │   ├── postgresql.ts   # Database + migrations
│   │   ├── aiProviders.ts  # AI model integration
│   │   └── email.ts        # Email service
│   └── types/              # TypeScript types
├── .env.example            # Environment template
└── tsconfig.json           # TypeScript config
```

## Database

Migrations run automatically on server startup. See `src/services/postgresql.ts` for schema definitions.

### Key Tables

- `users` - User accounts and tiers
- `audits` - Audit history
- `usage_daily` - Usage tracking
- `analysis_cache` - Cached analysis results
- `payments` - Payment/subscription records

## API Routes

All routes are prefixed with `/api`.

### Authentication

- `POST /auth/register` - Create account
- `POST /auth/signin` - Login
- `GET /auth/profile` - Get current user (requires auth)
- `GET /auth/verify-email` - Verify email token

### Analysis

- `POST /analyze` - Run AI visibility audit (requires auth)
- `GET /audits` - User's audit history (requires auth)
- `GET /audits/:id` - Single audit details (requires auth)

### Payments

- `GET /payment/pricing` - Get tier pricing
- `POST /payment/checkout` - Create Stripe checkout
- `POST /payment/webhook` - Stripe webhooks
- `POST /payment/portal` - Stripe customer portal

### Admin

- `GET /health` - Health check
- `POST /admin/cache/clear` - Clear analysis cache (admin key required)
