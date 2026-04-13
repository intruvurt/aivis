import React, { useState, useEffect, useCallback } from "react";
import { FileText, Check, Shield, AlertTriangle, Loader2, Download, ShieldCheck, Clock, Lock, Mail, KeyRound, UserCheck } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import PublicPageFrame from "../components/PublicPageFrame";
import { API_URL } from "../config";

const AGREEMENT_SLUG = "aivis-zeeniith-referral-delivery-2026";

/** Read ?token= and ?ref= from URL */
function getUrlParams(): { token: string | null; ref: string | null } {
  const params = new URLSearchParams(window.location.search);
  return { token: params.get("token"), ref: params.get("ref") };
}

interface AgreementData {
  id: string;
  slug: string;
  title: string;
  terms_html: string;
  terms_hash: string;
  party_a_name: string;
  party_a_org: string;
  party_a_phone: string;
  party_b_name: string;
  party_b_org: string;
  party_b_phone: string;
  status: "pending" | "partially_signed" | "fully_signed" | "expired" | "revoked";
  signing_deadline: string | null;
  valid_until: string | null;
  party_a_signed_at: string | null;
  party_a_signature: string | null;
  party_b_signed_at: string | null;
  party_b_signature: string | null;
  locked_at: string | null;
  locked_hash: string | null;
  created_at: string;
  days_until_expiry: number | null;
  expiry_warning: boolean;
}

interface VerifyResult {
  found: boolean;
  locked: boolean;
  terms_intact: boolean;
  lock_intact: boolean;
  status: string;
  locked_at?: string;
  locked_hash?: string;
}

