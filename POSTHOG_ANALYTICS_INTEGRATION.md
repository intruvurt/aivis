# PostHog Analytics & Feature Flags Integration

## Overview

AiVIS now includes comprehensive PostHog integration for real-time analytics, feature flag management, and user segmentation. This system provides:

- **Real-time feature flag evaluation** with server-side authority
- **Person property management** for tracking user behavior
- **Cohort-based segmentation** for targeted rollouts
- **Product metrics dashboards** with retention and engagement data
- **Custom HogQL queries** for advanced analytics

## Architecture

### Backend Routes

All PostHog integrations are exposed through two main route modules:

1. **Feature Flags Routes** (`/api/feature-flags/`)
   - Feature flag evaluation
   - Person property management
   - Cohort membership tracking

2. **Analytics Routes** (`/api/analytics/`)
   - Product metrics queries
   - Event counting and aggregation
   - Retention and engagement analysis
   - Custom HogQL query execution

### Configuration

Set the following environment variables:

```bash
# PostHog API Configuration
POSTHOG_KEY=your_posthog_api_key
POSTHOG_API_ENDPOINT=https://app.posthog.com  # or your self-hosted instance
POSTHOG_PROJECT_ID=your_project_id
```

## API Reference

### Feature Flag Evaluation

#### POST `/api/feature-flags/flags/evaluate`

Evaluate a single feature flag for a user (server-side authority).

**Request:**

```json
{
  "flagKey": "new_dashboard",
  "userId": "user_123"
}
```

**Response:**

