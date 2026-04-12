# 🚀 Railway Deployment Guide

**Current Production Setup**: `https://aivis.biz` is deployed on Railway.

## Overview

The application is deployed as two services on Railway:

- **Backend**: Express API (Node.js) on `https://api.aivis.biz`
- **Frontend**: Vite static site (served by backend) on `https://aivis.biz`
- **Database**: Railway-managed PostgreSQL (uses self-signed certificate)
- **Redis**: Railway-managed Redis instance

## Deployment Flow

1. **Code Push**: Push to `main` branch on GitHub
2. **Railway Webhook**: Railway automatically detects push via GitHub integration
3. **Build**: Runs build command from `railway.toml`
4. **Deploy**: Restart container with new build
5. **Health Check**: Automatic healthcheck verifies service is running

## Configuration Files

### `railway.toml` (Root)

Defines build and deploy configuration:

```toml
[build]
builder = "nixpacks"

[deploy]
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

This file tells Railway:

- Use Nixpacks to detect Node.js project and build automatically
- Restart failed containers up to 10 times

### `server/package.json` (Build Scripts)

```json
{
  "scripts": {
    "build": "npm --prefix ../client install --include=dev && npm --prefix ../client run build && node ./tools/stageClientDist.mjs && tsc -p tsconfig.build.json"
  }
}
```

## Environment Variables in Railway

Set these in Railway dashboard under **Variables**:

### Required

- `DATABASE_URL` - PostgreSQL connection string from Railway
- `JWT_SECRET` - Session signing key (auto-generated if not set)
- `OPEN_ROUTER_API_KEY` - AI provider API key
- `DATABASE_CA_CERT` - **CRITICAL**: PostgreSQL self-signed certificate content

### CORS & Network

- `FRONTEND_URL` - `https://aivis.biz`
- `CORS_ORIGIN` - `https://aivis.biz,https://www.aivis.biz,https://aivis-d24.pages.dev`
- `PORT` - `3001` (Railway default)
- `NODE_ENV` - `production`

### Optional

- `SENTRY_DSN` - Error tracking (Sentry)
- `ADMIN_KEY` - Admin dashboard access
- `RESEND_API_KEY` - Email service
- `STRIPE_SECRET_KEY` - Payment processing

## Database SSL Certificate (CRITICAL)

Railway PostgreSQL uses a self-signed certificate. To connect:

1. **Get the certificate** from your local development setup:

   ```bash
   cat "C:\Users\Ma$e\Desktop\aivis\aivis\client\public\prod-ca-2021.crt"
   ```

2. **Copy the full certificate** (including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`)

3. **Set in Railway Variables**:
   - Name: `DATABASE_CA_CERT`
   - Value: Paste the certificate content

4. **Code reads it** from [server/src/services/postgresql.ts](server/src/services/postgresql.ts#L93-L100):
   ```typescript
   const caCert = process.env.DATABASE_CA_CERT || process.env.PG_CA_CERT;
   if (caCert && IS_PRODUCTION) {
     poolConfig.ssl = {
       rejectUnauthorized: true,
       ca: [caCert],
     };
   }
   ```

## Monitoring & Logs

### View Logs

1. Go to [Railway Dashboard](https://railway.app)
2. Select project → select service
3. Click **Logs** tab
4. Real-time output updates

### Key Log Messages

- ✅ `Server running on http://0.0.0.0:3001 (production)` - API started
- ✅ `[Startup] Database ready` - DB migrations complete
- ❌ `[DB] self-signed certificate in certificate chain` - Missing/wrong CA cert

### Health Check

- Endpoint: `https://api.aivis.biz/api/health`
- Expected response: `{ "status": "ok" }`
- Railway pings every 60 seconds; if fails 3 times, restarts container

## Manual Deployment

If you need to redeploy manually:

1. **Via Railway CLI**:

   ```bash
   railway up
   ```

2. **Via Git** (automatic):

   ```bash
   git push origin main
   ```

   Railway listens to GitHub webhooks and auto-deploys.

3. **Via Railway Dashboard**:
   - Go to service → click three-dot menu → "Redeploy"

## Troubleshooting

### "self-signed certificate in certificate chain"

- Check: Is `DATABASE_CA_CERT` set in Railway Variables?
- Solution: Extract cert from local file and set it (see Database SSL Certificate section above)

### "ECONNREFUSED 127.0.0.1:5432"

- Database not reachable
- Check: Is `DATABASE_URL` correct in Variables?
- Fix: Get connection string from Railway PostgreSQL service details

### "CORS error in browser"

- Request blocked from origin
- Check: `FRONTEND_URL` and `CORS_ORIGIN` are set correctly
- Fix: Include your domain in `CORS_ORIGIN` (comma-separated)

### Service keeps restarting

- Check logs for startup errors
- Common causes: Missing env var, DB connection failure, port conflict
- Solution: Fix issue in code/vars, redeploy

## GitHub Integration

Railway auto-deploys on GitHub push thanks to:

1. Railway GitHub App installed on repo
2. Webhook configured to listen for pushes to `main`
3. No manual action required

To disable/reconfigure:

- Go to Railway dashboard → Project Settings → Integrations
- Manage GitHub connections there

## Performance Tips

1. **Response Timeout**: Set to 55s (Railway's limit is 60s) in [server/src/server.ts](server/src/server.ts#L1524-L1532)
2. **Database Pool**: Max 20 connections, configured in [postgresql.ts](server/src/services/postgresql.ts#L85-L95)
3. **Redis**: For caching and rate limiting, configured in [cache.service.ts](server/src/services/cache.service.ts)

## Cost Estimate

- **Backend Container**: $5-10/month (depending on compute)
- **Database**: ~$5-15/month (pay-as-you-go)
- **Redis**: ~$2-5/month
- **Total**: ~$12-30/month baseline

## Rollback

If a deployment breaks production:

1. **Via Git** (revert commit):

   ```bash
   git revert HEAD
   git push origin main
   ```

   Railway auto-deploys the reverted code.

2. **Via Railway Dashboard**:
   - Deployments tab → click previous green deployment → "Rollback"

## See Also

- [railway.toml](railway.toml) - Deployment config
- [server/package.json](server/package.json#L16) - Build script
- [server/src/services/postgresql.ts](server/src/services/postgresql.ts) - DB connection setup
- [DEPLOYMENT.md](DEPLOYMENT.md) - General deployment options
