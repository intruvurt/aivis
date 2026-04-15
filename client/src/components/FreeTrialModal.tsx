import React, { useState } from "react";
import { X, Zap, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../stores/authStore";
import { apiFetch } from "../utils/api";

interface Props {
  onClose: () => void;
}

const SIGNAL_FEATURES = [
  "Triple-Check AI pipeline (3-model score consensus)",
  "Citation testing across ChatGPT, Claude & Perplexity",
  "Competitor tracking + gap analysis",
  "Brand mention monitoring (19 sources)",
  "Advanced PDF & shareable report exports",
  "110 AI visibility scans per month",
];

export default function FreeTrialModal({ onClose }: Props) {
  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    if (!token || loading) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await apiFetch("/api/payment/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier: "signal", billingPeriod: "monthly" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create checkout session");
      }
      // data.data is the Stripe Checkout URL
      const checkoutUrl = data.data as string;
      if (!checkoutUrl) throw new Error("No checkout URL returned");
      window.location.href = checkoutUrl;
    } catch (err: any) {
      const msg = err?.message || "Could not start checkout — please try again";
      setApiError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
          aria-label="Close"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-6 pt-6 pb-7">
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-violet-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
              Signal Plan
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            14-Day Free Trial
          </h2>
          <p className="text-sm text-white/50 mb-5">
            Full Signal access — no charge today. Card required to start.
          </p>

          {/* Feature list */}
          <ul className="space-y-2 mb-6">
            {SIGNAL_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-white/80">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          {/* Billing notice */}
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 mb-5">
            <ShieldCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200/80 leading-relaxed">
              <strong className="text-amber-300">$0.00 today.</strong> Your card will be
              charged <strong className="text-amber-300">$149/mo</strong> within 24–46 hours
              after your 14-day trial ends on{" "}
              <strong className="text-amber-300">
                {new Date(Date.now() + 14 * 86_400_000).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>
              . Cancel any time before that for $0 charges.
            </p>
          </div>

          {/* API error */}
          {apiError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{apiError}</p>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleStartTrial}
            disabled={loading}
            type="button"
            className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-violet-900/30"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Opening Stripe…
              </span>
            ) : (
              "Start Free Trial — Enter Card"
            )}
          </button>

          <p className="text-center text-xs text-white/30 mt-3">
            Secured by Stripe · PCI Level 1 · Cancel before day 14 = $0
          </p>
        </div>
      </div>
    </div>
  );
}
