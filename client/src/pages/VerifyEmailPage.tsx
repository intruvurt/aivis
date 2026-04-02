import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, RefreshCw, Mail } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

import { API_URL } from '../config';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!resendEmail || resendCooldown > 0) return;
    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to resend");
      setResendMsg({ type: "ok", text: "Verification email sent! Check your inbox." });
      setResendCooldown(60);
    } catch (err: any) {
      setResendMsg({ type: "err", text: err?.message || "Could not resend. Try again." });
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token. Please check your email link.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setStatus("error");
          setMessage(data?.error || "Verification failed. The link may have expired.");
          return;
        }

        setStatus("success");
        setMessage(data.message || "Email verified successfully!");

        // Auto-login if server returned a token
        const payload = data.data || data;
        if (payload.token && payload.user) {
          login(
            {
              id: payload.user.id,
              email: payload.user.email,
              tier: payload.user.tier || "observer",
              full_name: payload.user.name || payload.user.full_name,
            },
            payload.token,
          );
          // Redirect to dashboard after brief delay
          setTimeout(() => navigate("/"), 2000);
        } else {
          // Redirect to login
          setTimeout(() => navigate("/auth?mode=signin"), 3000);
        }
      } catch {
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    })();
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-white/16 to-black" />
      </div>

      <div className="w-full max-w-md text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-white/85 animate-spin mx-auto" />
            <h1 className="text-2xl font-bold text-white">Verifying your email…</h1>
            <p className="text-white/55">Please wait a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl card-charcoal/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-white/80" />
            </div>
            <h1 className="text-2xl font-bold text-white">Email Verified!</h1>
            <p className="text-white/55">{message}</p>
            <p className="text-white/60 text-sm">Redirecting you now…</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl card-charcoal flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-white/80" />
            </div>
            <h1 className="text-2xl font-bold text-white">Verification Failed</h1>
            <p className="text-white/55">{message}</p>
            <button
              onClick={() => navigate("/auth?mode=signin")}
              className="mt-4 px-6 py-2.5 rounded-xl bg-charcoal hover:bg-charcoal text-white text-sm font-semibold transition-colors"
            >
              Go to Sign In
            </button>

            {/* Resend verification form */}
            <div className="mt-6 pt-6 border-t border-white/10 w-full max-w-sm mx-auto">
              <p className="text-white/55 text-sm mb-3">Need a new verification link?</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && resendEmail && !resendLoading && resendCooldown <= 0 && handleResend()}
                    enterKeyHint="send"
                    placeholder="your@email.com"
                    className="w-full pl-9 pr-3 py-2 bg-charcoal border border-white/10 rounded-lg text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/12"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!resendEmail || resendLoading || resendCooldown > 0}
                  className="px-4 py-2 rounded-full bg-charcoal hover:bg-charcoal disabled:bg-charcoal disabled:text-white/60 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {resendCooldown > 0 ? `${resendCooldown}s` : "Resend"}
                </button>
              </div>
              {resendMsg && (
                <p className={`mt-2 text-xs ${resendMsg.type === "ok" ? "text-white/80" : "text-white/80"}`}>
                  {resendMsg.text}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
