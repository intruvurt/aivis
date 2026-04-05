/**
 * SECURITY LOGGING IMPLEMENTATION
 * 
 * Enterprise-Grade Threat Detection for SMB/Agencies/SEO Operators
 * 
 * Last Updated: March 12, 2026
 * Version: 1.0
 */

# Overview

AiVIS now features comprehensive, zero-secret-leakage security event logging designed for operators managing multiple client audits, competitive tracking, and citation analysis workflows.

All logging is **automatically redacted** - secrets, API keys, tokens, and sensitive data cannot accidentally expose in logs.

## Compliance Reality & Limits

This logging layer materially reduces accidental secret leakage risk, but it is not a legal/compliance guarantee by itself.

- Redaction applies to known patterns and structured logging paths; custom serializers or external sinks can still introduce risk if misconfigured.
- Security logging does not replace access control, key rotation, penetration testing, or data retention policies.
- Development fallbacks (for example console email fallback without provider credentials) are operational aids and must not be represented as production-grade delivery evidence.
- For incident response evidence, retain immutable downstream logs (SIEM/vendor retention) in addition to app-console output.

---

## What's Protected

### Automatic Redaction Coverage

✅ **Bearer tokens** - JWTs and OAuth tokens  
✅ **API keys** - All `*_key`, `*_secret`, `*_token` variations  
✅ **Payment data** - Stripe keys, webhook secrets  
✅ **Cloud credentials** - AWS, Google Cloud, Azure keys  
✅ **Email addresses** - Masked as `a****z@domain.com`  
✅ **Passwords** - URLs with password parameter  
✅ **Environment variables** - `OPENROUTER_API_KEY=***`, etc.  
✅ **Basic auth** - `Basic [REDACTED]`  
✅ **Custom patterns** - User, workspace, and internal identifiers  

### Coverage by Route

| Route | Incidents Logged | Level | Use Case |
|---|---|---|---|
| `/api/analyze` | Invalid URL, client key rejection, tier insufficient, usage exceeded | warn, alert | Detect audit abuse, understand tier limits |
| `/api/auth/*` | Failed login, invalid token, email unverified, account locked | warn, alert | Investigate account attacks, onboarding failures |
| `/api/upload/*` | Malformed payload, size exceeded, invalid MIME | warn | Debug upload issues, quota violations |
| `/api/payment/*` | Webhook signature failures, transaction errors | warn, critical | Debug billing integration, dispute resolution |
| `/api/v1/*` (API keys) | Invalid key, scope insufficient, rate limits | warn, alert | Monitor API client behavior, quota exhaustion |
| Webhooks | Delivery failures, signature mismatches | warn, critical | Diagnose webhook infrastructure issues |

---

## Implementation Details

### 1. Enhanced Redaction Layer (`lib/safeLogging.ts`)

**New patterns added:**
- Email masking: `user@domain.com` → `u***r@domain.com`
- Environment variable exposure: `API_KEY=secret123` → `API_KEY=[REDACTED]`
- AWS keys: `AKIA...` → `[AWS_KEY_REDACTED]`
- Google Cloud private keys: Full JSON private keys redacted
- Domain-level parameter sanitization (query strings, fragments)

**Transparent wrapping:**
All `console.*()` calls are wrapped automatically. No special logging syntax needed.

```ts
// ✅ Safe - all args redacted automatically
console.log('User login:', { email: 'user@example.com', token: req.headers.authorization });
// Outputs: User login: { email: 'u***r@example.com', token: 'Bearer [REDACTED]' }
```

### 2. Security Event Logger (`lib/securityEventLogger.ts`)

**Structured event typing** for consistent audit trails:

```ts
export interface SecurityEvent {
  level: 'info' | 'warn' | 'alert' | 'critical';
  type: SecurityEventType;  // Enum: 'auth.failed', 'url.private_host_attempted', etc.
  timestamp: string;         // ISO 8601
  requestId?: string;        // Tracing across distributed logs
  userId?: string;           // User ID (not email)
  email?: string;            // Masked email if relevant
  ip?: string;               // Requester IP
  path?: string;             // Route path
  method?: string;           // HTTP method
  message: string;           // Human-readable summary
  details?: Record<string, any>;  // Redacted details object
  userAgent?: string;        // Client info
}
```

**Usage:**
```ts
import { logInsufficientTier, logPrivateHostAttempt, logMalformedPayload } from '../lib/securityEventLogger.js';

// Tier insufficient
logInsufficientTier(req, userId, 'signal', 'observer');

// Attempted audit of private host
logPrivateHostAttempt(req, userId, targetUrl);

// Malformed request
logMalformedPayload(req, userId, 'Invalid JSON body', { received: typeof body });
```

### 3. Error Handler Hardening (`middleware/errorHandler.ts`)

**Before:**
```ts
console.error(err.stack);  // ⚠️ Might leak secrets in stack trace
```

**After:**
```ts
const safeError = sanitizeError(err);
console.error('[ErrorHandler]', safeError);  // ✅ Secrets removed
```

### 4. Auth Middleware Integration (`middleware/authRequired.ts`)

**Now logs security events with context:**
- Missing token → `logMissingToken(req)`
- Invalid token → `logInvalidToken(req, userId)`
- Email unverified → `logEmailUnverified(req, userId, email)`
- Any error → `sanitizeAndLogError('[Auth Required]', err, req)`

All captures are structured, redacted, and traceable by `requestId`.

---

## For SMB/Agency Operators

### 1. **Audit Trail for Client Work**

Track every audit request per client:

```ts
// Log shows:
// [2026-03-12T14:23:15Z] [AUTH.FAILED] auth.invalid_token
// { userId: 'user_123', ip: '192.168.x.x', path: '/api/analyze' }
```

