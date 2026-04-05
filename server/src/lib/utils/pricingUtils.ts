// AI Visibility Intelligence Audits: tier and usage guard utilities

export const TierName = ['Observer', 'Alignment', 'Signal', 'scorefix'] as const;

export const TIER_LIMITS = {
  Observer: {
    scansPerMonth: 10,
    allowExport: false,
    allowShare: true,
    allowCompetitor: false,
    allowAPI: false,
    allowWebhook: false,
    allowWhiteLabel: false,
    allowBulk: false,
    allowRescan: false,
    teamSeats: 1,
    maxProjects: 1,
  },
  Alignment: {
    scansPerMonth: 60,
    allowExport: true,
    allowShare: true,
    allowCompetitor: true,
    allowAPI: false,
    allowWebhook: false,
    allowWhiteLabel: false,
    allowBulk: false,
    allowRescan: false,
    teamSeats: 1,
    maxProjects: 3,
  },
  Signal: {
    scansPerMonth: 110,
    allowExport: true,
    allowShare: true,
    allowCompetitor: true,
    allowAPI: true,
    allowWebhook: true,
    allowWhiteLabel: true,
    allowBulk: false,
    allowRescan: true,
    teamSeats: 5,
    maxProjects: 8,
  },
  scorefix: {
    scansPerMonth: 250,
    allowExport: true,
    allowShare: true,
    allowCompetitor: true,
    allowAPI: true,
    allowWebhook: true,
    allowWhiteLabel: true,
    allowBulk: true,
    allowRescan: true,
    teamSeats: 10,
    maxProjects: 20,
  },
} as const;

type TierLimitKey = keyof typeof TIER_LIMITS;

type FeatureActionKey =
  | 'export'
  | 'share'
  | 'competitor'
  | 'api'
  | 'webhook'
  | 'whitelabel'
  | 'bulk'
  | 'rescan';

const featureActions: Record<FeatureActionKey, keyof (typeof TIER_LIMITS)['Observer']> = {
  export: 'allowExport',
  share: 'allowShare',
  competitor: 'allowCompetitor',
  api: 'allowAPI',
  webhook: 'allowWebhook',
  whitelabel: 'allowWhiteLabel',
  bulk: 'allowBulk',
  rescan: 'allowRescan',
};

export function getUserTierLimits(tier: string | undefined | null) {
  const normalized = String(tier || '').trim().toLowerCase();
  const aliasMap: Record<string, TierLimitKey> = {
    observer: 'Observer',
    free: 'Observer',
    alignment: 'Alignment',
    core: 'Alignment',
    signal: 'Signal',
    premium: 'Signal',
    scorefix: 'scorefix',
    elite: 'scorefix',
    enterprise: 'scorefix',
    pro: 'Signal',
  };

  const direct = (tier && tier in TIER_LIMITS ? tier : undefined) as TierLimitKey | undefined;
  const resolved = direct || aliasMap[normalized] || 'Observer';
  return TIER_LIMITS[resolved];
}

function toValidDate(d: unknown): Date | null {
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  if (typeof d === 'string' || typeof d === 'number') {
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function monthsBetween(a: Date, b: Date): number {
  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
}

export function checkUsageLimit(
  user: { tier: string | null | undefined; lastResetDate?: unknown; usageCount?: unknown },
  action: string
): { allowed: boolean; resetNeeded: boolean; error?: string; limit?: number; used?: number } {
  const limits = getUserTierLimits(user.tier);
  const now = new Date();
  const lastReset = toValidDate(user.lastResetDate);

  if (!lastReset || monthsBetween(now, lastReset) >= 1) {
    return { allowed: true, resetNeeded: true };
  }

  if (action !== 'scan') {
    const key = featureActions[action as FeatureActionKey];
    if (!key || !limits[key]) {
      return { allowed: false, resetNeeded: false, error: `Your tier does not allow ${action}.` };
    }
    return { allowed: true, resetNeeded: false };
  }

  const used = typeof user.usageCount === 'number' && Number.isFinite(user.usageCount)
    ? user.usageCount
    : 0;

  if (used >= limits.scansPerMonth) {
    return {
      allowed: false,
      resetNeeded: false,
      limit: limits.scansPerMonth,
      used,
      error: 'Monthly scan limit reached.',
    };
  }

  return { allowed: true, resetNeeded: false, limit: limits.scansPerMonth, used };
}
