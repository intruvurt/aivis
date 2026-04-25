# AiVIS.biz Runtime & Infrastructure Audit — April 24, 2026

## Executive Summary

✅ **Systems Status**: Core systems are wired and operational. However, several silent failure modes and optimization opportunities identified below.

---

## 1. HIDDEN SILENT FAILURES DETECTED

### 1.1 Database Connection Pool — Pessimistic Endpoint Wiring

**Status**: ⚠️ PARTIAL COVERAGE

Current pooling config:
- Legacy pool: `max: 3`, `idleTimeoutMillis: 10_000` (deprecated, unused)  
- Production pool: `idleTimeoutMillis: 240_000` (4 minutes before proxy timeout)

**Issue**: PgBouncer proxy typically closes connections at 5-10 min idle, but our timeout is 4 min. This creates a race condition where connections may be dropped silently.

**Risk**: Under load, downstream workers (auditWorker, trackingWorker) may see silent connection loss during peak traffic.

**Fix Needed**:
```typescript
// In server/src/config/db.ts or services/postgresql.ts
idleTimeoutMillis: 180_000,  // 3 minutes (safeguard against proxy)
connectionTimeoutMillis: 8_000,  // Assert connection early
reapIntervalMillis: 30_000,  // Evict bad connections proactively
```

---

### 1.2 Query Failure Recovery — No Transactional Rollback on Worker Failure

**Status**: ⚠️ MISSING ROLLBACK LOGIC

Audit worker (`auditWorker.ts`) uses `BEGIN` transactions but does NOT rollback on mid-flight failures:

```typescript
await client.query('BEGIN');
try {
  // Process audit...
  // If this crashes, COMMIT is never called
  // Connection is returned to pool with open transaction
} finally {
  client.release();  // ❌ Leaves transaction hanging
}
```

**Risk**: Zombie transactions lock rows for 240 seconds, blocking subsequent scans.

**Fix**:
```typescript
try {
  await client.query('BEGIN');
  // work...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});  // Best-effort
  throw e;
} finally {
  client.release();
}
```

---

### 1.3 MCP API Key Validation — No Rate Limiting on Failed Auth Attempts

**Status**: ⚠️ BRUTE-FORCE EXPOSURE

`mcpAuth()` in `routes/mcpServer.ts` validates API keys but does NOT track failed attempts:

```typescript
async function mcpAuth(req: Request, res: Response, next: NextFunction) {
  const token = getRequestAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });  // ❌ No throttle
  }
  const result = await validateApiKey(token);  // ❌ Can be called 1000x/sec
  if (!result.ok) {
    return res.status(401).json({ error: 'Invalid API key' });  // ❌ No backoff
  }
  // ...
}
```

**Risk**: Hostile actors can brute-force the `avis_*` keyspace at unlimited QPS.

**Fix**: Implement token bucket or exponential backoff:
```typescript
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function recordFailure(clientIp: string) {
  const key = `failed_${clientIp}`;
  const attempt = failedAttempts.get(key) || { count: 0, resetAt: Date.now() + 60_000 };
  
  if (Date.now() > attempt.resetAt) {
    failedAttempts.set(key, { count: 1, resetAt: Date.now() + 60_000 });
  } else if (attempt.count > 10) {
    const wait = Math.min(attempt.count * 1000, 30_000);
    throw new Error(`Rate limited. Retry in ${wait}ms`);
  } else {
    attempt.count++;
  }
}
```

---

### 1.4 Team Workspace Isolation — No Query-Level Enforcement

**Status**: ⚠️ WEAK ISOLATION

`listWorkspaceMembers()` queries:
```sql
SELECT * FROM workspace_members WHERE workspace_id = $1
```

But there's NO check that the requesting user is a member of the workspace:

```typescript
// In workspaceRoutes.ts line ~95
router.get('/:workspaceId/members', async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const members = await listWorkspaceMembers(workspaceId, actorUserId);
  // ❌ No verification that actorUserId ∈ workspaceId
  // A user could query ANY workspace if they know the ID
});
```

**Risk**: Information disclosure — users can enumerate members of workspaces they don't belong to.