export default function PartnershipAgreementPage() {
  usePageMeta({
    title: "Referral and Delivery Partnership Terms | AiVIS.biz",
    description: "Private commercial terms for AiVIS referral and delivery partnerships.",
    path: "/partnership-terms",
    noIndex: true,
  });

  const [agreement, setAgreement] = useState<AgreementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [emailRequired, setEmailRequired] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateEmailError, setGateEmailError] = useState<string | null>(null);
  const [gateEmailLoading, setGateEmailLoading] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [signingParty, setSigningParty] = useState<"a" | "b" | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [signError, setSignError] = useState<string | null>(null);
  const [signSuccess, setSignSuccess] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const { token } = getUrlParams();

  const fetchAgreement = useCallback(async (emailOverride?: string) => {
    const emailParam = emailOverride || verifiedEmail;
    try {
      let url = `${API_URL}/api/agreements/${AGREEMENT_SLUG}`;
      const params = new URLSearchParams();
      if (token) params.set("token", token);
      if (emailParam) params.set("email", emailParam);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url);
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.email_required) {
          setEmailRequired(true);
          setAccessDenied(false);
        } else {
          setAccessDenied(true);
          setEmailRequired(false);
        }
        return;
      }
      if (res.status === 404) {
        setError("Agreement not found. It may not have been created yet.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load agreement.");
      const data: AgreementData = await res.json();
      setAgreement(data);
      setError(null);
      setAccessDenied(false);
      setEmailRequired(false);
    } catch (err: any) {
      setError(err.message || "Failed to load agreement.");
    } finally {
      setLoading(false);
    }
  }, [token, verifiedEmail]);

  useEffect(() => { fetchAgreement(); }, [fetchAgreement]);

  const handleEmailGate = async () => {
    const email = gateEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setGateEmailError("Enter a valid email address.");
      return;
    }
    setGateEmailLoading(true);
    setGateEmailError(null);
    setVerifiedEmail(email);
    await fetchAgreement(email);
    setGateEmailLoading(false);
    // If still emailRequired, the email didn't match
    // Check state after fetchAgreement completes
  };

  // After fetchAgreement with email, if still emailRequired → wrong email
  useEffect(() => {
    if (verifiedEmail && emailRequired && !loading) {
      setGateEmailError("This email is not associated with this agreement.");
    }
  }, [verifiedEmail, emailRequired, loading]);

  const handleRequestOtp = async () => {
    if (!signingParty || !token || !verifiedEmail) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(`${API_URL}/api/agreements/${AGREEMENT_SLUG}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party: signingParty, token, email: verifiedEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Failed to send OTP.");
        return;
      }
      setOtpSent(true);
      setOtpEmail(data.email || "");
    } catch (err: any) {
      setOtpError(err.message || "Network error.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signingParty || !signatureName.trim() || !otpCode.trim() || !token || !verifiedEmail) return;
    setSignError(null);
    setSignSuccess(null);
    setSigning(true);
    try {
      const res = await fetch(`${API_URL}/api/agreements/${AGREEMENT_SLUG}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party: signingParty, signature: signatureName.trim(), otp: otpCode.trim(), token, email: verifiedEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSignError(data.error || "Signing failed.");
        return;
      }
      setSignSuccess(data.message);
      setSignatureName("");
      setSigningParty(null);
      setOtpSent(false);
      setOtpCode("");
      setOtpEmail("");
      await fetchAgreement();
    } catch (err: any) {
      setSignError(err.message || "Network error.");
    } finally {
      setSigning(false);
    }
  };

  const handleVerify = async () => {
    if (!token || !verifiedEmail) return;
    setVerifying(true);
    try {
      const qs = new URLSearchParams({ token, email: verifiedEmail });
      const res = await fetch(`${API_URL}/api/agreements/${AGREEMENT_SLUG}/verify?${qs}`);
      const data: VerifyResult = await res.json();
      setVerifyResult(data);
    } catch {
      setVerifyResult(null);
    } finally {
      setVerifying(false);
    }
  };

  const isExpired = agreement?.signing_deadline
    ? new Date(agreement.signing_deadline) < new Date()
    : false;

  const showSigningForm = agreement && agreement.status !== "fully_signed" && agreement.status !== "expired" && agreement.status !== "revoked" && !isExpired;

  return (
    <PublicPageFrame icon={FileText} title="Partnership Terms" subtitle="AiVIS × Zeeniith" maxWidthClass="max-w-[980px]">
      <div className="space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-20 text-white/50">
            <img src="/aivis-progress-spinner.png" alt="" className="w-5 h-5 animate-spin mr-3" /> Loading agreement...
          </div>
        )}

        {accessDenied && !loading && !emailRequired && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <Lock className="inline-block mb-3 text-red-400" size={32} />
            <h2 className="text-xl font-semibold text-red-300 mb-2">Access Denied</h2>
            <p className="text-white/50 text-sm">This agreement page is private. A valid access token is required.</p>
            <p className="text-white/40 text-xs mt-3">If you received an invite link, use the full URL provided. Otherwise, contact partners@aivis.biz.</p>
          </div>
        )}

        {emailRequired && !loading && !agreement && (
          <div className="rounded-2xl border border-[#7c5cff]/30 bg-[rgba(18,18,26,0.96)] p-8 max-w-md mx-auto">
            <div className="text-center mb-6">
              <UserCheck className="inline-block mb-3 text-[#7c5cff]" size={36} />
              <h2 className="text-xl font-semibold text-white mb-2">Verify Your Identity</h2>
              <p className="text-white/50 text-sm">
                This agreement is restricted to the named parties. Enter the email address associated with your role in this contract.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="email"
                value={gateEmail}
                onChange={(e) => { setGateEmail(e.target.value); setGateEmailError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleEmailGate(); }}
                placeholder="your@email.com"
                className="w-full bg-[#171722] border border-[#2a2f3a] rounded-lg px-4 py-3 text-white placeholder:text-white/25 focus:border-[#7c5cff] focus:outline-none transition-colors"
                autoFocus
              />
              {gateEmailError && (
                <p className="text-red-400 text-xs">{gateEmailError}</p>
              )}
              <button
                onClick={handleEmailGate}
                disabled={gateEmailLoading || !gateEmail.trim()}
                className="w-full px-5 py-3 rounded-lg bg-[#7c5cff] text-white font-medium text-sm hover:bg-[#6a4ce0] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {gateEmailLoading ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                {gateEmailLoading ? "Verifying..." : "Access Agreement"}
              </button>
              <p className="text-white/30 text-xs text-center mt-2">
                Only emails registered as Party A or Party B in this contract are accepted.
              </p>
            </div>
          </div>
        )}

        {error && !loading && !accessDenied && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <AlertTriangle className="inline-block mb-2 text-amber-400" size={24} />
            <p className="text-amber-200">{error}</p>
            <p className="text-white/50 text-sm mt-2">Contact partners@aivis.biz for assistance.</p>
          </div>
        )}

        {agreement && !loading && (
          <>
            {/* Expiry warning banner (persistent from 7 days) */}
            {agreement.expiry_warning && agreement.days_until_expiry !== null && agreement.days_until_expiry > 0 && (
              <div className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-5 flex items-center gap-4">
                <AlertTriangle className="text-orange-400 shrink-0" size={28} />
                <div>
                  <p className="text-orange-300 font-semibold">
                    Agreement expires in {agreement.days_until_expiry} day{agreement.days_until_expiry !== 1 ? "s" : ""}
                  </p>
                  <p className="text-white/50 text-sm">
                    Valid until {agreement.valid_until ? new Date(agreement.valid_until).toLocaleDateString() : "N/A"}.
                    Please coordinate renewal with your partner or contact partners@aivis.biz.
                  </p>
                </div>
              </div>
            )}
            {/* Status banner */}
            <StatusBanner agreement={agreement} isExpired={isExpired} />

            {/* Hero card */}
            <section className="rounded-2xl border border-[#7c5cff]/28 bg-[radial-gradient(circle_at_top_right,rgba(124,92,255,0.18),transparent_32%),rgba(18,18,26,0.96)] p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <span className="inline-block text-[0.8rem] text-[#d7ddff] bg-[rgba(124,92,255,0.15)] border border-[#7c5cff]/35 px-2.5 py-1.5 rounded-full mb-3">
                Private commercial terms
              </span>
              <h2 className="text-[2rem] font-bold leading-tight tracking-tight mb-3">{agreement.title}</h2>
              <p className="text-white/75 mb-5 leading-relaxed">
                This page sets the working terms between the parties for lead origination, project closing, development delivery, payment handling, client protection, and commission entitlement.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
                <MetaBox label="Effective date" value="April 1, 2026" />
                <MetaBox label="Party A" value={`${agreement.party_a_name}, ${agreement.party_a_org}`} />
                <MetaBox label="Party B" value={`${agreement.party_b_name}, ${agreement.party_b_org}`} />
                <MetaBox label="Terms hash" value={agreement.terms_hash.slice(0, 12) + "..."} mono />
              </div>
            </section>

            {/* Terms content */}
            <section className="rounded-2xl border border-[#2a2f3a] bg-[rgba(18,18,26,0.94)] p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <div
                className="prose prose-invert max-w-none text-white/80 leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:space-y-1 [&_strong]:text-white"
                dangerouslySetInnerHTML={{ __html: agreement.terms_html }}
              />
            </section>

            {/* Signature block */}
            <section className="rounded-2xl border border-[#2a2f3a] bg-[rgba(18,18,26,0.94)] p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <h2 className="text-xl font-semibold mb-5 flex items-center gap-2">
                <Shield size={20} className="text-[#7c5cff]" /> Signature Block
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Party A signature */}
                <div className={`rounded-xl border p-4 ${agreement.party_a_signed_at ? "border-emerald-500/40 bg-emerald-500/5" : "border-[#2a2f3a] bg-[#171722]"}`}>
                  <span className="block text-[#a6adbb] text-[0.85rem] uppercase tracking-wider mb-1.5">Party A</span>
                  <p className="font-semibold mb-1">{agreement.party_a_name}</p>
                  <p className="text-sm text-white/50 mb-3">{agreement.party_a_org} - {agreement.party_a_phone}</p>
                  {agreement.party_a_signed_at ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <Check size={16} />
                      <span>Signed: {agreement.party_a_signature}</span>
                      <span className="text-white/30 ml-auto text-xs">{new Date(agreement.party_a_signed_at).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <p className="text-amber-400/70 text-sm flex items-center gap-1.5"><Clock size={14} /> Awaiting signature</p>
                  )}
                </div>

                {/* Party B signature */}
                <div className={`rounded-xl border p-4 ${agreement.party_b_signed_at ? "border-emerald-500/40 bg-emerald-500/5" : "border-[#2a2f3a] bg-[#171722]"}`}>
                  <span className="block text-[#a6adbb] text-[0.85rem] uppercase tracking-wider mb-1.5">Party B</span>
                  <p className="font-semibold mb-1">{agreement.party_b_name}</p>
                  <p className="text-sm text-white/50 mb-3">{agreement.party_b_org} - {agreement.party_b_phone}</p>
                  {agreement.party_b_signed_at ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <Check size={16} />
                      <span>Signed: {agreement.party_b_signature}</span>
                      <span className="text-white/30 ml-auto text-xs">{new Date(agreement.party_b_signed_at).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <p className="text-amber-400/70 text-sm flex items-center gap-1.5"><Clock size={14} /> Awaiting signature</p>
                  )}
                </div>
              </div>

              {/* Tamper-lock info */}
              {agreement.locked_at && agreement.locked_hash && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-2">
                    <Lock size={16} /> Tamper-Locked
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-white/60">
                    <p>Locked: {new Date(agreement.locked_at).toLocaleString()}</p>
                    <p>Valid until: {agreement.valid_until ? new Date(agreement.valid_until).toLocaleDateString() : "N/A"}</p>
                    <p className="sm:col-span-2 font-mono break-all">Hash: {agreement.locked_hash}</p>
                  </div>
                </div>
              )}
            </section>

            {/* Signing form */}
            {showSigningForm && (
              <section className="rounded-2xl border border-[#7c5cff]/30 bg-[rgba(18,18,26,0.94)] p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                <h2 className="text-xl font-semibold mb-4">Sign this Agreement</h2>
                <p className="text-white/60 text-sm mb-5">
                  Select your role, verify your email with a one-time code, then enter your full legal name to sign.
                </p>

                <div className="space-y-4">
                  {/* Party selector */}
                  <div>
                    <label className="block text-sm text-white/70 mb-2">I am signing as:</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setSigningParty("a"); setSignError(null); setSignSuccess(null); setOtpSent(false); setOtpCode(""); setOtpError(null); }}
                        disabled={!!agreement.party_a_signed_at}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          signingParty === "a"
                            ? "bg-[#7c5cff] text-white"
                            : agreement.party_a_signed_at
                              ? "bg-white/5 text-white/30 cursor-not-allowed"
                              : "bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        Party A - {agreement.party_a_name}
                        {agreement.party_a_signed_at && " ✓"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSigningParty("b"); setSignError(null); setSignSuccess(null); setOtpSent(false); setOtpCode(""); setOtpError(null); }}
                        disabled={!!agreement.party_b_signed_at}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          signingParty === "b"
                            ? "bg-[#7c5cff] text-white"
                            : agreement.party_b_signed_at
                              ? "bg-white/5 text-white/30 cursor-not-allowed"
                              : "bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        Party B - {agreement.party_b_name}
                        {agreement.party_b_signed_at && " ✓"}
                      </button>
                    </div>
                  </div>

                  {signingParty && !otpSent && (
                    <>
                      {/* Step 1: Request email verification */}
                      <div className="rounded-xl border border-[#2a2f3a] bg-[#171722] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail size={16} className="text-[#7c5cff]" />
                          <span className="text-sm font-medium text-white/80">Step 1: Email Verification</span>
                        </div>
                        <p className="text-white/50 text-xs mb-3">
                          A 6-digit code will be sent to the registered email for {signingParty === "a" ? "Party A" : "Party B"} to verify your identity.
                        </p>
                        <button
                          type="button"
                          onClick={handleRequestOtp}
                          disabled={otpLoading}
                          className="px-5 py-2 rounded-lg bg-[#7c5cff] text-white font-medium text-sm hover:bg-[#6a4ce0] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                          {otpLoading ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
                          {otpLoading ? "Sending..." : "Send Verification Code"}
                        </button>
                        {otpError && (
                          <p className="text-red-400 text-xs mt-2">{otpError}</p>
                        )}
                      </div>
                    </>
                  )}

                  {signingParty && otpSent && (
                    <>
                      {/* Step 2: Enter OTP + sign */}
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Check size={14} className="text-emerald-400" />
                          <span className="text-sm text-emerald-300">Verification code sent to {otpEmail}</span>
                        </div>
                        <p className="text-white/40 text-xs">Code expires in 10 minutes.</p>
                      </div>

                      <div>
                        <label className="block text-sm text-white/70 mb-2 flex items-center gap-1.5">
                          <KeyRound size={14} /> Verification code
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="000000"
                          className="w-40 bg-[#171722] border border-[#2a2f3a] rounded-lg px-4 py-2.5 text-white text-center text-lg tracking-[0.3em] font-mono placeholder:text-white/25 focus:border-[#7c5cff] focus:outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-white/70 mb-2">
                          Full legal name (must match exactly: <strong className="text-white">{signingParty === "a" ? agreement.party_a_name : agreement.party_b_name}</strong>)
                        </label>
                        <input
                          type="text"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          placeholder={signingParty === "a" ? agreement.party_a_name : agreement.party_b_name}
                          className="w-full bg-[#171722] border border-[#2a2f3a] rounded-lg px-4 py-2.5 text-white placeholder:text-white/25 focus:border-[#7c5cff] focus:outline-none transition-colors"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSign}
                        disabled={signing || !signatureName.trim() || otpCode.length !== 6}
                        className="px-6 py-2.5 rounded-lg bg-[#7c5cff] text-white font-medium text-sm hover:bg-[#6a4ce0] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {signing ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                        {signing ? "Signing..." : "Verify & Sign Agreement"}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtpCode(""); setOtpError(null); }}
                        className="text-white/40 hover:text-white/60 text-xs underline transition-colors"
                      >
                        Resend code or change party
                      </button>
                    </>
                  )}

                  {signError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
                      {signError}
                    </div>
                  )}
                  {signSuccess && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 text-sm">
                      {signSuccess}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Verification + export */}
            <section className="rounded-2xl border border-[#2a2f3a] bg-[rgba(18,18,26,0.94)] p-6">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleVerify}
                  disabled={verifying || !token || !verifiedEmail}
                  className="px-5 py-2 rounded-lg bg-white/5 border border-[#2a2f3a] text-white/80 text-sm hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  {verifying ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                  Verify Integrity
                </button>

                {agreement.status === "fully_signed" && (
                  <a
                    href={`${API_URL}/api/agreements/${AGREEMENT_SLUG}/export?${new URLSearchParams({ token: token || "", email: verifiedEmail || "" }).toString()}`}
                    className="px-5 py-2 rounded-lg bg-white/5 border border-[#2a2f3a] text-white/80 text-sm hover:bg-white/10 transition-all flex items-center gap-2"
                    download
                  >
                    <Download size={14} /> Download Signed Copy
                  </a>
                )}
              </div>

              {verifyResult && (
                <div className={`mt-4 rounded-lg p-4 text-sm ${
                  verifyResult.terms_intact && verifyResult.lock_intact
                    ? "border border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                    : "border border-red-500/30 bg-red-500/10 text-red-300"
                }`}>
                  <p className="font-semibold mb-2 flex items-center gap-2">
                    {verifyResult.terms_intact && verifyResult.lock_intact
                      ? <><ShieldCheck size={16} /> Integrity Verified</>
                      : <><AlertTriangle size={16} /> Integrity Check Failed</>
                    }
                  </p>
                  <ul className="space-y-1 text-xs">
                    <li>Status: {verifyResult.status}</li>
                    <li>Terms hash: {verifyResult.terms_intact ? "✓ intact" : "✗ TAMPERED"}</li>
                    <li>Lock hash: {verifyResult.locked ? (verifyResult.lock_intact ? "✓ intact" : "✗ TAMPERED") : "not locked yet"}</li>
                    {verifyResult.locked_at && <li>Locked: {new Date(verifyResult.locked_at).toLocaleString()}</li>}
                    {verifyResult.locked_hash && <li className="font-mono break-all">Hash: {verifyResult.locked_hash}</li>}
                  </ul>
                </div>
              )}

              {/* Partnership branding */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-6 pt-6 border-t border-[#2a2f3a]">
                <a href="https://aivis.biz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                  <img src="/aivis-logo.png" alt="AiVIS" className="h-10 w-10 rounded-xl" />
                  <div>
                    <p className="font-semibold text-white group-hover:text-cyan-300 transition-colors">AiVIS</p>
                    <p className="text-xs text-white/40">aivis.biz</p>
                  </div>
                </a>
                <span className="text-white/20 text-2xl select-none hidden sm:block">&times;</span>
                <a href="https://zeeniith.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                  <img src="https://zeeniith.in/favicon.ico" alt="Zeeniith" className="h-10 w-10 rounded-xl" />
                  <div>
                    <p className="font-semibold text-white group-hover:text-emerald-300 transition-colors">Zeeniith</p>
                    <p className="text-xs text-white/40">zeeniith.in</p>
                  </div>
                </a>
              </div>
              <p className="text-center text-[#a6adbb] text-xs mt-4">Private commercial page for review and execution</p>
            </section>
          </>
        )}
      </div>
    </PublicPageFrame>
  );
}

