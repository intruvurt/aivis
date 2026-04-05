// authControllerFixed.ts - COMPLETE AUTH WITH EMAIL VERIFICATION
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  createUser,
  getUserByEmail,
  getUserByVerificationToken,
  verifyUserEmail,
  resendVerificationEmail,
  updateUserById,
  comparePassword,
  resetLoginAttempts,
  incrementLoginAttempts,
  setPasswordResetToken,
  resetPasswordWithToken,
  User,
} from '../models/User.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { sendWelcomeOnboardingEmail } from '../services/emailService.js';
import { signUserToken } from '../lib/utils/jwt.js';
import {
  attachReferralAtSignup,
  getReferralAttributionForUser,
  getReferralProgramSummary,
  settleReferralCreditsIfEligible,
  normalizeReferralCodeInput,
  validateReferralCode,
} from '../services/referralCredits.js';
import { getPool } from '../services/postgresql.js';
import { isGoogleMeasurementConfigured, sendMeasurementEvent } from '../services/googleMeasurement.js';
import { enrichOrgProfileFromWebsite } from '../services/profileEnrichmentService.js';
import { ensureDefaultWorkspaceForUser } from '../services/tenantService.js';
import { isRecaptchaEnforced, verifyRecaptchaToken } from '../services/recaptchaService.js';
import { enforceEffectiveTier, getAllowlistedElevatedEmails } from '../services/entitlementGuard.js';
import { discoverCompetitorsFromHistory } from './competitors.controllers.js';
import { meetsMinimumTier, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';
import { profileUpdateSchema, sanitizeHtmlServer } from '../middleware/securityMiddleware.js';

const MAX_PROFILE_IMAGE_BYTES = 400 * 1024;

function normalizeUploadedImageDataUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(trimmed);
  if (!match) {
    throw new Error('Uploaded image must be a PNG, JPG, or WebP file');
  }

  const mimeSubtype = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  const base64Payload = match[2];
  const byteLength = Buffer.from(base64Payload, 'base64').length;

  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    throw new Error('Uploaded image is invalid');
  }

  if (byteLength > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error('Uploaded image must be 400KB or smaller');
  }

  return `data:image/${mimeSubtype};base64,${base64Payload}`;
}

const pickSafeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  is_verified: user.is_verified,
  tier: user.tier,
  trial_ends_at: (user as any).trial_ends_at || null,
  trial_active: Boolean((user as any).trial_ends_at && new Date((user as any).trial_ends_at) > new Date()),
  trial_used: Boolean((user as any).trial_used),
  created_at: user.created_at,
  company: user.company || null,
  website: user.website || null,
  bio: user.bio || null,
  avatar_url: user.avatar_url || null,
  timezone: user.timezone || null,
  language: user.language || null,
  org_description: user.org_description || null,
  org_logo_url: user.org_logo_url || null,
  org_favicon_url: user.org_favicon_url || null,
  org_phone: user.org_phone || null,
  org_address: user.org_address || null,
  org_verified: user.org_verified === true,
  org_verification_confidence: typeof user.org_verification_confidence === 'number'
    ? user.org_verification_confidence
    : null,
  org_verification_reasons: Array.isArray(user.org_verification_reasons)
    ? user.org_verification_reasons
    : null,
});

function emailDomainFromAddress(email: string): string {
  const lower = String(email || '').trim().toLowerCase();
  const parts = lower.split('@');
  return parts.length === 2 ? parts[1] : '';
}

type NotificationPreferences = {
  emailNotifications: boolean;
  shareLinkExpirationDays: number;
};

function normalizeShareLinkExpirationDays(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (numeric === 0 || numeric === 7 || numeric === 14 || numeric === 30 || numeric === 90) return numeric;
  return 30;
}

