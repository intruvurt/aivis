import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Sparkles, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../stores/authStore";
import { apiFetch } from "../utils/api";

/**
 * Global banner displayed in the app shell:
 * - Active trial → countdown + subscribe CTA
 * - Eligible for trial (observer, not used) → start trial CTA
 */
export default function TrialBanner() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const [starting, setStarting] = useState(false);

  if (!user) return null;

  // ── Active trial: show countdown ──
  if (user.trial_active && user.trial_ends_at) {
    const endsAt = new Date(user.trial_ends_at);
    const now = new Date();
    if (endsAt <= now) return null;

    const msRemaining = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const isUrgent = daysRemaining <= 3;

    return (
      <div
        className={`w-full px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 ${
          isUrgent
            ? "bg-gradient-to-r from-amber-600/90 to-red-600/80 text-white"
            : "bg-gradient-to-r from-emerald-600/80 to-teal-600/80 text-white"
        }`}
      >
        {isUrgent ? (
          <Clock className="w-4 h-4 shrink-0" />
        ) : (
          <Zap className="w-4 h-4 shrink-0" />
        )}
        <span>
          Signal trial: <strong>{daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</strong> remaining
        </span>
        <button
          onClick={() => navigate("/pricing")}
          className="ml-2 px-3 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold"
          type="button"
        >
          Subscribe Now
        </button>
      </div>
    );
  }

  // ── Eligible for trial: observer who hasn't used it yet ──
  const isObserver = !user.tier || user.tier === "observer";
  if (isObserver && !user.trial_used) {
    const handleStart = async () => {
      if (!token || starting) return;
      setStarting(true);
      try {
        const res = await apiFetch("/api/trial/start", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to start trial");
        toast.success("Signal trial activated! Enjoy 14 days of full access.");
        // Update local user state to reflect trial
        setUser({ ...user, trial_active: true, trial_ends_at: data.trial_ends_at, trial_used: true, tier: "signal" as any });
      } catch (err: any) {
        toast.error(err?.message || "Could not start trial");
      } finally {
        setStarting(false);
      }
    };

    return (
      <div className="w-full px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600/80 to-indigo-600/80 text-white">
        <Sparkles className="w-4 h-4 shrink-0" />
        <span>Try Signal free for 14 days — unlock triple-check AI, citation testing, and more</span>
        <button
          onClick={handleStart}
          disabled={starting}
          className="ml-2 px-3 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold disabled:opacity-50"
          type="button"
        >
          {starting ? "Starting…" : "Start Free Trial"}
        </button>
      </div>
    );
  }

  return null;
}
