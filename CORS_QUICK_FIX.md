# ⚠️ DEPRECATED - This guide is for Render deployment (no longer used)

**Current Deployment**: Railway (see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md))

---

# Production Deployment Checklist for CORS Fix (ARCHIVED)

This was the CORS fix for Render. We now use Railway. See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for current setup.

## Old Guide (Render - Not Used)

### Step 1: Configure Backend Environment Variable

- [ ] Go to https://dashboard.render.com
- [ ] Click on `aivis` backend service
- [ ] Click **Environment** tab
- [ ] Add/Update environment variable:
  - **Key:** `FRONTEND_URL`
  - **Value:** `https://aivis.biz`
- [ ] Click **Save Changes**
- [ ] Wait for automatic redeploy (check service status → green checkmark)

### Step 2: Verify Fix

- [ ] Open https://aivis.biz in a browser
- [ ] Open DevTools (F12) → Network tab
- [ ] Look for requests to `https://api.aivis.biz`
- [ ] Check if you see these response headers:
  ```
  Access-Control-Allow-Origin: https://aivis.biz
  Access-Control-Allow-Credentials: true
  ```
- [ ] If you see these headers, CORS is fixed! ✅

## Code Changes Summary

✅ **Modified:** `server/src/server.ts`

- Universal CORS handler for all responses
- Enhanced logging for debugging
- Support for localhost dev URLs

✅ **Created:** `CORS_SETUP_GUIDE.md`

- Detailed explanation of the fix
- Troubleshooting guide

✅ **Created:** `CORS_FIX_SUMMARY.md`

- Technical details of changes

## If Still Having Issues

1. **Check server logs in Render:**
   - Dashboard → service → Logs
   - Look for `[CORS]` entries
   - Should show `✓ Allowed origin: https://aivis.biz`

2. **Verify FRONTEND_URL is set:**
   - Environment → Environment Variables
   - Confirm `FRONTEND_URL=https://aivis.biz` is there

3. **Redeploy manually:**
   - Settings → Manual Deploy
   - Wait for green checkmark

4. **Clear browser cache:**
   - DevTools → Settings → Network → "Disable cache"
   - Hard refresh: Ctrl+Shift+R or Cmd+Shift+R

## Alternative: Multiple Frontend URLs

If you have multiple frontend domains (staging, preview, etc.):

```
FRONTEND_URL=https://aivis.biz,https://staging.aivis.biz,https://preview.aivis.biz
```

## Support

- **CORS Documentation:** See [CORS_SETUP_GUIDE.md](CORS_SETUP_GUIDE.md)
- **Technical Details:** See [CORS_FIX_SUMMARY.md](CORS_FIX_SUMMARY.md)
- **Browser CORS Info:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

---

**That's it!** Your CORS issues should be resolved after setting `FRONTEND_URL` in Render.
