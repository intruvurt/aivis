/**
 * PageHeader – shared title/explainer banner used across all tool and utility pages.
 *
 * Usage:
 *   <PageHeader
 *     icon={<FlaskConical className="h-5 w-5 text-orange-400" />}
 *     title="Reverse Engineer"
 *     subtitle="Deconstruct AI answers, generate page blueprints, compare models, and simulate visibility lift."
 *     onBack={() => navigate("/")}
 *   />
 */
import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  /** Any icon element – typically a Lucide icon with color class */
  icon: React.ReactNode;
  /** Primary page title */
  title: string;
  /** One-line explainer shown below the title */
  subtitle: string;
  /** Optional: override back-navigation target (default: "/") */
  backTo?: string;
  /** Optional: completely override back behaviour */
  onBack?: () => void;
  /** Optional: right-side slot for extra controls (tier badge, refresh button, etc.) */
  actions?: React.ReactNode;
  /** Optional extra className on the outer <header> */
  className?: string;
}

export default function PageHeader({
  icon,
  title,
  subtitle,
  backTo = "/",
  onBack,
  actions,
  className = "",
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(backTo);
    }
  };

  return (
    <header
      className={`border-b border-white/10 bg-charcoal-deep backdrop-blur-xl ${className}`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <button
          onClick={handleBack}
          className="rounded-full p-2 transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:outline-none"
          type="button"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-white/55" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl brand-title">
            {icon}
            {title}
          </h1>
          <p className="text-sm text-white/60 leading-relaxed">{subtitle}</p>
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
