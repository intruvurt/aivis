# PostHog Setup Guide for AiVIS

## Overview

AiVIS uses PostHog to capture user behavior events and feed them into the deterministic scoring pipeline. This guide configures minimal-scope analytics access (read-only, no platform control).

## 1. Railway Configuration

Add these environment variables to your Railway project:

```bash
POSTHOG_KEY=phx_YOUR_PERSONAL_API_KEY
POSTHOG_PROJECT_ID=YOUR_PROJECT_ID
POSTHOG_API_ENDPOINT=https://app.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=YOUR_PUBLIC_KEY  (for browser tracking)
```

**How to find on Railway:**

- Go to https://railway.app → select `aivis` project
- Click "Variables" tab
- Add the three/four vars above (see steps 2-3 for getting the values)
- `POSTHOG_KEY` = Backend server key (private, read-write)
- `NEXT_PUBLIC_POSTHOG_KEY` = Frontend public key (read-only for events)

## 2. Create PostHog Personal API Key (Backend)

**Minimal scopes for backend server key:**

1. Go to https://app.posthog.com → **Settings → Personal API Keys**
2. Click **"Create key"**
3. **Name:** `aivis-backend-analytics`
4. **Scopes** (enable ONLY these):
   - ✅ `Query` (required - read analytics)
   - ✅ `Event definition` (required - manage event schema)
   - ✅ `Feature flag` (required - evaluate flags server-side)
   - ✅ `Person` (required - track user identity & properties)
   - ✅ `Cohort` (required - build user cohorts)

5. **Do NOT enable:**
   - ❌ Organization / Organization member (dangerous — can modify org)
   - ❌ Project (can change ingestion settings)
   - ❌ Integration / Plugin / Webhook (unnecessary)

6. **Copy the key** (starts with `phx_`)

## 3. Create PostHog Public Key (Browser)

For frontend event capture, use a **Project API Key** instead:

1. Go to https://app.posthog.com → **Project settings → API Keys**
2. Copy the **Project API Key** (starts with `phx_`)
3. This is used as `NEXT_PUBLIC_POSTHOG_KEY` in browser
4. Public keys are **read-only** for event creation (safe to expose)

## 4. Set Environment Variables on Railway

```bash
POSTHOG_KEY="phx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Backend (private)
NEXT_PUBLIC_POSTHOG_KEY="phx_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"  # Frontend (public)
POSTHOG_PROJECT_ID="<your project ID>"
POSTHOG_API_ENDPOINT="https://app.posthog.com"  # default; EU: https://eu.posthog.com
```

- **Project ID:** Find in PostHog → Settings → Project settings → at the top

## 4. Start Capturing Events

### Frontend (Automatic Browser Tracking)

AiVIS frontend captures events automatically when PostHog SDK is initialized:

```typescript
// In main client init (src/main.tsx or App.tsx)
import posthog from "posthog-js";

// Initialize with PUBLIC key
posthog.init(import.meta.env.VITE_POSTHOG_PUBLIC_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_API_HOST || "https://app.posthog.com",
  // Identify current user after auth
  loaded: (ph) => {
    const user = getCurrentUser(); // from auth store
    if (user?.id) {
      ph.identify(user.id, {
        email: user.email,
        tier: user.tier,
        organization: user.organizationName,
      });
    }
  },
});
```

### Use Event Capture Utilities

```typescript
import {
  captureScanStarted,
  captureScanCompleted,
  captureNodeClicked,
  captureFixApplied,
  captureAnalysisRerun,
} from "@/lib/analyticsCapture";

// Examples:
captureScanStarted("https://example.com", false, {
  source: "landing_page", // cohort tracking
});

captureScanCompleted({
  url: "https://example.com",
  score: 75,
  durationMs: 4200,
  citationsFound: 3,
  conflictCount: 1,
});

captureNodeClicked({
  nodeId: "conflict_123",
  nodeType: "conflict",
  confidence: 0.92,
  actionTriggered: true,
  userId: currentUser.id, // person property
});
```

