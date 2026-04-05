// server/src/routes/authRoutes.ts - UPDATED TO USE FIXED AUTH WITH EMAIL VERIFICATION
import express from 'express';
import { body } from 'express-validator';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  getMe,
  updateProfile,
  getReferralSummary,
  validateReferral,
  forgotPassword,
  confirmResetPassword,
} from '../controllers/authControllerFixed.js';
import { authRequired } from '../middleware/authRequired.js';
import { getPool } from '../services/postgresql.js';
import { createUser, getUserByEmail, updateUserById } from '../models/User.js';
import { signUserToken } from '../lib/utils/jwt.js';
import { attachReferralAtSignup, normalizeReferralCodeInput, validateReferralCode } from '../services/referralCredits.js';
import { saveVcsToken } from '../services/autoScoreFixService.js';
import { sendVerificationEmail } from '../services/emailService.js';

const router = express.Router();

type OAuthIntent = 'signin' | 'signup' | 'connect_github';

type OAuthStatePayload = {
  mode: OAuthIntent;
  ref?: string;
  redirect?: string;
  userId?: string;
  nonce: string;
  ts: number;
};

function getApiBase(req: express.Request): string {
  const explicit = String(process.env.API_URL || process.env.VITE_API_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  // Derive from FRONTEND_URL when API_URL isn't set (e.g. Render production)
  const frontend = String(process.env.FRONTEND_URL || '').trim();
  if (frontend) {
    try {
      const u = new URL(frontend);
      return `${u.protocol}//api.${u.hostname}`;
    } catch { /* fall through */ }
  }
  // req.hostname respects trust proxy (reads X-Forwarded-Host)
  return `${req.protocol}://${req.hostname}`.replace(/\/+$/, '');
}

function getFrontendBase(req: express.Request): string {
  const explicit = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const host = req.hostname || req.get('host') || '';
  if (/localhost:3001/i.test(host)) return 'http://localhost:5173';
  return `${req.protocol}://${host}`.replace(/\/+$/, '');
}

function getStateSecret(): string {
  const secret = String(process.env.JWT_SECRET || process.env.SESSION_SECRET || '').trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OAuth state secret missing: set JWT_SECRET or SESSION_SECRET');
    }
    return 'aivis-oauth-state-dev-only';
  }
  return secret;
}

function encodeOAuthState(payload: OAuthStatePayload): string {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json, 'utf8').toString('base64url');
  const sig = createHmac('sha256', getStateSecret()).update(base).digest('base64url');
  return `${base}.${sig}`;
}

function decodeOAuthState(raw: string): OAuthStatePayload | null {
  const [base, sig] = String(raw || '').split('.');
  if (!base || !sig) return null;
  const expected = createHmac('sha256', getStateSecret()).update(base).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(base, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (!parsed?.nonce || typeof parsed?.ts !== 'number') return null;
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    if (parsed.mode !== 'signin' && parsed.mode !== 'signup' && parsed.mode !== 'connect_github') return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildFrontendAuthRedirect(req: express.Request, params: Record<string, string>) {
  const frontendBase = getFrontendBase(req);
  const authUrl = new URL('/auth', frontendBase);
  for (const [key, value] of Object.entries(params)) {
    if (value) authUrl.searchParams.set(key, value);
  }
  // Ensure redirect always goes to our frontend - never allow open redirects
  if (authUrl.origin !== new URL(frontendBase).origin) {
    return new URL('/auth', frontendBase).toString();
  }
  return authUrl.toString();
}

function wantsJson(req: express.Request): boolean {
  const format = String(req.query.format || '').trim().toLowerCase();
  if (format === 'json') return true;
  const accept = String(req.get('accept') || '').toLowerCase();
  return accept.includes('application/json');
}

function publicOAuthErrorMessage(error: unknown, fallback: string): string {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;

  const lowered = message.toLowerCase();
  if (lowered.includes('resend api error') || lowered.includes('mailer.aivis.biz') || lowered.includes('domain is not verified')) {
    return 'Email verification is temporarily unavailable. Please contact support if this continues.';
  }
  if (lowered.includes('fetch failed') || lowered.includes('network')) {
    return 'Could not complete sign-in right now. Please try again.';
  }

  return fallback;
}

function pickSafeOAuthUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    is_verified: user.is_verified,
    tier: user.tier || 'observer',
    created_at: user.created_at,
  };
}

