export const TIER_LIMITS = {
  Free: {
    scansPerMonth: 5,
    allowExport: false,
    allowShare: false,
    allowCompetitor: false,
    allowAPI: false,
    allowWebhook: false,
    allowWhiteLabel: false,
    allowBulk: false,
    allowRescan: false,
    teamSeats: 0,
    maxProjects: 1
  },
  "Jump Start": {
    scansPerMonth: 50,
    allowExport: true,
    allowShare: true,
    allowCompetitor: true,
    allowAPI: false,
    allowWebhook: false,
    allowWhiteLabel: false,
    allowBulk: false,
    allowRescan: false,
    teamSeats: 3,
    maxProjects: 3
  },
  Pro: {
    scansPerMonth: 200,
    allowExport: true,
    allowShare: true,
    allowCompetitor: true,
    allowAPI: true,
    allowWebhook: true,
    allowWhiteLabel: false,
    allowBulk: false,
    allowRescan: true,
    teamSeats: 10,
    maxProjects: 5
  },
  Business: {
    scansPerMonth: 2000,
    allowExport: true,
    allowShare: true,
    allowCompetitor: true,
    allowAPI: true,
    allowWebhook: true,
    allowWhiteLabel: true,
    allowBulk: true,
    allowRescan: true,
    teamSeats: 10,
    maxProjects: 25
  },
  Enterprise: {
    scansPerMonth: -1, // unlimited
    allowExport: true,
    allowShare: true,
    allowCompetitor: true,
    allowAPI: true,
    allowWebhook: true,
    allowWhiteLabel: true,
    allowBulk: true,
    allowRescan: true,
    teamSeats: -1, // unlimited
    maxProjects: -1 // unlimited
  },
  Agency: {
    scansPerMonth: -1, // unlimited
    allowExport: true,
    allowShare: true,
    allowCompetitor: true,
    allowAPI: true,
    allowWebhook: true,
    allowWhiteLabel: true,
    allowBulk: true,
    allowRescan: true,
    teamSeats: -1, // unlimited
    maxProjects: -1 // unlimited
  }
};

export const getUserTierLimits = (tier) => {
  return TIER_LIMITS[tier] || TIER_LIMITS.Free;
};

export const checkUsageLimit = (user, action) => {
  const limits = getUserTierLimits(user.tier);
  
  // Reset monthly count if needed
  const now = new Date();
  const lastReset = new Date(user.lastResetDate);
  const monthsSinceReset = (now.getFullYear() - lastReset.getFullYear()) * 12 + 
                           (now.getMonth() - lastReset.getMonth());
  
  if (monthsSinceReset >= 1) {
    return { allowed: true, resetNeeded: true };
  }
  
  // Check scan limit
  if (action === "scan") {
    if (limits.scansPerMonth === -1) {
      return { allowed: true, resetNeeded: false };
    }
    if (user.usageCount >= limits.scansPerMonth) {
      return { 
        allowed: false, 
        resetNeeded: false,
        error: `Monthly scan limit reached. Upgrade to scan more.`
      };
    }
  }
  
  return { allowed: true, resetNeeded: false };
};
