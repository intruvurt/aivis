# ⚠️ DEPRECATED - This guide is for Render deployment (no longer used)

**Current Deployment**: Railway (see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md))

---

# CORS Setup Guide (ARCHIVED - Render)

This was the CORS setup for Render. We now use Railway. See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for current setup.

## Old Guide (Render - Not Used)

Your frontend (`https://aivis.biz`) is unable to reach the backend API (`https://api.aivis.biz`) due to CORS policy errors:

```
Access to fetch at 'https://api.aivis.biz/api/health' from origin 'https://aivis.biz'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

## Root Cause

The backend requires the `FRONTEND_URL` environment variable to be explicitly configured in your production environment (Render dashboard). While the code has hardcoded fallbacks for `https://aivis.biz` and `https://www.aivis.biz`, the environment variable must be set for production deployments to work correctly.

## Solution - Configure FRONTEND_URL in Render

### Step 1: Access Render Dashboard

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Select your `aivis` (backend) service

### Step 2: Set Environment Variable

1. Click **Environment** in the left sidebar
2. Under **Environment Variables**, add or update:
   - **Key:** `FRONTEND_URL`
   - **Value:** `https://aivis.biz` (or your production frontend URL)
3. Click **Save Changes**
4. The service will automatically redeploy with the new configuration

### Step 3: (Optional) Add More Origins

If you have multiple frontend URLs (e.g., staging, preview), use comma-separated values:

```
FRONTEND_URL=https://aivis.biz,https://staging.aivis.biz,https://preview.aivis.biz
```

### Step 4: Verify

After deployment, check:

1. Open browser DevTools (F12)
2. Go to the **Network** tab
3. Look for `api.aivis.biz/api/health` request
4. Check **Response Headers** for:
   ```
   Access-Control-Allow-Origin: https://aivis.biz
   Access-Control-Allow-Credentials: true
   ```

## Technical Details

### Built-in Allowed Origins (No Configuration Needed)

The backend automatically allows:

- `https://aivis.biz`
- `https://www.aivis.biz`
- `http://localhost:5173` (Vite dev)
- `http://localhost:3000` (alternative dev)

### CORS Flow

1. **Universal CORS Handler** (runs first)
   - Sets `Access-Control-Allow-Origin` header on ALL responses
   - Handles OPTIONS preflight requests with 204 No Content
   - Prevents CORS errors on error responses

2. **cors() Middleware** (fallback)
   - Detailed logging for debugging
   - Validates origin against allowed list
   - Returns 403 if origin not allowed

### Logging

When requests arrive, check server logs for:

```
[CORS] ✓ Allowed origin: https://aivis.biz
[CORS] ✓ Allowed origins (normalized): ['https://aivis.biz', 'https://www.aivis.biz', ...]
```

Or if rejected:

```
[CORS] ✗ Rejected origin: https://unknown.com (normalized: https://unknown.com).
Allowed: https://aivis.biz, https://www.aivis.biz, ...
```

## Troubleshooting

### Still Getting CORS Errors?

1. **Clear browser cache** (`Ctrl+Shift+Delete`)
2. **Check server logs** in Render dashboard → Logs
3. **Verify FRONTEND_URL** is set correctly (no trailing slashes)
4. **Redeploy manually** - Settings → Manual Deploy

### CORS Headers Not Showing?

1. Check `Access-Control-Allow-Origin` in Response Headers
2. If missing, the origin is not in the allowed list
3. Verify origin matches exactly (case-sensitive after normalization)

### 522 Connection Timeout?

This is a Cloudflare/network issue, not CORS. Check:

1. Backend service is running (check Render logs)
2. API domain DNS is resolving correctly
3. no firewall rules blocking the request

## Reference

- **Render Documentation:** https://render.com/docs/environment-variables
- **CORS Specification:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Code Location:** [server/src/server.ts](server/src/server.ts#L189-L240)

## Required Env Vars for Production

The backend requires these to start in production:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing key
- `API_KEY_PEPPER` - API key hashing salt
- `FRONTEND_URL` - **← This one is missing!**
- `OPENROUTER_API_KEY` - AI provider key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing key
