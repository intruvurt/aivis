import "express";

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      name?: string;
      role?: string;
      tier?: string;
      is_verified?: boolean;
      password_hash?: string | null;
      isActive?: boolean;
      stripe_subscription_id?: string | null;
    }

    interface Request {
      user?: User;
      userId?: string;
      tier?: string;
      monthlyLimit?: number;
      currentUsage?: number;
      usingPackCredits?: boolean;
      entitlements?: Record<string, any>;
      workspace?: {
        id: string;
        name: string;
        role: 'owner' | 'admin' | 'member' | 'viewer';
        isDefault: boolean;
      };
      organization?: {
        id: string;
        name: string;
      };
      usageSkipIncrement?: boolean;
      usageGateCacheHit?: boolean;
      preloadedAnalysisCache?: Record<string, any> | null;
    }
  }
}

export {};
