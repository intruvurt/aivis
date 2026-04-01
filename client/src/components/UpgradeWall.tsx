import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Sparkles, Check } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { apiFetch } from "../utils/api";

interface UpgradeWallProps {
  /** Feature name shown in the heading, e.g. "Competitor Intelligence" */
  feature: string;
  /** Short description of what the feature does */
  description: string;
  /** Minimum tier required (for display purposes) */
  requiredTier?: "alignment" | "signal" | "scorefix";
  /** Optional icon to display (defaults to Lock) */
  icon?: React.ReactElement;
  /**
   * 2–4 bullet points previewing what the feature actually gives them.
   * Renders a "sneak peek" list above the CTA when provided.
   */
  featurePreview?: string[];
}

/**
 * Upgrade prompt shown to Observer-tier users when they try to access
 * a feature restricted to Alignment / Signal plans.
 * Also offers a free 14-day Signal trial if the user hasn't used one already.
 */
export default function UpgradeWall({ feature, description, requiredTier, icon, featurePreview }: UpgradeWallProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [starting, setStarting] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

  const trialUsed = user?.trial_used === true || (user?.trial_active === false && user?.trial_ends_at != null);
  const canStartTrial = user?.tier === 'observer' && !user?.trial_active && !trialUsed;

  const handleStartTrial = async () => {
    setStarting(true);
    setTrialError(null);
    try {
      const res = await apiFetch("/api/billing/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to start trial");
      }
      await refreshUser();
      // Page will re-render with the new tier, removing this wall
    } catch (err: any) {
      setTrialError(err?.message || "Failed to start trial");
    } finally {
      setStarting(false);
    }
  };

  const tierLabel = requiredTier === "scorefix" ? "Score Fix" : requiredTier === "signal" ? "Signal" : "Alignment";

  const tierBadgeColor =
    requiredTier === "scorefix"
      ? "border-orange-400/30 bg-orange-400/10 text-orange-300"
      : requiredTier === "signal"
      ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
      : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-charcoal p-8 text-center">
      <div className="inline-block p-4 rounded-xl bg-charcoal mb-4">
        {icon ?? <Lock className="w-12 h-12 text-white/80" />}
      </div>

      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium mb-3 ${tierBadgeColor}`}>
        <Lock className="w-3 h-3" />
        {tierLabel}{requiredTier !== "scorefix" ? " plan required" : " pack required"}
      </div>

      <h3 className="text-xl font-semibold text-white mb-2">
        Upgrade to Access {feature}
      </h3>
      <p className="text-white/55 mb-4 max-w-md mx-auto">
        {description}
      </p>

      {canStartTrial && requiredTier !== "scorefix" && (
        <p className="text-emerald-400/70 text-sm mb-4 max-w-sm mx-auto">
          Signal includes a real 14-day trial — full triple-check pipeline, competitor tracking,
          citation testing, and every premium feature. No credit card required.
        </p>
      )}

      {featurePreview && featurePreview.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 mb-6 text-left max-w-sm mx-auto">
          <p className="text-[11px] uppercase tracking-wider text-white/35 mb-3 font-medium">What you unlock</p>
          <ul className="space-y-2">
            {featurePreview.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/65">
                <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400/70" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {canStartTrial && requiredTier !== "scorefix" && (
          <button
            onClick={handleStartTrial}
            disabled={starting}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            type="button"
          >
            <Sparkles className="w-4 h-4" />
            {starting ? "Starting..." : "Start Real 14-Day Signal Trial"}
          </button>
        )}
        <button
          onClick={() => navigate("/pricing")}
          className="px-6 py-3 bg-gradient-to-r from-white/28 to-white/14 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          type="button"
        >
          {requiredTier === "scorefix" ? "View Score Fix Packs" : "View Pricing"}
        </button>
      </div>

      {trialUsed && (
        <p className="text-amber-400/70 text-sm mt-3">
          Your free trial has been used. Subscribe to continue with Signal features.
        </p>
      )}
      {trialError && (
        <p className="text-red-400/80 text-sm mt-3">{trialError}</p>
      )}
    </div>
  );
}
