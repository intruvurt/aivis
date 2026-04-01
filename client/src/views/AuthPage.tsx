import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, Link, Navigate } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Shield,
  Zap,
  BarChart3,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";

type AuthMode = "signin" | "signup" | "reset";

/** Sanitise ?redirect= to prevent open-redirect attacks.
 *  Only allows relative paths starting with / (no protocol, no //).
 */
function safeRedirect(raw: string | null): string {
  const val = (raw || "/").trim();
  // Block absolute URLs, protocol-relative URLs, and data/javascript URIs
  if (/^[a-z][a-z0-9+.-]*:/i.test(val) || val.startsWith("//")) return "/";
  // Must start with /
  if (!val.startsWith("/")) return "/";
  return val;
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "bg-white/10" };
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (s <= 2) return { score: 2, label: "Fair", color: "bg-orange-500" };
  if (s <= 3) return { score: 3, label: "Good", color: "bg-yellow-500" };
  if (s <= 4) return { score: 4, label: "Strong", color: "bg-emerald-500" };
  return { score: 5, label: "Excellent", color: "bg-cyan-400" };
}

const TRUST_FEATURES = [
  { icon: Shield, text: "256-bit encrypted" },
  { icon: Zap, text: "AI-powered audits" },
  { icon: BarChart3, text: "Free tier included" },
] as const;

