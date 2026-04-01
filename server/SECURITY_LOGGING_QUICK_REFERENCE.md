/**
 * SECURITY EVENT LOGGING — DEVELOPER QUICK REFERENCE
 * 
 * How to use the security event logger in routes and middleware
 */

-- IMPORT STATEMENT

import {
  logAuthFailure,
  logMissingToken,
  logInvalidToken,
  logEmailUnverified,
  logInsufficientTier,
  logForbiddenAccess,
  logUsageExceeded,
  logInvalidUpload,
  logPrivateHostAttempt,
  logMalformedPayload,
  logRateLimitTriggered,
  logAbusePattern,
  sanitizeAndLogError,
} from '../lib/securityEventLogger.js';

---

## COMMON PATTERNS

### Pattern 1: Auth Failure

```ts
// middleware/authRequired.ts
if (!auth?.startsWith('Bearer ')) {
  logMissingToken(req);
  return res.status(401).json({ error: 'Not authenticated' });
}
```

### Pattern 2: Authorization / Tier Check

```ts
// routes/competitors.ts
const userTier = (req as any).user?.tier as CanonicalTier;
if (!meetsMinimumTier(userTier, 'alignment')) {
  logInsufficientTier(req, user.id, 'alignment', userTier);
  return res.status(403).json({ error: 'Feature requires Alignment+' });
}
```

### Pattern 3: Usage Limit Exceeded

```ts
// middleware/usageGate.ts
if (currentUsage >= monthlyLimit) {
  logUsageExceeded(req, userId, monthlyLimit, currentUsage);
  return res.status(402).json({ error: 'Monthly scan limit reached' });
}
```

### Pattern 4: Invalid Payload

```ts
// routes/uploads.ts
if (!isValidMimeType(file.mimetype)) {
  logInvalidUpload(req, userId, `Invalid MIME type: ${file.mimetype}`, {
    received: file.mimetype,
    allowed: ['applicatio/pdf', 'text/plain'],
  });
  return res.status(400).json({ error: 'Invalid file type' });
}
```

### Pattern 5: Security Violation (URL Safety)

```ts
// server.ts /api/analyze
if (IS_PRODUCTION && isPrivateOrLocalHost(targetUrl)) {
  logPrivateHostAttempt(req, userId, targetUrl);
  return res.status(403).json({ error: 'Cannot audit private/local hosts' });
}
```

### Pattern 6: Error Handling

```ts
// routes/payments.ts
try {
  const charge = await stripe.charges.create({ ... });
} catch (err) {
  sanitizeAndLogError('Stripe charge failed', err, req, userId);
  return res.status(500).json({ error: 'Payment processing failed' });
}
```

### Pattern 7: Abuse Detection

```ts
// middleware/rateLimit.ts
const failedAttempts = incrementFailureCount(userId);
if (failedAttempts > 5) {
  logAbusePattern(req, userId, 'repeated_auth_failures', {
    attempts: failedAttempts,
    window: '10m',
  });
  // ... trigger lockout
}
```

---

## EVENT TYPES (Use in logSecurityEvent)

auth.failed                    // Generic auth failure
auth.invalid_token             // JWT signature/expiry invalid
auth.missing_token             // No Bearer token
auth.email_unverified          // Email not confirmed
auth.account_locked            // Too many login attempts
authz.forbidden                // Access denied
authz.tier_insufficient        // Paid feature on free plan
usage.limit_exceeded           // Monthly scans or API calls maxed
api.invalid_key                // API key not found or expired
api.scope_insufficient         // Missing required scope
url.private_host_attempted     // localhost, 192.168.x.x in prod
upload.invalid_type            // Wrong file MIME type
upload.size_exceeded           // File too large
rate.limit_triggered           // Rate limiter hit
abuse.pattern_detected         // Brute force, spam, etc.
webhook.invalid_signature      // Signature verification failed
external.service_error         // Third-party API failed
external.timeout               // Third-party API timeout
payload.malformed              // JSON parse error, missing fields

---

## AUTOMATIC REDACTION (Developer Can Ignore)

You don't need to sanitize data before passing it to security event logger.
All of these are automatically protected:

```ts
// ✅ These are all safe — redaction happens automatically
logMalformedPayload(req, userId, 'Invalid body', {
  body: req.body,                      // Full body (API keys redacted)
  email: user.email,                   // Masked
  token: req.headers.authorization,    // Redacted
  queryParams: req.query,              // Secret params redacted
});

// Output:
// { 
//   body: { apiKey: '[REDACTED]', ... },
//   email: 'a***z@gmail.com',
//   token: 'Bearer [REDACTED]',
//   queryParams: { token: '[REDACTED]', ... }
// }
```

---

## STRUCTURED LOGGING FOR SIEM/DATADOG INTEGRATION

Event structure for custom logging:

```ts
{
  level: 'warn' | 'alert' | 'critical',
  type: string,                      // See EVENT TYPES above
  timestamp: '2026-03-12T14:23:15Z',
  requestId: 'req_xxx_yyy',          // Trace across services
  userId: 'user_123',                // NOT email
  email: 'a***z@gmail.com',          // Masked
  ip: '203.0.113.0/24',              // May have /24 prefix
  path: '/api/analyze',
  method: 'POST',
  statusCode: 401,
  message: 'Missing bearer token',
  details: { ... },                  // Redacted
  userAgent: 'Mozilla/5.0...'
}
```

Forward to your logging service by wrapping console methods:

```ts
// services/logging.ts
import type { SecurityEvent } from '../lib/securityEventLogger.js';

const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  originalConsoleWarn(...args);
  
  // If it's a security event, forward to SIEM
  const event = args[0] as SecurityEvent | undefined;
  if (event?.level === 'alert' || event?.level === 'critical') {
    forwardToDatadog(event);
  }
};
```

---

## TESTING

```ts
import { logInvalidUpload } from '../lib/securityEventLogger.js';

describe('Security Event Logger', () => {
  it('should redact API keys', () => {
    const capturedLogs: any[] = [];
    const originalWarn = console.warn;
    console.warn = (...args) => capturedLogs.push(args);
    
    logInvalidUpload(mockReq, 'user_1', 'Invalid', { 
      apiKey: 'sk_test_123456789' 
    });
    
    const loggedEvent = capturedLogs[0][1];  // Second arg after message
    expect(loggedEvent.details.apiKey).toBe('[REDACTED]');
    
    console.warn = originalWarn;
  });
});
```

---

## COMMON GOTCHAS

❌ **DON'T:** Pass `req.body` directly if it might contain secrets
```ts
// Bad
console.log('Request:', req.body);  // Might leak API keys before redaction
```

✅ **DO:** Let redaction layer handle it
```ts
// Good — redaction applied automatically
logMalformedPayload(req, userId, 'Invalid', { received: req.body });
```

---

❌ **DON'T:** Catch errors and rethrow without logging
```ts
// Bad
try { ... } catch (e) { throw e; }  // Error lost, no audit trail
```

✅ **DO:** Log then rethrow or handle
```ts
// Good
try { ... } catch (e) { 
  sanitizeAndLogError('Operation failed', e, req, userId);
  throw e;  // or return error response
}
```

---

❌ **DON'T:** Log full JWT tokens or Bearer headers
```ts
// Bad  
console.log('Auth header:', req.headers.authorization);
```

✅ **DO:** Let security logger handle it
```ts
// Good
logInvalidToken(req, userId);  // No need to pass token, it's redacted
```

