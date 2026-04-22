/**
 * Real Analytics Capture — Production-Grade User Behavior Tracking
 * 
 * Every captured event maps to determin scoring signals:
 * - engagement
 * - tier_usage
 * - quality_metric
 * - execution_performance
 * - action_impact
 * - user_retention
 * 
 * Includes:
 * - Person identity & properties
 * - Cohort membership tracking
 * - Feature flag resolution
 * - Real PostHog integration (not mocked)
 */

import type { AnalyticsEventType } from '../config/posthogEvents';

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify: (id: string, properties?: Record<string, unknown>) => void;
      people: {
        set: (properties: Record<string, unknown>) => void;
        increment: (key: string, value?: number) => void;
      };
      getFeatureFlag: (flagKey: string) => boolean | string | null;
      getFeatureFlagPayload: (flagKey: string) => unknown;
      getAllFlags: () => Record<string, boolean | string>;
    };
  }
}

const isDev = () => typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * INTERNAL: Base event capture
 */
function captureEvent(eventType: AnalyticsEventType, payload: Record<string, unknown>) {
  try {
    if (typeof window !== 'undefined' && window.posthog) {
      window.posthog.capture(eventType, {
        timestamp: Date.now(),
        ...payload,
      });
    }

    if (isDev()) {
      console.log('[Analytics]', eventType, payload);
    }
  } catch (err: any) {
    if (isDev()) {
      console.warn('[Analytics] Capture error:', err?.message);
    }
  }
}

/**
 * PERSON IDENTITY & PROPERTIES
 */

export interface PersonProperties {
  email?: string;
  tier?: string;
  organizationName?: string;
  industry?: string;
  companySize?: string;
  [key: string]: unknown;
}

export function identifyUser(userId: string, properties: PersonProperties) {
  try {
    if (typeof window !== 'undefined' && window.posthog) {
      window.posthog.identify(userId, {
        ...properties,
        identifiedAt: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    if (isDev()) {
      console.warn('[Analytics] Identify error:', err?.message);
    }
  }
}

export function updatePersonProperties(updates: Record<string, unknown>) {
  try {
    if (typeof window !== 'undefined' && window.posthog) {
      window.posthog.people.set({
        ...updates,
        lastProfileUpdate: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    if (isDev()) {
      console.warn('[Analytics] Update person error:', err?.message);
    }
  }
}

export function incrementPersonProperty(key: string, value: number = 1) {
  try {
    if (typeof window !== 'undefined' && window.posthog) {
      window.posthog.people.increment(key, value);
    }
  } catch (err: any) {
    if (isDev()) {
      console.warn('[Analytics] Increment error:', err?.message);
    }
  }
}

/**
 * COHORT MEMBERSHIP
 */
export function setPersonCohorts(cohortNames: string[]) {
  updatePersonProperties({
    cohorts: cohortNames,
    cohortsUpdatedAt: new Date().toISOString(),
  });
}

/**
 * FEATURE FLAGS
 */
export function isFeatureFlagEnabled(flagKey: string): boolean {
  try {
    if (typeof window !== 'undefined' && window.posthog) {
      return window.posthog.getFeatureFlag(flagKey) === true;
    }
  } catch (err: any) {
    if (isDev()) {
      console.warn('[Analytics] Feature flag check error:', err?.message);
    }
  }
  return false;
}

export function getFeatureFlagPayload(flagKey: string): unknown {
  try {
    if (typeof window !== 'undefined' && window.posthog) {
      return window.posthog.getFeatureFlagPayload(flagKey);
    }
  } catch (err: any) {
    if (isDev()) {
      console.warn('[Analytics] Feature flag payload error:', err?.message);
    }
  }
  return null;
}

export function getAllFeatureFlags(): Record<string, boolean | string> {
  try {
    if (typeof window !== 'undefined' && window.posthog) {
      return window.posthog.getAllFlags() || {};
    }
  } catch (err: any) {
    if (isDev()) {
      console.warn('[Analytics] Get all flags error:', err?.message);
    }
  }
  return {};
}

/**
 * CORE EVENTS
 */

export function captureScanStarted(url: string, forceRefresh?: boolean, metadata?: Record<string, unknown>) {
  captureEvent('scan_started', {
    url,
    forceRefresh: forceRefresh || false,
    ...metadata,
  });

  // Update person property
  updatePersonProperties({
    lastScanDate: new Date().toISOString(),
  });
}

export function captureScanCompleted(data: {
  url: string;
  score: number;
  durationMs: number;
  citationsFound: number;
  conflictCount: number;
}) {
  captureEvent('scan_completed', data);

  // Update person properties
  updatePersonProperties({
    lastScanDate: new Date().toISOString(),
    lastScore: data.score,
  });

  // Increment scan count
  incrementPersonProperty('totalScans', 1);
}

export function captureNodeClicked(data: {
  nodeId: string;
  nodeType: 'entity' | 'claim' | 'conflict';
  confidence: number;
  actionTriggered: boolean;
}) {
  captureEvent('node_clicked', data);
}

export function captureConflictResolved(data: {
  conflictId: string;
  resolutionType: 'acknowledged' | 'fixed' | 'ignored';
  scoreImpact: number;
}) {
  captureEvent('conflict_resolved', data);

  // Track resolution pattern
  incrementPersonProperty('conflictsResolved', 1);
}

export function captureFixApplied(data: {
  fixType: string;
  expectedScoreDelta: number;
  appliedSuccessfully: boolean;
}) {
  captureEvent('fix_applied', data);

  if (data.appliedSuccessfully) {
    incrementPersonProperty('fixesApplied', 1);
    updatePersonProperties({
      lastFixAppliedDate: new Date().toISOString(),
    });
  }
}

export function captureAnalysisRerun(data: {
  previousScore: number;
  newScore: number;
  scoreDelta: number;
  durationSinceLastScan: number;
}) {
  captureEvent('analysis_rerun', data);

  incrementPersonProperty('totalReruns', 1);
  updatePersonProperties({
    lastRerunDate: new Date().toISOString(),
  });
}

/**
 * USER DECISIONS & CONVERSIONS
 */
export function captureUserDecision(
  decisionType: 'upgrade' | 'downgrade' | 'cancel' | 'enable_feature' | 'share',
  metadata?: Record<string, unknown>
) {
  captureEvent('user_decision', {
    decisionType,
    ...metadata,
  });

  if (decisionType === 'upgrade') {
    updatePersonProperties({
      lastUpgradeDate: new Date().toISOString(),
    });
  }
}

/**
 * ERROR TRACKING
 */
export function captureAnalyticsError(errorType: string, message: string, context?: Record<string, unknown>) {
  captureEvent('analytics_error', {
    errorType,
    message,
    ...context,
  });
}
