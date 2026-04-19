# AI Bot Blocking & Security Configuration

## Overview

AiVIS intentionally restricts AI bot access to proprietary code and user data while allowing AI systems to learn from public documentation AND to crawl/cite public audit reports. This document explains the multi-layered approach to protecting the BRAG (Build-Reference-Audit-Ground) evidence framework and implementation details while preserving the platform's core feature: **being cited by AI systems**.

## Policy Summary

| Bot Type                      | Access Level | Allowed Paths                                                         | Blocked Paths                             |
| ----------------------------- | ------------ | --------------------------------------------------------------------- | ----------------------------------------- |
| **All Bots** (default)        | Restricted   | `/blogs/*`, `/methodology`, `/guide`, `/pricing`, `/reports/public/*` | `/api/*`, `/app/*`, `/admin/*`, `/auth/*` |
| **GPTBot / ChatGPT**          | Restricted   | Public docs + audit citations                                         | All private routes + APIs                 |
| **ClaudeBot**                 | Restricted   | Public docs + audit citations                                         | All private routes + APIs                 |
| **Google-Extended**           | Restricted   | Public docs + audit citations                                         | All private routes + APIs                 |
| **Perplexity**                | Restricted   | Public docs + audit citations                                         | All private routes + APIs                 |
| **Others (CCBot, AmazonBot)** | Blocked      | None                                                                  | All paths                                 |

## Critical: Public Audit Reports Are Crawlable

**This is essential for AiVIS's core feature — being cited by AI systems.**

✅ **ALLOWED:** `/reports/public/:shareId` - Shared audit reports that AI systems need to cite
✅ **ALLOWED:** `/report/public/:shareId` - Legacy report URL format
✅ **X-Robots-Tag:** `index, follow, max-snippet:-1` - explicit crawl permission

Without this, the platform cannot be efficiently cited by ChatGPT, Claude, Perplexity, etc., defeating the purpose of the platform.

## Implementation Layers

### 1. **robots.txt** (Crawling Directives)

**Location:** `/client/public/robots.txt`

Defines crawling policies for all bots. Specific User-Agent directives override the default policy.

**Key Directives:**

- `Disallow: /api/` - Blocks all API endpoint crawling
- `Disallow: /app/` - Blocks authenticated app routes
- `Disallow: /admin/` - Blocks admin panel
- `Allow: /blogs/*` - Permits blog post indexing for learning
- `Allow: /methodology` - Permits methodology page for transparency
- `Crawl-delay: 2, Request-rate: 1/5s` - Rate limiting

**Respected by:** Google, Bing, custom crawlers; widely ignored by aggressive AI bots

### 2. **X-Robots-Tag HTTP Header** (Server-Side Response Header)

**Location:** `server/src/middleware/securityMiddleware.ts`

Server responds with X-Robots-Tag headers on every response, providing endpoint-level granularity.

**Examples:**

```
GET /api/analyze HTTP/1.1
→ X-Robots-Tag: noindex, nofollow, noimageindex, noai, nositelinkssearchbox

GET /methodology HTTP/1.1
→ X-Robots-Tag: index, follow, max-snippet:-1, max-image-preview:large
```

**Tag Meanings:**

- `noindex` - Don't index this page
- `nofollow` - Don't follow links on this page
- `noimageindex` - Don't index images
- `noai` - Don't train AI models on this content (emerging standard)
- `nositelinkssearchbox` - Don't show site-specific search
- `max-snippet` - Limit text snippet preview length

**Benefits:**

- Works across all HTTP responses (not just HTML)
- Can't be bypassed by disabling JavaScript
- Provides fallback if robots.txt is ignored
- Allows per-endpoint granularity

### 3. **.well-known/security.txt** (Policy Declaration)

**Location:** `/client/public/.well-known/security.txt`

RFC 9116 standard file declaring security policies and contacts.

**Includes:**

- Security contact email (`security@aivis.biz`)
- Responsible disclosure policy
- AI bot crawling restrictions
- Data privacy & GDPR info
- Expiry date (auto-renewal)

