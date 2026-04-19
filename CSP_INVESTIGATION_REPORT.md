# CSP Issue & Resolution Summary

**Date**: April 19, 2026 22:58 UTC  
**Status**: ⚠️ **CSP Mismatch Detected - Investigation Required**

---

## Quick Summary

✅ **Good News**: All Lighthouse fixes are committed and code is correct  
❌ **Problem**: Production CSP doesn't match the deployed code  
🔍 **Issue**: Clarity.ms is missing from production's served CSP, causing tracking script to be blocked

---

## Detailed Analysis

### What Code Says (securityMiddleware.ts - Line 87)

```javascript
`script-src 'nonce-${nonce}' 'strict-dynamic' https:
  https://www.googletagmanager.com
  https://www.google-analytics.com
  https://www.clarity.ms ✅  ← INCLUDED
  https://static.cloudflareinsights.com`,
```

### What Production IS Serving (April 19 22:45-22:58 UTC curls)

```
script-src 'self' 'unsafe-inline'
  https://www.googletagmanager.com
  https://www.google-analytics.com
  https://www.google.com
  https://www.gstatic.com
  https://static.cloudflareinsights.com
  (NO clarity.ms) ❌
```

### Build Verification

✅ **Local build (dist/) includes correct CSP**:

```bash
$ grep "script-src" /workspaces/aivis/server/dist/server/src/middleware/securityMiddleware.js
→ script-src 'nonce-${nonce}' 'strict-dynamic' https: ...
```

---

## Possible Root Causes

1. **Cloudflare Caching**: If Cloudflare is caching the full HTML/headers, old CSP might still be served
2. **Railway Old Build Cached**: Deploy cache not cleared, serving previous version
3. **Reverse Proxy Override**: Something between Cloudflare and Railway modifying CSP before sending to client
4. **Multiple Deployment Cycles**: Railway may have deployed an intermediate build before our latest fix
5. **SPA Static HTML Cache**: Client-side cache serving old CSP meta tags

---

## Commits Tracking

| Commit        | Time (UTC) | Change                                                       |
| ------------- | ---------- | ------------------------------------------------------------ |
| e245bb3       | 22:37:30   | ✅ ADD clarity.ms, REMOVE 'unsafe-inline' from script-src    |
| e05b784       | ~22:42     | Empty commit to trigger rebuild                              |
| e289387       | ~22:51     | Another empty commit to force fresh build                    |
| Railway Build | ~22:54     | 🔨 Compiled securityMiddleware with e245bb3 changes INCLUDED |

---

## Immediate Actions Needed

### Option 1: Clear Cloudflare Cache

```bash
# If Cloudflare is caching headers
→ Cloudflare Dashboard → Caching → Purge Everything
→ Or purge specific URLs: /app, /api/health
```

### Option 2: Force Railway Rebuild Without Cache

```bash
# Delete Railway build cache and redeploy
→ Railway Dashboard → [Project] → Build → Clear Cache
→ Click "Deploy" to rebuild from scratch
```

### Option 3: Add CSP Via Cloudflare Worker (Temporary Fix)

If we can't identify the CSP source, add clarity.ms via Cloudflare:

```javascript
// Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    let response = await env.ORIGIN.fetch(request);
    let csp = response.headers.get("content-security-policy") || "";

    // Add clarity.ms if not present
    if (csp && !csp.includes("clarity.ms")) {
      csp = csp.replace(
        "static.cloudflareinsights.com",
        "static.cloudflareinsights.com https://www.clarity.ms",
      );
      response.headers.set("content-security-policy", csp);
    }
    return response;
  },
};
```

### Option 4: Check for Meta Tag CSP

```bash
# SSH into production and check if HTML has CSP meta tag
curl -s https://aivis.biz/app | grep -i "meta.*csp\|content-security"
# If found, this is overriding header-based CSP
```

---

## User Reported Issue

**From feedback**: "Your CSP is blocking assets required for the CITE LEDGER™ or BRAG visualizations"

**Translation**: Clarity.ms script is blocked because it's not in the allowlist

**Our fix**: Code DOES include clarity.ms in nonce-based CSP

**Problem**: Production isn't using our code's CSP

---

## Next Steps

1. **Identify CSP source**: Find where production CSP is actually coming from
2. **Clear caches**: Cloudflare cache, Railway build cache, browser cache
3. **Force redeploy**: Trigger fresh build on Railway without cache
4. **Verify**: `curl -I https://aivis.biz/app | grep script-src` should show `similarity.ms` and `strict-dynamic`

---

## Documents for Reference

- `CSP_SECURITY_CONFIGURATION.md` — Complete nonce-based CSP explanation
- `LIGHTHOUSE_REMEDIATION_REPORT.md` — Full fix details
- `securityMiddleware.ts` — Source code with clarity.ms whitelisted

---

**Status**: ⏳ **Awaiting investigation to identify CSP source in production**