### Backend Analytics Gateway

Backend queries analytics data and applies feature flags:

```bash
# Feature flag evaluation
curl -X POST https://api.aivis.biz/api/analytics/flags/evaluate \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"key":"new_ui_enabled","userId":"user_123"}'

# Get person record
curl https://api.aivis.biz/api/analytics/person/{userId} \
  -H "Authorization: Bearer $JWT"

# Query cohorts
curl https://api.aivis.biz/api/analytics/cohorts \
  -H "Authorization: Bearer $JWT"

# Query events
GET /api/analytics/events?event=scan_completed&timeRangeMs=86400000
POST /api/analytics/query { queryType: 'aggregate', ... }
GET /api/analytics/health
```

## 5. Feature Flags (Server-Side & Client-Side)

### Define Flags in PostHog

1. Go to https://app.posthog.com → **Feature flags**
2. Create a new flag:
   - **Name:** `new_ui_enabled`
   - **Type:** Boolean (on/off)
   - **Rollout:** 50% of users (or specific users)
   - **Payload:** (optional) Extra data

### Evaluate Server-Side (Backend)

```typescript
// server/src/services/featureFlagService.ts
import { evaluateFeatureFlag } from "posthog-node";

export async function isFeatureFlagEnabled(
  userId: string,
  flagKey: string,
  distinctId?: string,
): Promise<boolean> {
  const client = getPostHogClient(); // your PH client
  const enabled = await client.featureFlags.isFeatureEnabled(
    flagKey,
    distinctId || userId,
  );
  return enabled === true;
}
```

### Evaluate Client-Side (Frontend)

```typescript
// client/src/hooks/useFeatureFlag.ts
import { usePostHog } from 'posthog-js/react';

export function useFeatureFlag(flagKey: string): boolean {
  const posthog = usePostHog();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (posthog) {
      const value = posthog.getFeatureFlag(flagKey);
      setEnabled(value === true);
    }
  }, [posthog, flagKey]);

  return enabled;
}

// Usage in component
export function MyComponent() {
  const newUIEnabled = useFeatureFlag('new_ui_enabled');

  return (
    <div>
      {newUIEnabled ? <NewUI /> : <LegacyUI />}
    </div>
  );
}
```

## 6. Person Analytics

### Identify Users

```typescript
import posthog from "posthog-js";

// After login/signup
posthog.identify(user.id, {
  email: user.email,
  tier: user.tier,
  organizationName: user.organizationName,
  createdAt: user.createdAt,
  industry: user.industry, // custom property
  companySize: user.employeeCount,
});
```

### Track User Properties Over Time

```typescript
// Update user when they upgrade
posthog.people.set({
  tier: "signal",
  lastUpgradeDate: new Date().toISOString(),
  subscriptionStatus: "active",
});

// Track user actions
posthog.capture("scan_completed", {
  url: "https://example.com",
  score: 75,
  $set: {
    lastScanDate: new Date().toISOString(),
    totalScansThisMonth: 15,
  },
});
```

### Query Person Records (Backend)

```typescript
// Get all person properties for a user
const person = await fetch(
  `${POSTHOG_API_ENDPOINT}/api/projects/${POSTHOG_PROJECT_ID}/persons/${userId}/`,
  { headers: { Authorization: `Bearer ${POSTHOG_KEY}` } },
);

// List properties
person.properties.forEach((prop) => {
  console.log(`${prop.key}: ${prop.value}`);
});
```

## 7. Cohort Analysis

### Create Cohorts in PostHog

1. Go to https://app.posthog.com → **Cohorts**
2. Create a new cohort:
   - **Name:** `Power Users`
   - **Criteria:** `tier == "signal" AND totalScans > 50`
   - **Save as property:** `is_power_user`

### Use Cohorts in Events

