// client/src/components/ThreatIntelBanner.tsx
import React, { useState } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  Info,
} from "lucide-react";
import type { UrlRiskAssessment } from "@shared/types";

interface ThreatIntelBannerProps {
  data: UrlRiskAssessment;
}

const RISK_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    label: string;
    description: string;
  }
> = {
  low: {
    icon: ShieldCheck,
    color: "text-green-400",
    bg: "bg-green-500/8",
    border: "border-green-500/20",
    label: "Low Risk",
    description: "No known threats detected. Standard security posture.",
  },
  medium: {
    icon: Shield,
    color: "text-yellow-400",
    bg: "bg-yellow-500/8",
    border: "border-yellow-500/20",
    label: "Medium Risk",
    description: "Some heuristic flags detected. Review recommended.",
  },
  high: {
    icon: ShieldAlert,
    color: "text-orange-400",
    bg: "bg-orange-500/8",
    border: "border-orange-500/20",
    label: "High Risk",
    description: "Threat indicators found. Exercise caution.",
  },
  critical: {
    icon: ShieldX,
    color: "text-red-400",
    bg: "bg-red-500/8",
    border: "border-red-500/20",
    label: "Critical Risk",
    description: "Active threats detected across multiple providers.",
  },
};

const ThreatIntelBanner: React.FC<ThreatIntelBannerProps> = ({ data }) => {
  const [expanded, setExpanded] = useState(false);
  const config = RISK_CONFIG[data.risk_level] || RISK_CONFIG.low;
  const RiskIcon = config.icon;
  const hasFlags = data.flags.length > 0;
  const providers = data.providers;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden`}>
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className={`p-2 rounded-lg bg-charcoal border border-white/10`}>
          <RiskIcon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">
              Threat Intelligence
            </h3>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}
            >
              {config.label}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            {data.hostname} &bull; Score: {data.risk_score}/100 &bull;{" "}
            {data.flags.length} flag{data.flags.length !== 1 ? "s" : ""}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/50" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/50" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Description */}
          <div className="flex items-start gap-2 bg-charcoal rounded-lg p-3 border border-white/10">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/60" />
            <p className="text-sm text-white/70 leading-relaxed">
              {config.description}
            </p>
          </div>

          {/* Flags */}
          {hasFlags && (
            <div>
              <h4 className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Detected Flags
              </h4>
              <ul className="space-y-1.5">
                {data.flags.map((flag, i) => (
                  <li
                    key={i}
                    className="text-sm text-white/75 flex items-start gap-2"
                  >
                    <span className="mt-0.5 flex-shrink-0 text-white/40">•</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Provider details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* URLhaus */}
            <div className="bg-charcoal rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                  URLhaus
                </span>
                {providers.urlhaus?.listed ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">
                    LISTED
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold">
                    CLEAN
                  </span>
                )}
              </div>
              {providers.urlhaus?.threat && (
                <p className="text-xs text-white/60">
                  Threat: <span className="text-white/80">{providers.urlhaus.threat}</span>
                </p>
              )}
              {providers.urlhaus?.tags && providers.urlhaus.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {providers.urlhaus.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {providers.urlhaus?.error && (
                <p className="text-[10px] text-white/40 mt-1">{providers.urlhaus.error}</p>
              )}
            </div>

            {/* Google Safe Browsing */}
            <div className="bg-charcoal rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                  Safe Browsing
                </span>
                {providers.google_safe_browsing?.skipped ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 font-semibold">
                    SKIPPED
                  </span>
                ) : providers.google_safe_browsing?.listed ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">
                    FLAGGED
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold">
                    CLEAN
                  </span>
                )}
              </div>
              {providers.google_safe_browsing?.matches &&
                providers.google_safe_browsing.matches.length > 0 && (
                  <div className="space-y-1">
                    {providers.google_safe_browsing.matches.map((m, i) => (
                      <p key={i} className="text-xs text-white/60">
                        {m.threatType}{m.platformType ? ` (${m.platformType})` : ""}
                      </p>
                    ))}
                  </div>
                )}
              {providers.google_safe_browsing?.skipped && (
                <p className="text-[10px] text-white/40 mt-1">
                  {providers.google_safe_browsing.skipped}
                </p>
              )}
              {providers.google_safe_browsing?.error && (
                <p className="text-[10px] text-white/40 mt-1">
                  {providers.google_safe_browsing.error}
                </p>
              )}
            </div>
          </div>

          {/* Advisory note */}
          <div className="flex items-start gap-2 text-[11px] text-white/40">
            <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              Threat intel checks are advisory and should be paired with endpoint/network
              security tooling. Sources: abuse.ch URLhaus, Google Safe Browsing API v4.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreatIntelBanner;