```json
{
  "success": true,
  "flagKey": "new_dashboard",
  "userId": "user_123",
  "enabled": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Use Cases:**

- Determine if a user has access to a feature
- Control feature rollouts per user
- A/B test different UI variants

---

#### POST `/api/feature-flags/flags/evaluate-batch`

Evaluate multiple feature flags for a user simultaneously.

**Request:**

```json
{
  "flagKeys": ["new_dashboard", "advanced_analytics", "beta_api"],
  "userId": "user_123"
}
```

**Response:**

```json
{
  "success": true,
  "userId": "user_123",
  "flags": [
    { "key": "new_dashboard", "enabled": true },
    { "key": "advanced_analytics", "enabled": false },
    { "key": "beta_api", "enabled": true }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Use Cases:**

- Load all feature gates for a user in one request
- Optimize frontend by determining all available features upfront

---

### Person Properties

#### GET `/api/feature-flags/person/:userId`

Retrieve stored person properties and cohort membership.

**Response:**

```json
{
  "success": true,
  "userId": "user_123",
  "properties": {
    "name": "John Doe",
    "email": "john@example.com",
    "plan": "alignment",
    "signup_date": "2023-06-15",
    "last_scan": "2024-01-15"
  },
  "cohorts": [123, 456],
  "createdAt": "2023-06-15T00:00:00Z"
}
```

---

#### PATCH `/api/feature-flags/person/:userId`

Update person properties for segmentation and targeting.

**Request:**

```json
{
  "properties": {
    "plan": "signal",
    "last_scan": "2024-01-15T10:30:00Z",
    "usage_level": "high",
    "churn_risk": false
  }
}
```

**Response:**

```json
{
  "success": true,
  "userId": "user_123",
  "updated": ["plan", "last_scan", "usage_level", "churn_risk"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Property Guidelines:**

- `plan` - Canonical tier: observer, starter, alignment, signal, agency
- `usage_level` - low, medium, high
- `last_scan` - ISO 8601 timestamp of last analysis run
- `churn_risk` - boolean indicating retention concern
- `feature_engagement` - JSON tracking feature usage

---

### Cohort Management

#### GET `/api/feature-flags/cohorts`

List all available cohorts.

**Response:**

```json
{
  "success": true,
  "cohorts": [
    {
      "id": 123,
      "name": "Power Users",
      "description": "Users with >10 scans in past 30 days",
      "count": 245,
      "createdAt": "2023-12-01T00:00:00Z"
    },
    {
      "id": 456,
      "name": "At-Risk Users",
      "description": "No activity in 14 days",
      "count": 89,
      "createdAt": "2023-11-15T00:00:00Z"
    }
  ]
}
```

---

#### GET `/api/feature-flags/cohorts/:userId/membership`

Check which cohorts a user belongs to.

**Response:**

```json
{
  "success": true,
  "userId": "user_123",
  "cohortIds": [123, 456]
}
```

---

#### POST `/api/feature-flags/cohorts/stats`

Get statistics for specific cohorts.

**Request:**

```json
{
  "cohortNames": ["Power Users", "At-Risk Users", "Trial Users"]
}
```

**Response:**

```json
{
  "success": true,
  "stats": [
    {
      "name": "Power Users",
      "found": true,
      "count": 245,
      "createdAt": "2023-12-01T00:00:00Z"
    },
    {
      "name": "At-Risk Users",
      "found": true,
      "count": 89,
      "createdAt": "2023-11-15T00:00:00Z"
    },
    {
      "name": "Trial Users",
      "found": false,
      "count": 0
    }
  ]
}
```

---

### Analytics Queries

#### GET `/api/analytics/health`

System health check endpoint.

**Response:**

```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### GET `/api/analytics/events/count`

Count events over a time range.

**Query Parameters:**

- `event` (required) - Event name to count
- `days` (optional, default: 7) - Number of days to look back

**Example:**

```
GET /api/analytics/events/count?event=scan_completed&days=30
```

**Response:**

```json
{
  "success": true,
  "event": "scan_completed",
  "count": 1245,
  "timeRange": {
    "days": 30,
    "startDate": "2023-12-16T10:30:00Z",
    "endDate": "2024-01-15T10:30:00Z"
  }
}
```

**Standard Events:**

- `scan_started` - Analysis initiated
- `scan_completed` - Analysis finished
- `citation_viewed` - Citation insight viewed
- `manual_citation_added` - User added citation manually
- `$pageview` - Page visit (PostHog built-in)

---

#### GET `/api/analytics/visitors`

Get unique visitor count and trends.

**Query Parameters:**

- `days` (optional, default: 7) - Number of days to analyze

**Response:**

```json
{
  "success": true,
  "uniqueVisitors": 567,
  "timeRange": {
    "days": 7,
    "startDate": "2024-01-08T10:30:00Z",
    "endDate": "2024-01-15T10:30:00Z"
  }
}
```

---

#### GET `/api/analytics/engagement`

Get key engagement metrics.

**Query Parameters:**

- `days` (optional, default: 7)

**Response:**

```json
{
  "success": true,
  "engagement": [
    { "event": "scan_started", "count": 450 },
    { "event": "scan_completed", "count": 420 },
    { "event": "citation_viewed", "count": 1200 },
    { "event": "manual_citation_added", "count": 45 }
  ],
  "timeRange": {
    "days": 7,
    "startDate": "2024-01-08T10:30:00Z",
    "endDate": "2024-01-15T10:30:00Z"
  }
}
```

---

#### GET `/api/analytics/retention`

Get user retention metrics.

**Query Parameters:**

- `days` (optional, default: 30)

**Response:**

```json
{
  "success": true,
  "retention": [
    {
      "interval": 0,
      "cohort_size": 180,
      "return_rate": 1.0
    },
    {
      "interval": 1,
      "cohort_size": 180,
      "return_rate": 0.72
    },
    {
      "interval": 7,
      "cohort_size": 180,
      "return_rate": 0.45
    }
  ],
  "timeRange": { "days": 30 }
}
```

---

#### GET `/api/analytics/product-metrics`

Dashboard view of core product metrics.

**Query Parameters:**

- `days` (optional, default: 30)

**Response:**

```json
{
  "success": true,
  "metrics": {
    "scansCompleted": 1245,
    "citationsViewed": 4890,
    "uniqueUsers": 567
  },
  "timeRange": {
    "days": 30,
    "startDate": "2023-12-16T10:30:00Z",
    "endDate": "2024-01-15T10:30:00Z"
  }
}
```

---

#### POST `/api/analytics/query`

Execute custom HogQL queries.

**Request:**

```json
{
  "query": "SELECT count(), event FROM events WHERE timestamp > now() - interval '7 days' GROUP BY event"
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    { "count()": 450, "event": "scan_started" },
    { "count()": 420, "event": "scan_completed" },
    { "count()": 1200, "event": "citation_viewed" }
  ],
  "query": "SELECT count(), event FROM events WHERE..."
}
```

**HogQL Resources:**

- [Official HogQL Documentation](https://posthog.com/docs/hogql)
- Common patterns:
  - Event aggregation by time
  - User cohort analysis
  - Funnel analysis
  - Property-based segmentation

---

## Integration Examples

### Frontend Feature Flag Integration

```typescript
// Evaluate a single flag on page load
async function checkFeatureAccess(userId: string, flagKey: string) {
  const response = await fetch("/api/feature-flags/flags/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ flagKey, userId }),
  });

  const data = await response.json();
  return data.enabled;
}

// Batch evaluate multiple flags
async function loadUserFeatures(userId: string) {
  const response = await fetch("/api/feature-flags/flags/evaluate-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      flagKeys: ["new_dashboard", "advanced_analytics", "beta_api"],
    }),
  });

  const data = await response.json();
  return data.flags.reduce((acc, f) => {
    acc[f.key] = f.enabled;
    return acc;
  }, {});
}
```

### Backend Event Tracking

```typescript
// Track events via PostHog in your services
import posthog from "posthog-node";

const posthogClient = new posthog.PostHog(process.env.POSTHOG_KEY);

// Track event
posthogClient.capture({
  distinctId: userId,
  event: "scan_completed",
  properties: {
    scan_type: "full",
    entity_count: 45,
    duration_ms: 5234,
    tier: "alignment",
  },
});

// Update person properties
posthogClient.people.set(userId, {
  plan: "signal",
  last_scan: new Date().toISOString(),
  total_scans: 123,
});
```

### Analytics Dashboard Integration

```typescript
// Fetch product metrics for admin dashboard
async function loadDashboardMetrics(days = 30) {
  const response = await fetch(`/api/analytics/product-metrics?days=${days}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const data = await response.json();
  return {
    scansCompleted: data.metrics.scansCompleted,
    citationsViewed: data.metrics.citationsViewed,
    activeUsers: data.metrics.uniqueUsers,
  };
}

// Get engagement breakdown
async function loadEngagementMetrics(days = 7) {
  const response = await fetch(`/api/analytics/engagement?days=${days}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const data = await response.json();
  return data.engagement.reduce((acc, e) => {
    acc[e.event] = e.count;
    return acc;
  }, {});
}
```

---

## Cohort Strategies

### Common Cohorts to Create

1. **Power Users**
   - Definition: >10 scans in past 30 days
   - Purpose: Beta feature access, priority support
   - Action: Feature flag rollout for advanced features

2. **At-Risk Users**
   - Definition: No activity in 14+ days
   - Purpose: Churn prevention, re-engagement campaigns
   - Action: Personalized onboarding, special offers

3. **Trial Users**
   - Definition: Signup date < 30 days, plan = "observer"
   - Purpose: Trial extension qualification
   - Action: Feature access expansion, upgrade prompts

4. **Premium Customers**
   - Definition: plan = "agency"
   - Purpose: Dedicated support, feature requests
   - Action: Premium features, white-label options

5. **High-Engagement Users**
   - Definition: Average session duration > 5 minutes
   - Purpose: Feature feedback, beta testing
   - Action: Early access to new features

---

## Best Practices

### Feature Flag Naming

```
// Tier-based features
flag_alignment_only
flag_signal_plus

// Experimentation
exp_new_dashboard_v1
exp_citation_redesign

// Gradual rollouts
rollout_advanced_analytics_10pct
rollout_advanced_analytics_50pct
rollout_advanced_analytics_100pct

// Deprecation
flag_legacy_api_deprecated
```

### Person Properties

```typescript
// Always include
{
  "email": "user@example.com",
  "plan": "alignment",
  "signup_date": "2023-06-15"
}

// Behavior properties
{
  "last_scan": "2024-01-15T10:30:00Z",
  "total_scans": 123,
  "usage_level": "high",
  "preferred_features": ["citations", "competitors"]
}

// Engagement scoring
{
  "engagement_score": 0.78,
  "churn_risk": false,
  "support_priority": "medium"
}
```

### Event Tracking

Track events at key system transitions:

```typescript
// Analysis lifecycle
"scan_started";
"scan_completed";
"scan_failed";

// User interactions
"citation_viewed";
"citation_filtered";
"manual_citation_added";
"export_generated";

// Account actions
"tier_upgraded";
"feature_accessed";
"integration_enabled";
```

---

## Monitoring & Alerts

### Key Metrics to Watch

- **Scan Completion Rate** = scan_completed / scan_started
- **Citation Engagement** = citation_viewed / scan_completed
- **User Retention** = returning_users / cohort_size
- **Feature Adoption** = distinct_users_using_feature / total_distinct_users

### Alert Thresholds

- Scan completion rate <0.8 (20% failure rate)
- Engagement drop >30% week-over-week
- Retention decline >15% cohort-over-cohort
- Feature flag errors >5% daily

---

## Troubleshooting

### Common Issues

**1. PostHog Client Not Available**

```
Error: [Features] PostHog client not available (feature flags disabled)
```

**Solution:** Verify POSTHOG_KEY is set and network connectivity to PostHog.

**2. Feature Flag Always Returns False**

```
Reason: Flag not created in PostHog dashboard or targeting rules not configured
```

**Solution:** Create flag in PostHog UI and set rollout percentage >0.

**3. Person Properties Not Persisting**

```
Reason: User ID mismatch or invalid properties format
```

**Solution:** Ensure userId is consistent across events and properties are valid JSON.

**4. Analytics Query Timeout**

```
Reason: Query too complex or date range too large
```

**Solution:** Simplify query, reduce date range, or use incremental queries.

---

## Performance Considerations

### Caching Strategy

```typescript
// Cache flag evaluations for 1 minute
const flagCache = new Map();
const CACHE_TTL_MS = 60_000;

async function getCachedFlag(userId: string, flagKey: string) {
  const cacheKey = `${userId}:${flagKey}`;
  const cached = flagCache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.value;
  }

  const value = await evaluateFlag(userId, flagKey);
  flagCache.set(cacheKey, { value, time: Date.now() });
  return value;
}
```

### Batch Operations

- Evaluate multiple flags in one request for 70% fewer API calls
- Batch event tracking with 500ms+ intervals
- Cache person properties for 5+ minutes between writes

---

## References

- [PostHog Docs](https://posthog.com/docs)
- [HogQL Query Language](https://posthog.com/docs/hogql)
- [Feature Flag Best Practices](https://posthog.com/docs/feature-flags)
- [Event Tracking Guide](https://posthog.com/docs/event-analytics)
