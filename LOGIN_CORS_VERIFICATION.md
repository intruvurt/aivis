# Login CORS Verification Guide

## Login Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser at https://aivis.biz (Frontend)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
            POST /api/auth/login with credentials
              (Content-Type: application/json)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Browser CORS Engine                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 1. Detects cross-origin request (different domain)         │ │
│ │ 2. Sends automatic OPTIONS preflight request               │ │
│ │ 3. Checks response for Access-Control headers               │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
        OPTIONS /api/auth/login (HTTP 204)
           (preflight verification)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Server at https://api.aivis.biz (API)                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Universal CORS Handler (runs FIRST)                        │ │
│ │ ────────────────────────────────────────────────────────── │ │
│ │ 1. Reads Origin header from request                        │ │
│ │ 2. Normalizes origin (lowercase, remove trailing /)        │ │
│ │ 3. Checks against ALLOWED_ORIGINS:                         │ │
│ │    - https://aivis.biz ✓ MATCH                             │ │
│ │    - https://www.aivis.biz                                 │
│ │    - http://localhost:5173 (dev)                           │
│ │    - http://localhost:3000 (dev)                           │
│ │    - ${FRONTEND_URL} (from env)                            │ │
│ │ 4. Sets response headers:                                  │ │
│ │    - Access-Control-Allow-Origin: https://aivis.biz        │ │
│ │    - Access-Control-Allow-Credentials: true                │ │
│ │    - Vary: Origin                                          │ │
│ │ 5. For OPTIONS, also sets:                                 │ │
│ │    - Access-Control-Allow-Methods                          │ │
│ │    - Access-Control-Allow-Headers                          │ │
│ │    - Responds with 204 No Content                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                           ↓                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ cors() Middleware (fallback)                               │ │
│ │ Same origin validation, detailed logging                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                           ↓                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Auth Router (/api/auth)                                    │ │
│ │ ────────────────────────────────────────────────────────── │ │
│ │ 1. Validates email/password/captcha                        │ │
│ │ 2. Checks if user exists                                   │ │
│ │ 3. Verifies password hash                                  │ │
│ │ 4. CRITICAL: Checks if email is verified                  │ │
│ │ 5. Generates JWT token                                     │ │
│ │ 6. Returns { user, token }                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
          Response with CORS headers
        (Access-Control-Allow-Origin: https://aivis.biz)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Browser CORS Engine                                              │
│ ✓ Checks for Access-Control headers                             │
│ ✓ Headers present! Allows script to read response               │
│ ✓ Passes response to JavaScript                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
  Frontend JS receives token and logs in user
```

## Component: Client Login Form

**File:** [client/src/views/AuthPage.tsx](client/src/views/AuthPage.tsx)

```typescript
// Key parts of the login submission:
const handleSignIn = useCallback(
  async (e: React.FormEvent) => {
    const captchaToken = await getCaptchaToken("login");
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // ← Send cookies with request
      body: JSON.stringify({ email, password, captchaToken }),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Handle email verification requirement
      if (raw?.code === "EMAIL_NOT_VERIFIED") {
        setShowResend(true);
        // Prompt user to verify
        return;
      }
      throw new Error(raw?.error || "Sign in failed");
    }

    // Extract user and token
    const payload = unwrapPayload(raw);
    login(payload.user, payload.token);
    navigate(redirect); // Redirect to app
  },
  [apiBase, email, password, login, navigate, searchParams],
);
```

**Key Features:**

- ✅ Uses correct API_URL based on hostname
- ✅ Sets `credentials: "include"` (required for CORS with cookies)
- ✅ Handles email verification flow
- ✅ Validates response format before using

## Component: Server Login Handler

**File:** [server/src/controllers/authControllerFixed.ts](server/src/controllers/authControllerFixed.ts#L360)

```typescript
export const login = async (req: Request, res: Response) => {
  // 1. Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: errors.array()[0].msg });

  // 2. Get user by email
  const user = await getUserByEmail(email);
  if (!user)
    return res.status(401).json({ error: "Invalid email or password" });

  // 3. Check if account is locked (after failed attempts)
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(403).json({
      error: "Account temporarily locked due to too many failed login attempts",
      code: "ACCOUNT_LOCKED",
    });
  }

  // 4. Verify password
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    await incrementLoginAttempts(email);
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // ⚠️ CRITICAL: Verify email before allowing login
  if (!user.is_verified) {
    return res.status(403).json({
      error: "Please verify your email before logging in",
      code: "EMAIL_NOT_VERIFIED",
      requiresVerification: true,
      userEmail: email,
    });
  }

  // 5. Reset failed attempts on success
  await resetLoginAttempts(email);

  // 6. Generate JWT token
  const token = signUserToken({ userId: user.id, tier: effectiveTier });

  // 7. Return response (CORS headers auto-added by universal handler)
  return res.json({
    success: true,
    data: { token, user: safeUser },
  });
};
```

**Security Features:**

- ✅ Rate limiting on failed attempts
- ✅ Account lockout after N failures
- ✅ Email verification requirement (prevents spam)
- ✅ Proper error messages (don't leak account existence)
- ✅ JWT token generation with tier info

## CORS Middleware Chain for Login

**Request Path:** `POST /api/auth/login`

```
1. app.use() - Universal CORS Handler (NEW - my fix)
   └─ Sets Access-Control headers on EVERY response
   └─ Handles OPTIONS preflight with 204