async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const pool = getPool();
  const pref = await pool.query(
    `SELECT email_notifications, share_link_expiration_days FROM user_notification_preferences WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (!pref.rows[0]) {
    return {
      emailNotifications: true,
      shareLinkExpirationDays: 30,
    };
  }
  return {
    emailNotifications: pref.rows[0].email_notifications !== false,
    shareLinkExpirationDays: normalizeShareLinkExpirationDays(pref.rows[0].share_link_expiration_days),
  };
}

async function upsertNotificationPreferences(
  userId: string,
  updates: { emailNotifications?: boolean; shareLinkExpirationDays?: number }
): Promise<void> {
  const current = await getNotificationPreferences(userId);
  const emailNotifications = typeof updates.emailNotifications === 'boolean'
    ? updates.emailNotifications
    : current.emailNotifications;
  const shareLinkExpirationDays = updates.shareLinkExpirationDays !== undefined
    ? normalizeShareLinkExpirationDays(updates.shareLinkExpirationDays)
    : current.shareLinkExpirationDays;

  const pool = getPool();
  await pool.query(
    `INSERT INTO user_notification_preferences (user_id, email_notifications, share_link_expiration_days, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       email_notifications = EXCLUDED.email_notifications,
       share_link_expiration_days = EXCLUDED.share_link_expiration_days,
       updated_at = NOW()`,
    [userId, emailNotifications, shareLinkExpirationDays]
  );
}

/**
 * REGISTER - Create new user with email verification
 */
export const register = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400,
      });
    }

    const {
      name,
      email,
      password,
      captchaToken,
      referralCode: rawReferralCode,
      termsAccepted,
      privacyAccepted,
      marketingOptIn,
      policyVersion,
      consentSource,
    } = req.body;
    const termsAcceptedBool = termsAccepted === true;
    const privacyAcceptedBool = privacyAccepted === true;
    const marketingOptInBool = marketingOptIn === undefined ? true : marketingOptIn === true;

    if (!termsAcceptedBool || !privacyAcceptedBool) {
      return res.status(400).json({
        success: false,
        error: 'You must accept Terms and Privacy Policy to create an account.',
        statusCode: 400,
        code: 'CONSENT_REQUIRED',
      });
    }

    if (isRecaptchaEnforced()) {
      const captcha = await verifyRecaptchaToken(String(captchaToken || ''), req.ip);
      if (!captcha.ok) {
        return res.status(400).json({
          success: false,
          error: 'Captcha verification failed',
          statusCode: 400,
          code: 'CAPTCHA_FAILED',
          details: captcha.message,
        });
      }
    }

    const referralCode = normalizeReferralCodeInput(String(rawReferralCode || ''));

    if (referralCode) {
      const referralValidation = await validateReferralCode(referralCode);
      if (!referralValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid referral code',
          statusCode: 400,
          code: 'INVALID_REFERRAL_CODE',
        });
      }
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email',
        statusCode: 400,
      });
    }

    // Create user (auto-generates verification token)
    const user = await createUser({
      email,
      password,
      name,
    });

    let referralAttached = false;
    if (referralCode) {
      const attachResult = await attachReferralAtSignup({
        referredUserId: user.id,
        referredEmail: user.email,
        referralCode,
      });
      referralAttached = attachResult.attached;
    }

    const workspaceCtx = await ensureDefaultWorkspaceForUser(user.id, user.name || user.email);
    const pool = getPool();
    const consentPolicyVersion = String(policyVersion || '2026-03-12').trim().slice(0, 40);
    const consentSourceValue = String(consentSource || 'web').trim().slice(0, 20) || 'web';
    const consentMetadata = {
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] || ''),
      route: '/api/auth/signup',
      capturedAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO user_consents (user_id, workspace_id, consent_type, status, policy_version, source, metadata)
       VALUES ($1, $2, 'terms', 'accepted', $3, $4, $5)
       ON CONFLICT (user_id, workspace_id, consent_type)
       DO UPDATE SET status = EXCLUDED.status, policy_version = EXCLUDED.policy_version, source = EXCLUDED.source, metadata = EXCLUDED.metadata, updated_at = NOW()`,
      [user.id, workspaceCtx.workspaceId, consentPolicyVersion, consentSourceValue, JSON.stringify(consentMetadata)]
    );
    await pool.query(
      `INSERT INTO user_consents (user_id, workspace_id, consent_type, status, policy_version, source, metadata)
       VALUES ($1, $2, 'privacy', 'accepted', $3, $4, $5)
       ON CONFLICT (user_id, workspace_id, consent_type)
       DO UPDATE SET status = EXCLUDED.status, policy_version = EXCLUDED.policy_version, source = EXCLUDED.source, metadata = EXCLUDED.metadata, updated_at = NOW()`,
      [user.id, workspaceCtx.workspaceId, consentPolicyVersion, consentSourceValue, JSON.stringify(consentMetadata)]
    );
    await pool.query(
      `INSERT INTO user_consents (user_id, workspace_id, consent_type, status, policy_version, source, metadata)
       VALUES ($1, $2, 'marketing', $3, $4, $5, $6)
       ON CONFLICT (user_id, workspace_id, consent_type)
       DO UPDATE SET status = EXCLUDED.status, policy_version = EXCLUDED.policy_version, source = EXCLUDED.source, metadata = EXCLUDED.metadata, updated_at = NOW()`,
      [
        user.id,
        workspaceCtx.workspaceId,
        marketingOptInBool ? 'accepted' : 'declined',
        consentPolicyVersion,
        consentSourceValue,
        JSON.stringify(consentMetadata),
      ]
    );

    await upsertNotificationPreferences(user.id, { emailNotifications: marketingOptInBool });

    // Send verification email - await so we can tell the user if it failed
    let emailSent = false;
    if (user.verification_token) {
      try {
        await sendVerificationEmail(email, user.verification_token);
        emailSent = true;
      } catch (err: any) {
        console.error('[Register] Email send failed:', err?.message);
      }
    }

    // DO NOT return token yet - user must verify email first
    if (isGoogleMeasurementConfigured()) {
      sendMeasurementEvent({
        eventName: 'sign_up',
        clientId: `${user.id}.${Date.now()}`,
        userId: user.id,
        params: {
          source: 'register',
          referral_attached: referralAttached,
          email_domain: emailDomainFromAddress(user.email),
        },
      }).catch((err: any) => {
        console.warn('[Register] GA4 sign_up tracking failed:', err?.message || err);
      });
    }

    return res.status(201).json({
      success: true,
      message: emailSent
        ? 'Registration successful! Please check your email to verify your account.'
        : 'Registration successful! We could not send the verification email - please use "Resend verification" on the login page.',
      data: {
        user: pickSafeUser(user),
        requiresVerification: true,
        emailSent,
        referralAttached,
        consents: {
          terms: termsAcceptedBool,
          privacy: privacyAcceptedBool,
          marketing: marketingOptInBool,
          workspace_id: workspaceCtx.workspaceId,
        },
      },
    });
  } catch (error: any) {
    // Postgres unique_violation (23505) - race condition where two concurrent
    // signups pass the getUserByEmail check before either INSERT completes.
    if (error?.code === '23505' && error?.constraint?.includes('email')) {
      return res.status(409).json({
        success: false,
        error: 'User already exists with this email',
        statusCode: 409,
      });
    }
    console.error('[Register Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error during registration',
      statusCode: 500,
    });
  }
};

