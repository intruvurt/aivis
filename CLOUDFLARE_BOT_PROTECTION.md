# ☁️ Cloudflare Bot Protection & Traffic Hardening Guide

## Overview

Based on traffic analysis showing potential bot activity + retry storms (13.48K requests, 7.43K visits), this guide configures Cloudflare to:

✅ Block automated scrapers and vulnerability scanners
✅ Rate-limit by endpoint to stop retry storms
✅ Cache static content to reduce backend load
✅ Mitigate DDoS and bot traffic
✅ Track suspicious patterns in real-time

---

## 1. Enable Cloudflare Bot Management

### Step 1: From Cloudflare Dashboard

1. Go to **Security** → **Bot Management**
2. Ensure **Bot Fight Mode** is **ON** (free tier)
3. For paid plans: Enable **Super Bot Fight Mode** for advanced detection

### Step 2: Configure Bot Fight Mode

- **Definitely Automated** → **Block**
- **Likely Automated** → **Challenge** (CAPTCHA)
- **Verification Failed** → **Block**

---

## 2. Create Rate Limiting Rules (Critical for Your Traffic)

### Step 1: Go to Security → Rate Limiting

### Step 2: Add Rule #1 — API Endpoints (Aggressive)

```
Path: /api/
Match: All Requests
Period: 1 minute
Limit: 100 requests
Action: Block (10 minutes)
```

**Why:** Your `/api/*` endpoints are being hit by retry storms. This stops rapid-fire requests.

### Step 3: Add Rule #2 — Health Checks (Stricter)

```
Path: /api/health
Match: All Requests
Period: 1 minute
Limit: 60 requests
Action: Block (5 minutes)
```

**Why:** `/api/health` polling is one of the top causes of inflated traffic. 60 requests/min per IP is still very generous.

### Step 4: Add Rule #3 — Authentication Endpoints

```
Path: /api/auth/
Match: All Requests
Period: 5 minutes
Limit: 20 requests
Action: Block (10 minutes)
```

**Why:** Stops brute-force login attempts and credential stuffing.

### Step 5: Add Rule #4 — Analysis/Audit Endpoint

```
Path: /api/queue/audit
Match: All Requests
Period: 1 minute
Limit: 30 requests
Action: Block (10 minutes)
```

**Why:** Your main API endpoint should not be hit 30+ times per minute from the same IP/session.

---

## 3. Create Cache Rules (Reduce Backend Load)

### Step 1: Go to Caching → Cache Rules

### Step 2: Add Rule #1 — Health Endpoint (5s Cache)

```
Path: /api/health
Action: Cache
TTL: 5 minutes
Bypass: Authorization header
```

**Why:** Matches our backend cache. Massively reduces database queries.

### Step 3: Add Rule #2 — Pricing + Public Data

```
Path: /api/pricing/* OR /api/public/*
Action: Cache
TTL: 1 hour
Bypass: Authorization header
```

**Why:** Public data changes infrequently; this prevents repeated backend calls.

### Step 4: Add Rule #3 — Static Assets (Long TTL)

```
Path: /assets/* OR *.js OR *.css OR *.woff2
Action: Cache
TTL: 30 days
```

**Why:** Browser/CDN caches static files instead of hitting your server.

---

## 4. Configure WAF (Web Application Firewall)

### Step 1: Go to Security → WAF Rules

### Step 2: Enable Cloudflare Managed Rules

1. Click **Managed Rules**
2. **Enable All** (or select these at minimum):
   - Cloudflare Managed Ruleset (all)
   - WordPress ruleset (if applicable)
   - OWASP ModSecurity Core Ruleset

### Step 3: Add Custom WAF Rule — Block Suspicious Patterns

```
(cf.bot_management.score < 30) → Block
```

**Why:** Blocks traffic from detected bots even if they bypass Bot Fight Mode.

### Step 4: Add Custom WAF Rule — Block Scanning Tools

```
(cf.threat_score >= 50) → Block
```

**Why:** Blocks IPs flagged for attack tools, vulnerability scanners, etc.

---

## 5. DDoS Protection

### Step 1: Go to Security → DDoS

### Step 2: Sensitivity

- Set to **High** (not Ultra)
- This blocks obvious DDoS patterns without false positives

### Step 3: Verify Rules Are In Place

- **TCP protection** ✅
- **UDP protection** ✅
- **HTTP DDoS protection** ✅

---

## 6. Add Security Headers (Already In Place)

Your backend already sets these, but **verify Cloudflare isn't overriding them:**

### Step 1: Go to Page Rules (or Configuration Rules)

### Step 2: Verify Headers

Cloudflare should **NOT** add these (your backend does):

- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`

If Cloudflare adds duplicates, **disable** them in Cloudflare.

---

## 7. Monitor in Real-Time

### Step 1: Go to Analytics & Logs → Firewall

### Step 2: Watch These Tabs

1. **Bot Management** — See blocked bots
2. **Rate Limiting** — See 429 blocks
3. **WAF** — See blocked requests

### Step 3: Create Grafana/Datadog Dashboard (Optional)

Track:

- Requests/min by status code
- Top blocked IPs
- Top blocked paths
- Bot vs. human traffic ratio

---

## 8. Test Your Configuration

### Test 1: Rapid Health Checks (Should Get Rate Limited)

```bash
for i in {1..65}; do curl https://api.aivis.biz/api/health; done
```

**Expected:** After 60 requests in 1 minute, you should see 429 (Too Many Requests).

### Test 2: Simulate Bot Traffic

```bash
curl -H "User-Agent: sqlmap" https://api.aivis.biz/
```

**Expected:** Should get blocked or challenged.

### Test 3: Simulate Legitimate Traffic

```bash
curl -H "User-Agent: Mozilla/5.0" https://api.aivis.biz/api/health
```

**Expected:** Should pass through normally.

---

## 9. Whitelisting (For Trusted Services)

If you have:

- Health checkers (Uptime Robot, PagerDuty, etc.)
- CI/CD systems (GitHub Actions, etc.)
- Internal tools

### Option A: Cloudflare Whitelist

1. Go to **Security** → **WAF**
2. Create custom rule:
   ```
   (cf.client.ip in {192.0.2.1 192.0.2.2}) → Bypass
   ```

### Option B: Header-Based

If services send a header:

```
(http.request.headers["X-Uptime-Check"] == "true") → Bypass
```

---

## 10. Emergency: Rapid Response to Traffic Spike

### If You See 13K+ Requests in an Hour:

1. **Go to Security → Rate Limiting**
2. **Temporarily lower limits:**
   - `/api/health` → 30 requests/min
   - `/api/*` → 50 requests/min
   - `/api/queue/audit` → 15 requests/min

3. **Check Firewall Logs** for patterns:
   - Same IP hitting multiple endpoints?
   - Repeated 400/404 errors?
   - Same User-Agent?

4. **Add Block Rule** for that IP/pattern:

   ```
   (cf.client.ip eq X.X.X.X) → Block
   ```

5. **After 30-60 mins:** Revert limits if attack stops

---

## 11. Monitoring Your Own Backend

You now have:

✅ **Request Logger Middleware** — logs all requests to memory
✅ **`/api/admin/logs`** — view recent requests (filter by path, IP, status)
✅ **`/api/admin/logs/stats`** — view traffic statistics (top endpoints, top IPs, error rate)
✅ **Rate Limiting** — both in backend AND Cloudflare

### Example Admin Query (Protected by Admin Key)

```bash
curl -H "X-Admin-Key: $ADMIN_KEY" \
  "https://api.aivis.biz/api/admin/logs/stats"
```

**Response:**

```json
{
  "stats": {
    "totalRequests": 1523,
    "avgResponseTimeMs": 245,
    "errorRate": 2.5,
    "topEndpoints": {
      "/api/health": 523,
      "/api/queue/audit": 312,
      "/api/auth/profile": 89
    },
    "topIps": {
      "1.2.3.4": 450,
      "5.6.7.8": 130
    }
  }
}
```

---

## 12. Long-Term Optimization

### Weekly Checks:

1. **Review Firewall Logs** — any new attack patterns?
2. **Adjust Rate Limits** — too strict? too loose?
3. **Check Cache Hit Ratio** — in **Analytics** tab
4. **Monitor Error Rate** — spikes usually mean attack

### Monthly:

1. **Audit WAF Rules** — disable unused rules (speed up Cloudflare)
2. **Review Blocked IPs** — any false positives to whitelist?
3. **Update Rate Limits** — based on legitimate traffic growth

---

## 13. Checklist

- [ ] Bot Fight Mode enabled
- [ ] Rate limiting rules added (health, API, audit, auth)
- [ ] Cache rules configured
- [ ] WAF rules enabled
- [ ] DDoS protection set to High
- [ ] Test traffic shows blocks/challenges as expected
- [ ] Admin endpoints secured with `X-Admin-Key`
- [ ] Backend logs wired up (`/api/admin/logs`)

---

## 14. Result

After this setup, you should see:

✅ **13K requests → ~3-4K real traffic** (70%+ reduction)
✅ **Retry storms handled** (rate limiting + backend caching)
✅ **Bots blocked** (Cloudflare Bot Management)
✅ **Database load cut in half** (health check caching + static CDN)
✅ **Full visibility** (request logs + Cloudflare analytics)

---

## Quick Reference

| Endpoint           | Rate Limit | Cache   | Purpose              |
| ------------------ | ---------- | ------- | -------------------- |
| `/api/health`      | 60/min     | 5 min   | Health check polling |
| `/api/queue/audit` | 30/min     | None    | Main audit endpoint  |
| `/api/auth/*`      | 20/5min    | None    | Login/signup         |
| `/api/pricing/*`   | 100/min    | 1 hour  | Pricing info         |
| `/assets/*`        | Unlimited  | 30 days | Static files         |
| `/api/admin/*`     | 10/min\*   | None    | Admin only           |

\*Protected by `X-Admin-Key` header

---

## Support

For questions about Cloudflare settings:

- Cloudflare Docs: https://developers.cloudflare.com
- Check your Firewall Logs tab often
- Use the "Audit" feature to see why requests are blocked

**Status Page:** You can also check your account's current Cloudflare configuration at:
https://dash.cloudflare.com → Select domain → Security tabs