function unwrapPayload(raw: any) {
  // supports:
  // { success, data: { user, token, entitlements } }
  // { user, token, entitlements }
  // { data: {...} }
  return raw?.data ?? raw;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get("mode") as AuthMode) || "signup";

  // selectors (don’t destructure whole store)
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState(() => String(searchParams.get("ref") || "").trim().toUpperCase());
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showResend, setShowResend] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);

  const pwStrength = useMemo(() => getPasswordStrength(password), [password]);

  const getCaptchaToken = useCallback(async (action: string): Promise<string> => {
    try {
      const siteKey = String((window as any).__AIVIS_RECAPTCHA_SITE_KEY || "").trim();
      const grecaptchaApi = (window as any).grecaptcha;
      if (!siteKey || !grecaptchaApi || typeof grecaptchaApi.execute !== "function") {
        return "";
      }

      if (typeof grecaptchaApi.ready === "function") {
        await new Promise<void>((resolve) => grecaptchaApi.ready(resolve));
      }

      const token = await grecaptchaApi.execute(siteKey, { action });
      return String(token || "");
    } catch {
      return "";
    }
  }, []);

  const decodeBase64Url = (value: string): string => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4;
    const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
    return atob(padded);
  };

  const startGoogleOAuth = useCallback(() => {
    if (mode === "signup" && (!acceptedTerms || !acceptedPrivacy)) {
      setError("You must accept Terms of Service and Privacy Policy before creating an account.");
      return;
    }
    const params = new URLSearchParams();
    params.set("mode", mode === "signup" ? "signup" : "signin");
    if (referralCode.trim()) params.set("ref", referralCode.trim());
    const redirect = safeRedirect(searchParams.get("redirect"));
    params.set("redirect", redirect);
    window.location.href = `${API_URL}/api/auth/google?${params.toString()}`;
  }, [mode, referralCode, searchParams, acceptedTerms, acceptedPrivacy]);

    const startGithubOAuth = useCallback(() => {
      if (mode === "signup" && (!acceptedTerms || !acceptedPrivacy)) {
        setError("You must accept Terms of Service and Privacy Policy before creating an account.");
        return;
      }
      const params = new URLSearchParams();
      params.set("mode", mode === "signup" ? "signup" : "signin");
      if (referralCode.trim()) params.set("ref", referralCode.trim());
      const redirect = safeRedirect(searchParams.get("redirect"));
      params.set("redirect", redirect);
      window.location.href = `${API_URL}/api/auth/github?${params.toString()}`;
    }, [mode, referralCode, searchParams, acceptedTerms, acceptedPrivacy]);
  const globalFieldStyle: React.CSSProperties = {
    WebkitTextFillColor: '#ffffff',
    transition: 'background-color 9999s ease-in-out 0s',
  };
  const vividFieldClass = "field-vivid w-full border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-[#f97316]/45 focus:ring-1 focus:ring-[#0ea5e9]/40 transition-all";

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  React.useEffect(() => {
    const requestedMode = String(searchParams.get("mode") || "").trim();
    const normalizedMode: AuthMode =
      requestedMode === "signin" || requestedMode === "signup" || requestedMode === "reset"
        ? (requestedMode as AuthMode)
        : "signup";

    setMode((current) => (current === normalizedMode ? current : normalizedMode));
  }, [searchParams]);

  React.useEffect(() => {
    const ref = String(searchParams.get("ref") || "").trim().toUpperCase();
    if (!ref) return;
    setReferralCode(ref);
    setMode((current) => (current === "signup" ? current : "signup"));
  }, [searchParams]);

  React.useEffect(() => {
    const oauthError = String(searchParams.get("oauth_error") || "").trim();
    const oauthPending = String(searchParams.get("oauth_pending_verification") || "").trim() === "1";
    const oauthEmail = String(searchParams.get("oauth_email") || "").trim();
    const verifyWindow = String(searchParams.get("verification_expires_minutes") || "").trim();
    const oauthToken = String(searchParams.get("oauth_token") || "").trim();
    const oauthUserRaw = String(searchParams.get("oauth_user") || "").trim();
    const redirect = safeRedirect(searchParams.get("redirect"));

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (oauthPending) {
      if (oauthEmail) setEmail(oauthEmail);
      setMode("signin");
      setShowResend(true);
      setSuccess(
        `Verification email sent${verifyWindow ? ` (expires in ${verifyWindow} minutes)` : ""}. Please verify before signing in.`
      );
      window.history.replaceState({}, document.title, "/auth");
      return;
    }

    if (!oauthToken || !oauthUserRaw) return;

    try {
      const parsed = JSON.parse(decodeBase64Url(oauthUserRaw));
      const nextUser = {
        id: parsed.id,
        email: parsed.email,
        role: parsed.role,
        tier: parsed.tier || "observer",
        full_name: parsed.name,
        display_name: parsed.name,
        created_at: parsed.created_at,
      };
      login(nextUser, oauthToken);
      setSuccess("Successfully signed in");
      window.history.replaceState({}, document.title, "/auth");
      window.setTimeout(() => navigate(redirect), 250);
    } catch {
      setError("OAuth sign-in response was invalid. Please try again.");
    }
  }, [searchParams, login, navigate]);

  const handleResendVerification = useCallback(async () => {
    if (!email || resendCooldown > 0) return;
    setResendLoading(true);
    setError(null);

    try {
      const captchaToken = await getCaptchaToken("resend_verification");
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, captchaToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to resend verification email");

      setSuccess("Verification email resent! Please check your inbox (and spam folder).");
      setResendCooldown(60);
    } catch (err: any) {
      setError(err?.message || "Could not resend verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }, [email, resendCooldown, getCaptchaToken]);

  const handleSignIn = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      setShowResend(false);
      setIsLoading(true);

      try {
        const captchaToken = await getCaptchaToken("login");
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password, captchaToken }),
        });

        const raw = await res.json().catch(() => ({}));
        if (!res.ok) {
          const requiresVerification =
            raw?.code === "EMAIL_NOT_VERIFIED" ||
            raw?.requiresVerification ||
            /verify|verification/i.test(String(raw?.error || ""));

          if (requiresVerification) {
            setShowResend(true);
            setSuccess("Your email isn’t verified yet. Check inbox/spam, or resend below.");
            return;
          }
          throw new Error(raw?.error || "Sign in failed");
        }

        const payload = unwrapPayload(raw);

        const user = payload?.user;
        const token = payload?.token;
        const entitlements = payload?.entitlements ?? null;

        if (!user || !token) {
          throw new Error("Invalid server response: missing user or token");
        }

        login(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            tier: user.tier || "observer",
            full_name: user.name || user.full_name,
            display_name: user.display_name,
            created_at: user.created_at,
            avatar_url: user.avatar_url,
          },
          token
        );

        setSuccess("Successfully signed in!");
        const redirect = safeRedirect(searchParams.get("redirect"));
        window.setTimeout(() => navigate(redirect), 350);
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        const isUserMissing =
          msg.includes("user not found") ||
          msg.includes("invalid") ||
          msg.includes("no account") ||
          msg.includes("not exist");
        if (isUserMissing) {
          setError(
            "We recently migrated our infrastructure. If you had an existing account, please re-register with the same email — your Stripe subscription will automatically re-link. Contact support@aivis.biz if you need assistance."
          );
        } else {
          setError(err?.message || "Sign in failed. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, login, navigate, searchParams, getCaptchaToken]
  );

  const handleSignUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      setIsLoading(true);

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setIsLoading(false);
        return;
      }

      if (password.length < 10) {
        setError("Password must be at least 10 characters");
        setIsLoading(false);
        return;
      }

      if (!acceptedTerms || !acceptedPrivacy) {
        setError("You must accept Terms of Service and Privacy Policy to create an account.");
        setIsLoading(false);
        return;
      }

      try {
        const captchaToken = await getCaptchaToken("signup");
        const res = await fetch(`${API_URL}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
            name,
            captchaToken,
            referralCode: referralCode ? referralCode.trim().toUpperCase() : undefined,
            termsAccepted: acceptedTerms,
            privacyAccepted: acceptedPrivacy,
            marketingOptIn,
            policyVersion: "2026-03-12",
            consentSource: "auth_signup_form",
          }),
        });

        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw?.error || "Sign up failed");

        const payload = unwrapPayload(raw);

        if (payload?.requiresVerification) {
          setSuccess(raw?.message || "Account created! Check your email to verify before signing in.");
          setShowResend(true);
          setMode("signin");
          return;
        }

        if (payload?.user && payload?.token) {
          login(
            {
              id: payload.user.id,
              email: payload.user.email,
              role: payload.user.role,
              tier: payload.user.tier || "observer",
              full_name: payload.user.name || payload.user.full_name,
              display_name: payload.user.display_name,
              created_at: payload.user.created_at,
              avatar_url: payload.user.avatar_url,
            },
            payload.token
          );
          setSuccess("Account created successfully!");
          window.setTimeout(() => navigate("/"), 350);
          return;
        }

        setSuccess(raw?.message || "Account created! You can now sign in.");
        setMode("signin");
      } catch (err: any) {
        setError(err?.message || "Sign up failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, confirmPassword, name, login, navigate, acceptedTerms, acceptedPrivacy, marketingOptIn, referralCode, getCaptchaToken]
  );

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      setIsLoading(true);

      try {
        const captchaToken = await getCaptchaToken("reset_password");
        const res = await fetch(`${API_URL}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, captchaToken }),
        });

        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw?.error || "Password reset failed");

        setSuccess("Password reset instructions sent to your email");
        window.setTimeout(() => setMode("signin"), 1200);
      } catch (err: any) {
        setError(err?.message || "Password reset failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [email, getCaptchaToken]
  );

  if (isAuthenticated) {
    const redirect = safeRedirect(searchParams.get("redirect"));
    return <Navigate to={redirect} replace />;
  }

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        {/* Warm base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1f3a] via-[#3d2048] to-[#6a1f1f]" />
        {/* Geometric accent shapes */}
        <svg className="absolute" style={{top:'3%',left:'5%',opacity:0.10}} width="90" height="78" viewBox="0 0 90 78"><polygon points="45,0 90,78 0,78" fill="rgba(255,255,255,0.28)" /></svg>
        <svg className="absolute" style={{top:'6%',right:'8%',opacity:0.08}} width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" /></svg>
        <svg className="absolute" style={{top:'22%',left:'3%',opacity:0.07,transform:'rotate(45deg)'}} width="64" height="64" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="4" fill="rgba(255,255,255,0.22)" /></svg>
        <svg className="absolute" style={{top:'25%',right:'4%',opacity:0.08}} width="100" height="86" viewBox="0 0 100 86"><polygon points="50,0 100,25 100,75 50,100 0,75 0,25" fill="rgba(255,255,255,0.28)" /></svg>
        <svg className="absolute" style={{top:'48%',left:'48%',opacity:0.07,transform:'rotate(10deg)'}} width="60" height="60" viewBox="0 0 60 60"><rect x="24" y="0" width="12" height="60" rx="4" fill="rgba(255,255,255,0.24)" /><rect x="0" y="24" width="60" height="12" rx="4" fill="rgba(255,255,255,0.24)" /></svg>
        <svg className="absolute" style={{top:'70%',left:'6%',opacity:0.08}} width="88" height="76" viewBox="0 0 88 76"><polygon points="44,0 88,22 88,66 44,88 0,66 0,22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" /></svg>
        <svg className="absolute" style={{top:'85%',right:'6%',opacity:0.10,transform:'rotate(180deg)'}} width="78" height="68" viewBox="0 0 78 68"><polygon points="39,0 78,68 0,68" fill="rgba(255,255,255,0.28)" /></svg>
        <svg className="absolute" style={{top:'92%',left:'38%',opacity:0.07,transform:'rotate(45deg)'}} width="58" height="58" viewBox="0 0 58 58"><rect x="6" y="6" width="46" height="46" rx="3" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="5" /></svg>
      </div>

      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="relative">
            {/* Brand color splash orbs */}
            <div className="absolute -inset-6 pointer-events-none">
              <div className="absolute -top-4 -left-4 w-28 h-28 rounded-full bg-sky-500/18 blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
              <div className="absolute -bottom-4 -right-4 w-28 h-28 rounded-full bg-rose-900/25 blur-2xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-orange-500/20 blur-xl animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
            </div>
            <div className="relative logo-pill px-6 py-4">
              <img
                src="/text-logo.png"
                alt="AiVIS: Ai Visibility Intelligence Audits"
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#0ea5e9]/35 via-[#7c2d12]/35 to-[#f97316]/35 rounded-2xl blur opacity-70" />
          <div className="relative bg-charcoal backdrop-blur-xl border border-white/12 rounded-2xl p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">
                {mode === "signin" && "Welcome Back"}
                {mode === "signup" && "Create Account"}
                {mode === "reset" && "Reset Password"}
              </h1>
              <p className="text-white/65 text-sm">
                {mode === "signin" && "Sign in to access your dashboard"}
                {mode === "signup" && "Start tracking your AI visibility"}
                {mode === "reset" && "We'll send you reset instructions"}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg card-charcoal flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-white/80 flex-shrink-0" />
                <p className="text-white/80 text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg card-charcoal/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-white/80 flex-shrink-0" />
                  <p className="text-white/80 text-sm">{success}</p>
                </div>

                {showResend && email && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading || resendCooldown > 0}
                    className="mt-2 ml-6 text-xs text-white/75 hover:text-white disabled:text-white/35 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {resendLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    {resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : "Didn't get the email? Resend verification"}
                  </button>
                )}
              </div>
            )}

            {mode === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/55" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`${vividFieldClass} pl-11 pr-4 py-3`}
                      style={globalFieldStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/55" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••••"
                      autoComplete="current-password"
                      className={`${vividFieldClass} pl-11 pr-16 py-3`}
                      style={globalFieldStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      onMouseDown={(e) => e.preventDefault()}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute z-20 right-10 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-charcoal-light/70 p-1 text-white/70 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Referral Code (optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      placeholder="ABC12345"
                      autoComplete="off"
                      className={`${vividFieldClass} px-4 py-3`}
                      style={globalFieldStyle}
                      maxLength={24}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#0ea5e9] via-[#7f1d1d] to-[#f97316] text-white font-semibold rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
                </button>

                <button
                  type="button"
                  onClick={startGoogleOAuth}
                  className="w-full py-3 px-4 border border-white/15 bg-charcoal-light hover:bg-charcoal text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.47a5.54 5.54 0 0 1-2.4 3.63v3.01h3.89c2.28-2.1 3.53-5.2 3.53-8.67z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.76-2.11-6.7-4.95H1.27v3.11A12 12 0 0 0 12 24z"/>
                    <path fill="#FBBC05" d="M5.3 14.28A7.2 7.2 0 0 1 4.93 12c0-.8.13-1.58.37-2.28V6.61H1.27A12.03 12.03 0 0 0 0 12c0 1.93.46 3.76 1.27 5.39l4.03-3.11z"/>
                    <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.43-3.43C17.96 1.2 15.24 0 12 0A12 12 0 0 0 1.27 6.61L5.3 9.72C6.24 6.88 8.88 4.77 12 4.77z"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={startGithubOAuth}
                  className="w-full py-3 px-4 border border-white/15 bg-charcoal-light hover:bg-charcoal text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58 0-.28-.01-1.04-.01-2.04-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.3 3.5 1c.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.005 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Continue with GitHub
                </button>
              </form>
            )}

            {mode === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/55" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name (optional)"
                      autoComplete="name"
                      className={`${vividFieldClass} pl-11 pr-4 py-3`}
                      style={globalFieldStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/55" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`${vividFieldClass} pl-11 pr-4 py-3`}
                      style={globalFieldStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/55" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Min 10 characters"
                      autoComplete="new-password"
                      className={`${vividFieldClass} pl-11 pr-16 py-3`}
                      style={globalFieldStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      onMouseDown={(e) => e.preventDefault()}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute z-20 right-10 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-charcoal-light/70 p-1 text-white/70 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {password && mode === "signup" && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= pwStrength.score ? pwStrength.color : "bg-white/10"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-white/50">{pwStrength.label}{password.length < 10 ? " — min 10 characters" : ""}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/55" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••••"
                      autoComplete="new-password"
                      className={`${vividFieldClass} pl-11 pr-4 py-3`}
                      style={globalFieldStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Referral Code (optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      placeholder="ABC12345"
                      autoComplete="off"
                      className={`${vividFieldClass} px-4 py-3`}
                      style={globalFieldStyle}
                      maxLength={24}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-white/10 bg-charcoal-light/60 p-4">
                  <label className="flex items-start gap-3 text-sm text-white/85">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/25 bg-charcoal-light"
                      required
                    />
                    <span>
                      I agree to the <Link to="/terms" className="underline underline-offset-2 text-white">Terms of Service</Link>.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-white/85">
                    <input
                      type="checkbox"
                      checked={acceptedPrivacy}
                      onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/25 bg-charcoal-light"
                      required
                    />
                    <span>
                      I agree to the <Link to="/privacy" className="underline underline-offset-2 text-white">Privacy Policy</Link>.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-white/75">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(e) => setMarketingOptIn(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/25 bg-charcoal-light"
                    />
                    <span>
                      Keep me subscribed to promotional and product update emails. Account, billing, and security alerts are always sent when required.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#0ea5e9] via-[#7f1d1d] to-[#f97316] text-white font-semibold rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
                </button>

                <button
                    type="button"
                    onClick={startGoogleOAuth}
                    className="w-full py-3 px-4 border border-white/15 bg-charcoal-light hover:bg-charcoal text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.47a5.54 5.54 0 0 1-2.4 3.63v3.01h3.89c2.28-2.1 3.53-5.2 3.53-8.67z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.76-2.11-6.7-4.95H1.27v3.11A12 12 0 0 0 12 24z"/>
                      <path fill="#FBBC05" d="M5.3 14.28A7.2 7.2 0 0 1 4.93 12c0-.8.13-1.58.37-2.28V6.61H1.27A12.03 12.03 0 0 0 0 12c0 1.93.46 3.76 1.27 5.39l4.03-3.11z"/>
                      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.43-3.43C17.96 1.2 15.24 0 12 0A12 12 0 0 0 1.27 6.61L5.3 9.72C6.24 6.88 8.88 4.77 12 4.77z"/>
                    </svg>
                    Continue with Google
                  </button>

                <button
                  type="button"
                  onClick={startGithubOAuth}
                  className="w-full py-3 px-4 border border-white/15 bg-charcoal-light hover:bg-charcoal text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58 0-.28-.01-1.04-.01-2.04-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.3 3.5 1c.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.005 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Continue with GitHub
                </button>
              </form>
            )}

            {mode === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/85 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/55" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full pl-11 pr-4 py-3 bg-charcoal-light border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/16 focus:ring-1 focus:ring-white/15 transition-all"
                      style={globalFieldStyle}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[rgba(255,255,255,0.28)] to-[rgba(255,255,255,0.22)] text-white font-semibold rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-white/10/70">
              {mode === "signin" && (
                <div className="space-y-3 text-center">
                  <button
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-charcoal-light/35 px-4 py-2.5 text-sm text-white/70 transition-colors hover:text-white"
                    type="button"
                  >
                    Don't have an account? <span className="font-semibold">Sign Up</span>
                  </button>
                  <br />
                  <button
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-charcoal-light/35 px-4 py-2.5 text-sm text-white/75 transition-colors hover:text-[rgba(255,255,255,0.28)]"
                    type="button"
                  >
                    Forgot password?
                  </button>

                  {email && (
                    <>
                      <br />
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendLoading || resendCooldown > 0}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-charcoal-light/35 px-4 py-2.5 text-sm text-white/75 transition-colors hover:text-[rgba(255,255,255,0.28)] disabled:cursor-not-allowed disabled:text-white/75"
                      >
                        {resendLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {mode === "signup" && (
                <button
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="w-full text-center text-white/70 hover:text-white text-sm transition-colors"
                  type="button"
                >
                  Already have an account? <span className="font-semibold">Sign In</span>
                </button>
              )}

              {mode === "reset" && (
                <button
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="w-full text-center text-white/70 hover:text-white text-sm transition-colors"
                  type="button"
                >
                  Back to <span className="font-semibold">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-white/75 text-xs mt-6">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="text-sky-400/80 hover:text-sky-300 underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-sky-400/80 hover:text-sky-300 underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>

        <div className="flex items-center justify-center gap-6 mt-4">
          {TRUST_FEATURES.map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5 text-[11px] text-white/45">
              <Icon className="w-3.5 h-3.5" />
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