/**
 * LOGIN - Requires verified email
 */
export const login = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400,
      });
    }

    const { email, password, captchaToken } = req.body;

    if (isRecaptchaEnforced()) {
      const captcha = await verifyRecaptchaToken(String(captchaToken || ''), req.ip);
      if (!captcha.ok) {
        return res.status(400).json({
          success: false,
          error: 'Captcha verification failed',
          statusCode: 400,
          code: 'CAPTCHA_FAILED',
          details: captcha.message,
        });
      }
    }

    // Get user
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        statusCode: 401,
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Account temporarily locked due to too many failed login attempts. Try again later.',
        statusCode: 403,
        code: 'ACCOUNT_LOCKED',
      });
    }

    // Verify password
    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        statusCode: 401,
      });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      await incrementLoginAttempts(email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        statusCode: 401,
      });
    }

    // CRITICAL: Check if email is verified
    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true,
        userEmail: email,
      });
    }

    // Reset login attempts on successful login
    await resetLoginAttempts(email);

    const effectiveTier = await enforceEffectiveTier(user);

    // Elevate role for allowlisted emails
    const allowlisted = getAllowlistedElevatedEmails();
    const effectiveRole = allowlisted.has(String(user.email || '').trim().toLowerCase()) ? 'admin' : (user.role || 'user');

    const safeUser = pickSafeUser({ ...user, tier: effectiveTier, role: effectiveRole as any });

    // Generate token with userId + tier (matches jwt.ts contract)
    const token = signUserToken({ userId: user.id, tier: effectiveTier || 'observer' });

    return res.json({
      success: true,
      data: {
        token,
        user: safeUser,
      },
    });
  } catch (error: any) {
    console.error('[Login Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error during login',
      statusCode: 500,
    });
  }
};