```typescript
// When captured event, PostHog automatically includes cohort membership
posthog.capture("scan_completed", {
  url: "https://example.com",
  score: 75,
  // PostHog will automatically resolve $cohort_membership
});

// Access cohort membership
const cohorts = posthog.getPersonProperties().$cohort_ids;
const isPowerUser = cohorts.includes("power_users_cohort_id");
```

### Query Cohorts (Backend)

```typescript
// Fetch all cohorts
const cohorts = await fetch(
  `${POSTHOG_API_ENDPOINT}/api/projects/${POSTHOG_PROJECT_ID}/cohorts/`,
  { headers: { Authorization: `Bearer ${POSTHOG_KEY}` } },
);

// Filter users in a cohort
const cohortMembers = await fetch(
  `${POSTHOG_API_ENDPOINT}/api/projects/${POSTHOG_PROJECT_ID}/cohorts/{cohortId}/persons/`,
  { headers: { Authorization: `Bearer ${POSTHOG_KEY}` } },
);
```

## 6. Verify Setup

### Check from Terminal

```bash
# After deployment to Railway, or locally:
npm --prefix server run verify:determinism  # confirms PostHog config

# Test backend event capture
curl -X POST https://api.aivis.biz/api/analytics/events \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"event":"scan_started","properties":{"url":"https://example.com"}}'
```

### Check in PostHog Dashboard

1. Go to https://app.posthog.com → **Analytics → Events**
2. Watch for events:
   - `scan_started`
   - `scan_completed`
   - `node_clicked`
   - `fix_applied`
   - `analysis_rerun`
3. If events appear → ✅ capture is working

4. Go to **People** → See users tracked
5. Go to **Cohorts** → See user groupings
6. Go to **Feature flags** → See flag evaluations

## 7. Architecture

```
┌─ Frontend ──────────────────┐
│ posthog.identify()          │  (with custom properties)
│ posthog.capture()           │  (all 6 core events)
│ posthog.getFeatureFlag()    │  (client-side flag eval)
│ ↓                           │
│ PostHog Cloud               │  (events + persons + cohorts)
└─────────────────────────────┘
          ↓
┌─ AiVIS Backend ─────────────┐
│ /api/analytics/query        │  (read-only gateway)
│ /api/analytics/person       │  (person properties)
│ /api/analytics/flags        │  (feature flag eval)
│ /api/analytics/cohorts      │  (cohort membership)
│ ↓                           │
│ Scoring Pipeline            │  (feed signals into model)
└─────────────────────────────┘
          ↓
┌─ Deterministic State ───────┐
│ analysis_runs.delta         │  (measure rerun impact)
│ citations.run_id            │  (trace behavior→score)
│ persons.tier                │  (track tier progression)
└─────────────────────────────┘
```

## 8. Troubleshooting

### Events not appearing

1. Check frontend PostHog initialization
2. Check browser console for `window.posthog`
3. Verify `NEXT_PUBLIC_POSTHOG_KEY` is correct
4. Check PostHog → Settings → API access for IP whitelisting

### Feature flags not working

1. Check `POSTHOG_KEY` has `Feature flag` scope
2. Verify flag rollout is enabled (not 0% users)
3. Test with: `curl https://app.posthog.com/api/feature_flags/...`
4. Check `userId` matches person identify call

### Person properties not showing

1. Verify `posthog.identify()` called with user ID
2. Check properties are JSON-serializable
3. Verify `POSTHOG_KEY` has `Person` scope
4. Wait up to 1 minute for property sync

### Cohort membership not updating

1. Verify cohort criteria are correct
2. Cohorts update every 15-60 minutes
3. Check cohort member count > 0 in PostHog
4. Verify user properties match criteria

## 9. Next: Wire Analytics into Scoring

Once events flow, connect them to the deterministic scoring pipeline:

1. Use `/api/analytics/query` to fetch behavior aggregates
2. Use `/api/analytics/cohorts` to segment users
3. Use `/api/analytics/flags` to A/B test scoring models
4. Connect person tier progression to score signals
5. Feed cohort membership to recommendation engine

See: `server/src/config/posthogEvents.ts` for event schema and signals mapping.