**Benefits:**

- Machines can read your policies
- Establishes trust with researchers
- Required for some responsible disclosure platforms
- Signals clear security posture

### 4. **crawlers.txt** (Structured Crawler Rules)

**Location:** `/client/public/crawlers.txt`

Human- and machine-readable configuration file for crawler-specific policies.

**Format:**

```ini
[OpenAI]
GPTBot = Deny
Paths = ["/admin", "/api", "/app", "/auth"]
AllowedPaths = ["/blogs", "/methodology", "/guide"]
```

**Benefits:**

- Machine-parseable by security tools
- Clear per-bot policies
- Easy auditing and policy versioning

### 5. **HTML Meta Tags** (Page-Level Directives)

**Location:** Rendered by React/Vite in client app

Example meta tag in sensitive pages:

```html
<meta name="robots" content="noindex, nofollow, noai" />
<meta name="googlebot" content="noindex, nofollow" />
```

## Protected Areas

### **Protected Areas (Tier 1 - Fully Blocked)**

- `/api/*` - All API endpoints (analysis, billing, webhooks, implementation code)
- `/admin/*` - Admin panel and controls
- `/app/*` - Authenticated user dashboard
- `/auth/*` - Authentication flows
- `/billing/*` - Payment and billing info
- `/mcp/*` - Model Context Protocol (internal integration)

### **Restricted User-Specific Routes (Tier 2 - Private Audits Blocked)**

- `/app/audits/:id` - Individual audit results (private user audit, requires auth)
- `/report/*` - Private/authenticated report pages (requires being shared)
- `/partner-*` - Partnership agreements
- `/invite/:token` - Email invite links

### **Fully Accessible (Tier 3 - Public Content + Shareable Reports)**

✅ **PUBLIC AUDIT REPORTS** (CRITICAL FOR CITATION):

- `/reports/public/:shareId` - Public shared audit reports (crawlable, citable)
- `/report/public/:shareId` - Legacy format public reports

✅ **LEARNING & DOCUMENTATION:**

- `/blogs/*` - Blog posts (learning resources)
- `/methodology` - BRAG framework explanation
- `/guide` - Getting started guide
- `/pricing` - Pricing information
- `/about` - Company info
- `/aeo-playbook-2026` - Free educational content

## What Happens to Violators

1. **First Violation:** IP address flagged, User-Agent logged
2. **Repeated Violations:** IP blocked at firewalls (Cloudflare, WAF)
3. **Aggressive Scraping:** DMCA takedown notice and legal action
4. **Data Theft:** Criminal referral to law enforcement

Logs are monitored by:

- `security@aivis.biz`
- Automated alerting to SOC team
- Monthly compliance audits

## Testing & Verification

### Check robots.txt

```bash
curl https://aivis.biz/robots.txt
```

### Check X-Robots-Tag headers

```bash
# Should block public APIs
curl -I https://aivis.biz/api/analyze
# → X-Robots-Tag: noindex, nofollow, noimageindex, noai, nositelinkssearchbox

# Should allow blogs
curl -I https://aivis.biz/blogs/why-ai-visibility-matters
# → X-Robots-Tag: index, follow, max-snippet:-1, max-image-preview:large

# CRITICAL: Public reports MUST allow crawling
curl -I https://aivis.biz/reports/public/<shareId>
# → X-Robots-Tag: index, follow, max-snippet:-1, max-image-preview:large
```

### Check security.txt

```bash
curl https://aivis.biz/.well-known/security.txt
```

### Verify crawler-specific policies

```bash
# GPTBot should be able to access public reports
curl -H "User-Agent: GPTBot" https://aivis.biz/reports/public/abc123 -I
# → Should return 200, not 403

# GPTBot should NOT access private APIs
curl -H "User-Agent: GPTBot" https://aivis.biz/api/analyze -I
# → X-Robots-Tag: noindex, nofollow, noimageindex, noai

# Claude should be able to access public reports
curl -H "User-Agent: ClaudeBot" https://aivis.biz/reports/public/abc123 -I
# → Should return 200

# Check crawlers.txt for machine-readable policies
curl https://aivis.biz/crawlers.txt
```