/**
 * VERIFY EMAIL - Activates account
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
        statusCode: 400,
      });
    }

    // Verify the token and activate user
    const user = await verifyUserEmail(token);

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
        statusCode: 400,
      });
    }

    const referralGrant = await settleReferralCreditsIfEligible(user.id).catch((err: any) => {
      console.error('[VerifyEmail] Referral grant failed (non-blocking):', err?.message || err);
      return { granted: false, reason: 'grant_failed' };
    });

    const effectiveTier = await enforceEffectiveTier(user);

    // Elevate role for allowlisted emails
    const verifyAllowlisted = getAllowlistedElevatedEmails();
    const verifyEffectiveRole = verifyAllowlisted.has(String(user.email || '').trim().toLowerCase()) ? 'admin' : (user.role || 'user');

    const safeUser = pickSafeUser({ ...user, tier: effectiveTier, role: verifyEffectiveRole as any });

    // Generate auth token now that email is verified
    const authToken = signUserToken({ userId: user.id, tier: effectiveTier || 'observer' });

    // Fire-and-forget: send welcome onboarding email (don't block verification response)
    sendWelcomeOnboardingEmail(user.email, user.name || '').catch((err) => {
      console.error('[VerifyEmail] Welcome email failed (non-blocking):', err?.message);
    });

    if (isGoogleMeasurementConfigured()) {
      sendMeasurementEvent({
        eventName: 'email_verified',
        clientId: `${user.id}.${Date.now()}`,
        userId: user.id,
        params: {
          source: 'verify_email',
          tier: String(user.tier || 'observer'),
        },
      }).catch((err: any) => {
        console.warn('[VerifyEmail] GA4 email_verified tracking failed:', err?.message || err);
      });
    }

    return res.json({
      success: true,
      message: 'Email verified successfully! You can now use the analyzer.',
      data: {
        token: authToken,
        user: safeUser,
        referral_reward: referralGrant,
      },
    });
  } catch (error: any) {
    console.error('[Verify Email Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error during email verification',
      statusCode: 500,
    });
  }
};

/**
 * RESEND VERIFICATION EMAIL
 */
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email, captchaToken } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        statusCode: 400,
      });
    }

    if (isRecaptchaEnforced()) {
      const captcha = await verifyRecaptchaToken(String(captchaToken || ''), req.ip);
      if (!captcha.ok) {
        return res.status(400).json({
          success: false,
          error: 'Captcha verification failed',
          statusCode: 400,
          code: 'CAPTCHA_FAILED',
          details: captcha.message,
        });
      }
    }

    const result = await resendVerificationEmail(email);

    if (!result) {
      return res.status(400).json({
        success: false,
        error: 'User not found or already verified',
        statusCode: 400,
      });
    }

    // Send new verification email
    await sendVerificationEmail(email, result.token);

    return res.json({
      success: true,
      message: 'Verification email resent. Please check your inbox.',
    });
  } catch (error: any) {
    console.error('[Resend Verification Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error',
      statusCode: 500,
    });
  }
};

/**
 * GET ME - Get current user info
 */
export const getMe = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        statusCode: 401,
      });
    }

    const prefs = await getNotificationPreferences((req.user as User).id);

    return res.json({
      success: true,
      data: {
        ...pickSafeUser(req.user as User),
        email_notifications: prefs.emailNotifications,
        share_link_expiration_days: prefs.shareLinkExpirationDays,
      },
    });
  } catch (error: any) {
    console.error('[Get Me Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error',
      statusCode: 500,
    });
  }
};

