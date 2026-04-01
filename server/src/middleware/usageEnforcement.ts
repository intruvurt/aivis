import type { Request, Response, NextFunction } from 'express';
import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';

type FeatureName = 'export' | 'share' | 'competitor' | 'api' | 'webhook' | 'whiteLabel' | 'bulk' | 'rescan';

function hasFeatureEnabled(tier: CanonicalTier, feature: FeatureName): boolean {
  const limits = TIER_LIMITS[tier];
  switch (feature) {
    case 'export':
      return limits.hasExports;
    case 'competitor':
      return limits.competitors > 0;
    case 'api':
    case 'webhook':
      return limits.hasApiAccess;
    case 'whiteLabel':
      return limits.hasWhiteLabel;
    case 'rescan':
      return limits.hasScheduledRescans;
    case 'share':
      return limits.hasShareableLink;
    case 'bulk':
      return limits.pagesPerScan > 1;
    default:
      return false;
  }
}

export const enforceFeature = (feature: FeatureName) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required', statusCode: 401 });
    }

    const tier = uiTierFromCanonical((user.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!hasFeatureEnabled(tier, feature)) {
      return res.status(403).json({
        success: false,
        error: `Feature not available at ${tier} tier. Upgrade to access.`,
        statusCode: 403,
      });
    }

    return next();
  };
};

export default enforceFeature;
