import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, X, ArrowRight, UserCog, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import type { CompetitorHint } from "@shared/types";

interface Props {
  hint: CompetitorHint;
  onDismiss: () => void;
}

export default function CompetitorHintBanner({ hint, onDismiss }: Props) {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // ── No profile website → nudge to set one ──────────────────────────────
  if (!hint.profile_complete) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-500/[0.08] via-transparent to-amber-500/[0.04] px-4 py-3.5 flex items-start gap-3 mb-4">
        <UserCog className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-100">
            Add your website to unlock auto-competitor detection
          </p>
          <p className="mt-1 text-xs text-white/55">
            Set your website URL in your profile so we can automatically detect when you audit a potential competitor and offer to track them.
          </p>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/20"
          >
            Go to Settings
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <button type="button" onClick={onDismiss} className="text-white/30 hover:text-white/60 transition flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Already tracked → skip ──────────────────────────────────────────────
  if (hint.already_tracked || !hint.is_potential_competitor) return null;

  // ── Successfully added ──────────────────────────────────────────────────
  if (added) {
    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/[0.08] via-transparent to-emerald-500/[0.04] px-4 py-3.5 flex items-center gap-3 mb-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-300 flex-shrink-0" />
        <p className="text-sm text-emerald-100">
          <span className="font-medium">{hint.analyzed_domain}</span> added to your
          {" "}
          <Link to="/competitors" className="underline underline-offset-2 hover:text-emerald-200">competitor tracking</Link>.
        </p>
        <button type="button" onClick={onDismiss} className="ml-auto text-white/30 hover:text-white/60 transition flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Potential competitor detected — offer to add or ignore ──────────────
  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/api/competitors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url: `https://${hint.analyzed_domain}`,
          nickname: hint.analyzed_domain,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok || res.status === 409) {
        setAdded(true);
        toast.success(`${hint.analyzed_domain} added to competitor tracking`);
      } else {
        toast.error(body?.error || "Failed to add competitor");
      }
    } catch {
      toast.error("Failed to add competitor");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/[0.08] via-transparent to-violet-500/[0.04] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      <Users className="h-5 w-5 text-cyan-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cyan-100">
          <span className="font-semibold">{hint.analyzed_domain}</span> looks like a potential competitor
        </p>
        {hint.match_reasons.length > 0 && (
          <p className="mt-0.5 text-xs text-white/50">
            {hint.match_reasons.join(" · ")}
          </p>
        )}
        {hint.shared_signals.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {hint.shared_signals.map((s) => (
              <span key={s} className="rounded-md border border-cyan-400/15 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200/80">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/25 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
          Track Competitor
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/45 transition hover:text-white/65"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