async function issueOAuthVerification(userId: string, email: string): Promise<boolean> {
  const pool = getPool();
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 60 * 1000);

  await pool.query(
    `UPDATE users
     SET is_verified = FALSE,
         verification_token = $1,
         verification_token_expires = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [token, expires, userId]
  );

  await sendVerificationEmail(email, token, {
    expirationMinutes: 30,
    reason: 'oauth_signin',
  });

  return true;
}

router.get('/google', async (req, res) => {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return res.redirect(
      buildFrontendAuthRedirect(req, {
        oauth_error: 'Google OAuth is not configured on server',
      })
    );
  }

  const mode = String(req.query.mode || 'signin') === 'signup' ? 'signup' : 'signin';
  const redirect = String(req.query.redirect || '').trim();
  const ref = normalizeReferralCodeInput(String(req.query.ref || ''));
  const state = encodeOAuthState({
    mode,
    ref: ref || undefined,
    redirect: redirect || undefined,
    nonce: randomBytes(12).toString('hex'),
    ts: Date.now(),
  });

  const callbackUrl = `${getApiBase(req)}/api/auth/google/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent select_account');
  url.searchParams.set('state', state);
  return res.redirect(url.toString());
});

router.get('/google/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const stateRaw = String(req.query.state || '').trim();
    const state = decodeOAuthState(stateRaw);

    if (!code || !state) {
      return res.redirect(
        buildFrontendAuthRedirect(req, {
          oauth_error: 'Google OAuth callback is invalid or expired',
        })
      );
    }

    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const callbackUrl = `${getApiBase(req)}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    const accessToken = String(tokenJson?.access_token || '').trim();
    if (!tokenRes.ok || !accessToken) {
      return res.redirect(
        buildFrontendAuthRedirect(req, {
          oauth_error: 'Unable to complete Google sign-in',
        })
      );
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const profile: any = await profileRes.json().catch(() => ({}));
    const email = String(profile?.email || '').trim().toLowerCase();
    const displayName = String(profile?.name || email.split('@')[0] || 'User').trim();
    const emailVerified = Boolean(profile?.verified_email);

    if (!email || !emailVerified) {
      return res.redirect(
        buildFrontendAuthRedirect(req, {
          oauth_error: 'Google account email is missing or not verified',
        })
      );
    }

    let user = await getUserByEmail(email);
    let referralAttached = false;

    if (!user) {
      const generatedPassword = randomBytes(24).toString('hex');
      user = await createUser({
        email,
        password: generatedPassword,
        name: displayName,
      });

      const referralCode = normalizeReferralCodeInput(String(state.ref || ''));
      if (state.mode === 'signup' && referralCode) {
        const referralValidation = await validateReferralCode(referralCode);
        if (referralValidation.valid) {
          const attachResult = await attachReferralAtSignup({
            referredUserId: user.id,
            referredEmail: user.email,
            referralCode,
          });
          referralAttached = attachResult.attached;
        }
      }
    }

    if (!user.is_verified) {
      try {
        await issueOAuthVerification(user.id, user.email);
      } catch (sendErr: any) {
        return res.redirect(
          buildFrontendAuthRedirect(req, {
            oauth_error: publicOAuthErrorMessage(sendErr, 'Could not send verification email. Please try again.'),
            redirect: state.redirect || '/',
          })
        );
      }

      const pendingRedirect = buildFrontendAuthRedirect(req, {
        oauth_pending_verification: '1',
        oauth_email: user.email,
        verification_expires_minutes: '30',
        referral_attached: referralAttached ? '1' : '0',
        redirect: state.redirect || '/',
      });
      return res.redirect(pendingRedirect);
    }

    const token = signUserToken({ userId: user.id, tier: user.tier || 'observer' });
    const safeUser = pickSafeOAuthUser(user);

    return res.redirect(
      buildFrontendAuthRedirect(req, {
        oauth_success: '1',
        oauth_token: token,
        oauth_user: Buffer.from(JSON.stringify(safeUser), 'utf8').toString('base64url'),
        referral_attached: referralAttached ? '1' : '0',
        redirect: state.redirect || '/',
      })
    );
  } catch (err: any) {
    return res.redirect(
      buildFrontendAuthRedirect(req, {
        oauth_error: publicOAuthErrorMessage(err, 'Google OAuth failed'),
      })
    );
  }
});

router.get('/github', async (req, res) => {
  const clientId = String(process.env.GITHUB_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GITHUB_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return res.redirect(
      buildFrontendAuthRedirect(req, {
        oauth_error: 'GitHub OAuth is not configured on server',
      })
    );
  }

  const mode = String(req.query.mode || 'signin') === 'signup' ? 'signup' : 'signin';
  const redirect = String(req.query.redirect || '').trim();
  const ref = normalizeReferralCodeInput(String(req.query.ref || ''));
  const state = encodeOAuthState({
    mode,
    ref: ref || undefined,
    redirect: redirect || undefined,
    nonce: randomBytes(12).toString('hex'),
    ts: Date.now(),
  });

  const callbackUrl = `${getApiBase(req)}/api/auth/github/callback`;
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);
  return res.redirect(url.toString());
});

router.get('/github/connect', authRequired, async (req, res) => {
  const clientId = String(process.env.GITHUB_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GITHUB_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    const fallback = new URL('/app', getFrontendBase(req));
    fallback.searchParams.set('oauth_error', 'GitHub OAuth is not configured on server');
    return res.redirect(fallback.toString());
  }

  const userId = String((req as any).user?.id || '').trim();
  if (!userId) {
    const fallback = new URL('/app', getFrontendBase(req));
    fallback.searchParams.set('oauth_error', 'You must be signed in to connect GitHub');
    return res.redirect(fallback.toString());
  }

  const redirect = String(req.query.redirect || '/app').trim() || '/app';
  const state = encodeOAuthState({
    mode: 'connect_github',
    redirect,
    userId,
    nonce: randomBytes(12).toString('hex'),
    ts: Date.now(),
  });

  const callbackUrl = `${getApiBase(req)}/api/auth/github/callback`;
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('scope', 'repo read:user user:email');
  url.searchParams.set('state', state);
  if (wantsJson(req)) {
    return res.json({ success: true, authorization_url: url.toString() });
  }
  return res.redirect(url.toString());
});

router.get('/github/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const stateRaw = String(req.query.state || '').trim();
    const state = decodeOAuthState(stateRaw);

    if (!code || !state) {
      return res.redirect(
        buildFrontendAuthRedirect(req, {
          oauth_error: 'GitHub OAuth callback is invalid or expired',
        })
      );
    }

    const clientId = String(process.env.GITHUB_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GITHUB_CLIENT_SECRET || '').trim();
    const callbackUrl = `${getApiBase(req)}/api/auth/github/callback`;

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    const accessToken = String(tokenJson?.access_token || '').trim();
    if (!tokenRes.ok || !accessToken) {
      if (state.mode === 'connect_github') {
        const fallback = new URL(state.redirect || '/app', getFrontendBase(req));
        fallback.searchParams.set('oauth_error', 'Unable to complete GitHub connection');
        return res.redirect(fallback.toString());
      }
      return res.redirect(
        buildFrontendAuthRedirect(req, {
          oauth_error: 'Unable to complete GitHub sign-in',
        })
      );
    }

    if (state.mode === 'connect_github') {
      if (!state.userId) {
        const fallback = new URL(state.redirect || '/app', getFrontendBase(req));
        fallback.searchParams.set('oauth_error', 'GitHub connection state is invalid');
        return res.redirect(fallback.toString());
      }

      await saveVcsToken(state.userId, 'github', accessToken);

      const connected = new URL(state.redirect || '/app', getFrontendBase(req));
      connected.searchParams.set('github_connected', '1');
      return res.redirect(connected.toString());
    }

    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AiVIS-Auth',
      },
    });
    const profile: any = await profileRes.json().catch(() => ({}));

    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AiVIS-Auth',
      },
    });
    const emailsPayload: any[] = await emailsRes.json().catch(() => []);
    const primaryEmail = emailsPayload.find((item) => item?.primary && item?.verified)
      || emailsPayload.find((item) => item?.verified)
      || null;

    const email = String(primaryEmail?.email || profile?.email || '').trim().toLowerCase();
    const displayName = String(profile?.name || profile?.login || email.split('@')[0] || 'User').trim();

    if (!email) {
      return res.redirect(
        buildFrontendAuthRedirect(req, {
          oauth_error: 'GitHub account email is missing or not verified',
        })
      );
    }

    let user = await getUserByEmail(email);
    let referralAttached = false;

    if (!user) {
      const generatedPassword = randomBytes(24).toString('hex');
      user = await createUser({
        email,
        password: generatedPassword,
        name: displayName,
      });

      const referralCode = normalizeReferralCodeInput(String(state.ref || ''));
      if (state.mode === 'signup' && referralCode) {
        const referralValidation = await validateReferralCode(referralCode);
        if (referralValidation.valid) {
          const attachResult = await attachReferralAtSignup({
            referredUserId: user.id,
            referredEmail: user.email,
            referralCode,
          });
          referralAttached = attachResult.attached;
        }
      }
    }

    if (!user.is_verified) {
      try {
        await issueOAuthVerification(user.id, user.email);
      } catch (sendErr: any) {
        return res.redirect(
          buildFrontendAuthRedirect(req, {
            oauth_error: publicOAuthErrorMessage(sendErr, 'Could not send verification email. Please try again.'),
            redirect: state.redirect || '/',
          })
        );
      }

      const pendingRedirect = buildFrontendAuthRedirect(req, {
        oauth_pending_verification: '1',
        oauth_email: user.email,
        verification_expires_minutes: '30',
        referral_attached: referralAttached ? '1' : '0',
        redirect: state.redirect || '/',
      });
      return res.redirect(pendingRedirect);
    }

    const token = signUserToken({ userId: user.id, tier: user.tier || 'observer' });
    const safeUser = pickSafeOAuthUser(user);

    return res.redirect(
      buildFrontendAuthRedirect(req, {
        oauth_success: '1',
        oauth_token: token,
        oauth_user: Buffer.from(JSON.stringify(safeUser), 'utf8').toString('base64url'),
        referral_attached: referralAttached ? '1' : '0',
        redirect: state.redirect || '/',
      })
    );
  } catch (err: any) {
    return res.redirect(
      buildFrontendAuthRedirect(req, {
        oauth_error: publicOAuthErrorMessage(err, 'GitHub OAuth failed'),
      })
    );
  }
});

// REGISTRATION - Creates user but DOES NOT give token until email verified
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('captchaToken').optional().isString().withMessage('Invalid captcha token'),
    body('referralCode').optional().isString().isLength({ min: 6, max: 24 }).withMessage('Invalid referral code format'),
    body('termsAccepted').custom((value) => value === true).withMessage('Terms acceptance is required'),
    body('privacyAccepted').custom((value) => value === true).withMessage('Privacy acceptance is required'),
    body('marketingOptIn').optional().isBoolean(),
    body('policyVersion').optional().isString().isLength({ min: 6, max: 40 }),
    body('consentSource').optional().isString().isLength({ min: 2, max: 40 }),
  ],
  register
);

// Alias for backward compatibility
router.post(
  '/signup',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').optional(),
    body('captchaToken').optional().isString().withMessage('Invalid captcha token'),
    body('referralCode').optional().isString().isLength({ min: 6, max: 24 }).withMessage('Invalid referral code format'),
    body('termsAccepted').custom((value) => value === true).withMessage('Terms acceptance is required'),
    body('privacyAccepted').custom((value) => value === true).withMessage('Privacy acceptance is required'),
    body('marketingOptIn').optional().isBoolean(),
    body('policyVersion').optional().isString().isLength({ min: 6, max: 40 }),
    body('consentSource').optional().isString().isLength({ min: 2, max: 40 }),
  ],
  register
);

// LOGIN - REQUIRES verified email to succeed
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('captchaToken').optional().isString().withMessage('Invalid captcha token')
  ],
  login
);

// Alias for backward compatibility
router.post('/signin', login);

// EMAIL VERIFICATION - Activates account and returns token
router.get('/verify-email', verifyEmail);

// RESEND VERIFICATION EMAIL
router.post(
  '/resend-verification',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('captchaToken').optional().isString().withMessage('Invalid captcha token')
  ],
  resendVerification
);

// GET CURRENT USER - Requires authentication
router.get('/me', authRequired, getMe);
router.get('/profile', authRequired, getMe);
router.put('/profile', authRequired, updateProfile);

// CHANGE PASSWORD (authenticated)
router.put('/change-password', authRequired, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const pool = (await import('../services/postgresql.js')).getPool();
    const userRow = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!userRow.rows[0]?.password_hash) {
      return res.status(400).json({ error: 'Password login not available for this account' });
    }
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(currentPassword, userRow.rows[0].password_hash);
    if (!valid) {
      return res.status(403).json({ error: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err: any) {
    console.error('[Auth] Change password failed:', err?.message);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/referral/me', authRequired, getReferralSummary);
router.get('/referral/validate', validateReferral);
router.post('/referral/validate', validateReferral);

// PASSWORD RESET
router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('captchaToken').optional().isString().withMessage('Invalid captcha token'),
  ],
  forgotPassword
);
// Alias used by AuthPage.tsx and authService.ts
router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('captchaToken').optional().isString().withMessage('Invalid captcha token'),
  ],
  forgotPassword
);
router.post(
  '/reset-password/confirm',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  confirmResetPassword
);

// ── GDPR: Data export ────────────────────────────────────────────────────────
router.get('/data-export', authRequired, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const pool = getPool();

    const [userRow, audits, competitors, citations, usage, sessions, apiKeys, webhooks, rescans, branding] = await Promise.all([
      pool.query('SELECT id, email, name, tier, created_at, email_verified FROM users WHERE id = $1', [userId]),
      pool.query('SELECT id, url, visibility_score, created_at FROM audits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500', [userId]),
      pool.query('SELECT id, competitor_url, latest_score, created_at FROM competitor_tracking WHERE user_id = $1', [userId]),
      pool.query('SELECT id, url, created_at FROM citation_tests WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM usage_daily WHERE user_id = $1 ORDER BY date DESC LIMIT 365', [userId]),
      pool.query('SELECT id, created_at, last_active_at FROM user_sessions WHERE user_id = $1', [userId]),
      pool.query('SELECT id, key_prefix, name, scopes, created_at, last_used_at, enabled FROM api_keys WHERE user_id = $1', [userId]),
      pool.query('SELECT id, url, events, enabled, created_at FROM webhooks WHERE user_id = $1', [userId]),
      pool.query('SELECT id, url, frequency, enabled, created_at FROM scheduled_rescans WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM user_branding WHERE user_id = $1', [userId]),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: userRow.rows[0] || null,
      audits: audits.rows,
      competitors: competitors.rows,
      citations: citations.rows,
      usage: usage.rows,
      sessions: sessions.rows,
      api_keys: apiKeys.rows,
      webhooks: webhooks.rows,
      scheduled_rescans: rescans.rows,
      branding: branding.rows[0] || null,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=aivis-data-export-${new Date().toISOString().split('T')[0]}.json`);
    // SOC1: log data export event
    try {
      const { logAccountEvent } = await import('../services/securityAuditService.js');
      await logAccountEvent(userId, req.user?.email || '', 'account.data_exported', req.ip || undefined);
    } catch { /* audit log is non-critical */ }
    return res.json(exportData);
  } catch (err: any) {
    console.error('GDPR data export failed:', err.message);
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

// ── GDPR: Account + data deletion ───────────────────────────────────────────
router.delete('/account', authRequired, async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  // SOC1: log account deletion event before deletion (non-critical)
  try {
    const { logAccountEvent } = await import('../services/securityAuditService.js');
    await logAccountEvent(userId, req.user?.email || '', 'account.deleted', req.ip || undefined);
  } catch { /* audit log is non-critical */ }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Phase 1: RESTRICT tables - must clear before user row ─────────────
    await client.query('DELETE FROM scheduled_platform_notifications WHERE created_by_user_id = $1', [userId]);

    // ── Phase 2: Tables with bare user_id (no FK constraint) ──────────────
    await client.query('DELETE FROM trial_email_log WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM rate_limit_events WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM verification_runs WHERE user_id = $1', [userId]);
    // github_app_installations uses VARCHAR user_id - no FK cascade
    await client.query('DELETE FROM github_app_installations WHERE user_id = $1', [userId]);

    // ── Phase 3: Audit chain - audits uses ON DELETE SET NULL, so child rows orphan ──
    // Clean audit-linked tables that would survive due to SET NULL on audits.user_id
    const auditIds = `SELECT id FROM audits WHERE user_id = $1`;
    await client.query(`DELETE FROM brag_trail WHERE audit_run_id IN (${auditIds})`, [userId]);
    await client.query(`DELETE FROM fixpack_assets WHERE fixpack_id IN (SELECT id FROM fixpacks WHERE user_id = $1)`, [userId]);
    await client.query(`DELETE FROM fixpacks WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM audit_fixpacks WHERE audit_id IN (${auditIds})`, [userId]);
    await client.query(`DELETE FROM audit_rule_results WHERE audit_id IN (${auditIds})`, [userId]);
    await client.query(`DELETE FROM audit_evidence WHERE audit_id IN (${auditIds})`, [userId]);
    await client.query(`DELETE FROM audits WHERE user_id = $1`, [userId]);

    // ── Phase 3b: SET NULL tables that orphan user data ───────────────────
    // citation_niche_rankings uses ON DELETE SET NULL - must explicitly delete
    await client.query('DELETE FROM citation_niche_rankings WHERE user_id = $1', [userId]);
    // security_audit_log uses ON DELETE SET NULL - scrub actor identity but keep audit trail
    await client.query(`UPDATE security_audit_log SET actor_email = NULL, details = details - 'email' WHERE actor_id = $1`, [userId]);

    // ── Phase 4: License chain (no user FK) ───────────────────────────────
    await client.query(`DELETE FROM license_verifications WHERE license_id IN (SELECT id FROM licenses WHERE email = (SELECT email FROM users WHERE id = $1))`, [userId]);
    await client.query(`DELETE FROM license_activations WHERE license_id IN (SELECT id FROM licenses WHERE email = (SELECT email FROM users WHERE id = $1))`, [userId]);
    await client.query(`DELETE FROM licenses WHERE email = (SELECT email FROM users WHERE id = $1)`, [userId]);

    // ── Phase 5: Delete user row - ON DELETE CASCADE handles remaining 60+ tables ──
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
    return res.json({ ok: true, message: 'Account and all associated data permanently deleted' });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('GDPR account deletion failed:', err.message);
    return res.status(500).json({ error: 'Failed to delete account. Please try again or contact support.' });
  } finally {
    client.release();
  }
});

export default router;
