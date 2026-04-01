import React from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Zap } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

/**
 * Global banner displayed when the user is on an active Signal trial.
 * Shows days remaining and a CTA to subscribe.
 */
export default function TrialBanner() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  if (!user?.trial_active || !user?.trial_ends_at) return null;

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
