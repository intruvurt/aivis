<<<<<<< HEAD
import { Request, Response, NextFunction } from 'express';
import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier, type TierLimits } from '../types.ts';
=======
import type { Request, Response, NextFunction } from "express";
import {
  TIER_LIMITS,
  uiTierFromCanonical,
  type CanonicalTier,
  type LegacyTier,
  type TierLimits,
} from "../src/types";
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3

/**
 * Feature keys that can be gated by tier
 */
export type GatedFeature =
<<<<<<< HEAD
  | 'exports'           // PDF export
  | 'forceRefresh'      // Force cache refresh
  | 'apiAccess'         // API/webhook access
  | 'whiteLabel'        // White-label exports
  | 'scheduledRescans'  // Scheduled automatic rescans
  | 'reportHistory'     // Access to past reports
  | 'shareableLink'     // Generate shareable report links
  | 'multiPageCrawl'    // Crawl more than 1 page
  | 'competitorDiff';   // Competitor comparison
=======
  | "exports"
  | "forceRefresh"
  | "apiAccess"
  | "whiteLabel"
  | "scheduledRescans"
  | "reportHistory"
  | "shareableLink"
  | "multiPageCrawl"
  | "competitorDiff";
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3

/**
 * Map feature keys to TierLimits properties
 */
const featureToLimitKey: Record<GatedFeature, keyof TierLimits> = {
<<<<<<< HEAD
  exports: 'hasExports',
  forceRefresh: 'hasForceRefresh',
  apiAccess: 'hasApiAccess',
  whiteLabel: 'hasWhiteLabel',
  scheduledRescans: 'hasScheduledRescans',
  reportHistory: 'hasReportHistory',
  shareableLink: 'hasShareableLink',
  multiPageCrawl: 'pagesPerScan',
  competitorDiff: 'competitors',
};

=======
  exports: "hasExports",
  forceRefresh: "hasForceRefresh",
  apiAccess: "hasApiAccess",
  whiteLabel: "hasWhiteLabel",
  scheduledRescans: "hasScheduledRescans",
  reportHistory: "hasReportHistory",
  shareableLink: "hasShareableLink",
  multiPageCrawl: "pagesPerScan",
  competitorDiff: "competitors",
};

function normalizeTier(tier: string | undefined): keyof typeof TIER_LIMITS {
  // Accept canonical or legacy strings, collapse to UI tier key
  const safeTier = (tier?.trim() || "observer") as CanonicalTier | LegacyTier;
  const normalized = uiTierFromCanonical(safeTier);
  // If uiTierFromCanonical ever returns something not in TIER_LIMITS, fallback
  return (normalized in TIER_LIMITS ? normalized : "observer") as keyof typeof TIER_LIMITS;
}

>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
/**
 * Check if a user's tier has access to a specific feature
 */
export function hasFeatureAccess(tier: string, feature: GatedFeature): boolean {
<<<<<<< HEAD
  const normalizedTier = uiTierFromCanonical(tier as CanonicalTier | LegacyTier);
  const limits = TIER_LIMITS[normalizedTier];

=======
  const normalizedTier = normalizeTier(tier);
  const limits = TIER_LIMITS[normalizedTier];
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
  if (!limits) return false;

  const limitKey = featureToLimitKey[feature];
  const value = limits[limitKey];

<<<<<<< HEAD
  // Boolean features
  if (typeof value === 'boolean') {
    return value;
  }

  // Numeric features (e.g., pagesPerScan > 1 means multiPageCrawl is enabled)
  if (typeof value === 'number') {
    if (feature === 'multiPageCrawl') return value > 1;
    if (feature === 'competitorDiff') return value > 0;
=======
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (feature === "multiPageCrawl") return value > 1;
    if (feature === "competitorDiff") return value > 0;
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
    return value > 0;
  }

  return false;
}

/**
 * Get all features available for a tier
 */
export function getTierFeatures(tier: string): Record<GatedFeature, boolean> {
  const features: GatedFeature[] = [
<<<<<<< HEAD
    'exports',
    'forceRefresh',
    'apiAccess',
    'whiteLabel',
    'scheduledRescans',
    'reportHistory',
    'shareableLink',
    'multiPageCrawl',
    'competitorDiff',
  ];

  return features.reduce((acc, feature) => {
    acc[feature] = hasFeatureAccess(tier, feature);
    return acc;
  }, {} as Record<GatedFeature, boolean>);
=======
    "exports",
    "forceRefresh",
    "apiAccess",
    "whiteLabel",
    "scheduledRescans",
    "reportHistory",
    "shareableLink",
    "multiPageCrawl",
    "competitorDiff",
  ];

  const out = {} as Record<GatedFeature, boolean>;
  for (const feature of features) out[feature] = hasFeatureAccess(tier, feature);
  return out;
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
}

/**
 * Get full entitlements for a tier (features + limits)
 */