/* ── Subcomponents ───────────────────────────────────── */

function StatusBanner({ agreement, isExpired }: { agreement: AgreementData; isExpired: boolean }) {
  if (agreement.status === "fully_signed") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-5 flex items-center gap-4">
        <Lock className="text-emerald-400 shrink-0" size={28} />
        <div>
          <p className="text-emerald-300 font-semibold">Fully Signed &amp; Tamper-Locked</p>
          <p className="text-white/50 text-sm">
            Valid until {agreement.valid_until ? new Date(agreement.valid_until).toLocaleDateString() : "N/A"}.
            Integrity hash: <span className="font-mono">{agreement.locked_hash?.slice(0, 16)}...</span>
          </p>
        </div>
      </div>
    );
  }
  if (agreement.status === "expired" || isExpired) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/8 p-5 flex items-center gap-4">
        <AlertTriangle className="text-red-400 shrink-0" size={28} />
        <div>
          <p className="text-red-300 font-semibold">Signing Window Expired</p>
          <p className="text-white/50 text-sm">The 24-hour signing deadline has passed. Contact partners@aivis.biz to reissue.</p>
        </div>
      </div>
    );
  }
  if (agreement.status === "revoked") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/8 p-5 flex items-center gap-4">
        <AlertTriangle className="text-red-400 shrink-0" size={28} />
        <div>
          <p className="text-red-300 font-semibold">Agreement Revoked</p>
          <p className="text-white/50 text-sm">This agreement has been revoked and is no longer valid.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5 flex items-center gap-4">
      <Clock className="text-amber-400 shrink-0" size={28} />
      <div>
        <p className="text-amber-300 font-semibold">
          {agreement.status === "partially_signed" ? "Partially Signed - Awaiting Second Signature" : "Awaiting Signatures"}
        </p>
        <p className="text-white/50 text-sm">
          {agreement.signing_deadline
            ? `Signing deadline: ${new Date(agreement.signing_deadline).toLocaleString()}`
            : "Both parties must sign to activate this agreement."}
        </p>
      </div>
    </div>
  );
}

function MetaBox({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[#2a2f3a] bg-[#171722] px-4 py-3.5">
      <span className="block text-[#a6adbb] text-[0.85rem] uppercase tracking-wider mb-1.5">{label}</span>
      <div className={`font-semibold ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</div>
    </div>
  );
}