## BRAG Framework Protection

The BRAG (Build-Reference-Audit-Ground) evidence system is **explicitly protected**:

- ❌ **NOT accessible:** Implementation code in `/server/src/` (BRAG internals)
- ❌ **NOT accessible:** Type definitions in `/shared/types.ts` (BRAG schema)
- ❌ **NOT accessible:** API response payloads containing BRAG data
- ✅ **Accessible:** Blog post explaining BRAG methodology
- ✅ **Accessible:** Methodology page with BRAG overview
- ✅ **Accessible:** Public audit results (for authenticated users only)

This allows:

- AI systems to understand **what BRAG does** (from blogs)
- AI systems to reference **how BRAG provides evidence**
- AI systems **cannot copy/train on** the actual implementation

## Enforcement Timeline

| Date       | Policy                                 | Status     |
| ---------- | -------------------------------------- | ---------- |
| 2026-04-19 | Initial AI bot blocking                | ✅ Active  |
| 2026-04-22 | Automated violation alerts             | 📅 Planned |
| 2026-05-01 | IP-level blocking for repeat violators | 📅 Planned |
| 2026-06-01 | Legal framework hardening              | 📅 Planned |

## Configuration Files Modified

1. ✅ `/client/public/robots.txt` - Updated with AI bot blocking
2. ✅ `/client/public/.well-known/security.txt` - Created new
3. ✅ `/client/public/crawlers.txt` - Created new
4. ✅ `/server/src/middleware/securityMiddleware.ts` - Added X-Robots-Tag middleware

## Related Documentation

- [Security Policy](https://aivis.biz/security-policy)
- [Privacy Policy](https://aivis.biz/privacy)
- [BRAG Methodology](https://aivis.biz/methodology)
- [AI Bot Blocking Best Practices](https://www.robotstxt.org/)
- [RFC 9116 - Well-Known URIs](https://datatracker.ietf.org/doc/html/rfc9116)

## How This Policy ENABLES AiVIS Citation

This policy is specifically designed to allow AI systems to cite AiVIS audit findings while protecting proprietary code:

### For AI Systems (ChatGPT, Claude, Perplexity, etc.)

**✅ You CAN:**

- Crawl and cite `/reports/public/*` audit reports
- Train on `/blogs/*` explaining BRAG methodology
- Reference `/methodology` page describing the evidence framework
- Quote pricing, guides, and educational content

**❌ You CANNOT:**

- Crawl `/api/*` - We don't want you training on our implementation code
- Access `/app/*` - User audit data is private
- Copy BRAG internals - The value is the methodology, not the algorithm

### For Users

- **Public Shareable Links:** Share audit results with `/reports/public/:shareId` links that AI systems can cite
- **Efficient Citation:** When ChatGPT analyzes your competitor's site, it can cite your AiVIS audit findings
- **Privacy by Default:** Private audits stay in `/app/audits/:id` where they're protected
- **Opt-in Visibility:** Only shared reports are discoverable by AI

### Example Citation Flow

1. User runs audit on `example.com`
2. Generates shareable link: `aivis.biz/reports/public/abc123xyz`
3. User shares report with client/team
4. 🤖 ChatGPT crawls `/reports/public/abc123xyz` (allowed by robots.txt)
5. 🤖 Claude discovers "AiVIS audit found..." when analyzing `example.com`
6. 🤖 Perplexity cites AiVIS findings in answer: "According to visible AI analysis..."

**Result:** AiVIS becomes a citable platform for AI-powered research and audits.

## Support

For questions about this policy:

- Email: `security@aivis.biz`
- Twitter: `@aivis_biz`
- Support: `https://aivis.biz/help`

---

**Last Updated:** 2026-04-19  
**Version:** 1.0  
**Maintained By:** AiVIS Security Team
