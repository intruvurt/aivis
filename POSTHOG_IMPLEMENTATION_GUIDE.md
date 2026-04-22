# PostHog Integration Implementation Guide

## Quick Start

### 1. Environment Setup

Add to your `.env` file:

```bash
# PostHog Configuration
POSTHOG_KEY=your_posthog_api_key
POSTHOG_API_ENDPOINT=https://app.posthog.com
POSTHOG_PROJECT_ID=your_project_id
```

### 2. Initialize Client

In your server startup code or initialization module:

```typescript
import { initializePostHogClient } from "./services/postHogClient.js";

// Initialize after server boots
const posthogClient = initializePostHogClient(
  process.env.VITE_API_URL || "http://localhost:3001",
  process.env.API_TOKEN || "",
);

console.log("[PostHog] Client initialized");
```

### 3. Feature Flag Usage

#### Basic Flag Evaluation

```typescript
import { getPostHogClient } from "./services/postHogClient.js";

async function handleUserRequest(userId: string) {
  const client = getPostHogClient();

  // Check if new dashboard is enabled
  const hasNewDashboard = await client.flags.evaluate(userId, "new_dashboard");

  if (hasNewDashboard) {
    // Use new dashboard UI
  } else {
    // Use legacy dashboard
  }
}
```

#### Batch Flag Evaluation (Recommended)

```typescript
async function loadUserFeatures(userId: string) {
  const client = getPostHogClient();

  // Load all feature gates at once
  const flags = await client.flags.evaluateBatch(userId, [
    "new_dashboard",
    "advanced_analytics",
    "beta_api",
    "experimental_scoring",
  ]);

  return {
    showNewDashboard: flags["new_dashboard"],
    enableAdvancedAnalytics: flags["advanced_analytics"],
    allowBetaAPI: flags["beta_api"],
    experimentalScoring: flags["experimental_scoring"],
  };
}
```

#### Convenience Method

```typescript
// Direct check
const isEnabled = await client.flags.isEnabled(userId, "feature_name");
```

### 4. User Segmentation

#### Update User Properties

```typescript
async function onUserSignup(userId: string, email: string, tier: string) {
  const client = getPostHogClient();

  // Update person properties for segmentation
  await client.flags.updatePersonProperties(userId, {
    email,
    plan: tier,
    signup_date: new Date().toISOString(),
    initial_tier: tier,
  });
}

async function onTierUpgrade(userId: string, newTier: string) {
  const client = getPostHogClient();

  await client.flags.updatePersonProperties(userId, {
    plan: newTier,
    last_upgrade: new Date().toISOString(),
  });
}

async function onScanCompleted(userId: string) {
  const client = getPostHogClient();

  // Fetch current properties
  const props = await client.flags.getPersonProperties(userId);

  // Update engagement metrics
  await client.flags.updatePersonProperties(userId, {
    last_scan: new Date().toISOString(),
    total_scans: (props.total_scans || 0) + 1,
    usage_level: (props.total_scans || 0) > 10 ? "high" : "medium",
  });
}
```

#### Get User Tier Features

```typescript
async function ensureFeatureAccess(userId: string, requiredFeature: string) {
  const client = getPostHogClient();

  const tierFeatures = await client.flags.getTierFeatures(userId);

  if (!tierFeatures.includes(requiredFeature)) {
    throw new Error(`Feature '${requiredFeature}' not available for this user`);
  }
}
```

### 5. Analytics Integration

#### Track Events

On the backend, use PostHog's native client to track events:

```typescript
import PostHog from "posthog-node";

const posthog = new PostHog(process.env.POSTHOG_KEY, {
  apiHost: process.env.POSTHOG_API_ENDPOINT,
});

// Track scan completion
function trackScanCompleted(userId: string, scanData: any) {
  posthog.capture({
    distinctId: userId,
    event: "scan_completed",
    properties: {
      scan_type: scanData.type,
      entity_count: scanData.entities.length,
      duration_ms: scanData.duration,
      tier: scanData.userTier,
      success: true,
    },
  });
}

// Update user properties after scan
function updateScanMetrics(userId: string, tier: string) {
  posthog.people.set(userId, {
    plan: tier,
    last_scan: new Date().toISOString(),
  });
}
```

