/**
 * PostHog Event Schema for AiVIS
 * 
 * Tied directly to deterministic scoring and decision signals.
 * All events feed into: behavior → signal → scoring pipeline.
 */

export type AnalyticsEventType =
    | 'scan_started'
    | 'scan_completed'
    | 'node_clicked'
    | 'conflict_resolved'
    | 'fix_applied'
    | 'analysis_rerun'
    | 'user_decision';

export interface AnalyticsEvent {
    type: AnalyticsEventType;
    userId?: string;
    workspaceId?: string;
    timestamp: number;
    payload: Record<string, unknown>;
}

/**
 * Core behavior events → scoring signals
 */
export const ANALYTICS_SCHEMA = {
    scan_started: {
        description: 'User initiates visibility scan',
        payload: {
            url: 'string (normalized)',
            tier: 'string (user tier)',
            forceRefresh: 'boolean',
        },
        signals: ['engagement', 'tier_usage'],
    },
    scan_completed: {
        description: 'Scan finished and results displayed',
        payload: {
            url: 'string',
            score: 'number (0-100)',
            durationMs: 'number',
            citationsFound: 'number',
            conflictCount: 'number',
        },
        signals: ['quality_metric', 'execution_performance'],
    },
    node_clicked: {
        description: 'User interacts with graph node',
        payload: {
            nodeId: 'string',
            nodeType: 'enum: entity | claim | conflict',
            confidence: 'number',
            actionTriggered: 'boolean',
        },
        signals: ['user_intent', 'node_relevance'],
    },
    conflict_resolved: {
        description: 'User acknowledges or fixes a detected conflict',
        payload: {
            conflictId: 'string',
            resolutionType: 'enum: acknowledged | fixed | ignored',
            scoreImpact: 'number (delta)',
        },
        signals: ['decision_quality', 'active_engagement'],
    },
    fix_applied: {
        description: 'User applies a suggested fix to page',
        payload: {
            fixType: 'string (meta_update | schema_patch | content_align)',
            expectedScoreDelta: 'number',
            appliedSuccessfully: 'boolean',
        },
        signals: ['action_impact', 'user_agency'],
    },
    analysis_rerun: {
        description: 'User reruns analysis after fix to measure delta',
        payload: {
            previousScore: 'number',
            newScore: 'number',
            scoreDelta: 'number',
            durationSinceLastScan: 'number (ms)',
        },
        signals: ['verification_behavior', 'score_trajectory'],
    },
    user_decision: {
        description: 'Abstract user decision event (generic fallback)',
        payload: {
            decisionType: 'string',
            context: 'object (arbitrary)',
        },
        signals: ['user_behavior'],
    },
} as const;

/**
 * Minimal PostHog API key scopes required
 * 
 * ✓ Query (required) — read events, funnels, trends
 * ✓ Event definition (required) — understand schema
 * ✓ Feature flag (optional) — if using feature flags
 * ✓ Person (optional) — if analyzing user cohorts
 * ✓ Cohort (optional) — if building cohorts
 * 
 * ✗ Do NOT enable: Organization, Project, Integration, Plugin, Webhook, Warehouse, Access control
 */
export const POSTHOG_RECOMMENDED_SCOPES = [
    'query:read',
    'event_definition:read',
    // Optional only if you use them:
    // 'feature_flag:read',
    // 'person:read',
    // 'cohort:read',
] as const;

/**
 * Environment variables required
 */
export const POSTHOG_ENV_KEYS = {
    API_KEY: 'POSTHOG_API_KEY', // phx_xxx personal key (minimal scopes)
    PROJECT_ID: 'POSTHOG_PROJECT_ID', // optional; auto-resolved from key if not set
    API_ENDPOINT: 'POSTHOG_API_ENDPOINT', // default: https://app.posthog.com
} as const;