2. app.use() - Helmet security headers
   └─ Doesn't interfere with CORS headers

3. app.use() - cors() middleware
   └─ Validates origin again (belt-and-suspenders)
   └─ Logs detailed CORS info

4. app.use('/api/auth') - authRoutes
   └─ Routes to /login handler
   └─ Returns response with CORS headers already set
```

## Verification Checklist

### ✅ Backend Configuration

- [x] Universal CORS handler runs before all routes
- [x] Allowed origins include `https://aivis.biz`
- [x] FRONTEND_URL environment variable **must be set** in Render
- [x] Login endpoint validates credentials
- [x] Email verification is required
- [x] Rate limiting prevents brute force
- [x] JWT token generation works

### ✅ Client Configuration

- [x] API_URL correctly points to `https://api.aivis.biz` when frontend is `https://aivis.biz`
- [x] Credentials are sent with requests (`credentials: "include"`)
- [x] Response handling expects JSON with `{ data: { user, token } }`
- [x] Email verification flow is implemented
- [x] Error messages are displayed to user

### ✅ Network/Deployment

- [ ] FRONTEND_URL is set in Render dashboard to `https://aivis.biz`
- [ ] Backend service is deployed and running
- [ ] Frontend is built with `npm run build`
- [ ] Both services are accessible from browser

## Testing Login Locally

```bash
# Terminal 1: Start backend (on port 3001)
cd server
FRONTEND_URL=http://localhost:5173 npm run dev

# Terminal 2: Start frontend (on port 5173)
cd client
npm run dev

# Browser
# Go to http://localhost:5173
# Click "Sign In" or "Create Account"
# Backend logs should show:
#   [CORS] ✓ Allowed origin: http://localhost:5173
```

## Testing Login in Production

In Render dashboard:

1. Click `aivis` backend service
2. Environment → Environment Variables
3. Set: `FRONTEND_URL` = `https://aivis.biz`
4. Click Save Changes
5. Wait for redeploy (watch status)
6. Go to `https://aivis.biz`
7. Click Sign In
8. Render logs should show `[CORS] ✓ Allowed origin: https://aivis.biz`

## Troubleshooting

### CORS Error on Login

```
Access to fetch at 'https://api.aivis.biz/api/auth/login'
from origin 'https://aivis.biz' has been blocked by CORS policy
```

**Cause:** FRONTEND_URL not set in Render dashboard

**Fix:**

1. Render dashboard → `aivis` service
2. Environment → add `FRONTEND_URL=https://aivis.biz`
3. Save and wait for redeploy

### "Could not reach AiVIS.biz API" Error

```javascript
// Frontend error message shows this
```

**Possible causes:**

- VITE_API_URL is set incorrectly at build time
- Backend isn't running
- Network connectivity issue

**Fix:**

1. Check `render.yaml` - VITE_API_URL should be `https://api.aivis.biz`
2. Check backend logs in Render
3. Verify both frontend and backend services are running (green status)

### Email Verification Required

```json
{
  "error": "Please verify your email before logging in",
  "code": "EMAIL_NOT_VERIFIED"
}
```

**This is expected.** User must verify email first:

1. Check email for verification link
2. Or click "Resend verification email"
3. The frontend handles this automatically

### Account Locked

```json
{
  "error": "Account temporarily locked after too many failed login attempts",
  "code": "ACCOUNT_LOCKED"
}
```

**Fix:** User must wait ~15 minutes for lockout to expire, or contact support

## Code Files

- **Client Login:** [client/src/views/AuthPage.tsx](client/src/views/AuthPage.tsx#L256-L320)
- **Server Login:** [server/src/controllers/authControllerFixed.ts](server/src/controllers/authControllerFixed.ts#L360)
- **Auth Routes:** [server/src/routes/authRoutes.ts](server/src/routes/authRoutes.ts#L562-L569)
- **CORS Handler:** [server/src/server.ts](server/src/server.ts#L189-L244)
- **API Config:** [client/src/config.ts](client/src/config.ts#L1-L50)

## What I Fixed

✅ **Universal CORS Handler**

- Sets `Access-Control-Allow-Origin` on **every** response
- Handles OPTIONS preflight requests
- Added localhost dev URLs
- Enhanced logging for debugging

✅ **Origin Validation**

- Hardcoded `https://aivis.biz` and `https://www.aivis.biz`
- Respects `FRONTEND_URL` environment variable
- Normalizes origins (lowercase, trailing slashes)
- Prevents open redirect attacks

✅ **Credential Support**

- `credentials: "include"` on client
- `Access-Control-Allow-Credentials: true` on server
- Allows session cookies to work across origins

## Next Steps

1. **Set FRONTEND_URL in Render**
   - Go to dashboard
   - Environment → Environment Variables
   - Add `FRONTEND_URL=https://aivis.biz`
   - Save and redeploy

2. **Test Login**
   - Go to `https://aivis.biz`
   - Click "Sign In"
   - Enter credentials
   - Should redirect to app

3. **Check Logs**
   - Render → `aivis` service → Logs
   - Look for `[CORS] ✓ Allowed origin: https://aivis.biz`

🎉 **Login should now work with CORS!**