#### Query Product Metrics

```typescript
async function getDashboardMetrics() {
  const client = getPostHogClient();

  // Get core KPIs
  const metrics = await client.analytics.getProductMetrics(30);

  return {
    scansThisMonth: metrics.scansCompleted,
    citationsViewed: metrics.citationsViewed,
    activeUsers: metrics.uniqueUsers,
  };
}
```

#### Get Engagement Breakdown

```typescript
async function getEngagementReport(days = 7) {
  const client = getPostHogClient();

  const engagement = await client.analytics.getEngagementMetrics(days);

  return {
    scansStarted: engagement.scan_started,
    scansCompleted: engagement.scan_completed,
    citationsViewed: engagement.citation_viewed,
    manualCitationsAdded: engagement.manual_citation_added,
  };
}
```

#### Analyze User Retention

```typescript
async function getRetentionData() {
  const client = getPostHogClient();

  const retention = await client.analytics.getRetention(30);

  // retention[0] = day 0 cohort (100% by definition)
  // retention[1] = day 1 returns (should be ~70%+)
  // retention[7] = day 7 returns (should be ~40%+)

  const dayOneRetention = retention[1]?.return_rate || 0;
  const week1Retention = retention[7]?.return_rate || 0;

  if (dayOneRetention < 0.7) {
    console.warn("[Retention] Day 1 retention below threshold");
  }

  return { dayOneRetention, week1Retention };
}
```

### 6. Middleware Integration

#### Add Analytics Middleware

```typescript
import { getPostHogClient } from "./services/postHogClient.js";
import { Request, Response, NextFunction } from "express";

export async function analyticsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.user?.id;
  if (!userId) {
    return next();
  }

  // Load user flags early
  const client = getPostHogClient();
  const flags = await client.flags.evaluateBatch(userId, [
    "new_dashboard",
    "advanced_analytics",
    "beta_api",
  ]);

  // Attach to request
  req.featureFlags = flags;

  // Track page view
  res.on("finish", () => {
    if (res.statusCode < 400) {
      // Optional: track successful requests
    }
  });

  next();
}

// Use in Express app
app.use(analyticsMiddleware);
```

#### Feature Access Gate

```typescript
export async function requireFeature(requiredFeature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const client = getPostHogClient();
    const tierFeatures = await client.flags.getTierFeatures(userId);

    if (!tierFeatures.includes(requiredFeature)) {
      return res.status(403).json({
        error: "Feature not available for your plan",
        required: requiredFeature,
      });
    }

    next();
  };
}

// Usage in routes
app.use(
  "/api/advanced-analytics",
  requireFeature("advanced_analytics"),
  analyticsRoutes,
);
```

## Integration Patterns

### Pattern 1: Conditional UI Rendering

```typescript
// In a route handler
app.get("/api/dashboard/config", requireAuth, async (req, res) => {
  const client = getPostHogClient();

  const config = await client.flags.evaluateBatch(req.user.id, [
    "new_dashboard",
    "dark_mode",
    "experimental_features",
  ]);

  res.json({
    ui: {
      useDashboardV2: config["new_dashboard"],
      darkModeAvailable: config["dark_mode"],
      experimentalFeaturesVisible: config["experimental_features"],
    },
  });
});
```

### Pattern 2: Gradual Rollout

```typescript
// In PostHog UI:
// 1. Create flag: "feature_rollout_v2"
// 2. Set to 10% initially
// 3. Monitor metrics
// 4. Increase to 50%, then 100%

// In code: just use the flag normally
const enabled = await client.flags.evaluate(userId, "feature_rollout_v2");
```

### Pattern 3: Tier-Based Access

```typescript
async function checkTierAccess(userId: string, minTier: string) {
  const TIER_HIERARCHY = {
    observer: 0,
    starter: 1,
    alignment: 2,
    signal: 3,
    agency: 4,
  };

  const props = await client.flags.getPersonProperties(userId);
  const userTier = props.plan || "observer";

  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[minTier];
}

// Usage
if (await checkTierAccess(userId, "alignment")) {
  // Grant access to alignment+ features
}
```

