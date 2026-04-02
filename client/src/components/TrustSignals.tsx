import React from "react";
import {
  Shield, Lock, Eye, Server, CheckCircle2, Building2,
  FileCheck, Scale, Clock, Users, Globe, Zap
} from "lucide-react";
import { MARKETING_CLAIMS } from "../constants/marketingClaims";
import { TIER_LIMITS } from "@shared/types";
import type { FeatureStatusData } from "../hooks/useFeatureStatus";

// ─── Trust Badges Bar ───────────────────────────────────────────────────────

export function TrustBadgesBar() {
  const badges = [
    { icon: Lock,         label: "256-bit SSL Encrypted",     color: "text-white/80 dark:text-white/80" },
    { icon: Shield,       label: "Security-First Practices",  color: "text-white/80 dark:text-white/80" },
    { icon: Server,       label: "Enterprise SLA Available",   color: "text-white/80 dark:text-white/80" },
    { icon: Eye,          label: "No Data Resale",             color: "text-white/85 dark:text-white/85" },
    { icon: FileCheck,    label: "U.S. Business (EIN on file)", color: "text-white/80 dark:text-white/80" },
  ];

  return (
    <div className="py-4 border-y border-white/10 bg-charcoal/20 dark:bg-charcoal/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {badges.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-xs text-white/60 dark:text-white/60">
              <b.icon className={`w-4 h-4 ${b.color}`} />
              <span className="font-medium">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Trust Section (for Dashboard landing) ──────────────────────────────────

interface TrustSectionProps {
  featureStatus?: FeatureStatusData | null;
}

export function TrustSection({ featureStatus = null }: TrustSectionProps) {
  const planPagesPerScan = Number(featureStatus?.capabilities?.pagesPerScan ?? 0);
  const hasExports = Boolean(featureStatus?.capabilities?.hasExports);
  const hasReportHistory = Boolean(featureStatus?.capabilities?.hasReportHistory);

  const maxPagesPerScan = Math.max(...Object.values(TIER_LIMITS).map((limits) => limits.pagesPerScan));
  const pagesPerScanLabel = planPagesPerScan > 0
    ? `${planPagesPerScan} pages/scan in your plan`
    : `Up to ${maxPagesPerScan} pages/scan by tier`;
  const exportLabel = featureStatus
    ? hasExports
      ? "Exports enabled in your plan"
      : "Exports available on Alignment+"
    : "Exports on Alignment+";
  const historyLabel = featureStatus
    ? hasReportHistory
      ? "Audit history enabled in your plan"
      : "Audit history by plan"
    : "Audit history by plan";

  const trustPillars = [
    {
      icon: Shield,
      title: "Triple Check Methodology",
      description: `${MARKETING_CLAIMS.modelAllocation} Canonical source: ${MARKETING_CLAIMS.modelTruthUrl}.`,
      color: "from-white/28/20 to-white/15/20",
      iconColor: "text-white/85 dark:text-white/85",
    },
    {
      icon: Lock,
      title: "Your Data Stays Yours",
      description: "We never sell, share, or use your website data for model training. All audits are encrypted in transit and at rest. Full GDPR & GA FBPA compliance.",
      color: "from-white/25/20 to-white/15/20",
      iconColor: "text-white/80 dark:text-white/80",
    },
    {
      icon: Scale,
      title: "Transparent Scoring",
      description: "Every score is grounded in real scraped data, never hallucinated. We show you exactly what our AI found and how it scored each dimension.",
      color: "from-white/22/20 to-white/14/20",
      iconColor: "text-white/80 dark:text-white/80",
    },
    {
      icon: FileCheck,
      title: "Audit Trail Persistence",
      description: "Every audit is timestamped and stored. Access your full history anytime. Export reports for client deliverables or internal documentation.",
      color: "from-white/30/20 to-white/18/20",
      iconColor: "text-white/80 dark:text-white/80",
    },
  ];

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full card-charcoal/20 text-white/80 dark:text-white/80 text-xs font-semibold mb-4 tracking-wide uppercase">
            <Shield className="w-3.5 h-3.5" />
            Built on Trust
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white dark:text-white mb-4">
            Premium-grade auditing you can trust
          </h2>
          <p className="text-white/60 dark:text-white/55 max-w-2xl mx-auto">
            We're a U.S.-based business (EIN on file). Our methodology is transparent, our data handling is policy driven, and our results are verifiable.
          </p>
        </div>

        {/* Trust cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trustPillars.map((pillar) => (
            <div key={pillar.title} className="relative group">
              <div className={`absolute -inset-0.5 bg-gradient-to-r ${pillar.color} rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500`} />
              <div className="relative bg-charcoal dark:bg-charcoal-deep border border-white/14 dark:border-white/10 rounded-2xl p-6 hover:border-white/12 dark:hover:border-white/10 transition-all">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${pillar.color}`}>
                    <pillar.icon className={`w-5 h-5 ${pillar.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white dark:text-white mb-2">{pillar.title}</h3>
                    <p className="text-sm text-white/60 dark:text-white/55 leading-relaxed">{pillar.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Compliance bar */}
        <div className="mt-10 p-6 rounded-2xl bg-charcoal-light dark:bg-charcoal border border-white/14 dark:border-white/10">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-white/85 dark:text-white/85" />
              <div>
                <h4 className="text-sm font-semibold text-white dark:text-white">Business Transparency</h4>
                <p className="text-xs text-white/60 dark:text-white/60">U.S.-based operation · EIN on file</p>
              </div>
            </div>
            <div className="flex-1 h-px bg-charcoal-light dark:bg-charcoal-light hidden md:block" />
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/60 dark:text-white/55">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-white/80" /> Transparent audit methodology</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-white/80" /> Data Protection Policy</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-white/80" /> Terms of Service</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-white/80" /> PII Minimization Practices</span>
            </div>
          </div>
        </div>

        {/* Agency CTA */}
        <div className="mt-10 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-white/28/10 via-white/14 to-white/14/10 border border-white/14 dark:border-white/10">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-white/85 dark:text-white/85" />
              <div className="text-left">
                <p className="text-sm font-semibold text-white dark:text-white">Built for Agency Scale</p>
                <p className="text-xs text-white/60 dark:text-white/55">Plan-aware capabilities surfaced from live tier status</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/60 dark:text-white/55">
              <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-white/80" /> Fast deep audits</span>
              <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-white/80" /> {pagesPerScanLabel}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-white/80" /> {exportLabel}</span>
              <span className="flex items-center gap-1"><FileCheck className="w-3.5 h-3.5 text-white/80" /> {historyLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TrustSection;