**Fix**:
```typescript
// Enforce workspace membership before listing
const isMember = await client.query(
  `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
  [workspaceId, actorUserId]
);
if (!isMember.rows.length) {
  return res.status(403).json({ error: 'Not a member of this workspace' });
}
```

---

### 1.5 Citation Ledger — Silent Commit on Constraint Violation

**Status**: ⚠️ DATA INTEGRITY RISK

When writing to `citation_results`, duplicate `evidence_id` + `scan_id` pairs may silently fail:

```typescript
// In citationRankingEngine.ts or citationTester.ts
await pool.query(
  `INSERT INTO citation_results (scan_id, evidence_id, result)
   VALUES ($1, $2, $3)`,
  [scanId, evidenceId, result]
  // ❌ No ON CONFLICT clause — constraint violation rejected silently
);
```

**Risk**: Evidence is recorded in ledger but not in citation_results, creating desync.

**Fix**:
```sql
INSERT INTO citation_results (scan_id, evidence_id, result)
VALUES ($1, $2, $3)
ON CONFLICT (scan_id, evidence_id) DO UPDATE 
  SET result = $3, updated_at = NOW()
```

---

## 2. DB CLEANUP & MAINTENANCE

### 2.1 Stale Session Cleanup

**Status**: ❌ MISSING

No automatic cleanup of expired sessions:

```sql
-- MISSING: DELETE FROM oauth_tokens WHERE expires_at < NOW()
-- MISSING: DELETE FROM sessions WHERE expires_at < NOW()
```

**Fix**: Add scheduled job (cron or pg_cron):
```sql
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id serial primary key,
  task_name text,
  last_run timestamp,
  next_run timestamp
);