### Pattern 4: A/B Testing

```typescript
// In PostHog: create flag "ui_variant_experiment"
// Set targeting to 50% -> "variant_a", 50% -> "variant_b"

async function selectUIVariant(userId: string) {
  const variantFlag = await client.flags.evaluate(userId, "ui_variant_a");

  return variantFlag ? "variant_a" : "variant_b";
}
```

## Monitoring & Debugging

### Check Feature Flag State

```typescript
// Debug endpoint (admin only)
app.get("/api/admin/debug/user/:userId", requireAdmin, async (req, res) => {
  const client = getPostHogClient();
  const { userId } = req.params;

  const properties = await client.flags.getPersonProperties(userId);
  const allFlags = {
    new_dashboard: await client.flags.evaluate(userId, "new_dashboard"),
    advanced_analytics: await client.flags.evaluate(
      userId,
      "advanced_analytics",
    ),
    // ... all flags
  };

  res.json({
    userId,
    properties,
    flags: allFlags,
  });
});
```

### Monitor Analytics

```typescript
// Daily health check
async function healthCheck() {
  const client = getPostHogClient();

  const metrics = await client.analytics.getProductMetrics(1);

  console.log("[Health] Scans today:", metrics.scansCompleted);
  console.log("[Health] Active users (24h):", metrics.uniqueUsers);

  if (metrics.scansCompleted === 0) {
    console.warn("[Health] No scans recorded!");
  }
}

// Run daily via scheduler
setInterval(healthCheck, 24 * 60 * 60 * 1000);
```

## Performance Tuning

### Cache Configuration

```typescript
// In initialization
const client = new FeatureFlagService(
  apiBase,
  token,
  300_000, // Cache flags for 5 minutes
);

// Batch requests to reduce API calls
const flags = await client.flags.evaluateBatch(userId, flagList);
```

### Query Optimization

```typescript
// ❌ Bad: Makes 3 separate requests
const scans = await client.analytics.countEvent("scan_completed", 7);
const citations = await client.analytics.countEvent("citation_viewed", 7);
const visitors = await client.analytics.getVisitorMetrics(7);

// ✅ Good: Use product metrics endpoint
const metrics = await client.analytics.getProductMetrics(7);
// Returns all 3 metrics in one request
```

## Error Handling

```typescript
import { PostHogAnalyticsError } from "./services/postHogClient.js";

async function safeFeatureFlagCheck(userId: string, flag: string) {
  try {
    return await client.flags.evaluate(userId, flag);
  } catch (err) {
    if (err instanceof PostHogAnalyticsError) {
      if (err.code === "SERVICE_UNAVAILABLE") {
        // Fall back to defaults
        console.warn("[PostHog] Service unavailable, using defaults");
        return false;
      }

      if (err.code === "NOT_FOUND") {
        // User doesn't exist yet
        console.warn("[PostHog] User not found:", userId);
        return false;
      }
    }

    throw err;
  }
}
```

## Testing

```typescript
// Mock PostHog client for tests
import { vi } from "vitest";

const mockClient = {
  flags: {
    evaluate: vi.fn().mockResolvedValue(true),
    evaluateBatch: vi.fn().mockResolvedValue({
      feature_a: true,
      feature_b: false,
    }),
  },
  analytics: {
    getProductMetrics: vi.fn().mockResolvedValue({
      scansCompleted: 100,
      citationsViewed: 500,
      uniqueUsers: 50,
    }),
  },
};

// Use in tests
vi.mock("./services/postHogClient", () => ({
  getPostHogClient: () => mockClient,
}));
```

## References

- [PostHog Analytics Routes Documentation](./POSTHOG_ANALYTICS_INTEGRATION.md)
- [TypeScript Types](./server/src/types/analyticsTypes.ts)
- [Client Implementation](./server/src/services/postHogClient.ts)
- [Feature Flags Routes](./server/src/routes/featureFlagsRoutes.ts)
- [Analytics Routes](./server/src/routes/analyticsRoutes.ts)
