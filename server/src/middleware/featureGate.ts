import { Request, Response, NextFunction } from 'express';
import {
  TIER_LIMITS,
  meetsMinimumTier,
  uiTierFromCanonical,
  type CanonicalTier,
  type LegacyTier,
  type TierLimits,
} from '../../../shared/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tier: CanonicalTier;
        [key: string]: any;
      };
    }
  }
}

/**
 * Feature keys that can be gated by tier
 */
export type GatedFeature =
  | 'exports'           // PDF export
  | 'forceRefresh'      // Force cache refresh
  | 'apiAccess'         // API/webhook access
  | 'whiteLabel'        // White-label exports
  | 'scheduledRescans'  // Scheduled automatic rescans
  | 'reportHistory'     // Access to past reports
  | 'shareableLink'     // Generate shareable report links
  | 'multiPageCrawl'    // Crawl more than 1 page
  | 'competitorDiff'    // Competitor comparison
  | 'documentUpload'    // Uploaded document/code audits (Alignment+)
  | 'reverseEngineer'   // Reverse engineer tools (Alignment+)
  | 'authorityCheck'    // BRA authority checker (Alignment+)
  | 'citationTesting'   // Citation testing workflows (Signal+)
  // Tier-exclusive features (only available on specific tiers, not minimum-tier gating)
  | 'mentionDigests'    // Alignment-exclusive: weekly brand mention email digests
  | 'nicheDiscovery'    // Alignment-exclusive: niche URL discovery engine
  | 'tripleCheck'       // Signal-exclusive: triple-check AI pipeline (3 models)
  | 'alertIntegrations' // Signal-exclusive: Slack + Discord alert connections
  | 'automationWorkflows' // Signal-exclusive: Zapier/automation workflow connections
  | 'priorityQueue'     // Signal-exclusive: priority analysis queue
  | 'autoPR'            // ScoreFix-exclusive: automated GitHub PR generation via MCP
  | 'batchRemediation'  // ScoreFix-exclusive: batch remediation across multiple URLs
  | 'evidenceLinkedPRs'; // ScoreFix-exclusive: evidence-linked PR commits

/**
 * Map feature keys to TierLimits properties
 */
const featureToLimitKey: Partial<Record<GatedFeature, keyof TierLimits>> = {
  exports: 'hasExports',
  forceRefresh: 'hasForceRefresh',
  apiAccess: 'hasApiAccess',
  whiteLabel: 'hasWhiteLabel',
  scheduledRescans: 'hasScheduledRescans',
  reportHistory: 'hasReportHistory',
  shareableLink: 'hasShareableLink',
  multiPageCrawl: 'pagesPerScan',
  competitorDiff: 'competitors',
  mentionDigests: 'hasMentionDigests',
  nicheDiscovery: 'hasNicheDiscovery',
  tripleCheck: 'hasTripleCheck',
  alertIntegrations: 'hasAlertIntegrations',
  automationWorkflows: 'hasAutomationWorkflows',
  priorityQueue: 'hasPriorityQueue',
  autoPR: 'hasAutoPR',
  batchRemediation: 'hasBatchRemediation',
  evidenceLinkedPRs: 'hasEvidenceLinkedPRs',
};

/**
 * Check if a user's tier has access to a specific feature
 */
export function hasFeatureAccess(tier: string, feature: GatedFeature): boolean {
  const normalizedTier = uiTierFromCanonical(tier as CanonicalTier | LegacyTier);
  const tierForMatch = normalizedTier as CanonicalTier | LegacyTier;
  if (feature === 'citationTesting') {
    return meetsMinimumTier(tierForMatch, 'signal');
  }

  if (feature === 'documentUpload' || feature === 'reverseEngineer' || feature === 'authorityCheck') {
    return meetsMinimumTier(tierForMatch, 'alignment');
  }

  const limits = TIER_LIMITS[normalizedTier];

  if (!limits) return false;

  const limitKey = featureToLimitKey[feature];
  if (!limitKey) return false;
  const value = limits[limitKey];

  // Boolean features
  if (typeof value === 'boolean') {
    return value;
  }

  // Numeric features (e.g., pagesPerScan > 1 means multiPageCrawl is enabled)
  if (typeof value === 'number') {
    if (feature === 'multiPageCrawl') return value > 1;
    if (feature === 'competitorDiff') return value > 0;
    return value > 0;
  }

  return false;
}

/**
 * Get all features available for a tier
 */
export function getTierFeatures(tier: string): Record<GatedFeature, boolean> {
  const features: GatedFeature[] = [
    'exports',
    'forceRefresh',
    'apiAccess',
    'whiteLabel',
    'scheduledRescans',
    'reportHistory',
    'shareableLink',
    'multiPageCrawl',
    'competitorDiff',
    'documentUpload',
    'reverseEngineer',
    'authorityCheck',
    'citationTesting',
    'mentionDigests',
    'nicheDiscovery',
    'tripleCheck',
    'alertIntegrations',
    'automationWorkflows',
    'priorityQueue',
    'autoPR',
    'batchRemediation',
    'evidenceLinkedPRs',
  ];

  return features.reduce((acc, feature) => {
    acc[feature] = hasFeatureAccess(tier, feature);
    return acc;
  }, {} as Record<GatedFeature, boolean>);
}

/**
 * Get full entitlements for a tier (features + limits)
 */
export function getTierEntitlements(tier: string) {
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
    },
  };
}

/**
 * Middleware factory to require a specific feature
 * Usage: app.post('/api/export', authRequired, requireFeature('exports'), handler)
 */
export function requireFeature(feature: GatedFeature) {
  return (req: Request, res: Response, next: NextFunction) => {
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
  };
}

/**
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
    const maxAllowed = limits[limitKey];

    if (requestedValue > maxAllowed) {
      return res.status(403).json({
        error: `Your plan allows up to ${maxAllowed} ${limitKey === 'pagesPerScan' ? 'pages per scan' : 'competitor comparisons'}`,
        code: 'LIMIT_EXCEEDED',
        limit: limitKey,
        requested: requestedValue,
        allowed: maxAllowed,
        currentTier: normalizedTier,
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
}

/**
 * Attach entitlements to request for use in handlers
 */
export function attachEntitlements(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (user) {
    const tier = user.tier || 'observer';
    (req as any).entitlements = getTierEntitlements(tier);
  }

  next();
}

/**
 * Enforce a specific tier requirement
 */
export function enforceFeatureGate(requiredTier: CanonicalTier) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userTier: CanonicalTier = req.user.tier;

    // Use canonical tier comparison, never string matching
    const tierHierarchy: CanonicalTier[] = ['observer', 'alignment', 'signal', 'scorefix'];
    const userTierIndex = tierHierarchy.indexOf(userTier);
    const requiredTierIndex = tierHierarchy.indexOf(requiredTier);

    if (userTierIndex < requiredTierIndex) {
      return res.status(403).json({
        error: 'Feature not available for your plan',
        requiredTier,
        currentTier: userTier,
      });
    }

    next();
  };
}