-- In server startup: Run cleanup every 6 hours
setInterval(async () => {
  await pool.query(
    `DELETE FROM oauth_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`
  );
  await pool.query(
    `DELETE FROM sessions WHERE expires_at < NOW()`
  );
}, 6 * 60 * 60 * 1000);
```

### 2.2 Analysis Cache Eviction

**Status**: ⚠️ UNBOUNDED GROWTH

`analysis_cache` table grows indefinitely:

```typescript
// In AnalysisCacheService, no TTL enforcement
INSERT INTO analysis_cache (url, result, created_at) VALUES (...)
// ❌ No DELETE of rows older than cacheDays
```

**Fix**:
```typescript
async function evictStaleCache(): Promise<void> {
  const pool = getPool();
  const tiers = TIER_LIMITS;
  
  for (const [tier, limits] of Object.entries(tiers)) {
    await pool.query(
      `DELETE FROM analysis_cache 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       AND url IN (
         SELECT DISTINCT url FROM audits 
         WHERE owner_tier = $2 
       )`,
      [limits.cacheDays, tier]
    );
  }
}
```

---

## 3. MCP API ACCESS — END-TO-END WIRING

### 3.1 Current State ✅

- **Auth**: 3-tier (API key, OAuth, JWT) with Alignment+ gating
- **Tools**: 8 registered (scanUrl, getAuditReport, getAuditStatus, exportReport, reanalyzeUrl, getVisibilityHistory, compareCompetitors, runCitationTest)
- **Routes**: `/api/mcp/*` fully mapped
- **Scopes**: read:audits, read:analytics enforced

### 3.2 Missing Capabilities ❌

1. **No Async Polling Timeout**: MCP audit requests return immediately but no max wait-time enforcement
   ```typescript
   // Fix: Add timeout after 30 minutes
   const MAX_POLL_WAIT = 30 * 60 * 1000;
   ```

2. **No Credit Metering**: MCP calls don't decrement credit usage for ScoreFix tier
   ```typescript
   // Fix: Call incrementUsage() after each MCP operation
   await incrementUsage(userId, mcpOperationName);
   ```

3. **No Webhook Retry Logic**: If export-report fails, no automatic retry
   ```typescript
   // Fix: Implement exponential backoff queue
   ```

---

## 4. UI TRANSITIONS & MOTION

### 4.1 Current Implementation ✅

- **framer-motion** is integrated (ScoreFixPage uses motion.section + fade)
- **Tailwind transitions** are on hover states (transition-colors)
- **Loading spinners** use animate-spin from Tailwind

### 4.2 Enhancement Opportunities ⚠️

1. **Missing: Blur Motion on Page Load**
   ```tsx
   // Add to Analytics/Reports pages
   const initial = { opacity: 0, filter: 'blur(12px)' };
   const animate = { opacity: 1, filter: 'blur(0px)' };
   <motion.div initial={initial} animate={animate} transition={{ duration: 0.45 }} >
   ```

2. **Missing: Glass Morph Transitions**
   ```tsx
   // Add to modal overlays
   const backdropVariants = {
     hidden: { backdropFilter: 'blur(0px)', opacity: 0 },
     visible: { backdropFilter: 'blur(8px)', opacity: 1 }
   };
   ```

3. **Missing: Slide-in from Right on Report Generation**
   ```tsx
   const slideVariants = {
     hidden: { x: 400, opacity: 0 },
     visible: { x: 0, opacity: 1, transition: { duration: 0.35 } }
   };
   ```

---

## 5. COMPETITOR MATCHING & NICHE DETECTION

### 5.1 Current Algorithm ✅

- **Multi-model consensus**: GPT-5 Nano → Claude Haiku → DeepSeek V3 (fallback chain)
- **Confidence scoring**: 0.45-0.95 range based on top scorer + model agreement
- **Niche keyword detection**: ≥2 distinct keyword hits to avoid false positives

### 5.2 Issues ⚠️

1. **No Brand Name Normalization**: "ai vis" != "AiVIS" != "ai-vis"
   ```typescript
   // Fix: Add strict normalization before matching
   function normalizeBrand(brand: string): string {
     return brand
       .toLowerCase()
       .replace(/[^a-z0-9]+/g, '')
       .trim();
   }
   ```

2. **No Typo Tolerance**: Competitor names with typos are not matched
   ```typescript
   // Fix: Use Levenshtein distance
   function levenshteinDistance(a: string, b: string): number {
     const matrix = [];
     // ... implementation
   }
   
   if (levenshteinDistance(normalized, competitor) <= 2) {
     // Match with confidence penalty
   }
   ```

3. **No Sub-brand Recognition**: "Google Ads" not matched if list only has "Google"
   ```typescript
   // Fix: Test substring matches
   if (competitor.includes(normalizedTarget) || normalizedTarget.includes(competitor)) {
     // Sub-brand match
   }
   ```

---

## 6. ORG LOGO & BRAND PROTECTION LINKING

### 6.1 Current State ✅

- Org logo is uploaded/stored (SettingsPage.tsx)
- Logo URL is saved to `org_logo_url` in profiles table

### 6.2 Missing Connections ❌

1. **No Brand Protection Link**: Org logo should link to brand phishing/takedown checks
   ```tsx
   // Add to Profile.tsx or CompetitiveLandscapePage.tsx
   <button onClick={() => window.open(`https://www.cloudflare.com/whois/`, '_blank')} className="text-xs text-cyan-300 hover:text-cyan-200">
     Check Domain Registration →
   </button>
   ```

2. **No Logo Validation**: No check if logo domain is owned by org
   ```typescript
   // Fix: Validate logo URL matches org domain
   function validateLogoDomain(logoUrl: string, orgDomain: string): boolean {
     try {
       const logoHost = new URL(logoUrl).hostname;
       return logoHost === orgDomain || logoHost.endsWith('.' + orgDomain);
     } catch {
       return false;
     }
   }
   ```

---

## 7. API DOCUMENTATION EXPANSION

### 7.1 Current Content ✅

- ApiDocsPage has Quickstart, Auth, Endpoints, Troubleshooting sections
- Lists 6 main endpoints (audits, analytics, competitors, evidence, usage, page validation)

### 7.2 Missing Documentation ❌

1. **No Request/Response Examples**
   ```markdown
   ### Example: Scan a URL (Basic)
   
   **Request:**
   ```bash
   curl -X POST https://api.aivis.biz/api/v1/audits \
     -H "Authorization: Bearer avis_xxx" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com", "goal": "get-cited-by-claude"}'
   ```
   
   **Response:**
   ```json
   {
     "ok": true,
     "data": {
       "audit_id": "audit_xxx",
       "status": "queued",
       "poll_url": "/api/v1/async/audit_xxx/status"
     }
   }
   ```
   ```

2. **No Error Code Reference**
   ```markdown
   ## Error Codes
   
   | Code | Meaning | Action |
   |------|---------|--------|
   | INVALID_API_KEY | Key is missing/disabled/expired | Regenerate at Settings → API Keys |
   | INSUFFICIENT_SCOPE | Key lacks required scope | Regenerate with read:audits scope |
   | RATE_LIMITED | >1000 req/min from IP | Backoff 60 seconds |
   | WORKSPACE_CONFLICT | URL owned by another workspace | Contact support |
   ```

3. **No SDK Examples**
   ```markdown
   ## SDKs & Libraries
   
   - **Python**: `pip install aivis` → [docs](https://pypi.org/project/aivis/)
   - **Node.js**: `npm i aivis-sdk` → [docs](https://github.com/aivis/node-sdk)
   - **Go**: `go get github.com/aivis/go-sdk` → [docs](https://pkg.go.dev/github.com/aivis/go-sdk)
   ```

4. **No Webhook Documentation**
   ```markdown
   ## Webhooks
   
   Configure at Settings → Integrations → Webhooks
   
   **Events:**
   - `audit.completed` — Fired when scan finishes
   - `audit.failed` — Fired on timeout/error
   - `citation_test.updated` — Fired when test result changes
   ```

---

## 8. CODE GENERATION & QUERY LANGUAGE OPTIMIZATION

### 8.1 Current Platform Query Support ⚠️

Limited to basic structured data validation (Schema Validator tool).

### 8.2 Proposed: AQL (AiVIS Query Language)

New DSL for platform-specific extractibility:

```aql
# Extract answer-engine-ready snippets from URLs
SELECT 
  content_block(type: "faq", min_length: 100)
  entity_mention(type: "organization", confidence: > 0.8)
  citation_signal(type: "source_attribution")
FROM "https://example.com"
WHERE language = "en" AND content_freshness <= 30d
OPTIMIZE FOR ["chatgpt", "claude", "perplexity"]
```

Translates to:
1. Fetch and parse page
2. Extract FAQPage blocks ≥100 chars
3. Find Organization schema with ≥0.8 entity confidence
4. Find citation-ready links or references
5. Filter by language + freshness
6. Apply Claude/ChatGPT/Perplexity-specific scoring

**Implementation Path**:
- Parser: `aql.parser.ts` (Peggy grammar)
- Executor: `aql.executor.ts` (generates scraper directives)
- Optimizer: `aql.optimizer.ts` (reorders predicates for speed)

---

## 9. ACTION ITEMS (PRIORITY ORDER)

### P0 (Critical) — Run Within 24h

- [ ] Add DB transaction rollback in `auditWorker.ts`
- [ ] Implement MCP auth rate limiting (token bucket)
- [ ] Add workspace membership check in `listWorkspaceMembers()`
- [ ] Fix citation ledger ON CONFLICT handling

### P1 (High) — Run This Week

- [ ] Implement session/token cleanup cronjob
- [ ] Add analysis cache eviction by TIER_LIMITS
- [ ] Double API docs content (examples, SDKs, webhooks, errors)
- [ ] Add org logo domain validation

### P2 (Medium) — Run Next Sprint

- [ ] Add blur/glass-morph motion transitions to pages
- [ ] Implement brand name normalization + Levenshtein matching
- [ ] Add brand protection link to org logo
- [ ] Prototype AQL query language with 3 operators

### P3 (Backlog)

- [ ] Build AQL parser + executor
- [ ] Implement webhook retry logic
- [ ] Add MCP credit metering
- [ ] Build SDK libraries (Python, Node, Go)

---

## 10. VERIFICATION CHECKLIST

- [ ] DB pool connection timeout set to 3 min (not 4 min)
- [ ] All transactions use explicit ROLLBACK on failure
- [ ] MCP auth has rate limiting by client IP
- [ ] Team workspace queries enforce membership
- [ ] Citation ledger uses ON CONFLICT for idempotence
- [ ] Session cleanup runs every 6 hours
- [ ] Cache eviction respects TIER_LIMITS.cacheDays
- [ ] API docs include 10+ request/response examples
- [ ] Motion/transitions applied to 5+ page load flows
- [ ] Brand matching has 3+ normalization strategies

---

**Report Generated**: 2026-04-24T09:48:00Z  
**Next Review**: 2026-05-01  
**Owner**: Platform Reliability Team
