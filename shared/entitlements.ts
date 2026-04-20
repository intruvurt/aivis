import type { CanonicalTier, LegacyTier } from "./types.js";
import { uiTierFromCanonical } from "./types.js";

export type Plan = CanonicalTier;
export type AccessLevel = boolean | "limited";

export type EntitlementKey =
  | "fullEvidence"
  | "competitorTracking"
  | "citationTracking"
  | "history"
  | "alerts"
  | "fixVerification";

export type PlanEntitlements = {
  auditsTotal?: number;
  auditsMonthly?: number;
  pagesPerAudit?: number;
  remediation?: boolean;
  verification?: boolean;
  fullEvidence: AccessLevel;
  competitorTracking: AccessLevel;
  citationTracking: AccessLevel;
  history: AccessLevel;
  alerts: AccessLevel;
  fixVerification: AccessLevel;
};

export const ENTITLEMENTS: Readonly<Record<Plan, PlanEntitlements>> = {
  observer: {
    auditsTotal: 3,
    pagesPerAudit: 3,
    fullEvidence: false,
    competitorTracking: false,
    citationTracking: false,
    history: false,
    alerts: false,
    fixVerification: false,
  },
  starter: {
    auditsMonthly: 15,
    pagesPerAudit: 3,
    fullEvidence: true,
    competitorTracking: false,
    citationTracking: false,
    history: "limited",
    alerts: false,
    fixVerification: false,
  },
  alignment: {
    auditsMonthly: 60,
    pagesPerAudit: 5,
    fullEvidence: true,
    competitorTracking: "limited",
    citationTracking: false,
    history: "limited",
    alerts: false,
    fixVerification: false,
  },
  signal: {
    auditsMonthly: 110,
    pagesPerAudit: 25,
    fullEvidence: true,
    competitorTracking: true,
    citationTracking: true,
    history: true,
    alerts: true,
    fixVerification: true,
  },
  scorefix: {
    remediation: true,
    verification: true,
    fullEvidence: true,
    competitorTracking: true,
    citationTracking: true,
    history: true,
    alerts: true,
    fixVerification: true,
  },
  agency: {
    auditsMonthly: 500,
    pagesPerAudit: 50,
    fullEvidence: true,
    competitorTracking: true,
    citationTracking: true,
    history: true,
    alerts: true,
    fixVerification: true,
  },
};

export function normalizePlan(plan: CanonicalTier | LegacyTier): Plan {
  return uiTierFromCanonical(plan);
}

export function canAccess(feature: EntitlementKey, plan: CanonicalTier | LegacyTier): AccessLevel {
  const normalized = normalizePlan(plan);
  return ENTITLEMENTS[normalized][feature];
}