**Use case:** Verify which client ran which audit, when, from where.

### 2. **Competitive Intelligence Monitoring**

Track competitor tracking access:

```ts
// Logs show attempts to access competitor data by tier
logInsufficientTier(req, userId, 'alignment', 'observer');
// → Tells you free users attempting paid features
```

### 3. **Rate Limit & Quota Management**

```ts
logUsageExceeded(req, userId, monthlyLimit, currentUsage);
// → Identify users hitting monthly caps, plan upgrade candidates
```

### 4. **Abuse Pattern Detection**

```ts
logAbusePattern(req, userId, 'repeated_auth_failures', { attempts: 7 });
// → Alert on brute force, account lockout triggers
```

### 5. **Upload & Batch Analysis Logging**

```ts
logInvalidUpload(req, userId, 'File size exceeded', { received: '15MB', max: '10MB' });
// → Monitor batch upload usage and quota enforcement
```

---

## Accessing Security Logs

### Console Output (Development)

All redacted logs appear in console during `npm run dev`:

```
[2026-03-12T14:23:15Z] [AUTH.MISSING_TOKEN] Missing bearer token in Authorization header
{
  level: 'warn',
  type: 'auth.missing_token',
  ip: '203.0.113.42',
  path: '/api/analyze',
  method: 'POST'
}
```

### Production Logging (Sentry)

If `SENTRY_DSN` is configured, all `level: 'alert' | 'critical'` events are reported:

```
// Automatically sent to Sentry
- auth.account_locked
- abuse.pattern_detected
- url.private_host_attempted
- webhook.invalid_signature
- database errors
```

### Custom Integrations

Wire security events to your SIEM/logging service:

```ts
// Example: Forward to Datadog
const originalLog = console.warn;
console.warn = (...args) => {
  originalLog(...args);
  if (args[0]?.level === 'alert' || args[0]?.level === 'critical') {
    sendToDatadog(args[0]);  // Your integration
  }
};
```

---

## Tier-Based Event Examples

### Observer [Free]

Events logged:
- ✅ Invalid URL attempts
- ✅ Missing auth token
- ✅ Email verification required
- ✅ Rate limiting triggered
- ✅ Tier insufficient (attempting Signal+ features)

### Alignment [Core]

Events logged:
- ✅ All Observer events
- ✅ Competitor tracking access denied (tier insufficient)
- ✅ API scope insufficient
- ✅ Usage limit exceeded

### Signal [Premium]

Events logged:
- ✅ All Alignment events
- ✅ Citation testing access attempts from lower tiers
- ✅ Triple-check override requests
- ✅ Webhook signature failures (API integration)

### scorefix (Legacy)

Events logged:
- ✅ All Signal events
- ✅ Legacy endpoint usage audit trail
- ✅ Advanced model chain selection

---

## Best Practices

### 1. **Monitor Critical Events**

Set up alerts for:
- `auth.account_locked` → Someone attacking an account
- `url.private_host_attempted` in production → Security policy violation
- `abuse.pattern_detected` → Potential bot or organized attack
- `webhook.invalid_signature` → Integration compromise

### 2. **Regular Audit Trail Review**

Weekly:
- Download logs from Sentry (if configured)
- Search for failed auth attempts by user tier
- Verify no unauthorized API key usage

Monthly:
- Identify power users and upsell candidates
- Review rate limit triggers, understand genuine usage spikes
- Audit privilege escalation attempts (tier bypass).

### 3. **Incident Response**

When an issue occurs:
1. Search logs by `requestId` for end-to-end trace
2. Identify user by `userId` + `email`
3. Check IP for geo anomalies
4. All secrets already redacted, safe to share logs with support team

---

## What's NOT Logged (By Design)

❌ Audit target URLs (except for validation errors)  
❌ Full request bodies  
❌ Any environment variable values  
❌ Customer API keys (they're rejected server-side)  
❌ Stripe webhook payloads  
❌ GDPR personal data (only IDs, masked emails)  

**Principle:** Log threat signals, not sensitive business data.

---

## Validation & Testing

### Verify Redaction Works

```bash
# Search logs for accidentally leaked data
grep -i "bearer " logs.txt     # Should be empty (all redacted)
grep "api_key=" logs.txt       # Should be empty (all redacted)
grep "@gmail\.com" logs.txt    # OK (emails are partially masked)
```

### Test Security Event Logger

```ts
import { logPrivateHostAttempt } from '../lib/securityEventLogger.js';

const mockReq = {
  headers: { 'user-agent': 'test' },
  path: '/api/analyze',
  method: 'POST',
};

logPrivateHostAttempt(mockReq as any, 'user_123', 'http://localhost:3000');
// ✅ Outputs redacted event with requestId, timestamp, etc.
```

---

## Rollout Checklist

- ✅ Enhanced redaction patterns added to `lib/safeLogging.ts`
- ✅ Security event logger created (`lib/securityEventLogger.ts`)
- ✅ Auth middleware wired to security events
- ✅ Error handler hardened (console output sanitized)
- ✅ All `console.*()` calls wrapped with auto-redaction
- ⏭️ Routes updated to use structured event logging (in progress)
- ⏭️ Sentry integration for critical events (optional)
- ⏭️ Dashboard for security event visualization (future)

---

## Support & Escalation

For security questions:
- Do NOT include full logs in emails (even though they're redacted, principle of least privilege)
- Include only the `requestId`, `timestamp`, and event `type`
- Include description of what you were trying to do
- Include user tier and date/time range

---

## References

- [OWASP: Secure Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [CWE-532: Incorrect Data Retention](https://cwe.mitre.org/data/definitions/532.html)
- [GDPR Article 32: Security of Processing](https://gdpr-info.eu/art-32-gdpr/)

