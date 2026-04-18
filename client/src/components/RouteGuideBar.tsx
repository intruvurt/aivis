import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { formatTierGateLabel, type RouteGuide } from "../config/routeIntelligence";

interface RouteGuideBarProps {
  guide: RouteGuide;
}

export default function RouteGuideBar({ guide }: RouteGuideBarProps) {
  return (
    <section className="route-guide-shell" aria-label="Page context and next step">
      <div className="route-guide-topline">
        <span className="route-guide-chip">{guide.section}</span>
        {guide.minTier ? <span className="route-guide-tier">{formatTierGateLabel(guide.minTier)}</span> : null}
      </div>

      <div className="route-guide-main">
        <div className="route-guide-copy">
          <h2 className="route-guide-title">{guide.title}</h2>
          <p className="route-guide-summary">{guide.summary}</p>
          <p className="route-guide-next">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            <span>{guide.nextStep}</span>
          </p>
          {guide.instructions?.length ? (
            <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-white/65">
              {guide.instructions.slice(0, 3).map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300/70" aria-hidden="true" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {guide.primaryActionPath && guide.primaryActionLabel ? (
          <Link to={guide.primaryActionPath} className="route-guide-action">
            <span>{guide.primaryActionLabel}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