/**
 * UPDATE PROFILE - Persist editable profile fields
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        statusCode: 401,
      });
    }

    // Zod shape validation
    const zParsed = profileUpdateSchema.safeParse(req.body);
    if (!zParsed.success) {
      return res.status(400).json({
        success: false,
        error: zParsed.error.issues[0]?.message || 'Invalid profile data',
        statusCode: 400,
        details: zParsed.error.issues,
      });
    }

    const requestedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!requestedName) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
        statusCode: 400,
      });
    }

    if (requestedName.length > 120) {
      return res.status(400).json({
        success: false,
        error: 'Name must be 120 characters or less',
        statusCode: 400,
      });
    }

    const requestedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    const currentEmail = String((req.user as User).email || '').trim().toLowerCase();
    if (requestedEmail && requestedEmail !== currentEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email updates are not supported from this endpoint',
        statusCode: 400,
      });
    }

    const textOrNull = (value: unknown, maxLen: number): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      return trimmed.slice(0, maxLen);
    };

    const requestedCompany = textOrNull(req.body?.company, 255);
    const requestedWebsite = textOrNull(req.body?.website, 2048);
    const rawBio = textOrNull(req.body?.bio, 5000);
    const requestedBio = rawBio ? sanitizeHtmlServer(rawBio) : null;
    const clearAvatar = req.body?.clear_avatar === true;
    const clearOrgLogo = req.body?.clear_org_logo === true;
    const rawAvatar = textOrNull(req.body?.avatar_url, 2048) || textOrNull(req.body?.avatarUrl, 2048);
    const uploadedAvatar = normalizeUploadedImageDataUrl(req.body?.avatar_data_url);
    const requestedAvatar = uploadedAvatar || (rawAvatar && /^https:\/\/.+/i.test(rawAvatar) ? rawAvatar : null);
    const rawOrgLogo = textOrNull(req.body?.org_logo_url, 2048) || textOrNull(req.body?.orgLogoUrl, 2048);
    const uploadedOrgLogo = normalizeUploadedImageDataUrl(req.body?.org_logo_data_url);
    const requestedOrgLogo = uploadedOrgLogo || (rawOrgLogo && /^https:\/\/.+/i.test(rawOrgLogo) ? rawOrgLogo : null);
    const requestedTimezone = textOrNull(req.body?.timezone, 80);
    const requestedLanguage = textOrNull(req.body?.language, 32);

    const hasEmailNotificationsInput = typeof req.body?.email_notifications === 'boolean';
    const requestedEmailNotifications = hasEmailNotificationsInput
      ? Boolean(req.body.email_notifications)
      : null;

    const hasShareLinkExpirationInput = typeof req.body?.share_link_expiration_days === 'number';
    const requestedShareLinkExpirationDays = hasShareLinkExpirationInput
      ? normalizeShareLinkExpirationDays(req.body.share_link_expiration_days)
      : null;

    const shouldAutoEnrich = req.body?.auto_enrich !== false;
    const enrichment = shouldAutoEnrich && requestedWebsite
      ? await enrichOrgProfileFromWebsite({
          website: requestedWebsite,
          claimedEntityName: requestedCompany || requestedName || null,
        })
      : null;

    const existingUser = req.user as User;

    const resolvedCompany = requestedCompany || existingUser.company || null;
    const resolvedWebsite = (enrichment?.website || requestedWebsite || existingUser.website || null);
    const resolvedBio = requestedBio || existingUser.bio || enrichment?.org_description || null;
    const resolvedAvatar = clearAvatar
      ? null
      : (requestedAvatar || existingUser.avatar_url || null);
    const resolvedOrgLogo = clearOrgLogo
      ? null
      : (requestedOrgLogo || enrichment?.org_logo_url || existingUser.org_logo_url || null);

    const updates: Partial<User> = {
      name: requestedName,
      company: resolvedCompany || enrichment?.org_name || null,
      website: resolvedWebsite,
      bio: resolvedBio,
      avatar_url: resolvedAvatar,
      timezone: requestedTimezone || existingUser.timezone || null,
      language: requestedLanguage || existingUser.language || null,
      org_description: enrichment?.org_description || existingUser.org_description || null,
      org_logo_url: resolvedOrgLogo,
      org_favicon_url: enrichment?.org_favicon_url || existingUser.org_favicon_url || null,
      org_phone: enrichment?.org_phone || existingUser.org_phone || null,
      org_address: enrichment?.org_address || existingUser.org_address || null,
      org_verified: enrichment ? enrichment.verified : existingUser.org_verified,
      org_verification_confidence: enrichment
        ? enrichment.confidence_score
        : existingUser.org_verification_confidence || null,
      org_verification_reasons: enrichment
        ? enrichment.verification_reasons
        : existingUser.org_verification_reasons || null,
    };

    const updated = await updateUserById((req.user as User).id, updates);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        statusCode: 404,
      });
    }

    if (requestedEmailNotifications !== null || requestedShareLinkExpirationDays !== null) {
      await upsertNotificationPreferences((req.user as User).id, {
        emailNotifications: requestedEmailNotifications !== null ? requestedEmailNotifications : undefined,
        shareLinkExpirationDays: requestedShareLinkExpirationDays !== null ? requestedShareLinkExpirationDays : undefined,
      });
    }

    const prefs = await getNotificationPreferences((req.user as User).id);

    // Auto-discover competitors if website changed and user is alignment+ tier
    let competitorSuggestions: Awaited<ReturnType<typeof discoverCompetitorsFromHistory>> | null = null;
    const oldWebsite = String(existingUser.website || '').trim().toLowerCase();
    const newWebsite = String(resolvedWebsite || '').trim().toLowerCase();
    const websiteChanged = newWebsite && newWebsite !== oldWebsite;
    const userTier = ((updated.tier || 'observer') as CanonicalTier | LegacyTier);
    if (websiteChanged && meetsMinimumTier(userTier, 'alignment')) {
      try {
        competitorSuggestions = await discoverCompetitorsFromHistory(updated.id, resolvedWebsite!);
      } catch (discoverErr: any) {
        console.warn('[Profile] Auto-competitor discovery failed (non-fatal):', discoverErr?.message);
      }
    }

    return res.json({
      success: true,
      data: {
        ...pickSafeUser(updated),
        email_notifications: prefs.emailNotifications,
        share_link_expiration_days: prefs.shareLinkExpirationDays,
        enrichment: enrichment
          ? {
              verified: enrichment.verified,
              confidence_score: enrichment.confidence_score,
              verification_reasons: enrichment.verification_reasons,
              source_domain: enrichment.domain,
            }
          : null,
        competitor_suggestions: competitorSuggestions && competitorSuggestions.length > 0
          ? {
              suggestions: competitorSuggestions,
              total: competitorSuggestions.length,
              new_count: competitorSuggestions.filter(s => !s.already_tracked).length,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('[Update Profile Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error',
      statusCode: 500,
    });
  }
};

/**
 * GET REFERRAL SUMMARY - Get personal referral code and program stats
 */