export function getTierEntitlements(tier: string) {
<<<<<<< HEAD
  const normalizedTier = uiTierFromCanonical(tier as CanonicalTier | LegacyTier);
  const limits = TIER_LIMITS[normalizedTier];
  const features = getTierFeatures(tier);

  return {
    tier: normalizedTier,
    features,
    limits: {
      scansPerMonth: limits.scansPerMonth,
      pagesPerScan: limits.pagesPerScan,
      competitors: limits.competitors,
      cacheDays: limits.cacheDays,
=======
  const normalizedTier = normalizeTier(tier);
  const limits = TIER_LIMITS[normalizedTier];

  // limits should exist, but keep safe defaults so nothing throws
  const safeLimits = limits ?? TIER_LIMITS.observer;

  return {
    tier: normalizedTier,
    features: getTierFeatures(tier),
    limits: {
      scansPerMonth: safeLimits.scansPerMonth,
      pagesPerScan: safeLimits.pagesPerScan,
      competitors: safeLimits.competitors,
      cacheDays: safeLimits.cacheDays,
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
    },
  };
}

/**
 * Middleware factory to require a specific feature
 * Usage: app.post('/api/export', authRequired, requireFeature('exports'), handler)
 */
export function requireFeature(feature: GatedFeature) {
  return (req: Request, res: Response, next: NextFunction) => {
<<<<<<< HEAD
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const tier = user.tier || 'observer';

    if (!hasFeatureAccess(tier, feature)) {
      const normalizedTier = uiTierFromCanonical(tier as CanonicalTier | LegacyTier);

      // Determine which tier unlocks this feature
      const upgradeTier = getUpgradeTierForFeature(feature);

      return res.status(403).json({
        error: `This feature requires an upgraded plan`,
        code: 'FEATURE_LOCKED',
        feature,
        currentTier: normalizedTier,
        requiredTier: upgradeTier,
        upgradeUrl: '/pricing',
      });
    }

    next();
=======
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const tier = req.user.tier || ("observer" as any);

    if (!hasFeatureAccess(String(tier), feature)) {
      const currentTier = normalizeTier(String(tier));
      const requiredTier = getUpgradeTierForFeature(feature);

      return res.status(403).json({
        error: "This feature requires an upgraded plan",
        code: "FEATURE_LOCKED",
        feature,
        currentTier,
        requiredTier,
        upgradeUrl: "/pricing",
      });
    }

    return next();
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
  };
}

/**
<<<<<<< HEAD
 * Middleware to check numeric limits (e.g., pages per scan)
 * Usage: app.post('/api/crawl', authRequired, checkLimit('pagesPerScan', req.body.urls.length), handler)
 */
export function checkLimit(limitKey: 'pagesPerScan' | 'competitors', requestedValue: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const tier = user.tier || 'observer';
    const normalizedTier = uiTierFromCanonical(tier as CanonicalTier | LegacyTier);
    const limits = TIER_LIMITS[normalizedTier];
=======
 * Middleware to check numeric limits (e.g., pages per scan, competitors)
 * Usage: app.post('/api/crawl', authRequired, checkLimit('pagesPerScan', req.body.urls.length), handler)
 */
export function checkLimit(limitKey: "pagesPerScan" | "competitors", requestedValue: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const normalizedTier = normalizeTier(String(req.user.tier || "observer"));
    const limits = TIER_LIMITS[normalizedTier] ?? TIER_LIMITS.observer;
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
    const maxAllowed = limits[limitKey];

    if (requestedValue > maxAllowed) {
      return res.status(403).json({
<<<<<<< HEAD
        error: `Your plan allows up to ${maxAllowed} ${limitKey === 'pagesPerScan' ? 'pages per scan' : 'competitor comparisons'}`,
        code: 'LIMIT_EXCEEDED',
=======
        error:
          limitKey === "pagesPerScan"
            ? `Your plan allows up to ${maxAllowed} pages per scan`
            : `Your plan allows up to ${maxAllowed} competitor comparisons`,
        code: "LIMIT_EXCEEDED",
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
        limit: limitKey,
        requested: requestedValue,
        allowed: maxAllowed,
        currentTier: normalizedTier,
<<<<<<< HEAD
        upgradeUrl: '/pricing',
      });
    }

    next();
  };
}

/**
 * Determine which tier unlocks a specific feature
 */
function getUpgradeTierForFeature(feature: GatedFeature): string {
  // Check alignment tier first
  if (hasFeatureAccess('alignment', feature)) {
    return 'alignment';
  }
  // Otherwise it requires signal
  return 'signal';
=======
        upgradeUrl: "/pricing",
      });
    }

    return next();
  };
}

function getUpgradeTierForFeature(feature: GatedFeature): string {
  if (hasFeatureAccess("alignment", feature)) return "alignment";
  return "signal";
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
}

/**
 * Attach entitlements to request for use in handlers
 */
export function attachEntitlements(req: Request, _res: Response, next: NextFunction) {
<<<<<<< HEAD
  const user = (req as any).user;

  if (user) {
    const tier = user.tier || 'observer';
    (req as any).entitlements = getTierEntitlements(tier);
  }

  next();
=======
  if (req.user) {
    req.entitlements = getTierEntitlements(String(req.user.tier || "observer"));
  }
  return next();
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
}