export const getReferralSummary = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated', statusCode: 401 });
    }

    const [program, attribution] = await Promise.all([
      getReferralProgramSummary(userId),
      getReferralAttributionForUser(userId),
    ]);

    return res.json({
      success: true,
      data: {
        ...program,
        attribution,
      },
    });
  } catch (error: any) {
    console.error('[Get Referral Summary Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error',
      statusCode: 500,
    });
  }
};

/**
 * VALIDATE REFERRAL CODE - Public validation helper
 */
export const validateReferral = async (req: Request, res: Response) => {
  try {
    const code = normalizeReferralCodeInput(String(req.query.code || req.body?.code || ''));
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Referral code is required',
        statusCode: 400,
      });
    }

    const validated = await validateReferralCode(code);
    return res.json({
      success: true,
      data: {
        valid: validated.valid,
        code: validated.code || code,
      },
    });
  } catch (error: any) {
    console.error('[Validate Referral Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error',
      statusCode: 500,
    });
  }
};

/**
 * FORGOT PASSWORD - Send password-reset email
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email, captchaToken } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required', statusCode: 400 });
    }

    if (isRecaptchaEnforced()) {
      const captcha = await verifyRecaptchaToken(String(captchaToken || ''), req.ip);
      if (!captcha.ok) {
        return res.status(400).json({
          success: false,
          error: 'Captcha verification failed',
          statusCode: 400,
          code: 'CAPTCHA_FAILED',
          details: captcha.message,
        });
      }
    }

    const result = await setPasswordResetToken(email);

    // Always return success to avoid user-enumeration attacks
    if (result) {
      await sendPasswordResetEmail(email, result.token);
    }

    return res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error: any) {
    console.error('[Forgot Password Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error',
      statusCode: 500,
    });
  }
};

/**
 * RESET PASSWORD CONFIRM - Verify token & set new password
 */
export const confirmResetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
        statusCode: 400,
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
        statusCode: 400,
      });
    }

    const user = await resetPasswordWithToken(token, password);

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        statusCode: 400,
      });
    }

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error: any) {
    console.error('[Reset Password Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Server error',
      statusCode: 500,
    });
  }
};
